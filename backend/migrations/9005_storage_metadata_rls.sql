alter table academy_storage.objects enable row level security;

grant usage on schema academy_storage to authenticated;
grant select on academy_storage.objects to authenticated;

create policy academy_storage_owner_select on academy_storage.objects
  for select to authenticated
  using (owner_id = auth.uid());

create policy academy_storage_api_all on academy_storage.objects
  for all to academy_api
  using (true)
  with check (true);
