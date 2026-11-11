begin;
-- Financial snapshots are deliberately separate from employee-facing sale items.
create sequence private.invoice_number;
create sequence private.payment_number;
create sequence private.return_number;
create sequence private.test_number;
create table public.business_settings (
  store_id uuid primary key references public.stores(id),
  settings jsonb not null default '{"id":"main","currency":"PKR","timezone":"Asia/Karachi","receiptPrinting":"Ask After Checkout","customerDisplay":true,"requireProof":true,"bargaining":true,"belowMinimum":"Manager Approval","lowStockAlerts":true,"negativeStock":false,"defaultUnit":"Piece","receiptRequired":true,"returnDays":7,"returnApproval":true,"restoreReturns":true,"notifications":true,"receiptFooter":"Thank you for shopping at Taha Mobiles.","creditEnabled":true}',
  updated_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id),
  name text not null check(length(trim(name)) between 1 and 200), type text not null check(type in ('Individual','Shop / Business')),
  shop_name text not null default '', owner_name text not null default '', collecting_person text not null default '',
  phone text not null default '', address text not null default '', notes text not null default '', photo_path text not null default '',
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id,id)
);
create table public.credit_accounts (
  customer_id uuid primary key, store_id uuid not null, enabled boolean not null default true,
  credit_limit numeric(14,2) check(credit_limit>=0), enforce_limit boolean not null default true,
  foreign key(store_id,customer_id) references public.customers(store_id,id)
);
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), name text not null check(length(trim(name))>0),
  kind text not null check(kind in ('Cash','Digital')), subtype text not null default 'Other' check(subtype in ('Cash','JazzCash','Easypaisa','Bank','Card','Other')),
  account_title text not null default '', account_number text not null default '', iban text not null default '', qr_path text not null default '',
  enabled boolean not null default true, requires_proof boolean not null default false, sort_order integer not null default 0,
  unique(store_id,id), created_at timestamptz not null default now()
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), code text not null,
  type text not null check(type in ('Percentage','Fixed')), value numeric(14,2) not null check(value>0 and (type<>'Percentage' or value<=100)),
  starts_on date not null, ends_on date not null check(ends_on>=starts_on), minimum numeric(14,2) not null default 0 check(minimum>=0),
  max_uses integer not null default 0 check(max_uses>=0), per_customer_limit integer not null default 0 check(per_customer_limit>=0),
  eligible text not null default 'All' check(eligible in ('All','Products','Categories','Services')), targets text[] not null default '{}',
  active boolean not null default true, unique(store_id,code), unique(store_id,id)
);
create table public.sales (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), invoice text not null unique,
  customer_id uuid, customer_name text not null, employee_id uuid not null references public.profiles(id), employee_name text not null,
  subtotal numeric(14,2) not null check(subtotal>=0), discount numeric(14,2) not null check(discount>=0), coupon_discount numeric(14,2) not null default 0 check(coupon_discount>=0),
  total numeric(14,2) not null check(total>=0), credit_amount numeric(14,2) not null default 0 check(credit_amount>=0 and credit_amount<=total),
  cash_received numeric(14,2) not null default 0 check(cash_received>=0), change_amount numeric(14,2) not null default 0 check(change_amount>=0),
  coupon_code text not null default '', status text not null check(status in ('Paid','Partial','Credit','Voided','Returned')),
  receipt_snapshot jsonb not null default '{}', source_test_id uuid, created_at timestamptz not null default now(), voided_at timestamptz,
  unique(store_id,id), foreign key(store_id,customer_id) references public.customers(store_id,id), check(total=subtotal-discount-coupon_discount)
);
create table public.sale_items (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, sale_id uuid not null, product_id uuid not null,
  name text not null, variant text not null, category text not null, quantity integer not null check(quantity>0),
  listed_price numeric(14,2) not null check(listed_price>=0), minimum_price numeric(14,2) not null check(minimum_price>=0),
  unit_price numeric(14,2) not null check(unit_price>0), discount numeric(14,2) not null check(discount>=0), coupon_discount numeric(14,2) not null default 0 check(coupon_discount>=0),
  total numeric(14,2) not null check(total>=0), service boolean not null, stock_allocations jsonb not null default '[]',
  price_reason text not null default '', approver_id uuid references public.profiles(id),
  foreign key(store_id,sale_id) references public.sales(store_id,id), foreign key(store_id,product_id) references public.products(store_id,id),
  unique(sale_id,product_id), unique(store_id,id), check(total=quantity*unit_price-coupon_discount)
);
create table public.sale_item_financials (
  item_id uuid primary key, store_id uuid not null, purchase_cost numeric(14,2) not null check(purchase_cost>=0),
  foreign key(store_id,item_id) references public.sale_items(store_id,id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), code text not null unique,
  sale_id uuid, customer_id uuid, method_id uuid not null, amount numeric(14,2) not null check(amount>0),
  kind text not null check(kind in ('sale','collection','refund','reversal')),
  status text not null check(status in ('Pending','Confirmed','Rejected','Reversed')),
  method_name text not null, method_kind text not null check(method_kind in ('Cash','Digital')),
  reference text not null default '', notes text not null default '', proof_path text not null default '',
  employee_id uuid not null references public.profiles(id), verified_by uuid references public.profiles(id), verified_at timestamptz,
  original_payment_id uuid references public.payments(id), created_at timestamptz not null default now(),
  foreign key(store_id,sale_id) references public.sales(store_id,id), foreign key(store_id,customer_id) references public.customers(store_id,id),
  foreign key(store_id,method_id) references public.payment_methods(store_id,id), unique(store_id,id)
);
create unique index one_payment_reversal on public.payments(original_payment_id) where kind='reversal';
create table public.credit_ledger_entries (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, customer_id uuid not null, sale_id uuid, payment_id uuid,
  reference text not null, description text not null, debit numeric(14,2) not null default 0 check(debit>=0), credit numeric(14,2) not null default 0 check(credit>=0),
  employee_id uuid not null references public.profiles(id), created_at timestamptz not null default now(), check((debit>0 and credit=0) or (credit>0 and debit=0)),
  foreign key(store_id,customer_id) references public.customers(store_id,id), foreign key(store_id,sale_id) references public.sales(store_id,id),
  foreign key(store_id,payment_id) references public.payments(store_id,id)
);
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, coupon_id uuid not null, sale_id uuid not null unique, customer_id uuid,
  foreign key(store_id,coupon_id) references public.coupons(store_id,id), foreign key(store_id,sale_id) references public.sales(store_id,id),
  foreign key(store_id,customer_id) references public.customers(store_id,id), created_at timestamptz not null default now()
);
create table public.returns (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, code text not null unique, sale_id uuid not null, item_id uuid not null,
  quantity integer not null check(quantity>0), reason text not null check(length(trim(reason))>0),
  destination text not null check(destination in ('Sellable Stock','Damaged','Do Not Restore Stock')), location_id uuid,
  amount numeric(14,2) not null check(amount>0), credit_reduction numeric(14,2) not null check(credit_reduction>=0), manual_refund numeric(14,2) not null check(manual_refund>=0),
  employee_id uuid not null references public.profiles(id), approver_id uuid references public.profiles(id), created_at timestamptz not null default now(),
  foreign key(store_id,sale_id) references public.sales(store_id,id), foreign key(store_id,item_id) references public.sale_items(store_id,id),
  foreign key(store_id,location_id) references public.locations(store_id,id), check(amount=credit_reduction+manual_refund), unique(store_id,id)
);
create table public.out_for_test (
  id uuid primary key default gen_random_uuid(), store_id uuid not null, code text not null unique, customer_id uuid not null, product_id uuid not null, location_id uuid not null,
  quantity integer not null check(quantity>0), taken_date date not null, due_date date not null check(due_date>=taken_date),
  employee_id uuid not null references public.profiles(id), notes text not null default '', status text not null default 'OUT' check(status in ('OUT','RETURNED','CONVERTED TO SALE')),
  sale_id uuid, created_at timestamptz not null default now(), closed_at timestamptz,
  foreign key(store_id,customer_id) references public.customers(store_id,id), foreign key(store_id,product_id) references public.products(store_id,id),
  foreign key(store_id,location_id) references public.locations(store_id,id), foreign key(store_id,sale_id) references public.sales(store_id,id), unique(store_id,id)
);
alter table public.sales add foreign key(store_id,source_test_id) references public.out_for_test(store_id,id);
create table public.purchased_devices (
  product_id uuid primary key, store_id uuid not null, status text not null check(status in ('In Stock','Sold','Repair Needed','Reserved')),
  imei text, foreign key(store_id,product_id) references public.products(store_id,id), unique(store_id,imei)
);
create table private.transaction_requests (
  store_id uuid not null references public.stores(id), actor_id uuid not null references public.profiles(id), operation text not null,
  request_id uuid not null, payload_hash bytea not null, result jsonb not null, created_at timestamptz not null default now(),
  primary key(store_id,actor_id,operation,request_id)
);
create table private.transaction_approvals (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), seller_id uuid not null references public.profiles(id),
  approver_id uuid not null references public.profiles(id), purpose text not null, payload_hash bytea not null,
  token_hash bytea not null unique, expires_at timestamptz not null, consumed_at timestamptz, created_at timestamptz not null default now()
);
create table private.approval_attempts (
  store_id uuid not null, seller_id uuid not null, failures integer not null default 0, window_start timestamptz not null default now(), locked_until timestamptz,
  primary key(store_id,seller_id)
);
create index sales_branch_date on public.sales(store_id,created_at desc,id);
create index sales_customer on public.sales(store_id,customer_id,created_at desc);
create index payments_branch_date on public.payments(store_id,created_at desc);
create index credit_customer_date on public.credit_ledger_entries(store_id,customer_id,created_at,id);
create index test_branch_status on public.out_for_test(store_id,status,due_date);
create index return_sale_item on public.returns(store_id,item_id);
create index redemption_customer on public.coupon_redemptions(coupon_id,customer_id);
create function private.credit_balance(p_store uuid,p_customer uuid) returns numeric language sql stable security definer set search_path='' as $$
  select coalesce(sum(debit-credit),0) from public.credit_ledger_entries where store_id=p_store and customer_id=p_customer
