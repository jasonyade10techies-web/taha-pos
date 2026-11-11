begin;
-- A mobile writer cannot know about unsent Windows SQLite transactions. Persist
-- grants before issuing them, and conservatively prohibit mobile completion until
-- every outstanding offline promise expires or is explicitly reconciled.
create table app_private.offline_counter_leases(
 store_id uuid not null references public.stores(id),terminal_id uuid not null,profile_id uuid not null references public.profiles(id),expires_at timestamptz not null,updated_at timestamptz not null default now(),primary key(store_id,terminal_id)
);
alter table app_private.offline_counter_leases enable row level security;
revoke all on app_private.offline_counter_leases from public,anon,authenticated;
create function app_private.register_offline_lease(p_store uuid,p_terminal uuid,p_profile uuid,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.lock_store(p_store);
 if p_expires<=now() or p_expires>now()+interval '8 hours 1 minute' then raise exception 'Invalid offline authorization duration' using errcode='22023';end if;
 insert into app_private.offline_counter_leases(store_id,terminal_id,profile_id,expires_at) values(p_store,p_terminal,p_profile,p_expires)
 on conflict(store_id,terminal_id) do update set profile_id=excluded.profile_id,expires_at=greatest(offline_counter_leases.expires_at,excluded.expires_at),updated_at=now();
end $$;
revoke all on function app_private.register_offline_lease(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
alter function public.complete_sale(uuid,jsonb) rename to complete_sale_before_5d1;
revoke all on function public.complete_sale_before_5d1(uuid,jsonb) from public,anon,authenticated;
create function public.complete_sale(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;
begin
 perform private.require_permission('sales.create',p_store_id);perform private.lock_store(p_store_id);
 if p_input->>'clientChannel'='mobile' then
  if nullif(p_input->>'deviceId','') is null then raise exception 'Reconnect this phone before completing a sale' using errcode='22023';end if;
  perform (p_input->>'deviceId')::uuid;
  -- Replay accepted requests before applying a newly arisen offline restriction.
  select result into cached from private.transaction_requests where store_id=p_store_id and actor_id=public.current_profile_id() and operation='sale' and request_id=(p_input->>'idempotencyKey')::uuid;
  if cached is null and (exists(select 1 from app_private.offline_counter_leases where store_id=p_store_id and expires_at>now())
   or exists(select 1 from app_private.cash_capture_state where store_id=p_store_id and state not in ('POSTED','REFUNDED'))) then
   raise exception 'Mobile checkout is paused while the counter has offline sales authorization or unresolved cash. Synchronize and reconcile the counter; its offline authorization must expire before mobile checkout resumes.' using errcode='55000';
  end if;
  if cached is null and not coalesce((private.shop_configuration(p_store_id)->'enabledFeatures'->>'mobileSales')::boolean,true) then raise exception 'Mobile sales are disabled in Shop Setup' using errcode='42501';end if;
 end if;
 return public.complete_sale_before_5d1(p_store_id,p_input);
end $$;
revoke all on function public.complete_sale(uuid,jsonb) from public,anon;
grant execute on function public.complete_sale(uuid,jsonb) to authenticated;
commit;
