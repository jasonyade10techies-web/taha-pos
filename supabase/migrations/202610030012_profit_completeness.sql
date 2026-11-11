begin;
-- Unknown acquisition cost is not zero profit cost. Services explicitly snapshot zero.
alter table public.sale_item_financials alter column purchase_cost drop not null;
create or replace function private.period_profit(p_store uuid,p_from date,p_to date) returns numeric language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.sale_item_financials f join public.sale_items i on i.id=f.item_id join public.sales s on s.id=i.sale_id
   where f.store_id=p_store and f.purchase_cost is null and (
     (s.created_at at time zone 'Asia/Karachi')::date between p_from and p_to or (s.voided_at at time zone 'Asia/Karachi')::date between p_from and p_to
     or exists(select 1 from public.returns r where r.item_id=i.id and (r.created_at at time zone 'Asia/Karachi')::date between p_from and p_to))) then null else
 coalesce((select sum(i.total-i.quantity*f.purchase_cost) from public.sale_items i join public.sales s on s.id=i.sale_id join public.sale_item_financials f on f.item_id=i.id
   where s.store_id=p_store and (s.created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0)
 -coalesce((select sum(r.amount-case when r.destination='Sellable Stock' then r.quantity*f.purchase_cost else 0 end) from public.returns r join public.sale_item_financials f on f.item_id=r.item_id
   where r.store_id=p_store and (r.created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0)
 -coalesce((select sum(i.total-i.quantity*f.purchase_cost) from public.sale_items i join public.sales s on s.id=i.sale_id join public.sale_item_financials f on f.item_id=i.id
   where s.store_id=p_store and (s.voided_at at time zone 'Asia/Karachi')::date between p_from and p_to),0) end
$$;
create or replace function public.get_profit_summary(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_profit numeric;
begin
 perform private.require_permission('profit.view',p_store_id);
 v_profit:=private.period_profit(p_store_id,(now() at time zone 'Asia/Karachi')::date,(now() at time zone 'Asia/Karachi')::date);
 return jsonb_build_object('available',v_profit is not null,'gross_profit',v_profit);
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
commit;
