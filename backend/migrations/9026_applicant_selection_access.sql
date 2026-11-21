create policy selection_packages_applicant_select on utero_academy.selection_test_packages
  for select to authenticated using (
    is_published and exists (
      select 1 from utero_academy.selection_assignments assignment
      join utero_academy.internship_applications application on application.id = assignment.application_id
      where assignment.package_id = selection_test_packages.id
        and application.applicant_user_id = (select auth.uid())
    )
  );

create policy selection_materials_applicant_select on utero_academy.selection_materials
  for select to authenticated using (
    is_published and exists (
      select 1 from utero_academy.internship_applications application
      where application.selection_track_id = selection_materials.track_id
        and application.applicant_user_id = (select auth.uid())
    )
  );

create policy selection_questions_applicant_select on utero_academy.selection_questions
  for select to authenticated using (
    exists (
      select 1 from utero_academy.selection_test_packages package
      join utero_academy.selection_assignments assignment on assignment.package_id = package.id
      join utero_academy.internship_applications application on application.id = assignment.application_id
      where package.id = selection_questions.package_id and package.is_published
        and application.applicant_user_id = (select auth.uid())
    )
  );

create policy selection_options_applicant_select on utero_academy.selection_question_options
  for select to authenticated using (
    exists (
      select 1 from utero_academy.selection_questions question
      join utero_academy.selection_test_packages package on package.id = question.package_id
      join utero_academy.selection_assignments assignment on assignment.package_id = package.id
      join utero_academy.internship_applications application on application.id = assignment.application_id
      where question.id = selection_question_options.question_id and package.is_published
        and application.applicant_user_id = (select auth.uid())
    )
  );

create function utero_academy.advance_applicant_selection(p_assignment_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_status not in ('in_progress', 'grading') or not exists (
    select 1 from utero_academy.selection_assignments assignment
    join utero_academy.internship_applications application on application.id = assignment.application_id
    join utero_academy.selection_attempts attempt on attempt.assignment_id = assignment.id
    where assignment.id = p_assignment_id and application.applicant_user_id = auth.uid()
      and attempt.applicant_user_id = auth.uid()
      and ((p_status = 'in_progress' and assignment.status = 'assigned' and attempt.status = 'in_progress')
        or (p_status = 'grading' and assignment.status = 'in_progress' and attempt.status in ('grading', 'graded')))
  ) then
    raise exception 'Transisi seleksi tidak diizinkan' using errcode = '42501';
  end if;

  update utero_academy.selection_assignments
  set status = p_status::utero_academy.selection_status, updated_at = now()
  where id = p_assignment_id;
end $$;
revoke all on function utero_academy.advance_applicant_selection(uuid, text) from public, anon;
grant execute on function utero_academy.advance_applicant_selection(uuid, text) to authenticated;
