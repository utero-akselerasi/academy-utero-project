# Standar Coding

## Umum

- Gunakan TypeScript untuk seluruh kode aplikasi.
- Simpan kode spesifik fitur di `features/*`.
- Simpan UI primitive bersama di `components/ui`.
- Simpan helper server-only di `lib/*`.
- Gunakan nama yang eksplisit.
- Validasi semua input eksternal sebelum menulis ke database.

## TypeScript

- Gunakan strict TypeScript.
- Hindari `any` kecuali untuk membungkus API pihak ketiga yang belum punya type.
- Gunakan discriminated union untuk workflow status jika relevan.
- Simpan type domain bersama di `types/`.
- Simpan type spesifik fitur di `features/*/types`.

## React dan Next.js

- Gunakan Server Components secara default.
- Gunakan Client Components hanya untuk interaktivitas.
- Gunakan Server Actions atau Route Handlers untuk mutation.
- Kelompokkan route dashboard berdasarkan role.
- Jangan hanya mengandalkan authorization di UI. Authorization harus ditegakkan di server code dan database policy.

## Database

- Semua tabel aplikasi berada di schema `utero_academy`.
- Schema bawaan Supabase seperti `auth` dan `storage` tetap dipakai sesuai fungsinya.
- Tabel database menggunakan nama plural dengan format snake_case.
- Primary key menggunakan UUID.
- Tabel mutable memiliki `created_at` dan `updated_at`.
- Workflow penting harus memiliki status eksplisit.
- Aktifkan Row Level Security untuk tabel sensitif.
- Gunakan audit log untuk perubahan penting.

## RBAC

- Permission menggunakan pola nama `resource.action`.
- Role menerima permission melalui `role_permissions`.
- Role user sebaiknya memiliki scope jika aksesnya terbatas.
- Hanya Super Admin yang dapat mengelola permission.

## File dan Storage

- Simpan file di Supabase Storage.
- Simpan metadata object storage di tabel database jika file terkait workflow.
- Gunakan path yang konsisten:
  - `avatars/{user_id}/...`
  - `daily-report/{report_id}/...`
  - `task/{card_id}/...`
  - `certificate/{certificate_id}/...`
  - `learning/{course_id}/...`

## Pengujian

- Unit test untuk business logic murni.
- Integration test untuk workflow database penting.
- End-to-end test untuk pendaftaran, login, review admin, absensi, daily report, dan generate sertifikat.
