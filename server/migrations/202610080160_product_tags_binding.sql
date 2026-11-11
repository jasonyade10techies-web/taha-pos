begin;
do $$declare source text;begin
 source:=pg_get_functiondef('public.save_product_before_atomic_media(uuid,jsonb)'::regprocedure);
 source:=replace(source,'tags text[]:=','requested_tags text[]:=');
 source:=replace(source,'cardinality(tags)','cardinality(requested_tags)');
 source:=replace(source,'unnest(tags)','unnest(requested_tags)');
 source:=replace(source,'tags=tags','tags=requested_tags');
 execute source;
end $$;
commit;
