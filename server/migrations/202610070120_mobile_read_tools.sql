-- Mobile read tools deliberately exclude financial payloads and approval capabilities.
create function public.get_my_shift(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501';end if;
 select jsonb_build_object('id',s.id,'status',s.status,'scheduledStart',s.scheduled_start,'scheduledEnd',s.scheduled_end,'actualStart',s.actual_start,'actualEnd',s.actual_end) into result
 from public.shifts s where s.store_id=p_store_id and s.employee_id=public.current_profile_id() order by s.scheduled_start desc nulls last,s.created_at desc limit 1;
 return result;
end$$;
create function public.get_mobile_approvals(p_store_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_access_store(p_store_id) then raise exception 'Access denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(row) from (
  select a.id,a.purpose as action,p.full_name as approver,case when a.consumed_at is not null then 'Used' when a.expires_at<now() then 'Expired' else 'Approved' end as status,a.created_at as "createdAt"
  from private.transaction_approvals a join public.profiles p on p.id=a.approver_id
  where a.store_id=p_store_id and (a.seller_id=public.current_profile_id() or a.approver_id=public.current_profile_id() or public.is_owner())
  order by a.created_at desc limit 20
 ) row),'[]'::jsonb);
end$$;
revoke all on function public.get_my_shift(uuid),public.get_mobile_approvals(uuid) from public,anon;
grant execute on function public.get_my_shift(uuid),public.get_mobile_approvals(uuid) to authenticated;
