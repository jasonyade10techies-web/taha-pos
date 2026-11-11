create function public.get_dashboard_range(p_store_id uuid,p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare step interval; unit text; d timestamp; finish timestamp; result jsonb:='[]'; sales numeric; profit numeric; can_profit boolean;
begin
 if not public.can_access_store(p_store_id) or not(public.has_permission('sales.view',p_store_id) or public.has_permission('reports.view',p_store_id)) then raise exception 'Access denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'Choose a range of at most ten years' using errcode='22023';end if;
 unit:=case when p_to=p_from then 'hour' when p_to-p_from<=31 then 'day' when p_to-p_from<=120 then 'week' when p_to-p_from<=730 then 'month' else 'year' end;
 step:=('1 '||unit)::interval;d:=p_from::timestamp;can_profit:=public.has_permission('profit.view',p_store_id);
 while d<(p_to+1)::timestamp loop
  finish:=least(d+step,(p_to+1)::timestamp);
  select coalesce((select sum(total) from public.sales where store_id=p_store_id and created_at>=d at time zone 'Asia/Karachi' and created_at<finish at time zone 'Asia/Karachi'),0)-coalesce((select sum(total) from public.sales where store_id=p_store_id and voided_at>=d at time zone 'Asia/Karachi' and voided_at<finish at time zone 'Asia/Karachi'),0)-coalesce((select sum(amount) from public.returns where store_id=p_store_id and created_at>=d at time zone 'Asia/Karachi' and created_at<finish at time zone 'Asia/Karachi'),0) into sales;
  profit:=null;
  if can_profit and private.period_profit(p_store_id,p_from,p_to) is not null then
   select coalesce((select sum(i.total-i.quantity*f.purchase_cost) from public.sale_items i join public.sales s on s.id=i.sale_id join public.sale_item_financials f on f.item_id=i.id where s.store_id=p_store_id and s.created_at>=d at time zone 'Asia/Karachi' and s.created_at<finish at time zone 'Asia/Karachi'),0)-coalesce((select sum(i.total-i.quantity*f.purchase_cost) from public.sale_items i join public.sales s on s.id=i.sale_id join public.sale_item_financials f on f.item_id=i.id where s.store_id=p_store_id and s.voided_at>=d at time zone 'Asia/Karachi' and s.voided_at<finish at time zone 'Asia/Karachi'),0)-coalesce((select sum(r.amount-case when r.destination='Sellable Stock' then r.quantity*f.purchase_cost else 0 end) from public.returns r join public.sale_item_financials f on f.item_id=r.item_id where r.store_id=p_store_id and r.created_at>=d at time zone 'Asia/Karachi' and r.created_at<finish at time zone 'Asia/Karachi'),0) into profit;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('date',d,'day',case unit when 'hour' then to_char(d,'HH24:MI') when 'month' then to_char(d,'Mon YY') when 'year' then to_char(d,'YYYY') else to_char(d,'DD Mon') end,'sales',sales,'profit',profit));d:=d+step;
 end loop;
 return jsonb_build_object('summary',private.period_summary(p_store_id,p_from,p_to),'profit',case when can_profit then private.period_profit(p_store_id,p_from,p_to) end,'chart',result);
end$$;
revoke all on function public.get_dashboard_range(uuid,date,date) from public,anon;
grant execute on function public.get_dashboard_range(uuid,date,date) to authenticated;
