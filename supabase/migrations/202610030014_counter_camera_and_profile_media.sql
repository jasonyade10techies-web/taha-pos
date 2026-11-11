begin;
-- A camera device is paired by an individually authenticated staff member. PIN-only terminals cannot act as phones.
create table public.camera_pairings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  terminal_id text not null check (length(terminal_id) between 8 and 100),
  requester_id uuid not null references public.profiles(id),
  device_profile_id uuid references public.profiles(id),
  device_name text not null default 'Staff Phone',
  code_hash bytea not null,
  expires_at timestamptz not null default now()+interval '10 minutes',
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now()
);
create index camera_pairings_terminal on public.camera_pairings(store_id,terminal_id,created_at desc);
create table public.camera_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  pairing_id uuid not null references public.camera_pairings(id),
  terminal_id text not null,
  requester_id uuid not null references public.profiles(id),
  device_profile_id uuid not null references public.profiles(id),
  job_type text not null check(job_type in ('payment-proof','product-photo','used-device-photo','repair-intake','customer-photo','profile-picture','damage-evidence','receipt-document')),
  title text not null check(length(title) between 1 and 120),
  reference text not null default '' check(length(reference)<=160),
  amount numeric(14,2) check(amount>=0),
  status text not null default 'waiting' check(status in ('waiting','opened','captured','uploading','received','failed','cancelled')),
  image_path text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 minutes'
);
create index camera_jobs_pending on public.camera_jobs(store_id,device_profile_id,created_at desc);
alter table public.camera_pairings enable row level security;
alter table public.camera_jobs enable row level security;
create policy camera_pairing_read on public.camera_pairings for select to authenticated using (public.can_access_store(store_id) and (requester_id=public.current_profile_id() or device_profile_id=public.current_profile_id()));
create policy camera_job_read on public.camera_jobs for select to authenticated using (public.can_access_store(store_id) and (requester_id=public.current_profile_id() or device_profile_id=public.current_profile_id()));
grant select on public.camera_pairings,public.camera_jobs to authenticated;
-- All mutations go through this narrow server boundary. Device ownership and job transitions are verified here.
create function public.camera_workflow(p_store_id uuid,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_profile_id(); pairing public.camera_pairings; job public.camera_jobs; code text; result jsonb; permission text;
begin
  if actor is null or not public.can_access_store(p_store_id) then raise exception 'Staff access required' using errcode='42501'; end if;
  if p_action='start_pairing' then
    if not (public.has_permission('sales.create',p_store_id) or public.has_permission('products.edit',p_store_id) or public.has_permission('devices.buy_used',p_store_id)) then raise exception 'Counter permission required' using errcode='42501'; end if;
    code:=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,8));
    insert into public.camera_pairings(store_id,terminal_id,requester_id,code_hash) values(p_store_id,p_input->>'terminalId',actor,extensions.digest(code,'sha256')) returning * into pairing;
    return jsonb_build_object('id',pairing.id,'code',code,'expiresAt',pairing.expires_at);
  elsif p_action='pair' then
    if exists(select 1 from public.counter_terminals where auth_user_id=auth.uid()) then raise exception 'Sign in with your individual staff account on this phone' using errcode='42501'; end if;
    select * into pairing from public.camera_pairings where store_id=p_store_id and code_hash=extensions.digest(upper(trim(p_input->>'code')),'sha256') and expires_at>now() and device_profile_id is null and disconnected_at is null for update;
    if pairing.id is null then raise exception 'Pairing code is incorrect or expired' using errcode='22023'; end if;
    update public.camera_pairings set device_profile_id=actor,device_name=left(coalesce(nullif(p_input->>'deviceName',''),'Staff Phone'),80),connected_at=now() where id=pairing.id;
    return jsonb_build_object('terminalId',pairing.terminal_id,'id',pairing.id);
  elsif p_action='devices' then
    return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'terminalId',terminal_id,'name',device_name,'connected',device_profile_id is not null and disconnected_at is null,'connectedAt',connected_at) order by created_at desc),'[]') from public.camera_pairings where store_id=p_store_id and (requester_id=actor or device_profile_id=actor) and (expires_at>now() or device_profile_id is not null));
  elsif p_action='disconnect' then
    update public.camera_pairings set disconnected_at=now() where id=(p_input->>'id')::uuid and store_id=p_store_id and (requester_id=actor or device_profile_id=actor);
    return '{}';
  elsif p_action='request' then
    permission:=case p_input->>'type' when 'payment-proof' then 'sales.create' when 'product-photo' then 'products.edit' when 'used-device-photo' then 'devices.buy_used' when 'customer-photo' then 'credit.create' when 'repair-intake' then 'sales.create' when 'damage-evidence' then 'returns.create' when 'receipt-document' then 'sales.create' when 'profile-picture' then null else 'INVALID' end;
    if permission is not null then perform private.require_permission(permission,p_store_id); end if;
    select * into pairing from public.camera_pairings where store_id=p_store_id and terminal_id=p_input->>'terminalId' and requester_id=actor and device_profile_id is not null and disconnected_at is null order by connected_at desc limit 1;
    if pairing.id is null then raise exception 'Connect a staff phone before requesting a photo' using errcode='22023'; end if;
    insert into public.camera_jobs(store_id,pairing_id,terminal_id,requester_id,device_profile_id,job_type,title,reference,amount) values(p_store_id,pairing.id,pairing.terminal_id,actor,pairing.device_profile_id,p_input->>'type',p_input->>'title',coalesce(p_input->>'reference',''),nullif(p_input->>'amount','')::numeric) returning * into job;
    return to_jsonb(job);
  elsif p_action='list' then
    return (select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc),'[]') from (select * from public.camera_jobs where store_id=p_store_id and (requester_id=actor or device_profile_id=actor) and expires_at>now() and status<>'cancelled' order by created_at desc limit 40) j);
  elsif p_action in ('update','cancel') then
    select * into job from public.camera_jobs where id=(p_input->>'id')::uuid and store_id=p_store_id for update;
    if job.id is null or job.expires_at<now() then raise exception 'Camera request expired. Request another photo.' using errcode='22023'; end if;
    if p_action='cancel' and job.requester_id=actor then update public.camera_jobs set status='cancelled',updated_at=now() where id=job.id; return '{}'; end if;
    if actor<>job.device_profile_id or not exists(select 1 from public.camera_pairings where id=job.pairing_id and disconnected_at is null) or job.status in ('received','cancelled') then raise exception 'Camera request access denied' using errcode='42501'; end if;
    if p_input->>'status' not in ('opened','captured','uploading','received','failed') then raise exception 'Invalid camera state' using errcode='22023'; end if;
    if p_input->>'status'='received' and not exists(select 1 from storage.objects where bucket_id='camera-captures' and name=p_input->>'imagePath' and name like p_store_id::text||'/'||job.id::text||'/%') then raise exception 'Upload a private camera image first' using errcode='22023'; end if;
    update public.camera_jobs set status=p_input->>'status',image_path=case when p_input->>'status'='received' then p_input->>'imagePath' else image_path end,error=left(p_input->>'error',300),updated_at=now() where id=job.id returning * into job;
    return to_jsonb(job);
  end if;
  raise exception 'Unknown camera action' using errcode='22023';
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('camera-captures','camera-captures',false,2097152,array['image/webp']) on conflict(id) do nothing;
create function public.can_access_camera_image(p_path text,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.camera_jobs j join public.camera_pairings p on p.id=j.pairing_id where p_path like j.store_id::text||'/'||j.id::text||'/%' and public.can_access_store(j.store_id) and (
    (p_write and j.device_profile_id=public.current_profile_id() and p.disconnected_at is null and j.expires_at>now() and j.status not in ('received','cancelled')) or
    (not p_write and public.current_profile_id() in (j.requester_id,j.device_profile_id))))
