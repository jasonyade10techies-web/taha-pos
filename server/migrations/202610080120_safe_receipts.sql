begin;
-- Only the server runtime role can call this projection, after validating a receipt capability.
create function app_private.customer_receipt(p_store uuid,p_sale uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('invoice',s.invoice,'createdAt',s.created_at,'status',s.status,'subtotal',s.subtotal,'discount',s.discount,'couponDiscount',s.coupon_discount,'total',s.total,'tax',s.tax_snapshot,'paid',(private.sale_json(p_store,p_sale)->>'paid')::numeric,'outstanding',(private.sale_json(p_store,p_sale)->>'outstanding')::numeric,'change',s.change_amount,'receipt',s.receipt_snapshot,'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'variant',i.variant,'quantity',i.quantity,'unitPrice',i.unit_price,'total',i.total) order by i.id) from public.sale_items i where i.sale_id=s.id),'[]')) from public.sales s where s.id=p_sale and s.store_id=p_store
$$;
revoke all on function app_private.customer_receipt(uuid,uuid) from public,anon,authenticated;
commit;
