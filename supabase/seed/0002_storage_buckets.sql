insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('daily-report', 'daily-report', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('task', 'task', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']),
  ('certificate', 'certificate', false, 10485760, array['application/pdf']),
  ('learning', 'learning', false, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']),
  ('gallery', 'gallery', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('article', 'article', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('mentor', 'mentor', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('school-logo', 'school-logo', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

