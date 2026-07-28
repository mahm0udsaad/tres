-- Nationality + per-user language, and a supervisor GPS-override fallback.
--
-- Adds nationality and preferred_language (ar|en) to every staff profile,
-- lets the supervisor manually clock a same-branch employee in/out when their
-- GPS fails (with a mandatory reason, still enforcing task completion on end),
-- and normalizes the shared shift logic into helpers so the geofenced and
-- override paths can never diverge. Seeded task titles are now single-language
-- per the member's preferred_language.

-- ── 1. profile columns ──────────────────────────────────────────────────────
alter table public.staff_profiles
  add column if not exists nationality text not null default 'Other',
  add column if not exists preferred_language text not null default 'en';

alter table public.staff_profiles drop constraint if exists staff_profiles_language_check;
alter table public.staff_profiles add constraint staff_profiles_language_check
  check (preferred_language in ('ar', 'en'));

alter table public.staff_profiles drop constraint if exists staff_profiles_nationality_check;
alter table public.staff_profiles add constraint staff_profiles_nationality_check
  check (nationality in (
    'Kenya','Bangladesh','India','Pakistan','Philippines','Egypt','Sudan',
    'Ethiopia','Nepal','Sri Lanka','Yemen','Jordan','Indonesia','Uganda',
    'Tanzania','Saudi Arabia','Other'
  ));

-- ── 2. supervisor override tracking on attendance ───────────────────────────
alter table public.attendance_records
  add column if not exists supervisor_override_by uuid references public.staff_profiles(user_id),
  add column if not exists supervisor_override_reason text,
  add column if not exists supervisor_override_at timestamptz;

-- ── 3. 100 m geofence default for existing branches ─────────────────────────
alter table public.branches alter column radius_meters set default 100;
update public.branches set radius_meters = 100 where radius_meters = 150;

