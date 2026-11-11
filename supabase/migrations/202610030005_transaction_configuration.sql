begin;
create function public.get_business_settings(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501'; end if;
  return private.settings(p_store_id);
end $$;
create function public.save_business_settings(p_store_id uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_permission('settings.manage',p_store_id);
  if coalesce(p_input->>'receiptPrinting','') not in ('Always Print','Ask After Checkout','Never Auto Print') or coalesce(p_input->>'belowMinimum','') not in ('Manager Approval','Block')
    or coalesce((p_input->>'returnDays')::integer,-1) not between 0 and 365 or coalesce((p_input->>'negativeStock')::boolean,true)
    or coalesce(p_input->>'currency','')<>'PKR' or coalesce(p_input->>'timezone','')<>'Asia/Karachi'
    or exists(select 1 from unnest(array['requireProof','bargaining','creditEnabled','receiptRequired','returnApproval','restoreReturns','negativeStock']) k where coalesce(jsonb_typeof(p_input->k),'null')<>'boolean') then
    raise exception 'Invalid settings. Live stock cannot be negative; minimum overrides require approval.' using errcode='22023'; end if;
  insert into public.business_settings(store_id,settings) values(p_store_id,p_input-'storeName'-'branch')
    on conflict(store_id) do update set settings=excluded.settings,updated_at=now();
  perform private.write_audit(p_store_id,public.current_profile_id(),'settings.updated','store',p_store_id);
end $$;
create function public.save_customer(p_store_id uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce((nullif(p_input->>'id',''))::uuid,gen_random_uuid());
begin
  perform private.require_permission('credit.create',p_store_id);
  perform private.lock_store(p_store_id);
  if exists(select 1 from public.customers where id=v_id and store_id<>p_store_id) then raise exception 'Access denied' using errcode='42501'; end if;
  if coalesce(p_input->>'photo','')<>'' and not private.valid_asset(p_store_id,p_input->>'photo','customers') then raise exception 'Invalid customer image' using errcode='22023'; end if;
  insert into public.customers(id,store_id,name,type,shop_name,owner_name,collecting_person,phone,address,notes,photo_path)
    values(v_id,p_store_id,p_input->>'name',p_input->>'type',coalesce(p_input->>'shopName',''),coalesce(p_input->>'ownerName',''),coalesce(p_input->>'collectingPerson',''),
      coalesce(p_input->>'phone',''),coalesce(p_input->>'address',''),coalesce(p_input->>'notes',''),coalesce(p_input->>'photo',''))
    on conflict(id) do update set name=excluded.name,type=excluded.type,shop_name=excluded.shop_name,owner_name=excluded.owner_name,collecting_person=excluded.collecting_person,
      phone=excluded.phone,address=excluded.address,notes=excluded.notes,photo_path=excluded.photo_path,updated_at=now();
  insert into public.credit_accounts(customer_id,store_id,credit_limit,enabled,enforce_limit)
    values(v_id,p_store_id,(nullif(p_input->>'creditLimit',''))::numeric,coalesce((p_input->>'creditEnabled')::boolean,true),coalesce((p_input->>'enforceCreditLimit')::boolean,true))
    on conflict(customer_id) do update set credit_limit=excluded.credit_limit,enabled=excluded.enabled,enforce_limit=excluded.enforce_limit;
  perform private.write_audit(p_store_id,public.current_profile_id(),'customer.saved','customer',v_id);
  return v_id;
end $$;
create function public.save_payment_method(p_store_id uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());
begin
  perform private.require_permission('settings.manage',p_store_id);
  if exists(select 1 from public.payment_methods where id=v_id and store_id<>p_store_id) then raise exception 'Access denied' using errcode='42501'; end if;
  if coalesce(p_input->>'qr','')<>'' and not private.valid_asset(p_store_id,p_input->>'qr','payment-qr') then raise exception 'Invalid QR image' using errcode='22023'; end if;
  insert into public.payment_methods(id,store_id,name,kind,subtype,account_title,account_number,iban,qr_path,enabled,requires_proof,sort_order)
    values(v_id,p_store_id,p_input->>'name',p_input->>'kind',coalesce(p_input->>'subtype',case when p_input->>'kind'='Cash' then 'Cash' else 'Other' end),
      coalesce(p_input->>'title',''),coalesce(p_input->>'number',''),coalesce(p_input->>'iban',''),coalesce(p_input->>'qr',''),(p_input->>'enabled')::boolean,
      coalesce((p_input->>'requiresProof')::boolean,false),coalesce((p_input->>'sortOrder')::integer,0))
    on conflict(id) do update set name=excluded.name,kind=excluded.kind,subtype=excluded.subtype,account_title=excluded.account_title,account_number=excluded.account_number,
      iban=excluded.iban,qr_path=excluded.qr_path,enabled=excluded.enabled,requires_proof=excluded.requires_proof,sort_order=excluded.sort_order;
  perform private.write_audit(p_store_id,public.current_profile_id(),'payment_method.saved','payment_method',v_id);
  return v_id;
end $$;
create function public.save_coupon(p_store_id uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());
begin
  perform private.require_permission('settings.manage',p_store_id); perform private.lock_store(p_store_id);
  if exists(select 1 from public.coupons where id=v_id and store_id<>p_store_id) then raise exception 'Access denied' using errcode='42501'; end if;
  insert into public.coupons(id,store_id,code,type,value,starts_on,ends_on,minimum,max_uses,per_customer_limit,eligible,targets,active)
    values(v_id,p_store_id,upper(trim(p_input->>'code')),p_input->>'type',(p_input->>'value')::numeric,(p_input->>'start')::date,(p_input->>'end')::date,
      (p_input->>'minimum')::numeric,(p_input->>'maxUses')::integer,(p_input->>'perCustomerLimit')::integer,p_input->>'eligible',
      array(select jsonb_array_elements_text(coalesce(p_input->'targets','[]'))),(p_input->>'active')::boolean)
    on conflict(id) do update set code=excluded.code,type=excluded.type,value=excluded.value,starts_on=excluded.starts_on,ends_on=excluded.ends_on,minimum=excluded.minimum,
      max_uses=excluded.max_uses,per_customer_limit=excluded.per_customer_limit,eligible=excluded.eligible,targets=excluded.targets,active=excluded.active;
  perform private.write_audit(p_store_id,public.current_profile_id(),'coupon.saved','coupon',v_id); return v_id;
end $$;
create function public.list_transaction_approvers(p_store_id uuid,p_permission text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.can_access_store(p_store_id) or p_permission not in ('pricing.override_minimum','payments.approve_electronic','returns.approve') then raise exception 'Access denied' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name) order by p.full_name),'[]') from public.profiles p
    join private.employee_pin_credentials c on c.profile_id=p.id where private.profile_permission(p.id,p_store_id,p_permission));
