do $$
declare
  schema_owner name;
  target record;
begin
  select pg_get_userbyid(n.nspowner) into schema_owner
  from pg_namespace n where n.nspname = 'utero_academy';

  if schema_owner is null
     or not exists (select 1 from pg_roles where rolname = 'service_role' and rolbypassrls)
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception '0050 schema atau role wajib tidak cocok';
  end if;

  if not exists (select 1 from pg_roles where rolname = current_user and rolsuper)
     and not pg_has_role(current_user, schema_owner, 'USAGE') then
    raise exception '0050 runner tidak memiliki kewenangan owner schema %', schema_owner;
  end if;

  for target in select * from (values
      ('announcement_reads', 'r'),
      ('application_notifications', 'r'),
      ('articles', 'r'),
      ('assessments', 'r'),
      ('assignment_submissions', 'r'),
      ('assignments', 'r'),
      ('attendance_settings', 'r'),
      ('attendances', 'r'),
      ('audit_logs', 'r'),
      ('badges', 'r'),
      ('certificates', 'r'),
      ('cms_sites', 'r'),
      ('course_announcements', 'r'),
      ('course_enrollments', 'r'),
      ('courses', 'r'),
      ('daily_activity', 'r'),
      ('daily_report_attachments', 'r'),
      ('daily_report_reviews', 'r'),
      ('daily_reports', 'r'),
      ('faqs', 'r'),
      ('galleries', 'r'),
      ('intern_profiles', 'r'),
      ('internship_applications', 'r'),
      ('landing_page_settings', 'r'),
      ('learning_sessions', 'r'),
      ('lesson_bookmarks', 'r'),
      ('lesson_comments', 'r'),
      ('lesson_progress', 'r'),
      ('lessons', 'r'),
      ('mentor_assignments', 'r'),
      ('mentor_profiles', 'r'),
      ('permits', 'r'),
      ('programs', 'r'),
      ('quiz_attempts', 'r'),
      ('quizzes', 'r'),
      ('roles', 'r'),
      ('school_contacts', 'r'),
      ('school_reports', 'r'),
      ('schools', 'r'),
      ('selection_answers', 'r'),
      ('selection_assignments', 'r'),
      ('selection_attempts', 'r'),
      ('selection_bypasses', 'r'),
      ('selection_grades', 'r'),
      ('selection_materials', 'r'),
      ('selection_question_options', 'r'),
      ('selection_questions', 'r'),
      ('selection_test_packages', 'r'),
      ('selection_tracks', 'r'),
      ('task_attachments', 'r'),
      ('task_boards', 'r'),
      ('task_cards', 'r'),
      ('task_checklists', 'r'),
      ('task_lists', 'r'),
      ('task_subtasks', 'r'),
      ('testimonials', 'r'),
      ('user_badges', 'r'),
      ('user_points', 'r'),
      ('user_profiles', 'r'),
      ('user_quiz_attempts_summary', 'v'),
      ('user_roles', 'r'),
      ('user_streaks', 'r')
    ) as allowed(object_name, expected_kind)
  loop
    if not exists (
      select 1 from pg_class c
      where c.oid = to_regclass(format('utero_academy.%I', target.object_name))
        and c.relkind::text = target.expected_kind
        and pg_get_userbyid(c.relowner) = schema_owner
        and (target.expected_kind = 'v' or c.relrowsecurity)
    ) then
      raise exception '0050 objek/owner/RLS tidak cocok: %', target.object_name;
    end if;
  end loop;

  for target in select signature from (values
      ('bypass_selection(uuid,text,uuid,text)'),
      ('can_attempt_quiz(uuid,uuid)'),
      ('decide_selection_atomically(uuid,uuid,utero_academy.selection_decision_result,text)'),
      ('update_daily_activity(uuid,character varying,integer,integer)'),
      ('update_user_streak(uuid)')
    ) as allowed(signature)
  loop
    if not exists (
      select 1 from pg_proc p
      where p.oid = to_regprocedure(format('utero_academy.%s', target.signature))
        and pg_get_userbyid(p.proowner) = schema_owner
    ) then
      raise exception '0050 signature/owner function tidak cocok: %', target.signature;
    end if;
  end loop;
end
$$;

grant usage on schema utero_academy to authenticated, service_role;

grant select, insert, update on table utero_academy.attendances to authenticated;
grant select on table utero_academy.intern_profiles to authenticated;
grant select, insert, delete on table utero_academy.mentor_assignments to authenticated;
grant select, update on table utero_academy.mentor_profiles to authenticated;
grant select on table utero_academy.roles to authenticated;
grant select on table utero_academy.user_profiles to authenticated;
grant select on table utero_academy.user_roles to authenticated;