-- ── 4. shared task seeding (single-language titles) ─────────────────────────
create or replace function private.seed_shift_tasks(
  p_user_id uuid,
  p_role public.staff_role,
  p_branch_id uuid,
  p_shift_date date,
  p_lang text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ar boolean := (p_lang = 'ar');
begin
  if p_role = 'cleaning_staff' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, p_shift_date, 'cleaning_report',
        case when v_ar then 'إرسال تقرير النظافة اليومي' else 'Submit the daily cleaning report' end),
      (p_user_id, p_shift_date, 'cleaning_photos',
        case when v_ar then 'رفع صور إثبات النظافة' else 'Upload cleaning proof photos' end)
    on conflict do nothing;
  elsif p_role = 'barista' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, p_shift_date, 'barista_report',
        case when v_ar then 'إرسال تقرير البار اليومي' else 'Submit the daily barista report' end),
      (p_user_id, p_shift_date, 'bar_clean_confirmation',
        case when v_ar then 'تأكيد نظافة البار' else 'Confirm the bar is clean' end)
    on conflict do nothing;
  elsif p_role = 'kitchen_manager' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, p_shift_date, 'kitchen_report',
        case when v_ar then 'إرسال تقرير المطبخ' else 'Submit the kitchen report' end),
      (p_user_id, p_shift_date, 'kitchen_photos',
        case when v_ar then 'رفع صور نظافة المطبخ' else 'Upload kitchen condition photos' end),
      (p_user_id, p_shift_date, 'inventory_count',
        case when v_ar then 'جرد المنتجات والحلويات' else 'Complete product and dessert inventory' end)
    on conflict do nothing;
  end if;

  insert into public.tasks (
    user_id, task_date, task_type, title, is_required, requires_photo, template_id, sort_order
  )
  select
    p_user_id, p_shift_date, 'checklist', template.title,
    template.is_required, template.requires_photo, template.id, template.sort_order
  from public.checklist_templates template
  where template.branch_id = p_branch_id
    and template.is_active
    and (template.role is null or template.role = p_role)
  on conflict (user_id, task_date, task_type, title) do nothing;

  insert into public.gamification (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

-- ── 5. shared shift close (task/break gates + points), GPS-agnostic ──────────
create or replace function private.close_shift_impl(
  p_user_id uuid,
  p_end_location jsonb,
  p_override_by uuid,
  p_override_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attendance public.attendance_records;
  v_missing jsonb;
  v_task_count integer;
  v_points integer;
  v_hours numeric;
  v_previous_date date;
  v_streak integer;
  v_total_points integer;
  v_badges text[];
begin
  select * into v_attendance
  from public.attendance_records
  where user_id = p_user_id and status = 'active'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_active_shift', 'message', 'No active shift found.');
  end if;
  if v_attendance.break_started_at is not null and v_attendance.break_ended_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'break_active',
      'message', 'End your active break before ending the shift.',
      'missing', jsonb_build_array(jsonb_build_object('id', null, 'title', 'break', 'task_type', 'break'))
    );
  end if;

  select jsonb_agg(
    jsonb_build_object('id', id, 'title', title, 'task_type', task_type)
    order by sort_order, created_at
  )
  into v_missing
  from public.tasks
  where user_id = p_user_id
    and task_date = v_attendance.shift_date
    and is_required
    and not completed;

  if v_missing is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'incomplete_tasks',
      'message', 'Complete all required tasks before ending the shift.',
      'missing', v_missing
    );
  end if;

  select count(*) into v_task_count
  from public.tasks
  where user_id = p_user_id and task_date = v_attendance.shift_date and completed;

  v_points := 10 + least(v_task_count, 5) * 2 + case when v_attendance.on_time then 5 else 0 end;
  v_hours := round((extract(epoch from (now() - v_attendance.start_time)) / 3600)::numeric, 2);

  update public.attendance_records
  set
    end_time = now(),
    end_location = p_end_location,
    status = 'completed',
    points_earned = v_points,
    tasks_completed = v_task_count,
    supervisor_override_by = coalesce(p_override_by, supervisor_override_by),
    supervisor_override_reason = coalesce(p_override_reason, supervisor_override_reason),
    supervisor_override_at = case when p_override_by is not null then now() else supervisor_override_at end
  where id = v_attendance.id;

  select last_completed_date, streak_count
  into v_previous_date, v_streak
  from public.gamification
  where user_id = p_user_id
  for update;

  if not found then
    v_previous_date := null;
    v_streak := 0;
  end if;

  if v_previous_date = v_attendance.shift_date then
    v_streak := greatest(v_streak, 1);
  elsif v_previous_date = v_attendance.shift_date - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  insert into public.gamification (user_id, points, streak_count, last_completed_date)
  values (p_user_id, v_points, v_streak, v_attendance.shift_date)
  on conflict (user_id) do update set
    points = public.gamification.points + excluded.points,
    streak_count = excluded.streak_count,
    last_completed_date = excluded.last_completed_date,
    updated_at = now()
  returning points, badges into v_total_points, v_badges;

  if v_streak >= 5 and not ('five_day_streak' = any(v_badges)) then
    v_badges := array_append(v_badges, 'five_day_streak');
  end if;
  if v_total_points >= 100 and not ('century_club' = any(v_badges)) then
    v_badges := array_append(v_badges, 'century_club');
  end if;
  if not ('first_shift' = any(v_badges)) then
    v_badges := array_append(v_badges, 'first_shift');
  end if;
  update public.gamification set badges = v_badges where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_attendance.id,
    'hours_worked', v_hours,
    'tasks_completed', v_task_count,
    'points_earned', v_points,
    'total_points', v_total_points,
    'streak_count', v_streak,
    'badges', to_jsonb(v_badges)
  );
end;
$$;

