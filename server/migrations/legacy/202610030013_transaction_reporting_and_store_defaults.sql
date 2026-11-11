begin;

-- Every branch gets its own transaction defaults.  Reads must never fall back to
-- another branch's settings, even while a new branch is being provisioned.
create or replace function private.settings(p_store uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
  select settings into v from public.business_settings where store_id=p_store;
  return coalesce(v,'{"id":"main","currency":"PKR","timezone":"Asia/Karachi","receiptPrinting":"Ask After Checkout","customerDisplay":true,"requireProof":true,"bargaining":true,"belowMinimum":"Manager Approval","lowStockAlerts":true,"negativeStock":false,"defaultUnit":"Piece","receiptRequired":true,"returnDays":7,"returnApproval":true,"restoreReturns":true,"notifications":true,"receiptFooter":"Thank you for shopping at Taha Mobiles.","creditEnabled":true}'::jsonb)
    || coalesce((select jsonb_build_object('storeName',name,'branch',branch_name) from public.stores where id=p_store),'{}'::jsonb);
end $$;

create or replace function private.seed_store_transaction_defaults() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.business_settings(store_id) values(new.id) on conflict do nothing;
  insert into public.payment_methods(store_id,name,kind,subtype)
    values(new.id,'Cash','Cash','Cash') on conflict do nothing;
  return new;
end $$;
drop trigger if exists seed_store_transaction_defaults on public.stores;
create trigger seed_store_transaction_defaults after insert on public.stores
  for each row execute function private.seed_store_transaction_defaults();

create or replace function public.save_business_settings(p_store_id uuid,p_input jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_permission('settings.manage',p_store_id);
  if coalesce(p_input->>'receiptPrinting','') not in ('Always Print','Ask After Checkout','Never Auto Print')
    or coalesce(p_input->>'belowMinimum','') not in ('Manager Approval','Block')
    or coalesce((p_input->>'returnDays')::integer,-1) not between 0 and 365
    or coalesce((p_input->>'negativeStock')::boolean,true)
    or coalesce(p_input->>'currency','')<>'PKR' or coalesce(p_input->>'timezone','')<>'Asia/Karachi'
    or exists(select 1 from unnest(array['requireProof','bargaining','creditEnabled','receiptRequired','returnApproval','restoreReturns','negativeStock']) k
      where coalesce(jsonb_typeof(p_input->k),'null')<>'boolean') then
    raise exception 'Invalid settings. Live stock cannot be negative; minimum overrides require approval.' using errcode='22023';
  end if;
  insert into public.business_settings(store_id,settings) values(p_store_id,p_input-'storeName'-'branch')
    on conflict(store_id) do update set settings=excluded.settings,updated_at=now();
  update public.stores set
    name=coalesce(nullif(trim(p_input->>'storeName'),''),name),
    branch_name=coalesce(nullif(trim(p_input->>'branch'),''),branch_name)
    where id=p_store_id;
  perform private.write_audit(p_store_id,public.current_profile_id(),'settings.updated','store',p_store_id);
end $$;

-- Employee reporting fields are calculated server-side from transaction rows and
-- shifts.  No product cost, margin, or other protected financial snapshot is
-- included in this response.
create function public.get_employee_report(p_store_id uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_permission('reports.view',p_store_id);
  if p_from>p_to or p_to-p_from>366 then raise exception 'Choose a date range of at most one year' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',x.id,'name',x.name,'transactions',x.transactions,'sales',x.sales,'average',x.average,
    'full',x.full_lines,'discounted',x.discounted_lines,'averageDiscount',x.average_discount,
    'overrides',x.overrides,'collections',x.collections,'returns',x.returns,'voids',x.voids,
    'cashDifference',x.cash_difference) order by x.name,x.id)
    from (
      select s.employee_id id,max(s.employee_name) name,
        count(*) filter(where s.status<>'Voided')::integer transactions,
        coalesce(sum(s.total) filter(where s.status<>'Voided'),0) sales,
        coalesce(avg(s.total) filter(where s.status<>'Voided'),0) average,
        coalesce((select count(*) from public.sale_items i where i.sale_id in
          (select ss.id from public.sales ss where ss.store_id=p_store_id and ss.employee_id=s.employee_id
            and (ss.created_at at time zone 'Asia/Karachi')::date between p_from and p_to)
          and i.discount=0 and i.coupon_discount=0 and i.unit_price=i.listed_price),0)::integer full_lines,
        coalesce((select count(*) from public.sale_items i where i.sale_id in
          (select ss.id from public.sales ss where ss.store_id=p_store_id and ss.employee_id=s.employee_id
            and (ss.created_at at time zone 'Asia/Karachi')::date between p_from and p_to)
          and (i.discount>0 or i.coupon_discount>0)),0)::integer discounted_lines,
        coalesce((select avg(i.discount+i.coupon_discount) from public.sale_items i where i.sale_id in
          (select ss.id from public.sales ss where ss.store_id=p_store_id and ss.employee_id=s.employee_id
            and (ss.created_at at time zone 'Asia/Karachi')::date between p_from and p_to)),0) average_discount,
        coalesce((select count(*) from public.sale_items i where i.approver_id is not null and i.sale_id in
          (select ss.id from public.sales ss where ss.store_id=p_store_id and ss.employee_id=s.employee_id
            and (ss.created_at at time zone 'Asia/Karachi')::date between p_from and p_to)),0)::integer overrides,
        coalesce((select sum(p.amount) from public.payments p where p.store_id=p_store_id and p.employee_id=s.employee_id
          and p.kind='collection' and p.status in ('Confirmed','Reversed') and (p.created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0) collections,
        coalesce((select count(*) from public.returns r where r.store_id=p_store_id and r.employee_id=s.employee_id
          and (r.created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0)::integer returns,
        count(*) filter(where s.status='Voided')::integer voids,
        coalesce((select sum(sh.cash_difference) from public.shifts sh where sh.store_id=p_store_id and sh.employee_id=s.employee_id
          and sh.status='closed' and (coalesce(sh.actual_start,sh.created_at) at time zone 'Asia/Karachi')::date between p_from and p_to),0) cash_difference
      from public.sales s where s.store_id=p_store_id and (s.created_at at time zone 'Asia/Karachi')::date between p_from and p_to
      group by s.employee_id
    ) x),'[]'::jsonb);
end $$;

revoke all on function public.get_employee_report(uuid,date,date) from public,anon;
grant execute on function public.get_employee_report(uuid,date,date) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;
