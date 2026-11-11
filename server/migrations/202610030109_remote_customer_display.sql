begin;
-- Public screens possess only a hashed, revocable display capability. No business-table grants.
create table app_private.display_sessions(
 id uuid primary key default gen_random_uuid(),token_hash text not null unique,code_hash text not null unique,
 ip_hash text not null,device_name text not null check(length(device_name) between 1 and 120),
 code_expires_at timestamptz not null default now()+interval '10 minutes',
 expires_at timestamptz not null default now()+interval '24 hours',
 store_id uuid references public.stores(id),terminal_id text,
 requester_id uuid references public.profiles(id),requester_session_id uuid references app_private.sessions(id),
 paired_at timestamptz,revoked_at timestamptz,snapshot jsonb,snapshot_updated_at timestamptz,
 last_seen_at timestamptz,created_at timestamptz not null default now(),
 check((paired_at is null and store_id is null and terminal_id is null and requester_id is null and requester_session_id is null)
 or (paired_at is not null and store_id is not null and terminal_id is not null and requester_id is not null and requester_session_id is not null)),
 check(snapshot is null or octet_length(snapshot::text)<=300000)
);
create index display_counter on app_private.display_sessions(store_id,terminal_id) where revoked_at is null;
create index display_rate on app_private.display_sessions(ip_hash,created_at);
revoke all on app_private.display_sessions from public,anon,authenticated;
commit;
