-- Repair intake and cash-shift foundations reuse the existing permissions,
-- branch membership, append-only audit and payment ledgers. No stock side effects.
begin;
insert into public.permissions(key,description) values
 ('repair.services.manage','Manage repair service catalog'),
 ('repairs.view','View repair jobs'),('repairs.create','Receive repair jobs'),('repairs.edit','Update repair jobs')
on conflict(key) do nothing;

create sequence private.repair_service_number;
create sequence private.repair_job_number;
create table public.repair_services (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 code text not null unique, name text not null check(length(trim(name)) between 1 and 200),
 category text not null check(length(trim(category)) between 1 and 120),
 selling_price numeric(14,2) not null check(selling_price>=0),
 minimum_selling_price numeric(14,2) not null check(minimum_selling_price>=0 and minimum_selling_price<=selling_price),
 active boolean not null default true, notes text not null default '' check(length(notes)<=4000),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(store_id,id),
 foreign key(id,store_id) references public.products(id,store_id)
);
-- Preserve existing catalog services and their POS identity. Service controls
-- manage the service-specific details; the sale engine retains its product DTO.
insert into public.repair_services(id,store_id,code,name,category,selling_price,minimum_selling_price,active,notes,created_by,created_at,updated_at)
 select id,store_id,internal_code,name,'Repairs',selling_price,minimum_selling_price,state='active',left(notes,4000),created_by,created_at,updated_at
 from public.products where category='Services';
create table public.repair_jobs (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 code text not null unique, customer_id uuid, customer_name text not null check(length(trim(customer_name)) between 1 and 200),
 phone text not null default '' check(length(phone)<=40), device text not null check(length(trim(device)) between 1 and 200),
 imei text not null default '' check(length(imei)<=100), problem text not null check(length(trim(problem)) between 1 and 4000),
 damage text not null default '' check(length(damage)<=4000), photos text[] not null default '{}' check(cardinality(photos)<=12),
 estimate numeric(14,2) not null default 0 check(estimate>=0),
 -- The current payment ledger has no repair deposit allocation. Never invent a
 -- financial event by editing a repair job. Paid services use the existing POS.
 advance numeric(14,2) not null default 0 check(advance=0), technician_id uuid,
 notes text not null default '' check(length(notes)<=4000),
 status text not null default 'Received' check(status in ('Received','Diagnosing','Waiting Approval','Waiting Part','In Repair','Testing','Ready','Delivered','Cancelled')),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(store_id,id), foreign key(store_id,customer_id) references public.customers(store_id,id),
 foreign key(technician_id,store_id) references public.store_memberships(profile_id,store_id)
);
create index repair_services_store on public.repair_services(store_id,active,name);
create index repair_jobs_queue on public.repair_jobs(store_id,status,created_at desc);
create index repair_jobs_technician on public.repair_jobs(store_id,technician_id,status);
create trigger touch_updated_at before update on public.repair_services for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.repair_jobs for each row execute function private.touch_updated_at();
alter table public.repair_services enable row level security;
alter table public.repair_jobs enable row level security;
revoke all on public.repair_services,public.repair_jobs from public,anon,authenticated;
grant select on public.repair_services,public.repair_jobs to authenticated;
create policy repair_services_read on public.repair_services for select to authenticated using(public.has_permission('repair.services.manage',store_id) or public.has_permission('sales.create',store_id));
create policy repair_jobs_read on public.repair_jobs for select to authenticated using(public.has_permission('repairs.view',store_id));

alter table public.shifts add column cash_expenses numeric(14,2) not null default 0 check(cash_expenses>=0),
 add column closing_cash_sales numeric(14,2), add column closing_collections numeric(14,2),
 add column closing_refunds numeric(14,2), add column closing_reversals numeric(14,2);
create function private.shift_history_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='closed' then raise exception 'Closed shift history cannot be changed' using errcode='22023';end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger closed_shift_immutable before update or delete on public.shifts for each row execute function private.shift_history_guard();

