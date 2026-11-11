begin;
alter table public.products add column custom_sale_only boolean not null default false;
update public.products set custom_sale_only=true where id in(select product_id from private.custom_service_lines);
do $$ declare source text;begin
 source:=pg_get_functiondef('public.complete_sale(uuid,jsonb)'::regprocedure);
 source:=replace(source,'insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price,notes,created_by)',
   'insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price,notes,created_by,custom_sale_only)');
 source:=replace(source,'coalesce(custom->>''description'',''''),actor);','coalesce(custom->>''description'',''''),actor,true);');execute source;
end $$;
alter function public.save_employee(uuid,jsonb) rename to save_existing_employee;
revoke all on function public.save_existing_employee(uuid,jsonb) from public,anon,authenticated;
create function public.save_employee(p_store_id uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());v_email text:=lower(trim(coalesce(p_input->>'email','')));
begin
 perform private.require_permission('employees.manage',p_store_id);
 if not exists(select 1 from auth.users where id=pid) then
  if not public.is_owner() then raise exception 'Owner must provision new staff identities' using errcode='42501';end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid staff email address' using errcode='22023';end if;
  if exists(select 1 from auth.users where lower(auth.users.email)=v_email) then raise exception 'This staff email already exists' using errcode='22023';end if;
  insert into auth.users(id,email) values(pid,v_email);
 end if;
 perform public.save_existing_employee(p_store_id,p_input||jsonb_build_object('id',pid));
end $$;
revoke all on function public.save_employee(uuid,jsonb) from public,anon;
grant execute on function public.save_employee(uuid,jsonb) to authenticated;
create function public.set_staff_account(p_store_id uuid,p_profile_id uuid,p_email text,p_hash text) returns void language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 perform private.require_permission('employees.manage',p_store_id);
 if exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then raise exception 'Use your individual management account' using errcode='42501';end if;
 select * into target from public.profiles p where p.id=p_profile_id and exists(select 1 from public.store_memberships m where m.store_id=p_store_id and m.profile_id=p.id and m.active);
 if target.id is null or target.id=public.current_profile_id() or target.role='owner' or not public.is_owner() and target.role<>'employee' then raise exception 'Account administration denied' using errcode='42501';end if;
 if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or p_email<>lower(p_email) or p_hash not like '$argon2id$%' then raise exception 'Invalid account details' using errcode='22023';end if;
 update auth.users set email=p_email where id=target.id;update public.profiles set email=p_email where id=target.id;
 insert into app_private.accounts(user_id,email,password_hash) values(target.id,p_email,p_hash)
 on conflict(user_id) do update set email=excluded.email,password_hash=excluded.password_hash,updated_at=now();
 update app_private.sessions set revoked_at=coalesce(revoked_at,now()) where user_id=target.id;
 perform private.write_audit(p_store_id,public.current_profile_id(),'employee.account_configured','profile',target.id);
end $$;
revoke all on function public.set_staff_account(uuid,uuid,text,text) from public,anon;
grant execute on function public.set_staff_account(uuid,uuid,text,text) to authenticated;
-- Read-only capability identity for a signed media link from a shared counter. The profile is server signed,
-- and must still have an unrevoked PIN session on this exact terminal at read time.
create function app_private.media_profile_context(p_uid uuid,p_pid uuid,p_store uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.store_memberships m on m.profile_id=p.id and m.store_id=p_store and m.active
 where p.id=p_pid and p.status='active' and exists(select 1 from public.stores where id=p_store and status='active')
 and (p.id=p_uid or exists(select 1 from public.counter_terminals t join private.counter_sessions c on c.terminal_id=t.id and c.employee_id=p_pid
   where t.auth_user_id=p_uid and t.store_id=p_store and t.active and c.revoked_at is null and c.expires_at>now())));
$$;
create function app_private.media_profile_permission(p_pid uuid,p_store uuid,p_keys text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=p_pid and role='owner' and status='active') or exists(
  select 1 from public.employee_permissions e join public.permissions k on k.id=e.permission_id where e.profile_id=p_pid and e.store_id=p_store and e.enabled and k.key=any(p_keys));
$$;
revoke all on function app_private.media_profile_context(uuid,uuid,uuid),app_private.media_profile_permission(uuid,uuid,text[]) from public,anon,authenticated;
commit;
