do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (policyname = 'Public Access' or trim(qual) = 'true')
  ) then
    raise exception 'Policy Storage global masih terbuka; bucket privat Academy tidak aman dibuat.';
  end if;

  if exists (
    select 1 from storage.buckets where id = 'academy-private'
      and (public is distinct from false
        or file_size_limit is distinct from 20971520
        or allowed_mime_types is distinct from array[
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]::text[])
  ) then
    raise exception 'Bucket academy-private sudah ada dengan konfigurasi berbeda.';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-private', 'academy-private', false, 20971520,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;
