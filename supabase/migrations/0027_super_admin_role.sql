insert into utero_academy.roles (code, name, description)
values ('super_admin', 'Super Admin', 'Akses penuh ke seluruh platform dan log aktivitas')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

drop policy if exists "admin dapat mengelola user_roles" on utero_academy.user_roles;
drop policy if exists "admin dapat membaca user_roles" on utero_academy.user_roles;
drop policy if exists "super admin dapat membaca user_roles" on utero_academy.user_roles;
drop policy if exists "super admin dapat mengelola user_roles" on utero_academy.user_roles;
create policy "super admin dapat membaca user_roles"
on utero_academy.user_roles
for select
to authenticated
using (user_id = auth.uid() or utero_academy.current_user_has_role('super_admin'));

create policy "super admin dapat mengelola user_roles"
on utero_academy.user_roles
for all
to authenticated
using (utero_academy.current_user_has_role('super_admin'))
with check (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "admin dapat mengelola user_profiles" on utero_academy.user_profiles;
drop policy if exists "super admin dapat mengelola user_profiles" on utero_academy.user_profiles;
create policy "super admin dapat mengelola user_profiles"
on utero_academy.user_profiles
for all
to authenticated
using (id = auth.uid() or utero_academy.current_user_has_role('super_admin'))
with check (id = auth.uid() or utero_academy.current_user_has_role('super_admin'));
