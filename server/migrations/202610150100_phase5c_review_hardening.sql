begin;
-- HTTPS polling consumes resource/record IDs only. Private activity/condition
-- writes must participate even when they do not touch the available-stock ledger.
create function app_private.record_phase5c_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare resource text:=TG_ARGV[0];entity uuid;revision bigint;
begin
 if TG_TABLE_SCHEMA='private' and TG_TABLE_NAME='condition_movements' then
  select product_id into entity from private.damaged_lots where id=new.lot_id and store_id=new.store_id;
 elsif TG_TABLE_NAME='returns' then
  select customer_id into entity from public.sales where id=new.sale_id and store_id=new.store_id;
 else entity:=new.customer_id;end if;
 if entity is null then return new;end if;
 -- The shared head row serializes revision assignment with commit order, matching
 -- the existing stream. No snapshot, message, photo, contact or amount is copied.
 insert into app_private.sync_heads(store_id) values(new.store_id) on conflict do nothing;
 update app_private.sync_heads set revision=sync_heads.revision+1 where store_id=new.store_id returning sync_heads.revision into revision;
 insert into app_private.sync_changes(store_id,revision,resource,entity_id,operation) values(new.store_id,revision,resource,entity::text,'UPSERT');
 return new;
end $$;
create trigger phase5c_revision after insert on private.condition_movements for each row execute function app_private.record_phase5c_revision('stock');
create trigger phase5c_revision after insert on private.customer_notes for each row execute function app_private.record_phase5c_revision('customers');
create trigger phase5c_revision after insert on private.reminder_history for each row execute function app_private.record_phase5c_revision('customers');
create trigger phase5c_revision after insert on public.credit_ledger_entries for each row execute function app_private.record_phase5c_revision('customers');
create trigger phase5c_revision after insert on public.returns for each row execute function app_private.record_phase5c_revision('customers');
create trigger phase5c_revision after insert or update on public.out_for_test for each row execute function app_private.record_phase5c_revision('customers');
create trigger phase5c_revision after insert or update on public.repair_services for each row execute function app_private.record_revision('services');
revoke all on function app_private.record_phase5c_revision() from public,anon,authenticated;

-- Unallocated historical credits cannot safely be assigned to an invoice. If
-- invoice-level balances do not reconcile to the complete ledger, show exactly
-- one account obligation instead of overstating invoices or inventing allocations.
alter function public.reminder_obligations(uuid,uuid) rename to reminder_obligations_before_review;
revoke all on function public.reminder_obligations_before_review(uuid,uuid) from public,anon,authenticated;
create function public.reminder_obligations(p_store_id uuid,p_customer_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare original jsonb;result jsonb;customer public.customers;balance numeric;invoices numeric;unallocated numeric;occurred timestamptz;config jsonb:=private.settings(p_store_id);due jsonb;
begin
 original:=public.reminder_obligations_before_review(p_store_id,p_customer_id);
 if not (public.has_permission('credit.create',p_store_id) or public.has_permission('credit.receive_payment',p_store_id)) then return original;end if;
 select coalesce(jsonb_agg(value),'[]') into result from jsonb_array_elements(original) where value->>'kind'<>'credit';
 for customer in select * from public.customers where store_id=p_store_id and (p_customer_id is null or id=p_customer_id) loop
  balance:=private.credit_balance(p_store_id,customer.id);if balance<=0 then continue;end if;
  select coalesce(sum((value->>'amount')::numeric),0) into invoices from jsonb_array_elements(original) where value->>'kind'='credit' and value->>'customerId'=customer.id::text and value ? 'saleId';
  select coalesce(sum(debit-credit),0),min(created_at) into unallocated,occurred from public.credit_ledger_entries where store_id=p_store_id and customer_id=customer.id and sale_id is null;
  if unallocated=0 and invoices=balance then
   result:=result||(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(original) where value->>'kind'='credit' and value->>'customerId'=customer.id::text and value ? 'saleId');
  else
   select min(created_at) into occurred from public.credit_ledger_entries where store_id=p_store_id and customer_id=customer.id;
   due:=case when customer.due_at is not null then to_jsonb(customer.due_at) end;
   result:=result||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id','credit-account:'||customer.id,'kind','credit','customerId',customer.id,'customerName',customer.name,
    'phone',customer.phone,'whatsappNumber',private.resolved_whatsapp(customer),'reference','Account balance','description','Account balance · historical payments are not fully linked to invoices',
    'occurredAt',occurred,'dueAt',due,'amount',balance,'status',private.reminder_status(due#>>'{}',coalesce((config->>'reminderWarningDays')::integer,3)),
    'reminderEnabled',coalesce((config->>'remindersEnabled')::boolean,false) and customer.reminder_enabled)));
  end if;
 end loop;
 return (select coalesce(jsonb_agg(value order by (value->>'occurredAt')::timestamptz,value->>'id'),'[]') from jsonb_array_elements(result));
end $$;
revoke all on function public.reminder_obligations(uuid,uuid) from public,anon;
grant execute on function public.reminder_obligations(uuid,uuid) to authenticated;
commit;
