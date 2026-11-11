begin;
create function private.write_audit(p_store uuid, p_actor uuid, p_action text, p_type text, p_id uuid, p_metadata jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs(store_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_store,p_actor,p_action,p_type,p_id,p_metadata)
$$;
create function public.list_counter_employees() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare store uuid; result jsonb;
begin
  select t.store_id into store from public.counter_terminals t join public.stores s on s.id=t.store_id and s.status='active'
    where t.auth_user_id=auth.uid() and t.active;
  if store is null then raise exception 'Use a registered counter account' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role,'avatar_url',p.avatar_url) order by p.full_name),'[]')
    into result from public.profiles p join public.store_memberships m on m.profile_id=p.id and m.store_id=store and m.active
    join private.employee_pin_credentials c on c.profile_id=p.id where p.status='active';
  return result;
end $$;
create function public.verify_counter_pin(p_profile_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare terminal public.counter_terminals; attempt private.counter_pin_attempts; hash text; token text; expiry timestamptz; session_id uuid;
begin
  select t.* into terminal from public.counter_terminals t join public.stores s on s.id=t.store_id and s.status='active'
    where t.auth_user_id=auth.uid() and t.active;
  if terminal.id is null then raise exception 'Use a registered counter account' using errcode='42501'; end if;
  insert into private.counter_pin_attempts(terminal_id) values(terminal.id) on conflict do nothing;
  select * into attempt from private.counter_pin_attempts where terminal_id=terminal.id for update;
  if attempt.locked_until > now() then
    return jsonb_build_object('ok',false,'message','Too many attempts. Try again later.','retry_after',ceil(extract(epoch from attempt.locked_until-now())));
  end if;
  if attempt.window_start < now()-interval '15 minutes' then
    update private.counter_pin_attempts set failures=0,window_start=now(),locked_until=null where terminal_id=terminal.id;
    attempt.failures := 0;
  end if;
  select c.pin_hash into hash from private.employee_pin_credentials c
    join public.profiles p on p.id=c.profile_id and p.status='active'
    join public.store_memberships m on m.profile_id=p.id and m.store_id=terminal.store_id and m.active
    where c.profile_id=p_profile_id;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' or hash is null or extensions.crypt(p_pin,hash) <> hash then
    update private.counter_pin_attempts set failures=attempt.failures+1,
      locked_until=case when attempt.failures+1 >= 5 then now()+interval '15 minutes' else null end where terminal_id=terminal.id;
    perform private.write_audit(terminal.store_id,null,'counter.pin_failed','terminal',terminal.id);
    -- Return rather than raise, so the rate-limit update is committed.
    return jsonb_build_object('ok',false,'message','PIN could not be verified.','retry_after',case when attempt.failures+1 >= 5 then 900 else 0 end);
  end if;
  update private.counter_pin_attempts set failures=0,window_start=now(),locked_until=null where terminal_id=terminal.id;
  update private.counter_sessions set revoked_at=now() where terminal_id=terminal.id and revoked_at is null;
  token := encode(extensions.gen_random_bytes(32),'hex'); expiry := now()+interval '12 hours';
  insert into private.counter_sessions(terminal_id,employee_id,token_hash,expires_at)
    values(terminal.id,p_profile_id,extensions.digest(token,'sha256'),expiry) returning id into session_id;
  perform private.write_audit(terminal.store_id,p_profile_id,'counter.employee_verified','counter_session',session_id);
  return jsonb_build_object('ok',true,'token',token,'expires_at',expiry,'session_id',session_id);
end $$;
create function public.lock_counter_session() returns void
language plpgsql security definer set search_path = '' as $$
declare v_terminal_id uuid;
begin
  select id into v_terminal_id from public.counter_terminals where auth_user_id=auth.uid();
  if v_terminal_id is null then raise exception 'Not a counter terminal' using errcode='42501'; end if;
  update private.counter_sessions cs set revoked_at=now() where cs.terminal_id=v_terminal_id and cs.revoked_at is null;
end $$;
create function public.set_employee_pin(p_profile_id uuid, p_store_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission('employees.manage',p_store_id) or exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then
    raise exception 'Management sign-in required' using errcode='42501';
  end if;
  if p_pin !~ '^[0-9]{6}$' or p_pin is null then raise exception 'A six-digit PIN is required'; end if;
  if not exists(select 1 from public.profiles p join public.store_memberships m on m.profile_id=p.id
    where p.id=p_profile_id and p.status='active' and m.store_id=p_store_id and m.active
      and (public.is_owner() or p.role='employee' and p.id<>public.current_profile_id())) then
    raise exception 'Target employee is not eligible' using errcode='42501';
  end if;
  insert into private.employee_pin_credentials(profile_id,pin_hash,updated_by)
    values(p_profile_id,extensions.crypt(p_pin,extensions.gen_salt('bf',12)),public.current_profile_id())
    on conflict(profile_id) do update set pin_hash=excluded.pin_hash,updated_by=excluded.updated_by,updated_at=now();
  update private.counter_sessions set revoked_at=now() where employee_id=p_profile_id and revoked_at is null;
  perform private.write_audit(p_store_id,public.current_profile_id(),'employee.pin_changed','profile',p_profile_id);
end $$;
create function public.set_employee_permission(p_profile_id uuid,p_store_id uuid,p_key text,p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_permission_id bigint;
begin
  if not public.has_permission('employees.permissions',p_store_id) or exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then
    raise exception 'Management permission required' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles p join public.store_memberships m on m.profile_id=p.id
    where p.id=p_profile_id and m.store_id=p_store_id and m.active and p.role<>'owner'
      and (public.is_owner() or p.role='employee' and p.id<>public.current_profile_id() and public.has_permission(p_key,p_store_id))) then
    raise exception 'Permission delegation denied' using errcode='42501';
  end if;
  select id into v_permission_id from public.permissions where key=p_key;
  if v_permission_id is null then raise exception 'Unknown permission'; end if;
  insert into public.employee_permissions(profile_id,store_id,permission_id,enabled,updated_by)
    values(p_profile_id,p_store_id,v_permission_id,p_enabled,public.current_profile_id())
    on conflict(profile_id,store_id,permission_id) do update set enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
  perform private.write_audit(p_store_id,public.current_profile_id(),'employee.permission_changed','profile',p_profile_id,
    jsonb_build_object('permission_key',p_key,'enabled',p_enabled));
end $$;
create function public.log_client_event(p_action text,p_version text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare store uuid;
begin
  if public.current_profile_id() is null or p_action not in ('client.session_started','client.session_ended') then
    raise exception 'Unsupported audit event' using errcode='42501';
  end if;
  select id into store from public.stores where public.can_access_store(id) order by created_at,id limit 1;
  perform private.write_audit(store,public.current_profile_id(),p_action,'session',null,jsonb_build_object('source','client','version',left(p_version,32)));
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.list_counter_employees(),public.verify_counter_pin(uuid,text),public.lock_counter_session(),public.set_employee_pin(uuid,uuid,text),public.set_employee_permission(uuid,uuid,text,boolean),public.log_client_event(text,text) from public,anon;
grant execute on function public.list_counter_employees(),public.verify_counter_pin(uuid,text),public.lock_counter_session(),public.set_employee_pin(uuid,uuid,text),public.set_employee_permission(uuid,uuid,text,boolean),public.log_client_event(text,text) to authenticated;
commit;
