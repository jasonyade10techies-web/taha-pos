begin;
alter table public.customers add column whatsapp_number text not null default '',add column whatsapp_same_as_phone boolean not null default true,
 add column due_at timestamptz,add column reminder_enabled boolean not null default true;
alter table public.sales add column credit_due_at timestamptz;
-- Historical test deadlines were DATE values. Preserve that precision rather than
-- manufacturing a midnight timestamp; explicit new timestamps have their own field.
alter table public.out_for_test add column due_at timestamptz;
create function private.due_timestamp(p_value jsonb) returns timestamptz language plpgsql immutable set search_path='' as $$
declare result timestamptz;
begin
 if p_value is null or p_value='null'::jsonb or p_value='""'::jsonb then return null;end if;
 if jsonb_typeof(p_value)<>'string' or p_value#>>'{}' !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-](0\d|1[0-4]):[0-5]\d)$' then raise exception 'Enter an ISO due date and time with an explicit timezone' using errcode='22023';end if;
 begin result:=(p_value#>>'{}')::timestamptz;exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Enter a valid due date and time' using errcode='22023';end;
 return result;
end $$;
create function private.whatsapp_number(p_value text) returns text language plpgsql immutable set search_path='' as $$
declare digits text;
begin
 if coalesce(trim(p_value),'')='' then return '';end if;
 if trim(p_value) !~ '^\+?[0-9][0-9 ()-]*$' then raise exception 'Enter a valid WhatsApp phone number' using errcode='22023';end if;
 digits:=regexp_replace(p_value,'[^0-9]','','g');if left(digits,2)='00' then digits:=substring(digits from 3);end if;
 if length(digits)=11 and left(digits,2)='03' then digits:='92'||substring(digits from 2);elsif length(digits)=10 and left(digits,1)='3' then digits:='92'||digits;end if;
 if length(digits) not between 10 and 15 or left(digits,1)='0' then raise exception 'Enter a valid international WhatsApp phone number' using errcode='22023';end if;return digits;
end $$;
create function private.resolved_whatsapp(p_customer public.customers) returns text language plpgsql immutable set search_path='' as $$
begin return private.whatsapp_number(case when p_customer.whatsapp_same_as_phone then p_customer.phone else p_customer.whatsapp_number end);
exception when invalid_parameter_value then return '';end $$;
alter function public.save_customer(uuid,jsonb) rename to save_customer_before_reminders;
revoke all on function public.save_customer_before_reminders(uuid,jsonb) from public,anon,authenticated;
create function public.save_customer(p_store_id uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.customers;account public.credit_accounts;rid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());due timestamptz;same boolean;number text;enabled boolean;normalized jsonb:=p_input;
begin
 perform private.lock_store(p_store_id);select * into existing from public.customers where id=rid;
 if existing.id is not null and existing.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501';end if;
 perform private.require_permission(case when existing.id is null then 'customers.create' else 'customers.edit' end,p_store_id);
 due:=case when p_input ? 'dueAt' then private.due_timestamp(p_input->'dueAt') else existing.due_at end;
 if due is distinct from existing.due_at and not (public.has_permission('customers.credit',p_store_id) or public.has_permission('credit.create',p_store_id)) then raise exception 'Credit due configuration permission required' using errcode='42501';end if;
 if p_input ? 'whatsappSameAsPhone' and jsonb_typeof(p_input->'whatsappSameAsPhone')<>'boolean' or p_input ? 'reminderEnabled' and jsonb_typeof(p_input->'reminderEnabled')<>'boolean'
  or p_input ? 'whatsappNumber' and jsonb_typeof(p_input->'whatsappNumber')<>'string' then raise exception 'Check WhatsApp and reminder settings' using errcode='22023';end if;
 same:=coalesce((p_input->>'whatsappSameAsPhone')::boolean,existing.whatsapp_same_as_phone,true);enabled:=coalesce((p_input->>'reminderEnabled')::boolean,existing.reminder_enabled,true);
 if p_input ? 'reminderEnabled' and enabled is distinct from coalesce(existing.reminder_enabled,true) and not (public.has_permission('customers.credit',p_store_id) or public.has_permission('credit.create',p_store_id)) then raise exception 'Reminder policy configuration permission required' using errcode='42501';end if;
 number:=case when same then '' else private.whatsapp_number(coalesce(p_input->>'whatsappNumber',existing.whatsapp_number,'')) end;
 if same and p_input ? 'whatsappSameAsPhone' then perform private.whatsapp_number(coalesce(p_input->>'phone',existing.phone,''));end if;
 -- Old/contact-only forms cannot reset independent credit limits by omitting them.
 select * into account from public.credit_accounts where customer_id=rid;
 if account.customer_id is not null then
  normalized:=jsonb_build_object('creditEnabled',account.enabled,'creditLimit',account.credit_limit,'enforceCreditLimit',account.enforce_limit)||normalized;
 end if;
 normalized:=normalized||jsonb_build_object('id',rid);perform public.save_customer_before_reminders(p_store_id,normalized-'dueAt'-'whatsappSameAsPhone'-'whatsappNumber'-'reminderEnabled');
 update public.customers set due_at=due,whatsapp_number=number,whatsapp_same_as_phone=same,reminder_enabled=enabled where id=rid and store_id=p_store_id;
 return rid;
end $$;
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('private.customer_json(uuid,uuid)'::regprocedure);needle:='''phone'',c.phone';if position(needle in source)=0 then raise exception 'Review customer contact DTO';end if;
 execute replace(source,needle,needle||',''whatsappNumber'',private.resolved_whatsapp(c),''whatsappSameAsPhone'',c.whatsapp_same_as_phone,''dueAt'',case when public.has_permission(''credit.create'',p_store) or public.has_permission(''credit.receive_payment'',p_store) or public.has_permission(''customers.credit'',p_store) then c.due_at end,''reminderEnabled'',c.reminder_enabled');
end $$;
alter function public.save_business_settings(uuid,jsonb) rename to save_business_settings_before_reminders;
revoke all on function public.save_business_settings_before_reminders(uuid,jsonb) from public,anon,authenticated;
create function public.save_business_settings(p_store_id uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare config jsonb:=private.settings(p_store_id);key text;
begin
 perform private.require_permission('settings.manage',p_store_id);
 foreach key in array array['creditDueRequired','remindersEnabled'] loop
  if p_input ? key and jsonb_typeof(p_input->key)<>'boolean' then raise exception 'Due and reminder settings must be enabled or disabled' using errcode='22023';end if;
 end loop;
 if p_input ? 'reminderWarningDays' and (jsonb_typeof(p_input->'reminderWarningDays')<>'number' or (p_input->>'reminderWarningDays')::numeric not between 0 and 365 or (p_input->>'reminderWarningDays')::numeric<>trunc((p_input->>'reminderWarningDays')::numeric)) then raise exception 'Reminder warning days must be a whole number from 0 to 365' using errcode='22023';end if;
 perform public.save_business_settings_before_reminders(p_store_id,jsonb_build_object('creditDueRequired',coalesce((config->>'creditDueRequired')::boolean,false),'remindersEnabled',coalesce((config->>'remindersEnabled')::boolean,false),'reminderWarningDays',coalesce((config->>'reminderWarningDays')::integer,3))||p_input);
end $$;
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.get_business_settings(uuid)'::regprocedure);needle:='return private.settings(p_store_id);';if position(needle in source)=0 then raise exception 'Review reminder settings read';end if;
 execute replace(source,needle,'return ''{"creditDueRequired":false,"remindersEnabled":false,"reminderWarningDays":3}''::jsonb||private.settings(p_store_id);');
end $$;
create function private.sale_credit_due(p_store uuid,p_input jsonb,p_credit numeric) returns timestamptz language plpgsql stable security definer set search_path='' as $$
declare due timestamptz;
begin
 if p_input ? 'creditDueAt' then due:=private.due_timestamp(p_input->'creditDueAt');end if;
 if p_credit<=0 then return null;end if;
 if due is null then select due_at into due from public.customers where store_id=p_store and id=nullif(p_input->>'customerId','')::uuid;end if;
 if due is null and coalesce((private.settings(p_store)->>'creditDueRequired')::boolean,false) then raise exception 'A credit due date and time is required before checkout' using errcode='22023';end if;
 return due;
end $$;
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 needle:='receipt_snapshot,source_test_id,tax_snapshot)';if position(needle in source)=0 then raise exception 'Review credit due sale insert';end if;source:=replace(source,needle,'receipt_snapshot,source_test_id,tax_snapshot,credit_due_at)');
 needle:='test.id,tax_snapshot-''lineAmounts'');';if position(needle in source)=0 then raise exception 'Review credit due immutable snapshot';end if;
 execute replace(source,needle,'test.id,tax_snapshot-''lineAmounts'',private.sale_credit_due(p_store_id,p_input,credit));');
 source:=pg_get_functiondef('private.sale_json(uuid,uuid)'::regprocedure);needle:='''createdAt'',s.created_at';if position(needle in source)=0 then raise exception 'Review sale due read';end if;
 execute replace(source,needle,needle||',''creditDueAt'',s.credit_due_at');
end $$;

create function private.test_due_date(p_value jsonb) returns date language plpgsql immutable set search_path='' as $$
declare stamp timestamptz;result date;
begin
 if jsonb_typeof(p_value)<>'string' then raise exception 'Enter a test return deadline' using errcode='22023';end if;
 if p_value#>>'{}' ~ '^\d{4}-\d{2}-\d{2}$' then
  begin result:=(p_value#>>'{}')::date;exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Enter a valid test return date' using errcode='22023';end;
  return result;
 end if;
 stamp:=private.due_timestamp(p_value);if stamp is null then raise exception 'Enter a test return deadline' using errcode='22023';end if;return (stamp at time zone 'Asia/Karachi')::date;
end $$;
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.save_test_out(uuid,jsonb)'::regprocedure);
 needle:='quantity,taken_date,due_date,employee_id,notes)';if position(needle in source)=0 then raise exception 'Review test due insert';end if;source:=replace(source,needle,'quantity,taken_date,due_date,employee_id,notes,due_at)');
 source:=replace(source,'(p_input->>''dueDate'')::date','private.test_due_date(p_input->''dueDate'')');
 needle:='coalesce(p_input->>''notes'',''''));';if position(needle in source)=0 then raise exception 'Review test due precision';end if;
 execute replace(source,needle,'coalesce(p_input->>''notes'',''''),case when length(p_input->>''dueDate'')>10 then private.due_timestamp(p_input->''dueDate'') end);');
 source:=pg_get_functiondef('public.update_test_out(uuid,jsonb)'::regprocedure);
 source:=replace(source,'(p_input->>''dueDate'')::date','private.test_due_date(p_input->''dueDate'')');
 source:=replace(source,'>=greatest(t.due_date,current_date) then','>=greatest(t.due_date,(now() at time zone ''Asia/Karachi'')::date) and (t.due_at is null or length(p_input->>''dueDate'')=10 or private.due_timestamp(p_input->''dueDate'')>=t.due_at) then');
 needle:='update public.out_for_test set due_date=private.test_due_date(p_input->''dueDate'')';if position(needle in source)=0 then raise exception 'Review test extension precision';end if;
 execute replace(source,needle,needle||',due_at=case when length(p_input->>''dueDate'')>10 then private.due_timestamp(p_input->''dueDate'') end');
 source:=pg_get_functiondef('private.test_json(uuid)'::regprocedure);needle:='''dueDate'',due_date';if position(needle in source)=0 then raise exception 'Review test due DTO';end if;
 execute replace(source,needle,'''dueDate'',case when due_at is not null then to_jsonb(due_at) else to_jsonb(due_date) end');
end $$;

create function private.reminder_status(p_due text,p_warning integer) returns text language plpgsql stable set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Karachi')::date;day date;stamp timestamptz;
begin
 if p_due is null then return 'Current';end if;
 if length(p_due)=10 then day:=p_due::date;if day<today then return 'Overdue';end if;
 else stamp:=p_due::timestamptz;day:=(stamp at time zone 'Asia/Karachi')::date;if stamp<now() then return 'Overdue';end if;end if;
 if day=today then return 'Due Today';elsif day<=today+p_warning then return 'Due Soon';end if;return 'Current';
end $$;
create function public.reminder_obligations(p_store_id uuid,p_customer_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare credit boolean;tests boolean;contact boolean;config jsonb:=private.settings(p_store_id);warning integer:=coalesce((config->>'reminderWarningDays')::integer,3);
begin
 if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501';end if;
 contact:=public.has_permission('customers.view',p_store_id) or public.has_permission('customers.edit',p_store_id) or public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id);
 credit:=contact and (public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id));tests:=contact and public.has_permission('inventory.transfer',p_store_id);
 if p_customer_id is not null and not exists(select 1 from public.customers where store_id=p_store_id and id=p_customer_id) then raise exception 'Customer access denied' using errcode='42501';end if;
 return (with obligations as (
  select 'credit:'||s.id id,'credit' kind,c.id customer_id,c.name customer_name,c.phone,private.resolved_whatsapp(c) whatsapp_number,s.invoice reference,
   coalesce((select string_agg(i.name,', ' order by i.id) from public.sale_items i where i.sale_id=s.id),'Credit invoice') description,s.created_at occurred_at,
   case when coalesce(s.credit_due_at,c.due_at) is not null then to_jsonb(coalesce(s.credit_due_at,c.due_at)) end due_at,
   (select sum(l.debit-l.credit) from public.credit_ledger_entries l where l.store_id=p_store_id and l.sale_id=s.id and l.customer_id=c.id) amount,null::integer quantity,s.id sale_id,null::uuid test_id,c.reminder_enabled enabled
  from public.sales s join public.customers c on c.id=s.customer_id and c.store_id=p_store_id
  where s.store_id=p_store_id and s.status not in ('Voided','Returned') and (p_customer_id is null or c.id=p_customer_id) and credit
  union all
  select 'credit-account:'||c.id,'credit',c.id,c.name,c.phone,private.resolved_whatsapp(c),'Account balance','Recorded debt without an invoice allocation',
   (select min(l.created_at) from public.credit_ledger_entries l where l.store_id=p_store_id and l.customer_id=c.id and l.sale_id is null),case when c.due_at is not null then to_jsonb(c.due_at) end,
   (select sum(l.debit-l.credit) from public.credit_ledger_entries l where l.store_id=p_store_id and l.customer_id=c.id and l.sale_id is null),null,null,null,c.reminder_enabled
  from public.customers c where c.store_id=p_store_id and (p_customer_id is null or c.id=p_customer_id) and credit
  union all
  select 'test:'||t.id,'test',c.id,c.name,c.phone,private.resolved_whatsapp(c),t.code,p.name,t.created_at,
   case when t.due_at is not null then to_jsonb(t.due_at) else to_jsonb(t.due_date) end,null,t.quantity,null,t.id,c.reminder_enabled
  from public.out_for_test t join public.customers c on c.id=t.customer_id and c.store_id=p_store_id join public.products p on p.id=t.product_id
  where t.store_id=p_store_id and t.status='OUT' and (p_customer_id is null or c.id=p_customer_id) and tests
 ) select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'kind',kind,'customerId',customer_id,'customerName',customer_name,'phone',phone,'whatsappNumber',whatsapp_number,
  'reference',reference,'description',description,'occurredAt',occurred_at,'dueAt',due_at,'amount',amount,'quantity',quantity,'saleId',sale_id,'testId',test_id,
  'status',private.reminder_status(due_at#>>'{}',warning),'reminderEnabled',coalesce((config->>'remindersEnabled')::boolean,false) and enabled)) order by occurred_at,id),'[]')
 from obligations where kind='test' or amount>0);
end $$;
create function public.reminder_alerts(p_store_id uuid,p_customer_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(obligation||jsonb_build_object('id','due:'||(obligation->>'id')||':'||(obligation->>'dueAt')||':'||(obligation->>'status'),
  'title',case obligation->>'kind' when 'credit' then 'Credit' else 'Out-for-Test' end||' · '||(obligation->>'status'),
  'description',(obligation->>'customerName')||' · '||(obligation->>'reference'),
  'href',case obligation->>'kind' when 'credit' then '/credit/'||(obligation->>'customerId') else '/out-for-test' end) order by obligation->>'dueAt',obligation->>'id'),'[]')
 from jsonb_array_elements(public.reminder_obligations(p_store_id,p_customer_id)) obligation where (obligation->>'reminderEnabled')::boolean and obligation->>'status' in ('Due Soon','Due Today','Overdue')
$$;

create table private.reminder_history(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),customer_id uuid not null,obligation_id text not null,
 kind text not null check(kind in ('credit','test')),action text not null check(action in ('prepared','whatsapp-opened','contacted')),message text not null default '' check(length(message)<=4000),
 snapshot jsonb not null,actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),foreign key(store_id,customer_id) references public.customers(store_id,id)
);
create index reminder_history_customer on private.reminder_history(store_id,customer_id,created_at,id);
alter table private.reminder_history enable row level security;
revoke all on private.reminder_history from public,anon,authenticated;
create trigger immutable before update or delete on private.reminder_history for each row execute function private.append_only();
create function private.reminder_history_event(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('id',h.id,'obligationId',h.obligation_id,'kind',h.kind,'action',h.action,'customerId',h.customer_id,'employeeId',h.actor_id,'employeeName',p.full_name,'createdAt',h.created_at,'message',h.message,
  'type','reminder-'||h.action,'title',case h.action when 'prepared' then 'Reminder Prepared' when 'whatsapp-opened' then 'WhatsApp Opened' else 'Manually Marked Contacted' end,'category',case h.kind when 'credit' then 'Credit' else 'Test Items' end,
  'reference',h.snapshot->>'reference','entityType','reminder-history','entityId',h.id,'saleId',h.snapshot->>'saleId','description',coalesce(nullif(h.message,''),case h.kind when 'credit' then 'Payment reminder' else 'Item return reminder' end),
  'amount',h.snapshot->'amount','quantity',h.snapshot->'quantity')) from private.reminder_history h join public.profiles p on p.id=h.actor_id where h.id=p_id
