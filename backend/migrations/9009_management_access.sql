grant select on utero_academy.schools to authenticated;
drop policy if exists schools_select on utero_academy.schools;
create policy schools_select on utero_academy.schools for select to authenticated using (
  utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin')
  or exists (select 1 from utero_academy.school_contacts sc where sc.school_id = schools.id and sc.user_id = auth.uid())
);
grant insert, delete on utero_academy.user_roles to authenticated;
grant insert on utero_academy.mentor_profiles, utero_academy.intern_profiles to authenticated;
grant insert, update on utero_academy.school_reports to authenticated;

create policy academy_super_admin_mentor_insert on utero_academy.mentor_profiles
  for insert to authenticated with check (utero_academy.current_user_has_role('super_admin'));
create policy academy_super_admin_intern_insert on utero_academy.intern_profiles
  for insert to authenticated with check (utero_academy.current_user_has_role('super_admin'));

create policy academy_school_reports_write on utero_academy.school_reports
  for all to authenticated
  using (exists (select 1 from utero_academy.school_contacts sc where sc.school_id = school_reports.school_id and sc.user_id = auth.uid()))
  with check (exists (select 1 from utero_academy.school_contacts sc where sc.school_id = school_reports.school_id and sc.user_id = auth.uid()));

create or replace function utero_academy.append_audit_log(
  p_action text, p_resource_type text, p_resource_id uuid,
  p_previous_value jsonb, p_next_value jsonb, p_metadata jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare audit_id uuid;
begin
  if auth.uid() is null or not (
    utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin')
  ) then raise exception 'Akses audit ditolak'; end if;
  insert into utero_academy.audit_logs(actor_id, action, resource_type, resource_id, previous_value, next_value, metadata)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_previous_value, p_next_value, coalesce(p_metadata, '{}'::jsonb))
  returning id into audit_id;
  return audit_id;
end $$;
revoke all on function utero_academy.append_audit_log(text,text,uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function utero_academy.append_audit_log(text,text,uuid,jsonb,jsonb,jsonb) to authenticated;
