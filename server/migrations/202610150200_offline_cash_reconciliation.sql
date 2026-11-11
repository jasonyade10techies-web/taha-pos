begin;
insert into public.permissions(key,description) values('sync.reconcile_cash','Review and reconcile physically collected offline cash') on conflict do nothing;
-- Evidence and decisions are append-only. A rejection must survive rollback of
-- the sale transaction. Only the trusted API runtime can access this schema.
create table app_private.cash_captures(
 id uuid primary key,store_id uuid not null references public.stores(id),terminal_id uuid not null,
 seller_id uuid not null references public.profiles(id),invoice text not null unique,
 captured_at timestamptz not null,received_at timestamptz not null default now(),
 tendered numeric(16,2) not null check(tendered>0),change_given numeric(16,2) not null check(change_given>=0),
 collected numeric(16,2) not null check(collected>0 and collected=tendered-change_given),
 fingerprint text not null,payload jsonb not null,submitted_by uuid not null references public.profiles(id),authorization_snapshot jsonb not null
);
create index cash_capture_store on app_private.cash_captures(store_id,captured_at,seller_id);
create table app_private.cash_capture_events(
 sequence bigint generated always as identity primary key,capture_id uuid not null references app_private.cash_captures(id),
 actor_id uuid not null references public.profiles(id),state text not null check(state in ('PENDING','REVIEW','FAILED','POSTED','REFUNDED')),
 reason text not null default '',details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index cash_event_latest on app_private.cash_capture_events(capture_id,sequence desc);
create trigger immutable_cash_capture before update or delete on app_private.cash_captures for each row execute function private.append_only();
create trigger immutable_cash_decision before update or delete on app_private.cash_capture_events for each row execute function private.append_only();
create view app_private.cash_capture_state as select c.*,p.full_name seller_name,
 coalesce(e.state,'PENDING') state,e.reason,e.details,e.actor_id resolver_id,e.created_at decision_at
 from app_private.cash_captures c join public.profiles p on p.id=c.seller_id
 left join lateral(select * from app_private.cash_capture_events where capture_id=c.id order by sequence desc limit 1)e on true;

create function app_private.require_cash_resolver(p_store uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_permission('sync.reconcile_cash',p_store) or not exists(select 1 from public.profiles where id=public.current_profile_id() and role in ('owner','manager') and status='active') then
  raise exception 'Owner or authorized manager required' using errcode='42501';end if;
end $$;
-- Authorization remains the current authenticated resolver. These narrow insert
-- triggers attribute a verified capture to its original seller/time BEFORE the
-- existing engine constructs receipt/idempotency snapshots. Never change auth.uid.
create function app_private.offline_cash_attribution() returns trigger language plpgsql security definer set search_path='' as $$
declare c app_private.cash_captures; rid text:=nullif(current_setting('taha.cash_capture',true),'');
begin
 if rid is null then return new;end if;
 select * into c from app_private.cash_captures where id=rid::uuid and store_id=new.store_id;
 if c.id is null then raise exception 'Missing offline cash evidence' using errcode='42501';end if;
 if TG_TABLE_NAME='sales' then
  if new.invoice<>c.invoice then raise exception 'Offline invoice mismatch' using errcode='22023';end if;
  new.employee_id:=c.seller_id;new.employee_name:=(select full_name from public.profiles where id=c.seller_id);new.created_at:=c.captured_at;
 elsif TG_TABLE_NAME='payments' then
  if new.kind<>'sale' or new.method_kind<>'Cash' then raise exception 'Offline cash payment only' using errcode='22023';end if;
  new.employee_id:=c.seller_id;new.created_at:=c.captured_at;
 elsif TG_TABLE_NAME='stock_movements' then new.actor_profile_id:=c.seller_id;
 end if;return new;
end $$;
create trigger offline_cash_seller before insert on public.sales for each row execute function app_private.offline_cash_attribution();
create trigger offline_cash_seller before insert on public.payments for each row execute function app_private.offline_cash_attribution();
create trigger offline_cash_seller before insert on public.stock_movements for each row execute function app_private.offline_cash_attribution();

create function app_private.post_cash_capture(p_store uuid,p_id uuid,p_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare c app_private.cash_captures; s jsonb; actor uuid:=public.current_profile_id();state text;line jsonb;p public.products; expected jsonb;prior_hash bytea;
begin
 perform private.lock_store(p_store);select * into c from app_private.cash_captures where id=p_id and store_id=p_store for update;
 if c.id is null then raise exception 'Cash record not found' using errcode='22023';end if;
 if actor is distinct from c.seller_id or length(p_reason)>0 then perform app_private.require_cash_resolver(p_store);
 end if;
 select e.state into state from app_private.cash_capture_events e where e.capture_id=p_id order by sequence desc limit 1;
 if state='REFUNDED' then raise exception 'This cash was refunded; it cannot be posted as a sale' using errcode='22023';end if;
 -- Existing import recognition comes first, even after prices, status or stock change.
 select result,payload_hash into s,prior_hash from private.transaction_requests where store_id=p_store and operation='sale' and request_id=p_id limit 1;
 if s is not null then
  if s->>'invoice'<>c.invoice or (s->>'total')::numeric<>c.collected or s->>'employeeId'<>c.seller_id::text or prior_hash<>extensions.digest((c.payload->'input')::text,'sha256') then raise exception 'Receipt conflicts with committed transaction' using errcode='22023';end if;
  if state is distinct from 'POSTED' then
   insert into app_private.cash_capture_events(capture_id,actor_id,state,reason,details) values(c.id,actor,'POSTED',p_reason,jsonb_build_object('saleId',s->>'id','sellerId',c.seller_id,'recoveredAcknowledgment',true));
  end if;
  return s;
 end if;
 if not exists(select 1 from public.payment_methods where store_id=p_store and id=(c.payload->'input'->'payments'->0->>'methodId')::uuid and kind='Cash' and enabled) then
  raise exception 'The cash payment method is unavailable. Owner review is required.' using errcode='22023';end if;
 if actor is distinct from c.seller_id and length(trim(p_reason)) not between 5 and 1000 then raise exception 'Explain the recovery decision' using errcode='22023';end if;
 for line in select * from jsonb_array_elements(c.payload->'input'->'lines') loop
  select * into p from public.products where store_id=p_store and id=(line->>'productId')::uuid;
  select x into expected from jsonb_array_elements(c.payload->'catalog')x where x->>'id'=line->>'productId';
  if p.id is null or expected is null or p.selling_price<>(expected->>'price')::numeric or p.minimum_selling_price<>(expected->>'minimum')::numeric or (line->>'unitPrice')::numeric<p.minimum_selling_price then
   raise exception 'The selling price has changed. Ask the owner to review this offline sale.' using errcode='22023';end if;
 end loop;
 perform set_config('taha.cash_capture',p_id::text,true);perform set_config('taha.offline_invoice',c.invoice,true);
 s:=public.complete_sale(p_store,c.payload->'input');
 if (s->>'total')::numeric<>c.collected or s->>'invoice'<>c.invoice or
  (c.payload ? 'tax' and (s->'tax'->>'rate',s->'tax'->>'mode',s->'tax'->>'appliesTo') is distinct from (c.payload->'tax'->>'rate',c.payload->'tax'->>'mode',c.payload->'tax'->>'appliesTo')) then
  raise exception 'The tax or sale total has changed. Ask the owner to review this offline sale.' using errcode='22023';end if;
 perform set_config('taha.cash_capture','',true);perform set_config('taha.offline_invoice','',true);
 insert into app_private.offline_imports(request_id,store_id,terminal_id,profile_id,sale_id,captured_at,invoice)values(c.id,c.store_id,c.terminal_id,c.seller_id,(s->>'id')::uuid,c.captured_at,c.invoice);
 insert into app_private.cash_capture_events(capture_id,actor_id,state,reason,details)values(c.id,actor,'POSTED',p_reason,jsonb_build_object('saleId',s->>'id','sellerId',c.seller_id));
 perform private.write_audit(p_store,actor,'offline_cash.posted','sale',(s->>'id')::uuid,jsonb_build_object('captureId',c.id,'sellerId',c.seller_id,'reason',p_reason));return s;
end $$;

create function app_private.refund_cash_capture(p_store uuid,p_id uuid,p_reason text,p_amount numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare c app_private.cash_captures; state text;
begin
 perform app_private.require_cash_resolver(p_store);perform private.lock_store(p_store);
 select * into c from app_private.cash_captures where id=p_id and store_id=p_store for update;
 if c.id is null or length(trim(p_reason)) not between 5 and 1000 or p_amount is distinct from c.collected then raise exception 'Confirm the actual full cash refund and explain why' using errcode='22023';end if;
 select e.state into state from app_private.cash_capture_events e where e.capture_id=p_id order by sequence desc limit 1;
 if state='REFUNDED' then return jsonb_build_object('id',p_id,'state','REFUNDED');end if;
 if state='POSTED' or exists(select 1 from app_private.offline_imports where request_id=p_id) or exists(select 1 from private.transaction_requests where store_id=p_store and operation='sale' and request_id=p_id) then
  raise exception 'This sale was posted. Use the normal return/refund workflow.' using errcode='22023';end if;
 insert into app_private.cash_capture_events(capture_id,actor_id,state,reason,details)values(c.id,public.current_profile_id(),'REFUNDED',p_reason,jsonb_build_object('cashReturned',p_amount,'sellerId',c.seller_id));
 perform private.write_audit(p_store,public.current_profile_id(),'offline_cash.refunded','offline_cash',c.id,jsonb_build_object('cashReturned',p_amount,'sellerId',c.seller_id,'reason',p_reason));
 return jsonb_build_object('id',p_id,'state','REFUNDED');
end $$;
create function app_private.cash_failure(p_store uuid,p_id uuid,p_state text,p_reason text,p_decision_reason text default '') returns void language plpgsql security definer set search_path='' as $$
declare c app_private.cash_captures;
begin
 select * into c from app_private.cash_captures where id=p_id and store_id=p_store for update;
 if c.id is null or p_state not in ('REVIEW','FAILED') then raise exception 'Invalid cash record' using errcode='22023';end if;
 if public.current_profile_id() is distinct from c.seller_id or p_decision_reason<>'' then perform app_private.require_cash_resolver(p_store);end if;
 insert into app_private.cash_capture_events(capture_id,actor_id,state,reason,details)
 select c.id,public.current_profile_id(),p_state,left(p_reason,240),case when p_decision_reason='' then '{}'::jsonb else jsonb_build_object('resolutionAction','retry','decisionReason',left(p_decision_reason,1000)) end
 where not exists(select 1 from app_private.cash_capture_events where capture_id=c.id and state in ('POSTED','REFUNDED'));
 if p_decision_reason<>'' then perform private.write_audit(p_store,public.current_profile_id(),'offline_cash.retry_failed','offline_cash',c.id,jsonb_build_object('reason',left(p_decision_reason,1000),'problem',left(p_reason,240),'sellerId',c.seller_id));end if;
end $$;

create function private.offline_cash_summary(p_store uuid,p_from timestamptz,p_to timestamptz,p_seller uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('collected',coalesce(sum(collected),0),'posted',coalesce(sum(collected) filter(where state='POSTED'),0),
 'unposted',coalesce(sum(collected) filter(where state not in ('POSTED','REFUNDED')),0),
 'unpostedCash',coalesce(sum(collected) filter(where state<>'POSTED'),0),
 'unresolvedCount',count(*) filter(where state not in ('POSTED','REFUNDED')),
 'refunded',coalesce((select sum((e.details->>'cashReturned')::numeric) from app_private.cash_capture_events e join app_private.cash_captures c on c.id=e.capture_id
  where c.store_id=p_store and e.state='REFUNDED' and e.created_at>=p_from and e.created_at<p_to and (p_seller is null or e.actor_id=p_seller)),0))
 from app_private.cash_capture_state where store_id=p_store and captured_at>=p_from and captured_at<p_to and (p_seller is null or seller_id=p_seller)
$$;create function app_private.cash_summary(p_store uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform app_private.require_cash_resolver(p_store);return private.offline_cash_summary(p_store,'-infinity','infinity');end $$;
-- Existing posted cash already includes imported payments. Add only unposted
-- captures and subtract actual exception refunds; never add posted amounts twice.
alter function private.shift_cash(public.shifts,timestamptz) rename to shift_cash_before_reconciliation;
create function private.shift_cash(p_shift public.shifts,p_until timestamptz) returns jsonb language sql stable security definer set search_path='' as $$
 select case when (cash->>'collected')::numeric=0 and (cash->>'refunded')::numeric=0 then old else old||jsonb_build_object('offlineCash',cash,
  'expected',(old->>'expected')::numeric+(cash->>'unpostedCash')::numeric-(cash->>'refunded')::numeric) end
 from (select private.shift_cash_before_reconciliation(p_shift,p_until) old,private.offline_cash_summary(p_shift.store_id,p_shift.actual_start,p_until,p_shift.employee_id) cash) q$$;
alter function public.shift_closing(uuid,uuid) rename to shift_closing_before_reconciliation;
create function public.shift_closing(p_store_id uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.shifts;r jsonb;cash jsonb;
begin
 r:=public.shift_closing_before_reconciliation(p_store_id,p_id);select * into s from public.shifts where id=p_id and store_id=p_store_id;
 cash:=private.offline_cash_summary(p_store_id,s.actual_start,coalesce(s.actual_end,now()),s.employee_id);
 if (cash->>'collected')::numeric=0 and (cash->>'refunded')::numeric=0 then return r;end if;
 return r||jsonb_build_object('offlineCash',cash,'closingSnapshotPreserved',s.status='closed','lateSubmittedCount',
 (select count(*) from app_private.cash_captures where store_id=p_store_id and seller_id=s.employee_id and captured_at>=s.actual_start and captured_at<coalesce(s.actual_end,now()) and received_at>coalesce(s.actual_end,now())));
end $$;
alter function public.get_dashboard_transactions(uuid) rename to dashboard_before_cash_reconciliation;
create function public.get_dashboard_transactions(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;cash jsonb;day timestamptz:=date_trunc('day',now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
begin
 r:=public.dashboard_before_cash_reconciliation(p_store_id);
 if public.has_permission('reports.view',p_store_id) or public.has_permission('sync.reconcile_cash',p_store_id) then
  cash:=private.offline_cash_summary(p_store_id,day,day+interval '1 day');
  r:=r||jsonb_build_object('offlineCash',cash||jsonb_build_object('postedCash',coalesce((r->'summary'->>'cash')::numeric,0),
   'physicalCash',coalesce((r->'summary'->>'cash')::numeric,0)+(cash->>'unpostedCash')::numeric-(cash->>'refunded')::numeric));
 end if;return r;
end $$;
alter function public.get_transaction_report(uuid,date,date) rename to report_before_cash_reconciliation;
create function public.get_transaction_report(p_store_id uuid,p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;cash jsonb;
begin
 r:=public.report_before_cash_reconciliation(p_store_id,p_from,p_to);
 cash:=private.offline_cash_summary(p_store_id,p_from::timestamp at time zone 'Asia/Karachi',(p_to+1)::timestamp at time zone 'Asia/Karachi');
 return r||jsonb_build_object('offlineCash',cash||jsonb_build_object('postedCash',coalesce((r->'summary'->>'cash')::numeric,0),
  'physicalCash',coalesce((r->'summary'->>'cash')::numeric,0)+(cash->>'unpostedCash')::numeric-(cash->>'refunded')::numeric));
end $$;
revoke all on all tables in schema app_private from public,anon,authenticated;
alter table app_private.cash_captures enable row level security;
alter table app_private.cash_capture_events enable row level security;
-- No authenticated policies: access is through authenticated API services and
-- narrowly scoped server functions, never direct employee table queries.
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.shift_closing_before_reconciliation(uuid,uuid),public.shift_closing(uuid,uuid) from public,anon;
grant execute on function public.shift_closing(uuid,uuid) to authenticated;
revoke all on function public.dashboard_before_cash_reconciliation(uuid),public.report_before_cash_reconciliation(uuid,date,date),public.get_dashboard_transactions(uuid),public.get_transaction_report(uuid,date,date) from public,anon;
grant execute on function public.get_dashboard_transactions(uuid),public.get_transaction_report(uuid,date,date) to authenticated;
commit;
