-- Cabut grant selimut yang dipasang 0007, kembalikan hanya yang dibuktikan dipakai.
--
-- 0007_setup_buckets_and_permissions.sql menyatakan niatnya di judulnya sendiri:
-- "to prevent permission denied errors". Perbaikannya adalah membuka semuanya:
--
--   0007:7   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA utero_academy
--            TO postgres, service_role, authenticated, anon
--   0007:12  ALTER DEFAULT PRIVILEGES ... GRANT ALL PRIVILEGES ON TABLES
--            TO postgres, service_role, authenticated, anon
--
-- Baris :12 yang paling merusak: setiap tabel yang dibuat SETELAH 0007 lahir
-- terbuka penuh untuk kunci anon publik — kunci yang memang dikirim ke setiap
-- browser. Terbukti empiris: kunci anon membaca 959 baris attendances, 841
-- daily_reports, 505 daily_report_reviews, 92 permits, 44 intern_profiles,
-- termasuk kolom check_in_latitude/longitude, selfie, email, dan telepon peserta.
--
-- Bahwa ini regresi dan bukan desain dibuktikan supabase/seed/0002_storage_buckets
-- .sql, yang sengaja menetapkan bucket sensitif sebagai privat dengan mime type
-- ketat — lalu dibalik 0007.
--
-- Tidak ada satu pun REVOKE di seluruh 27 migrasi sebelum berkas ini.
--
-- MENGAPA BERNOMOR SETELAH 0030*: berkas ini sengaja dijalankan SETELAH policy
-- `authenticated` di 0030* terpasang dan terbukti mengembalikan baris per role.
-- Grant dan RLS adalah dua gerbang yang independen — keduanya harus lolos.
-- Mencabut grant sebelum policy siap tidak menutup lubang lebih cepat; ia hanya
-- memindahkan kegagalan ke titik yang tidak kelihatan.
--
-- URUTAN DI DALAM BERKAS INI MENENTUKAN. Jangan diacak.

-- ---------------------------------------------------------------------------
-- PERINGATAN OPERASIONAL: berkas ini harus dijalankan oleh role yang tepat.
--
-- `alter default privileges ... revoke` HANYA berlaku untuk default milik role
-- yang menjalankannya. Kalau 0007 dijalankan oleh role yang berbeda dari yang
-- menjalankan berkas ini, langkah (1) di bawah adalah NO-OP SENYAP: ia selesai
-- tanpa error, dan setiap tabel baru tetap lahir terbuka untuk anon.
--
-- Periksa dulu siapa pemilik default yang terpasang:
--
--   select pg_get_userbyid(d.defaclrole) as pemilik_default,
--          n.nspname as schema,
--          d.defaclobjtype,
--          d.defaclacl
--   from pg_catalog.pg_default_acl d
--   join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
--   where n.nspname = 'utero_academy';
--
-- Jalankan berkas ini sebagai role yang muncul di kolom pemilik_default. Kalau
-- ada lebih dari satu, langkah (1) harus diulang oleh masing-masing role.
-- Asersi di akhir berkas akan gagal keras kalau default anon masih tertinggal.
-- ---------------------------------------------------------------------------

-- (1) Matikan pewarisan LEBIH DULU.
--
-- Didahulukan supaya tidak ada tabel yang lahir terbuka di sela antara revoke
-- massal dan sekarang.
alter default privileges in schema utero_academy
  revoke all privileges on tables from anon, authenticated;
alter default privileges in schema utero_academy
  revoke all privileges on sequences from anon, authenticated;
alter default privileges in schema utero_academy
  revoke all privileges on functions from anon, authenticated;

-- (2) Cabut semua yang sudah terpasang.
revoke all privileges on all tables in schema utero_academy from anon, authenticated;
revoke all privileges on all sequences in schema utero_academy from anon, authenticated;
revoke all privileges on all functions in schema utero_academy from anon, authenticated;

-- (3) Tegaskan ulang postgres dan service_role.
--
-- Keduanya ikut tersapu kalau langkah (2) pernah ditulis tanpa daftar role yang
-- eksplisit, dan seluruh aplikasi bergantung pada service_role. Ditegaskan di
-- sini supaya berkas ini tidak pernah bisa mematikan aplikasi.
grant usage on schema utero_academy to postgres, service_role;
grant all privileges on all tables in schema utero_academy to postgres, service_role;
grant all privileges on all sequences in schema utero_academy to postgres, service_role;
grant all privileges on all functions in schema utero_academy to postgres, service_role;

alter default privileges in schema utero_academy
  grant all privileges on tables to postgres, service_role;
alter default privileges in schema utero_academy
  grant all privileges on sequences to postgres, service_role;
alter default privileges in schema utero_academy
  grant all privileges on functions to postgres, service_role;

-- (4) USAGE pada schema tetap dikembalikan untuk anon dan authenticated.
--
-- Tanpa ini, PostgREST tidak bisa me-resolve nama tabel sama sekali dan error
-- yang keluar adalah "schema must be added to exposed schemas", yang menyesatkan.
-- USAGE saja tidak memberi akses baris apa pun — akses tabel diatur langkah (5).
grant usage on schema utero_academy to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (5) Kembalikan HANYA pengecualian yang dibuktikan dipakai.
--
-- Daftar di bawah diturunkan dari inventaris setiap pemanggilan
-- createUteroAcademyClient() — klien yang memakai identitas sesi, sehingga
-- grant `authenticated` DAN policy RLS keduanya berlaku. Klien service role
-- melewati RLS dan tidak butuh grant apa pun di sini.
--
-- Tabel yang HANYA disentuh service role sengaja TIDAK diberi grant:
-- attendance_settings, landing_page_settings, permits, schools, school_contacts,
-- daily_reports, dan seluruh tabel LMS/gamifikasi.
-- ---------------------------------------------------------------------------

