-- Phase 3A: all mutations go through authorized, atomic RPCs. No demo inventory.
begin;
alter table public.products drop constraint products_category_check;
alter table public.products add constraint products_category_nonempty check(length(trim(category)) between 1 and 80);
alter table public.products add column variant text not null default '';
alter table public.products add column unit text not null default 'Piece';
alter table public.products add column default_location_id uuid;
alter table public.products add foreign key(default_location_id,store_id) references public.locations(id,store_id);

create table public.catalog_values (
  store_id uuid not null references public.stores(id),
  kind text not null check(kind in ('category','brand','model','grade','color')),
  value text not null check(length(trim(value)) between 1 and 120),
  created_at timestamptz not null default now(), primary key(store_id,kind,value)
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  name text not null check(length(trim(name)) between 1 and 120), phone text not null default '',
  whatsapp text not null default '', address text not null default '', notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,store_id)
);
create table public.stock_receipts (
  id uuid primary key, store_id uuid not null references public.stores(id), supplier_id uuid not null,
  reference text not null default '', received_date date not null,
  status text not null check(status in ('Draft','Received')), actor_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(supplier_id,store_id) references public.suppliers(id,store_id), unique(id,store_id)
);
create table public.stock_receipt_lines (
  receipt_id uuid not null, store_id uuid not null, line_no integer not null check(line_no > 0),
  product_id uuid not null, location_id uuid not null, quantity integer not null check(quantity > 0),
  primary key(receipt_id,line_no), foreign key(receipt_id,store_id) references public.stock_receipts(id,store_id),
  foreign key(product_id,store_id) references public.products(id,store_id),
  foreign key(location_id,store_id) references public.locations(id,store_id)
);
-- Receipt costs never travel with the broad receipt/stock DTO.
create table public.stock_receipt_costs (
  receipt_id uuid not null, line_no integer not null, store_id uuid not null references public.stores(id),
  purchase_cost numeric(14,2) not null check(purchase_cost >= 0), primary key(receipt_id,line_no),
  foreign key(receipt_id,line_no) references public.stock_receipt_lines(receipt_id,line_no)
);
create index receipts_store_date on public.stock_receipts(store_id,created_at desc);
create index suppliers_store on public.suppliers(store_id,name);
create index receipt_lines_product on public.stock_receipt_lines(store_id,product_id);
create index movements_transfer on public.stock_movements(store_id,transfer_group_id) where transfer_group_id is not null;
create trigger touch_updated_at before update on public.suppliers for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.stock_receipts for each row execute function private.touch_updated_at();
do $$ declare t text; begin
  foreach t in array array['catalog_values','suppliers','stock_receipts','stock_receipt_lines','stock_receipt_costs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
create policy values_read on public.catalog_values for select to authenticated using(public.has_permission('inventory.view',store_id) or public.has_permission('products.create',store_id) or public.has_permission('products.edit',store_id));
create policy suppliers_read on public.suppliers for select to authenticated using(public.has_permission('inventory.receive',store_id));
create policy receipts_read on public.stock_receipts for select to authenticated using(public.has_permission('inventory.receive',store_id));
create policy receipt_lines_read on public.stock_receipt_lines for select to authenticated using(public.has_permission('inventory.receive',store_id));
create policy receipt_costs_read on public.stock_receipt_costs for select to authenticated using(public.has_permission('inventory.receive',store_id) and public.has_permission('costs.view_purchase_cost',store_id));
-- Safe reads for employees granted a stock operation, without requiring an extra catalog grant.
drop policy products_read on public.products;
create policy products_read on public.products for select to authenticated using(
  public.has_permission('inventory.view',store_id) or public.has_permission('sales.create',store_id) or
  public.has_permission('products.create',store_id) or public.has_permission('products.edit',store_id) or
  public.has_permission('inventory.receive',store_id) or public.has_permission('inventory.transfer',store_id) or public.has_permission('inventory.adjust',store_id));
drop policy locations_read on public.locations;
create policy locations_read on public.locations for select to authenticated using(
  public.has_permission('inventory.view',store_id) or public.has_permission('sales.create',store_id) or
  public.has_permission('products.create',store_id) or public.has_permission('products.edit',store_id) or
  public.has_permission('inventory.receive',store_id) or public.has_permission('inventory.transfer',store_id) or public.has_permission('inventory.adjust',store_id));
drop policy movements_read on public.stock_movements;
create policy movements_read on public.stock_movements for select to authenticated using(
  public.has_permission('inventory.view',store_id) or public.has_permission('sales.create',store_id) or
  public.has_permission('inventory.receive',store_id) or public.has_permission('inventory.transfer',store_id) or public.has_permission('inventory.adjust',store_id));

create function private.require_permission(p_key text,p_store uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission(p_key,p_store) then raise exception 'Access denied' using errcode='42501'; end if;
end $$;
-- One physical shop: serialize stock/catalog/location writes on its store row. This also
-- prevents archive-vs-receive races. Different stores never block one another.
create function private.lock_store(p_store uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.stores where id=p_store and status='active' for update;
  if not found then raise exception 'Inactive branch' using errcode='22023'; end if;
end $$;
create function private.require_box(p_store uuid,p_location uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.locations b join public.locations s on s.id=b.parent_location_id
    join public.locations r on r.id=s.parent_location_id
    where b.id=p_location and b.store_id=p_store and b.kind='box' and b.active and s.active and r.active) then
    raise exception 'Select an active box' using errcode='22023'; end if;
end $$;
create function private.remember_product_values(p_product public.products) returns void
language sql security definer set search_path='' as $$
  insert into public.catalog_values(store_id,kind,value)
  select p_product.store_id,v.kind,trim(v.value) from (values
    ('category',p_product.category),('brand',p_product.brand),('model',p_product.compatible_model),
    ('grade',p_product.quality_grade),('color',p_product.color_variant)) v(kind,value)
    where length(trim(v.value))>0 on conflict do nothing
$$;

create function public.save_product(p_store_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.products; saved public.products; pid uuid; opening integer;
begin
  pid := coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());
  perform private.lock_store(p_store_id);
  select * into old from public.products where id=pid and store_id=p_store_id;
  perform private.require_permission(case when old.id is null then 'products.create' else 'products.edit' end,p_store_id);
  if old.id is not null and (p_input->>'expected_updated_at')::timestamptz is distinct from old.updated_at then
    raise exception 'Record changed; reload before saving' using errcode='40001'; end if;
  opening := coalesce((p_input->>'initial_quantity')::integer,0);
  if opening<0 or (old.id is not null and opening<>0) then raise exception 'Invalid opening quantity' using errcode='22023'; end if;
  if opening>0 then perform private.require_permission('inventory.adjust',p_store_id); end if;
  if p_input ? 'purchase_cost' then perform private.require_permission('costs.view_purchase_cost',p_store_id); end if;
  if nullif(p_input->>'default_location_id','') is not null then
    perform private.require_box(p_store_id,(p_input->>'default_location_id')::uuid);
  elsif opening>0 then raise exception 'Opening stock needs a box' using errcode='22023'; end if;
  if nullif(p_input->>'primary_image_url','') is not null and
    (p_input->>'primary_image_url') !~ ('^'||p_store_id::text||'/[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$') then
    raise exception 'Invalid image path' using errcode='22023'; end if;
  insert into public.products(id,store_id,name,category,brand,compatible_model,quality_grade,color_variant,
    selling_price,minimum_selling_price,aliases,notes,low_stock_level,primary_image_url,state,created_by,variant,unit,default_location_id)
  values(pid,p_store_id,trim(p_input->>'name'),trim(p_input->>'category'),trim(coalesce(p_input->>'brand','')),
    trim(coalesce(p_input->>'compatible_model','')),trim(coalesce(p_input->>'quality_grade','')),trim(coalesce(p_input->>'color_variant','')),
    (p_input->>'selling_price')::numeric,(p_input->>'minimum_selling_price')::numeric,
    array(select trim(value) from jsonb_array_elements_text(coalesce(p_input->'aliases','[]')) where length(trim(value))>0),
    coalesce(p_input->>'notes',''),coalesce((p_input->>'low_stock_level')::integer,5),nullif(p_input->>'primary_image_url',''),
    'active',public.current_profile_id(),coalesce(p_input->>'variant',''),coalesce(nullif(p_input->>'unit',''),'Piece'),nullif(p_input->>'default_location_id','')::uuid)
  on conflict(id) do update set name=excluded.name,category=excluded.category,brand=excluded.brand,compatible_model=excluded.compatible_model,
    quality_grade=excluded.quality_grade,color_variant=excluded.color_variant,selling_price=excluded.selling_price,
    minimum_selling_price=excluded.minimum_selling_price,aliases=excluded.aliases,notes=excluded.notes,low_stock_level=excluded.low_stock_level,
    primary_image_url=excluded.primary_image_url,variant=excluded.variant,unit=excluded.unit,default_location_id=excluded.default_location_id
  where products.store_id=p_store_id returning * into saved;
  if saved.id is null then raise exception 'Access denied' using errcode='42501'; end if;
  if p_input ? 'purchase_cost' then
    insert into public.product_financials(product_id,store_id,purchase_cost,updated_by)
    values(pid,p_store_id,(p_input->>'purchase_cost')::numeric,public.current_profile_id())
    on conflict(product_id) do update set purchase_cost=excluded.purchase_cost,updated_by=excluded.updated_by;
  end if;
  if opening>0 then
    insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,actor_profile_id,reference_type,reference_id,notes)
    values(p_store_id,pid,saved.default_location_id,opening,'ADJUSTMENT',public.current_profile_id(),'product',pid,'Opening Stock');
    perform private.write_audit(p_store_id,public.current_profile_id(),'stock.adjusted','product',pid,jsonb_build_object('quantity',opening,'reason','Opening Stock'));
  end if;
  perform private.remember_product_values(saved);
  perform private.write_audit(p_store_id,public.current_profile_id(),case when old.id is null then 'product.created' else 'product.edited' end,'product',pid);
  return to_jsonb(saved);
end $$;
create function public.duplicate_product(p_store_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original public.products; saved public.products;
begin
  perform private.require_permission('products.create',p_store_id); perform private.lock_store(p_store_id);
  select * into original from public.products where id=p_id and store_id=p_store_id;
  if original.id is null then raise exception 'Product not found' using errcode='22023'; end if;
  insert into public.products(store_id,name,category,brand,compatible_model,quality_grade,color_variant,selling_price,minimum_selling_price,
    aliases,notes,low_stock_level,primary_image_url,created_by,variant,unit,default_location_id)
  values(p_store_id,original.name||' · Copy',original.category,original.brand,original.compatible_model,original.quality_grade,original.color_variant,
    original.selling_price,original.minimum_selling_price,original.aliases,original.notes,original.low_stock_level,original.primary_image_url,
    public.current_profile_id(),original.variant,original.unit,original.default_location_id) returning * into saved;
  perform private.write_audit(p_store_id,public.current_profile_id(),'product.duplicated','product',saved.id,jsonb_build_object('source_id',p_id));
  return to_jsonb(saved);
end $$;
create function public.archive_product(p_store_id uuid,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_permission('products.archive',p_store_id); perform private.lock_store(p_store_id);
  update public.products set state='archived' where id=p_id and store_id=p_store_id;
  if not found then raise exception 'Product not found' using errcode='22023'; end if;
  perform private.write_audit(p_store_id,public.current_profile_id(),'product.archived','product',p_id);
end $$;
create function public.save_location(p_store_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.locations; saved public.locations; pid uuid := (p_input->>'id')::uuid; parent uuid := nullif(p_input->>'parent_id','')::uuid;
begin
  perform private.require_permission('inventory.adjust',p_store_id); perform private.lock_store(p_store_id);
  select * into old from public.locations where id=pid and store_id=p_store_id;
  if old.id is not null then
    if (p_input->>'expected_updated_at')::timestamptz is distinct from old.updated_at then raise exception 'Record changed; reload before saving' using errcode='40001'; end if;
    if old.parent_location_id is distinct from parent or old.kind<>p_input->>'kind' then raise exception 'Hierarchy is permanent' using errcode='22023'; end if;
  end if;
  if parent is not null and not exists(select 1 from public.locations where id=parent and store_id=p_store_id and active) then
    raise exception 'Parent location is inactive' using errcode='22023'; end if;
  insert into public.locations(id,store_id,name,kind,parent_location_id,created_by)
    values(pid,p_store_id,trim(p_input->>'name'),p_input->>'kind',parent,public.current_profile_id())
    on conflict(id) do update set name=excluded.name where locations.store_id=p_store_id returning * into saved;
  if saved.id is null then raise exception 'Access denied' using errcode='42501'; end if;
  perform private.write_audit(p_store_id,public.current_profile_id(),case when old.id is null then 'location.created' else 'location.renamed' end,'location',pid);
  return to_jsonb(saved);
end $$;
create function public.archive_location(p_store_id uuid,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_permission('inventory.adjust',p_store_id); perform private.lock_store(p_store_id);
  if exists(select 1 from public.locations where parent_location_id=p_id and active) then raise exception 'Archive empty children first' using errcode='22023'; end if;
  if exists(select 1 from public.stock_movements where store_id=p_store_id and location_id=p_id group by product_id having sum(quantity)<>0) then
    raise exception 'Location contains stock' using errcode='22023'; end if;
  update public.locations set active=false where id=p_id and store_id=p_store_id;
  if not found then raise exception 'Location not found' using errcode='22023'; end if;
  perform private.write_audit(p_store_id,public.current_profile_id(),'location.archived','location',p_id);
end $$;
create function public.save_supplier(p_store_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved public.suppliers;
begin
  perform private.require_permission('inventory.receive',p_store_id); perform private.lock_store(p_store_id);
  insert into public.suppliers(id,store_id,name,phone,whatsapp,address,notes)
    values((p_input->>'id')::uuid,p_store_id,trim(p_input->>'name'),coalesce(p_input->>'phone',''),coalesce(p_input->>'whatsapp',''),coalesce(p_input->>'address',''),coalesce(p_input->>'notes',''))
    on conflict(id) do update set name=excluded.name,phone=excluded.phone,whatsapp=excluded.whatsapp,address=excluded.address,notes=excluded.notes
    where suppliers.store_id=p_store_id returning * into saved;
  if saved.id is null then raise exception 'Access denied' using errcode='42501'; end if;
  perform private.write_audit(p_store_id,public.current_profile_id(),'supplier.saved','supplier',saved.id);
  return to_jsonb(saved);
end $$;

create function public.save_stock_receipt(p_store_id uuid,p_input jsonb,p_receive boolean) returns void
language plpgsql security definer set search_path='' as $$
declare receipt uuid := (p_input->>'id')::uuid; line jsonb; i integer := 0; pid uuid; loc uuid; qty integer; old public.stock_receipts;
begin
  perform private.require_permission('inventory.receive',p_store_id); perform private.lock_store(p_store_id);
  select * into old from public.stock_receipts where id=receipt;
  if old.id is not null and old.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501'; end if;
  if old.status='Received' then raise exception 'Receipt already received' using errcode='23505'; end if;
  if jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines') not between 1 and 200 then
    raise exception 'Add between 1 and 200 receipt lines' using errcode='22023'; end if;
  insert into public.stock_receipts(id,store_id,supplier_id,reference,received_date,status,actor_profile_id)
    values(receipt,p_store_id,(p_input->>'supplier_id')::uuid,coalesce(p_input->>'reference',''),(p_input->>'date')::date,
      case when p_receive then 'Received' else 'Draft' end,public.current_profile_id())
    on conflict(id) do update set supplier_id=excluded.supplier_id,reference=excluded.reference,received_date=excluded.received_date,status=excluded.status,actor_profile_id=excluded.actor_profile_id;
  -- Prevent a cost-blind editor from destroying protected draft costs.
  if exists(select 1 from public.stock_receipt_costs where receipt_id=receipt) then perform private.require_permission('costs.view_purchase_cost',p_store_id); end if;
  delete from public.stock_receipt_costs where receipt_id=receipt;
  delete from public.stock_receipt_lines where receipt_id=receipt;
  for line in select value from jsonb_array_elements(p_input->'lines') loop
    i:=i+1; pid:=(line->>'product_id')::uuid; loc:=(line->>'location_id')::uuid; qty:=(line->>'quantity')::integer;
    if qty<=0 or qty is null then raise exception 'Positive whole quantities required' using errcode='22023'; end if;
    if not exists(select 1 from public.products where id=pid and store_id=p_store_id and state='active' and category<>'Services') then
      raise exception 'Select an active stock product' using errcode='22023'; end if;
    perform private.require_box(p_store_id,loc);
    insert into public.stock_receipt_lines(receipt_id,store_id,line_no,product_id,location_id,quantity) values(receipt,p_store_id,i,pid,loc,qty);
    if line ? 'purchase_cost' then
      perform private.require_permission('costs.view_purchase_cost',p_store_id);
      insert into public.stock_receipt_costs(receipt_id,store_id,line_no,purchase_cost) values(receipt,p_store_id,i,(line->>'purchase_cost')::numeric);
      if p_receive then
        insert into public.product_financials(product_id,store_id,purchase_cost,updated_by) values(pid,p_store_id,(line->>'purchase_cost')::numeric,public.current_profile_id())
          on conflict(product_id) do update set purchase_cost=excluded.purchase_cost,updated_by=excluded.updated_by;
      end if;
    end if;
    if p_receive then
      insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id)
        values(p_store_id,pid,loc,qty,'RECEIVE','receipt',receipt,public.current_profile_id());
    end if;
  end loop;
  perform private.write_audit(p_store_id,public.current_profile_id(),case when p_receive then 'stock.received' else 'stock.draft_saved' end,'receipt',receipt,jsonb_build_object('lines',i));
end $$;
create function public.transfer_stock(p_store_id uuid,p_product_id uuid,p_source uuid,p_destination uuid,p_quantity integer,p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare available bigint;
begin
  perform private.require_permission('inventory.transfer',p_store_id); perform private.lock_store(p_store_id);
  if p_source=p_destination or p_quantity<=0 or p_quantity is null or p_request_id is null then raise exception 'Invalid transfer' using errcode='22023'; end if;
  if exists(select 1 from public.stock_movements where store_id=p_store_id and transfer_group_id=p_request_id) then raise exception 'Transfer already recorded' using errcode='23505'; end if;
  if not exists(select 1 from public.products where id=p_product_id and store_id=p_store_id and state='active') then raise exception 'Product unavailable' using errcode='22023'; end if;
  perform private.require_box(p_store_id,p_source); perform private.require_box(p_store_id,p_destination);
  select coalesce(sum(quantity),0) into available from public.stock_movements where store_id=p_store_id and product_id=p_product_id and location_id=p_source;
  if available<p_quantity then raise exception 'Insufficient stock' using errcode='P0001'; end if;
  insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,transfer_group_id,reference_type,reference_id,actor_profile_id)
    values(p_store_id,p_product_id,p_source,-p_quantity,'TRANSFER_OUT',p_request_id,'transfer',p_request_id,public.current_profile_id()),
    (p_store_id,p_product_id,p_destination,p_quantity,'TRANSFER_IN',p_request_id,'transfer',p_request_id,public.current_profile_id());
  perform private.write_audit(p_store_id,public.current_profile_id(),'stock.transferred','product',p_product_id,jsonb_build_object('source',p_source,'destination',p_destination,'quantity',p_quantity,'transfer_id',p_request_id));
end $$;
create function public.adjust_stock(p_store_id uuid,p_product_id uuid,p_location_id uuid,p_expected integer,p_new_quantity integer,p_reason text,p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare available bigint; delta integer;
begin
  perform private.require_permission('inventory.adjust',p_store_id); perform private.lock_store(p_store_id);
  if p_new_quantity<0 or p_new_quantity is null or p_reason not in ('Opening Stock','Physical Count','Damaged','Missing','Correction','Other') or p_reason is null or p_request_id is null then raise exception 'Invalid adjustment' using errcode='22023'; end if;
  if not exists(select 1 from public.products where id=p_product_id and store_id=p_store_id and state='active') then raise exception 'Product unavailable' using errcode='22023'; end if;
  perform private.require_box(p_store_id,p_location_id);
  select coalesce(sum(quantity),0) into available from public.stock_movements where store_id=p_store_id and product_id=p_product_id and location_id=p_location_id;
  if available is distinct from p_expected::bigint then raise exception 'Stock changed; reload before adjusting' using errcode='40001'; end if;
  delta:=p_new_quantity-available;
  if delta=0 then raise exception 'Quantity is unchanged' using errcode='22023'; end if;
  insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,idempotency_key,notes,actor_profile_id)
    values(p_store_id,p_product_id,p_location_id,delta,'ADJUSTMENT','adjustment',p_request_id,p_request_id::text,p_reason,public.current_profile_id());
  perform private.write_audit(p_store_id,public.current_profile_id(),'stock.adjusted','product',p_product_id,jsonb_build_object('location',p_location_id,'previous',available,'quantity',p_new_quantity,'reason',p_reason));
end $$;

-- Permission-aware team DTO, never PIN credentials or financial data.
create function public.get_employees(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_permission('employees.view',p_store_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'email',p.email,'phone',p.phone,'avatar_url',p.avatar_url,
    'role',p.role,'status',p.status,'updated_at',p.updated_at,'permissions',coalesce((select jsonb_agg(k.key order by k.key)
      from public.employee_permissions e join public.permissions k on k.id=e.permission_id where e.profile_id=p.id and e.store_id=p_store_id and e.enabled),'[]')) order by p.full_name),'[]')
    into result from public.profiles p join public.store_memberships m on m.profile_id=p.id where m.store_id=p_store_id;
  return result;
end $$;
create function public.save_employee(p_store_id uuid,p_input jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid:=(p_input->>'id')::uuid; old public.profiles; k text; enabled boolean; old_enabled boolean;
begin
  perform private.require_permission('employees.manage',p_store_id); perform private.lock_store(p_store_id);
  if exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then raise exception 'Individual management sign-in required' using errcode='42501'; end if;
  select * into old from public.profiles where id=target;
  if p_input->>'role'='owner' then raise exception 'Use trusted administration for owner provisioning' using errcode='42501'; end if;
  if old.id is null then perform public.provision_profile(target,p_input->>'full_name',p_input->>'role',p_store_id);
  else
    if not exists(select 1 from public.store_memberships where profile_id=target and store_id=p_store_id) then raise exception 'Access denied' using errcode='42501'; end if;
    if target=public.current_profile_id() or old.role='owner' then raise exception 'Use trusted administration for owner or own role changes' using errcode='42501'; end if;
    if not public.is_owner() and (old.role<>'employee' or p_input->>'role'<>'employee') then raise exception 'Owner administration required' using errcode='42501'; end if;
  end if;
  update public.profiles set full_name=trim(p_input->>'full_name'),phone=p_input->>'phone',role=p_input->>'role',status=p_input->>'status' where id=target;
  for k in select key from public.permissions loop
    enabled := coalesce(p_input->'permissions','[]') ? k;
    select coalesce(bool_or(e.enabled),false) into old_enabled from public.employee_permissions e join public.permissions p on p.id=e.permission_id where e.profile_id=target and e.store_id=p_store_id and p.key=k;
    if enabled<>old_enabled then perform public.set_employee_permission(target,p_store_id,k,enabled); end if;
  end loop;
  perform private.write_audit(p_store_id,public.current_profile_id(),'employee.updated','profile',target,jsonb_build_object('role',p_input->>'role','status',p_input->>'status'));
end $$;

-- Same explicit nonfinancial POS contract, now including a storage path for images.
create function public.set_employee_permissions(p_store_id uuid,p_profile_id uuid,p_permissions text[]) returns void
language plpgsql security definer set search_path='' as $$
declare k text; enabled boolean; old_enabled boolean;
begin
  perform private.require_permission('employees.permissions',p_store_id); perform private.lock_store(p_store_id);
  if exists(select 1 from unnest(p_permissions) v where not exists(select 1 from public.permissions where key=v)) then raise exception 'Unknown permission' using errcode='22023'; end if;
  for k in select key from public.permissions loop
    enabled:=k=any(p_permissions);
    select coalesce(bool_or(e.enabled),false) into old_enabled from public.employee_permissions e join public.permissions p on p.id=e.permission_id
      where e.profile_id=p_profile_id and e.store_id=p_store_id and p.key=k;
    if enabled<>old_enabled then perform public.set_employee_permission(p_profile_id,p_store_id,k,enabled); end if;
  end loop;
end $$;
grant execute on function public.set_employee_permissions(uuid,uuid,text[]) to authenticated;
revoke all on function public.set_employee_permissions(uuid,uuid,text[]) from public,anon;
create or replace function public.get_pos_products(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not (public.has_permission('sales.create',p_store_id) or public.has_permission('inventory.view',p_store_id) or
    public.has_permission('inventory.receive',p_store_id) or public.has_permission('inventory.transfer',p_store_id) or public.has_permission('inventory.adjust',p_store_id) or
    public.has_permission('products.create',p_store_id) or public.has_permission('products.edit',p_store_id)) then raise exception 'Access denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'internal_code',p.internal_code,'name',p.name,'category',p.category,'brand',p.brand,
    'compatible_model',p.compatible_model,'quality_grade',p.quality_grade,'color_variant',p.color_variant,'selling_price',p.selling_price,
    'minimum_selling_price',p.minimum_selling_price,'aliases',p.aliases,'low_stock_level',p.low_stock_level,'primary_image_url',p.primary_image_url,
    'quantity',coalesce(b.qty,0),'location',case when l.id is null then null else jsonb_build_object('rack',r.name,'shelf',s.name,'box',l.name) end)
    order by p.internal_code),'[]') into result from public.products p
    left join lateral(select sum(quantity)::bigint qty from public.stock_movements where product_id=p.id and store_id=p_store_id) b on true
    left join lateral(select location_id from public.stock_movements where product_id=p.id and store_id=p_store_id group by location_id having sum(quantity)>0 order by sum(quantity) desc,location_id limit 1) primary_location on true
    left join public.locations l on l.id=coalesce(primary_location.location_id,p.default_location_id)
    left join public.locations s on s.id=l.parent_location_id left join public.locations r on r.id=s.parent_location_id
    where p.store_id=p_store_id and p.state='active';
  return result;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function public.save_product(uuid,jsonb),public.duplicate_product(uuid,uuid),public.archive_product(uuid,uuid),
  public.save_location(uuid,jsonb),public.archive_location(uuid,uuid),public.save_supplier(uuid,jsonb),public.save_stock_receipt(uuid,jsonb,boolean),
  public.transfer_stock(uuid,uuid,uuid,uuid,integer,uuid),public.adjust_stock(uuid,uuid,uuid,integer,integer,text,uuid),public.get_employees(uuid),public.save_employee(uuid,jsonb) to authenticated;
-- Public/anon never execute business RPCs; default privilege rules from 004 also apply.
revoke all on function public.save_product(uuid,jsonb),public.duplicate_product(uuid,uuid),public.archive_product(uuid,uuid),
  public.save_location(uuid,jsonb),public.archive_location(uuid,uuid),public.save_supplier(uuid,jsonb),public.save_stock_receipt(uuid,jsonb,boolean),
  public.transfer_stock(uuid,uuid,uuid,uuid,integer,uuid),public.adjust_stock(uuid,uuid,uuid,integer,integer,text,uuid),public.get_employees(uuid),public.save_employee(uuid,jsonb) from public,anon;
commit;