grant delete, insert, select, update on table
  utero_academy.lesson_comments,
  utero_academy.lessons,
  utero_academy.schools,
  utero_academy.task_cards,
  utero_academy.task_checklists,
  utero_academy.task_subtasks,
  utero_academy.testimonials
to service_role;

grant delete, insert, select on table
  utero_academy.articles,
  utero_academy.faqs,
  utero_academy.galleries,
  utero_academy.lesson_bookmarks,
  utero_academy.school_contacts,
  utero_academy.selection_questions,
  utero_academy.task_boards,
  utero_academy.task_lists,
  utero_academy.user_roles
to service_role;

grant insert, select, update on table
  utero_academy.assessments,
  utero_academy.assignment_submissions,
  utero_academy.assignments,
  utero_academy.attendance_settings,
  utero_academy.attendances,
  utero_academy.course_enrollments,
  utero_academy.courses,
  utero_academy.daily_reports,
  utero_academy.intern_profiles,
  utero_academy.internship_applications,
  utero_academy.landing_page_settings,
  utero_academy.permits,
  utero_academy.quizzes,
  utero_academy.school_reports,
  utero_academy.selection_answers,
  utero_academy.selection_assignments,
  utero_academy.selection_attempts,
  utero_academy.selection_materials,
  utero_academy.selection_test_packages,
  utero_academy.user_profiles
to service_role;

grant insert, select on table
  utero_academy.audit_logs,
  utero_academy.certificates,
  utero_academy.course_announcements,
  utero_academy.daily_report_reviews,
  utero_academy.lesson_progress,
  utero_academy.mentor_profiles,
  utero_academy.quiz_attempts,
  utero_academy.selection_question_options,
  utero_academy.selection_tracks
to service_role;

grant insert, update on table
  utero_academy.announcement_reads,
  utero_academy.selection_grades
to service_role;

grant insert on table
  utero_academy.daily_report_attachments,
  utero_academy.learning_sessions,
  utero_academy.task_attachments
to service_role;

grant select on table
  utero_academy.application_notifications,
  utero_academy.badges,
  utero_academy.cms_sites,
  utero_academy.daily_activity,
  utero_academy.mentor_assignments,
  utero_academy.programs,
  utero_academy.roles,
  utero_academy.selection_bypasses,
  utero_academy.user_badges,
  utero_academy.user_points,
  utero_academy.user_quiz_attempts_summary,
  utero_academy.user_streaks
to service_role;

grant execute on function
  utero_academy.bypass_selection(uuid,text,uuid,text),
  utero_academy.can_attempt_quiz(uuid,uuid),
  utero_academy.decide_selection_atomically(uuid,uuid,utero_academy.selection_decision_result,text),
  utero_academy.update_daily_activity(uuid,character varying,integer,integer),
  utero_academy.update_user_streak(uuid)
to service_role;

do $$
declare
  target record;