-- Validate JSON even when a caller bypasses the REST DTO. Business objects never
-- accept arbitrary metadata, purchase costs or client-computed financial values.
create function private.workflow_fields(p_input jsonb,p_allowed text[]) returns void language plpgsql set search_path='' as $$
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>65536 then raise exception 'Check the form values' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_input) k where not k=any(p_allowed)) then raise exception 'This form contains unsupported fields' using errcode='22023';end if;
end $$;
create function private.workflow_money(p_input jsonb,p_key text,p_default numeric default null) returns numeric language plpgsql set search_path='' as $$
declare amount numeric;
begin
 if not p_input ? p_key then
  if p_default is null then raise exception 'Enter the required amount' using errcode='22023';end if;
  return p_default;
 end if;
 if jsonb_typeof(p_input->p_key)<>'number' then raise exception 'Amounts must be numbers' using errcode='22023';end if;
 amount:=(p_input->>p_key)::numeric;
 if amount<0 or amount>999999999999.99 or amount<>round(amount,2) then raise exception 'Amounts must be non-negative PKR values with at most two decimal places' using errcode='22023';end if;
 return amount;
end $$;
create function private.repair_service_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'code',code,'name',name,'category',category,'sellingPrice',selling_price,'minimumSellingPrice',minimum_selling_price,'active',active,'notes',notes)
 from public.repair_services where id=p_id
$$;
create function public.repair_service_data(p_store_id uuid,p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (public.has_permission('repair.services.manage',p_store_id) or public.has_permission('sales.create',p_store_id)) then raise exception 'Access denied' using errcode='42501';end if;
 if p_id is not null then return (select private.repair_service_json(id) from public.repair_services where id=p_id and store_id=p_store_id);end if;
 return (select coalesce(jsonb_agg(private.repair_service_json(id) order by name,id),'[]') from (select id,name from public.repair_services where store_id=p_store_id order by name,id limit 2000) s);
end $$;
create function public.save_repair_service(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid()); previous public.repair_services; catalog public.products; price numeric; minimum numeric;
begin
 perform private.require_permission('repair.services.manage',p_store_id);perform private.lock_store(p_store_id);
 perform private.workflow_fields(p_input,array['id','name','category','sellingPrice','minimumSellingPrice','active','notes']);
 price:=private.workflow_money(p_input,'sellingPrice');minimum:=private.workflow_money(p_input,'minimumSellingPrice');
 if minimum>price then raise exception 'Minimum price cannot exceed selling price' using errcode='22023';end if;
 select * into previous from public.repair_services where id=rid;
 if previous.id is not null and previous.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501';end if;
 select * into catalog from public.products where id=rid;
 if catalog.id is not null and (catalog.store_id<>p_store_id or catalog.category<>'Services') then raise exception 'This service reference belongs to another catalog item' using errcode='22023';end if;
 -- Authorized service management can maintain catalog service rows without
 -- granting broad product mutation or purchase-cost permissions to that user.
 insert into public.products(id,store_id,internal_code,name,category,selling_price,minimum_selling_price,notes,state,created_by,low_stock_level)
 values(rid,p_store_id,'',trim(p_input->>'name'),'Services',price,minimum,coalesce(p_input->>'notes',''),
  case when coalesce((p_input->>'active')::boolean,true) then 'active' else 'archived' end,public.current_profile_id(),0)
 on conflict(id) do update set name=excluded.name,selling_price=excluded.selling_price,minimum_selling_price=excluded.minimum_selling_price,notes=excluded.notes,state=excluded.state;
 if catalog.id is null then
  insert into public.product_financials(product_id,store_id,purchase_cost,updated_by) values(rid,p_store_id,0,public.current_profile_id());
 end if;
 insert into public.repair_services(id,store_id,code,name,category,selling_price,minimum_selling_price,active,notes,created_by)
 values(rid,p_store_id,coalesce(previous.code,private.next_code('private.repair_service_number','TM-SVC-')),trim(p_input->>'name'),trim(p_input->>'category'),price,minimum,coalesce((p_input->>'active')::boolean,true),coalesce(p_input->>'notes',''),public.current_profile_id())
 on conflict(id) do update set name=excluded.name,category=excluded.category,selling_price=excluded.selling_price,minimum_selling_price=excluded.minimum_selling_price,active=excluded.active,notes=excluded.notes;
 perform private.write_audit(p_store_id,public.current_profile_id(),'repair_service.saved','repair_service',rid);
 return private.repair_service_json(rid);
end $$;
create function private.repair_job_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'code',code,'customerId',coalesce(customer_id::text,''),'customerName',customer_name,'phone',phone,'device',device,'imei',imei,
  'problem',problem,'damage',damage,'photos',to_jsonb(photos),'estimate',estimate,'advance',advance,'technicianId',coalesce(technician_id::text,''),'notes',notes,'status',status,'createdAt',created_at)
 from public.repair_jobs where id=p_id
