begin;
create function private.customer_json(p_store uuid,p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'name',c.name,'type',c.type,'shopName',c.shop_name,'ownerName',c.owner_name,'collectingPerson',c.collecting_person,'phone',c.phone,
   'address',c.address,'notes',c.notes,'photo',c.photo_path,'createdAt',c.created_at,
   'creditLimit',case when public.has_permission('credit.create',p_store) or public.has_permission('credit.receive_payment',p_store) then a.credit_limit else null end,
   'creditEnabled',a.enabled,'enforceCreditLimit',a.enforce_limit)
 from public.customers c left join public.credit_accounts a on a.customer_id=c.id where c.store_id=p_store and c.id=p_id
$$;
create function public.get_customer_balance(p_store_id uuid,p_customer_id uuid) returns numeric language plpgsql stable security definer set search_path='' as $$
begin
 if not (public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then raise exception 'Credit permission required' using errcode='42501'; end if;
 return private.credit_balance(p_store_id,p_customer_id);
end $$;
create function public.get_sale(p_store_id uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_permission('sales.view',p_store_id) and not public.has_permission('returns.create',p_store_id) and not (public.has_permission('sales.create',p_store_id) and exists(select 1 from public.sales where store_id=p_store_id and id=p_id and employee_id=public.current_profile_id())) then raise exception 'Access denied' using errcode='42501'; end if;
 return private.sale_json(p_store_id,p_id);
end $$;
create function public.list_sales(p_store_id uuid,p_filter jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_limit integer:=least(100,greatest(1,coalesce((p_filter->>'limit')::integer,25))); v_page integer:=greatest(0,coalesce((p_filter->>'page')::integer,0)); result jsonb;
begin
 if not (public.has_permission('sales.view',p_store_id) or public.has_permission('returns.create',p_store_id)) then raise exception 'Sales permission required' using errcode='42501'; end if;
 with filtered as (select s.* from public.sales s where s.store_id=p_store_id
   and (coalesce(p_filter->>'search','')='' or s.invoice ilike '%'||(p_filter->>'search')||'%' or s.customer_name ilike '%'||(p_filter->>'search')||'%' or exists(select 1 from public.sale_items i where i.sale_id=s.id and i.name ilike '%'||(p_filter->>'search')||'%'))
   and (coalesce(p_filter->>'employee','') in ('','All Employees') or s.employee_id::text=p_filter->>'employee')
   and (coalesce(p_filter->>'customer','')='' or s.customer_id::text=p_filter->>'customer')
   and (coalesce(p_filter->>'status','') in ('','All Statuses') or s.status=p_filter->>'status')
   and (coalesce(p_filter->>'from','')='' or (s.created_at at time zone 'Asia/Karachi')::date>=(p_filter->>'from')::date)
   and (coalesce(p_filter->>'to','')='' or (s.created_at at time zone 'Asia/Karachi')::date<=(p_filter->>'to')::date)
   and (coalesce(p_filter->>'method','') in ('','All Methods') or p_filter->>'method'='credit' and s.credit_amount>0
     or exists(select 1 from public.payments p where p.sale_id=s.id and p.method_id::text=p_filter->>'method'))),
 paged as (select id,created_at from filtered order by created_at desc,id desc limit v_limit offset v_page*v_limit)
 select jsonb_build_object('total',(select count(*) from filtered),'page',v_page,'limit',v_limit,
   'rows',coalesce((select jsonb_agg(private.sale_json(p_store_id,id) order by created_at desc,id desc) from paged),'[]')) into result;
 return result;
end $$;
create function public.transaction_data(p_store_id uuid,p_kind text,p_filter jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; v_limit integer:=least(250,greatest(1,coalesce((p_filter->>'limit')::integer,100))); v_offset integer:=greatest(0,coalesce((p_filter->>'page')::integer,0))*v_limit;
begin
 if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501'; end if;
 case p_kind
 when 'customers' then
   if not (public.has_permission('sales.create',p_store_id) or public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id) or public.has_permission('inventory.transfer',p_store_id)) then raise exception 'Customer access denied' using errcode='42501'; end if;
   select coalesce(jsonb_agg(private.customer_json(p_store_id,id)),'[]') into result from (select id from public.customers where store_id=p_store_id and active and (coalesce(p_filter->>'id','')='' or id::text=p_filter->>'id') order by name,id limit v_limit offset v_offset) q;
 when 'methods' then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'subtype',subtype,'title',account_title,'number',account_number,'iban',iban,'qr',qr_path,'enabled',enabled,'requiresProof',requires_proof,'sortOrder',sort_order) order by sort_order,name),'[]') into result from public.payment_methods where store_id=p_store_id;
   result:=result||jsonb_build_array(jsonb_build_object('id','credit','name','Credit','kind','Credit','title','','number','','iban','','qr','','enabled',coalesce((private.settings(p_store_id)->>'creditEnabled')::boolean,false)));
 when 'coupons' then
   perform private.require_permission('settings.manage',p_store_id);
   select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'type',c.type,'value',c.value,'start',c.starts_on,'end',c.ends_on,'minimum',c.minimum,'maxUses',c.max_uses,
     'perCustomerLimit',c.per_customer_limit,'eligible',c.eligible,'targets',c.targets,'active',c.active,'uses',(select count(*) from public.coupon_redemptions where coupon_id=c.id))),'[]') into result from public.coupons c where store_id=p_store_id;
 when 'ledger' then
   if not (public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then raise exception 'Credit permission required' using errcode='42501'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'customerId',customer_id,'reference',reference,'description',description,'debit',debit,'credit',credit,'employeeId',employee_id,'createdAt',created_at) order by created_at desc,id),'[]') into result
     from (select * from public.credit_ledger_entries where store_id=p_store_id and (coalesce(p_filter->>'customerId','')='' or customer_id::text=p_filter->>'customerId') order by created_at desc,id desc limit v_limit offset v_offset) q;
 when 'tests' then
   perform private.require_permission('inventory.transfer',p_store_id);
   select coalesce(jsonb_agg(private.test_json(id) order by created_at desc),'[]') into result from (select * from public.out_for_test where store_id=p_store_id order by created_at desc limit v_limit offset v_offset) q;
 when 'returns' then
   if not (public.has_permission('returns.create',p_store_id) or public.has_permission('sales.view',p_store_id) or public.has_permission('reports.view',p_store_id)) then raise exception 'Returns permission required' using errcode='42501'; end if;
   select coalesce(jsonb_agg(private.return_json(id) order by created_at desc),'[]') into result from (select * from public.returns where store_id=p_store_id order by created_at desc limit v_limit offset v_offset) q;
 when 'payments' then
   if not (public.has_permission('payments.approve_electronic',p_store_id) or public.has_permission('payments.reverse',p_store_id) or public.has_permission('reports.view',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then raise exception 'Payment permission required' using errcode='42501'; end if;
   select coalesce(jsonb_agg(private.payment_json(id) order by created_at desc),'[]') into result from (select * from public.payments where store_id=p_store_id order by created_at desc limit v_limit offset v_offset) q;
 else raise exception 'Unknown dataset' using errcode='22023';
 end case;
 return result;
end $$;
create function private.period_profit(p_store uuid,p_from date,p_to date) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce((select sum(i.total-i.quantity*f.purchase_cost) from public.sale_items i join public.sales s on s.id=i.sale_id join public.sale_item_financials f on f.item_id=i.id
   where s.store_id=p_store and (s.created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0)
 -coalesce((select sum(r.amount-case when r.destination='Sellable Stock' then r.quantity*f.purchase_cost else 0 end) from public.returns r join public.sale_item_financials f on f.item_id=r.item_id
   where r.store_id=p_store and (r.created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0)
 -coalesce((select sum(i.total-i.quantity*f.purchase_cost) from public.sale_items i join public.sales s on s.id=i.sale_id join public.sale_item_financials f on f.item_id=i.id
   where s.store_id=p_store and (s.voided_at at time zone 'Asia/Karachi')::date between p_from and p_to),0)
$$;
create or replace function public.get_profit_summary(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_permission('profit.view',p_store_id);
 return jsonb_build_object('available',true,'gross_profit',private.period_profit(p_store_id,(now() at time zone 'Asia/Karachi')::date,(now() at time zone 'Asia/Karachi')::date));
end $$;
create function private.period_summary(p_store uuid,p_from date,p_to date) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
   'sales',coalesce((select sum(total) from public.sales where store_id=p_store and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0)
     -coalesce((select sum(total) from public.sales where store_id=p_store and (voided_at at time zone 'Asia/Karachi')::date between p_from and p_to),0),
   'transactions',(select count(*) from public.sales where store_id=p_store and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),
   'returns',coalesce((select sum(amount) from public.returns where store_id=p_store and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0),
   'discounts',coalesce((select sum(discount+coupon_discount) from public.sales where store_id=p_store and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0),
   'creditGiven',coalesce((select sum(credit_amount) from public.sales where store_id=p_store and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0),
   'debtCollected',coalesce((select sum(case when kind='collection' then amount when kind='reversal' and original_payment_id in (select id from public.payments where kind='collection') then -amount else 0 end) from public.payments
     where store_id=p_store and status in ('Confirmed','Reversed') and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0),
   'cash',coalesce((select sum(case when kind in ('refund','reversal') then -amount else amount end) from public.payments where store_id=p_store and method_kind='Cash' and status in ('Confirmed','Reversed') and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0),
   'digital',coalesce((select sum(case when kind in ('refund','reversal') then -amount else amount end) from public.payments where store_id=p_store and method_kind='Digital' and status in ('Confirmed','Reversed') and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0))
$$;
create function public.get_transaction_report(p_store_id uuid,p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare summary jsonb; profit numeric; chart jsonb; methods jsonb; top_products jsonb; employees jsonb; credit jsonb;
begin
 perform private.require_permission('reports.view',p_store_id);
 if p_from>p_to or p_to-p_from>366 then raise exception 'Choose a date range of at most one year' using errcode='22023'; end if;
 summary:=private.period_summary(p_store_id,p_from,p_to);
 if public.has_permission('profit.view',p_store_id) then profit:=private.period_profit(p_store_id,p_from,p_to); end if;
 select coalesce(jsonb_agg(jsonb_build_object('day',to_char(d,'Dy'),'date',d,'sales',(private.period_summary(p_store_id,d::date,d::date)->>'sales')::numeric-(private.period_summary(p_store_id,d::date,d::date)->>'returns')::numeric,
   'profit',case when public.has_permission('profit.view',p_store_id) then private.period_profit(p_store_id,d::date,d::date) end) order by d),'[]') into chart from generate_series(greatest(p_from,p_to-6)::timestamp,p_to::timestamp,interval '1 day') d;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'total',total)),'[]') into methods from (
   select m.id,m.name,coalesce(sum(case when p.kind in ('refund','reversal') then -p.amount else p.amount end),0) total from public.payment_methods m left join public.payments p
     on p.method_id=m.id and p.status in ('Confirmed','Reversed') and (p.created_at at time zone 'Asia/Karachi')::date between p_from and p_to where m.store_id=p_store_id group by m.id) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into top_products from (
   select i.product_id id,max(i.name) name,sum(i.quantity-coalesce(r.qty,0)) quantity,sum(i.total-coalesce(r.amount,0)) total from public.sale_items i join public.sales s on s.id=i.sale_id
     left join lateral(select sum(quantity) qty,sum(amount) amount from public.returns where item_id=i.id) r on true
     where s.store_id=p_store_id and s.status<>'Voided' and (s.created_at at time zone 'Asia/Karachi')::date between p_from and p_to group by i.product_id order by total desc limit 25) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into employees from (
   select s.employee_id id,max(s.employee_name) name,count(*) transactions,sum(s.total) sales,avg(s.total) average,
     coalesce((select sum(amount) from public.payments where store_id=p_store_id and employee_id=s.employee_id and kind='collection' and (created_at at time zone 'Asia/Karachi')::date between p_from and p_to),0) collections,
     count(*) filter(where s.status='Voided') voids from public.sales s where s.store_id=p_store_id and (s.created_at at time zone 'Asia/Karachi')::date between p_from and p_to group by s.employee_id) q;
 if public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id) then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'balance',private.credit_balance(p_store_id,id))),'[]') into credit from public.customers where store_id=p_store_id;
 else credit:='[]'; end if;
 return jsonb_build_object('summary',summary,'profit',profit,'chart',chart,'methods',methods,'top',top_products,'employees',employees,'credit',credit,
   'recentSales',case when public.has_permission('sales.view',p_store_id) then public.list_sales(p_store_id,jsonb_build_object('from',p_from,'to',p_to,'limit',25))->'rows' else '[]'::jsonb end);
end $$;
create function public.get_dashboard_transactions(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare summary jsonb; profit numeric; chart jsonb:='[]'; activity jsonb:='[]'; credit jsonb:='[]'; today date:=(now() at time zone 'Asia/Karachi')::date;
begin
 if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if public.has_permission('sales.view',p_store_id) or public.has_permission('reports.view',p_store_id) then
   summary:=private.period_summary(p_store_id,today,today);
   select coalesce(jsonb_agg(jsonb_build_object('day',to_char(d,'Dy'),'sales',(private.period_summary(p_store_id,d::date,d::date)->>'sales')::numeric-(private.period_summary(p_store_id,d::date,d::date)->>'returns')::numeric,
     'profit',case when public.has_permission('profit.view',p_store_id) then private.period_profit(p_store_id,d::date,d::date) end) order by d),'[]') into chart from generate_series((today-6)::timestamp,today::timestamp,interval '1 day') d;
 end if;
 if public.has_permission('profit.view',p_store_id) then profit:=private.period_profit(p_store_id,today,today); end if;
 if public.has_permission('audit.view',p_store_id) then
   select coalesce(jsonb_agg(jsonb_build_object('id',n,'type','sale','text',action,'amount',metadata->'total','time',to_char(created_at at time zone 'Asia/Karachi','HH24:MI')) order by created_at desc),'[]') into activity from
     (select *,row_number() over(order by created_at desc) n from public.audit_logs where store_id=p_store_id order by created_at desc limit 5) q;
 end if;
 if public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id) then
   select coalesce(jsonb_agg(jsonb_build_object('name',name,'initials',upper(left(name,2)),'amount',balance,'due','Outstanding credit','overdue',false)),'[]') into credit
     from (select name,private.credit_balance(p_store_id,id) balance from public.customers where store_id=p_store_id and private.credit_balance(p_store_id,id)>0 order by balance desc limit 3) q;
 end if;
 return jsonb_build_object('summary',summary,'profit',profit,'chart',chart,'activity',activity,'credit',credit);
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.get_customer_balance(uuid,uuid),public.get_sale(uuid,uuid),public.list_sales(uuid,jsonb),public.transaction_data(uuid,text,jsonb),public.get_transaction_report(uuid,date,date),public.get_dashboard_transactions(uuid) from public,anon;
grant execute on function public.get_customer_balance(uuid,uuid),public.get_sale(uuid,uuid),public.list_sales(uuid,jsonb),public.transaction_data(uuid,text,jsonb),public.get_transaction_report(uuid,date,date),public.get_dashboard_transactions(uuid) to authenticated;
commit;
