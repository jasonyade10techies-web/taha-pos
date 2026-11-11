begin;
-- Selected invoices must retain older returns even when the global recent list
-- has rolled past them. Reuse the existing authorized return projection.
alter function public.transaction_data(uuid,text,jsonb) rename to transaction_data_before_5d1;
revoke all on function public.transaction_data_before_5d1(uuid,text,jsonb) from public,anon,authenticated;
create function public.transaction_data(p_store_id uuid,p_kind text,p_filter jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_sale_id uuid;
begin
 if p_kind<>'returns' or nullif(p_filter->>'saleId','') is null then
  return public.transaction_data_before_5d1(p_store_id,p_kind,p_filter);
 end if;
 if not public.can_access_store(p_store_id) or not(public.has_permission('returns.create',p_store_id) or public.has_permission('sales.view',p_store_id) or public.has_permission('reports.view',p_store_id)) then
  raise exception 'Returns permission required' using errcode='42501';
 end if;
 v_sale_id:=(p_filter->>'saleId')::uuid;
 return (select coalesce(jsonb_agg(private.return_json(r.id) order by r.created_at desc,r.id),'[]') from public.returns r where r.store_id=p_store_id and r.sale_id=v_sale_id);
end $$;
revoke all on function public.transaction_data(uuid,text,jsonb) from public,anon;
grant execute on function public.transaction_data(uuid,text,jsonb) to authenticated;
commit;
