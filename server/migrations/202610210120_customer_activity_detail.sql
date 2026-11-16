begin;
-- Exact source-record lookup for an authorized customer history entry. Unlike
-- the general recent lists this read is not capped or offset-dependent.
create function public.customer_activity_detail(p_store_id uuid,p_customer_id uuid,p_event_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare kind text;source_id uuid;sale_id uuid;result jsonb:='{}';source jsonb;can_credit boolean;can_sales boolean;can_returns boolean;can_payments boolean;can_tests boolean;proof_allowed boolean;
begin
 if not (public.has_permission('customers.view',p_store_id) or public.has_permission('customers.edit',p_store_id) or public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then raise exception 'Customer activity access denied' using errcode='42501';end if;
 if not exists(select 1 from public.customers where store_id=p_store_id and id=p_customer_id) then raise exception 'Customer access denied' using errcode='42501';end if;
 if p_event_id is null or length(p_event_id)>100 then raise exception 'Invalid history reference' using errcode='22023';end if;
 kind:=case when position(':' in p_event_id)>0 then split_part(p_event_id,':',1) else 'note-or-reminder' end;
 begin source_id:=(case when kind='note-or-reminder' then p_event_id else split_part(p_event_id,':',2) end)::uuid;
 exception when invalid_text_representation then raise exception 'Invalid history reference' using errcode='22023';end;
 can_credit:=public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id);
 can_sales:=public.has_permission('sales.view',p_store_id);
 can_returns:=can_sales or public.has_permission('returns.create',p_store_id) or public.has_permission('reports.view',p_store_id);
 can_payments:=can_credit or public.has_permission('payments.approve_electronic',p_store_id) or public.has_permission('payments.reverse',p_store_id) or public.has_permission('reports.view',p_store_id);
 can_tests:=public.has_permission('inventory.transfer',p_store_id);
 if kind in ('sale','void') and can_sales then
  select id into sale_id from public.sales where store_id=p_store_id and customer_id=p_customer_id and id=source_id and (kind<>'void' or voided_at is not null);
  if sale_id is not null then source:=jsonb_build_object('id',sale_id);end if;
 elsif kind='credit' and can_credit then
  select jsonb_build_object('id',l.id,'customerId',l.customer_id,'saleId',l.sale_id,'paymentId',l.payment_id,'reference',l.reference,'description',l.description,'debit',l.debit,'credit',l.credit,'createdAt',l.created_at),l.sale_id into source,sale_id
  from public.credit_ledger_entries l where store_id=p_store_id and customer_id=p_customer_id and id=source_id;
  if source is not null then result:=result||jsonb_build_object('ledger',source);end if;
 elsif kind='payment' and can_payments then
  select private.payment_json(id),pay.sale_id into source,sale_id from public.payments pay where store_id=p_store_id and customer_id=p_customer_id and id=source_id and pay.kind in ('collection','refund','reversal') and status in ('Confirmed','Reversed');
  if source is not null then
   proof_allowed:=public.has_permission('payments.approve_electronic',p_store_id) or public.has_permission('payments.reverse',p_store_id) or public.has_permission('reports.view',p_store_id) or public.has_permission('sales.create',p_store_id) and (source->>'employeeId')=public.current_profile_id()::text;
   if not proof_allowed then source:=source-'proof';end if;
   result:=result||jsonb_build_object('payment',source);
  end if;
 elsif kind='return' and can_returns then
  select private.return_json(r.id),r.sale_id into source,sale_id from public.returns r join public.sales s on s.id=r.sale_id and s.store_id=p_store_id and s.customer_id=p_customer_id where r.store_id=p_store_id and r.id=source_id;
  if source is not null then result:=result||jsonb_build_object('returned',source);end if;
 elsif kind in ('test','test-returned','test-converted') and can_tests then
  select private.test_json(t.id),t.sale_id into source,sale_id from public.out_for_test t where t.store_id=p_store_id and t.customer_id=p_customer_id and t.id=source_id and (kind<>'test-returned' or t.status='RETURNED') and (kind<>'test-converted' or t.sale_id is not null);
  if source is not null then result:=result||jsonb_build_object('test',source);end if;
 elsif kind='note-or-reminder' then
  select private.customer_note_event(id) into source from private.customer_notes where store_id=p_store_id and customer_id=p_customer_id and id=source_id;
  if source is null then select private.reminder_history_event(id) into source from private.reminder_history h where h.store_id=p_store_id and h.customer_id=p_customer_id and h.id=source_id and (h.kind='credit' and can_credit or h.kind='test' and can_tests);end if;
  if source is not null then result:=result||jsonb_build_object('event',source);end if;
 end if;
 if source is null then raise exception 'History entry unavailable for this customer or permission' using errcode='42501';end if;
 if sale_id is not null and can_sales then result:=result||jsonb_build_object('sale',public.get_sale(p_store_id,sale_id));end if;
 return result;
end $$;
revoke all on function public.customer_activity_detail(uuid,uuid,text) from public,anon;
grant execute on function public.customer_activity_detail(uuid,uuid,text) to authenticated;
commit;