$$;
create policy camera_image_read on storage.objects for select to authenticated using(bucket_id='camera-captures' and public.can_access_camera_image(name));
create policy camera_image_insert on storage.objects for insert to authenticated with check(bucket_id='camera-captures' and public.can_access_camera_image(name,true));
-- Profile media uses an individually owned private folder; no employee can write another profile's picture.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-images','profile-images',false,2097152,array['image/webp']) on conflict(id) do nothing;
create policy profile_image_read on storage.objects for select to authenticated using(bucket_id='profile-images' and split_part(name,'/',1)=public.current_profile_id()::text);
create policy profile_image_insert on storage.objects for insert to authenticated with check(bucket_id='profile-images' and split_part(name,'/',1)=auth.uid()::text and auth.uid()=public.current_profile_id());
create function public.update_my_avatar(p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from public.current_profile_id() then raise exception 'Individual sign-in required' using errcode='42501'; end if;
  if p_path<>'' and not exists(select 1 from storage.objects where bucket_id='profile-images' and name=p_path and split_part(name,'/',1)=auth.uid()::text) then raise exception 'Select your uploaded profile picture' using errcode='22023'; end if;
  update public.profiles set avatar_url=nullif(p_path,'') where id=auth.uid();
end $$;
revoke all on function public.camera_workflow(uuid,text,jsonb),public.can_access_camera_image(text,boolean),public.update_my_avatar(text) from public,anon;
grant execute on function public.camera_workflow(uuid,text,jsonb),public.can_access_camera_image(text,boolean),public.update_my_avatar(text) to authenticated;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.camera_jobs; end if; end $$;
commit;
