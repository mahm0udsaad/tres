-- Nationality-driven employee language.
--
-- TRES currently operates employee screens in Arabic, Bengali, and English.
-- The language is derived from nationality rather than being a free-form
-- preference: Arabic-speaking countries use Arabic, Bangladesh uses Bengali,
-- and the remaining supported nationalities use English.

alter table public.staff_profiles drop constraint if exists staff_profiles_language_check;
alter table public.staff_profiles add constraint staff_profiles_language_check
  check (preferred_language in ('ar', 'bn', 'en'));

update public.staff_profiles
set preferred_language = case
  when nationality in ('Saudi Arabia', 'Egypt', 'Yemen', 'Sudan', 'Jordan') then 'ar'
  when nationality = 'Bangladesh' then 'bn'
  else 'en'
end;

alter table public.staff_profiles drop constraint if exists staff_profiles_nationality_language_check;
alter table public.staff_profiles add constraint staff_profiles_nationality_language_check
  check (
    preferred_language = case
      when nationality in ('Saudi Arabia', 'Egypt', 'Yemen', 'Sudan', 'Jordan') then 'ar'
      when nationality = 'Bangladesh' then 'bn'
      else 'en'
    end
  );

-- Seed built-in shift requirements in the employee's own language. Branch
-- checklist titles remain supervisor-authored content and are stored verbatim.
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
begin
  if p_role = 'cleaning_staff' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, p_shift_date, 'cleaning_report', case p_lang
        when 'ar' then 'إرسال تقرير النظافة اليومي'
        when 'bn' then 'দৈনিক পরিচ্ছন্নতার রিপোর্ট জমা দিন'
        else 'Submit the daily cleaning report' end),
      (p_user_id, p_shift_date, 'cleaning_photos', case p_lang
        when 'ar' then 'رفع صور إثبات النظافة'
        when 'bn' then 'পরিচ্ছন্নতার প্রমাণের ছবি আপলোড করুন'
        else 'Upload cleaning proof photos' end)
    on conflict do nothing;
  elsif p_role = 'barista' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, p_shift_date, 'barista_report', case p_lang
        when 'ar' then 'إرسال تقرير البار اليومي'
        when 'bn' then 'দৈনিক বার রিপোর্ট জমা দিন'
        else 'Submit the daily barista report' end),
      (p_user_id, p_shift_date, 'bar_clean_confirmation', case p_lang
        when 'ar' then 'تأكيد نظافة البار'
        when 'bn' then 'বার পরিষ্কার আছে নিশ্চিত করুন'
        else 'Confirm the bar is clean' end)
    on conflict do nothing;
  elsif p_role = 'kitchen_manager' then
    insert into public.tasks (user_id, task_date, task_type, title)
    values
      (p_user_id, p_shift_date, 'kitchen_report', case p_lang
        when 'ar' then 'إرسال تقرير المطبخ'
        when 'bn' then 'রান্নাঘরের রিপোর্ট জমা দিন'
        else 'Submit the kitchen report' end),
      (p_user_id, p_shift_date, 'kitchen_photos', case p_lang
        when 'ar' then 'رفع صور نظافة المطبخ'
        when 'bn' then 'রান্নাঘরের অবস্থার ছবি আপলোড করুন'
        else 'Upload kitchen condition photos' end),
      (p_user_id, p_shift_date, 'inventory_count', case p_lang
        when 'ar' then 'جرد المنتجات والحلويات'
        when 'bn' then 'পণ্য ও মিষ্টান্নের মজুত গণনা সম্পন্ন করুন'
        else 'Complete product and dessert inventory' end)
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

-- Preserve the public RPC signature for deployed clients, but derive the
-- language inside Postgres so a forged/stale form cannot override nationality.
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

  v_lang := case
    when v_nationality in ('Saudi Arabia', 'Egypt', 'Yemen', 'Sudan', 'Jordan') then 'ar'
    when v_nationality = 'Bangladesh' then 'bn'
    else 'en'
  end;

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

  return jsonb_build_object(
    'ok', true,
    'user_id', p_new_user_id,
    'branch_id', v_profile.branch_id,
    'role', p_role,
    'preferred_language', v_lang
  );
end;
$$;

comment on column public.staff_profiles.preferred_language is
  'Employee dashboard language derived from nationality: ar, bn, or en. Management surfaces remain Arabic.';
