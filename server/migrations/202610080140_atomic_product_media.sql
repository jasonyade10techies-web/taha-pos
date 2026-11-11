begin;
-- Commit gallery membership, order and primary with the product CAS/stock transaction.
alter function public.save_product(uuid,jsonb) rename to save_product_before_atomic_media;
revoke all on function public.save_product_before_atomic_media(uuid,jsonb) from public,anon,authenticated;
create function public.save_product(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; pid uuid; paths text[]; item record;
begin
 if p_input ? 'media_paths' then
  if jsonb_typeof(p_input->'media_paths')<>'array' or jsonb_array_length(p_input->'media_paths')>12 then raise exception 'Add up to 12 product images' using errcode='22023';end if;
  select coalesce(array_agg(value),'{}') into paths from jsonb_array_elements_text(p_input->'media_paths');
  if cardinality(paths)<>(select count(distinct x) from unnest(paths) x) or exists(select 1 from unnest(paths) x where not exists(select 1 from app_private.media m where m.store_id=p_store_id and m.kind='product' and m.path=x and m.deleted_at is null)) then raise exception 'Choose product images uploaded to this shop' using errcode='22023';end if;
  p_input:=p_input||jsonb_build_object('primary_image_url',paths[1]);
 end if;
 result:=public.save_product_before_atomic_media(p_store_id,p_input);pid:=(result->>'id')::uuid;
 if paths is not null then
  update app_private.media set entity_id=null,is_primary=false where store_id=p_store_id and kind='product' and entity_id=pid::text and not(path=any(paths));
  for item in select value,ordinality from unnest(paths) with ordinality t(value,ordinality) loop
   update app_private.media set entity_id=pid::text,sort_order=item.ordinality-1,is_primary=item.ordinality=1 where store_id=p_store_id and kind='product' and path=item.value;
  end loop;
 end if;
 return result;
end $$;
revoke all on function public.save_product(uuid,jsonb) from public,anon;
grant execute on function public.save_product(uuid,jsonb) to authenticated;
commit;
