-- Policy RLS domain identitas: user_profiles, intern_profiles, mentor_profiles,
-- user_roles, roles, mentor_assignments, internship_applications.
--
-- Ketujuh tabel ini adalah SELURUH tabel yang disentuh klien sesi
-- (createUteroAcademyClient) selain domain absensi (0030b). Keduanya harus
-- terpasang dan terbukti benar SEBELUM 0031 mencabut grant selimut — grant dan
-- RLS adalah dua gerbang independen, dan tabel dengan RLS aktif tanpa policy
-- menolak semua baris.
--
-- Pemetaan role mengikuti docs/05-rbac-permission-matrix.md pasca-konsolidasi
-- 0028: staf = admin + super_admin (kode 'admin_academy' dan 'mentor' sudah
-- tidak assignable dan disaring keluar oleh rolePriority di aplikasi).
--
-- Gaya mengikuti 0016_school_portal_reports.sql: drop policy if exists dengan
-- NAMA PERSIS yang pernah dibuat migrasi terdahulu sebelum setiap create.
-- Postgres meng-OR policy permissive — satu drop yang terlewat berarti policy
-- longgar lama tetap hidup di samping yang baru.
--
-- Predikat kepemilikan:
--   milik sendiri (profil)  : user_id = auth.uid()  atau id = auth.uid()
--   staf                    : utero_academy.current_user_has_role('admin')
--                             or utero_academy.current_user_has_role('super_admin')
--   scope sekolah           : exists (... school_contacts sc
--                             where sc.user_id = auth.uid() and sc.school_id = <t>.school_id)

-- ---------------------------------------------------------------------------
-- user_profiles
--
-- Titik klien sesi: ProtectedDashboardLayout.tsx:82 (select milik sendiri),
-- app/dashboard/profile/page.tsx:11 (select milik sendiri),
-- edit-profile-action.ts:51 (update milik sendiri).
--
-- Policy 0027 "super admin dapat mengelola user_profiles" adalah FOR ALL dengan
-- using (id = auth.uid() or super_admin) — artinya setiap user login bisa
-- MENGHAPUS baris profilnya sendiri. Itu terlalu longgar: baris user_profiles
-- adalah jangkar FK banyak tabel. Dipecah jadi select/update/insert eksplisit,
-- DELETE hanya super_admin.
alter table utero_academy.user_profiles enable row level security;

drop policy if exists "user dapat membaca profil sendiri" on utero_academy.user_profiles;
drop policy if exists "super admin dapat membaca semua profil" on utero_academy.user_profiles;
drop policy if exists "super admin dapat membuat profil" on utero_academy.user_profiles;
drop policy if exists "super admin dapat update profil" on utero_academy.user_profiles;
drop policy if exists "admin dapat mengelola user_profiles" on utero_academy.user_profiles;
drop policy if exists "super admin dapat mengelola user_profiles" on utero_academy.user_profiles;
drop policy if exists user_profiles_select on utero_academy.user_profiles;
drop policy if exists user_profiles_update_own on utero_academy.user_profiles;
drop policy if exists user_profiles_admin_write on utero_academy.user_profiles;

