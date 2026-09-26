-- Pengencangan storage, bagian pertama: batas bucket + policy storage.objects.
--
-- Dua migrasi melonggarkannya, berturut-turut:
--
--   0005:6-8  UPDATE storage.buckets SET file_size_limit = NULL untuk enam
--             bucket, dengan komentar "make buckets unlimited size"
--   0007:17-26 memaksa keenam bucket jadi public = true, file_size_limit = null,
--             allowed_mime_types = null
--
-- Keduanya membalik seed/0002_storage_buckets.sql, yang sengaja menetapkan
-- daily-report/task/certificate/learning privat dengan mime ketat. 0007:38 lalu
-- menambah policy "Public Access" FOR SELECT USING (true) yang berlaku ke SEMUA
-- bucket, termasuk yang tidak disebut di 0007. Terbukti empiris: selfie absensi
-- nyata terunduh tanpa header auth sama sekali (HTTP 200, image/jpeg).
--
-- Berkas ini TIDAK mem-flip public = false. Flip itu di 0032b, dan hanya boleh
-- jalan setelah backfill URL->path terverifikasi — mem-flip sekarang akan
-- mematikan setiap URL publik yang sudah tersimpan di database.

-- ---------------------------------------------------------------------------
-- (1) Batas ukuran dan jenis berkas per bucket.
--
-- Sumber kebenaran GANDA, dan keduanya harus sejalan:
--   - seed/0002_storage_buckets.sql: niat awal ukuran per bucket
--   - lib/uploads.ts: validasi magic-byte terpusat yang dilewati SEMUA unggahan
--
-- Daftar mime di bawah adalah irisan yang benar dari keduanya. Seed tidak bisa
-- disalin mentah: bucket `avatars` kini menampung PDF (CV, portofolio, surat
-- sakit — features/registration/actions.ts:72-94, features/attendance/actions.ts
-- :319) dan dokumen OOXML, padahal seed hanya mengizinkan image/*. Menyalin
-- seed apa adanya akan menolak unggahan surat sakit pada percobaan pertama.
--
-- detectFileType() di lib/uploads.ts hanya bisa menghasilkan: image/jpeg,
-- image/png, image/gif, image/webp, application/pdf, dan
-- application/vnd.openxmlformats-officedocument.wordprocessingml.document.
-- Batas ukurannya 5 MB untuk image dan 10 MB untuk dokumen. Batas bucket tidak
-- boleh lebih kecil dari batas aplikasi untuk jenis yang memang diterimanya.
--
-- Batas bucket tetap ditegakkan oleh layanan storage SEKALIPUN unggahan datang
-- lewat service role — inilah lapis yang menangkap titik unggah baru yang lupa
-- memanggil validateUpload().
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Campur: avatar profil + CV + portofolio + selfie absensi + surat sakit +
  -- template sertifikat. Karena itu image DAN dokumen.
  ('avatars', 'avatars', true, 10485760, array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('daily-report', 'daily-report', false, 20971520, array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('task', 'task', false, 20971520, array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('certificate', 'certificate', false, 10485760, array['application/pdf']),
  ('learning', 'learning', false, 104857600, array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'video/mp4',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('gallery', 'gallery', true, 10485760, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('article', 'article', true, 10485760, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('mentor', 'mentor', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('school-logo', 'school-logo', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
-- SENGAJA tidak menyentuh kolom public di klausa update — itu tugas 0032b.
-- Kolom public di VALUES hanya berlaku kalau bucket-nya belum ada sama sekali,
-- dan nilainya menyalin keadaan sekarang supaya berkas ini tidak mengubah
-- perilaku baca apa pun.

-- ---------------------------------------------------------------------------
-- (2) Ganti keempat policy 0007 pada storage.objects.
--
-- Yang dicabut:
--   "Public Access"         FOR SELECT USING (true)  -> berlaku ke SEMUA bucket
--   "Authenticated Upload"  hanya memeriksa bucket_id
--   "Authenticated Update"  hanya memeriksa bucket_id -> user login mana pun
--   "Authenticated Delete"  hanya memeriksa bucket_id    bisa menimpa/menghapus
--                                                        objek milik siapa pun
alter table storage.objects enable row level security;

drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated Upload" on storage.objects;
drop policy if exists "Authenticated Update" on storage.objects;
drop policy if exists "Authenticated Delete" on storage.objects;
drop policy if exists public_buckets_read on storage.objects;

-- Baca publik HANYA untuk bucket yang memang konten publik. `avatars` sengaja
-- tidak masuk: sesuai K-1 ia menjadi privat (isinya CV, selfie, surat sakit)
-- dan dibaca lewat signed URL yang dibuat server.
create policy public_buckets_read on storage.objects
for select to anon, authenticated
using (bucket_id in ('gallery', 'article', 'mentor', 'school-logo'));

-- TANPA policy insert/update/delete untuk anon maupun authenticated, dan tanpa
-- policy select untuk bucket privat. Terverifikasi dari inventaris kode:
-- seluruh 16 titik unggah memakai klien service role, yang punya BYPASSRLS,
-- dan pembacaan bucket privat akan lewat signed URL yang juga dibuat service
-- role. Path di bucket privat tidak seragam ({userId}/..., cv/..., settings/
-- ...), jadi predikat owner-scoped (storage.foldername(name))[1] = auth.uid()
-- akan salah untuk sebagian path — lebih aman tidak memberi jalur langsung
-- sama sekali.

-- ---------------------------------------------------------------------------
-- (3) Grant tabel menyesuaikan policy.
--
-- SELECT dipertahankan supaya policy baca di atas berfungsi (grant dan RLS
-- adalah dua gerbang independen). Hak tulis dicabut: tidak ada satu pun jalur
-- tulis yang sah lewat role ini, dan layanan storage sendiri terhubung sebagai
-- role adminnya, bukan sebagai anon/authenticated.
revoke insert, update, delete, truncate, references, trigger
  on storage.objects from anon, authenticated;
grant select on storage.objects to anon, authenticated;
