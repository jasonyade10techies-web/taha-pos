-- Trusted deployment tooling only. No application visitor receives reset/seed access.
create table app_private.staging_datasets(
 id boolean primary key default true check(id),
 dataset_id uuid not null unique,
 store_id uuid not null references public.stores(id),
 manifest jsonb not null,
 created_at timestamptz not null default now()
);
revoke all on app_private.staging_datasets from public,anon,authenticated;
