-- Staff Operations Dashboard — reporting, review, evidence, and daily logs
--
-- Public RPC wrappers never accept a caller identity. Their private,
-- security-definer implementations verify auth.uid(), role, and branch before
-- writing. Report tables are read-only through the Data API; submissions and
-- reviews must use the RPCs so audit fields and Stage 1 task completion cannot
-- be bypassed.

do $$
begin
  create type public.report_status as enum ('pending', 'confirmed', 'rejected');
exception
  when duplicate_object then null;
end $$;

create or replace function private.valid_inventory_counts(p_inventory jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_count numeric;
  v_has_product boolean := false;
  v_has_dessert boolean := false;
begin
  if p_inventory is null
    or jsonb_typeof(p_inventory) <> 'array'
    or jsonb_array_length(p_inventory) < 2
    or jsonb_array_length(p_inventory) > 100
  then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_inventory)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item->'name') is distinct from 'string'
      or length(trim(v_item->>'name')) not between 1 and 120
      or jsonb_typeof(v_item->'category') is distinct from 'string'
      or (v_item->>'category') not in ('product', 'dessert')
      or jsonb_typeof(v_item->'count') is distinct from 'number'
    then
      return false;
    end if;

    begin
      v_count := (v_item->>'count')::numeric;
    exception
      when others then return false;
    end;

    if v_count < 0 or v_count > 100000 or v_count <> trunc(v_count) then
      return false;
    end if;

    v_has_product := v_has_product or (v_item->>'category' = 'product');
    v_has_dessert := v_has_dessert or (v_item->>'category' = 'dessert');
  end loop;

  return v_has_product and v_has_dessert;
end;
$$;

create table if not exists public.cleaning_reports (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id) on delete restrict,
  report_date        date not null,
  revision           integer not null default 1 check (revision > 0),
  submitted_by       uuid not null references public.staff_profiles(user_id) on delete restrict,
  cleanliness_notes  text not null check (length(trim(cleanliness_notes)) between 1 and 5000),
  report_data        jsonb not null default '{}'::jsonb check (jsonb_typeof(report_data) = 'object'),
  photo_paths        text[] not null check (cardinality(photo_paths) > 0),
  photos             text[] generated always as (photo_paths) stored,
  status             public.report_status not null default 'pending',
  reviewed_by        uuid references public.staff_profiles(user_id) on delete restrict,
  review_notes       text check (
    review_notes is null or length(trim(review_notes)) between 1 and 5000
  ),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint cleaning_reports_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null)
    or (
      status = 'confirmed'
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      status = 'rejected'
      and reviewed_by is not null
      and reviewed_at is not null
      and length(trim(review_notes)) > 0
    )
  ),
  unique (submitted_by, report_date, revision)
);

create table if not exists public.barista_reports (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id) on delete restrict,
  report_date          date not null,
  revision             integer not null default 1 check (revision > 0),
  submitted_by         uuid not null references public.staff_profiles(user_id) on delete restrict,
  handover_notes       text not null check (length(trim(handover_notes)) between 1 and 5000),
  report_data          jsonb not null default '{}'::jsonb check (jsonb_typeof(report_data) = 'object'),
  bar_clean_confirmed  boolean not null check (bar_clean_confirmed),
  photo_paths          text[] not null default '{}',
  photos               text[] generated always as (photo_paths) stored,
  status               public.report_status not null default 'pending',
  reviewed_by          uuid references public.staff_profiles(user_id) on delete restrict,
  review_notes         text check (
    review_notes is null or length(trim(review_notes)) between 1 and 5000
  ),
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint barista_reports_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null)
    or (
      status = 'confirmed'
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      status = 'rejected'
      and reviewed_by is not null
      and reviewed_at is not null
      and length(trim(review_notes)) > 0
    )
  ),
  unique (submitted_by, report_date, revision)
);

create table if not exists public.kitchen_reports (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id) on delete restrict,
  report_date        date not null,
  revision           integer not null default 1 check (revision > 0),
  submitted_by       uuid not null references public.staff_profiles(user_id) on delete restrict,
  cleanliness_notes  text not null check (length(trim(cleanliness_notes)) between 1 and 5000),
  photo_paths        text[] not null check (cardinality(photo_paths) > 0),
  photos             text[] generated always as (photo_paths) stored,
  inventory_counts   jsonb not null check (
    private.valid_inventory_counts(inventory_counts)
  ),
  status             public.report_status not null default 'pending',
  reviewed_by        uuid references public.staff_profiles(user_id) on delete restrict,
  review_notes       text check (
    review_notes is null or length(trim(review_notes)) between 1 and 5000
  ),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint kitchen_reports_review_state check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null)
    or (
      status = 'confirmed'
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      status = 'rejected'
      and reviewed_by is not null
      and reviewed_at is not null
      and length(trim(review_notes)) > 0
    )
  ),
  unique (submitted_by, report_date, revision)
);

