begin;
alter table public.products add column description_html text not null default '',add column supplier_id uuid references public.suppliers(id),add column visibility text not null default 'store' check(visibility in('store','store-and-website')),add column tags text[] not null default '{}';
alter table public.products add constraint product_description_length check(length(description_html)<=30000),add constraint product_tags_limit check(cardinality(tags)<=30);
create index products_supplier_idx on public.products(store_id,supplier_id) where supplier_id is not null;
alter function public.save_product(uuid,jsonb) rename to save_product_before_4e;
revoke all on function public.save_product_before_4e(uuid,jsonb) from public,anon,authenticated;
create function public.save_product(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; product_id uuid; supplier uuid:=nullif(p_input->>'supplier_id','')::uuid; tags text[]:=array(select jsonb_array_elements_text(coalesce(p_input->'tags','[]'))); next_state text:=coalesce(p_input->>'state','active');
begin
 if supplier is not null and not exists(select 1 from public.suppliers where id=supplier and store_id=p_store_id) then raise exception 'Select a supplier from this shop' using errcode='22023';end if;
 if cardinality(tags)>30 or exists(select 1 from unnest(tags) tag where length(tag)>60) or length(coalesce(p_input->>'description_html',''))>30000 or coalesce(p_input->>'visibility','store') not in('store','store-and-website') or next_state not in('active','archived') then raise exception 'Check description, tags and product status' using errcode='22023';end if;
 if next_state='archived' then perform private.require_permission('products.archive',p_store_id);end if;
 result:=public.save_product_before_4e(p_store_id,p_input);product_id:=(result->>'id')::uuid;
 update public.products set description_html=coalesce(p_input->>'description_html',''),supplier_id=supplier,visibility=coalesce(p_input->>'visibility','store'),tags=tags,state=next_state where id=product_id and store_id=p_store_id;
 select to_jsonb(p)||jsonb_build_object('updated_at',p.updated_at::text) into result from public.products p where p.id=product_id and p.store_id=p_store_id;
 return result;
end $$;
revoke all on function public.save_product(uuid,jsonb) from public,anon;
grant execute on function public.save_product(uuid,jsonb) to authenticated;
commit;
