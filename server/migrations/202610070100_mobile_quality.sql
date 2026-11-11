-- Originals remain private; edited media references its original rather than recompressing edits.
alter table app_private.media add column original_media_id uuid references app_private.media(id);
alter table app_private.media add column crop jsonb;
alter table app_private.media add column original_mime text;
create index media_original_idx on app_private.media(original_media_id) where original_media_id is not null;
alter table app_private.camera_jobs alter column expires_at set default (now()+interval '60 seconds');
do $$declare constraint_name text;begin
 for constraint_name in select conname from pg_constraint where conrelid='app_private.camera_jobs'::regclass and contype='c' and pg_get_constraintdef(oid) like '%max_captures%' loop
 execute format('alter table app_private.camera_jobs drop constraint %I',constraint_name);end loop;
end$$;
alter table app_private.camera_jobs add constraint camera_capture_limit check(max_captures between 1 and 12);
create index camera_device_active_idx on app_private.camera_jobs(store_id,device_id,expires_at) where status not in ('received','cancelled','expired');