create table if not exists public.water_quality_checks (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id) on delete restrict,
  check_date   date not null,
  salt_ratio   numeric not null check (salt_ratio >= 0),
  photo_path   text not null check (length(trim(photo_path)) > 0),
  notes        text check (notes is null or length(trim(notes)) between 1 and 5000),
  recorded_by  uuid not null references public.staff_profiles(user_id) on delete restrict,
  created_at   timestamptz not null default now()
);

create table if not exists public.daily_beverage_logs (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id) on delete restrict,
  log_date     date not null,
  employee_id  uuid not null references public.staff_profiles(user_id) on delete restrict,
  consumed     boolean not null default false,
  recorded_by  uuid not null references public.staff_profiles(user_id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, log_date)
);

create index if not exists cleaning_reports_branch_queue_idx
  on public.cleaning_reports(branch_id, status, report_date desc, created_at desc);
create index if not exists cleaning_reports_submitter_idx
  on public.cleaning_reports(submitted_by, report_date desc);
create index if not exists barista_reports_branch_queue_idx
  on public.barista_reports(branch_id, status, report_date desc, created_at desc);
create index if not exists barista_reports_submitter_idx
  on public.barista_reports(submitted_by, report_date desc);
create index if not exists kitchen_reports_branch_queue_idx
  on public.kitchen_reports(branch_id, status, report_date desc, created_at desc);
create index if not exists kitchen_reports_submitter_idx
  on public.kitchen_reports(submitted_by, report_date desc);
create index if not exists water_quality_checks_branch_date_idx
  on public.water_quality_checks(branch_id, check_date desc, created_at desc);
create index if not exists water_quality_checks_recorder_idx
  on public.water_quality_checks(recorded_by, check_date desc);
create index if not exists daily_beverage_logs_branch_date_idx
  on public.daily_beverage_logs(branch_id, log_date desc, consumed);
create index if not exists daily_beverage_logs_recorder_idx
  on public.daily_beverage_logs(recorded_by, log_date desc);

drop trigger if exists cleaning_reports_touch on public.cleaning_reports;
create trigger cleaning_reports_touch before update on public.cleaning_reports
  for each row execute function public.touch_updated_at();
drop trigger if exists barista_reports_touch on public.barista_reports;
create trigger barista_reports_touch before update on public.barista_reports
  for each row execute function public.touch_updated_at();
drop trigger if exists kitchen_reports_touch on public.kitchen_reports;
create trigger kitchen_reports_touch before update on public.kitchen_reports
  for each row execute function public.touch_updated_at();
drop trigger if exists daily_beverage_logs_touch on public.daily_beverage_logs;
create trigger daily_beverage_logs_touch before update on public.daily_beverage_logs
  for each row execute function public.touch_updated_at();

comment on table public.cleaning_reports is
  'Versioned daily cleaning evidence. Submit through submit_cleaning_report().';
comment on table public.barista_reports is
  'Versioned daily bar handover evidence. Submit through submit_barista_report().';
comment on table public.kitchen_reports is
  'Versioned daily kitchen evidence and structured inventory counts.';
comment on table public.water_quality_checks is
  'Branch water salt-ratio measurements with one private evidence object.';
comment on table public.daily_beverage_logs is
  'One allocated-drink consumption state per employee and branch-local date.';
comment on column public.cleaning_reports.photo_paths is
  'Object keys in the private staff-evidence bucket, rooted at submitted_by/.';
comment on column public.cleaning_reports.photos is
  'Read-compatible alias of photo_paths for report consumers.';
comment on column public.kitchen_reports.inventory_counts is
  'Array of {name, category: product|dessert, count: nonnegative integer}.';

alter table public.cleaning_reports enable row level security;
alter table public.barista_reports enable row level security;
alter table public.kitchen_reports enable row level security;
alter table public.water_quality_checks enable row level security;
alter table public.daily_beverage_logs enable row level security;

