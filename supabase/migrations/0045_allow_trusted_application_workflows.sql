create or replace function utero_academy.enforce_application_selection_transition()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

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
