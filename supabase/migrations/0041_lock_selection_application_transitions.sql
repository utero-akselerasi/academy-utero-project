revoke insert on table utero_academy.internship_applications from anon, authenticated;
revoke update on table utero_academy.internship_applications from anon, authenticated;

grant update (status, reviewed_by, reviewed_at, updated_at)
  on table utero_academy.internship_applications to authenticated;

create or replace function utero_academy.enforce_application_selection_transition()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role') then return new; end if;

  if tg_op = 'INSERT' and (
    new.selection_status::text <> 'not_assigned'
    or new.onboarding_status::text <> 'not_started'
    or new.selection_track_id is not null
    or new.converted_intern_id is not null
    or new.decided_at is not null
    or new.converted_at is not null
  ) then
    raise exception 'Status seleksi awal tidak valid' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.selection_status is distinct from old.selection_status then
    raise exception 'Status seleksi hanya dapat diubah melalui workflow tepercaya' using errcode = '42501';
  end if;

  return new;
end $$;

revoke all on function utero_academy.enforce_application_selection_transition()
  from public, anon, authenticated;
drop trigger if exists enforce_application_selection_transition
  on utero_academy.internship_applications;
create trigger enforce_application_selection_transition
before insert or update on utero_academy.internship_applications
for each row execute function utero_academy.enforce_application_selection_transition();

create or replace function utero_academy.visible_selection_results(p_application_id uuid)
returns table (decision_id uuid, result utero_academy.selection_decision_result,
  final_score numeric, public_note text, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from utero_academy.internship_applications application
    where application.id = p_application_id and (
      application.applicant_user_id = auth.uid()
      or exists (
        select 1 from utero_academy.school_contacts contact
        join utero_academy.schools school on school.id = contact.school_id
        where contact.school_id = application.school_id
          and contact.user_id = auth.uid()
          and school.partner_status in ('verified', 'active_partner')
      )
      or utero_academy.current_user_has_role('admin')
      or utero_academy.current_user_has_role('super_admin')
    )
  ) then
    raise exception 'Akses hasil seleksi ditolak' using errcode = '42501';
  end if;

  return query select decision.id, decision.result, decision.final_score,
    decision.public_note, decision.decided_at
  from utero_academy.selection_decisions decision
  where decision.application_id = p_application_id
  order by decision.decided_at desc;
end $$;

revoke all on function utero_academy.visible_selection_results(uuid)
  from public, anon, authenticated;
grant execute on function utero_academy.visible_selection_results(uuid)
  to authenticated;
