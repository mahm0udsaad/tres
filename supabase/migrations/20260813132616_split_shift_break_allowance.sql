-- Employees may split their 60-minute allowance across multiple break
-- sessions. break_duration_minutes is the cumulative used total; the existing
-- start/end timestamps describe only the current or latest segment.

create or replace function private.set_break_impl(p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_attendance public.attendance_records;
  v_segment_minutes integer;
  v_total_minutes integer;
  v_remaining_minutes integer;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role in ('owner', 'manager', 'shift_manager') then
    raise exception 'This role does not use attendance tracking' using errcode = '42501';
  end if;

  select * into v_attendance
  from public.attendance_records
  where user_id = p_user_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_active_shift', 'message', 'No active shift found.');
  end if;

  if p_action = 'start' then
    if v_attendance.break_started_at is not null and v_attendance.break_ended_at is null then
      return jsonb_build_object('ok', false, 'code', 'break_already_active', 'message', 'A break is already active.');
    end if;
    if v_attendance.break_duration_minutes >= v_attendance.break_entitlement_minutes then
      return jsonb_build_object('ok', false, 'code', 'break_allowance_used', 'message', 'The break allowance has been fully used.');
    end if;

    update public.attendance_records
    set break_started_at = now(), break_ended_at = null
    where id = v_attendance.id;

    return jsonb_build_object(
      'ok', true,
      'break_status', 'active',
      'started_at', now(),
      'minutes_used', v_attendance.break_duration_minutes,
      'minutes_remaining', v_attendance.break_entitlement_minutes - v_attendance.break_duration_minutes,
      'entitlement_minutes', v_attendance.break_entitlement_minutes
    );
  elsif p_action = 'end' then
    if v_attendance.break_started_at is null then
      return jsonb_build_object('ok', false, 'code', 'break_not_started', 'message', 'Break has not started.');
    end if;
    if v_attendance.break_ended_at is not null then
      return jsonb_build_object('ok', false, 'code', 'break_already_ended', 'message', 'Break has already ended.');
    end if;

    v_segment_minutes := greatest(
      1,
      floor(extract(epoch from (now() - v_attendance.break_started_at)) / 60)::integer
    );
    v_total_minutes := v_attendance.break_duration_minutes + v_segment_minutes;
    v_remaining_minutes := greatest(
      0,
      v_attendance.break_entitlement_minutes - v_total_minutes
    );

    update public.attendance_records
    set break_ended_at = now(), break_duration_minutes = v_total_minutes
    where id = v_attendance.id;

    return jsonb_build_object(
      'ok', true,
      'break_status', 'completed',
      'segment_minutes', v_segment_minutes,
      'minutes_used', v_total_minutes,
      'minutes_remaining', v_remaining_minutes,
      'entitlement_minutes', v_attendance.break_entitlement_minutes
    );
  end if;

  raise exception 'Invalid break action' using errcode = '22023';
end;
$$;

-- Keep the owner's table cumulative while a later break segment is running.
create or replace function private.get_owner_employee_table_impl(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_result jsonb;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can read the employee table' using errcode = '42501';
  end if;

  with employee as (
    select p.user_id, p.full_name, p.role::text as role, p.branch_id,
           b.name as branch_name,
           (now() at time zone coalesce(b.timezone, 'Asia/Riyadh'))::date as today,
           coalesce(u.phone, '') as phone
    from public.staff_profiles p
    left join public.branches b on b.id = p.branch_id
    left join auth.users u on u.id = p.user_id
    where p.is_active
      and p.role in ('supervisor', 'employee', 'cleaning_staff', 'barista', 'kitchen_manager')
  ),
  employee_day as (
    select e.*, a.id as attendance_id, a.status::text as attendance_status,
           a.start_time, a.end_time, a.break_started_at, a.break_ended_at,
           a.break_duration_minutes, a.break_entitlement_minutes
    from employee e
    left join lateral (
      select ar.* from public.attendance_records ar
      where ar.user_id = e.user_id and ar.shift_date = e.today
      order by ar.start_time desc limit 1
    ) a on true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', e.user_id,
    'phone', case when e.phone = '' then null else '+' || e.phone end,
    'tasks_done', (select count(*) from public.tasks t where t.user_id = e.user_id and t.task_date = e.today and t.completed),
    'tasks_total', (select count(*) from public.tasks t where t.user_id = e.user_id and t.task_date = e.today),
    'break_minutes', case
      when e.attendance_id is null then 0
      when e.break_started_at is not null and e.break_ended_at is null then
        e.break_duration_minutes + greatest(0, floor(extract(epoch from (now() - e.break_started_at)) / 60)::integer)
      else e.break_duration_minutes
    end,
    'break_status', case
      when e.break_started_at is not null and e.break_ended_at is null then 'active'
      when coalesce(e.break_duration_minutes, 0) > 0 then 'completed'
      else 'not_taken'
    end,
    'shift_status', case
      when e.attendance_id is null then 'not_started'
      when e.attendance_status = 'active' then 'working'
      else 'finished'
    end,
    'shift_started_at', e.start_time,
    'shift_ended_at', e.end_time
  ) order by e.branch_name nulls last, e.full_name), '[]'::jsonb)
  into v_result from employee_day e;

  return v_result;
end;
$$;