-- ── 6. start_shift now uses the seed helper + member language ────────────────
create or replace function private.start_shift_impl(
  p_user_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_branch public.branches;
  v_attendance public.attendance_records;
  v_distance double precision;
  v_shift_date date;
  v_local_time time;
  v_on_time boolean := false;
begin
  v_profile := private.require_staff(p_user_id);

  if v_profile.role in ('owner', 'manager', 'shift_manager') then
    raise exception 'This role does not use attendance tracking' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_branch', 'message', 'No branch is assigned to this staff member.');
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_accuracy_meters is null or p_accuracy_meters < 0 or p_accuracy_meters > 250 then
    return jsonb_build_object('ok', false, 'code', 'low_accuracy', 'message', 'Location accuracy is too low.');
  end if;

  select * into strict v_branch from public.branches where id = v_profile.branch_id;

  v_distance := private.distance_meters(p_latitude, p_longitude, v_branch.latitude, v_branch.longitude);
  if v_distance > v_branch.radius_meters then
    return jsonb_build_object(
      'ok', false,
      'code', 'outside_branch',
      'message', 'You are outside the branch location. Cannot start shift.',
      'distance_meters', round(v_distance::numeric, 1),
      'allowed_radius_meters', v_branch.radius_meters
    );
  end if;

  v_shift_date := (now() at time zone v_branch.timezone)::date;
  v_local_time := (now() at time zone v_branch.timezone)::time;
  if v_profile.scheduled_start is not null then
    v_on_time := v_local_time <= v_profile.scheduled_start + interval '15 minutes';
  end if;

  insert into public.attendance_records (user_id, branch_id, shift_date, start_location, on_time)
  values (
    p_user_id, v_branch.id, v_shift_date,
    jsonb_build_object(
      'latitude', p_latitude, 'longitude', p_longitude,
      'accuracy_meters', p_accuracy_meters, 'distance_meters', round(v_distance::numeric, 1)
    ),
    v_on_time
  )
  returning * into v_attendance;

  perform private.seed_shift_tasks(p_user_id, v_profile.role, v_branch.id, v_shift_date, v_profile.preferred_language);

  return jsonb_build_object(
    'ok', true,
    'attendance_id', v_attendance.id,
    'started_at', v_attendance.start_time,
    'shift_date', v_shift_date,
    'distance_meters', round(v_distance::numeric, 1),
    'on_time', v_on_time
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'active_shift_exists', 'message', 'An active shift already exists.');
end;
$$;

-- ── 7. end_shift now delegates to close_shift_impl ──────────────────────────
create or replace function private.end_shift_impl(
  p_user_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role in ('owner', 'manager', 'shift_manager') then
    raise exception 'This role does not use attendance tracking' using errcode = '42501';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates' using errcode = '22023';
  end if;
  if p_accuracy_meters is null or p_accuracy_meters < 0 or p_accuracy_meters > 250 then
    return jsonb_build_object('ok', false, 'code', 'low_accuracy', 'message', 'Location accuracy is too low.');
  end if;

  return private.close_shift_impl(
    p_user_id,
    jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude, 'accuracy_meters', p_accuracy_meters),
    null,
    null
  );
end;
$$;

-- ── 8. supervisor manual override (GPS fallback) ────────────────────────────
create or replace function private.supervisor_override_shift_impl(
  p_user_id uuid,
  p_employee_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor public.staff_profiles;
  v_employee public.staff_profiles;
  v_branch public.branches;
  v_reason text;
  v_shift_date date;
  v_local_time time;
  v_on_time boolean := false;
  v_attendance public.attendance_records;
begin
  v_supervisor := private.require_staff(p_user_id);
  if v_supervisor.role <> 'supervisor' then
    raise exception 'Only supervisors can override shifts' using errcode = '42501';
  end if;
  if v_supervisor.branch_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_branch', 'message', 'No branch is assigned to this account.');
  end if;

  v_reason := nullif(trim(p_reason), '');
  if v_reason is null or length(v_reason) < 10 then
    return jsonb_build_object('ok', false, 'code', 'reason_required', 'message', 'A reason of at least 10 characters is required.');
  end if;

  select * into v_employee
  from public.staff_profiles
  where user_id = p_employee_id
    and branch_id = v_supervisor.branch_id
    and is_active
    and role in ('employee', 'cleaning_staff', 'barista', 'kitchen_manager');

  if not found then
    return jsonb_build_object('ok', false, 'code', 'target_not_allowed', 'message', 'This account is outside your branch or has a protected role.');
  end if;

  select * into strict v_branch from public.branches where id = v_supervisor.branch_id;

  if p_action = 'start' then
    v_shift_date := (now() at time zone v_branch.timezone)::date;
    v_local_time := (now() at time zone v_branch.timezone)::time;
    if v_employee.scheduled_start is not null then
      v_on_time := v_local_time <= v_employee.scheduled_start + interval '15 minutes';
    end if;

    begin
      insert into public.attendance_records (
        user_id, branch_id, shift_date, start_location, on_time,
        supervisor_override_by, supervisor_override_reason, supervisor_override_at
      )
      values (
        p_employee_id, v_branch.id, v_shift_date,
        jsonb_build_object('manual_override', true, 'by', p_user_id),
        v_on_time, p_user_id, v_reason, now()
      )
      returning * into v_attendance;
    exception
      when unique_violation then
        return jsonb_build_object('ok', false, 'code', 'active_shift_exists', 'message', 'An active shift already exists.');
    end;

    perform private.seed_shift_tasks(
      p_employee_id, v_employee.role, v_branch.id, v_shift_date, v_employee.preferred_language
    );

    return jsonb_build_object(
      'ok', true, 'action', 'start', 'attendance_id', v_attendance.id, 'employee_id', p_employee_id
    );

  elsif p_action = 'end' then
    return private.close_shift_impl(
      p_employee_id,
      jsonb_build_object('manual_override', true, 'by', p_user_id),
      p_user_id,
      v_reason
    );
  end if;

  return jsonb_build_object('ok', false, 'code', 'invalid_action', 'message', 'Unknown override action.');
end;
$$;

-- ── 9. branch active-shift status for the team page (supervisor-scoped) ──────
create or replace function private.get_branch_shift_status_impl(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor public.staff_profiles;
begin
  v_supervisor := private.require_staff(p_user_id);
  if v_supervisor.role <> 'supervisor' or v_supervisor.branch_id is null then
    raise exception 'Only branch supervisors can read shift status' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', a.user_id,
      'attendance_id', a.id,
      'started_at', a.start_time,
      'override', a.supervisor_override_by is not null
    ))
    from public.attendance_records a
    join public.staff_profiles p on p.user_id = a.user_id
    where a.status = 'active' and p.branch_id = v_supervisor.branch_id
  ), '[]'::jsonb);