$$;
create function public.record_reminder_history(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid;rid uuid:=gen_random_uuid();cached jsonb;obligation jsonb;kind text:=p_input->>'kind';action text:=p_input->>'action';expected_due text;actual_due text;
begin
 if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501';end if;
 perform private.workflow_fields(p_input,array['idempotencyKey','obligationId','kind','action','message','expectedAmount','expectedDueAt','expectedQuantity']);
 if kind='credit' and not (public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id))
  or kind='test' and not (public.has_permission('inventory.transfer',p_store_id) and (public.has_permission('customers.view',p_store_id) or public.has_permission('customers.edit',p_store_id) or public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id))) then raise exception 'Reminder source permission required' using errcode='42501';end if;
 if coalesce(kind,'') not in ('credit','test') or coalesce(action,'') not in ('prepared','whatsapp-opened','contacted') then raise exception 'Select a manual reminder action; sending or delivery cannot be inferred' using errcode='22023';end if;
 if p_input ? 'message' and (jsonb_typeof(p_input->'message')<>'string' or length(p_input->>'message')>4000) then raise exception 'Keep the reminder message under 4000 characters' using errcode='22023';end if;
 perform private.lock_store(p_store_id);req:=(p_input->>'idempotencyKey')::uuid;cached:=private.cached_request(p_store_id,'reminder_history',req,p_input);if cached is not null then return cached;end if;
 select value into obligation from jsonb_array_elements(public.reminder_obligations(p_store_id)) where value->>'id'=p_input->>'obligationId' and value->>'kind'=kind;
 if obligation is null then raise exception 'This obligation is paid, returned, changed or unavailable; refresh the reminder' using errcode='22023';end if;
 if not (obligation->>'reminderEnabled')::boolean then raise exception 'Reminders are disabled for this account or shop' using errcode='22023';end if;
 if action='whatsapp-opened' and coalesce(obligation->>'whatsappNumber','')='' then raise exception 'Add a valid WhatsApp number before opening WhatsApp' using errcode='22023';end if;
 if p_input ? 'expectedAmount' then
  if jsonb_typeof(p_input->'expectedAmount')<>'number' or (p_input->>'expectedAmount')::numeric is distinct from (obligation->>'amount')::numeric then raise exception 'The outstanding balance has changed; refresh the reminder preview' using errcode='22023';end if;
 end if;
 if p_input ? 'expectedQuantity' then
  if jsonb_typeof(p_input->'expectedQuantity')<>'number' or (p_input->>'expectedQuantity')::numeric is distinct from (obligation->>'quantity')::numeric then raise exception 'The item quantity has changed; refresh the reminder preview' using errcode='22023';end if;
 end if;
 if p_input ? 'expectedDueAt' then
  actual_due:=obligation->>'dueAt';expected_due:=p_input->>'expectedDueAt';
  if actual_due is null and expected_due is not null or actual_due is not null and expected_due is null then raise exception 'The deadline has changed; refresh the reminder preview' using errcode='22023';end if;
  if actual_due is not null then
   if length(actual_due)=10 then
    if expected_due is distinct from actual_due then raise exception 'The deadline has changed; refresh the reminder preview' using errcode='22023';end if;
   elsif length(expected_due)=10 then raise exception 'The deadline has changed; refresh the reminder preview' using errcode='22023';
   elsif private.due_timestamp(p_input->'expectedDueAt') is distinct from actual_due::timestamptz then raise exception 'The deadline has changed; refresh the reminder preview' using errcode='22023';end if;
  end if;
 end if;
 insert into private.reminder_history(id,store_id,customer_id,obligation_id,kind,action,message,snapshot,actor_id)
 values(rid,p_store_id,(obligation->>'customerId')::uuid,obligation->>'id',kind,action,coalesce(p_input->>'message',''),obligation,public.current_profile_id());
 perform private.write_audit(p_store_id,public.current_profile_id(),'reminder.'||action,'reminder_history',rid,jsonb_build_object('customerId',obligation->>'customerId','obligationId',obligation->>'id','kind',kind));
 cached:=private.reminder_history_event(rid);perform private.save_request(p_store_id,'reminder_history',req,p_input,cached);return cached;
