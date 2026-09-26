-- Policy RLS domain task board: task_boards, task_lists, task_cards,
-- task_checklists, task_subtasks, task_comments, task_attachments.
--
-- Seluruh titik baca/tulis memakai service role (features/tasks/queries.ts:1
-- mengimpor HANYA createUteroAcademyServiceRoleClient; 19 titik di actions.ts
-- juga). Policy di sini lapis kedua — dan lapis kedua inilah yang menentukan apa
-- yang dilihat kunci anon publik yang bicara langsung ke PostgREST.
--
-- YANG PALING PENTING DI BERKAS INI: mencabut pasangan policy 0004:25-36 pada
-- task_subtasks. Keduanya `using (true)` untuk `authenticated`, satu FOR SELECT
-- dan satu FOR ALL — artinya setiap user login bisa membaca, mengubah, dan
-- menghapus subtask siapa pun. Komentar 0004:24 mengakuinya sendiri: "karena
-- bypass server-side service role client aktif, kita pasang policy dasar true
-- agar sinkron". Postgres meng-OR policy permissive, jadi satu nama yang salah
-- tebak berarti lubang itu tetap hidup di samping policy baru. Nama diambil
-- verbatim dari 0004.
--
-- Matriks (docs/05-rbac-permission-matrix.md:24-25):
--   "Mengelola task board & card" : admin Ya, sekolah Baca, peserta Sesuai scope
--   "Submit progress task"        : admin TIDAK, peserta Ya
--
-- Diterjemahkan: staf menyusun board/list/card; peserta TIDAK boleh membuat atau
-- memindahkan card, tapi boleh mengerjakan progres pada card yang ditugaskan
-- kepadanya (checklist, subtask, lampiran, komentar) — persis yang dirender
-- app/dashboard/intern/tasks/page.tsx.
--
-- RANTAI KEPEMILIKAN. task_cards adalah satu-satunya tabel di domain ini yang
-- punya kolom peserta; enam tabel lain menurunkannya:
--
--   task_boards  <- task_lists.board_id <- task_cards.list_id
--   task_cards.intern_id -> intern_profiles.user_id
--   task_checklists / task_subtasks / task_comments / task_attachments
--     .card_id -> task_cards
--
-- CATATAN OTORISASI (keputusan C-2). task_cards.mentor_id -> mentor_profiles
-- SENGAJA TIDAK dipakai sebagai cabang predikat. Baris mentor_profiles bukan
-- bukti otorisasi; memberi akses berdasarkan keberadaannya akan mengubah baris
-- data domain menjadi pemberian hak. Pembimbing lolos lewat perannya sendiri
-- (admin), bukan lewat profilnya.
--
-- task_cards.intern_id NULLABLE (0001:344). Kesamaan lewat join otomatis gagal
-- untuk card yang belum ditugaskan — card itu hanya terlihat oleh staf, dan itu
-- benar: card yang belum punya penerima bukan milik siapa pun.

-- ---------------------------------------------------------------------------
-- task_subtasks — dahulukan, karena inilah lubang yang dicabut.
--
-- 0004:19 sudah mengaktifkan RLS dan 0004:22 memberi grant
-- SELECT/INSERT/UPDATE/DELETE ke `authenticated`. Grant itu dicabut 0031;
-- policy longgarnya dicabut di sini.
alter table utero_academy.task_subtasks enable row level security;

drop policy if exists "task_subtasks dapat dibaca user login" on utero_academy.task_subtasks;
drop policy if exists "task_subtasks dapat dimanipulasi user login" on utero_academy.task_subtasks;
drop policy if exists task_subtasks_select on utero_academy.task_subtasks;
drop policy if exists task_subtasks_intern_progress on utero_academy.task_subtasks;
drop policy if exists task_subtasks_staff_write on utero_academy.task_subtasks;

create policy task_subtasks_select on utero_academy.task_subtasks
for select to authenticated
using (
  exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tc.id = task_subtasks.card_id
      and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where tc.id = task_subtasks.card_id
      and sc.user_id = auth.uid()
  )
);

