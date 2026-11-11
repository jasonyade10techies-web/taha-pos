begin;
-- Settings managers may customize the same validated appearance without an additional role name check.
do $$ declare source text;begin
 source:=pg_get_functiondef('public.save_appearance(uuid,jsonb)'::regprocedure);
 source:=replace(source,'perform private.require_permission(''appearance.customize'',p_store_id);',
  'if not public.has_permission(''appearance.customize'',p_store_id) and not public.has_permission(''settings.manage'',p_store_id) then raise exception ''Appearance permission required'' using errcode=''42501'';end if;');execute source;
end $$;
commit;
