begin;
create function app_private.auth_audit(p_uid uuid,p_action text,p_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid;store uuid;
begin
 if p_action not in ('auth.signed_in','auth.signed_out','auth.password_changed','auth.session_revoked','auth.refresh_replayed') then raise exception 'Invalid auth audit action' using errcode='22023';end if;
 select id into pid from public.profiles where id=p_uid;
 select store_id into store from public.store_memberships where profile_id=pid and active order by created_at limit 1;
 if store is null then select store_id into store from public.counter_terminals where auth_user_id=p_uid;end if;
 insert into public.audit_logs(store_id,actor_profile_id,action,entity_type,entity_id,metadata) values(store,pid,p_action,'auth_session',p_session,'{}');
end $$;
create function app_private.media_referenced(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.media m where m.id=p_id and (
  m.kind='proof' or m.camera_job_id is not null
  or exists(select 1 from public.products p where p.store_id=m.store_id and p.primary_image_url=m.path)
  or exists(select 1 from public.customers c where c.store_id=m.store_id and c.photo_path=m.path)
  or exists(select 1 from public.profiles p where p.avatar_url=m.path)
  or exists(select 1 from public.payment_methods p where p.store_id=m.store_id and p.qr_path=m.path)
  or exists(select 1 from public.repair_jobs r where r.store_id=m.store_id and m.path=any(r.photos))));
$$;
revoke all on function app_private.auth_audit(uuid,text,uuid),app_private.media_referenced(uuid) from public,anon,authenticated;
commit;
