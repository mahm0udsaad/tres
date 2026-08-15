-- Closes the operations loop: the owner (or the branch supervisor) reviews the
-- work an employee submitted, and the verdict reaches that employee through a
-- notification bell instead of dying in a panel they never open.
--
-- A rejection is deliberately two-sided. "Redo" reopens the task so the work
-- actually gets done again; "flag only" keeps it closed and records the
-- verdict. The reviewer picks per rejection — both are legitimate outcomes.

-- ── 1. Task review columns ─────────────────────────────────────────────────
-- review_status is null while a completed task still awaits a verdict, which
-- is exactly what the review queue selects on. A reopened task resets it to
-- null so the second attempt comes back for review like the first one did.
alter table public.tasks
  add column if not exists review_status text
    check (review_status is null or review_status in ('approved', 'rejected')),
  add column if not exists reviewed_by uuid
    references public.staff_profiles(user_id) on delete set null,
  add column if not exists review_notes text
    check (review_notes is null or length(review_notes) <= 2000),
  add column if not exists reviewed_at timestamptz;

create index if not exists tasks_pending_review_idx
  on public.tasks(completed, review_status, task_date desc);

-- ── 2. Notifications ───────────────────────────────────────────────────────
create table if not exists public.staff_notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.staff_profiles(user_id) on delete cascade,
  kind         text not null check (kind in ('task_review', 'report_review')),
  entity_type  text not null check (entity_type in ('task', 'cleaning', 'barista', 'kitchen')),
  entity_id    uuid not null,
  decision     text not null check (decision in ('approved', 'rejected')),
  -- Task title, or the report label; the UI localises reports by entity_type.
  title        text not null check (length(trim(title)) between 1 and 300),
  note         text check (note is null or length(note) <= 2000),
  created_by   uuid references public.staff_profiles(user_id) on delete set null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists staff_notifications_unread_idx
  on public.staff_notifications(user_id, read_at, created_at desc);

alter table public.staff_notifications enable row level security;
revoke all on public.staff_notifications from anon;
grant select on public.staff_notifications to authenticated;

-- Employees read their own bell. Rows are only ever written by the security
-- definer helpers below, so there is no insert/update grant for anyone.
drop policy if exists staff_notifications_read_self on public.staff_notifications;
create policy staff_notifications_read_self
  on public.staff_notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists staff_notifications_read_global_owner on public.staff_notifications;
create policy staff_notifications_read_global_owner
  on public.staff_notifications for select
  to authenticated
  using ((select private.is_global_owner()));

