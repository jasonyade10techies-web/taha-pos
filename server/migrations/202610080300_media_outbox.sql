begin;
-- Upload IDs make lost-response retries safe. No file bytes or secrets in PostgreSQL.
create table app_private.media_uploads (
 store_id uuid not null references public.stores(id),
 profile_id uuid not null references public.profiles(id),
 request_id uuid not null,
 input_hash text not null check(length(input_hash)=64),
 media_id uuid not null references app_private.media(id),
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(store_id,profile_id,request_id)
);
revoke all on app_private.media_uploads from public,anon,authenticated;
commit;
