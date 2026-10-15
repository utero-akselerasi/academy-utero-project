update utero_academy.roles set is_assignable = false where code in ('mentor', 'admin_academy', 'visitor');
update utero_academy.roles set is_assignable = true where code in ('super_admin', 'admin', 'school', 'intern', 'applicant');

grant usage on schema auth, utero_academy, academy_storage to academy_api;
grant select, insert, update on auth.users, auth.sessions to academy_api;
grant select on utero_academy.user_profiles, utero_academy.roles,
  utero_academy.permissions, utero_academy.role_permissions, utero_academy.user_roles to academy_api;
create policy academy_api_profiles_read on utero_academy.user_profiles for select to academy_api using (true);
create policy academy_api_roles_read on utero_academy.roles for select to academy_api using (true);
create policy academy_api_permissions_read on utero_academy.permissions for select to academy_api using (true);
create policy academy_api_role_permissions_read on utero_academy.role_permissions for select to academy_api using (true);
create policy academy_api_user_roles_read on utero_academy.user_roles for select to academy_api using (true);
grant select, insert, update on academy_storage.objects to academy_api;
grant usage on schema auth, utero_academy to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select, update (encrypted_password, updated_at) on auth.users to authenticated;
grant update (revoked_at) on auth.sessions to authenticated;
