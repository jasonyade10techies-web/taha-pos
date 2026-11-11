begin;
alter table public.sales drop constraint sales_check1;
alter table public.sales add constraint sales_total_with_tax check(total=subtotal-discount-coupon_discount+case when tax_snapshot->>'mode'='Exclusive' then coalesce((tax_snapshot->>'amount')::numeric,0) else 0 end);
alter table public.sale_items add column tax_exclusive boolean not null default false;
alter table public.sale_items drop constraint sale_items_check;
alter table public.sale_items add constraint item_total_with_tax check(total=quantity*unit_price-coupon_discount+case when tax_exclusive then tax_amount else 0 end);
do $$declare source text;begin
 source:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 source:=replace(source,'price_reason,approver_id,tax_amount)','price_reason,approver_id,tax_amount,tax_exclusive)');
 source:=replace(source,'approver,coalesce((tax_snapshot->''lineAmounts''->>p.id::text)::numeric,0));','approver,coalesce((tax_snapshot->''lineAmounts''->>p.id::text)::numeric,0),tax_snapshot->>''mode''=''Exclusive'');');
 execute source;
end $$;
commit;
