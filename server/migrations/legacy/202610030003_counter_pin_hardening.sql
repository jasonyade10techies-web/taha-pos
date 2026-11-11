-- The public Phase 2 demo PIN is never a valid production counter credential.
begin;
create or replace function public.verify_counter_pin(p_profile_id uuid, p_pin text) returns jsonb
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
  if p_pin = '123456' or p_pin is null or p_pin !~ '^[0-9]{6}$' or hash is null or extensions.crypt(p_pin,hash) <> hash then
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
create or replace function public.set_employee_pin(p_profile_id uuid, p_store_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission('employees.manage',p_store_id) or exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then
    raise exception 'Management sign-in required' using errcode='42501';
  end if;
  if p_pin = '123456' or p_pin !~ '^[0-9]{6}$' or p_pin is null then raise exception 'Choose a non-demo six-digit PIN'; end if;
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
commit;

