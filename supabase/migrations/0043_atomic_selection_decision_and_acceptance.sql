create or replace function utero_academy.decide_selection_atomically(
  p_assignment_id uuid, p_application_id uuid,
  p_result utero_academy.selection_decision_result, p_public_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare application_row utero_academy.internship_applications%rowtype;
declare assignment_row utero_academy.selection_assignments%rowtype;
declare attempt_row utero_academy.selection_attempts%rowtype;
declare decision_id uuid;
begin
  if auth.uid() is null or not (utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin')) then
    raise exception 'Hanya admin yang dapat memutuskan seleksi' using errcode = '42501';
  end if;
  if p_result not in ('passed', 'failed', 'waitlisted') then
    raise exception 'Keputusan seleksi tidak valid';
  end if;
  if length(coalesce(p_public_note, '')) > 3000 then raise exception 'Catatan terlalu panjang'; end if;

  select * into application_row from utero_academy.internship_applications
  where id = p_application_id for update;
  if application_row.id is null then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if application_row.status::text in ('accepted', 'converted', 'rejected', 'cancelled') then
    raise exception 'Pendaftaran sudah ditutup';
  end if;
  select * into assignment_row from utero_academy.selection_assignments
  where id = p_assignment_id and application_id = p_application_id for update;
  if assignment_row.id is null then raise exception 'Penugasan tidak cocok dengan pelamar'; end if;
  select * into attempt_row from utero_academy.selection_attempts
  where assignment_id = p_assignment_id order by attempt_number desc limit 1 for update;
  if attempt_row.id is null or attempt_row.status <> 'graded' or attempt_row.final_score is null then
    raise exception 'Nilai akhir belum lengkap';
  end if;

  select id into decision_id from utero_academy.selection_decisions
  where attempt_id = attempt_row.id and application_id = p_application_id
  order by decided_at desc limit 1 for update;
  if decision_id is null then
    insert into utero_academy.selection_decisions
      (attempt_id, application_id, result, final_score, public_note, decided_by)
    values (attempt_row.id, p_application_id, p_result, attempt_row.final_score,
      nullif(btrim(p_public_note), ''), auth.uid()) returning id into decision_id;
  else
    update utero_academy.selection_decisions set result = p_result,
      final_score = attempt_row.final_score, public_note = nullif(btrim(p_public_note), ''),
      decided_by = auth.uid(), decided_at = now()
    where id = decision_id;
  end if;
  update utero_academy.selection_assignments set status = p_result::text::utero_academy.selection_status,
    updated_at = now() where id = p_assignment_id;
  update utero_academy.internship_applications set selection_status = p_result::text::utero_academy.selection_status,
    decided_at = now(), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_application_id;
  insert into utero_academy.audit_logs(actor_id, action, resource_type, resource_id, next_value)
  values (auth.uid(), 'decide_selection', 'selection_decisions', decision_id,
    jsonb_build_object('assignmentId', p_assignment_id, 'applicationId', p_application_id,
      'decision', p_result, 'notes', p_public_note));
  return decision_id;
end $$;
revoke all on function utero_academy.decide_selection_atomically(uuid,uuid,utero_academy.selection_decision_result,text) from public, anon, authenticated;
grant execute on function utero_academy.decide_selection_atomically(uuid,uuid,utero_academy.selection_decision_result,text) to authenticated;

create or replace function utero_academy.accept_application_as_intern(
  p_application_id uuid, p_start_date date, p_end_date date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare application_row utero_academy.internship_applications%rowtype;
declare intern_role_id uuid;
declare intern_id uuid;
begin
  if auth.uid() is null or not (utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin')) then
    raise exception 'Hanya admin yang dapat menerima peserta' using errcode = '42501';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Tanggal selesai tidak valid';
  end if;
  select * into application_row from utero_academy.internship_applications where id = p_application_id;
  if application_row.id is null then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if application_row.applicant_user_id is null then raise exception 'Akun pelamar belum terhubung'; end if;

  perform 1 from auth.users where id = application_row.applicant_user_id for update;
  select * into application_row from utero_academy.internship_applications where id = p_application_id for update;
  if application_row.applicant_user_id is null then raise exception 'Akun pelamar belum terhubung'; end if;
  if application_row.status::text in ('accepted', 'converted') and application_row.converted_intern_id is not null then
    return application_row.converted_intern_id;
  end if;
  if application_row.status::text in ('accepted', 'converted', 'rejected', 'cancelled') then
    raise exception 'Pendaftaran sudah ditutup';
  end if;
  if application_row.selection_status::text not in ('passed', 'bypassed') then
    raise exception 'Peserta belum dinyatakan lolos seleksi';
  end if;
  if exists (
    select 1 from utero_academy.internship_applications other_application
    where other_application.applicant_user_id = application_row.applicant_user_id
      and other_application.id <> p_application_id
      and (other_application.status::text in ('accepted', 'converted') or other_application.converted_intern_id is not null)
  ) or exists (
    select 1 from utero_academy.intern_profiles profile
    where profile.user_id = application_row.applicant_user_id
      and profile.status::text in ('pending', 'active', 'paused')
      and not exists (
        select 1 from utero_academy.internship_applications linked
        where linked.id = p_application_id and linked.converted_intern_id = profile.id
      )
  ) then
    raise exception 'Pengguna sudah memiliki penempatan magang aktif';
  end if;
  select id into intern_role_id from utero_academy.roles where code = 'intern';
  if intern_role_id is null then raise exception 'Role intern belum tersedia'; end if;
  insert into utero_academy.user_roles(user_id, role_id)
  select application_row.applicant_user_id, intern_role_id
  where not exists (select 1 from utero_academy.user_roles
    where user_id = application_row.applicant_user_id and role_id = intern_role_id
      and scope_type is null and scope_id is null);
  insert into utero_academy.intern_profiles(user_id, school_id, full_name, email, phone, major, status, start_date, end_date, school_name)
  values (application_row.applicant_user_id, application_row.school_id, application_row.full_name,
    application_row.email, application_row.phone, application_row.major, 'pending', p_start_date, p_end_date, application_row.school_name)
  on conflict (user_id) do update set school_id = excluded.school_id, full_name = excluded.full_name,
    email = excluded.email, phone = excluded.phone, major = excluded.major,
    start_date = excluded.start_date, end_date = excluded.end_date, updated_at = now()
  returning id into intern_id;
  update utero_academy.internship_applications set status = 'accepted', onboarding_status = 'accepted_pending_onboarding',
    approved_start_date = p_start_date, approved_end_date = p_end_date, converted_intern_id = intern_id,
    reviewed_by = auth.uid(), reviewed_at = now(), decided_at = now(), converted_at = now(), updated_at = now()
  where id = p_application_id;
  insert into utero_academy.application_notifications(application_id, recipient_user_id, channel, template_code, subject, payload, status)
  values (p_application_id, application_row.applicant_user_id, 'in_app', 'application_accepted', 'Pendaftaran diterima',
    jsonb_build_object('message', 'Lengkapi dan cocokkan biodata. Fitur magang aktif pada tanggal mulai resmi.'), 'pending');
  return intern_id;
end $$;
revoke all on function utero_academy.accept_application_as_intern(uuid,date,date) from public, anon, authenticated;
grant execute on function utero_academy.accept_application_as_intern(uuid,date,date) to authenticated;
