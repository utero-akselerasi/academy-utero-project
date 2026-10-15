create or replace function utero_academy.has_converted_application()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from utero_academy.internship_applications
    where applicant_user_id = auth.uid() and converted_intern_id is not null
  );
$$;

revoke all on function utero_academy.has_converted_application() from public, anon;
grant execute on function utero_academy.has_converted_application() to authenticated;
