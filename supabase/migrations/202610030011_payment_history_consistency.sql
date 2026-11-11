begin;
create function private.refresh_sale_status(p_sale uuid) returns void language plpgsql security definer set search_path='' as $$
declare debt numeric; remaining numeric;
begin
 select greatest(0,coalesce(sum(debit-credit),0)) into debt from public.credit_ledger_entries where sale_id=p_sale;
 select total-coalesce((select sum(amount) from public.returns where sale_id=p_sale),0) into remaining from public.sales where id=p_sale;
 update public.sales set status=case when debt<=0 then 'Paid' when debt>=remaining then 'Credit' else 'Partial' end where id=p_sale and status not in ('Voided','Returned');
end $$;
create function private.refresh_ledger_sale() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.sale_id is not null then perform private.refresh_sale_status(new.sale_id); end if;return new;
end $$;
create trigger refresh_sale_payment_status after insert on public.credit_ledger_entries for each row execute function private.refresh_ledger_sale();
create function private.sale_payments(p_sale uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'methodId',p.method_id,'methodName',p.method_name,'methodKind',p.method_kind,'amount',x.applied,
   'reference',p.reference,'proof',p.proof_path,'verified',p.status='Confirmed','status',p.status,'kind',p.kind,'verifiedBy',p.verified_by,'verifiedAt',p.verified_at) order by p.created_at,p.id),'[]')
 from (
   select id,amount applied from public.payments where sale_id=p_sale
   union all select p.id,sum(l.debit+l.credit) applied from public.payments p join public.credit_ledger_entries l on l.payment_id=p.id
     where l.sale_id=p_sale and p.sale_id is null and p.kind in ('collection','reversal') group by p.id
 ) x join public.payments p on p.id=x.id
$$;
-- Keep cost data out of the sale DTO while including allocated old-debt payments.
create or replace function private.sale_json(p_store uuid,p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'invoice',s.invoice,'customerId',coalesce(s.customer_id::text,''),'customerName',s.customer_name,
   'employeeId',s.employee_id,'employeeName',s.employee_name,'createdAt',s.created_at,'subtotal',s.subtotal,'discount',s.discount,
   'couponDiscount',s.coupon_discount,'total',s.total,'coupon',s.coupon_code,'status',s.status,'sourceTestId',s.source_test_id,
   'cashReceived',s.cash_received,'change',s.change_amount,'receipt',s.receipt_snapshot,
   'paid',case when s.status='Voided' then 0 else greatest(0,s.total-coalesce((select sum(r.amount) from public.returns r where r.sale_id=s.id),0)-greatest(0,coalesce((select sum(l.debit-l.credit) from public.credit_ledger_entries l where l.sale_id=s.id),0))) end,
   'outstanding',case when s.status='Voided' then 0 else greatest(0,coalesce((select sum(l.debit-l.credit) from public.credit_ledger_entries l where l.sale_id=s.id),0)) end,
   'lines',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'productId',i.product_id,'name',i.name,'variant',i.variant,'quantity',i.quantity,
     'originalPrice',i.listed_price,'unitPrice',i.unit_price,'minimumPrice',i.minimum_price,'discount',i.discount,'couponDiscount',i.coupon_discount,
     'total',i.total,'locationId',coalesce(i.stock_allocations->0->>'locationId',''),'stockAllocations',i.stock_allocations,'service',i.service,'reason',i.price_reason,
     'approval',case when i.approver_id is not null then jsonb_build_object('managerId',i.approver_id,'managerName',(select full_name from public.profiles where id=i.approver_id),'reason',i.price_reason,'original',i.listed_price,'price',i.unit_price,'employeeId',s.employee_id,'createdAt',s.created_at) end) order by i.id),'[]') from public.sale_items i where i.sale_id=s.id),
   'payments',private.sale_payments(s.id),
   'returned',coalesce((select jsonb_object_agg(product_id,q) from (select i.product_id,sum(r.quantity) q from public.returns r join public.sale_items i on i.id=r.item_id where r.sale_id=s.id group by i.product_id) x),'{}'))
 from public.sales s where s.store_id=p_store and s.id=p_id
$$;
create function private.reversal_after_refund_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='reversal' and exists(select 1 from public.credit_ledger_entries l join public.sales s on s.id=l.sale_id where l.payment_id=new.original_payment_id
   and (s.status in ('Voided','Returned') or exists(select 1 from public.returns where sale_id=s.id))) then
   raise exception 'Collection was allocated to a refunded invoice. Reverse before processing returns or voids.' using errcode='22023';
 end if; return new;
end $$;
create trigger reversal_after_refund_guard before insert on public.payments for each row execute function private.reversal_after_refund_guard();
revoke all on all functions in schema private from public,anon,authenticated;
commit;
