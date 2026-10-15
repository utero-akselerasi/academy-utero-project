# Struktur Repository

Struktur berikut adalah rencana awal. Struktur aktual sekarang memisahkan aplikasi Next.js, backend Fastify, operasi deployment, dan arsip dokumentasi.

## Struktur aktual

- `app/`, `components/`, `features/`, `lib/`: aplikasi Next.js dan adapter ke backend.
- `backend/src/`: API Fastify, Auth, RBAC, storage internal, dan domain.
- `backend/migrations/`: skema PostgreSQL backend mandiri.
- `backend/scripts/`: migrasi identitas, bootstrap, backup, restore, dan verifikasi backend.
- `scripts/`: validasi environment, evidence UAT, smoke, dan gate deployment lintas service.
- `supabase/migrations/` dan `supabase/seed/`: sumber skema historis serta definisi role/permission yang direplay ke target baru.
- `docs/README.md`: indeks dokumentasi aktif; `docs/archive/` hanya snapshot dan laporan historis.
- `tests/` dan `backend/tests/`: test aplikasi/deployment dan test backend.

Scope migrasi aktif hanya email, nama, dan profil Academy. Lihat `docs/35-selfhosted-identity-only.md`.

```text
.
|-- app/
|   |-- (public)/
|   |-- (auth)/
|   |-- dashboard/
|   |   |-- super-admin/
|   |   |-- admin/
|   |   |-- mentor/
|   |   |-- school/
|   |   `-- intern/
|   `-- api/
|-- components/
|   |-- ui/
|   |-- layout/
|   `-- feature/
|-- config/
|-- docs/
|-- features/
|   |-- cms/
|   |-- website/
|   |-- lkp/
|   |-- internship/
|   |-- lms/
|   |-- tasks/
|   |-- attendance/
|   |-- daily-reports/
|   |-- school-portal/
|   `-- assessments/
|-- lib/
|   |-- auth/
|   |-- rbac/
|   |-- supabase/
|   |-- validation/
|   `-- pdf/
|-- scripts/
|-- supabase/
|   |-- migrations/
|   |-- seed/
|   `-- functions/
|-- types/
`-- tests/
```

## Pola Modul Fitur

Setiap folder fitur hanya berisi bagian yang dimiliki oleh fitur tersebut.

```text
features/tasks/
|-- actions/
|-- components/
|-- queries/
|-- schemas/
|-- types/
`-- utils/
```

## Konvensi Penamaan

- Tabel database menggunakan nama plural dengan format snake_case.
- File TypeScript menggunakan kebab-case.
- Komponen React menggunakan PascalCase.
- Utility server-only berada di `lib/` atau di folder fitur seperti `queries` dan `actions`.
- UI primitive bersama berada di `components/ui`.
- UI yang spesifik ke proses bisnis berada di `features/*/components`.

## Routing Dashboard

Semua user login dari satu halaman. Setelah login, redirect ditentukan oleh primary role:

- `super_admin` -> `/dashboard/super-admin`
- `admin_academy` -> `/dashboard/admin`
- `mentor` -> `/dashboard/mentor`
- `school` -> `/dashboard/school`
- `intern` -> `/dashboard/intern`
