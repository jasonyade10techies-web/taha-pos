begin;
-- No automatic auth.users trigger: signing into Google never grants business access.
create function public.provision_profile(p_auth_user_id uuid,p_full_name text,p_role text,p_store_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare user_email text; actor uuid := public.current_profile_id();
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_owner() then raise exception 'Owner administration required' using errcode='42501'; end if;
  if exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then raise exception 'Individual management sign-in required' using errcode='42501'; end if;
  if p_role not in ('owner','manager','employee') then raise exception 'Invalid role'; end if;
  if exists(select 1 from public.counter_terminals where auth_user_id=p_auth_user_id) then raise exception 'Terminal credentials cannot be a person profile'; end if;
  select email into user_email from auth.users where id=p_auth_user_id;
  if user_email is null then raise exception 'Create the Supabase Auth user first'; end if;
  insert into public.profiles(id,full_name,email,role,status) values(p_auth_user_id,p_full_name,user_email,p_role,'active')
    on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,role=excluded.role,status='active';
  insert into public.store_memberships(profile_id,store_id) values(p_auth_user_id,p_store_id)
    on conflict(profile_id,store_id) do update set active=true;
  perform private.write_audit(p_store_id,actor,'profile.provisioned','profile',p_auth_user_id,jsonb_build_object('role',p_role));
end $$;
create function public.register_counter_terminal(p_auth_user_id uuid,p_store_id uuid,p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_owner() then raise exception 'Owner administration required' using errcode='42501'; end if;
  if exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then raise exception 'Individual management sign-in required' using errcode='42501'; end if;
  if exists(select 1 from public.profiles where id=p_auth_user_id) then raise exception 'Use a dedicated Auth account with no person profile'; end if;
  insert into public.counter_terminals(auth_user_id,store_id,name) values(p_auth_user_id,p_store_id,p_name) returning id into result;
  perform private.write_audit(p_store_id,public.current_profile_id(),'terminal.registered','terminal',result);
  return result;
end $$;
create function public.update_my_profile(p_full_name text,p_phone text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_profile_id() is null or exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then
    raise exception 'Individual sign-in required' using errcode='42501';
  end if;
  update public.profiles set full_name=p_full_name,phone=p_phone where id=public.current_profile_id();
end $$;
revoke execute on function public.provision_profile(uuid,text,text,uuid),public.register_counter_terminal(uuid,uuid,text),public.update_my_profile(text,text) from public,anon;
grant execute on function public.provision_profile(uuid,text,text,uuid),public.register_counter_terminal(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.update_my_profile(text,text) to authenticated;
-- Future objects should never acquire blanket client access by default.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon,authenticated;
alter default privileges in schema public revoke all on sequences from anon,authenticated;
commit;
