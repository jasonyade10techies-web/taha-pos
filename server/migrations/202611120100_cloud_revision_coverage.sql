begin;
-- A shared head row preserves commit order. Never substitute a sequence or an
-- instance-local notification for this durable, transaction-bound stream.
create function app_private.emit_revision(p_store uuid,p_resource text,p_entity text,p_operation text default 'UPSERT') returns void
language plpgsql security definer set search_path='' as $$
declare next_revision bigint;
begin
 if p_store is null or p_entity is null then return;end if;
 insert into app_private.sync_heads(store_id) values(p_store) on conflict do nothing;
 update app_private.sync_heads set revision=revision+1 where store_id=p_store returning revision into next_revision;
 insert into app_private.sync_changes(store_id,revision,resource,entity_id,operation)
 values(p_store,next_revision,p_resource,p_entity,p_operation);
end $$;

create or replace function app_private.record_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare value jsonb;shop uuid;entity_column text;
begin
 if TG_OP='UPDATE' and (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new;end if;
 value:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 shop:=(value->>'store_id')::uuid;
 entity_column:=coalesce(nullif(TG_ARGV[1],''),case when TG_ARGV[0]='stock' then 'product_id' else 'id' end);
 perform app_private.emit_revision(shop,TG_ARGV[0],coalesce(value->>entity_column,shop::text),case when TG_OP='DELETE' then 'DELETE' else 'UPSERT' end);
 return case when TG_OP='DELETE' then old else new end;
end $$;

drop trigger desktop_revision on public.employee_permissions;
create trigger desktop_revision after insert or update or delete on public.employee_permissions
 for each row execute function app_private.record_revision('permissions','profile_id');
drop trigger phase5c_revision on public.repair_services;
create trigger phase5c_revision after insert or update or delete on public.repair_services
 for each row execute function app_private.record_revision('services');

do $$declare item record;begin
 for item in select * from (values
  ('repair_jobs','jobs','id'),('shifts','shifts','id'),
  ('catalog_values','catalog','store_id'),('suppliers','suppliers','id'),
  ('stock_receipts','receiving','id'),('stock_receipt_lines','receiving','receipt_id'),
  ('stock_receipt_costs','receiving','receipt_id'),('product_financials','products','product_id'),
  ('returns','returns','sale_id'),('credit_accounts','customers','customer_id'),
  ('purchased_devices','purchased-devices','id'),('coupons','coupons','id'),
  ('audit_logs','audit','id'),('store_memberships','permissions','profile_id')
 ) v(table_name,resource,entity_column) loop
  execute format('create trigger cloud_revision after insert or update or delete on public.%I for each row execute function app_private.record_revision(%L,%L)',item.table_name,item.resource,item.entity_column);
 end loop;
end $$;

create function app_private.profile_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare shop uuid;value jsonb;
begin
 if TG_OP='UPDATE' and (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new;end if;
 value:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_TABLE_NAME='stores' then
  perform app_private.emit_revision((value->>'id')::uuid,'settings',value->>'id');
 else
  for shop in select store_id from public.store_memberships where profile_id=(value->>'id')::uuid order by store_id loop
   perform app_private.emit_revision(shop,'employees',value->>'id',case when TG_OP='DELETE' then 'DELETE' else 'UPSERT' end);
  end loop;
 end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
create trigger cloud_revision after insert or update or delete on public.profiles for each row execute function app_private.profile_revision();
create trigger cloud_revision after update on public.stores for each row execute function app_private.profile_revision();

-- Gallery metadata changes are committed independently of product forms.
-- Unbound drafts are deliberately absent; no bytes, URLs, costs or names enter
-- the stream. Notify both old and new attachments when a file is detached.
create function app_private.media_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare value jsonb;previous jsonb;resource text;
begin
 if TG_OP='UPDATE' and to_jsonb(new) is not distinct from to_jsonb(old) then return new;end if;
 previous:=case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end;
 for value in select distinct jsonb_build_object('store_id',v->'store_id','kind',v->'kind','entity_id',v->'entity_id') from (values(previous),(case when TG_OP<>'DELETE' then to_jsonb(new) else null end)) x(v) where v->>'entity_id' is not null loop
  resource:=case value->>'kind' when 'product' then 'products' when 'customer' then 'customers' when 'profile' then 'employees' when 'repair' then 'jobs' when 'device' then 'purchased-devices' when 'proof' then 'payments' when 'payment-qr' then 'payment-methods' when 'damage' then 'stock' end;
  if resource is not null then perform app_private.emit_revision((value->>'store_id')::uuid,resource,value->>'entity_id');end if;
 end loop;
 return case when TG_OP='DELETE' then old else new end;
end $$;
create trigger cloud_revision after insert or update or delete on app_private.media for each row execute function app_private.media_revision();

-- Presence/camera delivery already uses its own protected database-backed REST
-- polling and LAN bridge. Do not turn last_seen/auth session heartbeats into
-- business revisions or broadcast camera requests through this stream.
revoke all on function app_private.emit_revision(uuid,text,text,text),app_private.record_revision(),app_private.profile_revision(),app_private.media_revision() from public,anon,authenticated;
commit;