-- anon: satu-satunya jalur publik yang disengaja adalah formulir pendaftaran
-- magang (0002:5). Pendaftar belum punya akun, jadi ini memang harus anon.
-- INSERT saja — tanpa SELECT, sehingga pendaftar tidak bisa membaca kembali
-- lamaran siapa pun, termasuk lamarannya sendiri.
grant insert on table utero_academy.internship_applications to anon;

-- authenticated — profil dan identitas
--   user_profiles   select  ProtectedDashboardLayout.tsx:82, profile/page.tsx:11
--                   update  edit-profile-action.ts:51
--   intern_profiles select  profile/page.tsx:16, queries.ts:45 (sumber tersemat)
--                   update  edit-profile-action.ts:60
--   mentor_profiles select  profile/page.tsx:21
--                   update  edit-profile-action.ts:66
grant select, update on table utero_academy.user_profiles to authenticated;
grant select, update on table utero_academy.intern_profiles to authenticated;
grant select, update on table utero_academy.mentor_profiles to authenticated;

-- authenticated — resolusi peran
--   user_roles  select  profile/page.tsx:26
--   roles       select  profile/page.tsx:28, hanya sebagai sumber tersemat
--                       roles(code, name); join tidak bisa di-resolve tanpanya
--
-- INSERT dan DELETE pada user_roles dari 0003:5 TIDAK dikembalikan: seluruh
-- penetapan peran di features/super-admin/actions.ts memakai service role.
grant select on table utero_academy.user_roles to authenticated;
grant select on table utero_academy.roles to authenticated;

-- authenticated — absensi
--   attendances  select  queries.ts:7, :20, :44
--                insert  actions.ts:172  (check-in)
--                update  actions.ts:234  (check-out), :265 (review)
--
-- Tanpa DELETE: tidak ada satu pun titik yang menghapus absensi, dan absensi
-- adalah catatan yang seharusnya tidak bisa dihilangkan oleh pemiliknya.
grant select, insert, update on table utero_academy.attendances to authenticated;

-- authenticated — penugasan pembimbing
--   mentor_assignments  select  queries.ts:33
--                       insert  admin/actions.ts:67
--                       delete  admin/actions.ts:92
grant select, insert, delete on table utero_academy.mentor_assignments to authenticated;

-- authenticated — review lamaran
--   internship_applications  update  admin/actions.ts:39
--
-- 0002:6 memberi SELECT juga; itu dikembalikan karena PostgREST membutuhkannya
-- untuk mengembalikan baris hasil UPDATE, dan admin memang membaca daftar
-- lamaran. Policy di 0030* yang membatasi baris mana yang terlihat.
grant select, update on table utero_academy.internship_applications to authenticated;

-- authenticated — fungsi yang dipanggil dari dalam policy
--
-- current_user_has_role() dipakai di klausa USING banyak policy, jadi ia harus
-- executable oleh authenticated atau setiap policy yang memanggilnya akan error
-- (bukan mengembalikan nol baris — error 42501 yang terlihat sebagai fitur mati).
--
-- Ketiga RPC lain (update_daily_activity, update_user_streak, can_attempt_quiz)
-- SENGAJA tidak diberi execute: seluruh pemanggilnya di features/lms/actions.ts
-- :1000, :1008, :1160 memakai service role.
grant execute on function utero_academy.current_user_has_role(text) to authenticated;

-- Tidak ada grant sequence: seluruh primary key di schema ini uuid
-- (gen_random_uuid()), nol kolom serial dan nol CREATE SEQUENCE.

-- ---------------------------------------------------------------------------
-- (6) Asersi. Gagal keras kalau revoke-nya tidak benar-benar terjadi.
--
-- Ini yang menangkap kasus no-op senyap di peringatan operasional di atas.
-- ---------------------------------------------------------------------------
do $$
declare
  sisa_anon int;
  default_anon int;
begin
  -- Tabel yang masih bisa disentuh anon, di luar pengecualian yang disengaja.
  select count(*)
    into sisa_anon
  from information_schema.role_table_grants
  where table_schema = 'utero_academy'
    and grantee = 'anon'
    and not (table_name = 'internship_applications' and privilege_type = 'INSERT');

  if sisa_anon > 0 then
    raise exception
      'Masih ada % grant anon di utero_academy di luar allowlist. Revoke tidak tuntas.',
      sisa_anon;
  end if;

  -- Default privileges yang masih menyebut anon berarti langkah (1) no-op:
  -- berkas ini dijalankan oleh role yang berbeda dari pemasang default 0007.
  select count(*)
    into default_anon
  from pg_catalog.pg_default_acl d
  join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'utero_academy'
    and array_to_string(d.defaclacl, ',') like '%anon=%';

  if default_anon > 0 then
    raise exception
      'ALTER DEFAULT PRIVILEGES masih memberi hak ke anon (% entri). '
      'Berkas ini dijalankan oleh role yang bukan pemasang default 0007 — '
      'jalankan ulang sebagai role yang muncul di pg_default_acl.defaclrole.',
      default_anon;
  end if;

  raise notice 'Grant selimut tercabut. Tidak ada sisa akses anon di luar allowlist.';
end
$$;
