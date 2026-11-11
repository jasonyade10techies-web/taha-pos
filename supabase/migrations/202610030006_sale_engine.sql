begin;
create function private.sale_json(p_store uuid,p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',s.id,'invoice',s.invoice,'customerId',coalesce(s.customer_id::text,''),'customerName',s.customer_name,
    'employeeId',s.employee_id,'employeeName',s.employee_name,'createdAt',s.created_at,'subtotal',s.subtotal,'discount',s.discount,
    'couponDiscount',s.coupon_discount,'total',s.total,'coupon',s.coupon_code,'status',s.status,'sourceTestId',s.source_test_id,
    'cashReceived',s.cash_received,'change',s.change_amount,'receipt',s.receipt_snapshot,
    'paid',(select coalesce(sum(case when p.kind in ('refund','reversal') then -p.amount else p.amount end),0) from public.payments p where p.sale_id=s.id and p.status in ('Confirmed','Reversed')),
    'outstanding',case when s.status='Voided' then 0 else greatest(0,s.credit_amount+(select coalesce(sum(l.debit-l.credit),0) from public.credit_ledger_entries l where l.sale_id=s.id)-s.credit_amount) end,
    'lines',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'productId',i.product_id,'name',i.name,'variant',i.variant,'quantity',i.quantity,
      'originalPrice',i.listed_price,'unitPrice',i.unit_price,'minimumPrice',i.minimum_price,'discount',i.discount,'couponDiscount',i.coupon_discount,
      'total',i.total,'locationId',coalesce(i.stock_allocations->0->>'locationId',''),'stockAllocations',i.stock_allocations,'service',i.service,'reason',i.price_reason) order by i.id),'[]') from public.sale_items i where i.sale_id=s.id),
    'payments',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'methodId',p.method_id,'methodName',p.method_name,'methodKind',p.method_kind,'amount',p.amount,
      'reference',p.reference,'proof',p.proof_path,'verified',p.status='Confirmed','status',p.status,'kind',p.kind,'verifiedBy',p.verified_by,'verifiedAt',p.verified_at) order by p.created_at,p.id),'[]') from public.payments p where p.sale_id=s.id),
    'returned',coalesce((select jsonb_object_agg(product_id,q) from (select i.product_id,sum(r.quantity) q from public.returns r join public.sale_items i on i.id=r.item_id where r.sale_id=s.id group by i.product_id) x),'{}'))
  from public.sales s where s.store_id=p_store and s.id=p_id
$$;
create function private.coupon_discount(p_store uuid,p_code text,p_lines jsonb,p_customer uuid) returns numeric language plpgsql stable security definer set search_path='' as $$
declare c public.coupons; line jsonb; p public.products; eligible_total numeric:=0; headroom numeric:=0; all_total numeric:=0; price numeric; qty integer;
begin
  if coalesce(trim(p_code),'')='' then return 0; end if;
  perform private.require_permission('pricing.discount_within_range',p_store);
  select * into c from public.coupons where store_id=p_store and code=upper(trim(p_code));
  if c.id is null or not c.active or (now() at time zone 'Asia/Karachi')::date not between c.starts_on and c.ends_on then raise exception 'Coupon is inactive or expired' using errcode='22023'; end if;
  if c.max_uses>0 and (select count(*) from public.coupon_redemptions where coupon_id=c.id)>=c.max_uses then raise exception 'Coupon usage limit reached' using errcode='22023'; end if;
  if c.per_customer_limit>0 and (p_customer is null or (select count(*) from public.coupon_redemptions where coupon_id=c.id and customer_id=p_customer)>=c.per_customer_limit) then
    raise exception 'Coupon needs an eligible customer or customer limit reached' using errcode='22023'; end if;
  for line in select * from jsonb_array_elements(p_lines) loop
    select * into p from public.products where id=(line->>'productId')::uuid and store_id=p_store and state='active';
    price:=(line->>'unitPrice')::numeric; qty:=(line->>'quantity')::integer;
    if p.id is null or price<=0 or price>p.selling_price or qty<=0 then raise exception 'Invalid coupon lines' using errcode='22023'; end if;
    all_total:=all_total+price*qty;
    if c.eligible='All' or c.eligible='Products' and p.id::text=any(c.targets) or c.eligible='Categories' and p.category=any(c.targets) or c.eligible='Services' and p.category='Services' then
      eligible_total:=eligible_total+price*qty; headroom:=headroom+greatest(0,price-p.minimum_selling_price)*qty;
    end if;
  end loop;
  if all_total<c.minimum or eligible_total<=0 then raise exception 'Coupon minimum or eligible products not met' using errcode='22023'; end if;
  return least(headroom,round(case when c.type='Percentage' then eligible_total*c.value/100 else c.value end,2));