end;
$$;

-- ── 10. register_branch_staff gains nationality + language ───────────────────
drop function if exists public.register_branch_staff(uuid, text, public.staff_role, time);
drop function if exists private.register_branch_staff_impl(uuid, uuid, text, public.staff_role, time);

create or replace function private.register_branch_staff_impl(
  p_user_id uuid,
  p_new_user_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_scheduled_start time,
  p_nationality text,
  p_preferred_language text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_name text;
  v_nationality text;
  v_lang text;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'supervisor' then
    raise exception 'Only supervisors can register branch staff' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_branch', 'message', 'No branch is assigned to this account.');
  end if;
  if p_role not in ('employee', 'cleaning_staff', 'barista', 'kitchen_manager') then
    return jsonb_build_object('ok', false, 'code', 'role_not_allowed', 'message', 'Supervisors can only create non-privileged staff roles.');
  end if;
  v_name := nullif(trim(p_full_name), '');
  if v_name is null or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'name_invalid', 'message', 'A valid staff name is required.');
  end if;
  v_nationality := coalesce(nullif(trim(p_nationality), ''), 'Other');
  if v_nationality not in (
    'Kenya','Bangladesh','India','Pakistan','Philippines','Egypt','Sudan','Ethiopia',
    'Nepal','Sri Lanka','Yemen','Jordan','Indonesia','Uganda','Tanzania','Saudi Arabia','Other'
  ) then
    return jsonb_build_object('ok', false, 'code', 'nationality_invalid', 'message', 'Select a valid nationality.');
  end if;
  v_lang := lower(coalesce(nullif(trim(p_preferred_language), ''), 'en'));
  if v_lang not in ('ar', 'en') then
    return jsonb_build_object('ok', false, 'code', 'language_invalid', 'message', 'Language must be Arabic or English.');
  end if;
  if p_new_user_id is null or not exists (select 1 from auth.users where id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'auth_user_missing', 'message', 'The auth account was not found.');
  end if;
  if exists (select 1 from public.staff_profiles where user_id = p_new_user_id) then
    return jsonb_build_object('ok', false, 'code', 'profile_exists', 'message', 'A staff profile already exists for this account.');
  end if;

  insert into public.staff_profiles (
    user_id, full_name, role, branch_id, scheduled_start, nationality, preferred_language
  )
  values (
    p_new_user_id, v_name, p_role, v_profile.branch_id, p_scheduled_start, v_nationality, v_lang
  );

  return jsonb_build_object('ok', true, 'user_id', p_new_user_id, 'branch_id', v_profile.branch_id, 'role', p_role);