end $$;
-- Reminder messages stay in their financial/test category and obey source gates;
-- customer-profile access alone must not bypass those gates through Notes.
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.customer_activity(uuid,uuid,jsonb)'::regprocedure);
 needle:='select n.created_at,n.id::text,''Notes'',private.customer_note_event(n.id)';if position(needle in source)=0 then raise exception 'Review reminder timeline union';end if;
 execute replace(source,needle,'select h.created_at,h.id::text,case h.kind when ''credit'' then ''Credit'' else ''Test Items'' end,private.reminder_history_event(h.id)
  from private.reminder_history h where h.store_id=p_store_id and h.customer_id=p_customer_id and (h.kind=''credit'' and can_credit or h.kind=''test'' and can_tests)
  union all '||needle);
end $$;
revoke all on function private.due_timestamp(jsonb),private.whatsapp_number(text),private.resolved_whatsapp(public.customers),private.sale_credit_due(uuid,jsonb,numeric),private.test_due_date(jsonb),private.reminder_status(text,integer),private.reminder_history_event(uuid) from public,anon,authenticated;
revoke all on function public.save_customer(uuid,jsonb),public.save_business_settings(uuid,jsonb),public.reminder_obligations(uuid,uuid),public.reminder_alerts(uuid,uuid),public.record_reminder_history(uuid,jsonb) from public,anon;
grant execute on function public.save_customer(uuid,jsonb),public.save_business_settings(uuid,jsonb),public.reminder_obligations(uuid,uuid),public.reminder_alerts(uuid,uuid),public.record_reminder_history(uuid,jsonb) to authenticated;
commit;
