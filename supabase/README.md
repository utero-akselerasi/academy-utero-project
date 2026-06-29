# Setup Supabase

Folder ini berisi rancangan awal database dan seed untuk Utero Academy Platform.

## File

- `migrations/0001_initial_schema.sql`: membuat schema `utero_academy`, enum, tabel, trigger, index, dan mengaktifkan RLS.
- `migrations/0002_sprint1_access_policies.sql`: grant dan policy RLS untuk pendaftaran publik dan review admin Sprint 1.
- `migrations/0003_super_admin_user_management.sql`: grant dan policy RLS untuk Super Admin mengelola user profile dan assignment role.
- `seed/0001_rbac_seed.sql`: mengisi data awal role, permission, dan relasi role-permission. File ini tidak membuat tabel.
- `seed/0002_storage_buckets.sql`: mengisi bucket awal di schema bawaan Supabase `storage`.

## Urutan Eksekusi

1. Jalankan migration.
2. Jalankan seed RBAC.
3. Jalankan seed storage bucket.
4. Buat user Super Admin pertama di Supabase Auth.
5. Tambahkan profil user dan assignment role `super_admin` untuk user tersebut.
6. Setelah Super Admin bisa login, kelola assignment role berikutnya dari dashboard `/dashboard/super-admin/users`.

## Catatan Schema

- Semua tabel aplikasi berada di schema `utero_academy`.
- Schema bawaan Supabase tetap digunakan sesuai fungsinya, misalnya `auth.users` dan `storage.buckets`.
- Jika memakai Supabase Studio atau Supabase hosted, pastikan schema `utero_academy` ditambahkan ke exposed schemas API.
- Tabel sensitif sudah disiapkan dengan Row Level Security aktif.
- Policy RLS belum difinalisasi pada tahap ini karena perlu mengikuti pola akses aplikasi yang akan dibangun.
- Schema awal ini cukup luas untuk memandu implementasi, tetapi tetap perlu direview lagi sebelum production.
