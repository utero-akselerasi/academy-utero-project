grant select, insert, update on
  utero_academy.assignments,
  utero_academy.assignment_submissions,
  utero_academy.course_announcements,
  utero_academy.announcement_reads,
  utero_academy.learning_sessions
to authenticated;

grant select on
  utero_academy.badges,
  utero_academy.user_badges,
  utero_academy.user_points,
  utero_academy.user_streaks,
  utero_academy.daily_activity,
  utero_academy.mentor_profiles,
  utero_academy.mentor_assignments
to authenticated;

grant execute on function
  utero_academy.update_daily_activity(uuid, character varying, integer, integer),
  utero_academy.update_user_streak(uuid),
  utero_academy.check_and_award_badges(uuid, character varying)
to authenticated;
