begin;
-- Durable, private upload authorization. Bytes never enter this table; no
-- browser credential or public object URL is persisted. Existing migrations
-- remain immutable; provision runtime grants explicitly after applying this.
create table app_private.media_upload_grants (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id),
 profile_id uuid not null references public.profiles(id),
 request_id uuid not null,
 input_hash text not null check(length(input_hash)=64),
 object_key text not null unique check(object_key like 'staging/%'),
 params jsonb not null,
 expected_size integer not null check(expected_size between 1 and 16777216),
 expected_sha256 text not null check(expected_sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check(status in ('pending','completed','cancelled')),
 media_id uuid references app_private.media(id),
 result jsonb,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(store_id,profile_id,request_id),
 check((status='completed')=(media_id is not null and result is not null))
);
create index media_upload_grants_pending on app_private.media_upload_grants(store_id,profile_id,expires_at) where status='pending';
revoke all on app_private.media_upload_grants from public,anon,authenticated;
commit;
