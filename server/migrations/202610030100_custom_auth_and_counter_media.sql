begin;
create schema app_private;
revoke all on schema app_private from public,anon,authenticated;
create table app_private.accounts(
 user_id uuid primary key references auth.users(id), email text not null unique check(email=lower(email)),
 password_hash text not null check(password_hash like '$argon2id$%'),enabled boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table app_private.sessions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references app_private.accounts(user_id),
 device_name text not null,ip_hash text not null,created_at timestamptz not null default now(),last_active_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 days',revoked_at timestamptz
);
create index sessions_user on app_private.sessions(user_id,expires_at) where revoked_at is null;
create table app_private.refresh_tokens(token_hash text primary key,session_id uuid not null references app_private.sessions(id),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 days',used_at timestamptz);
create index refresh_session on app_private.refresh_tokens(session_id);
create table app_private.login_attempts(key text primary key,failures integer not null default 0,window_started timestamptz not null default now());
insert into public.permissions(key,description) values
 ('customers.view','View customer profiles'),('customers.create','Create customer profiles'),('customers.edit','Edit customer profiles'),('customers.credit','Configure customer credit'),
 ('services.create_custom','Create custom service sale lines'),('services.save_catalog','Save custom services to catalog'),
 ('media.upload','Upload private media'),('media.delete','Delete unreferenced media'),('devices.pair','Pair staff camera devices'),('camera.request','Request staff camera capture'),('appearance.customize','Customize appearance') on conflict(key) do nothing;
create table app_private.device_pairings(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),terminal_id text not null check(length(terminal_id) between 1 and 100),
 requester_id uuid not null references public.profiles(id),code_hash text not null unique,expires_at timestamptz not null default now()+interval '10 minutes',
 device_session_id uuid references app_private.sessions(id),device_profile_id uuid references public.profiles(id),device_name text,
 paired_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now()
);
create index pairing_terminal on app_private.device_pairings(store_id,terminal_id) where revoked_at is null;
create table app_private.camera_jobs(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),terminal_id text not null,
 requester_id uuid not null references public.profiles(id),requester_session_id uuid not null references app_private.sessions(id),
 device_session_id uuid not null references app_private.sessions(id),device_profile_id uuid not null references public.profiles(id),
 type text not null check(type in ('payment-proof','product','device','repair','customer','profile','damage','document')),
 label text not null check(length(label) between 1 and 120),amount numeric(14,2),reference text,entity_id text,
 status text not null default 'waiting' check(status in ('waiting','opened','captured','uploading','received','failed','cancelled')),
 media_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '20 minutes'
);
create index camera_device_queue on app_private.camera_jobs(device_session_id,created_at);
create index camera_requester_queue on app_private.camera_jobs(requester_session_id,terminal_id,created_at);
create table app_private.media(
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),profile_id uuid not null references public.profiles(id),
 kind text not null,entity_id text,camera_job_id uuid references app_private.camera_jobs(id),path text not null unique,mime_type text not null,
 size integer not null,width integer,height integer,sort_order integer not null default 0,is_primary boolean not null default false,
 created_at timestamptz not null default now(),deleted_at timestamptz
);
alter table app_private.camera_jobs add foreign key(media_id) references app_private.media(id);
create index media_entity on app_private.media(store_id,kind,entity_id) where deleted_at is null;
create table app_private.push_subscriptions(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references app_private.sessions(id),profile_id uuid not null references public.profiles(id),
 endpoint text not null unique,subscription jsonb not null,created_at timestamptz not null default now()
);
-- Public roles receive no grants on any of these tables; only the dedicated runtime login can access them.
revoke all on all tables in schema app_private from public,anon,authenticated;

create or replace function public.save_customer(p_store_id uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid()); existing public.customers; account public.credit_accounts; can_credit boolean;
begin
 perform private.lock_store(p_store_id);
 select * into existing from public.customers where id=v_id;
 if existing.id is not null and existing.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501'; end if;
 perform private.require_permission(case when existing.id is null then 'customers.create' else 'customers.edit' end,p_store_id);
 can_credit:=public.has_permission('customers.credit',p_store_id) or public.has_permission('credit.create',p_store_id);
 select * into account from public.credit_accounts where customer_id=v_id;
 if not can_credit and ((coalesce((p_input->>'creditEnabled')::boolean,false) is distinct from coalesce(account.enabled,false))
   or (p_input->>'creditLimit' is not null and nullif(p_input->>'creditLimit','')::numeric is distinct from account.credit_limit)) then
   raise exception 'Credit configuration permission required' using errcode='42501'; end if;
 if coalesce(p_input->>'photo','')<>'' and not private.valid_asset(p_store_id,p_input->>'photo','customers') then raise exception 'Invalid customer image' using errcode='22023'; end if;
 insert into public.customers(id,store_id,name,type,shop_name,owner_name,collecting_person,phone,address,notes,photo_path)
 values(v_id,p_store_id,p_input->>'name',p_input->>'type',coalesce(p_input->>'shopName',''),coalesce(p_input->>'ownerName',''),coalesce(p_input->>'collectingPerson',''),coalesce(p_input->>'phone',''),coalesce(p_input->>'address',''),coalesce(p_input->>'notes',''),coalesce(p_input->>'photo',''))
 on conflict(id) do update set name=excluded.name,type=excluded.type,shop_name=excluded.shop_name,owner_name=excluded.owner_name,collecting_person=excluded.collecting_person,phone=excluded.phone,address=excluded.address,notes=excluded.notes,photo_path=excluded.photo_path,updated_at=now();
 if can_credit then
  insert into public.credit_accounts(customer_id,store_id,credit_limit,enabled,enforce_limit)
  values(v_id,p_store_id,nullif(p_input->>'creditLimit','')::numeric,coalesce((p_input->>'creditEnabled')::boolean,false),coalesce((p_input->>'enforceCreditLimit')::boolean,true))
  on conflict(customer_id) do update set credit_limit=excluded.credit_limit,enabled=excluded.enabled,enforce_limit=excluded.enforce_limit;
 elsif account.customer_id is null then insert into public.credit_accounts(customer_id,store_id,enabled) values(v_id,p_store_id,false);end if;
 perform private.write_audit(p_store_id,public.current_profile_id(),'customer.saved','customer',v_id);return v_id;
end $$;
-- Extend safe customer reads, preserving the financial and stock permissions in all other branches.
do $$ declare source text; begin
 source:=pg_get_functiondef('public.transaction_data(uuid,text,jsonb)'::regprocedure);
 source:=replace(source,'public.has_permission(''sales.create'',p_store_id) or public.has_permission(''credit.create'',p_store_id)',
   'public.has_permission(''customers.view'',p_store_id) or public.has_permission(''sales.create'',p_store_id) or public.has_permission(''credit.create'',p_store_id)');execute source;
end $$;
commit;
