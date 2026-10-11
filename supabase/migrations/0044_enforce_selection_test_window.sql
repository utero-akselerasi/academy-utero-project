create or replace function utero_academy.enforce_selection_answer_deadline()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  attempt_row utero_academy.selection_attempts%rowtype;
  assignment_deadline timestamptz;
  test_available_from timestamptz;
  test_available_until timestamptz;
  checked_at timestamptz;
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
  checked_at := clock_timestamp();
  if attempt_row.id is null or attempt_row.status::text <> 'in_progress'
     or attempt_row.expires_at is null or checked_at >= attempt_row.expires_at then
    raise exception 'Waktu pengerjaan habis' using errcode = '42501';
  end if;

  select assignment.due_at, package.available_from, package.available_until
  into assignment_deadline, test_available_from, test_available_until
  from utero_academy.selection_assignments assignment
  join utero_academy.selection_test_packages package on package.id = assignment.package_id
  where assignment.id = attempt_row.assignment_id
  for share of assignment, package;
  if not found then
    raise exception 'Paket tes tidak ditemukan' using errcode = '42501';
  end if;
  checked_at := clock_timestamp();
  if assignment_deadline is not null and checked_at >= assignment_deadline then
    raise exception 'Batas penugasan telah lewat' using errcode = '42501';
  end if;
  if test_available_from is not null and checked_at < test_available_from then
    raise exception 'Tes belum dibuka' using errcode = '42501';
  end if;
  if test_available_until is not null and checked_at >= test_available_until then
    raise exception 'Tes sudah ditutup' using errcode = '42501';
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
