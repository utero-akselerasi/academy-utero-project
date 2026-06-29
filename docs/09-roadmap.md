# Roadmap Implementasi

## Fase 1: Analisis

- Business process diagram
- User journey
- Sitemap
- Flowchart setiap modul
- Finalisasi batas modul
- Finalisasi role dan scope data

## Fase 2: Desain

- ERD detail
- Schema PostgreSQL
- Matrix RBAC dan permission
- Kontrak API
- Policy storage bucket
- Policy audit log
- Desain lifecycle status

## Fase 3: Dokumentasi

- PRD
- SDD
- Panduan komponen UI
- Standar coding
- Struktur repository
- Definition of done
- Strategi pengujian

## Fase 4: Implementasi

1. Setup Next.js, TypeScript, dan Tailwind CSS.
2. Setup struktur Supabase Self-Hosted.
3. Implementasi auth dan RBAC dasar.
4. Implementasi halaman website publik.
5. Implementasi model konten CMS.
6. Implementasi pendaftaran magang dan review admin.
7. Implementasi dashboard mentor dan peserta.
8. Implementasi task management.
9. Implementasi absensi.
10. Implementasi daily report.
11. Implementasi LMS.
12. Implementasi assessment dan generate sertifikat.
13. Implementasi school portal.

## Fase 5: Integrasi

- Notifikasi email
- Notifikasi WhatsApp via WAHA
- Push notification
- PDF generator
- Digital signature
- Dashboard analytics
- Monitoring
- Audit log viewer

## Sprint Pertama yang Disarankan

### Goal

Membuat fondasi teknis dan vertical slice tipis dari pendaftaran publik sampai review admin.

### Scope

- Inisialisasi project Next.js.
- Konfigurasi TypeScript dan Tailwind CSS.
- Konfigurasi Supabase client.
- Membuat halaman auth.
- Membuat tabel RBAC dan seed role.
- Membuat tabel awal `internship_applications`.
- Membuat form pendaftaran publik.
- Membuat halaman admin untuk review pendaftaran.

### Exit Criteria

- Visitor dapat submit pendaftaran.
- Admin dapat melihat pendaftaran masuk.
- Admin dapat mengubah status pendaftaran.
- Data tersimpan di PostgreSQL schema `utero_academy`.
- Akses role ditegakkan.
