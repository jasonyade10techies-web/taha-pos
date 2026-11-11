begin;
-- A per-store row lock orders revisions by commit. A sequence alone can skip an
-- earlier, still-uncommitted change when a later transaction commits first.
create table app_private.sync_heads(store_id uuid primary key references public.stores(id), revision bigint not null default 0);
create table app_private.sync_changes(store_id uuid not null references public.stores(id), revision bigint not null, resource text not null, entity_id text not null, operation text not null check(operation in ('UPSERT','DELETE')), created_at timestamptz not null default now(), primary key(store_id,revision));
create index sync_changes_created on app_private.sync_changes(created_at);
create table app_private.offline_imports(request_id uuid primary key,store_id uuid not null references public.stores(id),terminal_id uuid not null,profile_id uuid not null references public.profiles(id),sale_id uuid not null references public.sales(id),captured_at timestamptz not null,imported_at timestamptz not null default now(),invoice text not null unique);
create function app_private.record_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare s uuid; entity text; r bigint;
begin
 s:=coalesce((to_jsonb(new)->>'store_id')::uuid,(to_jsonb(old)->>'store_id')::uuid);
 entity:=case when TG_ARGV[0]='stock' then coalesce(to_jsonb(new)->>'product_id',to_jsonb(old)->>'product_id') else coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',s::text) end;
 insert into app_private.sync_heads(store_id) values(s) on conflict do nothing;
 update app_private.sync_heads set revision=revision+1 where store_id=s returning revision into r;
 insert into app_private.sync_changes values(s,r,TG_ARGV[0],entity,case when TG_OP='DELETE' then 'DELETE' else 'UPSERT' end,now());
 return coalesce(new,old);
end $$;
do $$ declare t text; resource text; begin
 for t,resource in select * from (values ('products','products'),('locations','locations'),('stock_movements','stock'),('customers','customers'),('sales','sales'),('payments','payments'),('payment_methods','payment-methods'),('business_settings','settings'),('employee_permissions','permissions')) v loop
 execute format('create trigger desktop_revision after insert or update or delete on public.%I for each row execute function app_private.record_revision(%L)',t,resource);
 end loop;
end $$;
-- Stable UUID-based invoices are assigned BEFORE all receipt/audit/idempotency
-- snapshots are produced. Only the authenticated import service sets this
-- transaction-local value, after verifying a signed offline grant.
do $$ declare source text; begin
 source:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 if position('code:=private.next_code(' in source)=0 then raise exception 'Invoice assignment changed; review offline integration'; end if;
 source:=replace(source,$s$code:=private.next_code('private.invoice_number','TM-INV-');$s$,$s$code:=coalesce(nullif(current_setting('taha.offline_invoice',true),''),private.next_code('private.invoice_number','TM-INV-'));$s$);
 execute source;
end $$;
revoke all on all functions in schema app_private from public,anon,authenticated;
commit;
