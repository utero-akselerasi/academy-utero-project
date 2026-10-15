grant select, insert, update, delete on
  utero_academy.task_boards,
  utero_academy.task_lists,
  utero_academy.task_cards,
  utero_academy.task_checklists,
  utero_academy.task_subtasks
to authenticated;

grant select, insert on utero_academy.task_attachments to authenticated;

grant select, insert, update on utero_academy.courses to authenticated;
grant select, insert, update, delete on utero_academy.lessons to authenticated;
grant select, insert on utero_academy.course_enrollments to authenticated;
