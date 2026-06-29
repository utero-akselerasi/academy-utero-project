grant select, insert, update on table utero_academy.user_profiles to authenticated;
grant select on table utero_academy.roles to authenticated;
grant select on table utero_academy.permissions to authenticated;
grant select on table utero_academy.role_permissions to authenticated;
grant select, insert, delete on table utero_academy.user_roles to authenticated;

drop policy if exists "user dapat membaca profil sendiri" on utero_academy.user_profiles;
create policy "user dapat membaca profil sendiri"
on utero_academy.user_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "super admin dapat membaca semua profil" on utero_academy.user_profiles;
create policy "super admin dapat membaca semua profil"
on utero_academy.user_profiles
for select
to authenticated
using (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "super admin dapat membuat profil" on utero_academy.user_profiles;
create policy "super admin dapat membuat profil"
on utero_academy.user_profiles
for insert
to authenticated
with check (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "super admin dapat update profil" on utero_academy.user_profiles;
create policy "super admin dapat update profil"
on utero_academy.user_profiles
for update
to authenticated
using (utero_academy.current_user_has_role('super_admin'))
with check (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "super admin dapat membaca semua user role" on utero_academy.user_roles;
create policy "super admin dapat membaca semua user role"
on utero_academy.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('super_admin')
);

drop policy if exists "super admin dapat assign role" on utero_academy.user_roles;
create policy "super admin dapat assign role"
on utero_academy.user_roles
for insert
to authenticated
with check (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "super admin dapat hapus role user" on utero_academy.user_roles;
create policy "super admin dapat hapus role user"
on utero_academy.user_roles
for delete
to authenticated
using (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "permission dapat dibaca super admin" on utero_academy.permissions;
create policy "permission dapat dibaca super admin"
on utero_academy.permissions
for select
to authenticated
using (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "role permission dapat dibaca super admin" on utero_academy.role_permissions;
create policy "role permission dapat dibaca super admin"
on utero_academy.role_permissions
for select
to authenticated
using (utero_academy.current_user_has_role('super_admin'));

