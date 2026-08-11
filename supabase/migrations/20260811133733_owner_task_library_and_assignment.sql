-- The task library is the source of truth for owner-created operational work.
-- A definition is created once, then assigned to one or more active employees
-- for a selected date. The employee-facing `tasks` rows remain dated work items.

create table if not exists public.task_definitions (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) between 1 and 200),
  notes           text check (notes is null or length(notes) <= 1000),
  is_required     boolean not null default true,
  requires_photo  boolean not null default false,
  requires_note   boolean not null default false,
  response_type   text not null default 'completion'
                  check (response_type in ('completion', 'yes_no')),
  is_active       boolean not null default true,
  created_by      uuid references public.staff_profiles(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint task_definitions_yes_no_requirements check (
    response_type = 'completion' or (not requires_photo and not requires_note)
  )
);

create index if not exists task_definitions_active_idx
  on public.task_definitions(is_active, created_at desc);

drop trigger if exists task_definitions_touch on public.task_definitions;
create trigger task_definitions_touch before update on public.task_definitions
  for each row execute function public.touch_updated_at();

alter table public.task_definitions enable row level security;
revoke all on public.task_definitions from anon;
grant select on public.task_definitions to authenticated;

drop policy if exists task_definitions_read_owner on public.task_definitions;
create policy task_definitions_read_owner
  on public.task_definitions for select
  to authenticated
  using ((select private.is_global_owner()));

create or replace function private.owner_save_task_definition_impl(
  p_user_id uuid,
  p_definition_id uuid,
  p_title text,
  p_notes text,
  p_is_required boolean,
  p_requires_photo boolean,
  p_requires_note boolean,
  p_response_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_definition public.task_definitions;
  v_title text := nullif(trim(p_title), '');
  v_notes text := nullif(trim(p_notes), '');
  v_response text := coalesce(nullif(trim(p_response_type), ''), 'completion');
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can manage task definitions' using errcode = '42501';
  end if;
  if v_title is null or length(v_title) > 200 or length(coalesce(v_notes, '')) > 1000
    or v_response not in ('completion', 'yes_no')
  then
    return jsonb_build_object('ok', false, 'code', 'task_invalid');
  end if;

  if p_definition_id is null then
    insert into public.task_definitions (
      title, notes, is_required, requires_photo, requires_note, response_type, created_by
    ) values (
      v_title, v_notes, coalesce(p_is_required, true),
      case when v_response = 'yes_no' then false else coalesce(p_requires_photo, false) end,
      case when v_response = 'yes_no' then false else coalesce(p_requires_note, false) end,
      v_response, p_user_id
    ) returning * into v_definition;
  else
    update public.task_definitions
    set title = v_title,
        notes = v_notes,
        is_required = coalesce(p_is_required, true),
        requires_photo = case when v_response = 'yes_no' then false else coalesce(p_requires_photo, false) end,
        requires_note = case when v_response = 'yes_no' then false else coalesce(p_requires_note, false) end,
        response_type = v_response
    where id = p_definition_id
    returning * into v_definition;
    if not found then return jsonb_build_object('ok', false, 'code', 'definition_not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'definition_id', v_definition.id);
end;
$$;

create or replace function public.owner_save_task_definition(
  p_definition_id uuid default null,
  p_title text default null,
  p_notes text default null,
  p_is_required boolean default true,
  p_requires_photo boolean default false,
  p_requires_note boolean default false,
  p_response_type text default 'completion'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_save_task_definition_impl(
    (select auth.uid()), p_definition_id, p_title, p_notes, p_is_required,
    p_requires_photo, p_requires_note, p_response_type
  );
$$;

create or replace function private.owner_assign_task_definition_impl(
  p_user_id uuid,
  p_definition_id uuid,
  p_employee_ids uuid[],
  p_task_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner public.staff_profiles;
  v_definition public.task_definitions;
  v_employee_id uuid;
  v_result jsonb;
  v_assigned integer := 0;
  v_duplicates integer := 0;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then
    raise exception 'Only owners can assign task definitions' using errcode = '42501';
  end if;
  if p_task_date is null or p_employee_ids is null or cardinality(p_employee_ids) not between 1 and 100 then
    return jsonb_build_object('ok', false, 'code', 'assignment_invalid');
  end if;
  select * into v_definition from public.task_definitions where id = p_definition_id and is_active;
  if not found then return jsonb_build_object('ok', false, 'code', 'definition_not_found'); end if;
  if (select count(*) from public.staff_profiles
      where user_id = any(p_employee_ids) and is_active
        and role not in ('owner', 'manager', 'shift_manager')) <> cardinality(p_employee_ids)
  then
    return jsonb_build_object('ok', false, 'code', 'employee_invalid');
  end if;

  foreach v_employee_id in array p_employee_ids
  loop
    v_result := private.owner_assign_task_impl(
      p_user_id, v_employee_id, p_task_date, v_definition.title,
      v_definition.is_required, v_definition.requires_photo, 0, v_definition.notes,
      v_definition.requires_note, v_definition.response_type
    );
    if (v_result->>'ok')::boolean then v_assigned := v_assigned + 1;
    elsif v_result->>'code' = 'duplicate_task' then v_duplicates := v_duplicates + 1;
    else return v_result; end if;
  end loop;
  return jsonb_build_object('ok', true, 'assigned', v_assigned, 'duplicates', v_duplicates);
end;
$$;

create or replace function public.owner_assign_task_definition(
  p_definition_id uuid,
  p_employee_ids uuid[],
  p_task_date date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.owner_assign_task_definition_impl(
    (select auth.uid()), p_definition_id, p_employee_ids, p_task_date
  );
$$;

revoke all on function private.owner_save_task_definition_impl(uuid,uuid,text,text,boolean,boolean,boolean,text) from public, anon;
grant execute on function private.owner_save_task_definition_impl(uuid,uuid,text,text,boolean,boolean,boolean,text) to authenticated;
revoke all on function public.owner_save_task_definition(uuid,text,text,boolean,boolean,boolean,text) from public, anon;
grant execute on function public.owner_save_task_definition(uuid,text,text,boolean,boolean,boolean,text) to authenticated;
revoke all on function private.owner_assign_task_definition_impl(uuid,uuid,uuid[],date) from public, anon;
grant execute on function private.owner_assign_task_definition_impl(uuid,uuid,uuid[],date) to authenticated;
revoke all on function public.owner_assign_task_definition(uuid,uuid[],date) from public, anon;
grant execute on function public.owner_assign_task_definition(uuid,uuid[],date) to authenticated;
