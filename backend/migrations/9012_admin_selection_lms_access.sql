grant select on utero_academy.internship_applications to authenticated;

grant select, insert, update, delete on
  utero_academy.selection_tracks,
  utero_academy.selection_materials,
  utero_academy.selection_test_packages,
  utero_academy.selection_questions,
  utero_academy.selection_question_options,
  utero_academy.selection_assignments,
  utero_academy.selection_grades
to authenticated;

grant select, insert, update on
  utero_academy.selection_attempts,
  utero_academy.selection_answers
to authenticated;

grant select on utero_academy.selection_bypasses to authenticated;

grant select, insert, update on
  utero_academy.lesson_progress,
  utero_academy.course_enrollments,
  utero_academy.quiz_attempts
to authenticated;
grant select, insert, delete on utero_academy.lesson_bookmarks to authenticated;
grant select, insert, update, delete on utero_academy.lesson_comments to authenticated;
grant select on utero_academy.quizzes, utero_academy.user_quiz_attempts_summary to authenticated;
grant execute on function utero_academy.can_attempt_quiz(uuid, uuid) to authenticated;

create or replace function utero_academy.assign_selection_test(
  p_application_id uuid,
  p_package_id uuid,
  p_due_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  package_row utero_academy.selection_test_packages%rowtype;
  application_row utero_academy.internship_applications%rowtype;
  assignment_id uuid;
begin
  if auth.uid() is null or not (
    utero_academy.current_user_has_role('admin')
    or utero_academy.current_user_has_role('super_admin')
  ) then
    raise exception 'Akses penugasan seleksi ditolak' using errcode = '42501';
  end if;

  select * into package_row from utero_academy.selection_test_packages
  where id = p_package_id for update;
  select * into application_row from utero_academy.internship_applications
  where id = p_application_id for update;
  if package_row.id is null or not package_row.is_published or application_row.id is null
     or (application_row.selection_track_id is not null and application_row.selection_track_id <> package_row.track_id) then
    raise exception 'Penugasan seleksi tidak diizinkan' using errcode = '23514';
  end if;

  insert into utero_academy.selection_assignments(
    application_id, package_id, max_attempts, status, due_at, assigned_by
  ) values (
    p_application_id, p_package_id, package_row.max_attempts, 'assigned', p_due_at, auth.uid()
  ) returning id into assignment_id;

  update utero_academy.internship_applications
  set selection_status = 'assigned', selection_track_id = package_row.track_id, updated_at = now()
  where id = p_application_id;
  return assignment_id;
end $$;

revoke all on function utero_academy.assign_selection_test(uuid, uuid, timestamptz) from public, anon;
grant execute on function utero_academy.assign_selection_test(uuid, uuid, timestamptz) to authenticated;

create or replace function utero_academy.review_application(
  p_application_id uuid,
  p_status utero_academy.application_status
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare reviewed_id uuid;
begin
  if auth.uid() is null or not (
    utero_academy.current_user_has_role('admin')
    or utero_academy.current_user_has_role('super_admin')
  ) then
    raise exception 'Akses review pendaftaran ditolak' using errcode = '42501';
  end if;
  if p_status::text not in ('reviewed', 'rejected', 'cancelled') then
    raise exception 'Status review tidak valid' using errcode = '23514';
  end if;
  update utero_academy.internship_applications
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = p_application_id returning id into reviewed_id;
  return reviewed_id;
end $$;

revoke all on function utero_academy.review_application(uuid, utero_academy.application_status) from public, anon;
grant execute on function utero_academy.review_application(uuid, utero_academy.application_status) to authenticated;
