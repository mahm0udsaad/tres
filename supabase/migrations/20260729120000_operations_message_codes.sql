-- Language-consistent operations messaging.
--
-- Branch staff speak a mix of Arabic, Bengali, and English (Kenyan), so
-- employee-facing strings are bilingual Arabic + English. The database
-- returns STABLE `code` values for every user-recoverable failure (the
-- `message` field is an English fallback only); the app maps codes to
-- bilingual text. Seeded task titles become bilingual since they render
-- directly in the employee checklist.
--
-- User-recoverable conditions soft-return {ok:false, code:...}; hard raises
-- remain only for invalid input shapes and forbidden roles.

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

  select * into strict v_branch
  from public.branches
  where id = v_profile.branch_id;

  v_distance := private.distance_meters(
    p_latitude,
    p_longitude,
    v_branch.latitude,
    v_branch.longitude
  );
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

  insert into public.attendance_records (
    user_id,
    branch_id,
    shift_date,
    start_location,
    on_time
  ) values (
    p_user_id,
    v_branch.id,
    v_shift_date,
    jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'accuracy_meters', p_accuracy_meters,
      'distance_meters', round(v_distance::numeric, 1)
    ),
    v_on_time
  )
  returning * into v_attendance;

  -- Bilingual titles: staff are Arabic/Bengali/English speakers.
  if v_profile.role = 'cleaning_staff' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, v_shift_date, 'cleaning_report', 'إرسال تقرير النظافة اليومي · Submit daily cleaning report'),
      (p_user_id, v_shift_date, 'cleaning_photos', 'رفع صور إثبات النظافة · Upload cleaning proof photos')
    on conflict do nothing;
  elsif v_profile.role = 'barista' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, v_shift_date, 'barista_report', 'إرسال تقرير البار اليومي · Submit daily barista report'),
      (p_user_id, v_shift_date, 'bar_clean_confirmation', 'تأكيد نظافة البار · Confirm the bar is clean')
    on conflict do nothing;
  elsif v_profile.role = 'kitchen_manager' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, v_shift_date, 'kitchen_report', 'إرسال تقرير المطبخ · Submit the kitchen report'),
      (p_user_id, v_shift_date, 'kitchen_photos', 'رفع صور نظافة المطبخ · Upload kitchen condition photos'),
      (p_user_id, v_shift_date, 'inventory_count', 'جرد المنتجات والحلويات · Complete product and dessert inventory')
    on conflict do nothing;
  end if;

  insert into public.tasks (
    user_id, task_date, task_type, title, is_required, requires_photo, template_id, sort_order
  )
  select
    p_user_id,
    v_shift_date,
    'checklist',
    template.title,
    template.is_required,
    template.requires_photo,
    template.id,
    template.sort_order
  from public.checklist_templates template
  where template.branch_id = v_branch.id
    and template.is_active
    and (template.role is null or template.role = v_profile.role)
  on conflict (user_id, task_date, task_type, title) do nothing;

  insert into public.gamification (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

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
    return jsonb_build_object(
      'ok', false,
      'code', 'active_shift_exists',
      'message', 'An active shift already exists.'
    );
end;
$$;

create or replace function private.set_break_impl(p_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_attendance public.attendance_records;
  v_minutes integer;
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
    if v_attendance.break_started_at is not null then
      return jsonb_build_object('ok', false, 'code', 'break_already_used', 'message', 'Break has already been used.');
    end if;
    update public.attendance_records
    set break_started_at = now()
    where id = v_attendance.id;
    return jsonb_build_object('ok', true, 'break_status', 'active', 'started_at', now());
  elsif p_action = 'end' then
    if v_attendance.break_started_at is null then
      return jsonb_build_object('ok', false, 'code', 'break_not_started', 'message', 'Break has not started.');
    end if;
    if v_attendance.break_ended_at is not null then
      return jsonb_build_object('ok', false, 'code', 'break_already_ended', 'message', 'Break has already ended.');
    end if;
    v_minutes := greatest(
      1,
      floor(extract(epoch from (now() - v_attendance.break_started_at)) / 60)::integer
    );
    update public.attendance_records
    set break_ended_at = now(), break_duration_minutes = v_minutes
    where id = v_attendance.id;
    return jsonb_build_object(
      'ok', true,
      'break_status', 'completed',
      'minutes_used', v_minutes,
      'entitlement_minutes', v_attendance.break_entitlement_minutes
    );
  end if;

  raise exception 'Invalid break action' using errcode = '22023';
end;
$$;

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
      'missing', jsonb_build_array(jsonb_build_object(
        'id', null,
        'title', 'إنهاء الاستراحة الجارية · End the active break',
        'task_type', 'break'
      ))
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
  where user_id = p_user_id
    and task_date = v_attendance.shift_date
    and completed;

  v_points := 10 + least(v_task_count, 5) * 2 + case when v_attendance.on_time then 5 else 0 end;
  v_hours := round((extract(epoch from (now() - v_attendance.start_time)) / 3600)::numeric, 2);

  update public.attendance_records
  set
    end_time = now(),
    end_location = jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'accuracy_meters', p_accuracy_meters
    ),
    status = 'completed',
    points_earned = v_points,
    tasks_completed = v_task_count
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

  insert into public.gamification (
    user_id, points, streak_count, last_completed_date
  ) values (
    p_user_id, v_points, v_streak, v_attendance.shift_date
  )
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