-- "Submit progress task" = peserta Ya. Subtask adalah bentuk progres itu:
-- createSubtaskAction / toggleSubtaskAction / deleteSubtaskAction
-- (actions.ts:500, :542, :574) dipanggil dari halaman peserta. FOR ALL dibatasi
-- rantai kepemilikan card — peserta tidak bisa menyentuh subtask card orang lain.
create policy task_subtasks_intern_progress on utero_academy.task_subtasks
for all to authenticated
using (
  exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tc.id = task_subtasks.card_id
      and ip.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tc.id = task_subtasks.card_id
      and ip.user_id = auth.uid()
  )
);

create policy task_subtasks_staff_write on utero_academy.task_subtasks
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
-- task_boards dan task_lists
--
-- Struktur, bukan progres. Ditulis staf saja ("Mengelola task board & card" =
-- admin Ya, peserta hanya "Sesuai scope" untuk melihat). Peserta melihat board
-- dan list yang memuat card miliknya; sekolah melihat yang memuat card peserta
-- sekolahnya ("Baca").
--
-- task_boards.owner_id (0001:327) merujuk auth.users langsung dan ikut jadi
-- cabang select: pemilik board melihat board-nya meski belum ada card di
-- dalamnya. Itu bukan pemberian hak tulis — cabangnya hanya ada di SELECT.
alter table utero_academy.task_boards enable row level security;

drop policy if exists task_boards_select on utero_academy.task_boards;
drop policy if exists task_boards_staff_write on utero_academy.task_boards;

create policy task_boards_select on utero_academy.task_boards
for select to authenticated
using (
  owner_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.task_lists tl
    join utero_academy.task_cards tc on tc.list_id = tl.id
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tl.board_id = task_boards.id
      and ip.user_id = auth.uid()
  )
  or exists (
    select 1
    from utero_academy.task_lists tl
    join utero_academy.task_cards tc on tc.list_id = tl.id
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where tl.board_id = task_boards.id
      and sc.user_id = auth.uid()
  )
);

create policy task_boards_staff_write on utero_academy.task_boards
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

alter table utero_academy.task_lists enable row level security;

drop policy if exists task_lists_select on utero_academy.task_lists;
drop policy if exists task_lists_staff_write on utero_academy.task_lists;

create policy task_lists_select on utero_academy.task_lists
for select to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tc.list_id = task_lists.id
      and ip.user_id = auth.uid()
  )
  or exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where tc.list_id = task_lists.id
      and sc.user_id = auth.uid()
  )
);

create policy task_lists_staff_write on utero_academy.task_lists
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
-- task_cards
--
-- Peserta MEMBACA card yang ditugaskan kepadanya, tapi tidak menulis apa pun di
-- baris card. Membuat, memindahkan (moveCardAction, actions.ts:626), menugaskan
-- (assignCardToInternAction, :409), mengubah prioritas (:593) dan menghapus
-- (:384) semuanya milik staf — matriks menempatkan "Mengelola task board &
-- card" di admin, dan "Submit progress task" yang jadi hak peserta diwujudkan
-- lewat tabel anak, bukan lewat kolom card.
--
-- created_by (0001:350) TIDAK dipakai sebagai cabang: card dibuat lewat service
-- role, jadi nilainya bukan penanda kepemilikan yang bisa dipercaya untuk
-- membuka akses.
alter table utero_academy.task_cards enable row level security;

drop policy if exists task_cards_select on utero_academy.task_cards;
drop policy if exists task_cards_staff_write on utero_academy.task_cards;

create policy task_cards_select on utero_academy.task_cards
for select to authenticated
using (
  exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = task_cards.intern_id
      and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.intern_profiles ip
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where ip.id = task_cards.intern_id
      and sc.user_id = auth.uid()
  )
);

