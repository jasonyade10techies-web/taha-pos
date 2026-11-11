begin;
-- Invoice items are append-only. Tax must be calculated before their first INSERT.
create or replace function private.sale_tax_quote(p_store uuid,p_lines jsonb,p_net numeric) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare settings jsonb:=private.settings(p_store); profile jsonb; p public.products; c public.coupons; line jsonb; base numeric:=0; taxable numeric:=0; amount numeric:=0; rate numeric:=0; mode text:='Exclusive'; scope text:='Both'; remaining numeric; line_coupon numeric; line_net numeric; eligible boolean; weighted jsonb:='[]'; amounts jsonb:='{}'; part numeric; count_left integer;
begin
 select value into profile from jsonb_array_elements(coalesce(settings->'taxProfiles','[]')) where value->>'id'=settings->>'defaultTaxProfileId' and coalesce((value->>'enabled')::boolean,false);
 if profile is not null then rate:=(profile->>'rate')::numeric;mode:=profile->>'mode';scope:=profile->>'appliesTo';end if;
 select coalesce(sum((l->>'quantity')::integer*(l->>'unitPrice')::numeric),0) into base from jsonb_array_elements(p_lines) l;
 remaining:=greatest(0,base-p_net);
 -- Match the sale engine's sequential coupon allocation, including category/service scope.
 select cp.* into c from public.coupons cp where cp.store_id=p_store and cp.code=upper(coalesce(current_setting('taha.tax_coupon',true),''));
 for line in select value from jsonb_array_elements(p_lines) loop
  select * into p from public.products where store_id=p_store and id=(line->>'productId')::uuid;
  line_net:=(line->>'quantity')::integer*(line->>'unitPrice')::numeric;line_coupon:=0;
  if remaining>0 and (c.eligible='All' or c.eligible='Products' and p.id::text=any(c.targets) or c.eligible='Categories' and p.category=any(c.targets) or c.eligible='Services' and p.category='Services') then line_coupon:=least(remaining,greatest(0,(line->>'unitPrice')::numeric-p.minimum_selling_price)*(line->>'quantity')::integer);remaining:=remaining-line_coupon;end if;
  line_net:=line_net-line_coupon;eligible:=profile is not null and (scope='Both' or scope='Services' and p.category='Services' or scope='Products' and p.category<>'Services');
  if eligible then taxable:=taxable+line_net;weighted:=weighted||jsonb_build_array(jsonb_build_object('id',p.id,'net',line_net));end if;
 end loop;
 amount:=round(case when mode='Inclusive' then taxable-taxable/(1+rate/100) else taxable*rate/100 end,2);remaining:=amount;count_left:=jsonb_array_length(weighted);
 for line in select value from jsonb_array_elements(weighted) loop
  part:=case when count_left=1 then remaining else least(remaining,round(case when taxable>0 then amount*(line->>'net')::numeric/taxable else 0 end,2)) end;amounts:=amounts||jsonb_build_object(line->>'id',part);remaining:=remaining-part;count_left:=count_left-1;
 end loop;
 return jsonb_build_object('profileId',profile->>'id','name',coalesce(profile->>'name','Tax'),'rate',rate,'mode',mode,'appliesTo',scope,'taxable',taxable,'amount',amount,'net',case when mode='Inclusive' then p_net-amount else p_net end,'total',case when mode='Exclusive' then p_net+amount else p_net end,'lineAmounts',amounts);
end $$;
do $$declare source text;begin
 source:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 if position('perform private.attach_sale_tax(sid,tax_snapshot);' in source)=0 then raise exception 'Review sale tax integration';end if;
 source:=replace(source,'tax_snapshot:=private.sale_tax_quote','perform set_config(''taha.tax_coupon'',coalesce(p_input->>''coupon'',''''),true); tax_snapshot:=private.sale_tax_quote');
 source:=replace(source,'receipt_snapshot,source_test_id)','receipt_snapshot,source_test_id,tax_snapshot)');
 source:=replace(source,'''footer'',settings->>''receiptFooter''),test.id);','''footer'',settings->>''receiptFooter'',''showZeroTax'',coalesce((settings->>''showZeroTax'')::boolean,false)),test.id,tax_snapshot-''lineAmounts'');');
 source:=replace(source,'price_reason,approver_id)','price_reason,approver_id,tax_amount)');
 source:=replace(source,'qty*price-item_coupon,p.category=''Services''','qty*price-item_coupon+case when tax_snapshot->>''mode''=''Exclusive'' then coalesce((tax_snapshot->''lineAmounts''->>p.id::text)::numeric,0) else 0 end,p.category=''Services''');
 source:=replace(source,'''reason'',''''),approver);','''reason'',''''),approver,coalesce((tax_snapshot->''lineAmounts''->>p.id::text)::numeric,0));');
 source:=replace(source,'perform private.attach_sale_tax(sid,tax_snapshot); ','');execute source;
end $$;
drop function private.attach_sale_tax(uuid,jsonb);
commit;
