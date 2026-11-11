begin;
create function public.current_profile_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); terminal public.counter_terminals; token text; result uuid;
begin
  if uid is null then return null; end if;
  select * into terminal from public.counter_terminals where auth_user_id = uid;
  if found then
    if not terminal.active then return null; end if;
    token := (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb)->>'x-counter-session';
    if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
    select cs.employee_id into result from private.counter_sessions cs
    join public.profiles p on p.id = cs.employee_id and p.status = 'active'
    join public.store_memberships sm on sm.profile_id = p.id and sm.store_id = terminal.store_id and sm.active
    join public.stores st on st.id = terminal.store_id and st.status = 'active'
    where cs.terminal_id = terminal.id and cs.token_hash = extensions.digest(token, 'sha256')
      and cs.revoked_at is null and cs.expires_at > now();
    return result;
  end if;
  select id into result from public.profiles where id = uid and status = 'active';
  return result;
end $$;
create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = public.current_profile_id() and role = 'owner' and status = 'active')
$$;
create function public.can_access_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.stores s where s.id = p_store_id and s.status = 'active' and (
    public.is_owner() or exists(select 1 from public.store_memberships m where m.store_id = s.id and m.profile_id = public.current_profile_id() and m.active)))
$$;
create function public.has_permission(p_key text, p_store_id uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_profile_id() is not null
    and exists(select 1 from public.permissions where key = p_key)
    and (p_store_id is null or public.can_access_store(p_store_id))
    and (public.is_owner() or exists(select 1 from public.employee_permissions ep join public.permissions p on p.id = ep.permission_id
      where ep.profile_id = public.current_profile_id() and p.key = p_key and ep.enabled
        and (p_store_id is null or ep.store_id = p_store_id) and public.can_access_store(ep.store_id)))
$$;

-- Explicitly revoke Supabase's broad default table/function grants first.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['stores','profiles','store_memberships','permissions','employee_permissions','products','product_financials','locations','stock_movements','shifts','audit_logs','counter_terminals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
  foreach t in array array['employee_pin_credentials','counter_sessions','counter_pin_attempts'] loop
    execute format('alter table private.%I enable row level security', t);
  end loop;
end $$;
grant execute on function public.current_profile_id(), public.is_owner(), public.can_access_store(uuid), public.has_permission(text,uuid) to authenticated;
revoke execute on function public.current_profile_id(), public.is_owner(), public.can_access_store(uuid), public.has_permission(text,uuid) from public, anon;

create policy stores_read on public.stores for select to authenticated using (public.can_access_store(id));
create policy profiles_read on public.profiles for select to authenticated using (
  id = public.current_profile_id() or public.is_owner() or exists(
    select 1 from public.store_memberships m where m.profile_id = profiles.id and m.active and public.has_permission('employees.view', m.store_id))
);
create policy memberships_read on public.store_memberships for select to authenticated using (
  profile_id = public.current_profile_id() or public.is_owner() or public.has_permission('employees.view', store_id)
);
create policy permissions_read on public.permissions for select to authenticated using (public.current_profile_id() is not null);
create policy grants_read on public.employee_permissions for select to authenticated using (
  profile_id = public.current_profile_id() or public.is_owner()
);
create policy products_read on public.products for select to authenticated using (
  public.has_permission('inventory.view',store_id) or public.has_permission('sales.create',store_id)
);
-- No product/cost/location mutations exposed yet: their atomic workflows arrive in Phase 3.
create policy costs_read on public.product_financials for select to authenticated using (
  public.has_permission('costs.view_purchase_cost',store_id)
);
create policy locations_read on public.locations for select to authenticated using (
  public.has_permission('inventory.view',store_id) or public.has_permission('sales.create',store_id)
);
create policy movements_read on public.stock_movements for select to authenticated using (
  public.has_permission('inventory.view',store_id)
);
create policy shifts_read on public.shifts for select to authenticated using (
  public.can_access_store(store_id) and (employee_id = public.current_profile_id() or public.has_permission('shifts.manage',store_id))
);
create policy audit_read on public.audit_logs for select to authenticated using (
  public.is_owner() or public.has_permission('audit.view',store_id) and store_id is not null
);
create policy terminals_read on public.counter_terminals for select to authenticated using (
  public.has_permission('employees.manage',store_id)
);

-- Invoker view respects the movement table RLS and contains no financial columns.
create view public.stock_balances with (security_invoker = true) as
  select store_id, product_id, location_id, sum(quantity)::bigint as quantity
  from public.stock_movements group by store_id, product_id, location_id;
grant select on public.stock_balances to authenticated;
revoke all on public.stock_balances from anon;

create function public.get_session_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare pid uuid := public.current_profile_id(); profile_json jsonb; grants jsonb; store_json jsonb; terminal public.counter_terminals; expiry timestamptz;
begin
  select * into terminal from public.counter_terminals where auth_user_id = auth.uid();
  if pid is not null then
    select jsonb_build_object('id',id,'full_name',full_name,'email',email,'phone',phone,'avatar_url',avatar_url,'role',role,'status',status)
    into profile_json from public.profiles where id = pid;
    select jsonb_build_object('id',s.id,'name',s.name,'branch_name',s.branch_name) into store_json from public.stores s
      where s.status = 'active' and public.can_access_store(s.id) and (terminal.id is null or s.id = terminal.store_id)
      order by s.created_at, s.id limit 1;
    select coalesce(jsonb_agg(key order by key),'[]') into grants from public.permissions where public.has_permission(key,(store_json->>'id')::uuid);
    if terminal.id is not null then
      select expires_at into expiry from private.counter_sessions where terminal_id = terminal.id
        and token_hash = extensions.digest((coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb)->>'x-counter-session','sha256')
        and revoked_at is null;
    end if;
  end if;
  return jsonb_build_object('profile',profile_json,'permissions',coalesce(grants,'[]'), 'store',store_json,
    'terminal',terminal.id is not null and terminal.active, 'counter_expires_at',expiry);
end $$;

create function public.get_pos_products(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not (public.has_permission('sales.create',p_store_id) or public.has_permission('inventory.view',p_store_id)) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'internal_code',p.internal_code,'name',p.name,'category',p.category,'brand',p.brand,
    'compatible_model',p.compatible_model,'quality_grade',p.quality_grade,'color_variant',p.color_variant,
    'selling_price',p.selling_price,'minimum_selling_price',p.minimum_selling_price,'aliases',p.aliases,
    'low_stock_level',p.low_stock_level,'quantity',greatest(coalesce(b.quantity,0),0),
    'location',case when l.id is null then null else jsonb_build_object(
      'rack',case when l.kind = 'rack' then l.name when parent.kind = 'rack' then parent.name else grandparent.name end,
      'shelf',case when l.kind = 'shelf' then l.name when parent.kind = 'shelf' then parent.name else '' end,
      'box',case when l.kind = 'box' then l.name else '' end) end
  ) order by p.internal_code),'[]') into result from public.products p
  left join lateral (select sum(quantity)::bigint quantity from public.stock_movements where product_id = p.id and store_id = p_store_id) b on true
  left join lateral (select location_id, sum(quantity) qty from public.stock_movements where product_id = p.id and store_id = p_store_id
    group by location_id having sum(quantity) > 0 order by qty desc, location_id limit 1) primary_location on true
  left join public.locations l on l.id = primary_location.location_id
  left join public.locations parent on parent.id = l.parent_location_id
  left join public.locations grandparent on grandparent.id = parent.parent_location_id
  where p.store_id = p_store_id and p.state = 'active';
  return result;
end $$;
create function public.get_product_financials(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.has_permission('costs.view_purchase_cost',p_store_id) then raise exception 'Access denied' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'purchase_cost',purchase_cost)),'[]') into result
    from public.product_financials where store_id = p_store_id;
  return result;
end $$;
create function public.get_profit_summary(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission('profit.view',p_store_id) then raise exception 'Access denied' using errcode = '42501'; end if;
  -- No sales ledger exists yet; do not invent production financial results.
  return jsonb_build_object('available',false,'gross_profit',null,'reason','Sales persistence is not implemented yet');
end $$;
revoke execute on function public.get_session_context(), public.get_pos_products(uuid), public.get_product_financials(uuid), public.get_profit_summary(uuid) from public, anon;
grant execute on function public.get_session_context(), public.get_pos_products(uuid), public.get_product_financials(uuid), public.get_profit_summary(uuid) to authenticated;
commit;
