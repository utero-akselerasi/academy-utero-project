# Progres Implementasi & Rencana Pengembangan Fitur

Dokumen ini mencatat seluruh fitur yang telah diperbaiki, dikembangkan, serta rencana langkah pengembangan berikutnya.

---

## 1. Fitur & Perbaikan yang Telah Diselesaikan

### A. Autentikasi & Manajemen Sesi (Session Persistency)
* **Penyelesaian Masalah Sesi Terputus / Auto-Logout:**
  * Memanfaatkan file `proxy.ts` di root sebagai Middleware Next.js untuk memperbarui dan menyelaraskan token sesi Supabase Auth pada setiap request.
  * Memperbaiki halaman `/login` agar mendeteksi otomatis jika pengguna telah login dan mengarahkannya langsung ke dashboard yang sesuai (`admin`, `school`, `intern`) tanpa meminta kredensial ulang.
* **Perbaikan Hak Akses & Mengatasi Admin Terpental (RLS Recursion Fix):**
  * Memperbaiki fungsi `getUserRoleCodes` di `features/auth/roles.ts` agar menggunakan Service Role Client saat memvalidasi role dari server. Ini memecahkan bug rekursi tak terbatas (infinite recursion) pada tabel `user_roles` di database PostgreSQL akibat RLS.
  * Memperbaiki `ProtectedDashboardLayout.tsx` agar menu sidebar dan label role memuat data yang sesuai dengan role aktif pengguna, bukan elemen default pertama dari daftar role yang diizinkan. Ini mencegah Admin melihat menu Super Admin dan menghindari Admin terpental ke halaman login.

### B. Dashboard Penempatan Pembimbing (Admin & School Portal)
* **Penyatuan Peran (Role Refactoring):**
  * Menyederhanakan sistem menjadi 3 role utama: `admin` (Administrator & Pembimbing), `school` (Instansi/Sekolah), dan `intern` (Peserta Magang). Role lama super_admin, admin_academy, dan mentor resmi ditiadakan dari kode dan database.
  * Memperbarui query `getMentors` agar mengambil seluruh pengguna yang memiliki role `admin` dan secara otomatis memastikan profile pembimbingnya (`mentor_profiles`) dibuat di database.
* **Portal Sekolah (School Portal):**
  * Mengembangkan halaman dashboard sekolah di `app/dashboard/school/page.tsx` yang membatasi perwakilan instansi hanya dapat melihat data peserta magang yang berasal dari sekolah/kampus yang sama (multi-tenant scoped).
  * Menyediakan 3 tab utama: Peserta Magang, Absensi Harian, dan Laporan Harian, lengkap dengan filter pencarian nama siswa, status absensi, dan status review laporan harian.

### C. Laporan Harian (Daily Report - Intern & Admin)
* **Pengunggahan Banyak File (Multi-File Upload & Unlimited Size Limit):**
  * Memperbarui form daily report untuk mendukung pengunggahan banyak file lampiran secara bersamaan tanpa batasan ukuran file 1MB (Unlimited size limit, dikonfigurasi pada client/server-side serta database storage buckets).
* **Integrasi Tautan Google Drive (Opsional):**
  * Menyediakan kolom input link Google Drive opsional bagi anak magang yang ingin melampirkan berkas dari Google Drive mereka.
  * Tautan Google Drive disimpan di `daily_report_attachments` dengan properti `mime_type: "url"`, terintegrasi dengan review admin.
* **Fitur Edit Revisi Laporan & Preview Gambar:**
  * Mengaktifkan tombol **Edit Revisi** pada daftar riwayat laporan jika statusnya `revision_requested`.
  * Mendeteksi tipe lampiran gambar dan langsung merendernya sebagai preview gambar (`<img />`) di halaman riwayat laporan (Intern) dan halaman review laporan (Admin) menggunakan modal popup overlay `ImagePreview` interaktif di halaman yang sama tanpa membuka tab baru browser.

### D. Manajemen Tugas Premium Ala Plane (Task Board & Kanban)
* **Tata Letak Horizontal Scrollable:** Kolom Kanban list (`task_lists`) ditata secara horizontal berdampingan dengan scrollbar horizontal yang mulus, persis seperti antarmuka workspace Plane.
* **Desain Kartu Tugas Ramping & Bersih:** Seluruh input form, select dropdown, dan form tambah file bukti disembunyikan dari kartu Kanban utama. Kartu tugas hanya berisi Judul, progress bar sub-task minimalis, info jumlah bukti checklist, deadline, serta avatar inisial bulat assignee.
* **Panel Detail Tugas via Popup Modal:** Mengklik kartu tugas akan membuka modal panel detail tugas yang interaktif. Di dalam modal ini, admin/intern dapat mengelola properti tugas: mengganti assignee anak magang, mengubah tingkat prioritas (Urgent, High, Medium, Low) dengan indikator warna, mengelola sub-tasking checklist, checklist bukti siswa, dan mengunggah lampiran berkas bukti.
* **Otomatisasi Daily Report ke Task Board:** Setiap kali peserta magang mengirimkan daily report harian (baru maupun edit), sistem secara otomatis membuat/memperbarui task card di list pertama pada board bimbingan admin yang bersangkutan secara real-time.
* **Owner Board Label:** Di halaman utama daftar board, setiap board memuat label nama Admin pembuat board tersebut secara dinamis (*"Dibuat oleh: [Nama Admin] pada [Tanggal]"*).


### F. Testimoni Alumni Mandiri dari User Intern
* **Pengisian Testimoni oleh Intern:**
  * Peserta magang yang statusnya telah dinyatakan selesai (`completed`) dapat menulis dan mengirimkan testimoni alumni langsung dari halaman Sertifikat mereka.
  * Testimoni yang dikirimkan masuk sebagai status `draft` untuk proses moderasi.
