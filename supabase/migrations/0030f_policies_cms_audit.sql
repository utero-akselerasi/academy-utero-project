-- Policy RLS domain CMS/konten publik, audit, dan katalog permission.
--
-- Tabel: cms_sites, cms_pages, cms_sections, cms_navigation_items,
-- article_categories, articles, faqs, galleries, testimonials,
-- landing_page_settings, audit_logs, permissions, role_permissions.
--
-- Bersama 0030a-e, berkas ini melengkapi postur eksplisit untuk seluruh 62
-- tabel utero_academy (K-3). Tidak ada tabel yang dibiarkan "RLS aktif tanpa
-- policy" sebagai keadaan akhir — kalau maksudnya menolak semua, itu ditulis
-- eksplisit di komentar tabelnya.
--
-- Seluruh titik baca/tulis memakai service role (features/cms/*,
-- features/super-admin/*). Policy di sini lapis kedua.

-- ---------------------------------------------------------------------------
-- Konten publik: cms_sites, cms_pages, cms_sections, cms_navigation_items,
-- article_categories, articles, faqs, galleries, testimonials,
-- landing_page_settings.
--
-- KEPUTUSAN: TIDAK ADA policy untuk anon, meski isinya konten publik.
-- Halaman publik (app/(public)/*) membacanya lewat service role di server
-- component; tidak satu pun klien browser bicara ke PostgREST (nol
-- createBrowserClient di repo). Memberi anon SELECT berarti membuka draft —
-- status 'draft' di articles/faqs/galleries/testimonials/cms_pages adalah
-- konten yang BELUM boleh dilihat publik, dan memfilter status di policy anon
-- tidak menutup landing_page_settings/cms_sites yang tidak punya kolom status.
-- Lebih sederhana dan lebih aman: anon tidak membaca apa pun langsung dari DB.
-- Grant anon-nya dicabut 0031 (termasuk 0009:15 landing_page_settings).
--
-- Untuk user login: baca semua (staf CMS perlu melihat draft; user lain tidak
-- dirugikan oleh konten yang toh akan terbit), tulis hanya staf ("Mengelola
-- konten CMS" dan "Publish konten CMS" = admin Ya di matriks). Kalau suatu
-- saat draft dianggap rahasia dari peserta, tambah filter status di
-- {t}_select untuk tabel yang punya kolomnya.
do $$
declare
  t text;
  staf constant text :=
    'utero_academy.current_user_has_role(''admin'') '
    'or utero_academy.current_user_has_role(''super_admin'')';
begin
  foreach t in array array[
    'cms_sites', 'cms_pages', 'cms_sections', 'cms_navigation_items',
    'article_categories', 'articles', 'faqs', 'galleries', 'testimonials',
    'landing_page_settings'
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
      'create policy %I on utero_academy.%I for select to authenticated using (true)',
      t || '_select', t);

    execute format(
      'create policy %I on utero_academy.%I for all to authenticated '
      'using (%s) with check (%s)',
      t || '_staff_write', t, staf, staf);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- audit_logs
--
-- Jejak audit aksi super admin. Ditulis HANYA lewat service role
-- (features/super-admin/audit.ts:13 writeAuditLog); dibaca lewat service role
-- (audit.ts:32 getAuditLogs) setelah guard super_admin di aplikasi.
--
-- Tidak ada policy INSERT/UPDATE/DELETE untuk siapa pun lewat klien sesi —
-- jejak audit yang bisa ditulis atau dihapus oleh subjek yang diaudit bukan
-- jejak audit. Jangan pernah menambahkan policy tulis di sini; kalau penulisan
-- audit harus pindah dari service role, bentuk yang benar adalah fungsi
-- SECURITY DEFINER yang hanya INSERT, bukan policy.
--
-- SELECT dibatasi super_admin (permission audit_logs.read di seed RBAC),
-- BUKAN admin: admin adalah salah satu aktor yang diaudit.
alter table utero_academy.audit_logs enable row level security;

drop policy if exists audit_logs_super_admin_select on utero_academy.audit_logs;

create policy audit_logs_super_admin_select on utero_academy.audit_logs
for select to authenticated
using (utero_academy.current_user_has_role('super_admin'));

-- ---------------------------------------------------------------------------
-- permissions, role_permissions
--
-- 0003:61-72 sudah memasang policy select super_admin yang benar untuk
-- keduanya (dengan klausa `to authenticated`). Ditegaskan ulang di sini dengan
-- nama baru agar berkas 0030* berdiri sendiri, dan nama lama di-drop supaya
-- tidak ada dua policy identik hidup berdampingan.
--
-- Hanya SELECT, hanya super_admin: katalog permission dan pemetaannya ke role
-- adalah definisi otorisasi — mengubahnya lewat klien sesi berarti mengubah
-- hak akses. Penulisan hanya lewat seed dan migrasi (0028) sebagai service role.
--
-- current_user_has_role() (0002:8-22) membaca user_roles + roles, BUKAN
-- role_permissions, jadi membatasi tabel ini tidak mematahkan resolusi peran.
alter table utero_academy.permissions enable row level security;
alter table utero_academy.role_permissions enable row level security;

drop policy if exists "permission dapat dibaca super admin" on utero_academy.permissions;
drop policy if exists permissions_super_admin_select on utero_academy.permissions;

create policy permissions_super_admin_select on utero_academy.permissions
for select to authenticated
using (utero_academy.current_user_has_role('super_admin'));

drop policy if exists "role permission dapat dibaca super admin" on utero_academy.role_permissions;
drop policy if exists role_permissions_super_admin_select on utero_academy.role_permissions;

create policy role_permissions_super_admin_select on utero_academy.role_permissions
for select to authenticated
using (utero_academy.current_user_has_role('super_admin'));
