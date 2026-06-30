# Matrix Permission RBAC

## Role (Peran Utama)

- `admin` (Administrator Sistem & Pembimbing Magang)
- `school` (Hubungan Instansi / Sekolah / Kampus)
- `intern` (Peserta Magang Aktif)
- `visitor` (Pengunjung Umum Non-Autentikasi)

## Matrix Hak Akses

| Fitur | Admin | Sekolah | Peserta (Intern) | Visitor |
| --- | --- | --- | --- | --- |
| Melihat website publik | Ya | Ya | Ya | Ya |
| Pendaftaran publik | Ya | Tidak | Ya | Ya |
| Mengelola konten CMS | Ya | Tidak | Tidak | Tidak |
| Publish konten CMS | Ya | Tidak | Tidak | Tidak |
| Mengelola user | Ya | Tidak | Tidak | Tidak |
| Mengelola role dan permission | Ya | Tidak | Tidak | Tidak |
| Mengelola program | Ya | Tidak | Tidak | Tidak |
| Mengelola kelas & kurikulum | Ya | Tidak | Tidak | Tidak |
| Mengelola penempatan bimbingan | Ya | Tidak | Tidak | Tidak |
| Melihat profil peserta | Ya | Sesuai scope | Milik sendiri | Tidak |
| Mengelola task board & card | Ya | Baca | Sesuai scope | Tidak |
| Submit progress task | Tidak | Tidak | Ya | Tidak |
| Submit absensi | Tidak | Tidak | Ya | Tidak |
| Review absensi | Ya | Baca | Milik sendiri | Tidak |
| Submit daily report | Tidak | Tidak | Ya | Tidak |
| Review daily report | Ya | Baca | Milik sendiri | Tidak |
| Mengelola course & tugas LMS | Ya | Tidak | Tidak | Tidak |
| Mengakses materi LMS | Ya | Tidak | Sesuai scope | Tidak |
| Submit kuis & tugas LMS | Tidak | Tidak | Ya | Tidak |
| Melihat dashboard sekolah | Ya | Sesuai scope | Tidak | Tidak |
| Input & finalisasi penilaian | Ya | Tidak | Tidak | Tidak |
| Generate sertifikat magang | Ya | Tidak | Tidak | Tidak |
| Melihat sertifikat | Ya | Sesuai scope | Milik sendiri | Tidak |
| Melihat audit log | Ya | Tidak | Tidak | Tidak |

## Catatan Scope Data

- `Sesuai scope` untuk sekolah berarti hanya dapat melihat data peserta magang yang terdaftar dari sekolah/kampus terkait.
- `Milik sendiri` berarti data pribadi yang terkait dengan akun peserta magang yang sedang login.