* **Moderasi & Persetujuan Admin:**
  * Di portal Admin CMS (`/dashboard/admin/cms`), admin dapat melihat daftar testimoni masuk, menyetujui/mempublikasikannya (`published`) agar tampil di halaman landing page utama, atau menghapusnya jika tidak sesuai.


### H. Peta Visual Lokasi Absensi (GPS Map Integration)
* **Integrasi OpenStreetMap (OSM):**
  * Membuat komponen `AttendanceMap.tsx` di `features/attendance/AttendanceMap.tsx` yang merender peta visual interaktif OpenStreetMap menggunakan iframe embed.
  * Menambahkan tombol toggle "Lihat Peta" untuk check-in dan check-out di dasbor peninjauan absensi admin (`app/dashboard/mentor/attendance/page.tsx`) guna mencocokkan koordinat lokasi GPS secara visual langsung di halaman dashboard tanpa membuka tab baru.


### J. Notifikasi Sistem Otomatis (Email SMTP & WhatsApp WAHA)
* **Notifikasi Revisi Daily Report:**
  * Secara otomatis mengirimkan notifikasi email (melalui SMTP) dan pesan WhatsApp (melalui WAHA API) kepada anak magang ketika mentor/admin meminta revisi (`revision_requested`) atas laporan harian mereka.
  * Notifikasi memuat tanggal laporan harian serta catatan detail revisi dari mentor.
* **Notifikasi Tugas Baru (New Assignment Notification):**
  * Secara otomatis mengirimkan notifikasi email dan pesan WhatsApp ke seluruh anak magang aktif ketika pembimbing menambahkan kuis atau tugas baru (`createAssignmentAction`) di materi kelas LMS.
  * Notifikasi memuat judul tugas serta tautan langsung untuk mengerjakannya.

### I. Pemantauan Aktivitas (Audit Log Viewer)
* **Pencatatan Audit Log:**
  * Membuat helper `writeAuditLog` dan query `getAuditLogs` di `features/super-admin/audit.ts` guna mencatat riwayat aksi penting dari administrator di tabel database `audit_logs`.
  * Mengintegrasikan pencatatan otomatis audit log pada aksi penugasan role (`assignUserRoleAction`), penghapusan role (`removeUserRoleAction`), dan pembuatan akun pengguna baru secara manual (`createUserManualAction`).
* **Halaman Monitoring Audit Log:**
  * Mengembangkan halaman khusus `app/dashboard/super-admin/audit-logs/page.tsx` untuk melihat daftar riwayat audit log lengkap dengan informasi waktu, nama pelaku (aktor), nama aksi, tipe dan ID objek, serta metadata detail perubahan data.
  * Menghubungkan halaman peninjau ini ke menu navigasi sidebar admin.

### G. Peningkatan Kapasitas & Batasan Ukuran Unggahan Berkas (Large File Upload Support)
* **Peningkatan Batas Payload Server Actions:**
  * Mengonfigurasi `next.config.ts` untuk meningkatkan batas payload request dari bawaan Next.js (1MB) menjadi **500MB** (`bodySizeLimit: "500mb"`). Hal ini mematikan error `Body exceeded 1 MB limit` saat mengunggah artikel, galeri, daily report, atau tugas berukuran besar.
* **Peniadaan Limit pada Storage Bucket:**
  * Menyusun migrasi database (`0005_add_intern_id_to_testimonials.sql`) untuk menghapus batasan ukuran file (`file_size_limit = NULL`) pada seluruh bucket Supabase Storage (`avatars`, `gallery`, `article`, `daily-report`, `task`, `learning`).

### E. LMS (Learning Management System - Intern & Admin)
* **LMS Pembelajaran (Intern):**
  * Mengembangkan halaman LMS Pembelajaran yang memuat detail kelas (materi pelajaran, kuis evaluasi, dan tugas praktis).
  * Pelajaran interaktif memuat materi bacaan, pemutar video YouTube dinamis via iframe, dan tombol "Tandai Selesai" untuk memperbarui persentase progress.
  * Kuis interaktif dengan skor yang dihitung otomatis di server-side serta log riwayat percobaan kuis.
  * Pengumpulan tugas kelas dengan mengunggah berkas bukti tugas (PDF/Gambar) ke bucket storage `learning`.
* **LMS Penilaian & Pembuatan Modul (Admin):**
  * Halaman manajemen kelas mentor/admin di `app/dashboard/mentor/lms/[courseId]/page.tsx` untuk menambahkan materi baru (`createLessonAction`) dan tugas kelas baru (`createAssignmentAction`).
  * Dasbor peninjauan tugas di mana admin dapat melihat tugas dikumpulkan, membuka modal detail jawaban & berkas bukti siswa, serta memberikan nilai (0-100) dan masukan feedback secara instan.

---

## 2. Rencana Pengembangan Fitur Berikutnya

Berikut adalah daftar fitur yang disiapkan untuk tahap implementasi selanjutnya:
1. **Integrasi Notifikasi Otomatis:**
   * Notifikasi sistem (Email SMTP & WAHA API) telah berhasil diimplementasikan penuh.
2. **Penilaian Akhir (Assessment) & Sertifikat:**
   * Fitur bagi admin/pembimbing untuk mengisi formulir evaluasi akhir kinerja anak magang.
   * Pembuatan sertifikat magang otomatis dalam format PDF yang dapat diunduh langsung oleh peserta magang yang telah menyelesaikan masa baktinya.