begin
  for target in select * from (values
      ('authenticated', 'attendances', 'INSERT'),
      ('authenticated', 'attendances', 'SELECT'),
      ('authenticated', 'attendances', 'UPDATE'),
      ('authenticated', 'intern_profiles', 'SELECT'),
      ('authenticated', 'mentor_assignments', 'DELETE'),
      ('authenticated', 'mentor_assignments', 'INSERT'),
      ('authenticated', 'mentor_assignments', 'SELECT'),
      ('authenticated', 'mentor_profiles', 'SELECT'),
      ('authenticated', 'mentor_profiles', 'UPDATE'),
      ('authenticated', 'roles', 'SELECT'),
      ('authenticated', 'user_profiles', 'SELECT'),
      ('authenticated', 'user_roles', 'SELECT'),
      ('service_role', 'announcement_reads', 'INSERT'),
      ('service_role', 'announcement_reads', 'UPDATE'),
      ('service_role', 'application_notifications', 'SELECT'),
      ('service_role', 'articles', 'DELETE'),
      ('service_role', 'articles', 'INSERT'),
      ('service_role', 'articles', 'SELECT'),
      ('service_role', 'assessments', 'INSERT'),
      ('service_role', 'assessments', 'SELECT'),
      ('service_role', 'assessments', 'UPDATE'),
      ('service_role', 'assignment_submissions', 'INSERT'),
      ('service_role', 'assignment_submissions', 'SELECT'),
      ('service_role', 'assignment_submissions', 'UPDATE'),
      ('service_role', 'assignments', 'INSERT'),
      ('service_role', 'assignments', 'SELECT'),
      ('service_role', 'assignments', 'UPDATE'),
      ('service_role', 'attendance_settings', 'INSERT'),
      ('service_role', 'attendance_settings', 'SELECT'),
      ('service_role', 'attendance_settings', 'UPDATE'),
      ('service_role', 'attendances', 'INSERT'),
      ('service_role', 'attendances', 'SELECT'),
      ('service_role', 'attendances', 'UPDATE'),
      ('service_role', 'audit_logs', 'INSERT'),
      ('service_role', 'audit_logs', 'SELECT'),
      ('service_role', 'badges', 'SELECT'),
      ('service_role', 'certificates', 'INSERT'),
      ('service_role', 'certificates', 'SELECT'),
      ('service_role', 'cms_sites', 'SELECT'),
      ('service_role', 'course_announcements', 'INSERT'),
      ('service_role', 'course_announcements', 'SELECT'),
      ('service_role', 'course_enrollments', 'INSERT'),
      ('service_role', 'course_enrollments', 'SELECT'),
      ('service_role', 'course_enrollments', 'UPDATE'),
      ('service_role', 'courses', 'INSERT'),
      ('service_role', 'courses', 'SELECT'),
      ('service_role', 'courses', 'UPDATE'),
      ('service_role', 'daily_activity', 'SELECT'),
      ('service_role', 'daily_report_attachments', 'INSERT'),
      ('service_role', 'daily_report_reviews', 'INSERT'),
      ('service_role', 'daily_report_reviews', 'SELECT'),
      ('service_role', 'daily_reports', 'INSERT'),
      ('service_role', 'daily_reports', 'SELECT'),
      ('service_role', 'daily_reports', 'UPDATE'),
      ('service_role', 'faqs', 'DELETE'),
      ('service_role', 'faqs', 'INSERT'),
      ('service_role', 'faqs', 'SELECT'),
      ('service_role', 'galleries', 'DELETE'),
      ('service_role', 'galleries', 'INSERT'),
      ('service_role', 'galleries', 'SELECT'),
      ('service_role', 'intern_profiles', 'INSERT'),
      ('service_role', 'intern_profiles', 'SELECT'),
      ('service_role', 'intern_profiles', 'UPDATE'),
      ('service_role', 'internship_applications', 'INSERT'),
      ('service_role', 'internship_applications', 'SELECT'),
      ('service_role', 'internship_applications', 'UPDATE'),
      ('service_role', 'landing_page_settings', 'INSERT'),
      ('service_role', 'landing_page_settings', 'SELECT'),
      ('service_role', 'landing_page_settings', 'UPDATE'),
      ('service_role', 'learning_sessions', 'INSERT'),
      ('service_role', 'lesson_bookmarks', 'DELETE'),
      ('service_role', 'lesson_bookmarks', 'INSERT'),
      ('service_role', 'lesson_bookmarks', 'SELECT'),
      ('service_role', 'lesson_comments', 'DELETE'),
      ('service_role', 'lesson_comments', 'INSERT'),
      ('service_role', 'lesson_comments', 'SELECT'),
      ('service_role', 'lesson_comments', 'UPDATE'),
      ('service_role', 'lesson_progress', 'INSERT'),
      ('service_role', 'lesson_progress', 'SELECT'),
      ('service_role', 'lessons', 'DELETE'),
      ('service_role', 'lessons', 'INSERT'),
      ('service_role', 'lessons', 'SELECT'),
      ('service_role', 'lessons', 'UPDATE'),
      ('service_role', 'mentor_assignments', 'SELECT'),
      ('service_role', 'mentor_profiles', 'INSERT'),
      ('service_role', 'mentor_profiles', 'SELECT'),
      ('service_role', 'permits', 'INSERT'),
      ('service_role', 'permits', 'SELECT'),
      ('service_role', 'permits', 'UPDATE'),
      ('service_role', 'programs', 'SELECT'),
      ('service_role', 'quiz_attempts', 'INSERT'),
      ('service_role', 'quiz_attempts', 'SELECT'),
      ('service_role', 'quizzes', 'INSERT'),
      ('service_role', 'quizzes', 'SELECT'),
      ('service_role', 'quizzes', 'UPDATE'),
      ('service_role', 'roles', 'SELECT'),
      ('service_role', 'school_contacts', 'DELETE'),
      ('service_role', 'school_contacts', 'INSERT'),
      ('service_role', 'school_contacts', 'SELECT'),
      ('service_role', 'school_reports', 'INSERT'),
      ('service_role', 'school_reports', 'SELECT'),
      ('service_role', 'school_reports', 'UPDATE'),
      ('service_role', 'schools', 'DELETE'),
      ('service_role', 'schools', 'INSERT'),
      ('service_role', 'schools', 'SELECT'),
      ('service_role', 'schools', 'UPDATE'),
      ('service_role', 'selection_answers', 'INSERT'),
      ('service_role', 'selection_answers', 'SELECT'),
      ('service_role', 'selection_answers', 'UPDATE'),
      ('service_role', 'selection_assignments', 'INSERT'),
      ('service_role', 'selection_assignments', 'SELECT'),
      ('service_role', 'selection_assignments', 'UPDATE'),
      ('service_role', 'selection_attempts', 'INSERT'),
      ('service_role', 'selection_attempts', 'SELECT'),
      ('service_role', 'selection_attempts', 'UPDATE'),
      ('service_role', 'selection_bypasses', 'SELECT'),
      ('service_role', 'selection_grades', 'INSERT'),
      ('service_role', 'selection_grades', 'UPDATE'),
      ('service_role', 'selection_materials', 'INSERT'),
      ('service_role', 'selection_materials', 'SELECT'),
      ('service_role', 'selection_materials', 'UPDATE'),
      ('service_role', 'selection_question_options', 'INSERT'),
      ('service_role', 'selection_question_options', 'SELECT'),
      ('service_role', 'selection_questions', 'DELETE'),
      ('service_role', 'selection_questions', 'INSERT'),
      ('service_role', 'selection_questions', 'SELECT'),
      ('service_role', 'selection_test_packages', 'INSERT'),
      ('service_role', 'selection_test_packages', 'SELECT'),
      ('service_role', 'selection_test_packages', 'UPDATE'),
      ('service_role', 'selection_tracks', 'INSERT'),
      ('service_role', 'selection_tracks', 'SELECT'),
      ('service_role', 'task_attachments', 'INSERT'),
      ('service_role', 'task_boards', 'DELETE'),
      ('service_role', 'task_boards', 'INSERT'),
      ('service_role', 'task_boards', 'SELECT'),
      ('service_role', 'task_cards', 'DELETE'),
      ('service_role', 'task_cards', 'INSERT'),
      ('service_role', 'task_cards', 'SELECT'),
      ('service_role', 'task_cards', 'UPDATE'),
      ('service_role', 'task_checklists', 'DELETE'),
      ('service_role', 'task_checklists', 'INSERT'),
      ('service_role', 'task_checklists', 'SELECT'),
      ('service_role', 'task_checklists', 'UPDATE'),
      ('service_role', 'task_lists', 'DELETE'),
      ('service_role', 'task_lists', 'INSERT'),
      ('service_role', 'task_lists', 'SELECT'),
      ('service_role', 'task_subtasks', 'DELETE'),
      ('service_role', 'task_subtasks', 'INSERT'),
      ('service_role', 'task_subtasks', 'SELECT'),
      ('service_role', 'task_subtasks', 'UPDATE'),
      ('service_role', 'testimonials', 'DELETE'),
      ('service_role', 'testimonials', 'INSERT'),
      ('service_role', 'testimonials', 'SELECT'),
      ('service_role', 'testimonials', 'UPDATE'),
      ('service_role', 'user_badges', 'SELECT'),
      ('service_role', 'user_points', 'SELECT'),
      ('service_role', 'user_profiles', 'INSERT'),
      ('service_role', 'user_profiles', 'SELECT'),
      ('service_role', 'user_profiles', 'UPDATE'),
      ('service_role', 'user_quiz_attempts_summary', 'SELECT'),
      ('service_role', 'user_roles', 'DELETE'),
      ('service_role', 'user_roles', 'INSERT'),
      ('service_role', 'user_roles', 'SELECT'),
      ('service_role', 'user_streaks', 'SELECT')
    ) as allowed(role_name, object_name, privilege_name)
  loop
    if not has_table_privilege(target.role_name,
      format('utero_academy.%I', target.object_name), target.privilege_name) then
      raise exception '0050 grant belum efektif: %.% %',
        target.role_name, target.object_name, target.privilege_name;
    end if;
  end loop;

  if not has_schema_privilege('authenticated','utero_academy','USAGE')
     or not has_schema_privilege('service_role','utero_academy','USAGE') then
    raise exception '0050 schema USAGE belum efektif';
  end if;

  for target in select signature from (values
      ('bypass_selection(uuid,text,uuid,text)'),
      ('can_attempt_quiz(uuid,uuid)'),
      ('decide_selection_atomically(uuid,uuid,utero_academy.selection_decision_result,text)'),
      ('update_daily_activity(uuid,character varying,integer,integer)'),
      ('update_user_streak(uuid)')
    ) as allowed(signature)
  loop
    if not has_function_privilege('service_role',
      format('utero_academy.%s', target.signature), 'EXECUTE') then
      raise exception '0050 function EXECUTE belum efektif: %', target.signature;
    end if;
  end loop;
end
$$;
