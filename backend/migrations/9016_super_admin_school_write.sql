grant insert, update, delete on utero_academy.schools to authenticated;

create policy academy_super_admin_schools_insert on utero_academy.schools
  for insert to authenticated
  with check (utero_academy.current_user_has_role('super_admin'));

create policy academy_super_admin_schools_update on utero_academy.schools
  for update to authenticated
  using (utero_academy.current_user_has_role('super_admin'))
  with check (utero_academy.current_user_has_role('super_admin'));

create policy academy_super_admin_schools_delete on utero_academy.schools
  for delete to authenticated
  using (utero_academy.current_user_has_role('super_admin'));
