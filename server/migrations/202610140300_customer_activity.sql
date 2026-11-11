begin;
create table private.customer_notes(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),customer_id uuid not null,
 actor_id uuid not null references public.profiles(id),text text not null check(length(trim(text)) between 1 and 2000),
 created_at timestamptz not null default now(),foreign key(store_id,customer_id) references public.customers(store_id,id)
);
create index customer_notes_timeline on private.customer_notes(store_id,customer_id,created_at,id);
alter table private.customer_notes enable row level security;
revoke all on private.customer_notes from public,anon,authenticated;
create trigger immutable before update or delete on private.customer_notes for each row execute function private.append_only();

create function private.customer_note_event(p_note uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',n.id,'type','note','title','Internal Account Note','category','Notes','createdAt',n.created_at,
  'employeeId',n.actor_id,'employeeName',p.full_name,'reference','Internal note','entityType','customer-note','entityId',n.id,'description',n.text)
 from private.customer_notes n join public.profiles p on p.id=n.actor_id where n.id=p_note
$$;
create function public.add_customer_note(p_store_id uuid,p_customer_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid;note uuid:=gen_random_uuid();cached jsonb;body text;payload jsonb;
begin
 perform private.require_permission('customers.edit',p_store_id);perform private.lock_store(p_store_id);
 perform private.workflow_fields(p_input,array['idempotencyKey','text']);
 if not exists(select 1 from public.customers where store_id=p_store_id and id=p_customer_id) then raise exception 'Customer access denied' using errcode='42501';end if;
 if coalesce(jsonb_typeof(p_input->'text'),'null')<>'string' then raise exception 'Enter an internal note of up to 2000 characters' using errcode='22023';end if;
 body:=trim(p_input->>'text');if length(body) not between 1 and 2000 then raise exception 'Enter an internal note of up to 2000 characters' using errcode='22023';end if;
 req:=(p_input->>'idempotencyKey')::uuid;payload:=p_input||jsonb_build_object('customerId',p_customer_id);
 cached:=private.cached_request(p_store_id,'customer_note',req,payload);if cached is not null then return cached;end if;
 insert into private.customer_notes(id,store_id,customer_id,actor_id,text) values(note,p_store_id,p_customer_id,public.current_profile_id(),body);
 perform private.write_audit(p_store_id,public.current_profile_id(),'customer.note_added','customer_note',note,jsonb_build_object('customerId',p_customer_id));
 cached:=private.customer_note_event(note);perform private.save_request(p_store_id,'customer_note',req,payload,cached);return cached;
end $$;

create function public.customer_activity(p_store_id uuid,p_customer_id uuid,p_filter jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare can_credit boolean;can_sales boolean;can_returns boolean;can_payments boolean;can_tests boolean;
 selected_category text:=coalesce(p_filter->>'category','All');ordering text:=coalesce(p_filter->>'order','newest');
 date_from date;date_to date;page_offset integer:=0;page_limit integer:=30;events jsonb;result jsonb;
begin
 if not (public.has_permission('customers.view',p_store_id) or public.has_permission('customers.edit',p_store_id)
  or public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then raise exception 'Customer activity access denied' using errcode='42501';end if;
 if not exists(select 1 from public.customers where store_id=p_store_id and id=p_customer_id) then raise exception 'Customer access denied' using errcode='42501';end if;
 perform private.workflow_fields(p_filter,array['category','from','to','order','offset','limit']);
 if selected_category not in ('All','Sales','Payments','Returns','Credit','Test Items','Notes') or ordering not in ('newest','oldest') then raise exception 'Select a valid activity category and order' using errcode='22023';end if;
 if p_filter ? 'offset' then
  if coalesce(p_filter->>'offset','') !~ '^[0-9]{1,9}$' then raise exception 'Use a non-negative activity offset' using errcode='22023';end if;
  page_offset:=(p_filter->>'offset')::integer;
 end if;
 if p_filter ? 'limit' then
  if coalesce(p_filter->>'limit','') !~ '^[0-9]{1,3}$' then raise exception 'Use an activity limit between 1 and 100' using errcode='22023';end if;
  page_limit:=(p_filter->>'limit')::integer;if page_limit not between 1 and 100 then raise exception 'Use an activity limit between 1 and 100' using errcode='22023';end if;
 end if;
 begin
  if p_filter ? 'from' then
   if coalesce(p_filter->>'from','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid activity date' using errcode='22023';end if;date_from:=(p_filter->>'from')::date;
  end if;
  if p_filter ? 'to' then
   if coalesce(p_filter->>'to','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid activity date' using errcode='22023';end if;date_to:=(p_filter->>'to')::date;
  end if;
 exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Enter valid activity dates' using errcode='22023';end;
 if date_from>date_to then raise exception 'Activity start date must not follow the end date' using errcode='22023';end if;
 can_credit:=public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id);
 can_sales:=public.has_permission('sales.view',p_store_id);
 can_returns:=can_sales or public.has_permission('returns.create',p_store_id) or public.has_permission('reports.view',p_store_id);
 can_payments:=can_credit or public.has_permission('payments.approve_electronic',p_store_id) or public.has_permission('payments.reverse',p_store_id) or public.has_permission('reports.view',p_store_id);
 can_tests:=public.has_permission('inventory.transfer',p_store_id);
 -- Each source has its own permission predicate. No generic record JSON or costs
 -- enter this projection. Credit balances cover the full ledger before filtering.
 with ledger as (
  select l.*,sum(l.debit-l.credit) over(order by l.created_at,l.id rows unbounded preceding) balance
  from public.credit_ledger_entries l where l.store_id=p_store_id and l.customer_id=p_customer_id and can_credit
 ), activity as (
  select s.created_at,'sale:'||s.id id,'Sales' category,jsonb_build_object('id','sale:'||s.id,'type','sale','title',case when s.status='Voided' then 'Sale Completed · Later Voided' else 'Sale Completed' end,
   'category','Sales','createdAt',s.created_at,'employeeId',s.employee_id,'employeeName',s.employee_name,'reference',s.invoice,'entityType','sale','entityId',s.id,'saleId',s.id,
   'description',(select string_agg(i.quantity::text||' × '||i.name,', ' order by i.id) from public.sale_items i where i.sale_id=s.id),'amount',s.total) event
  from public.sales s where s.store_id=p_store_id and s.customer_id=p_customer_id and can_sales
  union all
  select s.voided_at,'void:'||s.id,'Sales',jsonb_build_object('id','void:'||s.id,'type','void','title','Sale Voided','category','Sales','createdAt',s.voided_at,
   'employeeId',coalesce(a.actor_profile_id::text,''),'employeeName',coalesce(p.full_name,''),'reference',s.invoice,'entityType','sale','entityId',s.id,'saleId',s.id,'description',coalesce(a.metadata->>'reason','Sale void recorded'),'amount',s.total)
  from public.sales s left join lateral(select * from public.audit_logs where store_id=p_store_id and entity_id=s.id and action='sale.voided' order by created_at,id limit 1) a on true
   left join public.profiles p on p.id=a.actor_profile_id
  where s.store_id=p_store_id and s.customer_id=p_customer_id and s.voided_at is not null and can_sales
  union all
  select l.created_at,'credit:'||l.id,'Credit',jsonb_build_object('id','credit:'||l.id,'type',case when l.debit>0 then 'credit' else 'credit-adjustment' end,
   'title',case when l.description='Credit sale' then 'Credit Given' when l.description='Debt collection' then 'Credit Payment Applied' when l.description ilike '%return%' then 'Return Credit Reversal' when l.description ilike '%revers%' then 'Credit Reversal' else 'Credit Adjustment' end,
   'category','Credit','createdAt',l.created_at,'employeeId',l.employee_id,'employeeName',p.full_name,'reference',l.reference,'entityType','ledger','entityId',l.id,'saleId',l.sale_id,
   'description',l.description,'amount',greatest(l.debit,l.credit),'balance',l.balance)
  from ledger l join public.profiles p on p.id=l.employee_id
  union all
  select pay.created_at,'payment:'||pay.id,'Payments',jsonb_build_object('id','payment:'||pay.id,'type',case when pay.kind='collection' then 'payment' else pay.kind end,
   'title',case pay.kind when 'collection' then case when pay.status='Reversed' then 'Payment Received · Later Reversed' else 'Payment Received' end when 'refund' then 'Refund Recorded' else 'Payment Reversal' end,
   'category','Payments','createdAt',pay.created_at,'employeeId',pay.employee_id,'employeeName',p.full_name,'reference',pay.code,'entityType','payment','entityId',pay.id,'saleId',pay.sale_id,
   'description',concat_ws(' · ',pay.method_name,nullif(pay.notes,'')),'amount',pay.amount,
   'balance',case when can_credit then (select balance from ledger where payment_id=pay.id order by created_at desc,id desc limit 1) end)
  from public.payments pay join public.profiles p on p.id=pay.employee_id
  where pay.store_id=p_store_id and pay.customer_id=p_customer_id and pay.kind in ('collection','refund','reversal') and pay.status in ('Confirmed','Reversed') and can_payments
  union all
  select r.created_at,'return:'||r.id,'Returns',jsonb_build_object('id','return:'||r.id,'type','return','title','Product Returned','category','Returns','createdAt',r.created_at,
   'employeeId',r.employee_id,'employeeName',p.full_name,'reference',r.code,'entityType','return','entityId',r.id,'saleId',r.sale_id,'description',i.name||' · '||r.reason,'amount',r.amount,
   'quantity',coalesce((select sum(m.quantity)/i.quantity*r.quantity from private.service_materials m where m.item_id=i.id),r.quantity),'condition',r.destination)
  from public.returns r join public.sales s on s.id=r.sale_id and s.customer_id=p_customer_id join public.sale_items i on i.id=r.item_id join public.profiles p on p.id=r.employee_id
  where r.store_id=p_store_id and can_returns
  union all
  select t.created_at,'test:'||t.id,'Test Items',jsonb_build_object('id','test:'||t.id,'type','test','title','Out for Test','category','Test Items','createdAt',t.created_at,
   'employeeId',t.employee_id,'employeeName',p.full_name,'reference',t.code,'entityType','test','entityId',t.id,'description',product.name,'quantity',t.quantity)
  from public.out_for_test t join public.products product on product.id=t.product_id join public.profiles p on p.id=t.employee_id
  where t.store_id=p_store_id and t.customer_id=p_customer_id and can_tests
  union all
  select t.closed_at,'test-returned:'||t.id,'Test Items',jsonb_build_object('id','test-returned:'||t.id,'type','test-returned','title','Test Item Returned','category','Test Items','createdAt',t.closed_at,
   'employeeId',coalesce(a.actor_profile_id::text,''),'employeeName',coalesce(p.full_name,''),'reference',t.code,'entityType','test','entityId',t.id,'description',product.name,'quantity',t.quantity)
  from public.out_for_test t join public.products product on product.id=t.product_id
   left join lateral(select * from public.audit_logs where store_id=p_store_id and entity_id=t.id and action='test.return' order by created_at,id limit 1) a on true
   left join public.profiles p on p.id=a.actor_profile_id
  where t.store_id=p_store_id and t.customer_id=p_customer_id and can_tests and t.status='RETURNED' and t.closed_at is not null
  union all
  select s.created_at,'test-converted:'||t.id,'Test Items',jsonb_build_object('id','test-converted:'||t.id,'type','test-converted','title','Test Converted to Sale','category','Test Items','createdAt',s.created_at,
   'employeeId',s.employee_id,'employeeName',s.employee_name,'reference',case when can_sales then s.invoice else t.code end,'entityType',case when can_sales then 'sale' else 'test' end,
   'entityId',case when can_sales then s.id else t.id end,'saleId',case when can_sales then s.id end,'description',product.name,'quantity',t.quantity)
  from public.out_for_test t join public.sales s on s.id=t.sale_id and s.source_test_id=t.id and s.customer_id=t.customer_id join public.products product on product.id=t.product_id
  where t.store_id=p_store_id and s.store_id=p_store_id and t.customer_id=p_customer_id and can_tests
  union all
  select n.created_at,n.id::text,'Notes',private.customer_note_event(n.id) from private.customer_notes n where n.store_id=p_store_id and n.customer_id=p_customer_id
 ), selected as (
  select * from activity where (selected_category='All' or activity.category=selected_category)
   and (date_from is null or (created_at at time zone 'Asia/Karachi')::date>=date_from) and (date_to is null or (created_at at time zone 'Asia/Karachi')::date<=date_to)
 ), paged as (
  select * from selected order by case when ordering='oldest' then created_at end asc,case when ordering='newest' then created_at end desc,
   case when ordering='oldest' then id end asc,case when ordering='newest' then id end desc limit page_limit offset page_offset
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_strip_nulls(event) order by case when ordering='oldest' then created_at end asc,case when ordering='newest' then created_at end desc,case when ordering='oldest' then id end asc,case when ordering='newest' then id end desc) from paged),'[]'),
  'total',(select count(*) from selected)) into result;
 if can_credit then result:=result||jsonb_build_object('outstanding',private.credit_balance(p_store_id,p_customer_id));end if;
 return result;
end $$;
revoke all on function private.customer_note_event(uuid),public.customer_activity(uuid,uuid,jsonb),public.add_customer_note(uuid,uuid,jsonb) from public,anon;
revoke all on function private.customer_note_event(uuid) from authenticated;
grant execute on function public.customer_activity(uuid,uuid,jsonb),public.add_customer_note(uuid,uuid,jsonb) to authenticated;
commit;
