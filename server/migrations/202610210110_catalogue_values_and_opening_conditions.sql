begin;
alter table public.catalog_values add column id uuid not null default gen_random_uuid();
alter table public.catalog_values add constraint catalogue_value_identity unique(id);
create index catalogue_value_normalized on public.catalog_values(store_id,kind,lower(regexp_replace(trim(value),'\s+',' ','g')));
create function public.save_catalog_value(p_store_id uuid,p_kind text,p_value text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.catalog_values;
begin
 if not(public.has_permission('products.create',p_store_id) or public.has_permission('products.edit',p_store_id)) then raise exception 'Product catalogue permission required' using errcode='42501';end if;
 perform private.lock_store(p_store_id);p_value:=regexp_replace(trim(p_value),'\s+',' ','g');
 if p_kind not in ('category','brand','model','grade','color') or length(p_value) not between 1 and 120 then raise exception 'Enter a valid catalogue value' using errcode='22023';end if;
 select * into v from public.catalog_values where store_id=p_store_id and kind=p_kind and lower(regexp_replace(trim(value),'\s+',' ','g'))=lower(p_value) order by created_at,id limit 1;
 if v.id is null then insert into public.catalog_values(store_id,kind,value) values(p_store_id,p_kind,p_value) returning * into v;perform private.write_audit(p_store_id,public.current_profile_id(),'catalogue.value_created','catalogue',v.id,jsonb_build_object('kind',p_kind,'value',p_value));end if;
 return jsonb_build_object('id',v.id,'kind',v.kind,'value',v.value);
end $$;

create or replace function private.remember_product_values(p_product public.products) returns void language plpgsql security definer set search_path='' as $$
declare k text;v text;
begin
 for k,v in select * from (values ('category',p_product.category),('brand',p_product.brand),('model',p_product.compatible_model),('grade',p_product.quality_grade),('color',p_product.color_variant))t(k,v) loop
  if length(trim(v))>0 then perform public.save_catalog_value(p_product.store_id,k,v);end if;
 end loop;
end $$;

-- Generalize existing append-only quarantine lots to actual opening/receiving sources.
-- Historical return-linked rows and their original foreign keys are retained.
alter table private.damaged_lots alter column sale_id drop not null,alter column return_id drop not null,alter column item_id drop not null;
alter table private.damaged_lots add column origin_type text not null default 'return' check(origin_type in ('return','opening','receipt')),add column origin_id uuid;
alter table private.damaged_lots add constraint damage_origin_valid check(origin_type<>'return' or (sale_id is not null and return_id is not null and item_id is not null));
do $$declare src text;begin
 src:=pg_get_functiondef('private.damaged_rows(uuid,uuid)'::regprocedure);
 src:=replace(src,'join public.sales sale on sale.id=d.sale_id','left join public.sales sale on sale.id=d.sale_id');
 src:=regexp_replace(src,'''invoice'',sale.invoice','''invoice'',coalesce(sale.invoice,case d.origin_type when ''opening'' then ''Opening inventory'' else ''Stock receipt'' end),''originType'',d.origin_type,''originId'',d.origin_id');
 execute src;
end $$;

alter function public.save_product(uuid,jsonb) rename to save_product_before_5d1;
revoke all on function public.save_product_before_5d1(uuid,jsonb) from public,anon,authenticated;
create function public.save_product(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare condition text:=coalesce(p_input->>'initial_condition','Available');opening integer:=coalesce((p_input->>'initial_quantity')::integer,0);result jsonb;lot uuid;loc uuid:=nullif(p_input->>'default_location_id','')::uuid;pid uuid;
begin
 perform private.lock_store(p_store_id);
 if condition not in ('Available','Damaged') then raise exception 'Select Sellable or Damaged stock condition' using errcode='22023';end if;
 if condition='Damaged' and opening>0 then
  perform private.require_permission('inventory.adjust',p_store_id);perform private.require_condition_box(p_store_id,loc,'Damaged');
  if exists(select 1 from public.products where id=nullif(p_input->>'id','')::uuid) then raise exception 'Existing stock condition changes need the audited quarantine workflow' using errcode='22023';end if;
  if lower(trim(p_input->>'category')) in ('services','service','phones','used phones') then raise exception 'Use the appropriate service or individual device workflow' using errcode='22023';end if;
  result:=public.save_product_before_5d1(p_store_id,p_input||jsonb_build_object('initial_quantity',0,'default_location_id',null));pid:=(result->>'id')::uuid;
  insert into private.damaged_lots(store_id,product_id,original_quantity,reason,actor_id,origin_type,origin_id) values(p_store_id,pid,opening,'Damaged opening inventory',public.current_profile_id(),'opening',pid) returning id into lot;
  insert into private.condition_movements(store_id,lot_id,location_id,quantity,action,request_id,actor_id,notes) values(p_store_id,lot,loc,opening,'return',pid,public.current_profile_id(),'Opening inventory · Damaged');
  perform private.write_audit(p_store_id,public.current_profile_id(),'stock.opening_damaged','product',pid,jsonb_build_object('quantity',opening,'locationId',loc,'lotId',lot));return result;
 end if;
 return public.save_product_before_5d1(p_store_id,p_input-'initial_condition');
end $$;

alter table public.stock_receipt_lines add column condition text not null default 'Available' check(condition in ('Available','Damaged'));
create or replace function public.save_stock_receipt(p_store_id uuid,p_input jsonb,p_receive boolean) returns void language plpgsql security definer set search_path='' as $$
declare receipt uuid:=(p_input->>'id')::uuid;line jsonb;i integer:=0;pid uuid;loc uuid;qty integer;old public.stock_receipts;condition text;lot uuid;
begin
 perform private.require_permission('inventory.receive',p_store_id);perform private.lock_store(p_store_id);
 select * into old from public.stock_receipts where id=receipt;
 if old.id is not null and old.store_id<>p_store_id then raise exception 'Access denied' using errcode='42501';end if;
 if old.status='Received' then raise exception 'Receipt already received' using errcode='23505';end if;
 if jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines') not between 1 and 200 then raise exception 'Add between 1 and 200 receipt lines' using errcode='22023';end if;
 insert into public.stock_receipts(id,store_id,supplier_id,reference,received_date,status,actor_profile_id) values(receipt,p_store_id,(p_input->>'supplier_id')::uuid,coalesce(p_input->>'reference',''),(p_input->>'date')::date,case when p_receive then 'Received' else 'Draft' end,public.current_profile_id())
 on conflict(id) do update set supplier_id=excluded.supplier_id,reference=excluded.reference,received_date=excluded.received_date,status=excluded.status,actor_profile_id=excluded.actor_profile_id;
 if exists(select 1 from public.stock_receipt_costs where receipt_id=receipt) then perform private.require_permission('costs.view_purchase_cost',p_store_id);end if;
 delete from public.stock_receipt_costs where receipt_id=receipt;delete from public.stock_receipt_lines where receipt_id=receipt;
 for line in select value from jsonb_array_elements(p_input->'lines') loop
  i:=i+1;pid:=(line->>'product_id')::uuid;loc:=(line->>'location_id')::uuid;qty:=(line->>'quantity')::integer;condition:=coalesce(line->>'condition','Available');
  if qty<=0 or qty is null then raise exception 'Positive whole quantities required' using errcode='22023';end if;
  if not exists(select 1 from public.products where id=pid and store_id=p_store_id and state='active' and lower(trim(category)) not in ('services','service','phones','used phones')) then raise exception 'Select an active physical stock product; services and individually tracked phones use their own workflow' using errcode='22023';end if;
  perform private.require_condition_box(p_store_id,loc,condition);
  insert into public.stock_receipt_lines(receipt_id,store_id,line_no,product_id,location_id,quantity,condition) values(receipt,p_store_id,i,pid,loc,qty,condition);
  if line ? 'purchase_cost' and line->'purchase_cost'<>'null'::jsonb then
   perform private.require_permission('costs.view_purchase_cost',p_store_id);
   insert into public.stock_receipt_costs(receipt_id,store_id,line_no,purchase_cost) values(receipt,p_store_id,i,(line->>'purchase_cost')::numeric);
   if p_receive then insert into public.product_financials(product_id,store_id,purchase_cost,updated_by) values(pid,p_store_id,(line->>'purchase_cost')::numeric,public.current_profile_id()) on conflict(product_id) do update set purchase_cost=excluded.purchase_cost,updated_by=excluded.updated_by;end if;
  end if;
  if p_receive then
   if condition='Available' then insert into public.stock_movements(store_id,product_id,location_id,quantity,movement_type,reference_type,reference_id,actor_profile_id) values(p_store_id,pid,loc,qty,'RECEIVE','receipt',receipt,public.current_profile_id());
   else
    insert into private.damaged_lots(store_id,product_id,original_quantity,reason,actor_id,origin_type,origin_id) values(p_store_id,pid,qty,'Damaged stock received',public.current_profile_id(),'receipt',receipt) returning id into lot;
    insert into private.condition_movements(store_id,lot_id,location_id,quantity,action,request_id,actor_id,notes) values(p_store_id,lot,loc,qty,'return',receipt,public.current_profile_id(),'Damaged stock receipt');
   end if;
  end if;
 end loop;
 perform private.write_audit(p_store_id,public.current_profile_id(),case when p_receive then 'stock.received' else 'stock.draft_saved' end,'receipt',receipt,jsonb_build_object('lines',i));
end $$;
revoke all on function public.save_catalog_value(uuid,text,text),public.save_product(uuid,jsonb),public.save_stock_receipt(uuid,jsonb,boolean) from public,anon;
grant execute on function public.save_catalog_value(uuid,text,text),public.save_product(uuid,jsonb),public.save_stock_receipt(uuid,jsonb,boolean) to authenticated;
commit;
