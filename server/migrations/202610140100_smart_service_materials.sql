begin;
insert into public.permissions(key,description) values ('services.consume_inventory','Consume explicitly allocated inventory in a custom service') on conflict(key) do nothing;

-- Material snapshots remain private and append-only, including unknown costs.
-- Service sale_items retain their original customer description and empty stockAllocations.
create table private.service_materials(
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
 sale_id uuid not null, item_id uuid not null, product_id uuid not null, product_name text not null, variant text not null,
 quantity_per_service integer not null check(quantity_per_service>0), quantity integer not null check(quantity>0),
 location_id uuid not null, purchase_cost numeric(14,2) check(purchase_cost>=0), movement_id uuid not null references public.stock_movements(id),
 created_at timestamptz not null default now(),
 foreign key(store_id,sale_id) references public.sales(store_id,id), foreign key(store_id,item_id) references public.sale_items(store_id,id),
 foreign key(product_id,store_id) references public.products(id,store_id), foreign key(location_id,store_id) references public.locations(id,store_id),
 unique(item_id,location_id)
);
alter table private.service_materials enable row level security;
revoke all on private.service_materials from public,anon,authenticated;
create trigger immutable before update or delete on private.service_materials for each row execute function private.append_only();

create function public.service_material_locations(p_store_id uuid,p_product_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission('sales.create',p_store_id);perform private.require_permission('services.consume_inventory',p_store_id);
 if not exists(select 1 from public.products where store_id=p_store_id and id=p_product_id and state='active' and category<>'Services' and not custom_sale_only)
  or exists(select 1 from public.purchased_devices where product_id=p_product_id) then raise exception 'Select an active inventory component from this branch' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('productId',p_product_id,'locationId',x.id,'quantity',x.quantity,'path',x.path) order by x.path,x.id),'[]') from (
  select b.id,sum(m.quantity)::integer quantity,r.name||' → '||s.name||' → '||b.name path from public.stock_movements m
  join public.locations b on b.id=m.location_id and b.store_id=p_store_id and b.active and b.kind='box'
  join public.locations s on s.id=b.parent_location_id and s.store_id=p_store_id and s.active and s.kind='shelf'
  join public.locations r on r.id=s.parent_location_id and r.store_id=p_store_id and r.active and r.kind='rack'
  where m.store_id=p_store_id and m.product_id=p_product_id group by b.id,b.name,s.name,r.name having sum(m.quantity)>0
 ) x);
end $$;
revoke all on function public.service_material_locations(uuid,uuid) from public,anon;
grant execute on function public.service_material_locations(uuid,uuid) to authenticated;

