create or replace function utero_academy.delete_auth_user(p_user_id uuid)
returns table(id uuid, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if session_user <> 'academy_api'
    or auth.uid() is null
    or not utero_academy.current_user_has_role('super_admin')
    or auth.uid() = p_user_id
  then
    raise exception 'Akses hapus user ditolak' using errcode = '42501';
  end if;

  return query
    delete from auth.users users
    where users.id = p_user_id and users.deleted_at is null
    returning users.id, users.email;
end
$$;

revoke all on function utero_academy.delete_auth_user(uuid) from public, anon, authenticated;
grant execute on function utero_academy.delete_auth_user(uuid) to academy_api;
