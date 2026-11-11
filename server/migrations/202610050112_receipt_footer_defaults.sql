begin;
-- Migrate only the shipped default. Preserve every store's customized footer
-- and leave previously issued invoice snapshots unchanged.
update public.business_settings
set settings=jsonb_set(settings,'{receiptFooter}','"Thank you for choosing Taha Mobiles."'::jsonb),updated_at=now()
where settings->>'receiptFooter'='Thank you for shopping at Taha Mobiles.';

do $$
declare existing_default jsonb; expression text;
begin
 select pg_get_expr(d.adbin,d.adrelid) into expression
 from pg_catalog.pg_attrdef d join pg_catalog.pg_attribute a
 on a.attrelid=d.adrelid and a.attnum=d.adnum
 where d.adrelid='public.business_settings'::regclass and a.attname='settings';
 execute 'select '||expression into existing_default;
 existing_default:=jsonb_set(existing_default,'{receiptFooter}','"Thank you for choosing Taha Mobiles."'::jsonb);
 execute format('alter table public.business_settings alter column settings set default %L::jsonb',existing_default::text);
end $$;

create or replace function private.settings(p_store uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 select settings into v from public.business_settings where store_id=p_store;
 return coalesce(v,'{"id":"main","currency":"PKR","timezone":"Asia/Karachi","receiptPrinting":"Ask After Checkout","customerDisplay":true,"requireProof":true,"bargaining":true,"belowMinimum":"Manager Approval","lowStockAlerts":true,"negativeStock":false,"defaultUnit":"Piece","receiptRequired":true,"returnDays":7,"returnApproval":true,"restoreReturns":true,"notifications":true,"receiptFooter":"Thank you for choosing Taha Mobiles.","creditEnabled":true}'::jsonb)
 || coalesce((select jsonb_build_object('storeName',name,'branch',branch_name) from public.stores where id=p_store),'{}'::jsonb);
end $$;
commit;
