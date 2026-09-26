-- Policy RLS domain LMS dan gamifikasi.
--
-- Tabel: courses, lessons, quizzes, assignments, course_enrollments,
-- lesson_progress, quiz_attempts, assignment_submissions, lesson_comments,
-- lesson_bookmarks, course_announcements, announcement_reads, badges,
-- user_badges, user_points, point_transactions, learning_sessions,
-- daily_activity, user_streaks.
--
-- Seluruh titik baca/tulis memakai service role (features/lms/*), jadi policy
-- di sini lapis kedua. Tetap harus benar: ia yang menentukan apa yang dilihat
-- kunci anon atau sesi yang bicara langsung ke PostgREST.
--
-- Dua bentuk kepemilikan yang berbeda di domain ini, dan keduanya harus dibedakan:
--
--   intern_id -> intern_profiles : course_enrollments, lesson_progress,
--                quiz_attempts, assignment_submissions
--   user_id   -> auth.users      : lesson_comments, lesson_bookmarks,
--                announcement_reads, user_badges, user_points,
--                point_transactions, learning_sessions, daily_activity,
--                user_streaks  (tabel gamifikasi 0020-0025 berkunci langsung,
--                jadi user_id = auth.uid() tanpa join)
--
-- Matriks: kuis = intern "Milik sendiri", admin "Tidak" (admin tidak mengerjakan
-- kuis atas nama peserta). Jadi quiz_attempts, lesson_progress dan
-- assignment_submissions TIDAK memberi INSERT ke staf.

-- ---------------------------------------------------------------------------
-- Konten pembelajaran: courses, lessons, quizzes, assignments.
--
-- Dibaca seluruh user login, ditulis hanya staf ('lms.manage' di matriks).
-- Sengaja TIDAK memfilter is_published / status untuk pembaca: aplikasi sudah
-- menyaringnya (features/lms/queries.ts), dan menyaring di policy akan
-- menyembunyikan konten draft dari staf yang sedang menyusunnya — staf lolos
-- lewat cabang predikatnya sendiri, tapi peserta yang kebetulan mengaksesnya
-- lewat id langsung akan melihat draft.
--
-- Karena itu peserta dibatasi ke yang terbit, staf melihat semuanya. Kolom
-- penandanya tidak seragam: courses memakai enum status, tiga tabel lain
-- memakai boolean is_published dari 0015 — jadi predikatnya tidak bisa
-- disatukan dalam satu loop.
alter table utero_academy.courses enable row level security;
drop policy if exists courses_select on utero_academy.courses;
drop policy if exists courses_staff_write on utero_academy.courses;

create policy courses_select on utero_academy.courses
for select to authenticated
using (
  status = 'published'
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

create policy courses_staff_write on utero_academy.courses
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

do $$
declare
  t text;
  staf constant text :=
    'utero_academy.current_user_has_role(''admin'') '
    'or utero_academy.current_user_has_role(''super_admin'')';
begin
  -- Ketiga tabel ini memakai boolean is_published (0015), bukan enum status.
  -- `is not false` bukan `= true`: kolomnya nullable dengan default true, dan
  -- baris lama yang dibuat sebelum 0015 bisa bernilai null.
  foreach t in array array['lessons', 'quizzes', 'assignments']
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'utero_academy' and c.relname = t and c.relkind = 'r'
    ) then
      raise notice 'Tabel tidak ditemukan, dilewati: %', t;
      continue;
    end if;

    execute format('alter table utero_academy.%I enable row level security', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_select', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_staff_write', t);
    execute format(
      'create policy %I on utero_academy.%I for select to authenticated '
      'using (is_published is not false or %s)',
      t || '_select', t, staf);
    execute format(
      'create policy %I on utero_academy.%I for all to authenticated '
      'using (%s) with check (%s)',
      t || '_staff_write', t, staf, staf);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Progres peserta berkunci intern_id: course_enrollments, lesson_progress,
-- quiz_attempts, assignment_submissions.
--
-- Peserta: baca + tulis miliknya sendiri (mengerjakan kuis, menandai progres,
-- mengumpulkan tugas). Staf: BACA saja plus UPDATE untuk menilai — tanpa
-- INSERT, sesuai matriks yang menolak admin mengirim atas nama peserta.
-- Scope sekolah: baca saja.
--
-- Perhatikan: DELETE tidak diberikan kepada siapa pun. Percobaan kuis dan
-- pengumpulan tugas adalah catatan; menghapusnya menghapus bukti.
do $$
declare
  t text;
  milik text;
  staf constant text :=
    'utero_academy.current_user_has_role(''admin'') '
    'or utero_academy.current_user_has_role(''super_admin'')';
  scope text;
begin
  foreach t in array array[
    'course_enrollments', 'lesson_progress', 'quiz_attempts', 'assignment_submissions'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'utero_academy' and c.relname = t and c.relkind = 'r'
    ) then
      raise notice 'Tabel tidak ditemukan, dilewati: %', t;
      continue;
    end if;

    milik := format(
      'exists (select 1 from utero_academy.intern_profiles ip '
      'where ip.id = %I.intern_id and ip.user_id = auth.uid())', t);
    scope := format(
      'exists (select 1 from utero_academy.intern_profiles ip '
      'join utero_academy.school_contacts sc on sc.school_id = ip.school_id '
      'where ip.id = %I.intern_id and sc.user_id = auth.uid())', t);

    execute format('alter table utero_academy.%I enable row level security', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_select', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_own_insert', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_own_update', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_staff_update', t);

    execute format(
      'create policy %I on utero_academy.%I for select to authenticated '
      'using (%s or %s or %s)',
      t || '_select', t, milik, staf, scope);

    -- WITH CHECK mengikat intern_id ke profil pemanggil: peserta tidak bisa
    -- menyisipkan baris untuk peserta lain.
    execute format(
      'create policy %I on utero_academy.%I for insert to authenticated '
      'with check (%s)',
      t || '_own_insert', t, milik);

    execute format(
      'create policy %I on utero_academy.%I for update to authenticated '
      'using (%s) with check (%s)',
      t || '_own_update', t, milik, milik);

    -- Staf menilai (score, feedback, reviewed_at). RLS bekerja per baris, bukan
    -- per kolom, jadi pembatasan kolom mana yang boleh diubah tetap tanggung
    -- jawab aplikasi.
    execute format(
      'create policy %I on utero_academy.%I for update to authenticated '
      'using (%s) with check (%s)',
      t || '_staff_update', t, staf, staf);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Tabel berkunci user_id langsung ke auth.users.
--
-- lesson_comments, lesson_bookmarks, announcement_reads: milik user, dan user
-- boleh menghapus miliknya sendiri (membatalkan komentar, mencabut bookmark,
-- menandai belum dibaca).
--
-- user_badges, user_points, point_transactions, learning_sessions,
-- daily_activity, user_streaks: milik user tapi HANYA BOLEH DIBACA olehnya.
-- Semuanya ditulis oleh sistem lewat service role
-- (features/lms/actions.ts:1000, :1008 → update_daily_activity,
-- update_user_streak). Memberi tulis kepada user berarti membiarkannya
-- memberi dirinya poin dan lencana.
do $$
declare
  t text;
  staf constant text :=
    'utero_academy.current_user_has_role(''admin'') '
    'or utero_academy.current_user_has_role(''super_admin'')';
begin
  -- (a) Milik user, user boleh menulis penuh.
  foreach t in array array['lesson_comments', 'lesson_bookmarks', 'announcement_reads']
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'utero_academy' and c.relname = t and c.relkind = 'r'
    ) then
      raise notice 'Tabel tidak ditemukan, dilewati: %', t;
      continue;
    end if;

    execute format('alter table utero_academy.%I enable row level security', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_select', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_own_write', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_staff_write', t);

    -- lesson_comments sengaja terbaca seluruh user login: komentar pelajaran
    -- adalah diskusi, bukan catatan privat. lesson_bookmarks dan
    -- announcement_reads privat — ikut pola yang sama karena keduanya tidak
    -- memuat data sensitif dan menyeragamkan predikat mengurangi risiko salah
    -- tulis; yang dijaga ketat adalah sisi TULIS.
    execute format(
      'create policy %I on utero_academy.%I for select to authenticated '
      'using (user_id = auth.uid() or %s)',
      t || '_select', t, staf);

    execute format(
      'create policy %I on utero_academy.%I for all to authenticated '
      'using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own_write', t);

    -- Staf boleh menghapus komentar yang tidak pantas.
    execute format(
      'create policy %I on utero_academy.%I for all to authenticated '
      'using (%s) with check (%s)',
      t || '_staff_write', t, staf, staf);
  end loop;

  -- (b) Milik user, BACA SAJA. Ditulis sistem lewat service role.
  foreach t in array array[
    'user_badges', 'user_points', 'point_transactions',
    'learning_sessions', 'daily_activity', 'user_streaks'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'utero_academy' and c.relname = t and c.relkind = 'r'
    ) then
      raise notice 'Tabel tidak ditemukan, dilewati: %', t;
      continue;
    end if;

    execute format('alter table utero_academy.%I enable row level security', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_select', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_staff_write', t);

    execute format(
      'create policy %I on utero_academy.%I for select to authenticated '
      'using (user_id = auth.uid() or %s)',
      t || '_select', t, staf);

    execute format(
      'create policy %I on utero_academy.%I for all to authenticated '
      'using (%s) with check (%s)',
      t || '_staff_write', t, staf, staf);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- badges
--
-- Katalog lencana: definisi, bukan data pribadi. Terbaca seluruh user login
-- supaya peserta tahu lencana apa yang bisa dicapai; ditulis hanya staf.
alter table utero_academy.badges enable row level security;
drop policy if exists badges_select on utero_academy.badges;
drop policy if exists badges_staff_write on utero_academy.badges;

create policy badges_select on utero_academy.badges
for select to authenticated
using (true);

create policy badges_staff_write on utero_academy.badges
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- course_announcements
--
-- Pengumuman kursus. Peserta membaca yang terbit; penulis dan staf melihat
-- semuanya. author_id merujuk auth.users langsung (0024:11).
alter table utero_academy.course_announcements enable row level security;
drop policy if exists course_announcements_select on utero_academy.course_announcements;
drop policy if exists course_announcements_staff_write on utero_academy.course_announcements;

create policy course_announcements_select on utero_academy.course_announcements
for select to authenticated
using (
  is_published is not false
  or author_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

create policy course_announcements_staff_write on utero_academy.course_announcements
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);