create or replace function private.notify_staff(
  p_user_id uuid,
  p_kind text,
  p_entity_type text,
  p_entity_id uuid,
  p_decision text,
  p_title text,
  p_note text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Never let a missing recipient break the review that triggered it.
  if p_user_id is null then return null; end if;
  insert into public.staff_notifications (
    user_id, kind, entity_type, entity_id, decision, title, note, created_by
  ) values (
    p_user_id, p_kind, p_entity_type, p_entity_id, p_decision,
    left(coalesce(nullif(trim(p_title), ''), '—'), 300),
    left(nullif(trim(p_note), ''), 2000),
    p_created_by
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ── 3. Task review RPC ─────────────────────────────────────────────────────
create or replace function private.review_task_impl(
  p_user_id uuid,
  p_task_id uuid,
  p_decision text,
  p_review_notes text,
  p_reopen boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer public.staff_profiles;
  v_employee public.staff_profiles;
  v_task public.tasks;
  v_notes text := nullif(trim(p_review_notes), '');
  v_decision text := nullif(trim(p_decision), '');
begin
  v_reviewer := private.require_staff(p_user_id);
  if v_reviewer.role not in ('owner', 'supervisor') then
    raise exception 'Only an owner or supervisor can review tasks' using errcode = '42501';
  end if;
  if v_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'decision_invalid');
  end if;
  if v_decision = 'rejected' and v_notes is null then
    return jsonb_build_object('ok', false, 'code', 'review_notes_required');
  end if;
  if length(coalesce(v_notes, '')) > 2000 then
    return jsonb_build_object('ok', false, 'code', 'review_notes_invalid');
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'task_not_found');
  end if;
  if not v_task.completed then
    return jsonb_build_object('ok', false, 'code', 'task_not_completed');
  end if;
  if v_task.review_status is not null then
    return jsonb_build_object('ok', false, 'code', 'task_already_reviewed');
  end if;

  select * into v_employee from public.staff_profiles where user_id = v_task.user_id;
  -- The owner is company-wide; a supervisor only reviews their own branch.
  if v_reviewer.role = 'supervisor'
    and (v_reviewer.branch_id is null or v_employee.branch_id is distinct from v_reviewer.branch_id)
  then
    raise exception 'Task belongs to another branch' using errcode = '42501';
  end if;

  if v_decision = 'rejected' and coalesce(p_reopen, false) then
    -- Redo: the task returns to the employee's list with the reason attached,
    -- and its proof is cleared so the second attempt is captured fresh.
    -- review_status goes back to null so the redo is reviewed in turn.
    update public.tasks set
      completed = false,
      completed_at = null,
      photo_path = null,
      yes_no_answer = null,
      review_status = null,
      review_notes = v_notes,
      reviewed_by = p_user_id,
      reviewed_at = now(),
      notes = coalesce(notes, '')
              || case when coalesce(notes, '') = '' then '' else E'\n' end
              || 'سبب الإعادة: ' || v_notes
    where id = v_task.id;
  else
    update public.tasks set
      review_status = v_decision,
      review_notes = v_notes,
      reviewed_by = p_user_id,
      reviewed_at = now()
    where id = v_task.id;
  end if;

  perform private.notify_staff(
    v_task.user_id, 'task_review', 'task', v_task.id, v_decision,
    v_task.title, v_notes, p_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'task_id', v_task.id,
    'decision', v_decision,
    'reopened', v_decision = 'rejected' and coalesce(p_reopen, false)
  );
end;
$$;

create or replace function public.review_task(
  p_task_id uuid,
  p_decision text,
  p_review_notes text default null,
  p_reopen boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.review_task_impl(
    (select auth.uid()), p_task_id, p_decision, p_review_notes, p_reopen
  );
$$;

-- ── 4. Report review now notifies the employee who submitted it ────────────
create or replace function private.review_staff_report_impl(
  p_user_id uuid,
  p_report_type text,
  p_report_id uuid,
  p_decision public.report_status,
  p_review_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_branch_id uuid;
  v_current_status public.report_status;
  v_submitted_by uuid;
begin
  if p_user_id is null or p_user_id is distinct from (select auth.uid()) then
    raise exception 'Authenticated staff identity is required'
      using errcode = '42501';
  end if;

  v_profile := private.require_staff(p_user_id);
  if v_profile.role not in ('owner', 'supervisor') then
    raise exception 'Only an owner or assigned supervisor can review reports'
      using errcode = '42501';
  end if;
  if v_profile.role = 'supervisor' and v_profile.branch_id is null then
    raise exception 'Only an assigned supervisor can review reports'
      using errcode = '42501';
  end if;
  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'Decision must be confirmed or rejected' using errcode = '22023';
  end if;
  if p_decision = 'rejected'
    and (p_review_notes is null or length(trim(p_review_notes)) = 0)
  then
    raise exception 'Rejection notes are required' using errcode = '22023';
  end if;
  if p_review_notes is not null and length(trim(p_review_notes)) > 5000 then
    raise exception 'Review notes are too long' using errcode = '22023';
  end if;

  if p_report_type = 'cleaning' then
    select branch_id, status, submitted_by into v_branch_id, v_current_status, v_submitted_by
    from public.cleaning_reports where id = p_report_id for update;
  elsif p_report_type = 'barista' then
    select branch_id, status, submitted_by into v_branch_id, v_current_status, v_submitted_by
    from public.barista_reports where id = p_report_id for update;
  elsif p_report_type = 'kitchen' then
    select branch_id, status, submitted_by into v_branch_id, v_current_status, v_submitted_by
    from public.kitchen_reports where id = p_report_id for update;
  else
    raise exception 'Unknown report type' using errcode = '22023';
  end if;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_profile.role <> 'owner' and v_branch_id <> v_profile.branch_id then
    raise exception 'Report belongs to another branch' using errcode = '42501';
  end if;
  if v_current_status <> 'pending' then
    raise exception 'Only pending reports can be reviewed' using errcode = '23514';
  end if;

  if p_report_type = 'cleaning' then
    update public.cleaning_reports set
      status = p_decision,
      reviewed_by = p_user_id,
      review_notes = nullif(trim(p_review_notes), ''),
      reviewed_at = now()
    where id = p_report_id;
  elsif p_report_type = 'barista' then
    update public.barista_reports set
      status = p_decision,
      reviewed_by = p_user_id,
      review_notes = nullif(trim(p_review_notes), ''),
      reviewed_at = now()
    where id = p_report_id;
  else
    update public.kitchen_reports set
      status = p_decision,
      reviewed_by = p_user_id,
      review_notes = nullif(trim(p_review_notes), ''),
      reviewed_at = now()
    where id = p_report_id;
  end if;

  perform private.notify_staff(
    v_submitted_by, 'report_review', p_report_type, p_report_id,
    case when p_decision = 'confirmed' then 'approved' else 'rejected' end,
    case p_report_type
      when 'cleaning' then 'تقرير النظافة'
      when 'barista' then 'تقرير الباريستا'
      else 'تقرير المطبخ'
    end,
    p_review_notes, p_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'report_type', p_report_type,
    'report_id', p_report_id,
    'status', p_decision,
    'reviewed_at', now()
  );
end;
$$;

-- ── 5. Reading the bell ────────────────────────────────────────────────────
create or replace function private.mark_staff_notifications_read_impl(
  p_user_id uuid,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_staff(p_user_id);
  update public.staff_notifications
  set read_at = now()
  where user_id = p_user_id
    and read_at is null
    and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'marked', v_count);
end;
$$;

create or replace function public.mark_staff_notifications_read(p_ids uuid[] default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.mark_staff_notifications_read_impl((select auth.uid()), p_ids);
$$;

-- ── 6. Grants ──────────────────────────────────────────────────────────────
revoke all on function private.notify_staff(uuid,text,text,uuid,text,text,text,uuid) from public, anon;
revoke all on function private.review_task_impl(uuid,uuid,text,text,boolean) from public, anon;
grant execute on function private.review_task_impl(uuid,uuid,text,text,boolean) to authenticated;
revoke all on function public.review_task(uuid,text,text,boolean) from public, anon;
grant execute on function public.review_task(uuid,text,text,boolean) to authenticated;
revoke all on function private.mark_staff_notifications_read_impl(uuid,uuid[]) from public, anon;
grant execute on function private.mark_staff_notifications_read_impl(uuid,uuid[]) to authenticated;
revoke all on function public.mark_staff_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_staff_notifications_read(uuid[]) to authenticated;
