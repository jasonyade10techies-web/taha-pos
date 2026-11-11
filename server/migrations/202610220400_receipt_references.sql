begin;
-- Opaque customer-only capabilities. No account credentials or financial fields.
create table app_private.receipt_references (
 token_hash text primary key check(length(token_hash)=64),
 store_id uuid not null references public.stores(id),
 sale_id uuid not null references public.sales(id),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index receipt_references_expiry on app_private.receipt_references(expires_at);
revoke all on app_private.receipt_references from public,anon,authenticated;
alter function app_private.customer_receipt(uuid,uuid) rename to customer_receipt_before_5d2;
create function app_private.customer_receipt(p_store uuid,p_sale uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with base as (select app_private.customer_receipt_before_5d2(p_store,p_sale) receipt),
 totals as (select jsonb_build_object(
  'paymentsReceived',coalesce(sum((p->>'amount')::numeric) filter(where coalesce(p->>'kind','sale') not in ('refund','reversal')),0),
  'refunded',coalesce(sum((p->>'amount')::numeric) filter(where p->>'kind'='refund'),0),
  'reversed',coalesce(sum((p->>'amount')::numeric) filter(where p->>'kind'='reversal'),0)) value
  from jsonb_array_elements(private.sale_payments(p_sale)) p
  where coalesce(p->>'methodKind','')<>'Credit' and coalesce(p->>'status','Confirmed') not in ('Pending','Rejected'))
 select case when base.receipt is null then null else base.receipt||totals.value end from base,totals
$$;
revoke all on function app_private.customer_receipt(uuid,uuid) from public,anon,authenticated;
commit;
