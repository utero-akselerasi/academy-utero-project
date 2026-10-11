create or replace function utero_academy.approve_application_onboarding(p_application_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  application_row utero_academy.internship_applications%rowtype;
  intern_row utero_academy.intern_profiles%rowtype;
  account_full_name text;
  previous_onboarding_status text;
begin
  if auth.uid() is null or not (
    utero_academy.current_user_has_role('admin')
    or utero_academy.current_user_has_role('super_admin')
  ) then
    raise exception 'Hanya admin yang dapat menyetujui onboarding' using errcode = '42501';
  end if;

  select * into application_row
  from utero_academy.internship_applications
  where id = p_application_id
  for update;

  if application_row.id is null then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if application_row.status::text <> 'accepted' then raise exception 'Pendaftaran belum diterima'; end if;
  if application_row.onboarding_status::text not in (
    'accepted_pending_onboarding', 'biodata_review', 'onboarding_complete'
  ) then
    raise exception 'Status onboarding tidak dapat disetujui';
  end if;
  if application_row.converted_intern_id is null or application_row.applicant_user_id is null then
    raise exception 'Profil peserta hasil konversi belum tersedia';
  end if;
  if application_row.approved_start_date is null or application_row.approved_end_date is null then
    raise exception 'Tanggal magang resmi belum lengkap';
  end if;

  select * into intern_row
  from utero_academy.intern_profiles
  where id = application_row.converted_intern_id
    and user_id = application_row.applicant_user_id
  for update;

  if intern_row.id is null then raise exception 'Profil peserta tidak cocok dengan pendaftaran'; end if;
  if intern_row.start_date is distinct from application_row.approved_start_date
     or intern_row.end_date is distinct from application_row.approved_end_date then
    raise exception 'Tanggal profil peserta tidak cocok dengan tanggal resmi';
  end if;

  select full_name into account_full_name
  from utero_academy.user_profiles
  where id = application_row.applicant_user_id;

  if nullif(btrim(coalesce(account_full_name, '')), '') is null
     or nullif(btrim(coalesce(intern_row.email, '')), '') is null
     or nullif(btrim(coalesce(intern_row.phone, '')), '') is null
     or nullif(btrim(coalesce(intern_row.major, '')), '') is null
     or nullif(btrim(coalesce(intern_row.grade_or_semester, '')), '') is null
     or nullif(btrim(coalesce(intern_row.school_name, '')), '') is null
     or nullif(btrim(coalesce(intern_row.address, '')), '') is null
     or nullif(btrim(coalesce(intern_row.school_supervisor_name, '')), '') is null
     or nullif(btrim(coalesce(intern_row.school_supervisor_phone, '')), '') is null then
    raise exception 'Biodata peserta belum lengkap';
  end if;
  if (nullif(btrim(coalesce(intern_row.emergency_contact_name, '')), '') is null)
     <> (nullif(btrim(coalesce(intern_row.emergency_contact_phone, '')), '') is null) then
    raise exception 'Kontak darurat peserta belum lengkap';
  end if;

  previous_onboarding_status := application_row.onboarding_status::text;
  update utero_academy.internship_applications
  set onboarding_status = 'waiting_start', reviewed_by = auth.uid(),
      reviewed_at = now(), updated_at = now()
  where id = application_row.id;

  insert into utero_academy.audit_logs(
    actor_id, action, resource_type, resource_id, previous_value, next_value, metadata
  ) values (
    auth.uid(), 'approve_application_onboarding', 'internship_applications', application_row.id,
    jsonb_build_object('onboarding_status', previous_onboarding_status),
    jsonb_build_object('onboarding_status', 'waiting_start'),
    jsonb_build_object(
      'converted_intern_id', intern_row.id,
      'approved_start_date', application_row.approved_start_date,
      'approved_end_date', application_row.approved_end_date
    )
  );

  return intern_row.id;
end $$;

revoke all on function utero_academy.approve_application_onboarding(uuid)
  from public, anon, authenticated;
grant execute on function utero_academy.approve_application_onboarding(uuid)
  to authenticated;
