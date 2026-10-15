create or replace function utero_academy.can_read_shared_attachment(p_bucket text, p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not utero_academy.current_user_has_role('intern')
    or p_bucket not in ('learning', 'task') or p_path is null
  then return false; end if;

  if p_bucket = 'learning' then
    return exists (
      select 1 from academy_storage.objects objects
      join utero_academy.lessons lessons
        on lessons.attachments @> jsonb_build_array(jsonb_build_object('path', p_path))
      join utero_academy.courses courses
        on courses.id = lessons.course_id and courses.status = 'published'
      join utero_academy.intern_profiles interns
        on interns.user_id = auth.uid() and interns.status = 'active'
      join utero_academy.course_enrollments enrollments
        on enrollments.intern_id = interns.id and enrollments.course_id = courses.id
      where objects.bucket_id = p_bucket and objects.name = p_path
        and objects.deleted_at is null and lessons.is_published is not false
    );
  end if;

  return exists (
    select 1 from academy_storage.objects objects
    join utero_academy.task_attachments attachments on attachments.file_path = objects.name
    join utero_academy.task_cards cards on cards.id = attachments.card_id
    join utero_academy.intern_profiles interns
      on interns.id = cards.intern_id and interns.user_id = auth.uid()
    where objects.bucket_id = p_bucket and objects.name = p_path and objects.deleted_at is null
  );
end
$$;

revoke all on function utero_academy.can_read_shared_attachment(text,text) from public, anon, academy_api;
grant execute on function utero_academy.can_read_shared_attachment(text,text) to authenticated;