end $$;
create function public.quote_coupon(p_store_id uuid,p_code text,p_lines jsonb,p_customer_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_permission('sales.create',p_store_id);
  return jsonb_build_object('code',upper(trim(p_code)),'discount',private.coupon_discount(p_store_id,p_code,p_lines,p_customer_id));
end $$;
create function private.record_payment(p_store uuid,p_sale uuid,p_customer uuid,p_input jsonb,p_kind text,p_cart text) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.payment_methods; v_amount numeric:=(p_input->>'amount')::numeric; v_actor uuid:=public.current_profile_id(); approver uuid; v_id uuid:=gen_random_uuid(); proof text:=coalesce(p_input->>'proof','');
begin
  select * into m from public.payment_methods where id=(p_input->>'methodId')::uuid and store_id=p_store and enabled;
  if m.id is null or v_amount<=0 or v_amount<>round(v_amount,2) then raise exception 'Payment method or amount is invalid' using errcode='22023'; end if;
  if m.kind='Digital' then
    if (m.requires_proof or coalesce((private.settings(p_store)->>'requireProof')::boolean,true)) and not private.valid_asset(p_store,proof,'proof') then
      raise exception 'Upload payment proof before confirming a digital payment' using errcode='22023'; end if;
    if not public.has_permission('payments.approve_electronic',p_store) then
      approver:=private.consume_approval(p_store,'payment',jsonb_build_object('cartId',p_cart,'methodId',m.id,'amount',v_amount,'reference',coalesce(p_input->>'reference',''),'proof',proof),p_input->>'approvalToken');
    else
      if coalesce((p_input->>'verified')::boolean,false)=false then raise exception 'Electronic payment must be explicitly verified' using errcode='22023'; end if;
      approver:=v_actor;
    end if;
  else approver:=v_actor; end if;
  if proof<>'' and not private.valid_asset(p_store,proof,'proof') then raise exception 'Invalid proof object' using errcode='22023'; end if;
  insert into public.payments(id,store_id,code,sale_id,customer_id,method_id,amount,kind,status,method_name,method_kind,reference,notes,proof_path,employee_id,verified_by,verified_at)
    values(v_id,p_store,private.next_code('private.payment_number','TM-PAY-'),p_sale,p_customer,m.id,v_amount,p_kind,'Confirmed',m.name,m.kind,
      coalesce(p_input->>'reference',''),coalesce(p_input->>'notes',''),proof,v_actor,approver,now());
  return v_id;
end $$;
create function public.complete_sale(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_profile_id(); req uuid:=(p_input->>'idempotencyKey')::uuid; cached jsonb; settings jsonb; line jsonb; pay jsonb; p public.products; customer public.customers;
  test public.out_for_test; account public.credit_accounts; c public.coupons; sid uuid:=gen_random_uuid(); item uuid; approver uuid; allocations jsonb;
  qty integer; price numeric; subtotal numeric:=0; discount numeric:=0; coupon numeric:=0; coupon_remaining numeric:=0; item_coupon numeric; total numeric:=0;
  paid numeric:=0; credit numeric:=0; cash numeric:=0; received numeric:=coalesce((p_input->>'cashReceived')::numeric,0); balance numeric; needed integer; take integer; b record; result jsonb; code text;
begin
  perform private.require_permission('sales.create',p_store_id); perform private.lock_store(p_store_id);
  cached:=private.cached_request(p_store_id,'sale',req,p_input); if cached is not null then return cached; end if;
  settings:=private.settings(p_store_id);
  if nullif(p_input->>'cartId','')::uuid is null then raise exception 'A cart ID is required' using errcode='22023'; end if;
  if coalesce(jsonb_typeof(p_input->'lines'),'null')<>'array' or jsonb_array_length(p_input->'lines') not between 1 and 100
    or coalesce(jsonb_typeof(p_input->'payments'),'null')<>'array' or jsonb_array_length(p_input->'payments') not between 1 and 8 then raise exception 'Sale needs items and payment allocations' using errcode='22023'; end if;
  if (select count(distinct x->>'productId') from jsonb_array_elements(p_input->'lines') x)<>jsonb_array_length(p_input->'lines') then raise exception 'Duplicate product lines' using errcode='22023'; end if;
  if nullif(p_input->>'customerId','') is not null then
    select * into customer from public.customers where store_id=p_store_id and id=(p_input->>'customerId')::uuid and active;
    if customer.id is null then raise exception 'Select an active customer' using errcode='22023'; end if;
  end if;
  if nullif(p_input->>'sourceTestId','') is not null then
    select * into test from public.out_for_test where store_id=p_store_id and id=(p_input->>'sourceTestId')::uuid for update;
    if test.id is null or test.status<>'OUT' or customer.id is distinct from test.customer_id or not exists(select 1 from jsonb_array_elements(p_input->'lines') x where (x->>'productId')::uuid=test.product_id and (x->>'quantity')::integer=test.quantity) then
      raise exception 'Test reservation no longer matches this sale' using errcode='22023'; end if;
    perform private.require_permission('inventory.transfer',p_store_id); perform private.require_box(p_store_id,test.location_id);
    insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id,notes)
      values(p_store_id,test.product_id,test.location_id,test.quantity,'TEST_RETURN','test_conversion',test.id,actor,'Reservation released inside sale transaction');
  end if;
  -- First pass validates prices before any durable sale effects.
  for line in select * from jsonb_array_elements(p_input->'lines') loop
    select * into p from public.products where id=(line->>'productId')::uuid and store_id=p_store_id and state='active';
    qty:=(line->>'quantity')::integer; price:=(line->>'unitPrice')::numeric;
    if p.id is null or qty not between 1 and 999999 or price is null or price<=0 or price>p.selling_price or price<>round(price,2) then raise exception 'Product, quantity or selling price is invalid' using errcode='22023'; end if;
    if price<p.selling_price then
      perform private.require_permission('pricing.discount_within_range',p_store_id);
      if not coalesce((settings->>'bargaining')::boolean,true) or length(trim(coalesce(line->>'reason','')))=0 then raise exception 'Discount needs bargaining enabled and a reason' using errcode='22023'; end if;
    end if;
    if price<p.minimum_selling_price and settings->>'belowMinimum'='Block' then raise exception 'Below-minimum pricing is blocked' using errcode='22023'; end if;
    subtotal:=subtotal+p.selling_price*qty; discount:=discount+(p.selling_price-price)*qty;
  end loop;
  coupon:=private.coupon_discount(p_store_id,p_input->>'coupon',p_input->'lines',customer.id); coupon_remaining:=coupon;
  if coupon>0 then select cp.* into c from public.coupons cp where cp.store_id=p_store_id and cp.code=upper(trim(p_input->>'coupon')); end if;
  total:=subtotal-discount-coupon;
  for pay in select * from jsonb_array_elements(p_input->'payments') loop
    if (pay->>'amount')::numeric<=0 or (pay->>'amount')::numeric<>round((pay->>'amount')::numeric,2) then raise exception 'Invalid payment allocation' using errcode='22023'; end if;
    if pay->>'methodId'='credit' then credit:=credit+(pay->>'amount')::numeric;
    else
      paid:=paid+(pay->>'amount')::numeric;
      if exists(select 1 from public.payment_methods where store_id=p_store_id and id=(pay->>'methodId')::uuid and kind='Cash' and enabled) then cash:=cash+(pay->>'amount')::numeric; end if;
    end if;
  end loop;
  if paid+credit<>total or received<cash or received<>round(received,2) then raise exception 'Payment allocations must equal the sale total and cash received must cover cash applied' using errcode='22023'; end if;
  if credit>0 then
    perform private.require_permission('credit.create',p_store_id);
    if customer.id is null or not coalesce((settings->>'creditEnabled')::boolean,false) then raise exception 'Credit needs an active customer and enabled credit' using errcode='22023'; end if;
    select * into account from public.credit_accounts where store_id=p_store_id and customer_id=customer.id;
    if account.customer_id is null or not account.enabled then raise exception 'Customer credit is disabled' using errcode='22023'; end if;
    balance:=private.credit_balance(p_store_id,customer.id);
    if account.enforce_limit and account.credit_limit is not null and balance+credit>account.credit_limit then
      perform private.require_permission('credit.override_limit',p_store_id);
      if length(trim(coalesce(p_input->>'creditOverrideReason','')))=0 then raise exception 'Credit limit override needs a reason' using errcode='22023'; end if;
      perform private.write_audit(p_store_id,actor,'credit.limit_overridden','customer',customer.id,jsonb_build_object('previous_balance',balance,'new_credit',credit,'limit',account.credit_limit,'reason',p_input->>'creditOverrideReason'));
    end if;
  end if;
  code:=private.next_code('private.invoice_number','TM-INV-');
  insert into public.sales(id,store_id,invoice,customer_id,customer_name,employee_id,employee_name,subtotal,discount,coupon_discount,total,credit_amount,cash_received,change_amount,coupon_code,status,receipt_snapshot,source_test_id)
    values(sid,p_store_id,code,customer.id,coalesce(customer.name,'Walk-in Customer'),actor,(select full_name from public.profiles where id=actor),subtotal,discount,coupon,total,credit,
      case when cash>0 then received else 0 end,case when cash>0 then received-cash else 0 end,coalesce(c.code,''),case when credit=0 then 'Paid' when paid=0 then 'Credit' else 'Partial' end,
      jsonb_build_object('storeName',settings->>'storeName','branch',settings->>'branch','phone',coalesce(settings->>'phone',''),'address',coalesce(settings->>'address',''),'footer',settings->>'receiptFooter'),test.id);
  for line in select * from jsonb_array_elements(p_input->'lines') loop
    select * into p from public.products where store_id=p_store_id and id=(line->>'productId')::uuid;
    qty:=(line->>'quantity')::integer; price:=(line->>'unitPrice')::numeric; approver:=null; allocations:='[]'; item:=gen_random_uuid(); item_coupon:=0;
    if price<p.minimum_selling_price then
      approver:=private.consume_approval(p_store_id,'price',jsonb_build_object('cartId',p_input->>'cartId','productId',p.id,'price',price,'reason',line->>'reason'),line->'approval'->>'token');
      perform private.write_audit(p_store_id,actor,'pricing.minimum_overridden','sale',sid,jsonb_build_object('product_id',p.id,'listed',p.selling_price,'minimum',p.minimum_selling_price,'approved',price,'seller_id',actor,'approver_id',approver,'reason',line->>'reason'));
    end if;
    if coupon_remaining>0 and (c.eligible='All' or c.eligible='Products' and p.id::text=any(c.targets) or c.eligible='Categories' and p.category=any(c.targets) or c.eligible='Services' and p.category='Services') then
      item_coupon:=least(coupon_remaining,greatest(0,price-p.minimum_selling_price)*qty); coupon_remaining:=coupon_remaining-item_coupon;
    end if;
    if exists(select 1 from public.purchased_devices where product_id=p.id and (status<>'In Stock' or qty<>1)) then raise exception 'Used device is unavailable or quantity is not one' using errcode='22023'; end if;
    if p.category<>'Services' then
      needed:=qty;
      for b in select m.location_id,sum(m.quantity)::integer available from public.stock_movements m join public.locations l on l.id=m.location_id and l.active
        where m.store_id=p_store_id and m.product_id=p.id group by m.location_id having sum(m.quantity)>0 order by m.location_id loop
        perform private.require_box(p_store_id,b.location_id); take:=least(needed,b.available);
        insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id)
          values(p_store_id,p.id,b.location_id,-take,'SALE','sale',sid,actor);
        allocations:=allocations||jsonb_build_array(jsonb_build_object('locationId',b.location_id,'quantity',take)); needed:=needed-take; exit when needed=0;
      end loop;
      if needed>0 then raise exception 'Insufficient stock for %',p.name using errcode='P0001'; end if;
    end if;
    insert into public.sale_items(id,store_id,sale_id,product_id,name,variant,category,quantity,listed_price,minimum_price,unit_price,discount,coupon_discount,total,service,stock_allocations,price_reason,approver_id)
      values(item,p_store_id,sid,p.id,p.name,p.variant,p.category,qty,p.selling_price,p.minimum_selling_price,price,(p.selling_price-price)*qty,item_coupon,qty*price-item_coupon,p.category='Services',allocations,coalesce(line->>'reason',''),approver);
    insert into public.sale_item_financials(item_id,store_id,purchase_cost) values(item,p_store_id,case when p.category='Services' then 0 else (select purchase_cost from public.product_financials where product_id=p.id) end);
    update public.purchased_devices set status='Sold' where product_id=p.id;
  end loop;
  for pay in select * from jsonb_array_elements(p_input->'payments') loop
    if pay->>'methodId'<>'credit' then perform private.record_payment(p_store_id,sid,customer.id,pay,'sale',p_input->>'cartId'); end if;
  end loop;
  if credit>0 then insert into public.credit_ledger_entries(store_id,customer_id,sale_id,reference,description,debit,employee_id) values(p_store_id,customer.id,sid,code,'Credit sale',credit,actor); end if;
  if coupon>0 then insert into public.coupon_redemptions(store_id,coupon_id,sale_id,customer_id) values(p_store_id,c.id,sid,customer.id); end if;
  if test.id is not null then update public.out_for_test set status='CONVERTED TO SALE',sale_id=sid,closed_at=now() where id=test.id; end if;
  perform private.write_audit(p_store_id,actor,'sale.completed','sale',sid,jsonb_build_object('invoice',code,'total',total,'paid',paid,'credit',credit));
  result:=private.sale_json(p_store_id,sid); perform private.save_request(p_store_id,'sale',req,p_input,result); return result;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.complete_sale(uuid,jsonb),public.quote_coupon(uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.complete_sale(uuid,jsonb),public.quote_coupon(uuid,text,jsonb,uuid) to authenticated;
commit;