$$;
create function private.profile_permission(p_profile uuid,p_store uuid,p_key text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p join public.store_memberships m on m.profile_id=p.id and m.active
    join public.stores s on s.id=m.store_id and s.status='active' where p.id=p_profile and p.status='active' and m.store_id=p_store
    and (p.role='owner' or exists(select 1 from public.employee_permissions ep join public.permissions k on k.id=ep.permission_id
      where ep.profile_id=p.id and ep.store_id=p_store and ep.enabled and k.key=p_key)))
$$;
create function private.settings(p_store uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
  select settings into v from public.business_settings where store_id=p_store;
  return coalesce(v,(select settings from public.business_settings limit 1),'{}'::jsonb)
    || (select jsonb_build_object('storeName',name,'branch',branch_name) from public.stores where id=p_store);
end $$;
-- Seed configuration, never fake customers or financial history.
insert into public.business_settings(store_id) select id from public.stores;
insert into public.payment_methods(store_id,name,kind,subtype) select id,'Cash','Cash','Cash' from public.stores;
create function private.cached_request(p_store uuid,p_operation text,p_request uuid,p_payload jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v private.transaction_requests;
begin
  if p_request is null then raise exception 'A request ID is required' using errcode='22023'; end if;
  select * into v from private.transaction_requests where store_id=p_store and actor_id=public.current_profile_id() and operation=p_operation and request_id=p_request;
  if v.request_id is not null and v.payload_hash<>extensions.digest(p_payload::text,'sha256') then
    raise exception 'Request ID was reused with different values' using errcode='22023';
  end if;
  return v.result;
end $$;
create function private.save_request(p_store uuid,p_operation text,p_request uuid,p_payload jsonb,p_result jsonb) returns void
language sql security definer set search_path='' as $$
  insert into private.transaction_requests(store_id,actor_id,operation,request_id,payload_hash,result)
  values(p_store,public.current_profile_id(),p_operation,p_request,extensions.digest(p_payload::text,'sha256'),p_result)
$$;
-- Only explicit scoped reads; no authenticated write policies or grants.
do $$ declare t text; predicate text; begin
  foreach t in array array['business_settings','customers','credit_accounts','payment_methods','coupons','sales','sale_items','sale_item_financials','payments','credit_ledger_entries','coupon_redemptions','returns','out_for_test','purchased_devices'] loop
    execute format('alter table public.%I enable row level security',t);
    predicate := case
      when t='sale_item_financials' then 'public.has_permission(''costs.view_purchase_cost'',store_id)'
      when t in ('credit_accounts','credit_ledger_entries') then '(public.has_permission(''credit.create'',store_id) or public.has_permission(''credit.receive_payment'',store_id))'
      when t in ('sales','sale_items','returns') then 'public.has_permission(''sales.view'',store_id)'
      when t='payments' then '(public.has_permission(''payments.approve_electronic'',store_id) or public.has_permission(''reports.view'',store_id))'
      when t='out_for_test' then 'public.has_permission(''inventory.transfer'',store_id)'
      when t='purchased_devices' then 'public.has_permission(''devices.buy_used'',store_id)'
      when t='customers' then '(public.has_permission(''sales.create'',store_id) or public.has_permission(''credit.create'',store_id) or public.has_permission(''credit.receive_payment'',store_id) or public.has_permission(''inventory.transfer'',store_id))'
      when t in ('payment_methods','business_settings','coupons') then 'public.can_access_store(store_id)'
      else 'public.has_permission(''settings.manage'',store_id)' end;
    execute format('create policy scoped_read on public.%I for select to authenticated using (%s)',t,predicate);
    execute format('revoke all on public.%I from anon,authenticated; grant select on public.%I to authenticated',t,t);
  end loop;
  foreach t in array array['transaction_requests','transaction_approvals','approval_attempts'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated',t);
  end loop;
  foreach t in array array['sale_items','sale_item_financials','credit_ledger_entries','returns','coupon_redemptions'] loop
    execute format('create trigger immutable before update or delete on public.%I for each row execute function private.append_only()',t);
  end loop;
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
commit;
