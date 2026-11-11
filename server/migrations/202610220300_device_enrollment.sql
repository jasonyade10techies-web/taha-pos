begin;
-- Existing account attribution is retained; companion sessions have a mandatory,
-- separately checked camera scope and are never general owner bearer sessions.
create table app_private.device_enrollments(
 id uuid primary key default gen_random_uuid(),challenge_hash text not null,
 store_id uuid not null references public.stores(id),terminal_id text not null,
 requester_id uuid not null references public.profiles(id),requester_session_id uuid not null references app_private.sessions(id),
 expires_at timestamptz not null default now()+interval '2 minutes',
 device_id uuid,device_name text,public_key text,key_fingerprint text,
 requested_at timestamptz,approved_at timestamptz,approved_by uuid references public.profiles(id),consumed_at timestamptz,
 foreign key(store_id,terminal_id) references app_private.terminals(store_id,id)
);
create index device_enrollment_counter on app_private.device_enrollments(requester_session_id,expires_at);
create table app_private.companion_sessions(
 session_id uuid primary key references app_private.sessions(id),
 enrollment_id uuid not null unique references app_private.device_enrollments(id),
 store_id uuid not null references public.stores(id),terminal_id text not null,
 device_id uuid not null,public_key text not null,
 approving_session_id uuid not null references app_private.sessions(id),approved_by uuid not null references public.profiles(id),
 scope text not null default 'camera' check(scope='camera'),
 foreign key(store_id,terminal_id) references app_private.terminals(store_id,id)
);
revoke all on app_private.device_enrollments,app_private.companion_sessions from public,anon,authenticated;
do $$ declare definition text; begin
 definition:=pg_get_functiondef('app_private.auth_audit(uuid,text,uuid)'::regprocedure);
 definition:=replace(definition,'''auth.refresh_replayed'')','''auth.refresh_replayed'',''auth.companion_approved'',''auth.companion_enrolled'')');
 execute definition;
end $$;
commit;