$$;
create function public.repair_job_data(p_store_id uuid,p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission('repairs.view',p_store_id);
 if p_id is not null then return (select private.repair_job_json(id) from public.repair_jobs where id=p_id and store_id=p_store_id);end if;
 return (select coalesce(jsonb_agg(private.repair_job_json(id) order by created_at desc,id),'[]') from (select id,created_at from public.repair_jobs where store_id=p_store_id order by created_at desc,id limit 2000) s);
end $$;
create function public.save_repair_job(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid()); previous public.repair_jobs; technician uuid:=nullif(p_input->>'technicianId','')::uuid;
 customer uuid:=nullif(p_input->>'customerId','')::uuid; customer_name text; v_status text:=coalesce(p_input->>'status','Received'); v_photo text; v_photos text[]; estimate numeric;
begin
 perform private.lock_store(p_store_id);select * into previous from public.repair_jobs where id=rid;
 if previous.id is not null and previous.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501';end if;
 perform private.require_permission(case when previous.id is null then 'repairs.create' else 'repairs.edit' end,p_store_id);
 perform private.workflow_fields(p_input,array['id','customerId','customerName','phone','device','imei','problem','damage','photos','estimate','advance','technicianId','notes','status']);
 if private.workflow_money(p_input,'advance',0)<>0 then raise exception 'Record repair payments through the sale or customer payment workflow' using errcode='22023';end if;
 estimate:=private.workflow_money(p_input,'estimate',0);
 if v_status not in ('Received','Diagnosing','Waiting Approval','Waiting Part','In Repair','Testing','Ready','Delivered','Cancelled') then raise exception 'Select a valid repair status' using errcode='22023';end if;
 if previous.id is null and v_status<>'Received' then raise exception 'A new repair starts as Received' using errcode='22023';end if;
 if previous.id is not null and v_status<>previous.status and not (
  v_status='Cancelled' and previous.status not in ('Delivered','Cancelled') or
  previous.status='Received' and v_status='Diagnosing' or
  previous.status='Diagnosing' and v_status in ('Waiting Approval','Waiting Part','In Repair') or
  previous.status='Waiting Approval' and v_status in ('Waiting Part','In Repair','Diagnosing') or
  previous.status='Waiting Part' and v_status in ('In Repair','Diagnosing') or
  previous.status='In Repair' and v_status in ('Testing','Waiting Part') or
  previous.status='Testing' and v_status in ('Ready','In Repair') or
  previous.status='Ready' and v_status in ('Delivered','In Repair')
 ) then raise exception 'This repair status change is not allowed. Follow the repair workflow' using errcode='22023';end if;
 if technician is not null and not exists(select 1 from public.store_memberships m join public.profiles p on p.id=m.profile_id where m.store_id=p_store_id and m.profile_id=technician and m.active and p.status='active') then raise exception 'Choose an active technician from this branch' using errcode='22023';end if;
 if customer is not null then
  select name into customer_name from public.customers where id=customer and store_id=p_store_id and active;
  if not found then raise exception 'Choose an active customer from this branch' using errcode='22023';end if;
 else customer_name:=coalesce(nullif(trim(p_input->>'customerName'),''),'Walk-in Customer');end if;
 if jsonb_typeof(coalesce(p_input->'photos','[]'))<>'array' or jsonb_array_length(coalesce(p_input->'photos','[]'))>12 then raise exception 'Select up to 12 repair photos' using errcode='22023';end if;
 select coalesce(array_agg(value),'{}') into v_photos from jsonb_array_elements_text(coalesce(p_input->'photos','[]'));
 if cardinality(v_photos)<>(select count(distinct v) from unnest(v_photos) v) then raise exception 'The same repair photo was selected twice' using errcode='22023';end if;
 foreach v_photo in array v_photos loop
  if v_photo !~ ('^'||p_store_id::text||'/repair/[a-f0-9-]{36}\.webp$') or not exists(
   select 1 from app_private.media m where m.store_id=p_store_id and m.path=v_photo and m.kind='repair' and m.deleted_at is null
    and (m.entity_id is null or m.entity_id=rid::text)
    and (m.profile_id=public.current_profile_id() or exists(select 1 from app_private.camera_jobs j where j.id=m.camera_job_id and j.requester_id=public.current_profile_id() and j.type='repair')
     or previous.id is not null and v_photo=any(previous.photos))
  ) then raise exception 'Use repair photos uploaded for this job' using errcode='22023';end if;
 end loop;
 insert into public.repair_jobs(id,store_id,code,customer_id,customer_name,phone,device,imei,problem,damage,photos,estimate,technician_id,notes,status,created_by)
 values(rid,p_store_id,coalesce(previous.code,private.next_code('private.repair_job_number','TM-REP-')),customer,customer_name,coalesce(p_input->>'phone',''),trim(p_input->>'device'),coalesce(p_input->>'imei',''),trim(p_input->>'problem'),coalesce(p_input->>'damage',''),v_photos,estimate,technician,coalesce(p_input->>'notes',''),v_status,public.current_profile_id())
 on conflict(id) do update set customer_id=excluded.customer_id,customer_name=excluded.customer_name,phone=excluded.phone,device=excluded.device,imei=excluded.imei,problem=excluded.problem,damage=excluded.damage,photos=excluded.photos,estimate=excluded.estimate,technician_id=excluded.technician_id,notes=excluded.notes,status=excluded.status;
 update app_private.media set entity_id=rid::text where store_id=p_store_id and kind='repair' and path=any(v_photos) and entity_id is null;
 perform private.write_audit(p_store_id,public.current_profile_id(),case when previous.id is null then 'repair.received' else 'repair.updated' end,'repair_job',rid,jsonb_build_object('status',v_status,'technicianId',technician));
 return private.repair_job_json(rid);
end $$;

create function private.shift_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'employeeId',employee_id,'date',to_char(scheduled_start at time zone 'Asia/Karachi','YYYY-MM-DD'),
  'start',to_char(scheduled_start at time zone 'Asia/Karachi','HH24:MI'),'end',to_char(scheduled_end at time zone 'Asia/Karachi','HH24:MI'),
  'status',case status when 'open' then 'Open' when 'closed' then 'Closed' else 'Scheduled' end,'openingCash',coalesce(opening_cash,0),'countedCash',counted_cash,
  'cashExpenses',cash_expenses,'expectedCash',expected_cash,'difference',cash_difference,'notes',coalesce(closing_notes,''),'closedAt',actual_end)
 from public.shifts where id=p_id
