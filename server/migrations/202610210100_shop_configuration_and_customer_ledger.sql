begin;
create function private.shop_configuration(p_store uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('operatingMode','staff','setupCompleted',false,'setupStep',0,'storageLabels',jsonb_build_object('rack','Rack','shelf','Shelf','box','Box'),'quarantineLocationId','','showCashierOnReceipt',true)
 ||coalesce(private.settings(p_store)->'shopConfiguration','{}')
 ||jsonb_build_object('enabledFeatures',jsonb_build_object('credit',true,'testItems',true,'repairs',true,'usedDevices',true,'suppliers',true,'mobileSales',true,'website',false)||coalesce(private.settings(p_store)->'shopConfiguration'->'enabledFeatures','{}')||'{"website":false}'::jsonb)
$$;
alter function public.get_business_settings(uuid) rename to get_business_settings_before_5d1;
revoke all on function public.get_business_settings_before_5d1(uuid) from public,anon,authenticated;
create function public.get_business_settings(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin return public.get_business_settings_before_5d1(p_store_id)||jsonb_build_object('shopConfiguration',private.shop_configuration(p_store_id));end $$;

alter function public.save_business_settings(uuid,jsonb) rename to save_business_settings_before_5d1;
revoke all on function public.save_business_settings_before_5d1(uuid,jsonb) from public,anon,authenticated;
create function public.save_business_settings(p_store_id uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare previous jsonb:=private.shop_configuration(p_store_id); cfg jsonb; k text;
begin
 perform private.require_permission('settings.manage',p_store_id);perform private.lock_store(p_store_id);
 cfg:=coalesce(p_input->'shopConfiguration',previous);
 if jsonb_typeof(cfg)<>'object' or coalesce(cfg->>'operatingMode','') not in ('owner-only','staff') or jsonb_typeof(cfg->'setupCompleted') is distinct from 'boolean' or jsonb_typeof(cfg->'showCashierOnReceipt') is distinct from 'boolean'
  or jsonb_typeof(cfg->'setupStep') is distinct from 'number' or (cfg->>'setupStep')::numeric not between 0 and 6 or trunc((cfg->>'setupStep')::numeric)<>(cfg->>'setupStep')::numeric
  or jsonb_typeof(cfg->'enabledFeatures')<>'object' or jsonb_typeof(cfg->'storageLabels')<>'object' then raise exception 'Review the shop setup choices' using errcode='22023';end if;
 foreach k in array array['credit','testItems','repairs','usedDevices','suppliers','mobileSales','website'] loop
  if jsonb_typeof(cfg->'enabledFeatures'->k) is distinct from 'boolean' then raise exception 'Choose enabled shop features' using errcode='22023';end if;
 end loop;
 foreach k in array array['rack','shelf','box'] loop
  if jsonb_typeof(cfg->'storageLabels'->k) is distinct from 'string' or length(trim(cfg->'storageLabels'->>k)) not between 1 and 40 then raise exception 'Enter short storage level names' using errcode='22023';end if;
 end loop;
 cfg:=jsonb_set(cfg,'{enabledFeatures,website}','false');
 if cfg->>'operatingMode' is distinct from previous->>'operatingMode' then
  if not public.is_owner() then raise exception 'Only the owner can change shop operating mode' using errcode='42501';end if;
  if exists(select 1 from public.shifts where store_id=p_store_id and status='open') then raise exception 'Close active shifts before changing shop operating mode' using errcode='22023';end if;
  if exists(select 1 from app_private.cash_capture_state where store_id=p_store_id and state not in ('POSTED','REFUNDED')) then raise exception 'Resolve pending offline cash before changing shop operating mode' using errcode='22023';end if;
  perform private.write_audit(p_store_id,public.current_profile_id(),'shop.operating_mode_changed','store',p_store_id,jsonb_build_object('from',previous->>'operatingMode','to',cfg->>'operatingMode'));
 end if;
 if nullif(cfg->>'quarantineLocationId','') is not null then perform private.require_condition_box(p_store_id,(cfg->>'quarantineLocationId')::uuid,'Damaged');end if;
 perform public.save_business_settings_before_5d1(p_store_id,p_input||jsonb_build_object('shopConfiguration',cfg));
end $$;

create function public.customer_ledger(p_store_id uuid,p_customer_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not(public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then raise exception 'Credit permission required' using errcode='42501';end if;
 if not exists(select 1 from public.customers where store_id=p_store_id and id=p_customer_id) then raise exception 'Customer not found in this shop' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'customerId',l.customer_id,'saleId',l.sale_id,'paymentId',l.payment_id,'reference',l.reference,'description',l.description,'debit',l.debit,'credit',l.credit,'balance',l.running,'employeeId',l.employee_id,'createdAt',l.created_at,'kind',case when p.kind='reversal' then 'reversal' when p.kind='collection' then 'payment' when l.credit>0 and (l.reference like 'TM-RET-%' or lower(l.description) like '%return%') then 'return' when lower(l.description) like '%void%' or lower(l.description) like '%revers%' then 'reversal' when l.debit>0 and l.payment_id is null then 'charge' else 'adjustment' end) order by l.created_at,l.id),'[]')
 from (select e.*,sum(debit-credit) over(order by created_at,id rows unbounded preceding) running from public.credit_ledger_entries e where store_id=p_store_id and customer_id=p_customer_id)l left join public.payments p on p.id=l.payment_id and p.store_id=p_store_id);
end $$;
revoke all on function public.get_business_settings(uuid),public.save_business_settings(uuid,jsonb),public.customer_ledger(uuid,uuid) from public,anon;
grant execute on function public.get_business_settings(uuid),public.save_business_settings(uuid,jsonb),public.customer_ledger(uuid,uuid) to authenticated;
-- New receipts snapshot presentation preference; historic actors/snapshots stay intact.
do $$declare src text;needle text:='''footer'',settings->>''receiptFooter''';begin
 src:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 if position(needle in src)=0 then raise exception 'Review new receipt cashier snapshot integration';end if;
 execute replace(src,needle,needle||',''showCashier'',coalesce((private.shop_configuration(p_store_id)->>''showCashierOnReceipt'')::boolean,true)');
end $$;
commit;
