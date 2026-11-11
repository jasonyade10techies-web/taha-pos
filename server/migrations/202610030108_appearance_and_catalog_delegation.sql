begin;
create function public.get_appearance(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501';end if;
 return coalesce(private.settings(p_store_id)->'appearance','{"font":"Manrope","primary":"#FFC107","accent":"#E53935","success":"#168344","warning":"#9A5B0A","danger":"#DC2626"}'::jsonb);
end $$;
create function public.save_appearance(p_store_id uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare key text;
begin
 perform private.require_permission('appearance.customize',p_store_id);
 if jsonb_typeof(p_input)<>'object' or p_input->>'font' not in ('Manrope','Inter','System') or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('font','primary','accent','success','warning','danger')) then raise exception 'Invalid appearance settings' using errcode='22023';end if;
 foreach key in array array['primary','accent','success','warning','danger'] loop
  if coalesce(p_input->>key,'') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Enter six-digit hex colors' using errcode='22023';end if;
 end loop;
 insert into public.business_settings(store_id,settings) values(p_store_id,jsonb_set(private.settings(p_store_id),'{appearance}',p_input))
 on conflict(store_id) do update set settings=jsonb_set(public.business_settings.settings,'{appearance}',p_input),updated_at=now();
 perform private.write_audit(p_store_id,public.current_profile_id(),'appearance.updated','store',p_store_id);
end $$;
-- A custom-service seller with the explicit save_catalog grant can add a new service,
-- while editing established services remains a separate catalog management permission.
do $$ declare source text;begin
 source:=pg_get_functiondef('public.save_repair_service(uuid,jsonb)'::regprocedure);
 source:=replace(source,'perform private.require_permission(''repair.services.manage'',p_store_id);perform private.lock_store(p_store_id);',
  'if not public.has_permission(''repair.services.manage'',p_store_id) and not (public.has_permission(''services.save_catalog'',p_store_id) and not exists(select 1 from public.products where id=rid)) then raise exception ''Service catalog permission required'' using errcode=''42501'';end if;perform private.lock_store(p_store_id);');execute source;
end $$;
revoke all on function public.get_appearance(uuid),public.save_appearance(uuid,jsonb) from public,anon;
grant execute on function public.get_appearance(uuid),public.save_appearance(uuid,jsonb) to authenticated;
commit;
