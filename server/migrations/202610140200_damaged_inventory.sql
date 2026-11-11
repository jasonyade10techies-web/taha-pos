begin;
alter table public.locations add column stock_condition text not null default 'Available' check(stock_condition in ('Available','Damaged'));
alter table public.locations add constraint damaged_locations_box_only check(stock_condition='Available' or kind='box');
alter table private.service_materials add constraint service_materials_store_identity unique(store_id,id);
create table private.damaged_lots(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),product_id uuid not null,
 sale_id uuid not null,return_id uuid not null,item_id uuid not null,material_id uuid references private.service_materials(id),
 original_quantity integer not null check(original_quantity>0),reason text not null,actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(store_id,id),
 foreign key(product_id,store_id) references public.products(id,store_id),foreign key(store_id,sale_id) references public.sales(store_id,id),
 foreign key(store_id,return_id) references public.returns(store_id,id),foreign key(store_id,item_id) references public.sale_items(store_id,id),
 foreign key(store_id,material_id) references private.service_materials(store_id,id)
);
create table private.condition_movements(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),lot_id uuid not null references private.damaged_lots(id),
 location_id uuid not null,quantity integer not null,action text not null check(action in ('return','transfer-in','transfer-out','recover','write-off','note')),
 request_id uuid not null,actor_id uuid not null references public.profiles(id),notes text not null default '',photos text[] not null default '{}',created_at timestamptz not null default now(),
 foreign key(location_id,store_id) references public.locations(id,store_id),
 foreign key(store_id,lot_id) references private.damaged_lots(store_id,id),
 check(action in ('return','transfer-in') and quantity>0 or action in ('transfer-out','recover','write-off') and quantity<0 or action='note' and quantity=0)
);
create index condition_balance on private.condition_movements(store_id,lot_id,location_id);
create index damaged_product on private.damaged_lots(store_id,product_id,created_at desc);
alter table private.damaged_lots enable row level security;
alter table private.condition_movements enable row level security;
revoke all on private.damaged_lots,private.condition_movements from public,anon,authenticated;
create trigger immutable before update or delete on private.damaged_lots for each row execute function private.append_only();
create trigger immutable before update or delete on private.condition_movements for each row execute function private.append_only();

create function private.require_condition_box(p_store uuid,p_location uuid,p_condition text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.locations b join public.locations s on s.id=b.parent_location_id and s.store_id=p_store and s.kind='shelf' and s.active
  join public.locations r on r.id=s.parent_location_id and r.store_id=p_store and r.kind='rack' and r.active
  where b.id=p_location and b.store_id=p_store and b.kind='box' and b.active and b.stock_condition=p_condition) then
  raise exception 'Select an active % box with active rack and shelf; damaged returns require a quarantine box',p_condition using errcode='22023';end if;
end $$;
create or replace function private.require_box(p_store uuid,p_location uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_condition_box(p_store,p_location,'Available');end $$;
create function private.sellable_location_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.locations where id=new.location_id and stock_condition='Damaged') then raise exception 'Quarantine stock cannot enter the available stock ledger' using errcode='22023';end if;
 return new;
end $$;
create trigger available_condition before insert on public.stock_movements for each row execute function private.sellable_location_guard();

