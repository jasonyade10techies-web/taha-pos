begin;
create table private.custom_service_lines(
 product_id uuid primary key references public.products(id),store_id uuid not null references public.stores(id),request_id uuid not null,
 actor_id uuid not null references public.profiles(id),input jsonb not null,created_at timestamptz not null default now()
);
revoke all on private.custom_service_lines from public,anon,authenticated;
alter function public.complete_sale(uuid,jsonb) rename to complete_catalog_sale;
revoke all on function public.complete_catalog_sale(uuid,jsonb) from public,anon,authenticated;
create function public.complete_sale(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized jsonb:=p_input; line jsonb; lines jsonb:='[]'; custom jsonb; pid uuid; req uuid:=(p_input->>'idempotencyKey')::uuid; prior private.custom_service_lines;
 listed numeric; minimum numeric; result jsonb; cached jsonb; actor uuid:=public.current_profile_id(); floor numeric;
begin
 perform private.require_permission('sales.create',p_store_id);perform private.lock_store(p_store_id);
 if not exists(select 1 from jsonb_array_elements(p_input->'lines') l where l ? 'customService') then return public.complete_catalog_sale(p_store_id,p_input);end if;
 perform private.require_permission('services.create_custom',p_store_id);
 cached:=private.cached_request(p_store_id,'custom_sale',req,p_input);if cached is not null then return cached;end if;
 floor:=coalesce(nullif(private.settings(p_store_id)->>'customServiceMinimum','')::numeric,0);
 for line in select * from jsonb_array_elements(p_input->'lines') loop
  if line ? 'customService' then
   custom:=line->'customService';
   if coalesce(line->>'productId','') !~ '^custom:[0-9a-fA-F-]{36}$' or length(trim(coalesce(custom->>'name',''))) not between 1 and 120 then raise exception 'Enter a valid custom service name and reference' using errcode='22023';end if;
   pid:=substring(line->>'productId' from 8)::uuid;
   listed:=coalesce(nullif(custom->>'sellingPrice','')::numeric,(line->>'unitPrice')::numeric);
   minimum:=greatest(floor,coalesce(nullif(custom->>'minimumSellingPrice','')::numeric,0));
   if listed<=0 or listed<minimum or listed<>round(listed,2) or minimum<0 then raise exception 'Custom service price must meet the configured minimum' using errcode='22023';end if;
   select * into prior from private.custom_service_lines where product_id=pid;
   if prior.product_id is not null and (prior.store_id<>p_store_id or prior.request_id<>req or prior.actor_id<>actor or prior.input<>custom) then raise exception 'This service reference belongs to another sale' using errcode='22023';end if;
   if prior.product_id is null then
    if exists(select 1 from public.products where id=pid) then raise exception 'Invalid service reference' using errcode='22023';end if;
    insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price,notes,created_by)
    values(pid,p_store_id,trim(custom->>'name'),'Services',listed,minimum,coalesce(custom->>'description',''),actor);
    insert into public.product_financials(product_id,store_id,purchase_cost) values(pid,p_store_id,0);
    insert into private.custom_service_lines(product_id,store_id,request_id,actor_id,input) values(pid,p_store_id,req,actor,custom);
   end if;
   line:=(line-'customService')||jsonb_build_object('productId',pid);
  end if;
  lines:=lines||jsonb_build_array(line);
 end loop;
 normalized:=jsonb_set(normalized,'{lines}',lines);
 result:=public.complete_catalog_sale(p_store_id,normalized);
 update public.products set state='archived' where id in(select product_id from private.custom_service_lines where store_id=p_store_id and request_id=req);
 perform private.save_request(p_store_id,'custom_sale',req,p_input,result);
 return result;
end $$;
revoke all on function public.complete_sale(uuid,jsonb) from public,anon;
grant execute on function public.complete_sale(uuid,jsonb) to authenticated;
commit;
