begin;
create function private.payment_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'code',code,'saleId',coalesce(sale_id::text,''),'customerId',coalesce(customer_id::text,''),'methodId',method_id,'amount',amount,
   'kind',kind,'status',status,'methodName',method_name,'reference',reference,'notes',notes,'employeeId',employee_id,'createdAt',created_at,'proof',proof_path,'verifiedBy',verified_by,'verifiedAt',verified_at)
 from public.payments where id=p_id
$$;
create function private.test_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'code',code,'customerId',customer_id,'productId',product_id,'locationId',location_id,'quantity',quantity,'takenDate',taken_date,
   'dueDate',due_date,'employeeId',employee_id,'notes',notes,'status',status,'saleId',sale_id) from public.out_for_test where id=p_id
$$;
create function private.return_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'code',r.code,'saleId',r.sale_id,'productId',i.product_id,'quantity',r.quantity,'reason',r.reason,'destination',r.destination,
   'amount',r.amount,'employeeId',r.employee_id,'createdAt',r.created_at,'locationId',r.location_id,'creditReduction',r.credit_reduction,'manualRefund',r.manual_refund)
 from public.returns r join public.sale_items i on i.id=r.item_id where r.id=p_id
$$;
create function public.receive_credit_payment(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p_input->>'idempotencyKey')::uuid; customer uuid:=(p_input->>'customerId')::uuid; amount numeric:=(p_input->>'amount')::numeric;
  cached jsonb; pid uuid; remaining numeric; applied numeric; debt record;
begin
  perform private.require_permission('credit.receive_payment',p_store_id); perform private.lock_store(p_store_id);
  cached:=private.cached_request(p_store_id,'collection',req,p_input); if cached is not null then return cached; end if;
  if amount<=0 or amount>private.credit_balance(p_store_id,customer) or not exists(select 1 from public.credit_accounts where store_id=p_store_id and customer_id=customer) then
    raise exception 'Collection must be positive and no more than outstanding debt' using errcode='22023'; end if;
  pid:=private.record_payment(p_store_id,null,customer,p_input,'collection',p_input->>'cartId'); remaining:=amount;
  for debt in select s.id,s.invoice,sum(l.debit-l.credit) balance from public.sales s join public.credit_ledger_entries l on l.sale_id=s.id
    where s.store_id=p_store_id and s.customer_id=customer and s.status<>'Voided' group by s.id having sum(l.debit-l.credit)>0 order by s.created_at,s.id loop
    applied:=least(remaining,debt.balance);
    insert into public.credit_ledger_entries(store_id,customer_id,sale_id,payment_id,reference,description,credit,employee_id)
      values(p_store_id,customer,debt.id,pid,(select code from public.payments where id=pid),'Debt collection',applied,public.current_profile_id());
    remaining:=remaining-applied; exit when remaining=0;
  end loop;
  if remaining>0 then insert into public.credit_ledger_entries(store_id,customer_id,payment_id,reference,description,credit,employee_id)
    values(p_store_id,customer,pid,(select code from public.payments where id=pid),'Debt collection',remaining,public.current_profile_id()); end if;
  cached:=private.payment_json(pid); perform private.save_request(p_store_id,'collection',req,p_input,cached);
  perform private.write_audit(p_store_id,public.current_profile_id(),'credit.collected','payment',pid,jsonb_build_object('amount',amount,'customer_id',customer)); return cached;