create function private.service_material_cost(p_store uuid,p_product uuid) returns numeric language plpgsql stable security definer set search_path='' as $$
declare custom jsonb; material jsonb; units numeric; component uuid; cost numeric;
begin
 select input into custom from private.custom_service_lines where store_id=p_store and product_id=p_product;
 if not found then return null;end if;
 if not (custom ? 'material') then return 0;end if;
 material:=custom->'material';
 perform private.workflow_fields(material,array['productId','quantity','allocations']);
 -- Validate before casting/multiplication, rather than relying on later stock
 -- validation or an immutable numeric snapshot's overflow/check constraints.
 if coalesce(jsonb_typeof(material->'quantity'),'null')<>'number' then raise exception 'Material quantity must be a positive integer' using errcode='22023';end if;
 units:=(material->>'quantity')::numeric;
 if units not between 1 and 999999 or units<>trunc(units) then raise exception 'Material quantity must be a positive integer' using errcode='22023';end if;
 if coalesce(jsonb_typeof(material->'productId'),'null')<>'string' or coalesce(material->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Select a valid material product reference' using errcode='22023';end if;
 component:=(material->>'productId')::uuid;
 select purchase_cost*units into cost from public.product_financials where store_id=p_store and product_id=component;
 if cost>999999999999.99 then raise exception 'Material cost snapshot exceeds the supported amount' using errcode='22023';end if;
 return cost;
end
$$;
create function private.sale_material_json(p_item uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('productId',m.product_id,'name',m.product_name,'variant',m.variant,'quantity',sum(m.quantity),
  'quantityPerService',m.quantity_per_service,'allocations',jsonb_agg(jsonb_build_object('locationId',m.location_id,'quantity',m.quantity) order by m.location_id))
 from private.service_materials m where m.item_id=p_item group by m.product_id,m.product_name,m.variant,m.quantity_per_service
$$;
create function private.consume_service_materials(p_store uuid,p_sale uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare line jsonb; material jsonb; allocation jsonb; product public.products; item public.sale_items;
 units integer; line_units integer; allocated bigint; loc uuid; take integer; available bigint; cost numeric; movement uuid;
begin
 for line in select value from jsonb_array_elements(p_input->'lines') loop
  if not coalesce(line->'customService' ? 'material',false) then continue;end if;
  perform private.require_permission('services.consume_inventory',p_store);
  material:=line->'customService'->'material';
  perform private.workflow_fields(material,array['productId','quantity','allocations']);
  if coalesce(jsonb_typeof(material->'quantity'),'null')<>'number' or (material->>'quantity')::numeric not between 1 and 999999
   or (material->>'quantity')::numeric<>trunc((material->>'quantity')::numeric)
   or coalesce(jsonb_typeof(line->'quantity'),'null')<>'number' or (line->>'quantity')::numeric not between 1 and 999999
   or (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric) then raise exception 'Material quantity must be a positive integer' using errcode='22023';end if;
  units:=(material->>'quantity')::integer;line_units:=(line->>'quantity')::integer;
  if units::bigint*line_units>999999 then raise exception 'Material quantity is too large' using errcode='22023';end if;
  select * into product from public.products where store_id=p_store and id=(material->>'productId')::uuid and state='active' and category<>'Services' and not custom_sale_only;
  if product.id is null or exists(select 1 from public.purchased_devices where product_id=product.id) then raise exception 'Select an active inventory component from this branch; services and used devices cannot be materials' using errcode='22023';end if;
  if coalesce(jsonb_typeof(material->'allocations'),'null')<>'array' or jsonb_array_length(material->'allocations') not between 1 and 100 then raise exception 'Select material box allocations' using errcode='22023';end if;
  if (select count(distinct a->>'locationId') from jsonb_array_elements(material->'allocations') a)<>jsonb_array_length(material->'allocations') then raise exception 'A material box was selected twice' using errcode='22023';end if;
  allocated:=0;
  for allocation in select value from jsonb_array_elements(material->'allocations') loop
   perform private.workflow_fields(allocation,array['locationId','quantity']);
   if coalesce(jsonb_typeof(allocation->'quantity'),'null')<>'number' or (allocation->>'quantity')::numeric not between 1 and 999999
    or (allocation->>'quantity')::numeric<>trunc((allocation->>'quantity')::numeric) then raise exception 'Material allocation quantity must be a positive integer' using errcode='22023';end if;
   loc:=(allocation->>'locationId')::uuid;perform private.require_box(p_store,loc);allocated:=allocated+(allocation->>'quantity')::integer;
  end loop;
  if allocated<>units then raise exception 'Material allocations must equal the quantity per service item' using errcode='22023';end if;
  select * into item from public.sale_items where store_id=p_store and sale_id=p_sale and product_id=substring(line->>'productId' from 8)::uuid and service;
  if item.id is null or item.quantity<>line_units then raise exception 'Linked service does not match this sale' using errcode='22023';end if;
  select purchase_cost into cost from public.product_financials where store_id=p_store and product_id=product.id;
  for allocation in select value from jsonb_array_elements(material->'allocations') loop
   loc:=(allocation->>'locationId')::uuid;take:=(allocation->>'quantity')::integer*line_units;
   select coalesce(sum(quantity),0) into available from public.stock_movements where store_id=p_store and product_id=product.id and location_id=loc;
   if available<take then raise exception 'Insufficient stock for material % in the selected box',product.name using errcode='P0001';end if;
   movement:=gen_random_uuid();
   insert into public.stock_movements(id,store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id,notes)
   values(movement,p_store,product.id,loc,-take,'REPAIR_USE','sale',p_sale,public.current_profile_id(),'Material consumed for service sale item '||item.id::text);
   insert into private.service_materials(store_id,sale_id,item_id,product_id,product_name,variant,quantity_per_service,quantity,location_id,purchase_cost,movement_id)
   values(p_store,p_sale,item.id,product.id,product.name,product.variant,units,take,loc,cost,movement);
  end loop;
  perform private.write_audit(p_store,public.current_profile_id(),'service.material_consumed','sale',p_sale,jsonb_build_object('itemId',item.id,'productId',product.id,'quantity',units*line_units));
 end loop;
end $$;

-- Fail closed for newly linked-material return/void until Stage2 supplies the
-- condition-aware restoration ledger. Existing service-only/product paths stay intact.
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.void_sale(uuid,jsonb)'::regprocedure);
 needle:='select greatest(0,coalesce(sum(debit-credit),0)) into debt';
 if position(needle in source)=0 then raise exception 'Void engine changed; review material guard';end if;
 execute replace(source,needle,'if exists(select 1 from private.service_materials where store_id=p_store_id and sale_id=s.id) then raise exception ''Material restoration must use the classified material return workflow'' using errcode=''22023'';end if;
 '||needle);
 source:=pg_get_functiondef('public.return_sale_item(uuid,jsonb)'::regprocedure);
 needle:='settings:=private.settings(p_store_id);';
 if position(needle in source)=0 then raise exception 'Return engine changed; review material guard';end if;
 execute replace(source,needle,'if exists(select 1 from private.service_materials where store_id=p_store_id and item_id=i.id) then raise exception ''Material return requires the classified restoration workflow'' using errcode=''22023'';end if;
 '||needle);
end $$;

-- Preserve the mature price/approval/coupon/tax/payment engine. Snapshot the cost at
-- its initial immutable INSERT; then consume materials before the custom request is cached.
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 needle:='case when p.category=''Services'' then 0 else (select purchase_cost from public.product_financials where product_id=p.id) end';
 if position(needle in source)=0 then raise exception 'Sale financial insertion changed; review Stage1 integration';end if;
 execute replace(source,needle,'case when p.category=''Services'' then case when p.custom_sale_only then private.service_material_cost(p_store_id,p.id) else 0 end else (select purchase_cost from public.product_financials where product_id=p.id) end');
 source:=pg_get_functiondef('private.sale_json(uuid,uuid)'::regprocedure);
 needle:='''service'',i.service';if position(needle in source)=0 then raise exception 'Sale read model changed; review material DTO';end if;
 execute replace(source,needle,'''material'',private.sale_material_json(i.id),''service'',i.service');
 source:=pg_get_functiondef('public.complete_sale(uuid,jsonb)'::regprocedure);
 source:=replace(source,'result jsonb;','result jsonb; material_result jsonb;');
 needle:='result:=public.complete_catalog_sale(p_store_id,normalized);';
 if position(needle in source)=0 then raise exception 'Custom sale wrapper changed; review Stage1 integration';end if;
 execute replace(source,needle,needle||'
 perform private.consume_service_materials(p_store_id,(result->>''id'')::uuid,p_input);
 result:=private.sale_json(p_store_id,(result->>''id'')::uuid);
 material_result:=result;
 update private.transaction_requests set result=material_result where store_id=p_store_id and actor_id=actor and operation=''sale'' and request_id=req;');
end $$;

-- Existing duplicates are retained as historical rows. The store transaction lock
-- serializes normalized name checks, preventing new duplicates without deleting history.
create function private.normalized_service_name(p_name text) returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(trim(p_name),'\s+',' ','g'))
$$;
create index repair_services_normalized_name on public.repair_services(store_id,private.normalized_service_name(name));
alter function public.save_repair_service(uuid,jsonb) rename to save_repair_service_before_phase5c;
revoke all on function public.save_repair_service_before_phase5c(uuid,jsonb) from public,anon,authenticated;
create function public.save_repair_service(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.repair_services; duplicate public.repair_services; rid uuid:=nullif(p_input->>'id','')::uuid;
begin
 if not (public.has_permission('repair.services.manage',p_store_id) or public.has_permission('services.save_catalog',p_store_id)) then raise exception 'Service catalog permission required' using errcode='42501';end if;
 perform private.lock_store(p_store_id);
 perform private.workflow_fields(p_input,array['id','name','category','sellingPrice','minimumSellingPrice','active','notes']);
 perform private.workflow_money(p_input,'sellingPrice');perform private.workflow_money(p_input,'minimumSellingPrice');
 if length(trim(coalesce(p_input->>'name',''))) not between 1 and 200 then raise exception 'Enter a valid service name' using errcode='22023';end if;
 select * into existing from public.repair_services where id=rid;
 if existing.id is not null then
  perform private.require_permission('repair.services.manage',p_store_id);
  if existing.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501';end if;
 end if;
 select * into duplicate from public.repair_services where store_id=p_store_id and private.normalized_service_name(name)=private.normalized_service_name(p_input->>'name')
  and id is distinct from existing.id order by created_at,id limit 1;
 if duplicate.id is not null then
  if existing.id is null then return private.repair_service_json(duplicate.id);end if;
  if private.normalized_service_name(existing.name)<>private.normalized_service_name(p_input->>'name') then raise exception 'A service with this name already exists' using errcode='22023';end if;
 end if;
 return public.save_repair_service_before_phase5c(p_store_id,p_input);
end $$;
revoke all on function public.save_repair_service(uuid,jsonb) from public,anon;
grant execute on function public.save_repair_service(uuid,jsonb) to authenticated;
revoke all on function private.service_material_cost(uuid,uuid),private.sale_material_json(uuid),private.consume_service_materials(uuid,uuid,jsonb),private.normalized_service_name(text) from public,anon,authenticated;
commit;
