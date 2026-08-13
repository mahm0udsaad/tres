-- Employee-authored free text is private to the owner. Operational task
-- instructions and report checklist results remain in their public rows, but
-- the employee's own note is captured in a non-exposed schema before the row
-- can be read by supervisors or other branch roles.

create table if not exists private.employee_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in ('task', 'cleaning_report', 'barista_report', 'kitchen_report', 'water_check')
  ),
  entity_id uuid not null,
  author_id uuid not null,
  note text not null check (length(trim(note)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

alter table private.employee_notes enable row level security;
revoke all on table private.employee_notes from public, anon, authenticated;

create or replace function private.store_employee_note(
  p_entity_type text,
  p_entity_id uuid,
  p_author_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(trim(p_note), '');
begin
  if p_entity_type not in ('task', 'cleaning_report', 'barista_report', 'kitchen_report', 'water_check')
    or p_entity_id is null
    or p_author_id is null
    or v_note is null
    or length(v_note) > 5000
  then
    return;
  end if;

  insert into private.employee_notes (entity_type, entity_id, author_id, note)
  values (p_entity_type, p_entity_id, p_author_id, v_note)
  on conflict (entity_type, entity_id) do update
    set note = excluded.note,
        author_id = excluded.author_id,
        updated_at = now();
end;
$$;

create or replace function private.capture_task_employee_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marker constant text := 'ملاحظة الموظف:';
  v_position integer;
  v_employee_note text;
begin
  v_position := position(v_marker in coalesce(new.notes, ''));
  if v_position = 0 then
    return new;
  end if;

  v_employee_note := nullif(trim(substr(
    new.notes,
    v_position + char_length(v_marker)
  )), '');
  new.notes := nullif(trim(substr(new.notes, 1, v_position - 1)), '');

  perform private.store_employee_note(
    'task', new.id, new.user_id, v_employee_note
  );
  return new;
end;
$$;

drop trigger if exists capture_task_employee_note on public.tasks;
create trigger capture_task_employee_note
before insert or update of notes on public.tasks
for each row execute function private.capture_task_employee_note();

create or replace function private.capture_report_employee_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marker constant text := 'ملاحظة الموظف:';
  v_position integer;
  v_employee_note text;
  v_public_summary text;
  v_entity_type text;
begin
  if tg_table_name = 'barista_reports' then
    v_position := position(v_marker in coalesce(new.handover_notes, ''));
    if v_position = 0 then return new; end if;
    v_employee_note := nullif(trim(substr(
      new.handover_notes,
      v_position + char_length(v_marker)
    )), '');
    v_public_summary := nullif(trim(substr(new.handover_notes, 1, v_position - 1)), '');
    new.handover_notes := coalesce(v_public_summary, 'تم إرسال التقرير.');
    v_entity_type := 'barista_report';
  else
    v_position := position(v_marker in coalesce(new.cleanliness_notes, ''));
    if v_position = 0 then return new; end if;
    v_employee_note := nullif(trim(substr(
      new.cleanliness_notes,
      v_position + char_length(v_marker)
    )), '');
    v_public_summary := nullif(trim(substr(new.cleanliness_notes, 1, v_position - 1)), '');
    new.cleanliness_notes := coalesce(v_public_summary, 'تم إرسال التقرير.');
    v_entity_type := case tg_table_name
      when 'cleaning_reports' then 'cleaning_report'
      else 'kitchen_report'
    end;
  end if;

  perform private.store_employee_note(
    v_entity_type, new.id, new.submitted_by, v_employee_note
  );
  return new;
end;
$$;

drop trigger if exists capture_cleaning_report_employee_note on public.cleaning_reports;
create trigger capture_cleaning_report_employee_note
before insert or update of cleanliness_notes on public.cleaning_reports
for each row execute function private.capture_report_employee_note();

drop trigger if exists capture_barista_report_employee_note on public.barista_reports;
create trigger capture_barista_report_employee_note
before insert or update of handover_notes on public.barista_reports
for each row execute function private.capture_report_employee_note();

drop trigger if exists capture_kitchen_report_employee_note on public.kitchen_reports;
create trigger capture_kitchen_report_employee_note
before insert or update of cleanliness_notes on public.kitchen_reports
for each row execute function private.capture_report_employee_note();

create or replace function private.capture_water_check_employee_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_note text := nullif(trim(new.notes), '');
begin
  if v_employee_note is null then
    return new;
  end if;

  perform private.store_employee_note(
    'water_check', new.id, new.recorded_by, v_employee_note
  );
  new.notes := null;
  return new;
end;
$$;

drop trigger if exists capture_water_check_employee_note on public.water_quality_checks;
create trigger capture_water_check_employee_note
before insert or update of notes on public.water_quality_checks
for each row execute function private.capture_water_check_employee_note();

-- Move already-saved free text out of shared rows. The capture triggers do the
-- split while these no-op updates preserve the operational summaries.
update public.tasks
set notes = notes
where position('ملاحظة الموظف:' in coalesce(notes, '')) > 0;

update public.cleaning_reports
set cleanliness_notes = cleanliness_notes
where position('ملاحظة الموظف:' in coalesce(cleanliness_notes, '')) > 0;

update public.barista_reports
set handover_notes = handover_notes
where position('ملاحظة الموظف:' in coalesce(handover_notes, '')) > 0;

update public.kitchen_reports
set cleanliness_notes = cleanliness_notes
where position('ملاحظة الموظف:' in coalesce(cleanliness_notes, '')) > 0;

update public.water_quality_checks
set notes = notes
where nullif(trim(notes), '') is not null;

create or replace function private.get_owner_employee_notes_impl(p_user_id uuid)
returns table (
  entity_type text,
  entity_id uuid,
  author_id uuid,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'owner' then
    raise exception 'Only owners can read employee notes' using errcode = '42501';
  end if;

  return query
  select employee_note.entity_type,
         employee_note.entity_id,
         employee_note.author_id,
         employee_note.note,
         employee_note.created_at
  from private.employee_notes employee_note
  order by employee_note.created_at desc
  limit 2000;
end;
$$;

create or replace function public.get_owner_employee_notes()
returns table (
  entity_type text,
  entity_id uuid,
  author_id uuid,
  note text,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_owner_employee_notes_impl((select auth.uid()));
$$;

revoke all on function private.store_employee_note(text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.capture_task_employee_note() from public, anon, authenticated;
revoke all on function private.capture_report_employee_note() from public, anon, authenticated;
revoke all on function private.capture_water_check_employee_note() from public, anon, authenticated;
revoke all on function private.get_owner_employee_notes_impl(uuid) from public, anon;
grant execute on function private.get_owner_employee_notes_impl(uuid) to authenticated;

revoke all on function public.get_owner_employee_notes() from public, anon;
grant execute on function public.get_owner_employee_notes() to authenticated;
