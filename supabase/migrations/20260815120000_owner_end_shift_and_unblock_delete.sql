-- An abandoned shift used to be a dead end. owner_delete_staff refused while an
-- attendance row was still 'active', and the only way to close someone else's
-- shift was supervisor_override_shift, which requires role = 'supervisor' with a
-- matching branch_id — the owner is company-wide and has neither. Worse, the
-- unique index on active shifts meant the employee could not clock in again
-- either, so a forgotten checkout locked them out of the app entirely.
--
-- Two fixes: the owner can close any employee's shift directly, and deleting a
-- staff member closes their shift instead of refusing.

create or replace function private.owner_close_employee_shift(
  p_owner_id uuid,
  p_employee_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attendance public.attendance_records;
begin
  select * into v_attendance
  from public.attendance_records
  where user_id = p_employee_id and status = 'active'
  for update;
  if not found then return null; end if;

  -- A break left open would otherwise outlive the shift that contained it.
  update public.attendance_records set
    status = 'completed',
    end_time = now(),
    break_ended_at = case
      when break_started_at is not null and break_ended_at is null then now()
      else break_ended_at
    end,
    supervisor_override_by = p_owner_id,
    supervisor_override_reason = left(coalesce(nullif(trim(p_reason), ''), 'إغلاق إداري للوردية'), 500),
    supervisor_override_at = now()
  where id = v_attendance.id;

  return v_attendance.id;
end;
$$;

create or replace function private.owner_end_employee_shift_impl(
  p_user_id uuid,
  p_employee_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_employee public.staff_profiles;
  v_closed uuid;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can end another employee''s shift' using errcode = '42501';
  end if;
  if p_employee_id = p_user_id then
    return jsonb_build_object('ok', false, 'code', 'cannot_target_self');
  end if;

  select * into v_employee
  from public.staff_profiles
  where user_id = p_employee_id and is_active
    and role in ('supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager');
  if not found then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed');
  end if;

  v_closed := private.owner_close_employee_shift(p_user_id, p_employee_id, p_reason);
  if v_closed is null then
    return jsonb_build_object('ok', false, 'code', 'no_active_shift');
  end if;
  return jsonb_build_object('ok', true, 'attendance_id', v_closed, 'employee_id', p_employee_id);
end;
$$;

create or replace function public.owner_end_employee_shift(
  p_employee_id uuid,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_end_employee_shift_impl((select auth.uid()), p_employee_id, p_reason);
$$;

-- Deletion no longer stops at an open shift; it closes it and carries on, so the
-- attendance record is never left dangling behind a removed account.
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
  v_closed uuid;
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

  v_closed := private.owner_close_employee_shift(
    p_user_id, p_employee_id, 'إغلاق الوردية عند حذف الموظف من الفريق'
  );

  delete from public.tasks where user_id = p_employee_id and not completed;
  update public.staff_profiles set is_active = false where user_id = p_employee_id;
  return jsonb_build_object(
    'ok', true,
    'employee_id', p_employee_id,
    'closed_shift', v_closed is not null
  );
end;
$$;

revoke all on function private.owner_close_employee_shift(uuid,uuid,text) from public, anon;
revoke all on function private.owner_end_employee_shift_impl(uuid,uuid,text) from public, anon;
grant execute on function private.owner_end_employee_shift_impl(uuid,uuid,text) to authenticated;
revoke all on function public.owner_end_employee_shift(uuid,text) from public, anon;
grant execute on function public.owner_end_employee_shift(uuid,text) to authenticated;
