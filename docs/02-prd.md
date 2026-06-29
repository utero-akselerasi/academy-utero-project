# Product Requirements Document

## 1. Background

Utero Academy membutuhkan platform terpusat untuk website publik, CMS, LKP, e-learning, magang, absensi, laporan harian, penilaian, dan sertifikasi. Platform lama berbasis WordPress tidak cukup ideal untuk kebutuhan operasional yang kompleks dan role-based.

## 2. Objectives

- Menggantikan WordPress dengan website publik berbasis database.
- Membuat CMS internal yang reusable.
- Mengelola proses magang end-to-end.
- Mendukung operasional LKP.
- Menyediakan LMS internal.
- Memudahkan sekolah memantau peserta.
- Memudahkan mentor mengelola task, laporan, absensi, dan assessment.
- Menyediakan data yang siap untuk laporan dan audit.

## 3. Users

| User | Kebutuhan Utama |
| --- | --- |
| Visitor | Melihat program, artikel, FAQ, mentor, gallery, testimoni, dan mendaftar |
| Peserta Magang | Melihat task, mengisi absensi, laporan harian, materi, quiz, assignment, nilai, dan sertifikat |
| Mentor | Mengelola peserta, task, daily report, feedback, dan assessment |
| Sekolah atau Kampus | Memantau absensi, task, progress, nilai, laporan, dan sertifikat peserta |
| Admin Academy | Mengelola program, batch, peserta, konten, mentor, jadwal, dan sertifikat |
| Super Admin | Mengelola tenant, konfigurasi sistem, role, permission, audit, dan seluruh data |

## 4. Core Features

### Website

- Home
- About
- Program
- Artikel
- FAQ
- Mentor
- Gallery
- Testimoni
- Contact
- Pendaftaran

### CMS

- Hero banner
- Section home
- FAQ
- Testimoni
- Gallery
- Footer
- Navbar
- SEO
- Artikel
- Kategori artikel
- Page dinamis

### LKP Management

- Program
- Kurikulum
- Batch
- Jadwal
- Kelas
- Instruktur
- Sertifikat

### Internship Management

- Pendaftaran
- Seleksi
- Penerimaan
- Penempatan mentor
- Mulai magang
- Monitoring
- Penilaian
- Lulus
- Alumni

### LMS

- Course
- Materi
- Video
- Quiz
- Assignment
- Progress
- Certificate

### Task Management

- Board
- List
- Card
- Checklist
- Comment
- Attachment
- Relasi card dengan peserta, mentor, dan divisi

### Absensi

- Check-in dengan GPS, selfie, dan validasi Wi-Fi
- Check-out dengan GPS, selfie, dan validasi Wi-Fi
- Riwayat absensi lengkap

### Daily Report

- Pekerjaan hari ini
- Progress
- Kendala
- Rencana besok
- Lampiran
- Approve atau revisi oleh mentor

### School Portal

- Absensi
- Task
- Progress
- Laporan harian
- Nilai
- Sertifikat
- Feedback mentor

### Assessment

- Input nilai mentor
- Finalisasi admin
- Generate PDF
- Digital signature
- Sertifikat

## 5. Non-Functional Requirements

- RBAC diterapkan sejak awal.
- Semua file disimpan di Supabase Storage.
- Data penting harus memiliki audit log.
- API harus typed dan terdokumentasi.
- Database harus mendukung reporting.
- Aplikasi harus responsif untuk desktop dan mobile.
- Sistem harus siap self-hosted.

## 6. Success Metrics

- Admin dapat mengelola konten website tanpa WordPress.
- Mentor dapat memonitor seluruh peserta bimbingannya dari satu dashboard.
- Peserta dapat absen, mengisi daily report, dan melihat task dengan mudah.
- Sekolah dapat melihat progress peserta tanpa meminta laporan manual.
- Sertifikat dan laporan PDF dapat digenerate dari data sistem.