alter function public.save_location(uuid,jsonb) rename to save_location_before_conditions;
revoke all on function public.save_location_before_conditions(uuid,jsonb) from public,anon,authenticated;
create function public.save_location(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.locations; condition text; result jsonb;pid uuid:=(p_input->>'id')::uuid;
begin
 perform private.require_permission('inventory.adjust',p_store_id);perform private.lock_store(p_store_id);
 select * into previous from public.locations where store_id=p_store_id and id=pid;
 condition:=coalesce(p_input->>'stockCondition',previous.stock_condition,'Available');
 if condition not in ('Available','Damaged') or condition='Damaged' and p_input->>'kind'<>'box' then raise exception 'Only boxes can be designated Damaged quarantine storage' using errcode='22023';end if;
 if previous.id is not null and condition<>previous.stock_condition and (exists(select 1 from public.stock_movements where store_id=p_store_id and location_id=pid group by product_id having sum(quantity)<>0)
  or exists(select 1 from private.condition_movements where store_id=p_store_id and location_id=pid group by lot_id having sum(quantity)<>0)) then raise exception 'Empty the location before changing its stock condition' using errcode='22023';end if;
 result:=public.save_location_before_conditions(p_store_id,p_input-'stockCondition');
 update public.locations set stock_condition=condition where store_id=p_store_id and id=pid;
 if previous.stock_condition is distinct from condition then perform private.write_audit(p_store_id,public.current_profile_id(),'location.condition_set','location',pid,jsonb_build_object('stockCondition',condition));end if;
 return (select to_jsonb(l) from public.locations l where id=pid and store_id=p_store_id);
end $$;
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.archive_location(uuid,uuid)'::regprocedure);needle:='update public.locations set active=false';
 if position(needle in source)=0 then raise exception 'Review archive location condition integration';end if;
 execute replace(source,needle,'if exists(select 1 from private.condition_movements where store_id=p_store_id and location_id=p_id group by lot_id having sum(quantity)<>0) then raise exception ''Location contains damaged stock balance'' using errcode=''22023'';end if; '||needle);
 source:=pg_get_functiondef('public.service_material_locations(uuid,uuid)'::regprocedure);
 execute replace(source,'b.active and b.kind=''box''','b.active and b.kind=''box'' and b.stock_condition=''Available''');
end $$;

create function public.condition_locations(p_store_id uuid,p_condition text default 'Damaged') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (public.has_permission('inventory.view',p_store_id) or public.has_permission('returns.create',p_store_id)) then raise exception 'Access denied' using errcode='42501';end if;
 if p_condition not in ('Available','Damaged') then raise exception 'Select Available or Damaged stock condition' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('locationId',b.id,'path',r.name||' → '||s.name||' → '||b.name,'stockCondition',b.stock_condition) order by r.name,s.name,b.name,b.id),'[]')
  from public.locations b join public.locations s on s.id=b.parent_location_id and s.store_id=p_store_id and s.active and s.kind='shelf'
  join public.locations r on r.id=s.parent_location_id and r.store_id=p_store_id and r.active and r.kind='rack'
  where b.store_id=p_store_id and b.active and b.kind='box' and b.stock_condition=p_condition);