revoke all on public.cleaning_reports from anon, authenticated;
revoke all on public.barista_reports from anon, authenticated;
revoke all on public.kitchen_reports from anon, authenticated;
revoke all on public.water_quality_checks from anon, authenticated;
revoke all on public.daily_beverage_logs from anon, authenticated;
grant select on public.cleaning_reports to authenticated;
grant select on public.barista_reports to authenticated;
grant select on public.kitchen_reports to authenticated;
grant select on public.water_quality_checks to authenticated;
grant select on public.daily_beverage_logs to authenticated;

-- These helpers live outside exposed schemas and bypass staff_profiles RLS only
-- after establishing a real authenticated identity. Callers cannot inject a
-- user id into any public wrapper.
create or replace function private.can_read_branch_report(
  p_branch_id uuid,
  p_submitted_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.staff_profiles viewer
      where viewer.user_id = (select auth.uid())
        and viewer.is_active
        and (
          viewer.user_id = p_submitted_by
          or (
            viewer.branch_id = p_branch_id
            and viewer.role in ('owner', 'manager', 'supervisor', 'shift_manager')
          )
        )
    );
$$;

create or replace function private.can_review_branch_report(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.staff_profiles viewer
      where viewer.user_id = (select auth.uid())
        and viewer.is_active
        and viewer.branch_id = p_branch_id
        and viewer.role = 'supervisor'
    );
$$;

create or replace function private.can_read_branch_log(
  p_branch_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.staff_profiles viewer
      where viewer.user_id = (select auth.uid())
        and viewer.is_active
        and (
          viewer.user_id = p_subject_id
          or (
            viewer.branch_id = p_branch_id
            and viewer.role in ('owner', 'manager', 'supervisor', 'shift_manager')
          )
        )
    );
$$;

create or replace function private.can_upload_staff_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and split_part(p_object_name, '/', 1) = (select auth.uid())::text
    and position('/' in p_object_name) > 0
    and exists (
      select 1
      from public.staff_profiles viewer
      where viewer.user_id = (select auth.uid())
        and viewer.is_active
    );
$$;

create or replace function private.can_read_staff_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      split_part(p_object_name, '/', 1) = (select auth.uid())::text
      or exists (
        select 1
        from public.staff_profiles viewer
        join public.staff_profiles uploader
          on uploader.user_id::text = split_part(p_object_name, '/', 1)
        where viewer.user_id = (select auth.uid())
          and viewer.is_active
          and uploader.is_active
          and viewer.role in ('owner', 'manager', 'supervisor', 'shift_manager')
          and viewer.branch_id = uploader.branch_id
      )
    );
$$;

create or replace function private.can_mutate_staff_evidence(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.can_upload_staff_evidence(p_object_name)
    and not exists (
      select 1 from public.cleaning_reports report
      where p_object_name = any(report.photo_paths)
    )
    and not exists (
      select 1 from public.barista_reports report
      where p_object_name = any(report.photo_paths)
    )
    and not exists (
      select 1 from public.kitchen_reports report
      where p_object_name = any(report.photo_paths)
    )
    and not exists (
      select 1 from public.water_quality_checks check_row
      where check_row.photo_path = p_object_name
    );
$$;

drop policy if exists cleaning_reports_read_authorized on public.cleaning_reports;
create policy cleaning_reports_read_authorized
  on public.cleaning_reports for select
  to authenticated
  using ((select private.can_read_branch_report(branch_id, submitted_by)));

drop policy if exists barista_reports_read_authorized on public.barista_reports;
create policy barista_reports_read_authorized
  on public.barista_reports for select
  to authenticated
  using ((select private.can_read_branch_report(branch_id, submitted_by)));

drop policy if exists kitchen_reports_read_authorized on public.kitchen_reports;
create policy kitchen_reports_read_authorized
  on public.kitchen_reports for select
  to authenticated
  using ((select private.can_read_branch_report(branch_id, submitted_by)));

drop policy if exists water_quality_checks_read_authorized on public.water_quality_checks;
create policy water_quality_checks_read_authorized
  on public.water_quality_checks for select
  to authenticated
  using ((select private.can_read_branch_log(branch_id, recorded_by)));

drop policy if exists daily_beverage_logs_read_authorized on public.daily_beverage_logs;
create policy daily_beverage_logs_read_authorized
  on public.daily_beverage_logs for select
  to authenticated
  using ((select private.can_read_branch_log(branch_id, employee_id)));

-- Report readers need branch staff display names for their queues. This does
-- not alter attendance_records: shift_manager still has no attendance policy.
drop policy if exists staff_profiles_read_branch_report_roles on public.staff_profiles;
create policy staff_profiles_read_branch_report_roles
  on public.staff_profiles for select
  to authenticated
  using ((select private.can_read_branch_report(branch_id, user_id)));

-- Private evidence is stored under `<uploader auth uid>/<module>/<file>`.
-- Owners may upload, read, overwrite, and delete their own objects.
-- Branch owner/manager/supervisor/shift-manager readers may view evidence from
-- active staff in their branch, but cannot mutate it.
insert into storage.buckets (id, name, public)
values ('staff-evidence', 'staff-evidence', false)
on conflict (id) do update set public = false;

drop policy if exists "staff evidence owner insert" on storage.objects;
create policy "staff evidence owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'staff-evidence'
    and (select private.can_upload_staff_evidence(name))
  );

