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

1. [x] Setup Next.js, TypeScript, dan Tailwind CSS. (Selesai)
2. [x] Setup struktur Supabase Self-Hosted. (Selesai)
3. [x] Implementasi auth dan RBAC dasar. (Selesai & Diperbaiki)
4. [x] Implementasi halaman website publik. (Selesai)
5. [ ] Implementasi model konten CMS.
6. [x] Implementasi pendaftaran magang dan review admin. (Selesai)
7. [x] Implementasi dashboard mentor dan peserta. (Selesai & Diperbaiki)
8. [x] Implementasi task management. (Selesai & Diperbaiki dengan Delete, Assign, & Otomatisasi Daily Report)
9. [x] Implementasi absensi. (Selesai)
10. [x] Implementasi daily report. (Selesai & Diperbaiki dengan Multi-Upload, Google Drive Fallback, Image Preview, & Edit Revisi)
11. [x] Implementasi LMS (Pelajaran, Kuis, Tugas, Penilaian, & Pembuatan Modul). (Selesai)
12. [ ] Implementasi assessment dan generate sertifikat. (Fase Berikutnya)
13. [~] Implementasi school portal. (MVP Awal Sudah Dibuat - Lanjutan Fase Berikutnya)

## Catatan Perancangan Fitur Berikutnya

- [ ] School Portal belum diimplementasikan penuh di aplikasi.
- [x] Rancangan produk School Portal sudah dibuat di `docs/design/school-portal-design.md`.
- [x] Rancangan teknis implementasi sudah dibuat di `docs/design/school-portal-implementation.md`.
- [x] MVP awal School Portal sudah mulai diimplementasikan (dashboard overview, daftar siswa, detail siswa).
- [x] Manajemen Instansi Super Admin sudah dibuat untuk tambah/edit/hapus instansi dan melihat perwakilan.
## Status Terbaru

- [x] Export rekap absensi bulanan ke CSV untuk mentor.
- [x] Ubah password pengguna dari halaman profil.
- [x] Preview PDF untuk attachment daily report.
- [x] Containerization aplikasi dengan Docker, Docker Compose, dan Nginx reverse proxy.
## Fase 5: Integrasi

- [x] Notifikasi email (SMTP) (Selesai)
- [x] Notifikasi WhatsApp via WAHA API (Selesai)
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





