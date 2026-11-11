begin;
create function public.get_transaction_result(p_store_id uuid,p_operation text,p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_key text;
begin
 v_key:=case p_operation when 'sale' then 'sales.create' when 'collection' then 'credit.receive_payment' when 'return' then 'returns.create'
   when 'void' then 'sales.void' when 'payment_reversal' then 'payments.reverse' when 'test_out' then 'inventory.transfer' when 'test_update' then 'inventory.transfer' when 'device_purchase' then 'devices.buy_used' end;
 if v_key is null then raise exception 'Unknown transaction operation' using errcode='22023'; end if;
 perform private.require_permission(v_key,p_store_id);
 select result into v_result from private.transaction_requests where store_id=p_store_id and actor_id=public.current_profile_id() and operation=p_operation and request_id=p_request_id;
 if p_operation='device_purchase' and not public.has_permission('costs.view_purchase_cost',p_store_id) then v_result:=v_result-'purchasePrice'; end if;
 return v_result;
end $$;
drop policy scoped_read on public.payments;
create policy scoped_read on public.payments for select to authenticated using(public.has_permission('payments.approve_electronic',store_id) or public.has_permission('payments.reverse',store_id) or public.has_permission('reports.view',store_id));
-- Payment reversal access includes original proof access, but only within the active branch.
create or replace function public.can_read_business_asset(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_store uuid; v_kind text;
begin
 begin v_store:=split_part(p_path,'/',1)::uuid; exception when others then return false; end;
 v_kind:=split_part(p_path,'/',2); if not public.can_access_store(v_store) then return false; end if;
 if v_kind='proof' then return public.has_permission('payments.approve_electronic',v_store) or public.has_permission('payments.reverse',v_store) or public.has_permission('reports.view',v_store); end if;
 return v_kind in ('customers','payment-qr');
end $$;
revoke all on function public.get_transaction_result(uuid,text,uuid) from public,anon;
grant execute on function public.get_transaction_result(uuid,text,uuid) to authenticated;
commit;