create policy task_cards_staff_write on utero_academy.task_cards
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
-- Tabel anak card: task_checklists, task_attachments.
--
-- Pola kepemilikannya identik dengan task_subtasks — diturunkan lewat card_id —
-- jadi disapu lewat loop supaya ketiganya tidak bisa menyimpang satu dari yang
-- lain. task_comments ditangani terpisah karena punya author_id sendiri.
--
-- task_checklists: addChecklistAction (:228), toggleChecklistAction (:269),
-- deleteChecklistItemAction (:476) — ketiganya dirender di halaman peserta.
-- task_attachments: addTaskAttachmentAction (:301). Tidak ada aksi penghapusan
-- lampiran di aplikasi, tapi FOR ALL tetap dipakai agar peserta bisa membatalkan
-- unggahannya kalau aksi itu ditambahkan — dibatasi rantai card yang sama.
do $$
declare
  t text;
  milik text;
  scope text;
  staf constant text :=
    'utero_academy.current_user_has_role(''admin'') '
    'or utero_academy.current_user_has_role(''super_admin'')';
begin
  foreach t in array array['task_checklists', 'task_attachments']
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
      'exists (select 1 from utero_academy.task_cards tc '
      'join utero_academy.intern_profiles ip on ip.id = tc.intern_id '
      'where tc.id = %I.card_id and ip.user_id = auth.uid())', t);
    scope := format(
      'exists (select 1 from utero_academy.task_cards tc '
      'join utero_academy.intern_profiles ip on ip.id = tc.intern_id '
      'join utero_academy.school_contacts sc on sc.school_id = ip.school_id '
      'where tc.id = %I.card_id and sc.user_id = auth.uid())', t);

    execute format('alter table utero_academy.%I enable row level security', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_select', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_intern_progress', t);
    execute format('drop policy if exists %I on utero_academy.%I', t || '_staff_write', t);

    execute format(
      'create policy %I on utero_academy.%I for select to authenticated '
      'using (%s or %s or %s)',
      t || '_select', t, milik, staf, scope);

    execute format(
      'create policy %I on utero_academy.%I for all to authenticated '
      'using (%s) with check (%s)',
      t || '_intern_progress', t, milik, milik);

    execute format(
      'create policy %I on utero_academy.%I for all to authenticated '
      'using (%s) with check (%s)',
      t || '_staff_write', t, staf, staf);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- task_comments
--
-- Punya author_id -> auth.users (0001:368), jadi kepemilikan tulisnya melekat
-- pada penulis komentar, bukan pada card. Dua predikat berbeda dan keduanya
-- dibutuhkan:
--
--   BACA  : diturunkan dari card — diskusi pada card adalah konteks bersama
--           antara peserta yang ditugaskan dan pembimbingnya.
--   TULIS : author_id = auth.uid() DAN card itu miliknya. Syarat pertama saja
--           tidak cukup: tanpa syarat kedua, peserta bisa menulis komentar
--           bernama dirinya di card peserta lain.
--
-- Staf boleh menghapus komentar yang tidak pantas (moderasi), seperti
-- lesson_comments di 0030d.
alter table utero_academy.task_comments enable row level security;

drop policy if exists task_comments_select on utero_academy.task_comments;
drop policy if exists task_comments_own_write on utero_academy.task_comments;
drop policy if exists task_comments_staff_write on utero_academy.task_comments;

create policy task_comments_select on utero_academy.task_comments
for select to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tc.id = task_comments.card_id
      and ip.user_id = auth.uid()
  )
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    join utero_academy.school_contacts sc on sc.school_id = ip.school_id
    where tc.id = task_comments.card_id
      and sc.user_id = auth.uid()
  )
);

create policy task_comments_own_write on utero_academy.task_comments
for all to authenticated
using (
  author_id = auth.uid()
  and exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tc.id = task_comments.card_id
      and ip.user_id = auth.uid()
  )
)
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from utero_academy.task_cards tc
    join utero_academy.intern_profiles ip on ip.id = tc.intern_id
    where tc.id = task_comments.card_id
      and ip.user_id = auth.uid()
  )
);

create policy task_comments_staff_write on utero_academy.task_comments
for all to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);
