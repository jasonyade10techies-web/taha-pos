begin;
-- Keep the original coupon eligibility, usage, customer, stacking and floor rules.
-- Preview supplies an ephemeral service row; no inventory/catalog record is written.
do $$
declare source text; needle text; replacement text;
begin
  source := pg_get_functiondef('private.coupon_discount(uuid,text,jsonb,uuid)'::regprocedure);
  needle := 'select * into p from public.products where id=(line->>''productId'')::uuid and store_id=p_store and state=''active'';';
  replacement := $body$
    if line ? 'customService' then
      perform private.require_permission('services.create_custom',p_store);
      if coalesce(line->>'productId','') !~ '^custom:[0-9a-fA-F-]{36}$'
        or length(trim(coalesce(line->'customService'->>'name',''))) not between 1 and 120 then
        raise exception 'Enter a valid custom service name and reference' using errcode='22023';
      end if;
      p := null;
      p.id := substring(line->>'productId' from 8)::uuid;
      p.category := 'Services';
      p.selling_price := (line->'customService'->>'sellingPrice')::numeric;
      p.minimum_selling_price := greatest(coalesce(nullif(private.settings(p_store)->>'customServiceMinimum','')::numeric,0),coalesce((line->'customService'->>'minimumSellingPrice')::numeric,0));
      if p.selling_price is null or p.selling_price <= 0 or p.selling_price < p.minimum_selling_price
        or p.selling_price <> round(p.selling_price,2) or p.minimum_selling_price < 0 then
        raise exception 'Custom service price must meet the configured minimum' using errcode='22023';
      end if;
    else
      select * into p from public.products where id=(line->>'productId')::uuid and store_id=p_store and state='active';
    end if;
  $body$;
  if position(needle in source)=0 then raise exception 'Cannot apply coupon preview compatibility migration'; end if;
  execute replace(source,needle,replacement);
end $$;
commit;
