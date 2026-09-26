-- Kencangkan view dan fungsi: security_invoker + search_path tetap.
--
-- Dua lubang berbeda, keduanya tentang hak siapa yang berlaku saat kode jalan.

-- ---------------------------------------------------------------------------
-- (1) user_quiz_attempts_summary — view tanpa security_invoker.
--
-- 0026:100 membuatnya dengan CREATE OR REPLACE VIEW tanpa opsi apa pun. Di
-- PostgreSQL, default sebuah view adalah security_invoker = false: view jalan
-- dengan hak PEMILIKNYA, bukan hak pemanggil. Artinya RLS pada tabel yang
-- dirujuk (quiz_attempts, quizzes, intern_profiles) DIEVALUASI SEBAGAI PEMILIK
-- VIEW — dan pemiliknya postgres, yang memiliki tabel-tabel itu.
--
-- Akibatnya view ini mengembalikan percobaan kuis SETIAP peserta kepada siapa
-- pun yang boleh menyentuh view-nya, melewati seluruh policy 0030d. Kolom yang
-- bocor: user_id, quiz_id, attempts_used, best_score, last_attempt_at,
-- ever_passed — nilai dan riwayat pengerjaan per orang.
--
-- security_invoker = true membuat RLS dievaluasi sebagai pemanggil, sehingga
-- policy quiz_attempts_select di 0030d benar-benar berlaku: peserta melihat
-- barisnya sendiri, staf melihat semua.
--
-- Dipakai `alter view ... set`, BUKAN create or replace view: yang kedua
-- memancarkan ulang seluruh body dari teks migrasi ini, dan DB produksi sudah
-- terbukti menyimpang dari berkas migrasi — kalau body di produksi berbeda,
-- create or replace akan menimpanya secara senyap. `alter ... set` hanya
-- menyentuh opsinya.
--
-- security_invoker butuh PostgreSQL 15+. Kalau server lebih tua, ALTER-nya
-- gagal; penanganannya eksplisit di bawah, bukan dibiarkan membatalkan migrasi
-- tanpa penjelasan — tapi juga tidak dibiarkan lolos senyap, karena view yang
-- masih bocor adalah lubang terbuka.
do $$
declare
  versi int := current_setting('server_version_num')::int;
begin
  if not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'utero_academy'
      and c.relname = 'user_quiz_attempts_summary'
      and c.relkind = 'v'
  ) then
    raise notice 'View user_quiz_attempts_summary tidak ada, dilewati.';
    return;
  end if;

  if versi < 150000 then
    raise exception
      'security_invoker butuh PostgreSQL 15+, server ini %. View '
      'utero_academy.user_quiz_attempts_summary membocorkan percobaan kuis '
      'setiap peserta dan TIDAK BISA diperbaiki lewat opsi view di versi ini. '
      'Jalan keluarnya: cabut seluruh akses ke view (revoke) dan ganti '
      'pemakaiannya dengan query langsung ke quiz_attempts yang tunduk RLS.',
      versi;
  end if;

  execute 'alter view utero_academy.user_quiz_attempts_summary '
          'set (security_invoker = true)';

  raise notice 'View user_quiz_attempts_summary kini security_invoker = true.';
end
$$;

-- View tidak punya RLS sendiri; yang menjaganya adalah grant + RLS tabel di
-- baliknya. Grant anon/authenticated ke view ini dicabut sekalian — tidak ada
-- kode aplikasi yang membacanya lewat klien sesi (nol referensi
-- user_quiz_attempts_summary di features/ dan app/); yang dipakai aplikasi
-- adalah fungsi can_attempt_quiz().
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'utero_academy'
      and c.relname = 'user_quiz_attempts_summary'
      and c.relkind = 'v'
  ) then
    execute 'revoke all privileges on utero_academy.user_quiz_attempts_summary '
            'from anon, authenticated';
    raise notice 'Grant anon/authenticated pada view dicabut.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- (2) search_path tetap untuk seluruh fungsi di schema.
--
-- Fungsi tanpa `set search_path` me-resolve nama tabel lewat search_path
-- PEMANGGIL. Pemanggil yang bisa mengatur search_path-nya sendiri dapat
-- menyelipkan schema berisi tabel bernama sama di depan utero_academy, dan
-- fungsi itu akan membaca/menulis tabel palsu tersebut.
--
-- Untuk fungsi SECURITY INVOKER dampaknya terbatas pada hak pemanggil sendiri.
-- Untuk SECURITY DEFINER dampaknya eskalasi hak penuh — dan schema ini punya
-- satu: utero_academy.current_user_has_role(text) di 0002:8-22, fungsi yang
-- menjadi dasar SETIAP predikat policy di 0030a-f. search_path yang bisa
-- digeser pada fungsi itu berarti seluruh RLS di schema ini bisa dibohongi
-- dengan menyediakan tabel `user_roles` dan `roles` palsu.
--
-- Karena itu sapuan ini mencakup seluruh fungsi di utero_academy, bukan hanya
-- yang disebut di plan (0022-0026). Signature diambil dari pg_proc lewat
-- pg_get_function_identity_arguments(), BUKAN dari teks migrasi: nilai default
-- argumen bisa sudah menyimpang di produksi, dan identity_arguments memberi
-- bentuk yang persis bisa dipakai di ALTER FUNCTION.
--
-- pg_temp wajib ikut dan harus TERAKHIR. Tanpa menyebutnya, PostgreSQL menaruh
-- pg_temp di DEPAN secara implisit, sehingga tabel temporary milik pemanggil
-- bisa menang atas tabel asli — persis serangan yang hendak ditutup.
do $$
declare
  f record;
  jumlah int := 0;
begin
  for f in
    select
      p.oid,
      p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
      p.prosecdef
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'utero_academy'
      and p.prokind in ('f', 'p')
    order by p.proname
  loop
    execute format(
      'alter function utero_academy.%I(%s) set search_path = utero_academy, public, pg_temp',
      f.proname, f.args);

    jumlah := jumlah + 1;

    if f.prosecdef then
      raise notice
        'search_path dipaku pada fungsi SECURITY DEFINER: %(%)',
        f.proname, f.args;
    end if;
  end loop;

  raise notice 'search_path dipaku pada % fungsi di utero_academy.', jumlah;
end
$$;

-- `public` disertakan di search_path karena beberapa fungsi memanggil
-- gen_random_uuid(). Di instalasi Supabase, pgcrypto dipasang di schema
-- `extensions`, tapi gen_random_uuid() sudah menjadi built-in sejak
-- PostgreSQL 13 (ada di pg_catalog, yang selalu ada di depan search_path tanpa
-- perlu disebut). `public` tetap dicantumkan untuk tipe atau fungsi lain yang
-- mungkin dirujuk; ia SETELAH utero_academy, jadi tabel schema ini tetap menang.
--
-- CATATAN VERIFIKASI: kalau ada fungsi yang gagal setelah migrasi ini dengan
-- error "relation ... does not exist" atau "function ... does not exist", itu
-- berarti fungsi tersebut memang bergantung pada schema di luar daftar
-- (kemungkinan `extensions`). Perbaikannya menambah schema itu ke daftar untuk
-- fungsi yang bersangkutan — JANGAN mencabut set search_path-nya.
