grant insert, update, delete on utero_academy.school_contacts to authenticated;

drop policy if exists school_contacts_staff_write on utero_academy.school_contacts;

create policy academy_super_admin_contacts_insert on utero_academy.school_contacts
  for insert to authenticated
  with check (utero_academy.current_user_has_role('super_admin'));

create policy academy_super_admin_contacts_update on utero_academy.school_contacts
  for update to authenticated
  using (utero_academy.current_user_has_role('super_admin'))
  with check (utero_academy.current_user_has_role('super_admin'));

create policy academy_super_admin_contacts_delete on utero_academy.school_contacts
  for delete to authenticated
  using (utero_academy.current_user_has_role('super_admin'));
