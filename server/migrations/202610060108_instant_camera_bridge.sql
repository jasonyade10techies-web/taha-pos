begin;
alter table app_private.camera_jobs alter column device_session_id drop not null;
alter table app_private.camera_jobs alter column device_profile_id drop not null;
alter table app_private.camera_jobs alter column expires_at set default now()+interval '10 minutes';
alter table app_private.camera_jobs add column max_captures integer not null default 1 check(max_captures between 1 and 8),
 add column target_slot text not null default 'image',add column claim_hash text,
 add column diagnostic boolean not null default false;
create table app_private.camera_captures(
 id uuid primary key,job_id uuid not null references app_private.camera_jobs(id),
 media_id uuid not null unique references app_private.media(id),uploaded_by uuid not null references public.profiles(id),
 input_hash text not null,created_at timestamptz not null default now()
);
create index camera_capture_job on app_private.camera_captures(job_id,created_at);
revoke all on app_private.camera_captures from public,anon,authenticated;
-- API-only tables have no public role grants. The dedicated server runtime enforces
-- active staff/session, store, exact request/device and immutable target before access.
commit;