end $$;
create function public.reverse_payment(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p_input->>'idempotencyKey')::uuid; cached jsonb; p public.payments; rid uuid:=gen_random_uuid(); l public.credit_ledger_entries;
begin
  perform private.require_permission('payments.reverse',p_store_id); perform private.lock_store(p_store_id);
  cached:=private.cached_request(p_store_id,'payment_reversal',req,p_input); if cached is not null then return cached; end if;
  select * into p from public.payments where store_id=p_store_id and id=(p_input->>'paymentId')::uuid for update;
  if p.id is null or p.status<>'Confirmed' or p.kind not in ('sale','collection') or length(trim(coalesce(p_input->>'reason','')))=0 then raise exception 'Only a confirmed, unreversed payment with a reason can be reversed' using errcode='22023'; end if;
  if p.sale_id is not null and (exists(select 1 from public.sales where id=p.sale_id and status in ('Voided','Returned')) or exists(select 1 from public.returns where sale_id=p.sale_id)) then raise exception 'Sale already reversed or returned' using errcode='22023'; end if;
  if p.kind='sale' and p.customer_id is null then raise exception 'A walk-in payment must be refunded through sale void or return' using errcode='22023'; end if;
  insert into public.payments(id,store_id,code,sale_id,customer_id,method_id,amount,kind,status,method_name,method_kind,reference,notes,employee_id,original_payment_id,verified_by,verified_at)
    values(rid,p_store_id,private.next_code('private.payment_number','TM-PAY-'),p.sale_id,p.customer_id,p.method_id,p.amount,'reversal','Confirmed',p.method_name,p.method_kind,p.code,p_input->>'reason',public.current_profile_id(),p.id,public.current_profile_id(),now());
  update public.payments set status='Reversed' where id=p.id;
  if p.kind='sale' then
    insert into public.credit_ledger_entries(store_id,customer_id,sale_id,payment_id,reference,description,debit,employee_id)
      values(p_store_id,p.customer_id,p.sale_id,rid,p.code,'Payment reversed; amount outstanding',p.amount,public.current_profile_id());
  else
    for l in select * from public.credit_ledger_entries where payment_id=p.id loop
      insert into public.credit_ledger_entries(store_id,customer_id,sale_id,payment_id,reference,description,debit,employee_id)
        values(p_store_id,p.customer_id,l.sale_id,rid,p.code,'Debt collection reversed',l.credit,public.current_profile_id());
    end loop;
  end if;
  cached:=private.payment_json(rid); perform private.save_request(p_store_id,'payment_reversal',req,p_input,cached);
  perform private.write_audit(p_store_id,public.current_profile_id(),'payment.reversed','payment',p.id,jsonb_build_object('reversal_id',rid,'amount',p.amount,'reason',p_input->>'reason')); return cached;
end $$;
create function private.manual_refund(p_store uuid,p_sale uuid,p_customer uuid,p_amount numeric,p_reason text,p_method uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare m public.payment_methods;
begin
  if p_amount<=0 then return; end if;
  select * into m from public.payment_methods where store_id=p_store and enabled and (id=p_method or p_method is null and kind='Cash') order by sort_order,id limit 1;
  if m.id is null then raise exception 'Select an enabled manual refund method' using errcode='22023'; end if;
  insert into public.payments(store_id,code,sale_id,customer_id,method_id,amount,kind,status,method_name,method_kind,notes,employee_id,verified_by,verified_at)
    values(p_store,private.next_code('private.payment_number','TM-PAY-'),p_sale,p_customer,m.id,p_amount,'refund','Confirmed',m.name,m.kind,'MANUAL REFUND: '||p_reason,public.current_profile_id(),public.current_profile_id(),now());
end $$;
create function public.return_sale_item(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p_input->>'idempotencyKey')::uuid; cached jsonb; s public.sales; i public.sale_items; qty integer:=(p_input->>'quantity')::integer;
  dest text:=p_input->>'destination'; settings jsonb; previous integer; amount numeric; credit numeric; debt numeric; rid uuid:=gen_random_uuid(); approver uuid; box uuid;
begin
  perform private.require_permission('returns.create',p_store_id); perform private.lock_store(p_store_id);
  cached:=private.cached_request(p_store_id,'return',req,p_input); if cached is not null then return cached; end if;
  select * into s from public.sales where store_id=p_store_id and id=(p_input->>'saleId')::uuid for update;
  select * into i from public.sale_items where sale_id=s.id and product_id=(p_input->>'productId')::uuid;
  settings:=private.settings(p_store_id);
  select coalesce(sum(quantity),0) into previous from public.returns where item_id=i.id;
  if s.id is null or i.id is null or s.status='Voided' or qty<=0 or previous+qty>i.quantity or dest not in ('Sellable Stock','Damaged','Do Not Restore Stock') or length(trim(coalesce(p_input->>'reason','')))=0 then raise exception 'Return item, remaining quantity, disposition or reason is invalid' using errcode='22023'; end if;
  if (settings->>'receiptRequired')::boolean and not coalesce((p_input->>'receiptConfirmed')::boolean,false) then raise exception 'Confirm the original receipt' using errcode='22023'; end if;
  if now()>s.created_at+make_interval(days=>(settings->>'returnDays')::integer) then raise exception 'Return window expired' using errcode='22023'; end if;
  if (settings->>'returnApproval')::boolean then
    if public.has_permission('returns.approve',p_store_id) then approver:=public.current_profile_id();
    else approver:=private.consume_approval(p_store_id,'return',p_input-'idempotencyKey'-'approvalToken',p_input->>'approvalToken'); end if;
  end if;
  if dest='Sellable Stock' and not i.service then
    if not (settings->>'restoreReturns')::boolean then raise exception 'Restoring sellable returns is disabled' using errcode='22023'; end if;
    box:=nullif(p_input->>'locationId','')::uuid; perform private.require_box(p_store_id,box);
    insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id)
      values(p_store_id,i.product_id,box,qty,'RETURN','return',rid,public.current_profile_id());
  end if;
  -- A damaged return is held in the return record; it never increases sellable balance.
  amount:=case when previous+qty=i.quantity then i.total-coalesce((select sum(r.amount) from public.returns r where r.item_id=i.id),0) else round(i.total*qty/i.quantity,2) end;
  select coalesce(sum(l.debit-l.credit),0) into debt from public.credit_ledger_entries l where l.sale_id=s.id;
  credit:=least(amount,greatest(0,debt));
  if amount-credit>0 and not coalesce((p_input->>'manualRefundConfirmed')::boolean,false) then raise exception 'Confirm that the manual refund was paid; no gateway refund is automatic' using errcode='22023'; end if;
  insert into public.returns(id,store_id,code,sale_id,item_id,quantity,reason,destination,location_id,amount,credit_reduction,manual_refund,employee_id,approver_id)
    values(rid,p_store_id,private.next_code('private.return_number','TM-RET-'),s.id,i.id,qty,p_input->>'reason',dest,box,amount,credit,amount-credit,public.current_profile_id(),approver);
  if credit>0 then insert into public.credit_ledger_entries(store_id,customer_id,sale_id,reference,description,credit,employee_id)
    values(p_store_id,s.customer_id,s.id,s.invoice,'Return credit reduction',credit,public.current_profile_id()); end if;
  perform private.manual_refund(p_store_id,s.id,s.customer_id,amount-credit,p_input->>'reason',nullif(p_input->>'refundMethodId','')::uuid);
  if not exists(select 1 from public.sale_items si where si.sale_id=s.id and si.quantity>coalesce((select sum(r.quantity) from public.returns r where r.item_id=si.id),0)) then update public.sales set status='Returned' where id=s.id; end if;
  update public.purchased_devices set status=case when dest='Sellable Stock' then 'In Stock' else 'Repair Needed' end where product_id=i.product_id;
  cached:=private.return_json(rid); perform private.save_request(p_store_id,'return',req,p_input,cached);
  perform private.write_audit(p_store_id,public.current_profile_id(),'sale.returned','return',rid,jsonb_build_object('sale_id',s.id,'quantity',qty,'disposition',dest,'amount',amount,'credit_reduction',credit,'manual_refund',amount-credit)); return cached;
