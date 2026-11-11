begin;
-- Durable identities are private API records, never browser-readable auth tables.
create table app_private.terminals(
 store_id uuid not null references public.stores(id),id text not null check(length(id) between 1 and 100),
 owner_profile_id uuid not null references public.profiles(id),name text not null default 'Main Counter' check(length(name) between 1 and 120),
 current_session_id uuid references app_private.sessions(id),last_seen_at timestamptz not null default now(),created_at timestamptz not null default now(),
 primary key(store_id,id)
);
create table app_private.staff_devices(
 id uuid primary key,store_id uuid not null references public.stores(id),owner_profile_id uuid not null references public.profiles(id),
 current_session_id uuid not null references app_private.sessions(id),name text not null check(length(name) between 1 and 120),
 platform text not null check(length(platform) between 1 and 40),last_seen_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create index staff_devices_session on app_private.staff_devices(current_session_id);
insert into app_private.terminals(store_id,id,owner_profile_id)
 select distinct on(store_id,terminal_id) store_id,terminal_id,requester_id from app_private.device_pairings order by store_id,terminal_id,created_at
 on conflict do nothing;
insert into app_private.terminals(store_id,id,owner_profile_id,current_session_id)
 select distinct on(store_id,terminal_id) store_id,terminal_id,requester_id,requester_session_id from app_private.camera_jobs order by store_id,terminal_id,created_at
 on conflict do nothing;
alter table app_private.device_pairings add column device_id uuid references app_private.staff_devices(id);
create unique index pairing_persistent_device on app_private.device_pairings(device_id) where device_id is not null and revoked_at is null and paired_at is not null;
alter table app_private.camera_jobs add column device_id uuid references app_private.staff_devices(id);
create index camera_persistent_device on app_private.camera_jobs(device_id,created_at);
alter table app_private.camera_jobs drop constraint camera_jobs_type_check;
alter table app_private.camera_jobs add constraint camera_jobs_type_check check(type in ('payment-proof','product','device','repair','customer','profile','damage','document','connection-test'));
revoke all on app_private.terminals,app_private.staff_devices from public,anon,authenticated;
commit;
