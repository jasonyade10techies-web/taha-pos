begin;
create sequence private.device_number;
alter table public.purchased_devices add column id uuid not null default gen_random_uuid() unique,
  add column code text not null default '', add column details jsonb not null default '{}', add column created_at timestamptz not null default now(),
  add column employee_id uuid references public.profiles(id);
create function private.device_json(p_store uuid,p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select d.details||jsonb_build_object('id',d.id,'code',d.code,'productId',d.product_id,'status',d.status,'createdAt',d.created_at,'employeeId',d.employee_id,
   'targetPrice',p.selling_price,'minimumPrice',p.minimum_selling_price)
   ||case when public.has_permission('costs.view_purchase_cost',p_store) then jsonb_build_object('purchasePrice',f.purchase_cost) else '{}'::jsonb end
 from public.purchased_devices d join public.products p on p.id=d.product_id left join public.product_financials f on f.product_id=p.id where d.store_id=p_store and d.id=p_id
$$;
create function public.device_data(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; cached jsonb; p public.products; d public.purchased_devices; details jsonb; photo text; action text:=p_input->>'action';
begin
 perform private.require_permission('devices.buy_used',p_store_id);
 if action='list' then return (select coalesce(jsonb_agg(private.device_json(p_store_id,id) order by created_at desc),'[]') from (select id,created_at from public.purchased_devices where store_id=p_store_id order by created_at desc limit 250) q); end if;
 perform private.lock_store(p_store_id); v_id:=(p_input->>'id')::uuid;
 if action='purchase' then
   cached:=private.cached_request(p_store_id,'device_purchase',v_id,p_input); if cached is not null then return case when public.has_permission('costs.view_purchase_cost',p_store_id) then cached else cached-'purchasePrice' end; end if;
   perform private.require_permission('costs.view_purchase_cost',p_store_id);
   if length(trim(coalesce(p_input->>'seller','')))=0 or (p_input->>'purchasePrice')::numeric<=0
     or nullif(p_input->>'imei1','') is not null and p_input->>'imei1' !~ '^[0-9]{15}$'
     or nullif(p_input->>'imei2','') is not null and p_input->>'imei2' !~ '^[0-9]{15}$' then raise exception 'Seller, purchase price or IMEI is invalid' using errcode='22023'; end if;
   if exists(select 1 from public.purchased_devices pd where pd.store_id=p_store_id and (pd.imei=nullif(p_input->>'imei1','') or pd.details->>'imei2'=nullif(p_input->>'imei1','') or pd.imei=nullif(p_input->>'imei2','') or pd.details->>'imei2'=nullif(p_input->>'imei2',''))) then raise exception 'IMEI already registered' using errcode='22023'; end if;
   perform private.require_box(p_store_id,(p_input->>'locationId')::uuid);
   photo:=p_input->'photos'->>0;
   perform public.save_product(p_store_id,jsonb_build_object('id',v_id,'name',concat_ws(' ',p_input->>'brand',p_input->>'model',p_input->>'storage'),'category','Used Phones',
     'brand',p_input->>'brand','compatible_model',p_input->>'model','color_variant',p_input->>'color','quality_grade','Used','variant',p_input->>'storage','selling_price',(p_input->>'targetPrice')::numeric,
     'minimum_selling_price',(p_input->>'minimumPrice')::numeric,'purchase_cost',(p_input->>'purchasePrice')::numeric,'initial_quantity',0,'default_location_id',p_input->>'locationId','primary_image_url',photo));
   select * into p from public.products where id=v_id and store_id=p_store_id;
   select jsonb_object_agg(k,p_input->k) into details from unnest(array['seller','phone','cnic','address','brand','model','storage','color','imei1','imei2','serial','pta','battery','condition','accessories','photos']) k;
   insert into public.purchased_devices(id,product_id,store_id,status,imei,code,details,employee_id)
     values(v_id,p.id,p_store_id,'In Stock',nullif(p_input->>'imei1',''),private.next_code('private.device_number','TM-DEV-'),details,public.current_profile_id());
   insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id)
     values(p_store_id,p.id,(p_input->>'locationId')::uuid,1,'USED_DEVICE_PURCHASE','device_purchase',v_id,public.current_profile_id());
   cached:=private.device_json(p_store_id,v_id); perform private.save_request(p_store_id,'device_purchase',v_id,p_input,cached);
   perform private.write_audit(p_store_id,public.current_profile_id(),'device.purchased','device',v_id); return cached;
 elsif action='status' then
   select * into d from public.purchased_devices where store_id=p_store_id and id=v_id for update;
   if d.id is null or d.status='Sold' or p_input->>'status' not in ('In Stock','Repair Needed','Reserved') then raise exception 'Sold devices cannot be reset manually' using errcode='22023'; end if;
   update public.purchased_devices set status=p_input->>'status' where id=v_id;
   perform private.write_audit(p_store_id,public.current_profile_id(),'device.status_changed','device',v_id);
   return private.device_json(p_store_id,v_id);
 else raise exception 'Invalid device action' using errcode='22023'; end if;
end $$;
-- One physical device can never have multiple available units, including later receiving/adjustment.
create function private.device_stock_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.purchased_devices where product_id=new.product_id) then
   perform private.lock_store(new.store_id);
   if (select coalesce(sum(quantity),0) from public.stock_movements where store_id=new.store_id and product_id=new.product_id)+new.quantity>1 then raise exception 'Individually tracked device already has an available unit' using errcode='22023'; end if;
 end if;
 return new;
end $$;
create trigger device_stock_guard before insert on public.stock_movements for each row execute function private.device_stock_guard();
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.device_data(uuid,jsonb) from public,anon;
grant execute on function public.device_data(uuid,jsonb) to authenticated;
commit;