end $$;
create function public.inventory_conditions(p_store_id uuid,p_product_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission('inventory.view',p_store_id);
 return (select coalesce(jsonb_agg(jsonb_build_object('productId',id,'available',available,'damaged',damaged,'outForTest',out_for_test,'totalPhysical',available+damaged+out_for_test) order by id),'[]') from (
  select p.id,coalesce((select sum(m.quantity) from public.stock_movements m where m.store_id=p_store_id and m.product_id=p.id),0) available,
   coalesce((select sum(m.quantity) from private.condition_movements m join private.damaged_lots d on d.id=m.lot_id where d.store_id=p_store_id and d.product_id=p.id),0) damaged,
   coalesce((select sum(t.quantity) from public.out_for_test t where t.store_id=p_store_id and t.product_id=p.id and t.status='OUT'),0) out_for_test
  from public.products p where p.store_id=p_store_id and p.category<>'Services' and not p.custom_sale_only and (p_product_id is null or p.id=p_product_id)
 ) x);
end $$;
create function private.damaged_rows(p_store uuid,p_product uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 with balances as (select lot_id,location_id,sum(quantity)::integer quantity from private.condition_movements where store_id=p_store group by lot_id,location_id),
 current_rows as (
  select d.created_at,d.id,jsonb_build_object('id',d.id,'productId',d.product_id,'productName',p.name,'quantity',b.quantity,'locationId',b.location_id,
   'locationPath',r.name||' → '||s.name||' → '||l.name,'saleId',d.sale_id,'returnId',d.return_id,'materialItemId',case when d.material_id is not null then d.item_id end,
   'invoice',sale.invoice,'customerId',coalesce(sale.customer_id::text,''),'customerName',sale.customer_name,'employeeId',d.actor_id,'employeeName',actor.full_name,'reason',d.reason,'createdAt',d.created_at,
   'disposition',case when b.quantity>0 then 'Damaged' else coalesce((select case m.action when 'recover' then 'Recovered' when 'write-off' then 'Written Off' when 'transfer-out' then 'Transferred' else 'Damaged' end from private.condition_movements m where m.lot_id=d.id and m.location_id=b.location_id and m.action<>'note' order by m.created_at desc,m.id desc limit 1),'Damaged') end,
   'photos',coalesce((select jsonb_agg(distinct photo) from private.condition_movements m cross join unnest(m.photos) photo where m.lot_id=d.id),'[]'),
   'events',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'action',m.action,'quantity',m.quantity,'locationId',m.location_id,'notes',m.notes,'photos',to_jsonb(m.photos),'employeeId',m.actor_id,'createdAt',m.created_at) order by m.created_at,m.id) from private.condition_movements m where m.lot_id=d.id),'[]')) value
  from private.damaged_lots d join balances b on b.lot_id=d.id join public.products p on p.id=d.product_id
  join public.locations l on l.id=b.location_id join public.locations s on s.id=l.parent_location_id join public.locations r on r.id=s.parent_location_id
  join public.sales sale on sale.id=d.sale_id join public.profiles actor on actor.id=d.actor_id
  where d.store_id=p_store and (p_product is null or d.product_id=p_product)
 ),legacy as (
  select ret.created_at,ret.id,jsonb_build_object('id',ret.id,'productId',i.product_id,'productName',i.name,'quantity',0,'returnedQuantity',ret.quantity,'quantityUnknown',true,'historical',true,
   'locationId','','locationPath','Unrecorded','saleId',ret.sale_id,'returnId',ret.id,'invoice',sale.invoice,'customerId',coalesce(sale.customer_id::text,''),'customerName',sale.customer_name,
   'employeeId',ret.employee_id,'employeeName',actor.full_name,'reason',ret.reason,'createdAt',ret.created_at,'disposition','Unlocated historical','photos','[]'::jsonb) value
  from public.returns ret join public.sale_items i on i.id=ret.item_id join public.sales sale on sale.id=ret.sale_id join public.profiles actor on actor.id=ret.employee_id
  where ret.store_id=p_store and ret.destination='Damaged' and not i.service and not exists(select 1 from private.damaged_lots d where d.return_id=ret.id) and (p_product is null or i.product_id=p_product)
 ) select coalesce(jsonb_agg(value order by created_at desc,id),'[]') from (select * from current_rows union all select * from legacy) x
