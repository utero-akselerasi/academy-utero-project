insert into storage.buckets (id, name, public)
values ('selection-answers', 'selection-answers', false)
on conflict (id) do update set public = false;

revoke insert, update, delete on table utero_academy.selection_attempts from anon, authenticated;
revoke insert, update, delete on table utero_academy.selection_answers from anon, authenticated;
revoke update (status, started_at, submitted_at, expires_at, device_metadata, updated_at)
  on table utero_academy.selection_attempts from authenticated;
revoke update (selected_option_ids, answer_text, answer_payload, attachment_path, is_final, answered_at, updated_at)
  on table utero_academy.selection_answers from authenticated;

create or replace function utero_academy.enforce_selection_answer_deadline()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  attempt_row utero_academy.selection_attempts%rowtype;
  deadline timestamptz;
begin
  if tg_op = 'UPDATE' and new.attempt_id is not distinct from old.attempt_id
     and new.question_id is not distinct from old.question_id
     and new.selected_option_ids is not distinct from old.selected_option_ids
     and new.answer_text is not distinct from old.answer_text
     and new.answer_payload is not distinct from old.answer_payload
     and new.attachment_path is not distinct from old.attachment_path
     and new.answered_at is not distinct from old.answered_at then
    return new;
  end if;

  select attempt.* into attempt_row
  from utero_academy.selection_attempts attempt
  where attempt.id = new.attempt_id for update;
  if attempt_row.id is null or attempt_row.status::text <> 'in_progress'
     or attempt_row.expires_at is null or clock_timestamp() >= attempt_row.expires_at then
    raise exception 'Waktu pengerjaan habis' using errcode = '42501';
  end if;

  select assignment.due_at into deadline
  from utero_academy.selection_assignments assignment
  where assignment.id = attempt_row.assignment_id;
  if deadline is not null and clock_timestamp() >= deadline then
    raise exception 'Batas penugasan telah lewat' using errcode = '42501';
  end if;
  if not exists (
    select 1 from utero_academy.selection_questions question
    join utero_academy.selection_assignments assignment
      on assignment.package_id = question.package_id
    where question.id = new.question_id and assignment.id = attempt_row.assignment_id
  ) then
    raise exception 'Soal tidak ditemukan pada paket ini' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function utero_academy.enforce_selection_answer_deadline() from public, anon, authenticated;
drop trigger if exists enforce_selection_answer_deadline on utero_academy.selection_answers;
create trigger enforce_selection_answer_deadline
before insert or update on utero_academy.selection_answers
for each row execute function utero_academy.enforce_selection_answer_deadline();
