begin;
create function app_private.set_avatar(p_profile uuid,p_path text) returns void language sql security definer set search_path='' as $$
 update public.profiles set avatar_url=p_path,updated_at=now() where id=p_profile;
$$;
revoke all on function app_private.set_avatar(uuid,text) from public,anon,authenticated;
create function public.log_media_event(p_store uuid,p_action text,p_id uuid,p_metadata jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_access_store(p_store) or p_action not in ('media.uploaded','media.attached','media.deleted','camera.requested','camera.completed','device.paired','device.disconnected') or octet_length(p_metadata::text)>4096 then raise exception 'Access denied' using errcode='42501';end if;
 perform private.write_audit(p_store,public.current_profile_id(),p_action,'media',p_id,p_metadata);
end $$;
revoke all on function public.log_media_event(uuid,text,uuid,jsonb) from public,anon;
grant execute on function public.log_media_event(uuid,text,uuid,jsonb) to authenticated;
commit;
