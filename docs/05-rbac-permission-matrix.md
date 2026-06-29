# Matrix Permission RBAC

## Role

- `super_admin`
- `admin_academy`
- `mentor`
- `school`
- `intern`
- `visitor`

## Matrix

| Fitur | Super Admin | Admin Academy | Mentor | Sekolah | Peserta | Visitor |
| --- | --- | --- | --- | --- | --- | --- |
| Melihat website publik | Ya | Ya | Ya | Ya | Ya | Ya |
| Pendaftaran publik | Ya | Ya | Tidak | Tidak | Ya | Ya |
| Mengelola konten CMS | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Publish konten CMS | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Mengelola user | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Mengelola role dan permission | Ya | Tidak | Tidak | Tidak | Tidak | Tidak |
| Mengelola program | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Mengelola kurikulum | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Mengelola batch | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Mengelola kelas | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Mengelola assignment mentor | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Melihat peserta terkait | Ya | Ya | Ya | Sesuai scope | Milik sendiri | Tidak |
| Mengelola task | Ya | Ya | Sesuai scope | Baca | Sesuai scope | Tidak |
| Submit progress task | Tidak | Tidak | Tidak | Tidak | Ya | Tidak |
| Submit absensi | Tidak | Tidak | Tidak | Tidak | Ya | Tidak |
| Review absensi | Ya | Ya | Sesuai scope | Baca | Milik sendiri | Tidak |
| Submit daily report | Tidak | Tidak | Tidak | Tidak | Ya | Tidak |
| Review daily report | Ya | Ya | Sesuai scope | Baca | Milik sendiri | Tidak |
| Mengelola course LMS | Ya | Ya | Sesuai scope | Tidak | Tidak | Tidak |
| Mengakses materi LMS | Ya | Ya | Ya | Tidak | Sesuai scope | Tidak |
| Submit quiz dan assignment | Tidak | Tidak | Tidak | Tidak | Ya | Tidak |
| Melihat dashboard sekolah | Ya | Ya | Tidak | Sesuai scope | Tidak | Tidak |
| Input assessment | Ya | Ya | Sesuai scope | Tidak | Tidak | Tidak |
| Finalisasi assessment | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Generate sertifikat | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Melihat sertifikat | Ya | Ya | Sesuai scope | Sesuai scope | Milik sendiri | Tidak |
| Melihat audit log | Ya | Sesuai scope | Tidak | Tidak | Tidak | Tidak |

## Catatan Scope

- `Sesuai scope` untuk mentor berarti data yang terkait dengan peserta, kelas, board, atau course yang ditugaskan.
- `Sesuai scope` untuk sekolah berarti data peserta dari sekolah atau kampus terkait.
- `Milik sendiri` berarti record peserta milik user yang sedang login.
