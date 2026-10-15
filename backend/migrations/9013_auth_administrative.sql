create table if not exists auth.account_invitation_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists account_invitation_tokens_user_idx on auth.account_invitation_tokens(user_id);
grant select, insert, update, delete on auth.account_invitation_tokens to academy_api;
grant select, insert on utero_academy.user_profiles, utero_academy.user_roles to academy_api;
grant select, update on utero_academy.school_contacts to academy_api;
grant update (identity_data, updated_at) on auth.identities to academy_api;

drop policy if exists academy_api_profiles_invite on utero_academy.user_profiles;
create policy academy_api_profiles_invite on utero_academy.user_profiles
  for insert to academy_api with check (true);
drop policy if exists academy_api_roles_invite on utero_academy.user_roles;
create policy academy_api_roles_invite on utero_academy.user_roles
  for insert to academy_api with check (scope_type is null and scope_id is null);
drop policy if exists academy_api_contacts_invite_select on utero_academy.school_contacts;
create policy academy_api_contacts_invite_select on utero_academy.school_contacts
  for select to academy_api using (true);
drop policy if exists academy_api_contacts_invite_update on utero_academy.school_contacts;
create policy academy_api_contacts_invite_update on utero_academy.school_contacts
  for update to academy_api using (true) with check (true);
create or replace function utero_academy.link_invited_applicant(p_application uuid, p_user uuid, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if session_user <> 'academy_api' or not exists (
    select 1 from auth.users where id = p_user and deleted_at is null and lower(email) = p_email
  ) then return false; end if;
  update utero_academy.internship_applications
  set applicant_user_id = p_user
  where id = p_application and source = 'school' and lower(email) = p_email
    and (applicant_user_id is null or applicant_user_id = p_user);
  return found;
end $$;
revoke all on function utero_academy.link_invited_applicant(uuid,uuid,text) from public, anon, authenticated;
grant execute on function utero_academy.link_invited_applicant(uuid,uuid,text) to academy_api;

create or replace function utero_academy.activate_current_intern()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  participant utero_academy.intern_profiles%rowtype;
  application utero_academy.internship_applications%rowtype;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if auth.uid() is null or not utero_academy.current_user_has_role('intern') then
    raise exception 'Intern tidak aktif' using errcode = '42501';
  end if;
  select * into participant from utero_academy.intern_profiles where user_id = auth.uid() for update;
  if not found or participant.email is null or participant.full_name is null
    or nullif(btrim(participant.phone), '') is null or nullif(btrim(participant.major), '') is null
    or nullif(btrim(participant.grade_or_semester), '') is null
    or nullif(btrim(participant.school_name), '') is null
    or nullif(btrim(participant.address), '') is null
    or nullif(btrim(participant.school_supervisor_name), '') is null
    or nullif(btrim(participant.school_supervisor_phone), '') is null
    or not exists (select 1 from utero_academy.user_profiles where id = auth.uid() and nullif(btrim(full_name), '') is not null)
    or participant.status::text not in ('pending', 'active') or participant.start_date is null
    or participant.start_date > today or (participant.end_date is not null and participant.end_date < today)
  then raise exception 'Intern tidak aktif' using errcode = '42501'; end if;
  select * into application from utero_academy.internship_applications
    where applicant_user_id = auth.uid() and converted_intern_id is not null
    order by converted_at desc limit 1 for update;
  if not found or application.status::text <> 'accepted'
    or application.converted_intern_id <> participant.id
    or application.onboarding_status::text not in ('waiting_start', 'active')
    or application.approved_start_date is null
    or application.approved_start_date <> participant.start_date
    or application.approved_end_date is distinct from participant.end_date
  then raise exception 'Daftar ulang belum disetujui' using errcode = '42501'; end if;
  if application.onboarding_status::text = 'waiting_start' then
    update utero_academy.internship_applications set onboarding_status = 'active' where id = application.id;
  end if;
  if participant.status::text = 'pending' then
    update utero_academy.intern_profiles set status = 'active' where id = participant.id;
  end if;
  return participant.id;
end $$;
revoke all on function utero_academy.activate_current_intern() from public, anon, academy_api;
grant execute on function utero_academy.activate_current_intern() to authenticated;