drop policy if exists "staff evidence authorized read" on storage.objects;
create policy "staff evidence authorized read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'staff-evidence'
    and (select private.can_read_staff_evidence(name))
  );

drop policy if exists "staff evidence owner update" on storage.objects;
create policy "staff evidence owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'staff-evidence'
    and (select private.can_mutate_staff_evidence(name))
  )
  with check (
    bucket_id = 'staff-evidence'
    and (select private.can_mutate_staff_evidence(name))
  );

drop policy if exists "staff evidence owner delete" on storage.objects;
create policy "staff evidence owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'staff-evidence'
    and (select private.can_mutate_staff_evidence(name))
  );

create or replace function private.assert_staff_evidence(
  p_user_id uuid,
  p_paths text[],
  p_required boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
  v_distinct_count integer;
  v_object_count integer;
begin
  if p_user_id is null or p_user_id <> (select auth.uid()) then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_paths is null or (p_required and cardinality(p_paths) = 0) then
    raise exception 'At least one evidence photo is required' using errcode = '22023';
  end if;

  if cardinality(p_paths) > 20 then
    raise exception 'A maximum of 20 evidence photos is allowed' using errcode = '22023';
  end if;

  foreach v_path in array coalesce(p_paths, '{}'::text[])
  loop
    if v_path is null
      or length(v_path) = 0
      or length(v_path) > 1024
      or split_part(v_path, '/', 1) <> p_user_id::text
      or position('/' in v_path) = 0
    then
      raise exception 'Evidence paths must be inside your user folder'
        using errcode = '22023';
    end if;
  end loop;

  select count(distinct path), count(*)
  into v_distinct_count, v_object_count
  from unnest(coalesce(p_paths, '{}'::text[])) as supplied(path);

  if v_distinct_count <> v_object_count then
    raise exception 'Duplicate evidence paths are not allowed' using errcode = '22023';
  end if;

  select count(*)
  into v_object_count
  from storage.objects object
  where object.bucket_id = 'staff-evidence'
    and object.name = any(coalesce(p_paths, '{}'::text[]));

  if v_object_count <> cardinality(coalesce(p_paths, '{}'::text[])) then
    raise exception 'Every evidence path must reference an uploaded object'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function private.complete_report_tasks(
  p_user_id uuid,
  p_report_date date,
  p_task_types text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed integer;
begin
  if p_user_id is null or p_user_id <> (select auth.uid()) then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  update public.tasks
  set completed = true, completed_at = now()
  where user_id = p_user_id
    and task_date = p_report_date
    and task_type = any(p_task_types)
    and not completed;

  get diagnostics v_completed = row_count;
  return v_completed;
end;
$$;

create or replace function private.submit_cleaning_report_impl(
  p_user_id uuid,
  p_cleanliness_notes text,
  p_report_data jsonb,
  p_photo_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_report public.cleaning_reports;
  v_report_date date;
  v_revision integer;
  v_latest_status public.report_status;
  v_tasks_completed integer;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'cleaning_staff' then
    raise exception 'Only cleaning staff can submit cleaning reports'
      using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;
  if p_cleanliness_notes is null
    or length(trim(p_cleanliness_notes)) not between 1 and 5000
  then
    raise exception 'Cleanliness notes are required' using errcode = '22023';
  end if;
  if p_report_data is null or jsonb_typeof(p_report_data) <> 'object' then
    raise exception 'Report data must be a JSON object' using errcode = '22023';
  end if;

  perform private.assert_staff_evidence(p_user_id, p_photo_paths, true);

  select (now() at time zone branch.timezone)::date
  into strict v_report_date
  from public.branches branch
  where branch.id = v_profile.branch_id;

  perform pg_advisory_xact_lock(hashtextextended(
    'cleaning:' || p_user_id::text || ':' || v_report_date::text,
    0
  ));
  select revision, status into v_revision, v_latest_status
  from public.cleaning_reports
  where submitted_by = p_user_id and report_date = v_report_date
  order by revision desc
  limit 1;
  if v_latest_status in ('pending', 'confirmed') then
    raise exception 'A pending or confirmed cleaning report already exists for today'
      using errcode = '23514';
  end if;
  v_revision := coalesce(v_revision, 0) + 1;

  insert into public.cleaning_reports (
    branch_id, report_date, revision, submitted_by,
    cleanliness_notes, report_data, photo_paths
  ) values (
    v_profile.branch_id, v_report_date, v_revision, p_user_id,
    trim(p_cleanliness_notes), p_report_data, p_photo_paths
  )
  returning * into v_report;

  v_tasks_completed := private.complete_report_tasks(
    p_user_id,
    v_report_date,
    array['cleaning_report', 'cleaning_photos']
  );

  return jsonb_build_object(
    'ok', true,
    'report_id', v_report.id,
    'report_date', v_report.report_date,
    'revision', v_report.revision,
    'status', v_report.status,
    'tasks_completed', v_tasks_completed
  );
end;
$$;

create or replace function private.submit_barista_report_impl(
  p_user_id uuid,
  p_handover_notes text,
  p_report_data jsonb,
  p_bar_clean_confirmed boolean,
  p_photo_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_report public.barista_reports;
  v_report_date date;
  v_revision integer;
  v_latest_status public.report_status;
  v_tasks_completed integer;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'barista' then
    raise exception 'Only baristas can submit barista reports' using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;
  if p_handover_notes is null or length(trim(p_handover_notes)) not between 1 and 5000 then
    raise exception 'Handover notes are required' using errcode = '22023';
  end if;
  if p_report_data is null or jsonb_typeof(p_report_data) <> 'object' then
    raise exception 'Report data must be a JSON object' using errcode = '22023';
  end if;
  if p_bar_clean_confirmed is distinct from true then
    raise exception 'Confirm the bar is clean before handover' using errcode = '22023';
  end if;

  perform private.assert_staff_evidence(p_user_id, coalesce(p_photo_paths, '{}'::text[]), false);

  select (now() at time zone branch.timezone)::date
  into strict v_report_date
  from public.branches branch
  where branch.id = v_profile.branch_id;

  perform pg_advisory_xact_lock(hashtextextended(
    'barista:' || p_user_id::text || ':' || v_report_date::text,
    0
  ));
  select revision, status into v_revision, v_latest_status
  from public.barista_reports
  where submitted_by = p_user_id and report_date = v_report_date
  order by revision desc
  limit 1;
  if v_latest_status in ('pending', 'confirmed') then
    raise exception 'A pending or confirmed barista report already exists for today'
      using errcode = '23514';
  end if;
  v_revision := coalesce(v_revision, 0) + 1;

  insert into public.barista_reports (
    branch_id, report_date, revision, submitted_by,
    handover_notes, report_data, bar_clean_confirmed, photo_paths
  ) values (
    v_profile.branch_id, v_report_date, v_revision, p_user_id,
    trim(p_handover_notes), p_report_data, true, coalesce(p_photo_paths, '{}'::text[])
  )
  returning * into v_report;

  v_tasks_completed := private.complete_report_tasks(
    p_user_id,
    v_report_date,
    array['barista_report', 'bar_clean_confirmation']
  );

  return jsonb_build_object(
    'ok', true,
    'report_id', v_report.id,
    'report_date', v_report.report_date,
    'revision', v_report.revision,
    'status', v_report.status,
    'tasks_completed', v_tasks_completed
  );
end;
$$;

create or replace function private.submit_kitchen_report_impl(
  p_user_id uuid,
  p_cleanliness_notes text,
  p_inventory_counts jsonb,
  p_photo_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_report public.kitchen_reports;
  v_report_date date;
  v_revision integer;
  v_latest_status public.report_status;
  v_tasks_completed integer;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'kitchen_manager' then
    raise exception 'Only kitchen managers can submit kitchen reports'
      using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;
  if p_cleanliness_notes is null
    or length(trim(p_cleanliness_notes)) not between 1 and 5000
  then
    raise exception 'Cleanliness notes are required' using errcode = '22023';
  end if;
  if not private.valid_inventory_counts(p_inventory_counts) then
    raise exception 'Inventory counts must be a non-empty array of valid product or dessert counts'
      using errcode = '22023';
  end if;

  perform private.assert_staff_evidence(p_user_id, p_photo_paths, true);

  select (now() at time zone branch.timezone)::date
  into strict v_report_date
  from public.branches branch
  where branch.id = v_profile.branch_id;

  perform pg_advisory_xact_lock(hashtextextended(
    'kitchen:' || p_user_id::text || ':' || v_report_date::text,
    0
  ));
  select revision, status into v_revision, v_latest_status
  from public.kitchen_reports
  where submitted_by = p_user_id and report_date = v_report_date
  order by revision desc
  limit 1;
  if v_latest_status in ('pending', 'confirmed') then
    raise exception 'A pending or confirmed kitchen report already exists for today'
      using errcode = '23514';
  end if;
  v_revision := coalesce(v_revision, 0) + 1;

  insert into public.kitchen_reports (
    branch_id, report_date, revision, submitted_by,
    cleanliness_notes, photo_paths, inventory_counts
  ) values (
    v_profile.branch_id, v_report_date, v_revision, p_user_id,
    trim(p_cleanliness_notes), p_photo_paths, p_inventory_counts
  )
  returning * into v_report;

  v_tasks_completed := private.complete_report_tasks(
    p_user_id,
    v_report_date,
    array['kitchen_report', 'kitchen_photos', 'inventory_count']
  );

  return jsonb_build_object(
    'ok', true,
    'report_id', v_report.id,
    'report_date', v_report.report_date,
    'revision', v_report.revision,
    'status', v_report.status,
    'tasks_completed', v_tasks_completed
  );
end;
$$;

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
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role <> 'supervisor' or v_profile.branch_id is null then
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
    select branch_id, status into v_branch_id, v_current_status
    from public.cleaning_reports where id = p_report_id for update;
  elsif p_report_type = 'barista' then
    select branch_id, status into v_branch_id, v_current_status
    from public.barista_reports where id = p_report_id for update;
  elsif p_report_type = 'kitchen' then
    select branch_id, status into v_branch_id, v_current_status
    from public.kitchen_reports where id = p_report_id for update;
  else
    raise exception 'Unknown report type' using errcode = '22023';
  end if;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_branch_id <> v_profile.branch_id then
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

  return jsonb_build_object(
    'ok', true,
    'report_type', p_report_type,
    'report_id', p_report_id,
    'status', p_decision,
    'reviewed_at', now()
  );
end;
$$;

create or replace function private.record_water_quality_check_impl(
  p_user_id uuid,
  p_salt_ratio numeric,
  p_photo_path text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_profiles;
  v_check public.water_quality_checks;
  v_check_date date;
begin
  v_profile := private.require_staff(p_user_id);
  if v_profile.role not in ('owner', 'manager', 'supervisor', 'kitchen_manager') then
    raise exception 'This role cannot record water quality checks'
      using errcode = '42501';
  end if;
  if v_profile.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;
  if p_salt_ratio is null or p_salt_ratio < 0 then
    raise exception 'Salt ratio must be zero or greater' using errcode = '22023';
  end if;
  if p_notes is not null and length(trim(p_notes)) not between 1 and 5000 then
    raise exception 'Water check notes are invalid' using errcode = '22023';
  end if;

  perform private.assert_staff_evidence(p_user_id, array[p_photo_path], true);

  select (now() at time zone branch.timezone)::date
  into strict v_check_date
  from public.branches branch
  where branch.id = v_profile.branch_id;

  insert into public.water_quality_checks (
    branch_id, check_date, salt_ratio, photo_path, notes, recorded_by
  ) values (
    v_profile.branch_id, v_check_date, p_salt_ratio,
    p_photo_path, nullif(trim(p_notes), ''), p_user_id
  )
  returning * into v_check;

  return jsonb_build_object(
    'ok', true,
    'check_id', v_check.id,
    'check_date', v_check.check_date
  );
end;
$$;

create or replace function private.log_daily_beverage_impl(
  p_user_id uuid,
  p_employee_id uuid,
  p_consumed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff_profiles;
  v_employee public.staff_profiles;
  v_log public.daily_beverage_logs;
  v_log_date date;
begin
  v_actor := private.require_staff(p_user_id);
  select * into v_employee
  from public.staff_profiles
  where user_id = p_employee_id and is_active;

  if not found or v_employee.branch_id is null then
    raise exception 'Active employee profile not found' using errcode = 'P0002';
  end if;
  if p_consumed is null then
    raise exception 'Consumed state is required' using errcode = '22023';
  end if;
  if v_actor.user_id <> v_employee.user_id
    and not (
      v_actor.role in ('owner', 'manager', 'supervisor')
      and v_actor.branch_id = v_employee.branch_id
    )
  then
    raise exception 'Not allowed to record this employee beverage'
      using errcode = '42501';
  end if;
  if v_actor.role = 'shift_manager' then
    raise exception 'Shift managers have read-only access' using errcode = '42501';
  end if;

  select (now() at time zone branch.timezone)::date
  into strict v_log_date
  from public.branches branch
  where branch.id = v_employee.branch_id;

  insert into public.daily_beverage_logs (
    branch_id, log_date, employee_id, consumed, recorded_by
  ) values (
    v_employee.branch_id, v_log_date, v_employee.user_id, p_consumed, p_user_id
  )
  on conflict (employee_id, log_date) do update set
    branch_id = excluded.branch_id,
    consumed = excluded.consumed,
    recorded_by = excluded.recorded_by,
    updated_at = now()
  returning * into v_log;

  return jsonb_build_object(
    'ok', true,
    'log_id', v_log.id,
    'employee_id', v_log.employee_id,
    'log_date', v_log.log_date,
    'consumed', v_log.consumed
  );
end;
$$;

create or replace function private.get_daily_beverage_report_impl(
  p_user_id uuid,
  p_report_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.staff_profiles;
  v_report_date date;
  v_staff_total integer;
  v_consumed_total integer;
  v_employees jsonb;
begin
  v_actor := private.require_staff(p_user_id);
  if v_actor.role not in ('owner', 'manager', 'supervisor', 'shift_manager') then
    raise exception 'This role cannot read the branch beverage report'
      using errcode = '42501';
  end if;
  if v_actor.branch_id is null then
    raise exception 'No branch is assigned to this account' using errcode = '23514';
  end if;

  if p_report_date is null then
    select (now() at time zone branch.timezone)::date
    into strict v_report_date
    from public.branches branch
    where branch.id = v_actor.branch_id;
  else
    v_report_date := p_report_date;
  end if;

  select
    count(*)::integer,
    count(*) filter (where coalesce(log.consumed, false))::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'employee_id', employee.user_id,
          'full_name', employee.full_name,
          'role', employee.role,
          'consumed', coalesce(log.consumed, false),
          'recorded', log.id is not null,
          'recorded_by', log.recorded_by,
          'recorded_at', log.updated_at
        )
        order by employee.full_name, employee.user_id
      ),
      '[]'::jsonb
    )
  into v_staff_total, v_consumed_total, v_employees
  from public.staff_profiles employee
  left join public.daily_beverage_logs log
    on log.employee_id = employee.user_id
    and log.log_date = v_report_date
  where employee.branch_id = v_actor.branch_id
    and employee.is_active;

  return jsonb_build_object(
    'ok', true,
    'branch_id', v_actor.branch_id,
    'report_date', v_report_date,
    'staff_total', v_staff_total,
    'consumed_total', v_consumed_total,
    'not_consumed_total', v_staff_total - v_consumed_total,
    'employees', v_employees
  );
end;
$$;

-- Data API RPC wrappers: security invoker, fixed auth.uid() identity, and no
-- direct table mutation privileges for authenticated clients.
create or replace function public.submit_cleaning_report(
  p_cleanliness_notes text,
  p_report_data jsonb,
  p_photo_paths text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_cleaning_report_impl(
    (select auth.uid()), p_cleanliness_notes, p_report_data, p_photo_paths
  );
$$;

create or replace function public.submit_barista_report(
  p_handover_notes text,
  p_report_data jsonb,
  p_bar_clean_confirmed boolean,
  p_photo_paths text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_barista_report_impl(
    (select auth.uid()), p_handover_notes, p_report_data,
    p_bar_clean_confirmed, p_photo_paths
  );
$$;

create or replace function public.submit_kitchen_report(
  p_cleanliness_notes text,
  p_inventory_counts jsonb,
  p_photo_paths text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_kitchen_report_impl(
    (select auth.uid()), p_cleanliness_notes, p_inventory_counts, p_photo_paths
  );
$$;

create or replace function public.review_staff_report(
  p_report_type text,
  p_report_id uuid,
  p_decision public.report_status,
  p_review_notes text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.review_staff_report_impl(
    (select auth.uid()), p_report_type, p_report_id, p_decision, p_review_notes
  );
$$;

create or replace function public.record_water_quality_check(
  p_salt_ratio numeric,
  p_photo_path text,
  p_notes text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_water_quality_check_impl(
    (select auth.uid()), p_salt_ratio, p_photo_path, p_notes
  );
$$;

create or replace function public.log_daily_beverage(
  p_employee_id uuid,
  p_consumed boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.log_daily_beverage_impl(
    (select auth.uid()), p_employee_id, p_consumed
  );
$$;

create or replace function public.get_daily_beverage_report(p_report_date date)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_daily_beverage_report_impl(
    (select auth.uid()), p_report_date
  );
$$;

revoke all on function private.valid_inventory_counts(jsonb) from public, anon, authenticated;
revoke all on function private.can_read_branch_report(uuid, uuid) from public, anon;
revoke all on function private.can_review_branch_report(uuid) from public, anon;
revoke all on function private.can_read_branch_log(uuid, uuid) from public, anon;
revoke all on function private.can_upload_staff_evidence(text) from public, anon;
revoke all on function private.can_read_staff_evidence(text) from public, anon;
revoke all on function private.can_mutate_staff_evidence(text) from public, anon;
revoke all on function private.assert_staff_evidence(uuid, text[], boolean) from public, anon;
revoke all on function private.complete_report_tasks(uuid, date, text[]) from public, anon;
revoke all on function private.submit_cleaning_report_impl(uuid, text, jsonb, text[]) from public, anon;
revoke all on function private.submit_barista_report_impl(uuid, text, jsonb, boolean, text[]) from public, anon;
revoke all on function private.submit_kitchen_report_impl(uuid, text, jsonb, text[]) from public, anon;
revoke all on function private.review_staff_report_impl(uuid, text, uuid, public.report_status, text) from public, anon;
revoke all on function private.record_water_quality_check_impl(uuid, numeric, text, text) from public, anon;
revoke all on function private.log_daily_beverage_impl(uuid, uuid, boolean) from public, anon;
revoke all on function private.get_daily_beverage_report_impl(uuid, date) from public, anon;

grant execute on function private.can_read_branch_report(uuid, uuid) to authenticated;
grant execute on function private.can_review_branch_report(uuid) to authenticated;
grant execute on function private.can_read_branch_log(uuid, uuid) to authenticated;
grant execute on function private.can_upload_staff_evidence(text) to authenticated;
grant execute on function private.can_read_staff_evidence(text) to authenticated;
grant execute on function private.can_mutate_staff_evidence(text) to authenticated;
grant execute on function private.assert_staff_evidence(uuid, text[], boolean) to authenticated;
grant execute on function private.complete_report_tasks(uuid, date, text[]) to authenticated;
grant execute on function private.submit_cleaning_report_impl(uuid, text, jsonb, text[]) to authenticated;
grant execute on function private.submit_barista_report_impl(uuid, text, jsonb, boolean, text[]) to authenticated;
grant execute on function private.submit_kitchen_report_impl(uuid, text, jsonb, text[]) to authenticated;
grant execute on function private.review_staff_report_impl(uuid, text, uuid, public.report_status, text) to authenticated;
grant execute on function private.record_water_quality_check_impl(uuid, numeric, text, text) to authenticated;
grant execute on function private.log_daily_beverage_impl(uuid, uuid, boolean) to authenticated;
grant execute on function private.get_daily_beverage_report_impl(uuid, date) to authenticated;

revoke all on function public.submit_cleaning_report(text, jsonb, text[]) from public, anon;
revoke all on function public.submit_barista_report(text, jsonb, boolean, text[]) from public, anon;
revoke all on function public.submit_kitchen_report(text, jsonb, text[]) from public, anon;
revoke all on function public.review_staff_report(text, uuid, public.report_status, text) from public, anon;
revoke all on function public.record_water_quality_check(numeric, text, text) from public, anon;
revoke all on function public.log_daily_beverage(uuid, boolean) from public, anon;
revoke all on function public.get_daily_beverage_report(date) from public, anon;

grant execute on function public.submit_cleaning_report(text, jsonb, text[]) to authenticated;
grant execute on function public.submit_barista_report(text, jsonb, boolean, text[]) to authenticated;
grant execute on function public.submit_kitchen_report(text, jsonb, text[]) to authenticated;
grant execute on function public.review_staff_report(text, uuid, public.report_status, text) to authenticated;
grant execute on function public.record_water_quality_check(numeric, text, text) to authenticated;
grant execute on function public.log_daily_beverage(uuid, boolean) to authenticated;
grant execute on function public.get_daily_beverage_report(date) to authenticated;
