-- Owner employee administration. "Delete" intentionally archives the staff
-- profile instead of removing operational history: inactive profiles cannot
-- pass private.require_staff, while reports and attendance remain auditable.

create or replace function private.owner_update_staff_impl(
  p_user_id uuid,
  p_employee_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_branch_id uuid,
  p_nationality text,
  p_scheduled_start time,
  p_scheduled_end time
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_employee public.staff_profiles;
  v_name text := trim(coalesce(p_full_name, ''));
  v_language text;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can edit staff' using errcode = '42501';
  end if;
  if p_employee_id = p_user_id then
    return jsonb_build_object('ok', false, 'code', 'cannot_target_self');
  end if;
  if length(v_name) not between 1 and 120 then
    return jsonb_build_object('ok', false, 'code', 'name_invalid');
  end if;
  if p_role not in ('supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager') then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed');
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id) then
    return jsonb_build_object('ok', false, 'code', 'branch_invalid');
  end if;
  if p_nationality not in (
    'Kenya','Bangladesh','India','Pakistan','Philippines','Egypt','Sudan',
    'Ethiopia','Nepal','Sri Lanka','Yemen','Jordan','Indonesia','Uganda',
    'Tanzania','Saudi Arabia','Other'
  ) then
    return jsonb_build_object('ok', false, 'code', 'nationality_invalid');
  end if;
  if p_scheduled_start is null or p_scheduled_end is null
    or p_scheduled_start = p_scheduled_end
  then
    return jsonb_build_object('ok', false, 'code', 'schedule_invalid');
  end if;
  if exists (
    select 1 from public.attendance_records
    where user_id = p_employee_id and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'active_shift_exists');
  end if;

  v_language := case
    when p_nationality in ('Saudi Arabia', 'Egypt', 'Yemen', 'Sudan', 'Jordan') then 'ar'
    when p_nationality = 'Bangladesh' then 'bn'
    else 'en'
  end;

  update public.staff_profiles
  set full_name = v_name,
      role = p_role,
      branch_id = p_branch_id,
      nationality = p_nationality,
      preferred_language = v_language,
      scheduled_start = p_scheduled_start,
      scheduled_end = p_scheduled_end
  where user_id = p_employee_id
    and is_active
    and role in ('supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager')
  returning * into v_employee;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed');
  end if;
  return jsonb_build_object('ok', true, 'employee_id', v_employee.user_id);
end;
$$;

create or replace function public.owner_update_staff(
  p_employee_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_branch_id uuid,
  p_nationality text,
  p_scheduled_start time,
  p_scheduled_end time
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_update_staff_impl(
    (select auth.uid()), p_employee_id, p_full_name, p_role, p_branch_id,
    p_nationality, p_scheduled_start, p_scheduled_end
  );
$$;

create or replace function private.owner_delete_staff_impl(
  p_user_id uuid,
  p_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_employee public.staff_profiles;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can delete staff' using errcode = '42501';
  end if;
  if p_employee_id = p_user_id then
    return jsonb_build_object('ok', false, 'code', 'cannot_target_self');
  end if;
  select * into v_employee
  from public.staff_profiles
  where user_id = p_employee_id
    and is_active
    and role in ('supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager')
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed');
  end if;
  if exists (
    select 1 from public.attendance_records
    where user_id = p_employee_id and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'active_shift_exists');
  end if;

  delete from public.tasks where user_id = p_employee_id and not completed;
  update public.staff_profiles set is_active = false where user_id = p_employee_id;
  return jsonb_build_object('ok', true, 'employee_id', p_employee_id);
end;
$$;

create or replace function public.owner_delete_staff(p_employee_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_delete_staff_impl((select auth.uid()), p_employee_id);
$$;

revoke all on function private.owner_update_staff_impl(uuid,uuid,text,public.staff_role,uuid,text,time,time) from public, anon;
grant execute on function private.owner_update_staff_impl(uuid,uuid,text,public.staff_role,uuid,text,time,time) to authenticated;
revoke all on function public.owner_update_staff(uuid,text,public.staff_role,uuid,text,time,time) from public, anon;
grant execute on function public.owner_update_staff(uuid,text,public.staff_role,uuid,text,time,time) to authenticated;
revoke all on function private.owner_delete_staff_impl(uuid,uuid) from public, anon;
grant execute on function private.owner_delete_staff_impl(uuid,uuid) to authenticated;
revoke all on function public.owner_delete_staff(uuid) from public, anon;
grant execute on function public.owner_delete_staff(uuid) to authenticated;
