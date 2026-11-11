begin;
alter table public.sales add column tax_snapshot jsonb not null default '{}';
alter table public.sale_items add column tax_amount numeric(14,2) not null default 0 check(tax_amount>=0);
create function private.sale_tax_quote(p_store uuid,p_lines jsonb,p_net numeric) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare settings jsonb:=private.settings(p_store); profile jsonb; base numeric; eligible numeric; taxable numeric:=0; amount numeric:=0; rate numeric:=0; mode text:='Exclusive'; scope text:='Both';
begin
 select value into profile from jsonb_array_elements(coalesce(settings->'taxProfiles','[]')) where value->>'id'=settings->>'defaultTaxProfileId' and coalesce((value->>'enabled')::boolean,false);
 if profile is not null then
  rate:=(profile->>'rate')::numeric;mode:=profile->>'mode';scope:=profile->>'appliesTo';
  select coalesce(sum((line->>'quantity')::integer*(line->>'unitPrice')::numeric),0),coalesce(sum(case when scope='Both' or scope='Services' and p.category='Services' or scope='Products' and p.category<>'Services' then (line->>'quantity')::integer*(line->>'unitPrice')::numeric else 0 end),0) into base,eligible from jsonb_array_elements(p_lines) line join public.products p on p.id=(line->>'productId')::uuid and p.store_id=p_store;
  taxable:=round(case when base>0 then p_net*eligible/base else 0 end,2);
  amount:=round(case when mode='Inclusive' then taxable-taxable/(1+rate/100) else taxable*rate/100 end,2);
 end if;
 return jsonb_build_object('profileId',profile->>'id','name',coalesce(profile->>'name','Tax'),'rate',rate,'mode',mode,'appliesTo',scope,'taxable',taxable,'amount',amount,'net',case when mode='Inclusive' then p_net-amount else p_net end,'total',case when mode='Exclusive' then p_net+amount else p_net end);
end $$;
create function private.attach_sale_tax(p_sale uuid,p_tax jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item record; remaining numeric:=(p_tax->>'amount')::numeric; base numeric; part numeric; count_left integer;
begin
 update public.sales set tax_snapshot=p_tax,receipt_snapshot=receipt_snapshot||jsonb_build_object('showZeroTax',coalesce((private.settings(store_id)->>'showZeroTax')::boolean,false)) where id=p_sale;
 select sum(total),count(*) into base,count_left from public.sale_items where sale_id=p_sale and (p_tax->>'appliesTo'='Both' or p_tax->>'appliesTo'='Services' and service or p_tax->>'appliesTo'='Products' and not service);
 for item in select id,total from public.sale_items where sale_id=p_sale and (p_tax->>'appliesTo'='Both' or p_tax->>'appliesTo'='Services' and service or p_tax->>'appliesTo'='Products' and not service) order by id loop
  part:=case when count_left=1 then remaining else least(remaining,round(case when base>0 then (p_tax->>'amount')::numeric*item.total/base else 0 end,2)) end;
  update public.sale_items set tax_amount=part,total=total+case when p_tax->>'mode'='Exclusive' then part else 0 end where id=item.id;
  remaining:=remaining-part;count_left:=count_left-1;
 end loop;
end $$;
do $$declare source text;begin
 source:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 if position('total:=subtotal-discount-coupon;' in source)=0 or position('result:=private.sale_json(p_store_id,sid);' in source)=0 or position('result jsonb; code text;' in source)=0 then raise exception 'Sale engine changed; review tax integration';end if;
 source:=replace(source,'result jsonb; code text;','result jsonb; code text; tax_snapshot jsonb;');
 source:=replace(source,'total:=subtotal-discount-coupon;','total:=subtotal-discount-coupon; tax_snapshot:=private.sale_tax_quote(p_store_id,p_input->''lines'',total); total:=(tax_snapshot->>''total'')::numeric;');
 source:=replace(source,'result:=private.sale_json(p_store_id,sid);','perform private.attach_sale_tax(sid,tax_snapshot); result:=private.sale_json(p_store_id,sid);');execute source;
 source:=pg_get_functiondef('private.sale_json(uuid,uuid)'::regprocedure);if position('''subtotal'',s.subtotal' in source)=0 then raise exception 'Sale read model changed';end if;
 execute replace(source,'''subtotal'',s.subtotal','''tax'',s.tax_snapshot,''subtotal'',s.subtotal');
 source:=pg_get_functiondef('private.period_profit(uuid,date,date)'::regprocedure);
 source:=replace(source,'i.total-i.quantity*f.purchase_cost','i.total-i.tax_amount-i.quantity*f.purchase_cost');
 source:=replace(source,'r.amount-case when','r.amount-coalesce((select ti.tax_amount*r.quantity/ti.quantity from public.sale_items ti where ti.id=r.item_id),0)-case when');execute source;
 source:=pg_get_functiondef('public.get_dashboard_range(uuid,date,date)'::regprocedure);
 source:=replace(source,'i.total-i.quantity*f.purchase_cost','i.total-i.tax_amount-i.quantity*f.purchase_cost');
 source:=replace(source,'r.amount-case when','r.amount-coalesce((select ti.tax_amount*r.quantity/ti.quantity from public.sale_items ti where ti.id=r.item_id),0)-case when');execute source;
end $$;
alter function public.save_business_settings(uuid,jsonb) rename to save_business_settings_before_4e;
revoke all on function public.save_business_settings_before_4e(uuid,jsonb) from public,anon,authenticated;
create function public.save_business_settings(p_store_id uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare profile jsonb;
begin
 perform private.require_permission('settings.manage',p_store_id);
 if p_input ? 'taxProfiles' then
  if jsonb_typeof(p_input->'taxProfiles')<>'array' or jsonb_array_length(p_input->'taxProfiles')>20 then raise exception 'Check tax profiles' using errcode='22023';end if;
  for profile in select value from jsonb_array_elements(p_input->'taxProfiles') loop
   if length(trim(coalesce(profile->>'name',''))) not between 1 and 80 or coalesce((profile->>'rate')::numeric,-1) not between 0 and 100 or coalesce(profile->>'mode','') not in('Exclusive','Inclusive') or coalesce(profile->>'appliesTo','') not in('Products','Services','Both') or jsonb_typeof(profile->'enabled')<>'boolean' or coalesce(profile->>'id','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Enter a valid tax name, rate and mode' using errcode='22023';end if;
  end loop;
  if nullif(p_input->>'defaultTaxProfileId','') is not null and not exists(select 1 from jsonb_array_elements(p_input->'taxProfiles') t where t->>'id'=p_input->>'defaultTaxProfileId' and (t->>'enabled')::boolean) then raise exception 'Select an enabled default tax profile' using errcode='22023';end if;
 end if;
 if p_input ? 'searchDictionary' and (jsonb_typeof(p_input->'searchDictionary')<>'array' or jsonb_array_length(p_input->'searchDictionary')>150 or length((p_input->'searchDictionary')::text)>30000) then raise exception 'Check search dictionary' using errcode='22023';end if;
 perform public.save_business_settings_before_4e(p_store_id,p_input);
end $$;
revoke all on function public.save_business_settings(uuid,jsonb) from public,anon;
grant execute on function public.save_business_settings(uuid,jsonb) to authenticated;
revoke all on function private.sale_tax_quote(uuid,jsonb,numeric),private.attach_sale_tax(uuid,jsonb) from public,anon,authenticated;
commit;
