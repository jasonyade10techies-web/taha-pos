begin;
alter table app_private.media add column uploaded_by uuid references public.profiles(id);
update app_private.media set uploaded_by=profile_id;
alter table app_private.media alter column uploaded_by set not null;
-- Metadata cannot erase the immutable origin of a paired camera photo.
create function app_private.media_origin_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.profile_id<>old.profile_id or new.uploaded_by<>old.uploaded_by or new.store_id<>old.store_id or new.camera_job_id is distinct from old.camera_job_id or new.path<>old.path or new.kind<>old.kind then raise exception 'Image origin cannot be changed' using errcode='22023';end if;return new;
end $$;
create trigger media_origin_immutable before update on app_private.media for each row execute function app_private.media_origin_guard();
revoke all on function app_private.media_origin_guard() from public,anon,authenticated;
commit;
