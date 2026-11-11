begin;
create extension if not exists pg_trgm with schema public;
alter table public.products add column search_text text not null default '';
create function private.refresh_product_search() returns trigger language plpgsql set search_path='' as $$begin
 new.search_text:=regexp_replace(lower(new.name||' '||new.brand||' '||new.compatible_model||' '||new.category||' '||array_to_string(new.aliases,' ')),'[^a-z0-9 ]',' ','g');return new;
end $$;
create trigger product_search_text before insert or update of name,brand,compatible_model,category,aliases on public.products for each row execute function private.refresh_product_search();
update public.products set name=name;
create index products_search_trgm_idx on public.products using gin(search_text public.gin_trgm_ops);
revoke all on function private.refresh_product_search() from public,anon,authenticated;
commit;