create policy user_profiles_select on utero_academy.user_profiles
for select to authenticated
using (
  id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

create policy user_profiles_update_own on utero_academy.user_profiles
for update to authenticated
using (id = auth.uid() or utero_academy.current_user_has_role('super_admin'))
with check (id = auth.uid() or utero_academy.current_user_has_role('super_admin'));

-- INSERT dan DELETE hanya super_admin. Pembuatan akun berjalan lewat service
-- role (features/super-admin/actions.ts), jadi policy ini cadangan defensif,
-- bukan jalur yang dipakai aplikasi.
create policy user_profiles_admin_write on utero_academy.user_profiles
for all to authenticated
using (utero_academy.current_user_has_role('super_admin'))
with check (utero_academy.current_user_has_role('super_admin'));

-- ---------------------------------------------------------------------------
-- intern_profiles
--
-- Titik klien sesi: profile/page.tsx:16 (select milik sendiri),
-- edit-profile-action.ts:60 (update milik sendiri),
-- attendance/queries.ts:44 (sumber tersemat intern_profiles(id, full_name)
-- pada select attendances oleh staf).
--
-- PERHATIAN: user_id di tabel ini NULLABLE. Predikat memakai kesamaan langsung
-- (user_id = auth.uid()), yang otomatis false untuk baris ber-user_id null —
-- baris yatim hanya terlihat oleh staf dan scope sekolah.
alter table utero_academy.intern_profiles enable row level security;

drop policy if exists intern_profiles_select on utero_academy.intern_profiles;
drop policy if exists intern_profiles_update on utero_academy.intern_profiles;

create policy intern_profiles_select on utero_academy.intern_profiles
for select to authenticated
using (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  or exists (
    select 1
    from utero_academy.school_contacts sc
    where sc.user_id = auth.uid()
      and sc.school_id = intern_profiles.school_id
  )
);

create policy intern_profiles_update on utero_academy.intern_profiles
for update to authenticated
using (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- Tanpa policy INSERT/DELETE: pembuatan dan penghapusan profil peserta berjalan
-- lewat service role, dan peserta tidak boleh membuat/menghapus profilnya.

-- ---------------------------------------------------------------------------
-- mentor_profiles
--
-- Titik klien sesi: profile/page.tsx:21 (select milik sendiri),
-- edit-profile-action.ts:66 (update headline/bio milik sendiri).
-- Baris mentor_profiles BUKAN bukti otorisasi (keputusan C-2) — policy ini
-- murni akses data, bukan gerbang peran.
alter table utero_academy.mentor_profiles enable row level security;

drop policy if exists mentor_profiles_select on utero_academy.mentor_profiles;
drop policy if exists mentor_profiles_update on utero_academy.mentor_profiles;

create policy mentor_profiles_select on utero_academy.mentor_profiles
for select to authenticated
using (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

create policy mentor_profiles_update on utero_academy.mentor_profiles
for update to authenticated
using (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  user_id = auth.uid()
  or utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- ---------------------------------------------------------------------------
-- user_roles
--
-- Pasangan policy 0027 sudah benar dan dipertahankan (select: milik sendiri
-- atau super_admin; all: super_admin). Yang dibersihkan adalah policy 0002/0003
-- yang tumpang tindih — 0027 sudah men-drop varian "admin dapat ...", tapi
-- membiarkan trio 0003 hidup berdampingan.
drop policy if exists "user dapat membaca role sendiri" on utero_academy.user_roles;
drop policy if exists "super admin dapat membaca semua user role" on utero_academy.user_roles;
drop policy if exists "super admin dapat assign role" on utero_academy.user_roles;
drop policy if exists "super admin dapat hapus role user" on utero_academy.user_roles;

-- Ditegaskan ulang persis seperti 0027, supaya berkas ini berdiri sendiri
-- terhadap penyimpangan produksi (idempoten terhadap 0027 yang sudah/belum
-- pernah jalan).
drop policy if exists "super admin dapat membaca user_roles" on utero_academy.user_roles;
drop policy if exists "super admin dapat mengelola user_roles" on utero_academy.user_roles;

create policy "super admin dapat membaca user_roles"
on utero_academy.user_roles
for select
to authenticated
using (user_id = auth.uid() or utero_academy.current_user_has_role('super_admin'));

create policy "super admin dapat mengelola user_roles"
on utero_academy.user_roles
for all
to authenticated
using (utero_academy.current_user_has_role('super_admin'))
with check (utero_academy.current_user_has_role('super_admin'));

-- ---------------------------------------------------------------------------
-- roles
--
-- Katalog peran: tidak sensitif, dan dibutuhkan sebagai sumber tersemat
-- roles(code, name) di profile/page.tsx:28 — join PostgREST tidak bisa
-- di-resolve tanpanya. Dibaca-saja untuk authenticated; penulisan hanya lewat
-- service role (seed dan 0028).
alter table utero_academy.roles enable row level security;

drop policy if exists "roles dapat dibaca user login" on utero_academy.roles;
drop policy if exists roles_select on utero_academy.roles;

create policy roles_select on utero_academy.roles
for select to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- mentor_assignments
--
-- Titik klien sesi: attendance/queries.ts:33 (staf membaca penugasan
-- berdasarkan mentor_id miliknya), admin/actions.ts:67 (insert), :92 (delete).
alter table utero_academy.mentor_assignments enable row level security;

drop policy if exists mentor_assignments_select on utero_academy.mentor_assignments;
drop policy if exists mentor_assignments_staff_write on utero_academy.mentor_assignments;

create policy mentor_assignments_select on utero_academy.mentor_assignments
for select to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  -- pembimbing melihat penugasannya sendiri; peserta melihat penugasan yang
  -- menunjuk dirinya
  or exists (
    select 1 from utero_academy.mentor_profiles mp
    where mp.id = mentor_assignments.mentor_id
      and mp.user_id = auth.uid()
  )
  or exists (
    select 1 from utero_academy.intern_profiles ip
    where ip.id = mentor_assignments.intern_id
      and ip.user_id = auth.uid()
  )
);

-- INSERT dan DELETE hanya staf. UPDATE tidak diberi sama sekali — aplikasi
-- menghapus lalu membuat ulang, tidak pernah mengubah baris penugasan.
create policy mentor_assignments_staff_write on utero_academy.mentor_assignments
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
-- internship_applications
--
-- Dua jalur sah: formulir pendaftaran publik (anon INSERT, 0002:41) dan review
-- oleh staf (admin/actions.ts:39, klien sesi).
alter table utero_academy.internship_applications enable row level security;

drop policy if exists "visitor dapat submit pendaftaran" on utero_academy.internship_applications;
drop policy if exists "admin dapat membaca semua pendaftaran" on utero_academy.internship_applications;
drop policy if exists "admin dapat update status pendaftaran" on utero_academy.internship_applications;
drop policy if exists internship_applications_public_insert on utero_academy.internship_applications;
drop policy if exists internship_applications_staff_select on utero_academy.internship_applications;
drop policy if exists internship_applications_staff_update on utero_academy.internship_applications;

-- Pendaftar belum punya akun, jadi INSERT memang harus anon. Tanpa SELECT:
-- pendaftar tidak bisa membaca kembali lamaran siapa pun (grant anon di 0031
-- juga hanya INSERT).
create policy internship_applications_public_insert on utero_academy.internship_applications
for insert to anon, authenticated
with check (true);

create policy internship_applications_staff_select on utero_academy.internship_applications
for select to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
  -- portal sekolah membaca lamaran yang menunjuk sekolahnya
  or exists (
    select 1 from utero_academy.school_contacts sc
    where sc.user_id = auth.uid()
      and sc.school_id = internship_applications.school_id
  )
);

create policy internship_applications_staff_update on utero_academy.internship_applications
for update to authenticated
using (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
)
with check (
  utero_academy.current_user_has_role('admin')
  or utero_academy.current_user_has_role('super_admin')
);

-- Tanpa policy DELETE: lamaran tidak dihapus oleh siapa pun lewat klien sesi.
