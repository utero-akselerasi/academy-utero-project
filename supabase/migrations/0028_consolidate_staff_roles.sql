-- Konsolidasi peran staf: admin = administrator sekaligus pembimbing.
--
-- Keputusan produk: role `mentor` ditiadakan sebagai peran login, dan
-- `admin_academy` digabung ke `admin`. docs/05-rbac-permission-matrix.md sudah
-- mendefinisikan hanya empat peran (admin, school, intern, visitor), jadi migrasi
-- ini memulihkan maksud yang sudah terdokumentasi, bukan mengubah desain.
--
-- TIDAK ADA baris yang dihapus di berkas ini. Khususnya: `roles` tidak pernah
-- di-DELETE, karena FK utero_academy.user_roles.role_id memakai ON DELETE CASCADE
-- (0001_initial_schema.sql:103) — menghapus satu baris role akan menghapus senyap
-- seluruh riwayat assignment yang merujuknya, begitu juga role_permissions.
--
-- Entitas domain tetap bernama mentor_profiles / mentor_assignments / mentor_id.
-- Nama-nama itu menggambarkan peran pembimbingan, bukan peran otorisasi, dan
-- baris mentor_profiles bukan bukti otorisasi — otorisasi hanya dari user_roles.
--
-- Idempoten dan tahan-penyimpangan: seluruh berkas aman dijalankan berulang, dan
-- tidak mengasumsikan supabase/seed/0001_rbac_seed.sql pernah dijalankan.

-- (1) Pastikan role `admin` ada.
--
-- Role ini TIDAK PERNAH di-seed: supabase/seed/0001_rbac_seed.sql hanya membuat
-- super_admin, admin_academy, mentor, school, intern, visitor. Padahal
-- features/auth/guards.ts dan policy di 0006/0016 bergantung pada kode 'admin'.
-- Baris itu tampaknya dibuat manual di produksi, jadi di sini dibuat eksplisit.
insert into utero_academy.roles (code, name, description)
values ('admin', 'Admin', 'Administrator sistem sekaligus pembimbing magang')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

-- (2) Beri `admin` gabungan permission admin_academy dan mentor.
--
-- Diturunkan dari baris yang benar-benar hidup di database, bukan di-hardcode:
-- kalau produksi sudah menyimpang dari seed, yang diikuti adalah keadaan nyata.
-- Tidak ada satu pun role_permissions untuk 'admin' sebelum ini.
--
-- `on conflict do nothing` tanpa daftar kolom: mencakup SEMUA unique constraint
-- tabel, jadi tidak bergantung pada nama constraint tertentu.
--
-- Catatan cakupan: tabel role_permissions tidak pernah dibaca oleh kode
-- aplikasi maupun oleh policy RLS mana pun — otorisasi seluruhnya berbasis kode
-- role lewat features/auth/guards.ts dan utero_academy.current_user_has_role().
-- Jadi langkah ini menjaga konsistensi data RBAC, bukan memberi akses. Akses
-- `admin` datang dari langkah (3) dan dari guard di aplikasi.
insert into utero_academy.role_permissions (role_id, permission_id)
select target.id, rp.permission_id
from utero_academy.role_permissions rp
join utero_academy.roles legacy on legacy.id = rp.role_id
cross join (select id from utero_academy.roles where code = 'admin') target
where legacy.code in ('admin_academy', 'mentor')
on conflict do nothing;

-- (3) Pindahkan assignment legacy menjadi assignment `admin`.
--
-- INSERT, bukan UPDATE. Alasannya ada dua, keduanya menyebabkan 23505:
--
--   a. `update user_roles set role_id = <admin>` bertabrakan dengan
--      idx_user_roles_global_unique (0001:589-591) untuk user yang sudah punya
--      'admin', dan bertabrakan antar-baris untuk user yang punya 'mentor' DAN
--      'admin_academy' sekaligus. UPDATE tidak punya klausa ON CONFLICT.
--
--   b. `on conflict (user_id, role_id, scope_type, scope_id)` TIDAK menyentuh
--      kedua partial unique index di 0001:589-595 — PostgreSQL mencocokkan
--      inference ke index yang kolom DAN predikatnya cocok. Constraint tabelnya
--      sendiri NULLS DISTINCT, jadi ia juga tidak menghalangi duplikat global.
--      `on conflict do nothing` tanpa inference mencakup semua-duanya.
--
-- Baris legacy dibiarkan utuh. Itu aman karena rolePriority di
-- features/auth/roles.ts:5 berfungsi sebagai allowlist di :45 — kode yang tidak
-- ada di union RoleCode disaring keluar dari setiap guard, jadi baris legacy
-- menjadi inert tanpa perlu dihapus.
insert into utero_academy.user_roles (user_id, role_id, scope_type, scope_id)
select ur.user_id, target.id, ur.scope_type, ur.scope_id
from utero_academy.user_roles ur
join utero_academy.roles legacy on legacy.id = ur.role_id
cross join (select id from utero_academy.roles where code = 'admin') target
where legacy.code in ('admin_academy', 'mentor')
on conflict do nothing;

-- (4) Jadikan role legacy tidak bisa dipilih lagi, tanpa menghapusnya.
--
-- Tabel roles tidak punya kolom penanda aktif/assignable (0001:76-83, tidak
-- pernah di-ALTER), jadi ditambahkan di sini. features/super-admin/queries.ts:14
-- membaca tabel roles tanpa filter, sehingga setiap baris yang tersisa tetap
-- ditawarkan di dropdown super-admin; kolom ini yang menutupnya.
alter table utero_academy.roles
  add column if not exists is_assignable boolean not null default true;

comment on column utero_academy.roles.is_assignable is
  'false untuk peran yang dipertahankan demi riwayat tapi tidak boleh ditawarkan '
  'saat menetapkan peran. Riwayat assignment sengaja tidak dihapus.';

update utero_academy.roles
   set is_assignable = false, updated_at = now()
 where code in ('admin_academy', 'mentor')
   and is_assignable is distinct from false;

update utero_academy.roles
   set is_assignable = true, updated_at = now()
 where code in ('super_admin', 'admin', 'school', 'intern')
   and is_assignable is distinct from true;

-- 'visitor' sengaja tidak disentuh: ia bukan peran login (pendaftar publik tidak
-- punya akun), jadi nilai default-nya dibiarkan apa adanya sampai inventaris
-- produksi memastikan ada/tidaknya assignment yang merujuknya.