end;
$$;

create or replace function public.register_branch_staff(
  p_new_user_id uuid,
  p_full_name text,
  p_role public.staff_role,
  p_scheduled_start time,
  p_nationality text,
  p_preferred_language text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.register_branch_staff_impl(
    (select auth.uid()), p_new_user_id, p_full_name, p_role,
    p_scheduled_start, p_nationality, p_preferred_language
  );
$$;

-- ── 11. public wrappers for override + shift status ─────────────────────────
create or replace function public.supervisor_override_shift(
  p_employee_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.supervisor_override_shift_impl((select auth.uid()), p_employee_id, p_action, p_reason);
$$;

create or replace function public.get_branch_shift_status()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_branch_shift_status_impl((select auth.uid()));
$$;

-- ── 12. grants ──────────────────────────────────────────────────────────────
revoke all on function private.seed_shift_tasks(uuid, public.staff_role, uuid, date, text) from public, anon;
revoke all on function private.close_shift_impl(uuid, jsonb, uuid, text) from public, anon;
revoke all on function private.supervisor_override_shift_impl(uuid, uuid, text, text) from public, anon;
revoke all on function private.get_branch_shift_status_impl(uuid) from public, anon;
revoke all on function private.register_branch_staff_impl(uuid, uuid, text, public.staff_role, time, text, text) from public, anon;
grant execute on function private.seed_shift_tasks(uuid, public.staff_role, uuid, date, text) to authenticated;
grant execute on function private.close_shift_impl(uuid, jsonb, uuid, text) to authenticated;
grant execute on function private.supervisor_override_shift_impl(uuid, uuid, text, text) to authenticated;
grant execute on function private.get_branch_shift_status_impl(uuid) to authenticated;
grant execute on function private.register_branch_staff_impl(uuid, uuid, text, public.staff_role, time, text, text) to authenticated;

revoke all on function public.register_branch_staff(uuid, text, public.staff_role, time, text, text) from public, anon;
revoke all on function public.supervisor_override_shift(uuid, text, text) from public, anon;
revoke all on function public.get_branch_shift_status() from public, anon;
grant execute on function public.register_branch_staff(uuid, text, public.staff_role, time, text, text) to authenticated;
grant execute on function public.supervisor_override_shift(uuid, text, text) to authenticated;
grant execute on function public.get_branch_shift_status() to authenticated;
