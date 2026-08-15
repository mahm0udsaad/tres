-- Reports are auto-confirmed on submit so an employee is never blocked waiting
-- for a manager (see 20260810070350). That left the owner with no way to
-- actually judge a report: review_staff_report only accepted 'pending', and no
-- report is ever pending.
--
-- The owner's verdict now overrides the automatic one. A report is reviewable
-- while it is still pending OR still carrying the automatic approval; once a
-- human has ruled on it, it is final. Auto-approval itself is unchanged.

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
  v_auto_approved boolean;
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
    select branch_id, status, auto_approved, submitted_by
      into v_branch_id, v_current_status, v_auto_approved, v_submitted_by
    from public.cleaning_reports where id = p_report_id for update;
  elsif p_report_type = 'barista' then
    select branch_id, status, auto_approved, submitted_by
      into v_branch_id, v_current_status, v_auto_approved, v_submitted_by
    from public.barista_reports where id = p_report_id for update;
  elsif p_report_type = 'kitchen' then
    select branch_id, status, auto_approved, submitted_by
      into v_branch_id, v_current_status, v_auto_approved, v_submitted_by
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
  -- Pending, or auto-approved and therefore never actually judged by a person.
  if not (v_current_status = 'pending' or (v_current_status = 'confirmed' and v_auto_approved)) then
    raise exception 'This report has already been reviewed' using errcode = '23514';
  end if;

  -- auto_approved must drop to false: the review_state constraint only allows a
  -- reviewer to be recorded on a row that is no longer automatically approved.
  if p_report_type = 'cleaning' then
    update public.cleaning_reports set
      status = p_decision, auto_approved = false, reviewed_by = p_user_id,
      review_notes = nullif(trim(p_review_notes), ''), reviewed_at = now()
    where id = p_report_id;
  elsif p_report_type = 'barista' then
    update public.barista_reports set
      status = p_decision, auto_approved = false, reviewed_by = p_user_id,
      review_notes = nullif(trim(p_review_notes), ''), reviewed_at = now()
    where id = p_report_id;
  else
    update public.kitchen_reports set
      status = p_decision, auto_approved = false, reviewed_by = p_user_id,
      review_notes = nullif(trim(p_review_notes), ''), reviewed_at = now()
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

revoke all on function private.review_staff_report_impl(
  uuid, text, uuid, public.report_status, text
) from public, anon;
grant execute on function private.review_staff_report_impl(
  uuid, text, uuid, public.report_status, text
) to authenticated;
