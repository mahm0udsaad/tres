-- Owners can remove shared checklist work and use individual assignments only.
create or replace function private.owner_clear_branch_checklists_impl(p_user_id uuid, p_branch_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner public.staff_profiles; v_tasks integer; v_templates integer;
begin
  v_owner := private.require_staff(p_user_id);
  if v_owner.role <> 'owner' then raise exception 'Only owners can clear branch checklists' using errcode = '42501'; end if;
  if p_branch_id is null or not exists (select 1 from public.branches where id = p_branch_id) then
    return jsonb_build_object('ok', false, 'code', 'branch_invalid');
  end if;
  delete from public.tasks task using public.staff_profiles staff
  where task.user_id = staff.user_id and staff.branch_id = p_branch_id
    and task.task_type = 'checklist' and not task.completed;
  get diagnostics v_tasks = row_count;
  delete from public.checklist_templates where branch_id = p_branch_id;
  get diagnostics v_templates = row_count;
  return jsonb_build_object('ok', true, 'tasks_cleared', v_tasks, 'templates_cleared', v_templates);
end; $$;

create or replace function public.owner_clear_branch_checklists(p_branch_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.owner_clear_branch_checklists_impl((select auth.uid()), p_branch_id);
$$;

revoke all on function private.owner_clear_branch_checklists_impl(uuid,uuid) from public, anon;
grant execute on function private.owner_clear_branch_checklists_impl(uuid,uuid) to authenticated;
revoke all on function public.owner_clear_branch_checklists(uuid) from public, anon;
grant execute on function public.owner_clear_branch_checklists(uuid) to authenticated;

-- Submitted employee reports are accepted immediately and remain available to
-- the owner in the company report view; no supervisor approval is required.
alter table public.cleaning_reports add column if not exists auto_approved boolean not null default false;
alter table public.barista_reports add column if not exists auto_approved boolean not null default false;
alter table public.kitchen_reports add column if not exists auto_approved boolean not null default false;

alter table public.cleaning_reports drop constraint if exists cleaning_reports_review_state;
alter table public.barista_reports drop constraint if exists barista_reports_review_state;
alter table public.kitchen_reports drop constraint if exists kitchen_reports_review_state;

alter table public.cleaning_reports add constraint cleaning_reports_review_state check (
  (status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null)
  or (status = 'confirmed' and ((auto_approved and reviewed_by is null and reviewed_at is not null and review_notes = 'تم الاعتماد تلقائياً') or (not auto_approved and reviewed_by is not null and reviewed_at is not null)))
  or (status = 'rejected' and not auto_approved and reviewed_by is not null and reviewed_at is not null and length(trim(review_notes)) > 0)
);
alter table public.barista_reports add constraint barista_reports_review_state check (
  (status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null)
  or (status = 'confirmed' and ((auto_approved and reviewed_by is null and reviewed_at is not null and review_notes = 'تم الاعتماد تلقائياً') or (not auto_approved and reviewed_by is not null and reviewed_at is not null)))
  or (status = 'rejected' and not auto_approved and reviewed_by is not null and reviewed_at is not null and length(trim(review_notes)) > 0)
);
alter table public.kitchen_reports add constraint kitchen_reports_review_state check (
  (status = 'pending' and reviewed_by is null and reviewed_at is null and review_notes is null)
  or (status = 'confirmed' and ((auto_approved and reviewed_by is null and reviewed_at is not null and review_notes = 'تم الاعتماد تلقائياً') or (not auto_approved and reviewed_by is not null and reviewed_at is not null)))
  or (status = 'rejected' and not auto_approved and reviewed_by is not null and reviewed_at is not null and length(trim(review_notes)) > 0)
);

create or replace function private.auto_approve_staff_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'confirmed';
  new.auto_approved := true;
  new.reviewed_by := null;
  new.reviewed_at := now();
  new.review_notes := 'تم الاعتماد تلقائياً';
  return new;
end; $$;

drop trigger if exists cleaning_reports_auto_approve on public.cleaning_reports;
drop trigger if exists barista_reports_auto_approve on public.barista_reports;
drop trigger if exists kitchen_reports_auto_approve on public.kitchen_reports;
create trigger cleaning_reports_auto_approve before insert on public.cleaning_reports for each row execute function private.auto_approve_staff_report();
create trigger barista_reports_auto_approve before insert on public.barista_reports for each row execute function private.auto_approve_staff_report();
create trigger kitchen_reports_auto_approve before insert on public.kitchen_reports for each row execute function private.auto_approve_staff_report();

revoke all on function private.auto_approve_staff_report() from public, anon;
grant execute on function private.auto_approve_staff_report() to authenticated;
