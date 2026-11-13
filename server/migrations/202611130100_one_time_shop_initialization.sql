begin;
-- A trusted administration command creates the first owner. There is no public
-- owner-registration endpoint and the web runtime cannot reopen this marker.
create table app_private.shop_initialization(
 store_id uuid primary key references public.stores(id),
 owner_id uuid not null references public.profiles(id),
 initialized_at timestamptz not null default now()
);
create trigger immutable before update or delete on app_private.shop_initialization
 for each row execute function private.append_only();
revoke all on app_private.shop_initialization from public,anon,authenticated;
commit;
