-- Additive repair photo labels. Legacy rows retain an empty category list.
begin;
alter table public.repair_jobs add column photo_categories text[] not null default '{}',
 add constraint repair_photo_categories_allowed check(photo_categories <@ array['Before','After','Damage','Customer-provided']::text[]),
 add constraint repair_photo_categories_aligned check(cardinality(photo_categories)=0 or cardinality(photo_categories)=cardinality(photos));
create or replace function private.repair_job_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'code',code,'customerId',coalesce(customer_id::text,''),'customerName',customer_name,'phone',phone,'device',device,'imei',imei,
  'problem',problem,'damage',damage,'photos',to_jsonb(photos),'photoCategories',to_jsonb(photo_categories),'estimate',estimate,'advance',advance,'technicianId',coalesce(technician_id::text,''),'notes',notes,'status',status,'createdAt',created_at)
 from public.repair_jobs where id=p_id
$$;
create or replace function public.save_repair_job(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid()); previous public.repair_jobs; technician uuid:=nullif(p_input->>'technicianId','')::uuid;
 customer uuid:=nullif(p_input->>'customerId','')::uuid; customer_name text; v_status text:=coalesce(p_input->>'status','Received'); v_photo text; v_photos text[]; v_categories text[]; estimate numeric;
begin
 perform private.lock_store(p_store_id);select * into previous from public.repair_jobs where id=rid;
 if previous.id is not null and previous.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501';end if;
 perform private.require_permission(case when previous.id is null then 'repairs.create' else 'repairs.edit' end,p_store_id);
 perform private.workflow_fields(p_input,array['id','customerId','customerName','phone','device','imei','problem','damage','photos','photoCategories','estimate','advance','technicianId','notes','status']);
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
 if p_input ? 'photoCategories' then
  if jsonb_typeof(p_input->'photoCategories') is distinct from 'array' then raise exception 'Repair photo categories must be a list' using errcode='22023';end if;
  if jsonb_array_length(p_input->'photoCategories')<>cardinality(v_photos) then raise exception 'Choose a repair photo category for each photo' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_input->'photoCategories') c where jsonb_typeof(c)<>'string' or c#>>'{}' not in ('Before','After','Damage','Customer-provided')) then raise exception 'Invalid repair photo category' using errcode='22023';end if;
  select coalesce(array_agg(value),'{}') into v_categories from jsonb_array_elements_text(p_input->'photoCategories');
 else v_categories:='{}';end if;
 foreach v_photo in array v_photos loop
  if v_photo !~ ('^'||p_store_id::text||'/repair/[a-f0-9-]{36}\.webp$') or not exists(
   select 1 from app_private.media m where m.store_id=p_store_id and m.path=v_photo and m.kind='repair' and m.deleted_at is null
    and (m.entity_id is null or m.entity_id=rid::text)
    and (m.profile_id=public.current_profile_id() or exists(select 1 from app_private.camera_jobs j where j.id=m.camera_job_id and j.requester_id=public.current_profile_id() and j.type='repair')
     or previous.id is not null and v_photo=any(previous.photos))
  ) then raise exception 'Use repair photos uploaded for this job' using errcode='22023';end if;
 end loop;
 insert into public.repair_jobs(id,store_id,code,customer_id,customer_name,phone,device,imei,problem,damage,photos,photo_categories,estimate,technician_id,notes,status,created_by)
 values(rid,p_store_id,coalesce(previous.code,private.next_code('private.repair_job_number','TM-REP-')),customer,customer_name,coalesce(p_input->>'phone',''),trim(p_input->>'device'),coalesce(p_input->>'imei',''),trim(p_input->>'problem'),coalesce(p_input->>'damage',''),v_photos,v_categories,estimate,technician,coalesce(p_input->>'notes',''),v_status,public.current_profile_id())
 on conflict(id) do update set customer_id=excluded.customer_id,customer_name=excluded.customer_name,phone=excluded.phone,device=excluded.device,imei=excluded.imei,problem=excluded.problem,damage=excluded.damage,photos=excluded.photos,photo_categories=excluded.photo_categories,estimate=excluded.estimate,technician_id=excluded.technician_id,notes=excluded.notes,status=excluded.status;
 update app_private.media set entity_id=rid::text where store_id=p_store_id and kind='repair' and path=any(v_photos) and entity_id is null;
 perform private.write_audit(p_store_id,public.current_profile_id(),case when previous.id is null then 'repair.received' else 'repair.updated' end,'repair_job',rid,jsonb_build_object('status',v_status,'technicianId',technician));
 return private.repair_job_json(rid);
end $$;
revoke all on function private.repair_job_json(uuid) from public,anon,authenticated;
revoke all on function public.save_repair_job(uuid,jsonb) from public,anon;
grant execute on function public.save_repair_job(uuid,jsonb) to authenticated;
commit;
