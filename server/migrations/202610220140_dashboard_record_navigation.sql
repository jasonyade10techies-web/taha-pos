begin;
alter function public.get_dashboard_transactions(uuid) rename to get_dashboard_transactions_before_5d1;
revoke all on function public.get_dashboard_transactions_before_5d1(uuid) from public,anon,authenticated;
create function public.get_dashboard_transactions(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;activity jsonb:='[]';credit jsonb:='[]';
begin
 result:=public.get_dashboard_transactions_before_5d1(p_store_id);
 if public.has_permission('audit.view',p_store_id) then
  select coalesce(jsonb_agg(jsonb_build_object('id',row_no,'type',case when a.entity_type='location' then 'stock' when a.entity_type='payment' then 'payment' else 'sale' end,
   'text',case a.action
    when 'sale.returned' then 'Recorded a return'||coalesce(' for '||s.invoice,'')
    when 'location.created' then 'Created '||coalesce(l.name,'a storage location')
    when 'location.condition_set' then 'Updated storage condition for '||coalesce(l.name,'a location')
    when 'sale.completed' then 'Completed '||coalesce(s.invoice,'a sale')
    when 'sale.voided' then 'Voided '||coalesce(s.invoice,'a sale')
    when 'stock.received' then 'Received stock'
    when 'product.created' then 'Added '||coalesce(p.name,'a product')
    when 'product.edited' then 'Updated '||coalesce(p.name,'a product')
    else replace(initcap(replace(replace(a.action,'.',' '),'_',' ')),'Api','Shop') end,
   'amount',a.metadata->'total','time',to_char(a.created_at at time zone 'Asia/Karachi','HH24:MI'),
   'href',case when s.id is not null and public.has_permission('sales.view',p_store_id) then case when a.action='sale.returned' then '/returns?invoice='||s.id else '/transactions/'||s.id end
    when l.id is not null and public.has_permission('inventory.view',p_store_id) then '/locations/'||l.id
    when p.id is not null and public.has_permission('inventory.view',p_store_id) then '/products/'||p.id
    when a.entity_type='payment' then '/payments' else '/audit-log' end) order by a.created_at desc),'[]') into activity
  from (select *,row_number() over(order by created_at desc,id desc) row_no from public.audit_logs where store_id=p_store_id order by created_at desc,id desc limit 5)a
  left join public.sales s on a.entity_type='sale' and s.id::text=a.entity_id::text and s.store_id=p_store_id
  left join public.locations l on a.entity_type='location' and l.id::text=a.entity_id::text and l.store_id=p_store_id
  left join public.products p on a.entity_type='product' and p.id::text=a.entity_id::text and p.store_id=p_store_id;
 end if;
 if public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id) then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'initials',upper(left(name,2)),'amount',balance,'due','Outstanding credit','overdue',false)),'[]') into credit
  from(select c.id,c.name,public.get_customer_balance(p_store_id,c.id) balance from public.customers c where c.store_id=p_store_id and public.get_customer_balance(p_store_id,c.id)>0 order by public.get_customer_balance(p_store_id,c.id) desc,c.id limit 3)x;
 end if;
 return result||jsonb_build_object('activity',activity,'credit',credit);
end $$;
revoke all on function public.get_dashboard_transactions(uuid) from public,anon;
grant execute on function public.get_dashboard_transactions(uuid) to authenticated;
commit;