end $$;
create function public.void_sale(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p_input->>'idempotencyKey')::uuid; cached jsonb; s public.sales; i public.sale_items; allocation jsonb; debt numeric; refund numeric;
begin
  perform private.require_permission('sales.void',p_store_id); perform private.lock_store(p_store_id);
  cached:=private.cached_request(p_store_id,'void',req,p_input); if cached is not null then return cached; end if;
  select * into s from public.sales where store_id=p_store_id and id=(p_input->>'saleId')::uuid for update;
  if s.id is null or s.status in ('Voided','Returned') or exists(select 1 from public.returns where sale_id=s.id) or length(trim(coalesce(p_input->>'reason','')))=0 then raise exception 'Only an unreturned sale can be voided with a reason' using errcode='22023'; end if;
  select greatest(0,coalesce(sum(debit-credit),0)) into debt from public.credit_ledger_entries where sale_id=s.id;
  refund:=s.total-debt;
  if refund>0 and not coalesce((p_input->>'manualRefundConfirmed')::boolean,false) then raise exception 'Confirm the manual refund before voiding' using errcode='22023'; end if;
  for i in select * from public.sale_items where sale_id=s.id loop
    for allocation in select * from jsonb_array_elements(i.stock_allocations) loop
      perform private.require_box(p_store_id,(allocation->>'locationId')::uuid);
      insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id,notes)
        values(p_store_id,i.product_id,(allocation->>'locationId')::uuid,(allocation->>'quantity')::integer,'RETURN','sale_void',s.id,public.current_profile_id(),p_input->>'reason');
    end loop;
    update public.purchased_devices set status='In Stock' where product_id=i.product_id;
  end loop;
  if debt>0 then insert into public.credit_ledger_entries(store_id,customer_id,sale_id,reference,description,credit,employee_id)
    values(p_store_id,s.customer_id,s.id,s.invoice,'Sale void credit reversal',debt,public.current_profile_id()); end if;
  perform private.manual_refund(p_store_id,s.id,s.customer_id,refund,p_input->>'reason',nullif(p_input->>'refundMethodId','')::uuid);
  update public.sales set status='Voided',voided_at=now() where id=s.id;
  cached:=private.sale_json(p_store_id,s.id); perform private.save_request(p_store_id,'void',req,p_input,cached);
  perform private.write_audit(p_store_id,public.current_profile_id(),'sale.voided','sale',s.id,jsonb_build_object('reason',p_input->>'reason','manual_refund',refund,'credit_reversal',debt)); return cached;
