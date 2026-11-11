begin;
-- Lists and return lookup share a receipt projection. Detailed transaction views
-- continue through get_sale; search candidates never carry approval/proof data.
create function private.receipt_lookup_sale(p_store uuid,p_sale uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sale jsonb;items jsonb;payments jsonb;
begin
 sale:=private.sale_json(p_store,p_sale);if sale is null then return null;end if;
 select coalesce(jsonb_agg((line-'minimumPrice'-'approval'-'reason')||jsonb_build_object(
  'returnedQuantity',coalesce((sale->'returned'->>(line->>'productId'))::integer,0),
  'returnableQuantity',case when sale->>'status'='Voided' then 0 else greatest(0,(line->>'quantity')::integer-coalesce((sale->'returned'->>(line->>'productId'))::integer,0)) end) order by position),'[]')
 into items from jsonb_array_elements(sale->'lines') with ordinality x(line,position);
 select coalesce(jsonb_agg(payment-'proof'-'verifiedBy' order by position),'[]') into payments from jsonb_array_elements(sale->'payments') with ordinality x(payment,position);
 return sale||jsonb_build_object('lines',items,'payments',payments);
end $$;
create function private.search_receipts(p_store uuid,p_filter jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare search text:=trim(coalesce(p_filter->>'search',''));phone_search text;date_from date;date_to date;
 employee uuid;customer uuid;selected_id uuid;selected_method uuid;method text:=coalesce(p_filter->>'method','');receipt_status text:=coalesce(p_filter->>'status','');
 page integer:=0;page_limit integer:=25;result jsonb;
begin
 perform private.workflow_fields(p_filter,array['search','employee','customer','method','status','from','to','page','limit','id']);
 if length(search)>200 then raise exception 'Keep receipt searches under 200 characters' using errcode='22023';end if;
 if coalesce(p_filter->>'employee','') not in ('','All Employees') then employee:=(p_filter->>'employee')::uuid;end if;
 if coalesce(p_filter->>'customer','')<>'' then customer:=(p_filter->>'customer')::uuid;end if;
 if coalesce(p_filter->>'id','')<>'' then selected_id:=(p_filter->>'id')::uuid;end if;
 if method not in ('','All Methods','credit') then selected_method:=method::uuid;end if;
 if receipt_status not in ('','All Statuses','Paid','Partial','Credit','Voided','Returned') then raise exception 'Select a valid receipt status' using errcode='22023';end if;
 if p_filter ? 'page' then
  if coalesce(p_filter->>'page','') !~ '^[0-9]{1,9}$' then raise exception 'Use a non-negative receipt page' using errcode='22023';end if;page:=(p_filter->>'page')::integer;
 end if;
 if p_filter ? 'limit' then
  if coalesce(p_filter->>'limit','') !~ '^[0-9]{1,3}$' then raise exception 'Use a receipt limit between 1 and 100' using errcode='22023';end if;
  page_limit:=(p_filter->>'limit')::integer;if page_limit not between 1 and 100 then raise exception 'Use a receipt limit between 1 and 100' using errcode='22023';end if;
 end if;
 begin
  if coalesce(p_filter->>'from','')<>'' then
   if p_filter->>'from' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid receipt start date' using errcode='22023';end if;date_from:=(p_filter->>'from')::date;
  end if;
  if coalesce(p_filter->>'to','')<>'' then
   if p_filter->>'to' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid receipt end date' using errcode='22023';end if;date_to:=(p_filter->>'to')::date;
  end if;
 exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Enter valid receipt dates' using errcode='22023';end;
 if date_from>date_to then raise exception 'Receipt start date must not follow the end date' using errcode='22023';end if;
 if search ~ '^[+0-9() -]+$' then
  phone_search:=regexp_replace(search,'[^0-9]','','g');
  if length(phone_search)=11 and left(phone_search,2)='03' then phone_search:=substring(phone_search from 2);
  elsif length(phone_search)=12 and left(phone_search,3)='923' then phone_search:=substring(phone_search from 3);end if;
  if length(phone_search)<3 then phone_search:=null;end if;
 end if;
 -- strpos uses literal text, so %, _ and backslashes cannot turn a lookup into
 -- wildcard matching. Snapshot cashier/customer names stay searchable historically.
 with filtered as (
  select s.id,s.created_at from public.sales s left join public.customers c on c.id=s.customer_id and c.store_id=p_store
  where s.store_id=p_store and (selected_id is null or s.id=selected_id)
   and (search='' or strpos(lower(s.invoice),lower(search))>0 or strpos(lower(s.customer_name),lower(search))>0
    or strpos(lower(s.employee_name),lower(search))>0 or strpos(lower(coalesce(c.phone,'')),lower(search))>0
    or phone_search is not null and strpos(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),phone_search)>0
    or strpos(to_char(s.created_at at time zone 'Asia/Karachi','YYYY-MM-DD'),search)>0
    or exists(select 1 from public.sale_items i where i.sale_id=s.id and i.store_id=p_store and strpos(lower(i.name),lower(search))>0))
   and (employee is null or s.employee_id=employee) and (customer is null or s.customer_id=customer)
   and (receipt_status in ('','All Statuses') or s.status=receipt_status)
   and (date_from is null or (s.created_at at time zone 'Asia/Karachi')::date>=date_from)
   and (date_to is null or (s.created_at at time zone 'Asia/Karachi')::date<=date_to)
   and (method in ('','All Methods') or method='credit' and s.credit_amount>0
    or selected_method is not null and exists(select 1 from public.payments p where p.store_id=p_store and p.method_id=selected_method and p.status in ('Confirmed','Reversed')
      and (p.sale_id=s.id or exists(select 1 from public.credit_ledger_entries l where l.payment_id=p.id and l.store_id=p_store and l.sale_id=s.id))))
 ),paged as (select id,created_at from filtered order by created_at desc,id desc limit page_limit offset page::bigint*page_limit)
 select jsonb_build_object('total',(select count(*) from filtered),'page',page,'limit',page_limit,
  'rows',coalesce((select jsonb_agg(private.receipt_lookup_sale(p_store,id) order by created_at desc,id desc) from paged),'[]')) into result;
 return result;
end $$;
create or replace function public.list_sales(p_store_id uuid,p_filter jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (public.has_permission('sales.view',p_store_id) or public.has_permission('returns.create',p_store_id)) then raise exception 'Sales permission required' using errcode='42501';end if;
 return private.search_receipts(p_store_id,p_filter);
end $$;
create function public.return_receipt_lookup(p_store_id uuid,p_filter jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (public.has_permission('returns.create',p_store_id) or public.has_permission('sales.view',p_store_id)) then raise exception 'Receipt lookup permission required' using errcode='42501';end if;
 return private.search_receipts(p_store_id,p_filter);
end $$;
alter function public.get_sale(uuid,uuid) rename to get_sale_before_receipt_search;
revoke all on function public.get_sale_before_receipt_search(uuid,uuid) from public,anon,authenticated;
create function public.get_sale(p_store_id uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;payments jsonb;
begin
 result:=public.get_sale_before_receipt_search(p_store_id,p_id);if result is null then return null;end if;
 if not (public.has_permission('payments.approve_electronic',p_store_id) or public.has_permission('payments.reverse',p_store_id) or public.has_permission('reports.view',p_store_id)
  or public.has_permission('sales.create',p_store_id) and exists(select 1 from public.sales where store_id=p_store_id and id=p_id and employee_id=public.current_profile_id())) then
  select coalesce(jsonb_agg(payment-'proof' order by position),'[]') into payments from jsonb_array_elements(result->'payments') with ordinality x(payment,position);
  result:=result||jsonb_build_object('payments',payments);
 end if;
 return result;
end $$;
revoke all on function private.receipt_lookup_sale(uuid,uuid),private.search_receipts(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.return_receipt_lookup(uuid,jsonb),public.get_sale(uuid,uuid) from public,anon;
grant execute on function public.return_receipt_lookup(uuid,jsonb),public.get_sale(uuid,uuid) to authenticated;
commit;
