-- Aktifkan Row Level Security pada 14 tabel yang terlewat.
--
-- Keempat belas tabel di bawah tidak punya RLS DAN tidak punya policy sama
-- sekali. Migrasi yang membuatnya (0006, 0009, 0017, 0020, 0022, 0024, 0025)
-- tidak memuat satu pun `enable row level security` maupun `create policy`
-- untuk tabel-tabel ini — terverifikasi: grep "create policy" pada 0017, 0020,
-- 0022, 0024, 0025 mengembalikan nol baris.
--
--   0017  permits
--   0020  lesson_comments
--   0022  badges, user_badges, user_points, point_transactions,
--         learning_sessions, daily_activity, user_streaks
--   0024  course_announcements, announcement_reads
--   0025  lesson_bookmarks
--   0006  attendance_settings
--   0009  landing_page_settings
--
-- Karena 0007:12 memasang `alter default privileges ... grant all ... to anon`,
-- setiap tabel di atas lahir terbuka penuh untuk kunci anon publik: tanpa RLS,
-- tanpa policy, dengan grant penuh.
--
-- attendance_settings adalah yang paling berbahaya: 0006:31-32 memberi
-- SELECT/INSERT/UPDATE/DELETE ke `authenticated` DAN `anon` secara eksplisit,
-- dan baris tunggal di tabel itulah yang dibaca features/attendance/actions.ts
-- :104 dan :210 untuk menentukan allow_geofencing, office_latitude/longitude,
-- dan radius_meters. Tanpa RLS, siapa pun yang punya kunci anon publik dapat
-- mematikan geofence absensi untuk seluruh peserta.
--
-- BERKAS INI HANYA MENGAKTIFKAN RLS. Policy-nya menyusul di 0030*. Di sela
-- keduanya, RLS aktif tanpa policy berarti MENOLAK SEMUA BARIS bagi klien sesi
-- pada keempat belas tabel. Itu aman di aplikasi ini karena tidak satu pun dari
-- keempat belas tabel disentuh klien sesi (createUteroAcademyClient) — seluruh
-- titik bacanya memakai service role, yang punya BYPASSRLS. Urutan penerapan
-- tetap penting: jalankan 0030* bersama atau segera setelah berkas ini, dan
-- 0031 (pencabutan grant) hanya setelah keduanya terbukti benar.

-- Sapuan dijalankan lewat loop dengan penjaga keberadaan tabel, bukan daftar
-- ALTER TABLE keras. DB produksi sudah terbukti menyimpang dari berkas migrasi,
-- dan satu referensi ke tabel yang tidak ada akan membatalkan SELURUH migrasi.
do $$
declare
  target_table text;
  missing text[] := '{}';
  touched int := 0;
begin
  foreach target_table in array array[
    'badges',
    'user_points',
    'user_streaks',
    'daily_activity',
    'lesson_comments',
    'lesson_bookmarks',
    'course_announcements',
    'permits',
    'attendance_settings',
    'landing_page_settings',
    'user_badges',
    'point_transactions',
    'learning_sessions',
    'announcement_reads'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'utero_academy'
        and c.relname = target_table
        and c.relkind = 'r'
    ) then
      missing := missing || target_table;
      continue;
    end if;

    -- Tanpa syarat, bukan `if not relrowsecurity`: menegaskan kembali keadaan
    -- yang diinginkan lebih aman daripada mempercayai keadaan sekarang, dan
    -- ENABLE pada tabel yang sudah aktif adalah no-op.
    execute format('alter table utero_academy.%I enable row level security', target_table);

    -- FORCE membuat RLS berlaku untuk OWNER tabel juga. Ini menutup kasus
    -- fungsi atau koneksi yang jalan sebagai `postgres` dan melewati policy.
    -- service_role punya atribut BYPASSRLS, jadi aplikasi tidak terpengaruh.
    --
    -- Aman untuk keempat belas tabel ini: satu-satunya fungsi SECURITY DEFINER
    -- di schema adalah utero_academy.current_user_has_role() (0002:8-22), yang
    -- hanya membaca user_roles dan roles — keduanya tidak ada di daftar ini.
    execute format('alter table utero_academy.%I force row level security', target_table);

    touched := touched + 1;
  end loop;

  raise notice 'RLS diaktifkan dan dipaksa pada % tabel.', touched;

  if array_length(missing, 1) is not null then
    raise notice 'Tabel tidak ditemukan, dilewati: %', array_to_string(missing, ', ');
  end if;
end
$$;

-- Tabel pencatat runner migrasi ikut dikencangkan.
--
-- utero_academy.schema_migrations dibuat oleh scripts/migrate.mjs, yaitu SETELAH
-- 0007:12 memasang `alter default privileges ... grant all privileges on tables
-- to ... anon`. Artinya tabel itu lahir terbuka untuk kunci anon publik, dan
-- isinya membocorkan nama setiap berkas migrasi beserta waktu penerapannya.
--
-- Hanya service_role dan postgres yang perlu menyentuhnya; tidak ada satu pun
-- kode aplikasi yang membacanya.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'utero_academy'
      and c.relname = 'schema_migrations'
      and c.relkind = 'r'
  ) then
    execute 'alter table utero_academy.schema_migrations enable row level security';
    execute 'revoke all privileges on table utero_academy.schema_migrations from anon, authenticated';
    raise notice 'schema_migrations dikencangkan.';
  end if;
end
$$;
