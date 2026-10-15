-- Pengganti Storage 0032a/0032b dan asersi Storage 0034 pada host bersama.
-- Jangan jalankan migrasi historis tersebut pada host SoundPub: 0032a menghapus
-- policy lintas aplikasi, 0032b memprivatkan avatars, dan 0034 memeriksa
-- bucket aplikasi lain. Baseline 0001-0037 harus dibuktikan terpisah.
-- Migrasi ini hanya boleh dijalankan sesudah 0047 dan copy objek terverifikasi.

do $$
declare
  academy_bucket storage.buckets%rowtype;
  unsafe_policy text;
begin
  if not exists (
    select 1 from pg_class where oid = 'storage.objects'::regclass and relrowsecurity
  ) then
    raise exception 'RLS storage.objects tidak aktif';
  end if;

  with relevant_policy as (
    select policyname, cmd,
      case when cmd in ('SELECT', 'DELETE', 'UPDATE', 'ALL') then qual end as using_expression,
      case when cmd in ('INSERT', 'UPDATE', 'ALL') then coalesce(with_check, qual) end as check_expression
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles::text[] && array['anon', 'authenticated', 'public']
  ), policy_expression as (
    select policyname, expression
    from relevant_policy
    cross join lateral unnest(array[using_expression, check_expression]) expression
    where expression is not null
  )
  select string_agg(distinct policyname, ', ' order by policyname) into unsafe_policy
  from (
    select policyname from relevant_policy
    where (cmd in ('SELECT', 'DELETE', 'UPDATE', 'ALL') and using_expression is null)
      or (cmd in ('INSERT', 'UPDATE', 'ALL') and check_expression is null)
    union all
    select policyname from policy_expression
    where lower(expression) like '%academy-private%'
      or expression !~* '(?s)^(\(bucket_id = ((\x27[^\x27]+\x27::text)|ANY \(ARRAY\[(\x27[^\x27]+\x27::text)(, \x27[^\x27]+\x27::text)*\]\))\)|\(\(bucket_id = ((\x27[^\x27]+\x27::text)|ANY \(ARRAY\[(\x27[^\x27]+\x27::text)(, \x27[^\x27]+\x27::text)*\]\))\) AND .*\))$'
  ) unsafe;

  if unsafe_policy is not null then
    raise exception 'Policy Storage dapat menjangkau academy-private atau scope-nya tidak dapat dibuktikan aman: %. Audit host sebelum mengulang.', unsafe_policy;
  end if;

  select * into academy_bucket from storage.buckets where id = 'academy-private';
  if not found then
    raise exception 'Bucket academy-private belum dibuat oleh 0047';
  end if;

  if academy_bucket.public is distinct from false
    or academy_bucket.file_size_limit is distinct from 20971520
    or academy_bucket.allowed_mime_types is distinct from array[
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[] then
    raise exception 'Konfigurasi academy-private menyimpang dari 0047';
  end if;
end $$;
