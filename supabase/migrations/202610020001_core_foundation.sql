-- Application data is provisioned by trusted administration, never Auth metadata.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create sequence private.product_code_seq;
create sequence private.location_code_seq;
create function private.next_code(p_sequence regclass, p_prefix text) returns text
language plpgsql set search_path = '' as $$
declare n text;
begin
  n := pg_catalog.nextval(p_sequence)::text;
  return p_prefix || case when length(n) < 6 then lpad(n, 6, '0') else n end;
end $$;

create table public.stores (
  id uuid primary key default gen_random_uuid(), name text not null,
  branch_name text not null, status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.stores(id, name, branch_name)
values ('10000000-0000-4000-8000-000000000001', 'Taha Mobiles', 'Main Branch');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  email text not null, phone text, avatar_url text,
  role text not null default 'employee' check (role in ('owner','manager','employee')),
  status text not null default 'inactive' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.store_memberships (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  active boolean not null default true, created_at timestamptz not null default now(),
  primary key (profile_id, store_id)
);
create table public.permissions (
  id bigint generated always as identity primary key,
  key text not null unique, description text not null
);
create table public.employee_permissions (
  profile_id uuid not null references public.profiles(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  permission_id bigint not null references public.permissions(id) on delete restrict,
  enabled boolean not null default false, updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(), primary key (profile_id, store_id, permission_id),
  foreign key (profile_id,store_id) references public.store_memberships(profile_id,store_id) on delete restrict
);
insert into public.permissions(key, description) values
('sales.create','Create sales'), ('sales.view','View sales'), ('sales.void','Void sales'),
('pricing.discount_within_range','Negotiate within permitted price range'), ('pricing.override_minimum','Approve prices below minimum'),
('credit.create','Create credit'), ('credit.receive_payment','Receive credit payments'), ('credit.override_limit','Override credit limits'),
('payments.approve_electronic','Approve electronic payments'), ('payments.reverse','Reverse payments'),
('inventory.view','View inventory'), ('inventory.receive','Receive stock'), ('inventory.adjust','Adjust stock'), ('inventory.transfer','Transfer stock'),
('products.create','Create products'), ('products.edit','Edit products'), ('products.archive','Archive products'),
('costs.view_purchase_cost','Read purchase costs'), ('profit.view','Read profit'),
('returns.create','Create returns'), ('returns.approve','Approve returns'), ('devices.buy_used','Purchase used devices'),
('reports.view','View reports'), ('reports.export','Export reports'), ('shifts.manage','Manage shifts'),
('employees.view','View employees'), ('employees.manage','Manage employees'), ('employees.permissions','Configure employee permissions'),
('website.enquiries','Review website enquiries'), ('settings.manage','Manage workspace settings'), ('audit.view','View audit records');

create table public.products (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  internal_code text not null unique, name text not null check (length(trim(name)) > 0),
  category text not null check (category in ('Parts','Accessories','Phones','Services')),
  brand text not null default '', compatible_model text not null default '', quality_grade text not null default '', color_variant text not null default '',
  selling_price numeric(14,2) not null check (selling_price >= 0),
  minimum_selling_price numeric(14,2) not null check (minimum_selling_price >= 0 and minimum_selling_price <= selling_price),
  aliases text[] not null default '{}', notes text not null default '', low_stock_level integer not null default 5 check (low_stock_level >= 0),
  primary_image_url text, state text not null default 'active' check (state in ('active','archived')),
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, store_id)
);
-- Sensitive fields are physically separate, not hidden columns in an employee query.
create table public.product_financials (
  product_id uuid primary key, store_id uuid not null,
  purchase_cost numeric(14,2) not null check (purchase_cost >= 0),
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now(),
  foreign key (product_id, store_id) references public.products(id, store_id) on delete restrict
);
create table public.locations (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  internal_code text not null unique, name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('rack','shelf','box')), parent_location_id uuid,
  active boolean not null default true, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, store_id), check (parent_location_id is distinct from id),
  foreign key (parent_location_id, store_id) references public.locations(id, store_id) on delete restrict
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  product_id uuid not null, location_id uuid not null, quantity integer not null check (quantity <> 0),
  movement_type text not null check (movement_type in ('RECEIVE','SALE','RETURN','TRANSFER_IN','TRANSFER_OUT','REPAIR_USE','OUT_FOR_TEST','TEST_RETURN','ADJUSTMENT','DAMAGED','USED_DEVICE_PURCHASE')),
  reference_type text, reference_id uuid, actor_profile_id uuid not null references public.profiles(id),
  transfer_group_id uuid, idempotency_key text, notes text not null default '', created_at timestamptz not null default now(),
  foreign key (product_id, store_id) references public.products(id, store_id),
  foreign key (location_id, store_id) references public.locations(id, store_id),
  check ((reference_type is null) = (reference_id is null)),
  check (movement_type = 'ADJUSTMENT' or
    (movement_type in ('RECEIVE','RETURN','TRANSFER_IN','TEST_RETURN','USED_DEVICE_PURCHASE') and quantity > 0) or
    (movement_type in ('SALE','TRANSFER_OUT','REPAIR_USE','OUT_FOR_TEST','DAMAGED') and quantity < 0)),
  unique (store_id, idempotency_key)
);
create table public.shifts (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), employee_id uuid not null,
  scheduled_start timestamptz, scheduled_end timestamptz, actual_start timestamptz, actual_end timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','open','closed','cancelled')),
  opening_cash numeric(14,2) check (opening_cash >= 0), expected_cash numeric(14,2), counted_cash numeric(14,2) check (counted_cash >= 0),
  cash_difference numeric(14,2) generated always as (counted_cash - expected_cash) stored,
  closing_notes text, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (employee_id, store_id) references public.store_memberships(profile_id, store_id),
  check (scheduled_end is null or scheduled_start is not null and scheduled_end > scheduled_start),
  check (actual_end is null or actual_start is not null and actual_end >= actual_start)
);
create unique index one_open_shift on public.shifts(employee_id, store_id) where status = 'open';
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), store_id uuid references public.stores(id), actor_profile_id uuid references public.profiles(id),
  action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create table public.counter_terminals (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id),
  store_id uuid not null references public.stores(id), name text not null, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table private.employee_pin_credentials (
  profile_id uuid primary key references public.profiles(id), pin_hash text not null,
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table private.counter_sessions (
  id uuid primary key default gen_random_uuid(), terminal_id uuid not null references public.counter_terminals(id),
  employee_id uuid not null references public.profiles(id), token_hash bytea not null unique,
  created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz
);
create table private.counter_pin_attempts (
  terminal_id uuid primary key references public.counter_terminals(id), failures integer not null default 0,
  window_start timestamptz not null default now(), locked_until timestamptz
);

create index memberships_store on public.store_memberships(store_id, profile_id) where active;
create index products_store_state on public.products(store_id, state);
create index products_search on public.products using gin (to_tsvector('simple', name || ' ' || compatible_model || ' ' || brand));
create index products_aliases on public.products using gin (aliases);
create index locations_parent on public.locations(store_id, parent_location_id);
create index movements_balance on public.stock_movements(store_id, product_id, location_id);
create index movements_reference on public.stock_movements(reference_type, reference_id);
create index movements_time on public.stock_movements(store_id, created_at desc);
create index shifts_employee_time on public.shifts(employee_id, actual_start desc);
create index audit_store_time on public.audit_logs(store_id, created_at desc);
create index audit_actor on public.audit_logs(actor_profile_id, created_at desc);
create index counter_active on private.counter_sessions(terminal_id, expires_at) where revoked_at is null;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['stores','profiles','employee_permissions','products','product_financials','locations','shifts'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
  end loop;
end $$;
create function private.assign_permanent_code() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.id <> old.id or new.store_id <> old.store_id or new.internal_code <> old.internal_code then
      raise exception 'Product/location identity, store, and permanent code cannot change';
    end if;
  elsif TG_TABLE_NAME = 'products' then new.internal_code := private.next_code('private.product_code_seq'::regclass, 'TM-P-');
  else new.internal_code := private.next_code('private.location_code_seq'::regclass, 'TM-L-'); end if;
  return new;
end $$;
create trigger product_identity before insert or update on public.products for each row execute function private.assign_permanent_code();
create trigger location_identity before insert or update on public.locations for each row execute function private.assign_permanent_code();
create function private.validate_location_hierarchy() returns trigger language plpgsql set search_path = '' as $$
declare parent_kind text;
begin
  if TG_OP = 'UPDATE' and new.kind <> old.kind then raise exception 'Location kind is permanent'; end if;
  if new.kind = 'rack' then
    if new.parent_location_id is not null then raise exception 'A rack cannot have a parent'; end if;
  else
    select kind into parent_kind from public.locations where id = new.parent_location_id and store_id = new.store_id;
    if parent_kind is null or (new.kind = 'shelf' and parent_kind <> 'rack') or (new.kind = 'box' and parent_kind <> 'shelf') then
      raise exception 'Locations must follow Rack -> Shelf -> Box in the same store';
    end if;
  end if;
  return new;
end $$;
create trigger location_hierarchy before insert or update on public.locations for each row execute function private.validate_location_hierarchy();
create function private.append_only() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'This ledger is append-only'; end $$;
create trigger immutable_stock before update or delete on public.stock_movements for each row execute function private.append_only();
create trigger immutable_audit before update or delete on public.audit_logs for each row execute function private.append_only();
commit;
