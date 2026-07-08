# Utero Academy Platform

Utero Academy Platform (UAP) adalah Education Management System internal untuk kebutuhan website publik, CMS, LKP, e-learning, manajemen magang, task management, absensi, daily report, portal sekolah, assessment, dan sertifikasi.

Project ini dimulai dari fondasi dokumentasi agar arsitektur, database, role, dan alur bisnis tetap terarah sebelum implementasi aplikasi.

## Status Implementasi

Platform sudah mencakup fitur-fitur utama berikut:

**School Portal**
- Dashboard sekolah dengan statistik real-time (siswa aktif, alumni, attendance rate)
- Daftar siswa dengan search dan filter Aktif/Alumni
- Detail siswa: kehadiran, daily report, assessment, dan sertifikat
- Tracking alumni untuk monitoring jangka panjang

**Super Admin Tools**
- Manajemen instansi: CRUD sekolah/kampus partner
- Link user role `school` dan siswa ke instansi
- Tool cleanup orphan data (relasi broken detection & removal)
- Dropdown search untuk menghubungkan siswa ke instansi

**Mentor & Intern Management**
- Absensi dengan GPS, selfie, geofencing, dan target jam bulanan
- Daily report dengan multi-upload, PDF preview, dan approval mentor
- Export rekap absensi ke CSV/Excel
- Task management dengan assignment dan tracking progress
- LMS: materi, kuis, tugas, dan penilaian

**Infrastruktur**
- Docker & Nginx reverse proxy untuk deployment
- Supabase Storage untuk file management
- Email & WhatsApp notification
- Audit log untuk tracking aktivitas penting

## Target Platform

- Website publik Utero Academy
- Headless CMS internal Utero
- Learning Management System
- Internship Management
- Task Management
- Absensi berbasis GPS, selfie, dan validasi Wi-Fi
- Daily Report dan approval mentor
- Portal sekolah atau kampus
- Assessment, sertifikat, dan dokumen PDF
- Dashboard role-based untuk Super Admin, Admin, Mentor, Sekolah, dan Peserta Magang

## Stack Awal

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Supabase Self-Hosted
- Database: PostgreSQL
- Auth: Supabase Auth dengan RBAC
- Storage: Supabase Storage
- PDF: service generator untuk sertifikat, nilai, laporan, dan surat magang
- Notification: Email, WhatsApp, dan push notification pada fase lanjutan

## Dokumentasi

- [Visi Project](docs/01-project-vision.md)
- [PRD](docs/02-prd.md)
- [Dokumen Desain Software](docs/03-sdd.md)
- [Proses Bisnis](docs/04-business-process.md)
- [Matrix Permission RBAC](docs/05-rbac-permission-matrix.md)
- [ERD Database](docs/06-database-erd.md)
- [Kontrak API](docs/07-api-contract.md)
- [Struktur Repository](docs/08-repository-structure.md)
- [Roadmap Implementasi](docs/09-roadmap.md)
- [Standar Coding](docs/10-coding-standard.md)
- [Progres & Fitur](docs/11-progress-dan-roadmap-fitur.md)
- [Setup Supabase](supabase/README.md)

**Rancangan School Portal:**
- [Product Design](docs/design/school-portal-design.md)
- [Implementation Guide](docs/design/school-portal-implementation.md)

## Prinsip Arsitektur

- Database dirancang sebelum fitur dibangun.
- Semua modul menggunakan RBAC sejak awal.
- CMS diposisikan sebagai headless CMS internal Utero, bukan hanya panel website Academy.
- Setiap modul punya batas tanggung jawab yang jelas.
- File storage memakai bucket dan path yang konsisten.
- Audit log dan histori status disiapkan untuk proses penting seperti pendaftaran, absensi, assessment, dan sertifikasi.