$$;
create function public.damaged_inventory(p_store_id uuid,p_product_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform private.require_permission('inventory.view',p_store_id);return private.damaged_rows(p_store_id,p_product_id);end $$;
create function private.damage_photos(p_store uuid,p_input jsonb) returns text[] language plpgsql stable security definer set search_path='' as $$
declare photos text[];
begin
 if not p_input ? 'photos' then return '{}';end if;
 if jsonb_typeof(p_input->'photos')<>'array' or jsonb_array_length(p_input->'photos')>12 or exists(select 1 from jsonb_array_elements(p_input->'photos') p where jsonb_typeof(p)<>'string') then raise exception 'Select up to 12 uploaded damage photos' using errcode='22023';end if;
 select coalesce(array_agg(p),'{}') into photos from jsonb_array_elements_text(p_input->'photos') p;
 if cardinality(photos)<>(select count(distinct p) from unnest(photos) p) or exists(select 1 from unnest(photos) p where not exists(select 1 from app_private.media m where m.store_id=p_store and m.kind='damage' and m.path=p and m.deleted_at is null
  and (m.profile_id=public.current_profile_id() or public.has_permission('inventory.view',p_store)))) then raise exception 'Choose private damage photos uploaded to this branch' using errcode='22023';end if;
 return photos;
end $$;

create function private.return_condition_box(p_store uuid,p_item uuid,p_dest text,p_input jsonb) returns uuid language plpgsql stable security definer set search_path='' as $$
declare item public.sale_items; box uuid;
begin
 select * into item from public.sale_items where id=p_item and store_id=p_store;
 if item.id is null or item.service and not exists(select 1 from private.service_materials where item_id=p_item) or p_dest='Do Not Restore Stock' then return null;end if;
 box:=nullif(p_input->>'locationId','')::uuid;
 if p_dest='Sellable Stock' then
  if not coalesce((private.settings(p_store)->>'restoreReturns')::boolean,false) then raise exception 'Restoring sellable returns is disabled' using errcode='22023';end if;
  perform private.require_condition_box(p_store,box,'Available');
 elsif p_dest='Damaged' then perform private.require_condition_box(p_store,box,'Damaged');end if;
 return box;
end $$;
create function private.restore_return_conditions(p_store uuid,p_return uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare ret public.returns; item public.sale_items; component record; lot uuid; photos text[];
begin
 select * into ret from public.returns where id=p_return and store_id=p_store;select * into item from public.sale_items where id=ret.item_id;
 photos:=private.damage_photos(p_store,p_input);
 if ret.destination='Do Not Restore Stock' then return;end if;
 for component in
  select item.product_id product_id,ret.quantity quantity,null::uuid material_id where not item.service
  union all select m.product_id,m.quantity/item.quantity*ret.quantity,m.id from private.service_materials m where m.item_id=item.id and m.store_id=p_store
 loop
  if ret.destination='Sellable Stock' then
   insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id,notes)
   values(p_store,component.product_id,ret.location_id,component.quantity,'RETURN','return',ret.id,public.current_profile_id(),ret.reason);
  elsif ret.destination='Damaged' then
   lot:=gen_random_uuid();
   insert into private.damaged_lots(id,store_id,product_id,sale_id,return_id,item_id,material_id,original_quantity,reason,actor_id)
   values(lot,p_store,component.product_id,ret.sale_id,ret.id,item.id,component.material_id,component.quantity,ret.reason,public.current_profile_id());
   insert into private.condition_movements(store_id,lot_id,location_id,quantity,action,request_id,actor_id,notes,photos)
   values(p_store,lot,ret.location_id,component.quantity,'return',(p_input->>'idempotencyKey')::uuid,public.current_profile_id(),ret.reason,photos);
  end if;
 end loop;
end $$;
create function private.restore_void_materials(p_store uuid,p_sale uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare component private.service_materials;
begin
 for component in select * from private.service_materials where store_id=p_store and sale_id=p_sale loop
  perform private.require_box(p_store,component.location_id);
  insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id,notes)
  values(p_store,component.product_id,component.location_id,component.quantity,'RETURN','sale_void',p_sale,public.current_profile_id(),p_reason);
 end loop;
end $$;

-- Replace only stock restoration hooks and temporary Stage1 blocks. Refund,
-- approval, quantity/return limits, credit, tax and idempotency stay authoritative.
do $$declare source text;old text;begin
 source:=pg_get_functiondef('public.return_sale_item(uuid,jsonb)'::regprocedure);
 old:='if exists(select 1 from private.service_materials where store_id=p_store_id and item_id=i.id) then raise exception ''Material return requires the classified restoration workflow'' using errcode=''22023'';end if;';
 if position(old in source)=0 then raise exception 'Review Stage1 material return guard';end if;source:=replace(source,old,'');
 old:='if dest=''Sellable Stock'' and not i.service then';
 if position(old in source)=0 then raise exception 'Review return stock restoration';end if;
 source:=regexp_replace(source,'if dest=''Sellable Stock'' and not i.service then.*?end if;\s*-- A damaged return',
  'box:=private.return_condition_box(p_store_id,i.id,dest,p_input);
  -- A damaged return','s');
 old:='cached:=private.return_json(rid);';if position(old in source)=0 then raise exception 'Review return cache hook';end if;
 source:=replace(source,old,'perform private.restore_return_conditions(p_store_id,rid,p_input); '||old);execute source;
 source:=pg_get_functiondef('public.void_sale(uuid,jsonb)'::regprocedure);
 old:='if exists(select 1 from private.service_materials where store_id=p_store_id and sale_id=s.id) then raise exception ''Material restoration must use the classified material return workflow'' using errcode=''22023'';end if;';
 if position(old in source)=0 then raise exception 'Review Stage1 material void guard';end if;source:=replace(source,old,'');
 old:='cached:=private.sale_json(p_store_id,s.id);';if position(old in source)=0 then raise exception 'Review void stock hook';end if;
 source:=replace(source,old,'perform private.restore_void_materials(p_store_id,s.id,p_input->>''reason''); '||old);execute source;
 source:=pg_get_functiondef('private.return_json(uuid)'::regprocedure);
 old:='''locationId'',r.location_id';if position(old in source)=0 then raise exception 'Review return DTO';end if;
 execute replace(source,old,'''condition'',case r.destination when ''Damaged'' then ''Damaged'' when ''Sellable Stock'' then ''Available'' else null end,''material'',case when i.service then (select jsonb_build_object(''productId'',m.product_id,''quantity'',sum(m.quantity)/i.quantity*r.quantity) from private.service_materials m where m.item_id=i.id group by m.product_id) else null end,'||old);
end $$;

create function public.damaged_inventory_action(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid;lot private.damaged_lots;source uuid;destination uuid;quantity integer;expected integer;balance bigint;kind text;notes text;photos text[];cached jsonb;
begin
 perform private.workflow_fields(p_input,array['idempotencyKey','lotId','sourceLocationId','quantity','expectedQuantity','action','destinationId','notes','photos']);
 kind:=p_input->>'action';
 if kind='transfer' then perform private.require_permission('inventory.transfer',p_store_id);
 else perform private.require_permission('inventory.adjust',p_store_id);end if;
 perform private.lock_store(p_store_id);req:=(p_input->>'idempotencyKey')::uuid;
 cached:=private.cached_request(p_store_id,'damaged_action',req,p_input);if cached is not null then return cached;end if;
 if kind is null or kind not in ('transfer','recover','write-off','note') then raise exception 'Select a damaged inventory action' using errcode='22023';end if;
 if coalesce(jsonb_typeof(p_input->'quantity'),'null')<>'number' or coalesce(jsonb_typeof(p_input->'expectedQuantity'),'null')<>'number' then raise exception 'Damaged quantities must be whole numbers' using errcode='22023';end if;
 if (p_input->>'quantity')::numeric<>trunc((p_input->>'quantity')::numeric) or (p_input->>'expectedQuantity')::numeric<>trunc((p_input->>'expectedQuantity')::numeric)
  or (p_input->>'quantity')::numeric not between 0 and 999999 or (p_input->>'expectedQuantity')::numeric not between 0 and 999999 then raise exception 'Damaged quantities must be bounded whole numbers' using errcode='22023';end if;
 quantity:=(p_input->>'quantity')::integer;expected:=(p_input->>'expectedQuantity')::integer;
 if kind='note' and quantity<>0 or kind<>'note' and quantity=0 then raise exception 'Enter a positive action quantity or zero for a note' using errcode='22023';end if;
 notes:=trim(coalesce(p_input->>'notes',''));if jsonb_typeof(p_input->'notes')<>'string' or length(notes) not between 1 and 4000 then raise exception 'Explain the action in notes; a write-off requires a reason' using errcode='22023';end if;
 select * into lot from private.damaged_lots where id=(p_input->>'lotId')::uuid and store_id=p_store_id;
 if lot.id is null then raise exception 'Select a damaged lot from this branch; unlocated historical records cannot be adjusted' using errcode='22023';end if;
 source:=(p_input->>'sourceLocationId')::uuid;perform private.require_condition_box(p_store_id,source,'Damaged');
 select coalesce(sum(m.quantity),0) into balance from private.condition_movements m where m.store_id=p_store_id and m.lot_id=lot.id and m.location_id=source;
 if balance<>expected then raise exception 'Damaged stock changed; reload before continuing' using errcode='40001';end if;
 if balance<quantity then raise exception 'Insufficient damaged stock' using errcode='P0001';end if;
 photos:=private.damage_photos(p_store_id,p_input);
 if kind in ('transfer','recover') then
  destination:=(p_input->>'destinationId')::uuid;if destination is not distinct from source then raise exception 'Choose a different destination' using errcode='22023';end if;
  perform private.require_condition_box(p_store_id,destination,case when kind='transfer' then 'Damaged' else 'Available' end);
 end if;
 insert into private.condition_movements(store_id,lot_id,location_id,quantity,action,request_id,actor_id,notes,photos)
 values(p_store_id,lot.id,source,-quantity,case kind when 'transfer' then 'transfer-out' else kind end,req,public.current_profile_id(),notes,photos);
 if kind='transfer' then
  insert into private.condition_movements(store_id,lot_id,location_id,quantity,action,request_id,actor_id,notes)
  values(p_store_id,lot.id,destination,quantity,'transfer-in',req,public.current_profile_id(),notes);
 elsif kind='recover' then
  insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id,notes,idempotency_key)
  values(p_store_id,lot.product_id,destination,quantity,'RETURN','damaged_recovery',lot.id,public.current_profile_id(),notes,req::text);
  update public.purchased_devices set status='In Stock' where store_id=p_store_id and product_id=lot.product_id and status='Repair Needed'
   and (select coalesce(sum(m.quantity),0) from private.condition_movements m join private.damaged_lots d on d.id=m.lot_id where d.store_id=p_store_id and d.product_id=lot.product_id)=0
   and (select coalesce(sum(m.quantity),0) from public.stock_movements m where m.store_id=p_store_id and m.product_id=lot.product_id)>0;
 end if;
 perform private.write_audit(p_store_id,public.current_profile_id(),'inventory.damaged_'||kind,'damaged_lot',lot.id,jsonb_build_object('source',source,'destination',destination,'quantity',quantity,'notes',notes));
 cached:=private.damaged_rows(p_store_id,lot.product_id);perform private.save_request(p_store_id,'damaged_action',req,p_input,cached);return cached;
end $$;

-- Attached damage evidence cannot be deleted/detached through generic media tools.
alter function app_private.media_referenced(uuid) rename to media_referenced_before_conditions;
revoke all on function app_private.media_referenced_before_conditions(uuid) from public,anon,authenticated;
create function app_private.media_referenced(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.condition_movements c join app_private.media m on m.id=p_id where m.path=any(c.photos)) or app_private.media_referenced_before_conditions(p_id)
$$;
revoke all on function app_private.media_referenced(uuid) from public,anon,authenticated;
create function app_private.damage_evidence_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.kind='damage' and (new.deleted_at is distinct from old.deleted_at or new.entity_id is distinct from old.entity_id)
  and exists(select 1 from private.condition_movements where old.path=any(photos)) then raise exception 'Damage evidence attached to a condition record cannot be deleted or reassigned' using errcode='22023';end if;
 return new;
end $$;
create trigger attached_damage_evidence before update on app_private.media for each row execute function app_private.damage_evidence_guard();
revoke all on function app_private.damage_evidence_guard() from public,anon,authenticated;
revoke all on function public.save_location(uuid,jsonb),public.condition_locations(uuid,text),public.inventory_conditions(uuid,uuid),public.damaged_inventory(uuid,uuid),public.damaged_inventory_action(uuid,jsonb) from public,anon;
grant execute on function public.save_location(uuid,jsonb),public.condition_locations(uuid,text),public.inventory_conditions(uuid,uuid),public.damaged_inventory(uuid,uuid),public.damaged_inventory_action(uuid,jsonb) to authenticated;
revoke all on function private.require_condition_box(uuid,uuid,text),private.sellable_location_guard(),private.damaged_rows(uuid,uuid),private.damage_photos(uuid,jsonb),private.return_condition_box(uuid,uuid,text,jsonb),private.restore_return_conditions(uuid,uuid,jsonb),private.restore_void_materials(uuid,uuid,text) from public,anon,authenticated;
commit;
