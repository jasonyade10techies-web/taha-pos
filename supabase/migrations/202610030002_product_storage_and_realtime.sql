begin;
-- Private bucket: only scoped catalog readers can sign a URL. Max 2 MB, WebP only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',false,2097152,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function public.can_access_product_image(p_name text,p_write boolean default false,p_delete boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare store uuid;
begin
  if p_name !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$' then return false; end if;
  begin store:=split_part(p_name,'/',1)::uuid; exception when invalid_text_representation then return false; end;
  if p_write then
    return (public.has_permission('products.create',store) or public.has_permission('products.edit',store)) and
      (not p_delete or not exists(select 1 from public.products where store_id=store and primary_image_url=p_name));
  end if;
  return exists(select 1 from public.products p where p.store_id=store and p.primary_image_url=p_name) and (
    public.has_permission('inventory.view',store) or public.has_permission('sales.create',store) or
    public.has_permission('products.create',store) or public.has_permission('products.edit',store) or
    public.has_permission('inventory.receive',store) or public.has_permission('inventory.transfer',store) or public.has_permission('inventory.adjust',store));
end $$;
revoke all on function public.can_access_product_image(text,boolean,boolean) from public,anon;
grant execute on function public.can_access_product_image(text,boolean,boolean) to authenticated;
create policy taha_product_images_read on storage.objects for select to authenticated
  -- Storage's delete API selects/returns objects as well as deleting them. Catalog
  -- writers may inspect their store's unreferenced uploads to clean them up.
  using(bucket_id='product-images' and (public.can_access_product_image(name) or public.can_access_product_image(name,true,true)));
create policy taha_product_images_insert on storage.objects for insert to authenticated
  with check(bucket_id='product-images' and public.can_access_product_image(name,true));
-- Replacement uses a new object path, never upsert over a referenced image.
create policy taha_product_images_delete on storage.objects for delete to authenticated
  using(bucket_id='product-images' and public.can_access_product_image(name,true,true));
-- Realtime includes only safe catalog/stock rows. Financial/private tables are excluded.
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['products','locations','stock_movements'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
commit;