end $$;
create function public.approve_transaction(p_store_id uuid,p_manager_id uuid,p_pin text,p_purpose text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare seller uuid:=public.current_profile_id(); v_key text; v_hash text; attempt private.approval_attempts; token text; expiry timestamptz:=now()+interval '5 minutes';
begin
  v_key:=case p_purpose when 'price' then 'pricing.override_minimum' when 'payment' then 'payments.approve_electronic' when 'return' then 'returns.approve' end;
  if seller is null or not public.can_access_store(p_store_id) or v_key is null or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>2048 then raise exception 'Access denied' using errcode='42501'; end if;
  if p_purpose='payment' then
    if not (public.has_permission('sales.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then raise exception 'Payment permission required' using errcode='42501'; end if;
  else perform private.require_permission(case p_purpose when 'price' then 'sales.create' else 'returns.create' end,p_store_id); end if;
  insert into private.approval_attempts(store_id,seller_id) values(p_store_id,seller) on conflict do nothing;
  select * into attempt from private.approval_attempts where store_id=p_store_id and seller_id=seller for update;
  if attempt.locked_until>now() then return jsonb_build_object('ok',false,'message','Too many attempts. Try again after 15 minutes.'); end if;
  if attempt.window_start<now()-interval '15 minutes' then
    update private.approval_attempts set failures=0,window_start=now(),locked_until=null where store_id=p_store_id and seller_id=seller; attempt.failures:=0;
  end if;
  select pin_hash into v_hash from private.employee_pin_credentials where profile_id=p_manager_id and private.profile_permission(p_manager_id,p_store_id,v_key);
  if p_pin is null or p_pin='123456' or p_pin !~ '^[0-9]{6}$' or v_hash is null or extensions.crypt(p_pin,v_hash)<>v_hash then
    update private.approval_attempts set failures=attempt.failures+1,locked_until=case when attempt.failures+1>=5 then now()+interval '15 minutes' end where store_id=p_store_id and seller_id=seller;
    perform private.write_audit(p_store_id,seller,'approval.failed','approval',null,jsonb_build_object('purpose',p_purpose));
    return jsonb_build_object('ok',false,'message','Manager PIN could not be verified.');
  end if;
  update private.approval_attempts set failures=0,window_start=now(),locked_until=null where store_id=p_store_id and seller_id=seller;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.transaction_approvals(store_id,seller_id,approver_id,purpose,payload_hash,token_hash,expires_at)
    values(p_store_id,seller,p_manager_id,p_purpose,extensions.digest(p_payload::text,'sha256'),extensions.digest(token,'sha256'),expiry);
  perform private.write_audit(p_store_id,seller,'approval.issued','approval',null,jsonb_build_object('purpose',p_purpose,'approver_id',p_manager_id));
  return jsonb_build_object('ok',true,'token',token,'expiresAt',expiry,'managerId',p_manager_id,'managerName',(select full_name from public.profiles where id=p_manager_id));
end $$;
create function private.consume_approval(p_store uuid,p_purpose text,p_payload jsonb,p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare v private.transaction_approvals; v_key text;
begin
  v_key:=case p_purpose when 'price' then 'pricing.override_minimum' when 'payment' then 'payments.approve_electronic' else 'returns.approve' end;
  select * into v from private.transaction_approvals where token_hash=extensions.digest(p_token,'sha256') for update;
  if v.id is null or v.store_id<>p_store or v.seller_id<>public.current_profile_id() or v.purpose<>p_purpose or v.consumed_at is not null
    or v.expires_at<=clock_timestamp() or v.payload_hash<>extensions.digest(p_payload::text,'sha256') or not private.profile_permission(v.approver_id,p_store,v_key) then
    raise exception 'Manager approval is missing, expired, consumed or does not match this transaction' using errcode='22023'; end if;
  update private.transaction_approvals set consumed_at=now() where id=v.id; return v.approver_id;
end $$;
create function private.valid_asset(p_store uuid,p_path text,p_folder text) returns boolean language sql stable security definer set search_path='' as $$
  select p_path like p_store::text||'/'||p_folder||'/%' and exists(select 1 from storage.objects where bucket_id='business-assets' and name=p_path)
$$;
-- Images/proof are private objects, never inline image blobs in financial records.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-assets','business-assets',false,2097152,array['image/webp','image/png','image/jpeg']) on conflict(id) do nothing;
create function public.can_read_business_asset(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_store uuid; v_kind text;
begin
  begin v_store:=split_part(p_path,'/',1)::uuid; exception when others then return false; end;
  v_kind:=split_part(p_path,'/',2);
  if not public.can_access_store(v_store) then return false; end if;
  if v_kind='proof' then return public.has_permission('payments.approve_electronic',v_store) or public.has_permission('reports.view',v_store); end if;
  return v_kind in ('customers','payment-qr');
end $$;
create policy business_asset_read on storage.objects for select to authenticated using(bucket_id='business-assets' and public.can_read_business_asset(name));
create policy business_asset_insert on storage.objects for insert to authenticated with check(bucket_id='business-assets'
  and split_part(name,'/',1) in (select id::text from public.stores where public.can_access_store(id)) and (
    (split_part(name,'/',2)='proof' and (public.has_permission('sales.create',split_part(name,'/',1)::uuid) or public.has_permission('credit.receive_payment',split_part(name,'/',1)::uuid)))
    or (split_part(name,'/',2)='customers' and public.has_permission('credit.create',split_part(name,'/',1)::uuid))
    or (split_part(name,'/',2)='payment-qr' and public.has_permission('settings.manage',split_part(name,'/',1)::uuid))));
-- No client deletes: immutable proof must remain attached to its original record.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.get_business_settings(uuid),public.save_business_settings(uuid,jsonb),public.save_customer(uuid,jsonb),public.save_payment_method(uuid,jsonb),public.save_coupon(uuid,jsonb),public.list_transaction_approvers(uuid,text),public.approve_transaction(uuid,uuid,text,text,jsonb),public.can_read_business_asset(text) from public,anon;
grant execute on function public.get_business_settings(uuid),public.save_business_settings(uuid,jsonb),public.save_customer(uuid,jsonb),public.save_payment_method(uuid,jsonb),public.save_coupon(uuid,jsonb),public.list_transaction_approvers(uuid,text),public.approve_transaction(uuid,uuid,text,text,jsonb),public.can_read_business_asset(text) to authenticated;
commit;
