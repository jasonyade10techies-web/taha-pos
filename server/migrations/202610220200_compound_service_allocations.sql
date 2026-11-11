begin;
-- New sales only. Never backfill a price allocation into historical service receipts.
create table private.compound_service_allocations(
 item_id uuid primary key,store_id uuid not null,sale_id uuid not null,product_id uuid not null,
 product_selling_basis numeric(14,2) not null check(product_selling_basis>=0),product_minimum_basis numeric(14,2) not null check(product_minimum_basis>=0),
 product_revenue numeric(14,2) not null check(product_revenue>=0),labor_revenue numeric(14,2) not null check(labor_revenue>=0),
 product_discount numeric(14,2) not null check(product_discount>=0),product_tax numeric(14,2) not null check(product_tax>=0),labor_tax numeric(14,2) not null check(labor_tax>=0),
 product_total numeric(14,2) not null check(product_total>=0),labor_total numeric(14,2) not null check(labor_total>=0),
 actor_id uuid not null references public.profiles(id),approver_id uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now(),
 foreign key(store_id,item_id) references public.sale_items(store_id,id),foreign key(store_id,sale_id) references public.sales(store_id,id),foreign key(product_id,store_id) references public.products(id,store_id),
 check(product_total=product_revenue+product_tax),check(labor_total=labor_revenue+labor_tax)
);
create table private.compound_return_allocations(
 return_id uuid primary key references public.returns(id),item_id uuid not null references private.compound_service_allocations(item_id),
 product_amount numeric(14,2) not null check(product_amount>=0),labor_amount numeric(14,2) not null check(labor_amount>=0),
 product_tax numeric(14,2) not null check(product_tax>=0),labor_tax numeric(14,2) not null check(labor_tax>=0),refund_labor boolean not null,
 actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
alter table private.compound_service_allocations enable row level security;
alter table private.compound_return_allocations enable row level security;
revoke all on private.compound_service_allocations,private.compound_return_allocations from public,anon,authenticated;
create trigger immutable before update or delete on private.compound_service_allocations for each row execute function private.append_only();
create trigger immutable before update or delete on private.compound_return_allocations for each row execute function private.append_only();

create function private.compound_sale_json(p_item uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('productSellingBasis',product_selling_basis,'productMinimumBasis',product_minimum_basis,
 'productRevenue',product_revenue,'laborRevenue',labor_revenue,'productDiscount',product_discount,
 'productTax',product_tax,'laborTax',labor_tax,'productTotal',product_total,'laborTotal',labor_total)
 from private.compound_service_allocations where item_id=p_item
$$;
create function private.compound_price_payload(p_store uuid,p_product uuid,p_cart text,p_price numeric,p_reason text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare material jsonb;
begin
 select input->'material' into material from private.custom_service_lines where store_id=p_store and product_id=p_product;
 return jsonb_build_object('cartId',p_cart,'productId',coalesce(material->>'productId',p_product::text),
 'price',case when material is null then p_price else trim_scale(round(p_price/(material->>'quantity')::numeric,2)) end,'reason',p_reason);
end $$;
create function private.snapshot_compound_service(p_store uuid,p_item uuid,p_input jsonb,p_line jsonb,p_material jsonb) returns void language plpgsql security definer set search_path='' as $$
declare i public.sale_items;p public.products;settings jsonb:=private.settings(p_store); units integer:=(p_material->>'quantity')::integer;
 accepted numeric;basis numeric;minimum numeric;product_gross numeric;labor_gross numeric;product_tax numeric;labor_tax numeric;approver uuid;reviewed timestamptz;
begin
 select * into i from public.sale_items where id=p_item and store_id=p_store;
 select * into p from public.products where id=(p_material->>'productId')::uuid and store_id=p_store and state='active' and category<>'Services' and not custom_sale_only;
 if p.id is null then raise exception 'Select an active inventory component; review the linked part' using errcode='22023';end if;
 if p_material ? 'pricing' then
  perform private.workflow_fields(p_material->'pricing',array['sellingPrice','minimumSellingPrice','reviewedAt']);
  perform private.workflow_money(p_material->'pricing','sellingPrice');perform private.workflow_money(p_material->'pricing','minimumSellingPrice');
  if jsonb_typeof(p_material->'pricing'->'reviewedAt')<>'string' or nullif(p_material->'pricing'->>'reviewedAt','') is null then raise exception 'Review the current material price' using errcode='22023';end if;
  reviewed:=(p_material->'pricing'->>'reviewedAt')::timestamptz;
  if (p_material->'pricing'->>'sellingPrice')::numeric<>p.selling_price or (p_material->'pricing'->>'minimumSellingPrice')::numeric<>p.minimum_selling_price then
   raise exception 'Material price or minimum price changed; explicitly review the current linked product price before checkout' using errcode='40001';end if;
 end if;
 basis:=p.selling_price*units*i.quantity;minimum:=p.minimum_selling_price*units*i.quantity;
 accepted:=i.total-case when i.tax_exclusive then i.tax_amount else 0 end;
 if i.unit_price<p.selling_price*units then
  perform private.require_permission('pricing.discount_within_range',p_store);
  if not coalesce((settings->>'bargaining')::boolean,true) or length(trim(coalesce(p_line->>'reason','')))=0 then raise exception 'Product discount needs bargaining enabled and a reason' using errcode='22023';end if;
 end if;
 if accepted<minimum then
  if settings->>'belowMinimum'='Block' then raise exception 'Below-minimum material pricing is blocked' using errcode='22023';end if;
  -- A coupon cannot turn an earlier price approval into approval of a lower price.
  if i.coupon_discount>0 then raise exception 'Coupon would violate the linked product minimum floor' using errcode='22023';end if;
  approver:=i.approver_id;
  if approver is null then approver:=private.consume_approval(p_store,'price',private.compound_price_payload(p_store,i.product_id,p_input->>'cartId',i.unit_price,p_line->>'reason'),p_line->'approval'->>'token');end if;
  perform private.write_audit(p_store,public.current_profile_id(),'pricing.material_minimum_overridden','sale',i.sale_id,
   jsonb_build_object('itemId',i.id,'productId',p.id,'minimum',minimum,'accepted',accepted,'approverId',approver,'reason',p_line->>'reason'));
 end if;
 product_gross:=least(accepted,basis);labor_gross:=accepted-product_gross;
 product_tax:=case when accepted=0 then 0 else least(i.tax_amount,round(i.tax_amount*product_gross/accepted,2)) end;labor_tax:=i.tax_amount-product_tax;
 insert into private.compound_service_allocations(item_id,store_id,sale_id,product_id,product_selling_basis,product_minimum_basis,product_revenue,labor_revenue,product_discount,product_tax,labor_tax,product_total,labor_total,actor_id,approver_id,reviewed_at)
 values(i.id,p_store,i.sale_id,p.id,basis,minimum,product_gross-case when i.tax_exclusive then 0 else product_tax end,labor_gross-case when i.tax_exclusive then 0 else labor_tax end,
 basis-product_gross,product_tax,labor_tax,product_gross+case when i.tax_exclusive then product_tax else 0 end,labor_gross+case when i.tax_exclusive then labor_tax else 0 end,public.current_profile_id(),approver,reviewed);
end $$;
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('private.service_material_cost(uuid,uuid)'::regprocedure);
 needle:='array[''productId'',''quantity'',''allocations'']';if position(needle in source)=0 then raise exception 'Review material input contract';end if;
 execute replace(source,needle,'array[''productId'',''quantity'',''allocations'',''pricing'']');
 source:=pg_get_functiondef('private.consume_service_materials(uuid,uuid,jsonb)'::regprocedure);
 source:=replace(source,needle,'array[''productId'',''quantity'',''allocations'',''pricing'']');
 needle:='select purchase_cost into cost from public.product_financials where store_id=p_store and product_id=product.id;';
 if position(needle in source)=0 then raise exception 'Review compound snapshot insertion hook';end if;
 execute replace(source,needle,'perform private.snapshot_compound_service(p_store,item.id,p_input,line,material); '||needle);
 source:=pg_get_functiondef('private.sale_json(uuid,uuid)'::regprocedure);needle:='''material'',private.sale_material_json(i.id)';
 if position(needle in source)=0 then raise exception 'Review compound DTO hook';end if;
 execute replace(source,needle,'''compound'',private.compound_sale_json(i.id),'||needle);
 source:=pg_get_functiondef('private.receipt_lookup_sale(uuid,uuid)'::regprocedure);needle:='line-''minimumPrice''-''approval''-''reason''';
 if position(needle in source)=0 then raise exception 'Review receipt candidate floor privacy';end if;
 execute replace(source,needle,'(line-''minimumPrice''-''approval''-''reason'')||case when jsonb_typeof(line->''compound'')=''object'' then jsonb_build_object(''compound'',(line->''compound'')-''productMinimumBasis'') else ''{}''::jsonb end');
 source:=pg_get_functiondef('public.complete_catalog_sale(uuid,jsonb)'::regprocedure);
 needle:='qty:=(line->>''quantity'')::integer; price:=(line->>''unitPrice'')::numeric;';
 if position(needle in source)=0 then raise exception 'Review linked template sale guard';end if;
 source:=replace(source,needle,'if exists(select 1 from public.repair_services where id=p.id and store_id=p_store_id and linked_product_id is not null) then raise exception ''Review this linked template in Custom Service and select its material locations before checkout'' using errcode=''22023'';end if; '||needle);
 needle:='jsonb_build_object(''cartId'',p_input->>''cartId'',''productId'',p.id,''price'',price,''reason'',line->>''reason'')';
 if position(needle in source)=0 then raise exception 'Review original material approval identity';end if;
 execute replace(source,needle,'private.compound_price_payload(p_store_id,p.id,p_input->>''cartId'',price,line->>''reason'')');
end $$;

create function private.compound_return_portion(p_item uuid,p_previous integer,p_quantity integer,p_labor boolean,p_tax boolean default false) returns numeric language sql stable security definer set search_path='' as $$
 select round((case when p_tax then a.product_tax else a.product_total end)*(p_previous+p_quantity)/i.quantity,2)-round((case when p_tax then a.product_tax else a.product_total end)*p_previous/i.quantity,2)
 +case when p_labor then round((case when p_tax then a.labor_tax else a.labor_total end)*(p_previous+p_quantity)/i.quantity,2)-round((case when p_tax then a.labor_tax else a.labor_total end)*p_previous/i.quantity,2) else 0 end
 from private.compound_service_allocations a join public.sale_items i on i.id=a.item_id where a.item_id=p_item
$$;
create function private.snapshot_compound_return(p_return uuid,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.returns;previous integer;labor boolean:=coalesce((p_input->>'refundLabor')::boolean,false);product_amount numeric;product_tax numeric;
begin
 select * into r from public.returns where id=p_return;
 if not exists(select 1 from private.compound_service_allocations where item_id=r.item_id) then return;end if;
 select coalesce(sum(quantity),0) into previous from public.returns where item_id=r.item_id and id<>r.id;
 product_amount:=private.compound_return_portion(r.item_id,previous,r.quantity,false);
 product_tax:=private.compound_return_portion(r.item_id,previous,r.quantity,false,true);
 insert into private.compound_return_allocations(return_id,item_id,product_amount,labor_amount,product_tax,labor_tax,refund_labor,actor_id)
 values(r.id,r.item_id,product_amount,r.amount-product_amount,product_tax,private.compound_return_portion(r.item_id,previous,r.quantity,labor,true)-product_tax,labor,public.current_profile_id());
end $$;
do $$declare source text;needle text;begin
 source:=pg_get_functiondef('public.return_sale_item(uuid,jsonb)'::regprocedure);
 needle:='if (settings->>''returnApproval'')::boolean then';if position(needle in source)=0 then raise exception 'Review labor refund authorization';end if;
 source:=replace(source,needle,'if p_input ? ''refundLabor'' and jsonb_typeof(p_input->''refundLabor'')<>''boolean'' then raise exception ''Choose a valid labor refund policy'' using errcode=''22023'';end if;
 if coalesce((p_input->>''refundLabor'')::boolean,false) then perform private.require_permission(''returns.approve'',p_store_id);end if;
 '||needle);
 needle:='amount:=case when previous+qty=i.quantity then i.total-coalesce((select sum(r.amount) from public.returns r where r.item_id=i.id),0) else round(i.total*qty/i.quantity,2) end;';
 if position(needle in source)=0 then raise exception 'Review compound refund amount integration';end if;
 source:=replace(source,needle,'amount:=coalesce(private.compound_return_portion(i.id,previous,qty,coalesce((p_input->>''refundLabor'')::boolean,false)),case when previous+qty=i.quantity then i.total-coalesce((select sum(r.amount) from public.returns r where r.item_id=i.id),0) else round(i.total*qty/i.quantity,2) end);');
 needle:='cached:=private.return_json(rid);';if position(needle in source)=0 then raise exception 'Review compound return snapshot hook';end if;
 execute replace(source,needle,'perform private.snapshot_compound_return(rid,p_input); '||needle);
 source:=pg_get_functiondef('private.return_json(uuid)'::regprocedure);needle:='''amount'',r.amount';if position(needle in source)=0 then raise exception 'Review compound return DTO';end if;
 execute replace(source,needle,'''taxAmount'',coalesce((select a.product_tax+a.labor_tax from private.compound_return_allocations a where a.return_id=r.id),round(i.tax_amount*r.quantity/i.quantity,2)),''refundLabor'',coalesce((select refund_labor from private.compound_return_allocations where return_id=r.id),false),'||needle);
 -- Profit excludes only tax actually refunded, preserving retained labor revenue/tax.
 foreach needle in array array['private.period_profit(uuid,date,date)','public.get_dashboard_range(uuid,date,date)'] loop
  source:=pg_get_functiondef(needle::regprocedure);
  if position('coalesce((select ti.tax_amount*r.quantity/ti.quantity from public.sale_items ti where ti.id=r.item_id),0)' in source)=0 then raise exception 'Review refund profit tax allocation in %',needle;end if;
  execute replace(source,'coalesce((select ti.tax_amount*r.quantity/ti.quantity from public.sale_items ti where ti.id=r.item_id),0)',
   'coalesce((select a.product_tax+a.labor_tax from private.compound_return_allocations a where a.return_id=r.id),(select ti.tax_amount*r.quantity/ti.quantity from public.sale_items ti where ti.id=r.item_id),0)');
 end loop;
end $$;

alter table public.repair_services add column linked_product_id uuid,add column default_labor_charge numeric(14,2) check(default_labor_charge>=0),
 add column pricing_rule text check(pricing_rule='current-product-plus-labor'),add column description text not null default '',add column updated_by uuid references public.profiles(id),
 add foreign key(linked_product_id,store_id) references public.products(id,store_id);
alter function public.save_repair_service(uuid,jsonb) rename to save_repair_service_before_compound;
revoke all on function public.save_repair_service_before_compound(uuid,jsonb) from public,anon,authenticated;
create function public.save_repair_service(p_store_id uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;pid uuid;product public.products;existing public.repair_services;previous public.repair_services;labor numeric;rule text;
begin
 if not (public.has_permission('repair.services.manage',p_store_id) or public.has_permission('services.save_catalog',p_store_id)) then raise exception 'Service catalog permission required' using errcode='42501';end if;
 perform private.lock_store(p_store_id);
 perform private.workflow_fields(p_input,array['id','name','category','sellingPrice','minimumSellingPrice','active','notes','linkedProductId','defaultLaborCharge','pricingRule','description']);
 select * into existing from public.repair_services where store_id=p_store_id and private.normalized_service_name(name)=private.normalized_service_name(p_input->>'name') order by created_at,id limit 1;
 -- Preserve the existing normalized-name reuse rule and never mutate a duplicate's linkage.
 if existing.id is not null and existing.id is distinct from nullif(p_input->>'id','')::uuid then
  return public.save_repair_service_before_compound(p_store_id,p_input-'linkedProductId'-'defaultLaborCharge'-'pricingRule'-'description');end if;
 select * into previous from public.repair_services where id=nullif(p_input->>'id','')::uuid and store_id=p_store_id;
 pid:=case when p_input ? 'linkedProductId' then nullif(p_input->>'linkedProductId','')::uuid else previous.linked_product_id end;
 if pid is not null then
  select * into product from public.products where id=pid and store_id=p_store_id and state='active' and category<>'Services' and not custom_sale_only;
  if product.id is null or exists(select 1 from public.purchased_devices where product_id=pid) then raise exception 'Review the template: select an active physical linked product' using errcode='22023';end if;
  labor:=private.workflow_money(p_input,'defaultLaborCharge',coalesce(previous.default_labor_charge,0));rule:=coalesce(p_input->>'pricingRule',previous.pricing_rule,'current-product-plus-labor');
  if rule<>'current-product-plus-labor' then raise exception 'Use current product price plus default labor' using errcode='22023';end if;
 elsif p_input ? 'defaultLaborCharge' or p_input ? 'pricingRule' then raise exception 'Select a linked product for this pricing rule' using errcode='22023';end if;
 if length(coalesce(p_input->>'description',''))>4000 then raise exception 'Service description is too long' using errcode='22023';end if;
 result:=public.save_repair_service_before_compound(p_store_id,p_input-'linkedProductId'-'defaultLaborCharge'-'pricingRule'-'description');
 update public.repair_services set linked_product_id=pid,default_labor_charge=labor,pricing_rule=rule,description=coalesce(p_input->>'description',previous.description,''),updated_by=public.current_profile_id() where id=(result->>'id')::uuid;
 perform private.write_audit(p_store_id,public.current_profile_id(),'service.template_linked','repair_service',(result->>'id')::uuid,jsonb_build_object('linkedProductId',pid,'defaultLaborCharge',labor,'pricingRule',rule));
 return private.repair_service_json((result->>'id')::uuid);
end $$;
create or replace function private.repair_service_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'category',s.category,
 'sellingPrice',case when s.linked_product_id is not null then coalesce(p.selling_price,0)+coalesce(s.default_labor_charge,0) else s.selling_price end,
 'minimumSellingPrice',case when s.linked_product_id is not null then coalesce(p.minimum_selling_price,0) else s.minimum_selling_price end,
 'active',s.active,'notes',s.notes,'linkedProductId',s.linked_product_id,'defaultLaborCharge',s.default_labor_charge,'pricingRule',s.pricing_rule,'description',s.description,
 'createdBy',s.created_by,'updatedBy',s.updated_by,'requiresReview',s.linked_product_id is not null and (p.id is null or p.state<>'active' or not exists(select 1 from public.service_material_locations(s.store_id,p.id) x where jsonb_array_length(x)>0))))
 from public.repair_services s left join public.products p on p.id=s.linked_product_id and p.store_id=s.store_id where s.id=p_id
$$;
-- Availability is evaluated without requiring consume permission merely to list templates.
do $$declare source text;begin
 source:=pg_get_functiondef('private.repair_service_json(uuid)'::regprocedure);
 execute replace(source,'not exists(select 1 from public.service_material_locations(s.store_id,p.id) x where jsonb_array_length(x)>0)',
 'not exists(select 1 from public.stock_movements m join public.locations b on b.id=m.location_id and b.active and b.kind=''box'' and b.stock_condition=''Available'' join public.locations sh on sh.id=b.parent_location_id and sh.active join public.locations r on r.id=sh.parent_location_id and r.active where m.store_id=s.store_id and m.product_id=p.id group by m.location_id having sum(m.quantity)>0)');
end $$;
revoke all on function public.save_repair_service(uuid,jsonb) from public,anon;
grant execute on function public.save_repair_service(uuid,jsonb) to authenticated;
revoke all on function private.compound_sale_json(uuid),private.compound_price_payload(uuid,uuid,text,numeric,text),private.snapshot_compound_service(uuid,uuid,jsonb,jsonb,jsonb),private.compound_return_portion(uuid,integer,integer,boolean,boolean),private.snapshot_compound_return(uuid,jsonb) from public,anon,authenticated;
commit;
