grant usage on schema utero_academy to anon, authenticated;

grant select on table utero_academy.roles to authenticated;
grant select on table utero_academy.user_roles to authenticated;
grant insert on table utero_academy.internship_applications to anon, authenticated;
grant select, update on table utero_academy.internship_applications to authenticated;

create or replace function utero_academy.current_user_has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = utero_academy
as $$
  select exists (
    select 1
    from utero_academy.user_roles ur
    join utero_academy.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = role_code
  );
$$;

grant execute on function utero_academy.current_user_has_role(text) to authenticated;

drop policy if exists "roles dapat dibaca user login" on utero_academy.roles;
create policy "roles dapat dibaca user login"
on utero_academy.roles
for select
to authenticated
using (true);

drop policy if exists "user dapat membaca role sendiri" on utero_academy.user_roles;
create policy "user dapat membaca role sendiri"
on utero_academy.user_roles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "visitor dapat submit pendaftaran" on utero_academy.internship_applications;
create policy "visitor dapat submit pendaftaran"
on utero_academy.internship_applications
for insert
to anon, authenticated
with check (
  status = 'submitted'
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "admin dapat membaca semua pendaftaran" on utero_academy.internship_applications;
create policy "admin dapat membaca semua pendaftaran"
on utero_academy.internship_applications
for select
to authenticated
using (
  utero_academy.current_user_has_role('super_admin')
  or utero_academy.current_user_has_role('admin_academy')
);

drop policy if exists "admin dapat update status pendaftaran" on utero_academy.internship_applications;
create policy "admin dapat update status pendaftaran"
on utero_academy.internship_applications
for update
to authenticated
using (
  utero_academy.current_user_has_role('super_admin')
  or utero_academy.current_user_has_role('admin_academy')
)
with check (
  (
    utero_academy.current_user_has_role('super_admin')
    or utero_academy.current_user_has_role('admin_academy')
  )
  and status in ('reviewed', 'accepted', 'rejected', 'cancelled')
);