$$;
create function public.shift_data(p_store_id uuid,p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission('shifts.manage',p_store_id);
 if p_id is not null then return (select private.shift_json(id) from public.shifts where id=p_id and store_id=p_store_id);end if;
 return (select coalesce(jsonb_agg(private.shift_json(id) order by scheduled_start desc,id),'[]') from (select id,scheduled_start from public.shifts where store_id=p_store_id and status<>'cancelled' order by scheduled_start desc,id limit 2000) s);
end $$;
create function public.save_shift(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid()); previous public.shifts; employee uuid:=(p_input->>'employeeId')::uuid;
 v_start timestamptz; v_end timestamptz; v_status text; opening numeric;
begin
 perform private.require_permission('shifts.manage',p_store_id);perform private.lock_store(p_store_id);
 perform private.workflow_fields(p_input,array['id','employeeId','date','start','end','status','openingCash','notes']);
 if coalesce(p_input->>'status','') not in ('Scheduled','Open') then raise exception 'Close shifts using cash reconciliation' using errcode='22023';end if;
 opening:=private.workflow_money(p_input,'openingCash',0);
 if coalesce(p_input->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_input->>'start','') !~ '^([01]\d|2[0-3]):[0-5]\d$' or coalesce(p_input->>'end','') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'Check shift date and times' using errcode='22023';end if;
 v_start:=((p_input->>'date')||' '||(p_input->>'start'))::timestamp at time zone 'Asia/Karachi';
 v_end:=((p_input->>'date')||' '||(p_input->>'end'))::timestamp at time zone 'Asia/Karachi';
 if v_end<=v_start then raise exception 'Shift end time must be after start time' using errcode='22023';end if;
 v_status:=case p_input->>'status' when 'Open' then 'open' else 'scheduled' end;
 select * into previous from public.shifts where id=sid;
 if previous.id is not null and previous.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501';end if;
 if previous.status='closed' then raise exception 'Closed shift history cannot be changed' using errcode='22023';end if;
 if previous.status='open' and (previous.employee_id<>employee or previous.opening_cash<>opening or previous.scheduled_start<>v_start or previous.scheduled_end<>v_end or v_status<>'open') then raise exception 'An open shift cannot be reassigned or have opening cash or schedule rewritten' using errcode='22023';end if;
 if not exists(select 1 from public.store_memberships m join public.profiles p on p.id=m.profile_id where m.store_id=p_store_id and m.profile_id=employee and m.active and p.status='active') then raise exception 'Select an active employee from this branch' using errcode='22023';end if;
 insert into public.shifts(id,store_id,employee_id,scheduled_start,scheduled_end,actual_start,status,opening_cash,closing_notes,created_by)
 values(sid,p_store_id,employee,v_start,v_end,case when v_status='open' then now() end,v_status,opening,coalesce(p_input->>'notes',''),public.current_profile_id())
 on conflict(id) do update set employee_id=excluded.employee_id,scheduled_start=excluded.scheduled_start,scheduled_end=excluded.scheduled_end,
  actual_start=coalesce(shifts.actual_start,excluded.actual_start),status=excluded.status,opening_cash=excluded.opening_cash,closing_notes=excluded.closing_notes;
 perform private.write_audit(p_store_id,public.current_profile_id(),'shift.saved','shift',sid,jsonb_build_object('status',v_status,'employeeId',employee));
 return private.shift_json(sid);
end $$;

create function private.shift_cash(p_shift public.shifts,p_until timestamptz) returns jsonb language sql stable security definer set search_path='' as $$
 -- A reversed original still represents money received at its original time.
 -- Include it once and subtract its confirmed reversal at reversal time. This
 -- remains correct when the reversal occurs in a later shift. Refunds are
 -- separate cash outflows, not subtraction of the entire original invoice.
 select jsonb_build_object('cashSales',coalesce(sum(amount) filter(where kind='sale' and status in ('Confirmed','Reversed')),0),
  'collections',coalesce(sum(amount) filter(where kind='collection' and status in ('Confirmed','Reversed')),0),
  'refunds',coalesce(sum(amount) filter(where kind='refund' and status='Confirmed'),0),
  'reversals',coalesce(sum(amount) filter(where kind='reversal' and status='Confirmed'),0),
  'purchases',0,
  'expected',coalesce(p_shift.opening_cash,0)+coalesce(sum(case when kind in ('sale','collection') and status in ('Confirmed','Reversed') then amount
    when kind in ('refund','reversal') and status='Confirmed' then -amount else 0 end),0))
 from public.payments where store_id=p_shift.store_id and employee_id=p_shift.employee_id and method_kind='Cash'
  and created_at>=p_shift.actual_start and created_at<p_until
 -- Device purchase costs are not cash payment events in the existing engine.
 -- Do not invent cash outflows from a cost table or expose purchase cost here.
$$;
create function public.shift_closing(p_store_id uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.shifts;
begin
 perform private.require_permission('shifts.manage',p_store_id);select * into s from public.shifts where id=p_id and store_id=p_store_id;
 if s.id is null or s.status not in ('open','closed') then raise exception 'Select an open or closed shift' using errcode='22023';end if;
 if s.status='closed' then return jsonb_build_object('cashSales',s.closing_cash_sales,'collections',s.closing_collections,'refunds',s.closing_refunds,'reversals',s.closing_reversals,'purchases',0,'expected',s.expected_cash+s.cash_expenses);end if;
 return private.shift_cash(s,now());
end $$;
create function public.close_shift(p_store_id uuid,p_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.shifts; flow jsonb; counted numeric; expenses numeric; expected numeric; v_now timestamptz:=now(); v_notes text:=trim(coalesce(p_input->>'notes',''));
begin
 perform private.require_permission('shifts.manage',p_store_id);perform private.lock_store(p_store_id);
 perform private.workflow_fields(p_input,array['counted','expenses','notes']);
 counted:=private.workflow_money(p_input,'counted');expenses:=private.workflow_money(p_input,'expenses',0);
 if length(v_notes)>4000 then raise exception 'Closing notes must be no more than 4000 characters' using errcode='22023';end if;
 select * into s from public.shifts where id=p_id and store_id=p_store_id for update;
 if s.id is null then raise exception 'Shift was not found' using errcode='22023';end if;
 if s.status='closed' then
  if s.counted_cash=counted and s.cash_expenses=expenses and coalesce(s.closing_notes,'')=v_notes then return private.shift_json(s.id);end if;
  raise exception 'Closed shift history cannot be changed' using errcode='22023';
 end if;
 if s.status<>'open' or s.actual_start is null then raise exception 'Only an open shift can be closed' using errcode='22023';end if;
 flow:=private.shift_cash(s,v_now);expected:=(flow->>'expected')::numeric-expenses;
 if counted<>expected and length(v_notes)=0 then raise exception 'Explain the cash difference before closing this shift' using errcode='22023';end if;
 update public.shifts set status='closed',actual_end=v_now,counted_cash=counted,cash_expenses=expenses,expected_cash=expected,closing_notes=v_notes,
  closing_cash_sales=(flow->>'cashSales')::numeric,closing_collections=(flow->>'collections')::numeric,closing_refunds=(flow->>'refunds')::numeric,closing_reversals=(flow->>'reversals')::numeric where id=s.id;
 perform private.write_audit(p_store_id,public.current_profile_id(),'shift.closed','shift',s.id,jsonb_build_object('expectedCash',expected,'countedCash',counted,'cashExpenses',expenses,'difference',counted-expected));
 return private.shift_json(s.id);
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.repair_service_data(uuid,uuid),public.save_repair_service(uuid,jsonb),public.repair_job_data(uuid,uuid),public.save_repair_job(uuid,jsonb),public.shift_data(uuid,uuid),public.save_shift(uuid,jsonb),public.shift_closing(uuid,uuid),public.close_shift(uuid,uuid,jsonb) from public,anon;
grant execute on function public.repair_service_data(uuid,uuid),public.save_repair_service(uuid,jsonb),public.repair_job_data(uuid,uuid),public.save_repair_job(uuid,jsonb),public.shift_data(uuid,uuid),public.save_shift(uuid,jsonb),public.shift_closing(uuid,uuid),public.close_shift(uuid,uuid,jsonb) to authenticated;
commit;