end $$;
create function public.save_test_out(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p_input->>'idempotencyKey')::uuid; cached jsonb; tid uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid()); qty integer:=(p_input->>'quantity')::integer;
  product uuid:=(p_input->>'productId')::uuid; box uuid:=(p_input->>'locationId')::uuid;
begin
  perform private.require_permission('inventory.transfer',p_store_id); perform private.lock_store(p_store_id);
  cached:=private.cached_request(p_store_id,'test_out',req,p_input); if cached is not null then return cached; end if;
  perform private.require_box(p_store_id,box);
  if qty<=0 or not exists(select 1 from public.products where id=product and store_id=p_store_id and state='active' and category<>'Services')
    or not exists(select 1 from public.customers where store_id=p_store_id and id=(p_input->>'customerId')::uuid and active)
    or (select coalesce(sum(quantity),0) from public.stock_movements where store_id=p_store_id and product_id=product and location_id=box)<qty
    or exists(select 1 from public.purchased_devices where product_id=product and (status<>'In Stock' or qty<>1)) then raise exception 'Insufficient stock or invalid test customer/product' using errcode='22023'; end if;
  insert into public.out_for_test(id,store_id,code,customer_id,product_id,location_id,quantity,taken_date,due_date,employee_id,notes)
    values(tid,p_store_id,private.next_code('private.test_number','TM-TEST-'),(p_input->>'customerId')::uuid,product,box,qty,(p_input->>'takenDate')::date,(p_input->>'dueDate')::date,public.current_profile_id(),coalesce(p_input->>'notes',''));
  insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id)
    values(p_store_id,product,box,-qty,'OUT_FOR_TEST','test',tid,public.current_profile_id());
  cached:=private.test_json(tid); perform private.save_request(p_store_id,'test_out',req,p_input,cached);
  perform private.write_audit(p_store_id,public.current_profile_id(),'test.sent','out_for_test',tid,jsonb_build_object('quantity',qty)); return cached;
end $$;
create function public.update_test_out(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p_input->>'idempotencyKey')::uuid; cached jsonb; t public.out_for_test; box uuid;
begin
  perform private.require_permission('inventory.transfer',p_store_id); perform private.lock_store(p_store_id);
  cached:=private.cached_request(p_store_id,'test_update',req,p_input); if cached is not null then return cached; end if;
  select * into t from public.out_for_test where store_id=p_store_id and id=(p_input->>'id')::uuid for update;
  if t.id is null or t.status<>'OUT' then raise exception 'Test is already closed or missing' using errcode='22023'; end if;
  if p_input->>'action'='return' then
    box:=coalesce(nullif(p_input->>'locationId','')::uuid,t.location_id); perform private.require_box(p_store_id,box);
    insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id)
      values(p_store_id,t.product_id,box,t.quantity,'TEST_RETURN','test_return',t.id,public.current_profile_id());
    update public.out_for_test set status='RETURNED',closed_at=now() where id=t.id;
  elsif p_input->>'action'='extend' and (p_input->>'dueDate')::date>=greatest(t.due_date,current_date) then
    update public.out_for_test set due_date=(p_input->>'dueDate')::date where id=t.id;
  else raise exception 'Invalid test action or deadline' using errcode='22023'; end if;
  cached:=private.test_json(t.id); perform private.save_request(p_store_id,'test_update',req,p_input,cached);
  perform private.write_audit(p_store_id,public.current_profile_id(),'test.'||(p_input->>'action'),'out_for_test',t.id); return cached;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.receive_credit_payment(uuid,jsonb),public.reverse_payment(uuid,jsonb),public.return_sale_item(uuid,jsonb),public.void_sale(uuid,jsonb),public.save_test_out(uuid,jsonb),public.update_test_out(uuid,jsonb) from public,anon;
grant execute on function public.receive_credit_payment(uuid,jsonb),public.reverse_payment(uuid,jsonb),public.return_sale_item(uuid,jsonb),public.void_sale(uuid,jsonb),public.save_test_out(uuid,jsonb),public.update_test_out(uuid,jsonb) to authenticated;
commit;
