begin;
-- Extend the existing permission-checked POS projection without exposing costs
-- or changing the available-stock ledger. Damaged and quarantine are one
-- established condition, not two quantities to add together.
alter function public.get_pos_products(uuid) rename to get_pos_products_before_r2a;
revoke all on function public.get_pos_products_before_r2a(uuid) from public,anon,authenticated;
create function public.get_pos_products(p_store_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; result jsonb;
begin
 rows:=public.get_pos_products_before_r2a(p_store_id);
 with damage as (
  select l.product_id,sum(m.quantity) qty from private.damaged_lots l
  join private.condition_movements m on m.lot_id=l.id and m.store_id=l.store_id
  where l.store_id=p_store_id group by l.product_id
 )
 select coalesce(jsonb_agg(p.value||jsonb_build_object('damaged_quantity',coalesce(d.qty,0)) order by p.ordinality),'[]'::jsonb)
 into result from jsonb_array_elements(rows) with ordinality p(value,ordinality)
 left join damage d on d.product_id::text=p.value->>'id';
 return result;
end $$;
revoke all on function public.get_pos_products(uuid) from public,anon;
grant execute on function public.get_pos_products(uuid) to authenticated;

-- Optional reviewed amounts bind new counter UI confirmation to the amounts
-- computed under the existing store/sale locks. Earlier clients remain valid;
-- cached retries are returned by the original function before this check.
do $$declare source text;needle text:='credit:=least(amount,greatest(0,debt));';begin
 source:=pg_get_functiondef('public.return_sale_item(uuid,jsonb)'::regprocedure);
 if position(needle in source)=0 then raise exception 'Review counter return financial preview hook';end if;
 execute replace(source,needle,needle||'
 if p_input ? ''expectedManualRefund'' or p_input ? ''expectedCreditReduction'' then
  if jsonb_typeof(p_input->''expectedManualRefund'') is distinct from ''number'' or jsonb_typeof(p_input->''expectedCreditReduction'') is distinct from ''number'' then
   raise exception ''Review the return amounts before confirmation'' using errcode=''22023'';end if;
  if (p_input->>''expectedManualRefund'')::numeric is distinct from amount-credit or (p_input->>''expectedCreditReduction'')::numeric is distinct from credit then
   raise exception ''Return amounts changed. Refresh the receipt and review the payout and credit adjustment.'' using errcode=''40001'';end if;
 end if;');
end $$;
commit;
