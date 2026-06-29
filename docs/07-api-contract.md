# Kontrak API

Dokumen ini mendefinisikan permukaan API awal. Implementasi final dapat menggunakan Server Actions, Route Handlers, Supabase RPC, atau kombinasi dari pola tersebut.

## Konvensi

- Semua endpoint protected membutuhkan konteks user yang sudah login.
- Semua mutation harus memvalidasi permission role.
- Bentuk response menggunakan `data` dan `error`.
- Endpoint list mendukung pagination dengan `page`, `per_page`, `sort`, dan `q` jika relevan.
- Semua ID menggunakan UUID.

## Website Publik

| Method | Path | Tujuan |
| --- | --- | --- |
| GET | `/api/public/site/:slug` | Mengambil konfigurasi site publik |
| GET | `/api/public/pages/:slug` | Mengambil konten halaman publik |
| GET | `/api/public/articles` | Mengambil daftar artikel published |
| GET | `/api/public/articles/:slug` | Mengambil detail artikel |
| GET | `/api/public/faqs` | Mengambil FAQ published |
| POST | `/api/public/registrations` | Submit pendaftaran magang atau program |

## CMS

| Method | Path | Tujuan |
| --- | --- | --- |
| GET | `/api/cms/pages` | Mengambil daftar halaman |
| POST | `/api/cms/pages` | Membuat halaman |
| PATCH | `/api/cms/pages/:id` | Mengubah halaman |
| POST | `/api/cms/pages/:id/publish` | Publish halaman |
| GET | `/api/cms/articles` | Mengambil daftar artikel |
| POST | `/api/cms/articles` | Membuat artikel |
| PATCH | `/api/cms/articles/:id` | Mengubah artikel |
| POST | `/api/cms/articles/:id/publish` | Publish artikel |
| GET | `/api/cms/media` | Mengambil daftar media |
| POST | `/api/cms/media` | Upload metadata media |

## Internship

| Method | Path | Tujuan |
| --- | --- | --- |
| GET | `/api/internship/applications` | Mengambil daftar pendaftaran |
| PATCH | `/api/internship/applications/:id/status` | Mengubah status pendaftaran |
| POST | `/api/internship/mentor-assignments` | Assign mentor ke peserta |
| GET | `/api/internship/interns` | Mengambil daftar peserta |
| GET | `/api/internship/interns/:id` | Mengambil detail peserta |
| PATCH | `/api/internship/interns/:id/status` | Mengubah status magang |

## LMS

| Method | Path | Tujuan |
| --- | --- | --- |
| GET | `/api/lms/courses` | Mengambil daftar course |
| POST | `/api/lms/courses` | Membuat course |
| GET | `/api/lms/courses/:id` | Mengambil detail course |
| POST | `/api/lms/courses/:id/enrollments` | Enroll peserta ke course |
| POST | `/api/lms/lessons/:id/progress` | Update progress lesson |
| POST | `/api/lms/quizzes/:id/attempts` | Submit attempt quiz |
| POST | `/api/lms/assignments/:id/submissions` | Submit assignment |

## Task Management

| Method | Path | Tujuan |
| --- | --- | --- |
| GET | `/api/tasks/boards` | Mengambil daftar board |
| POST | `/api/tasks/boards` | Membuat board |
| POST | `/api/tasks/lists` | Membuat list |
| PATCH | `/api/tasks/lists/:id` | Mengubah list |
| POST | `/api/tasks/cards` | Membuat card |
| PATCH | `/api/tasks/cards/:id` | Mengubah card |
| POST | `/api/tasks/cards/:id/comments` | Menambahkan komentar |
| POST | `/api/tasks/cards/:id/attachments` | Menambahkan lampiran |

## Attendance

| Method | Path | Tujuan |
| --- | --- | --- |
| POST | `/api/attendance/check-in` | Submit check-in |
| POST | `/api/attendance/check-out` | Submit check-out |
| GET | `/api/attendance` | Mengambil daftar absensi |
| PATCH | `/api/attendance/:id/review` | Review atau koreksi absensi |

## Daily Report

| Method | Path | Tujuan |
| --- | --- | --- |
| GET | `/api/daily-reports` | Mengambil daftar laporan |
| POST | `/api/daily-reports` | Submit laporan |
| GET | `/api/daily-reports/:id` | Mengambil detail laporan |
| PATCH | `/api/daily-reports/:id` | Mengubah laporan |
| POST | `/api/daily-reports/:id/reviews` | Approve atau request revisi |

## Assessment dan Sertifikat

| Method | Path | Tujuan |
| --- | --- | --- |
| POST | `/api/assessments` | Membuat assessment |
| PATCH | `/api/assessments/:id` | Mengubah assessment |
| POST | `/api/assessments/:id/finalize` | Finalisasi assessment |
| POST | `/api/certificates/generate` | Generate PDF sertifikat |
| POST | `/api/certificates/:id/sign` | Menerapkan digital signature |
| GET | `/api/certificates/:id` | Mengambil metadata sertifikat |
