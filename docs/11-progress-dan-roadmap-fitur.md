# Progres Implementasi & Rencana Pengembangan Fitur

Dokumen ini mencatat seluruh fitur yang telah diperbaiki, dikembangkan, serta rencana langkah pengembangan berikutnya.

---

## 1. Fitur & Perbaikan yang Telah Diselesaikan

#

## 2. Hasil Revisi & Perbaikan Baru Selesai (Sprint Terakhir)

### G. Penanganan Hydration & Perbaikan Error Input Event Handlers (Terbaru - 2 Juli 2026)
* **Penyelesaian - Fix Error Event Handlers:** Memperbaiki crash runtime *"Event handlers cannot be passed to Client Component props"* di halaman dashboard/mentor/attendance dan dashboard/mentor/assessments dengan mengekstraksi input filter tanggal dan tombol upload berkas template yang menggunakan handler onChange ke dalam Client Component tersendiri (DatePickerFilter.tsx dan UploadTemplateButton.tsx).
* **Penyelesaian - Fix Hydration Mismatch:** Memperbaiki error *"Hydration failed because the server rendered text didn't match the client"* di layout utama publik (pp/(public)/layout.tsx) dengan mengganti nesting tag <p> yang tidak valid (karena berisi gabungan teks dan <br /> statis) menjadi susunan elemen <div> terstruktur.
* **Penyelesaian - Header & Layout Responsif:** Mendesain ulang Header utama menjadi komponen yang sepenuhnya responsif di berbagai perangkat. Di layar mobile, link menu yang panjang akan disembunyikan dan digantikan oleh *Hamburger Menu* interaktif dengan *navigation overlay/drawer* slide-in yang sangat intuitif.

### A. Refaktor Dropdown Super Admin & Portal
* **Penyelesaian:** Menu aksi dropdown pada tabel user Super Admin kini menggunakan React `createPortal` ke `document.body` sehingga menu tidak lagi terpotong/memicu scrollbar pada tabel.
* **Fitur Baru - Link Instansi/Sekolah:** Admin sekarang dapat menghubungkan akun perwakilan sekolah (`school_contacts`) ke instansi sekolah/kampus secara visual melalui menu aksi `Link Instansi / Sekolah` pada dropdown tabel.

### B. Visual Quiz & Landing Page Builders (No-JSON)
* **Penyelesaian - Kuis Builder:** Mengganti input JSON mentah dengan builder visual interaktif (`QuizFormBuilder.tsx`) untuk pertanyaan kuis, pilihan opsi, dan jawaban benar.
* **Penyelesaian - Landing Page Editor:** Memisahkan pengaturan Landing Page ke menu sidebar khusus (`/dashboard/admin/landing`). Menyediakan visual builder untuk **Skills Competencies** (mendukung input deskripsi, tautan web, upload icon kustom, dan penataan urutan naik-turun) dan **Top Expertisers** (mendukung nama, jabatan, dan upload gambar expert).
* **Penyelesaian - Partnership Logos:** Menyediakan uploader visual untuk logo mitra/partner kerja sama di bawah sub-tab Landing Page yang langsung merender gambar logo di beranda publik (dengan ukuran logo lebih proporsional).

### C. Konten Dinamis Halaman Publik (About, Contact, Terms)
* **Penyelesaian:** Halaman publik `/about`, `/contact`, dan `/terms` kini memuat konfigurasi yang disimpan admin di database secara dinamis.
* **Penyelesaian - Desain Kontak:** Desain header halaman kontak (`/contact`) diubah menggunakan latar belakang gambar hero dengan overlay gelap transparan agar lebih estetik dan teks putih terlihat jelas.

### D. Kehadiran Berbasis Role Intern
* **Penyelesaian:** Menambahkan penyaringan otomatis pada halaman absensi bimbingan (`dashboard/mentor/attendance`) dan penilaian (`dashboard/mentor/assessments`) sehingga hanya menampilkan peserta magang yang memiliki role `intern`, mencegah akun admin/mentor ikut masuk ke dalam tabel presensi.

### E. Bugfix Upload Absensi Izin / Sakit
* **Penyelesaian:** Menambahkan atribut `encType="multipart/form-data"` pada form `PermitForm.tsx` absensi intern sehingga upload file berkas surat dokter kini terkirim dengan sukses ke server storage.

## A. Refaktor Dropdown Super Admin via React Portal
* **Masalah:** Menu aksi dropdown pada tabel user terpotong oleh overflow scrollbar horizontal pada tabel.
* **Solusi:** Memanfaatkan React `createPortal` untuk merender dropdown menu aksi secara langsung di bawah `document.body`, membebaskannya dari batasan box tabel.

### B. Visual Quiz Question Builder
* **Masalah:** Mentor kesulitan karena harus menulis pertanyaan kuis dalam format JSON mentah.
* **Solusi:** Membuat komponen `QuizFormBuilder.tsx` yang menyediakan input visual untuk teks pertanyaan, 4 pilihan opsi jawaban, dan radio button untuk menentukan kunci jawaban yang benar secara instan.

### C. Collapsible Form LMS & Layout Minimalis
* **Masalah:** Form penambahan materi, tugas, dan kuis selalu melebar memenuhi layar.
* **Solusi:** Menggunakan elemen akordeon `<details>` dengan gaya modern untuk menyembunyikan form di bawah header toggle, menghemat ruang visual.

### D. Redesain Daily Report Intern & Modal Form
* **Masalah:** Daftar daily report intern memanjang ke bawah dan kurang terstruktur.
* **Solusi:** Mengubah tampilan riwayat laporan harian menjadi tabel data yang minimalis dan memindahkan form pengiriman baru ke dalam popup modal lebar (`max-w-2xl`).

### E. Integrasi Filter Tanggal & Selfie Absensi Mentor
* **Masalah:** Mentor tidak bisa memfilter absensi berdasarkan tanggal tertentu dan tidak bisa melihat foto selfie check-in/out peserta.
* **Solusi:** Menambahkan input filter tanggal dinamis pada menu Review Absensi serta mengintegrasikan preview foto selfie menggunakan modal popup `ImagePreview` (dibuat menggunakan portal agar tampil penuh tanpa terpotong).

### F. Perbaikan Upload File Izin Sakit
* **Masalah:** Peserta magang gagal mengunggah surat dokter saat mengajukan izin sakit (Surat dokter terdeteksi kosong).
* **Solusi:** Menambahkan atribut `encType="multipart/form-data"` pada tag form `PermitForm.tsx` agar berkas data surat dokter dikirim dalam format multi-part yang valid ke server.

### G. Visibilitas Tombol Hapus Checklist & Subtask
* **Masalah:** Tombol hapus checklist hanya muncul pada hover, yang tidak bisa diakses dari perangkat mobile/layar sentuh.
* **Solusi:** Menghilangkan kelas `opacity-0 group-hover` dan menggantinya dengan ikon `text-slate-400 hover:text-red-700` yang selalu terlihat jelas.

### H. Penyelarasan Overlap Ikon Search Input
* **Masalah:** Ikon pencarian menumpuk di atas teks input placeholder.
* **Solusi:** Menambahkan modifier `!pl-10` dan `!pl-9` untuk memastikan padding-left input input tidak tertimpa oleh setelan default kelas `.form-input`.

## A. Autentikasi & Manajemen Sesi (Session Persistency)
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

---

## 3. Hasil Analisis Evaluasi & Rencana Revisi Bug (9 Bagian)

Berikut adalah hasil analisis detail terhadap 9 poin evaluasi terbaru berserta rancangan skema perbaikannya:

### **Bagian 1: Perbaikan Form & Alur Pendaftaran (dashboard/admin/pendaftaran)**
- **Masalah:** Input pendaftaran lanjutan (CV & Portofolio) belum tersedia pada form publik, dan data pendaftaran gagal masuk ke database.
- **Rencana Solusi:**
  1. Menambahkan kolom `cv_path` (text) dan `portfolio_path` (text) pada tabel `utero_academy.internship_applications` via file migrasi SQL `0006_update_registration_and_policies.sql`.
  2. Membuat storage bucket baru bernama `applications` (public) di Supabase untuk menampung file CV dan Portofolio.
  3. Mengubah form pendaftaran di `features/registration/RegistrationForm.tsx` dengan menambahkan input berkas CV dan Portofolio (PDF/Gambar).
  4. Memperbarui Server Action `submitRegistrationAction` di `features/registration/actions.ts` agar menggunakan `createUteroAcademyServiceRoleClient()` demi mem-bypass kendala hak akses insert dari role anonim (RLS visitor), serta mengunggah berkas tersebut ke storage bucket `applications`.
  5. Memperbarui `app/dashboard/admin/pendaftaran/page.tsx` untuk mengambil data pendaftaran dengan Service Role client (menghindari RLS select issue bagi admin) serta menampilkan tombol/tautan download CV dan Portofolio peserta.

### **Bagian 2: Optimalisasi Tampilan Penempatan (dashboard/admin/penempatan)**
- **Masalah:** Layout penempatan bimbingan kurang dinamis, kaku, dan minim informasi penempatan.
- **Rencana Solusi:**
  1. Mengubah struktur grid di `app/dashboard/admin/penempatan/page.tsx` menjadi card layout yang modern dan responsif.
  2. Memperbarui query `getMentorAssignments()` di `features/admin/queries.ts` untuk men-join data kontak peserta secara penuh, termasuk Major, Asal Sekolah/Kampus, Email, dan Nomor WhatsApp.
  3. Menampilkan informasi kontak lengkap intern dan mentor pembimbing secara rapi pada setiap kartu penempatan aktif.

### **Bagian 3: Global Monitoring Tugas (dashboard/mentor/tasks)**
- **Masalah:** Halaman awal list board kurang menarik, dan admin belum bisa memantau seluruh aktivitas tugas intern secara global tanpa batasan pembimbing.
- **Rencana Solusi:**
  1. Memperbarui antarmuka utama Task Board (`app/dashboard/mentor/tasks/page.tsx`) dengan menambahkan statistik ringkasan (Total Tasks, Completed, Pending).
  2. Menyediakan fitur toggle / filter "Tampilkan Semua Tugas Peserta" bagi Admin. Jika diaktifkan, query akan memotong pembatasan ID mentor (`owner_id`) sehingga admin dapat memantau seluruh board tugas yang didelegasikan oleh siapa saja.
  3. Menambahkan visual avatar/inisial bulat pembuat tugas (creator) pada setiap kartu tugas.

### **Bagian 4: Pengembangan LMS & Sistem Absensi Mentor (dashboard/mentor/lms & attendance)**
- **Rencana Solusi LMS:**
  1. Menambahkan kategori materi baru: E-Learning (Modul Video/Materi Pembelajaran) dan Uji Kompetensi Online (Ujian Evaluasi Kuis Terjadwal).
  2. Memastikan kueri select LMS menampilkan materi dengan status `published` agar secara otomatis muncul di dashboard intern tanpa terlewat.
- **Rencana Solusi Absensi Mentor:**
  1. Membuat tabel database baru `attendance_settings` (id, check_in_time, check_out_time, late_tolerance_minutes, monthly_target_hours) via migrasi SQL.
  2. Mengubah tampilan `dashboard/mentor/attendance` dari tabel memanjang menjadi grid card foto wajah (selfie check-in) dan nama anak magang.
  3. Ketika foto wajah diklik, akan memicu popup modal detail absensi harian, riwayat keterlambatan, akumulasi durasi jam magang bulan ini, persentase kehadiran (Attendance Rate %), serta kalkulasi skor penilaian otomatis.

### **Bagian 5: Fitur Izin & Sakit Intern (dashboard/intern/attendance)**
- **Masalah:** Peserta magang belum bisa mengajukan izin atau melampirkan surat dokter jika sakit.
- **Rencana Solusi:**
  1. Menambahkan opsi status kehadiran: Hadir (Check-In), Izin (Permit), Sakit (Sick).
  2. Menyediakan form input alasan (reason) untuk izin, dan upload file Surat Dokter jika sakit.
  3. Berkas surat dokter diunggah ke bucket storage `learning` / `applications` dan tercatat di database absensi.

### **Bagian 6: Layout Daily Report Dinamis (dashboard/intern/daily-reports)**
- **Masalah:** Tampilan visual daily report kurang menarik dan kurang modern.
- **Rencana Solusi:**
  1. Merombak visual form daily report dan tabel riwayat agar menggunakan panel/card yang minimalis dan teratur.
  2. Menyediakan tab/badge visual warna status review (Disetujui, Perlu Revisi, Menunggu).

### **Bagian 7: Custom Penilaian Akhir & A4 Print Landscape (dashboard/mentor/assessments)**
- **Masalah:** Standardisasi kriteria penilaian sekolah/universitas berbeda-beda, dan layout cetak sertifikat terpotong di kertas A4.
- **Rencana Solusi:**
  1. Menyediakan input kriteria penilaian custom dinamis pada modal evaluasi akhir di `dashboard/mentor/assessments`.
  2. Menyesuaikan CSS print (`@media print`) di `app/dashboard/intern/certificate/print/page.tsx` dengan menetapkan ukuran halaman tetap (`size: A4 landscape`), menghilangkan header/footer halaman browser bawaan, serta menata padding agar pas dalam 1 halaman.

### **Bagian 8: Landing Page CMS Terintegrasi (dashboard/admin/cms)**
- **Masalah:** Landing page website Utero Academy perlu memuat data About Us, Blog, Contact, Terms, dan FAQ secara dinamis, serta perbaikan error 400 Bad Request pada section Recent Activity.
- **Rencana Solusi:**
  1. Mengaudit kueri database pada Recent Activity di `app/(public)/page.tsx` untuk memperbaiki parameter request yang memicu error 400.
  2. Mengintegrasikan komponen Landing Page (About Us, Contact Map, FAQ) agar membaca konten secara dinamis dari CMS site.

### **Bagian 9: Integrasi Google Maps API**
- **Masalah:** Butuh penentuan titik lokasi presisi untuk absen.
- **Rencana Solusi:**
  1. Menyiapkan variabel `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` di berkas `.env`.
  2. Mengintegrasikan Google Maps Javascript API untuk memverifikasi jarak radius peserta dari koordinat kantor Utero (Geofencing Absensi).


---

## 4. Rilis Perbaikan Bug & Fitur Terbaru (1 Juli 2026)

Berikut adalah status penyelesaian perbaikan bug dan peningkatan fitur terbaru yang telah diimplementasikan:

### **A. Resolusi Bug Izin & Koneksi Database (RLS / Grant ACL)**
* **Masalah:** Terjadi error permission denied (kode 42501) pada tabel ttendance_settings dan daily_reports yang menyebabkan pesan *"Gagal memuat laporan. Cek koneksi database."* di dashboard mentor/intern.
* **Solusi:** Menjalankan migrasi  007_setup_buckets_and_permissions.sql yang memberikan hak akses penuh (GRANT ALL PRIVILEGES) pada seluruh skema dan tabel utero_academy kepada role service_role, postgres, uthenticated, dan non.

### **B. Peniadaan Limit & Keamanan Storage Buckets (File Upload Fix)**
* **Masalah:** Intern gagal mengunggah file daily report dan foto profil (avatar) karena pembatasan status bucket dan kebijakan akses RLS Supabase Storage.
* **Solusi:**
  - Mengubah konfigurasi bucket storage (vatars, gallery, rticle, daily-report, 	ask, learning) menjadi **Public** (public = true) dan menghapus limit ukuran file (ile_size_limit = NULL) di Supabase.
  - Memperbarui eatures/daily-reports/actions.ts dan eatures/auth/edit-profile-action.ts agar mengunggah file menggunakan **Supabase Service Role Client** (bypassing RLS), menjamin pengunggahan file berhasil 100%.

### **C. Perbaikan Layout Dashboard Terpotong (Scroll Container Fix)**
* **Masalah:** Formulir input daily report terpotong setelah kolom "Rencana Besok" dan tidak dapat digulirkan (scrollbar tidak muncul).
* **Solusi:** Mengubah wadah utama dari min-h-screen menjadi h-screen di eatures/auth/DashboardShell.tsx. Hal ini membatasi tinggi dashboard tepat setinggi viewport (100vh) sehingga scrollbar vertikal pada panel konten utama muncul secara otomatis saat konten meluap.

### **D. Perbaikan Halaman Profil Pengguna (dashboard/profile)**
* **Masalah:** Halaman edit profil tidak memiliki menu navigasi/sidebar untuk kembali ke dashboard, form edit profile tidak menyimpan data, serta foto profil baru tidak ter-apply.
* **Solusi:**
  - Membuat berkas layout pp/dashboard/profile/layout.tsx untuk membungkus halaman profil dengan ProtectedDashboardLayout sehingga sidebar dan topbar otomatis muncul.
  - Menambahkan atribut encType="multipart/form-data" pada tag form di pp/dashboard/profile/ProfileFormWrapper.tsx agar berkas foto profil (avatar) ikut terkirim saat form disubmit.

### **E. Penyederhanaan Tabel & Edit User via Popup Modal (Super Admin)**
* **Masalah:** Tabel manajemen user sangat lebar dan kurang intuitif, serta administrator kesulitan memperbarui informasi profil user.
* **Solusi:**
  - Menyederhanakan layout tabel user di eatures/super-admin/UserRoleManager.tsx.
  - Menambahkan tombol aksi **Edit** yang memicu popup modal untuk memperbarui Nama Lengkap, Nomor Telepon, dan Status Keaktifan (Aktif/Nonaktif) pengguna secara dinamis.
  - Membuat Server Action updateUserAdminAction untuk mengeksekusi perubahan profil dan mensinkronisasikannya ke profil terkait (seperti intern_profiles).
  - Membuat migrasi  008_sync_user_profiles.sql untuk menyalin seluruh pengguna dari uth.users ke user_profiles agar semua user langsung muncul di tabel.

### **F. Implementasi Desain Baru Homepage Utero Academy**
* **Masalah:** Tampilan homepage lama terlalu kaku dan terjadi error 400 Bad Request pada bagian Recent Activity.
* **Solusi:**
  - Merancang ulang pp/(public)/page.tsx sesuai dengan desain referensi, meliputi penambahan bagian **Skills Competency** (10 keahlian), **Top Expertiser** (tim mentor), dan **Top Skill Review** (testimoni alumni).
  - Memperbaiki kueri **Recent Activity** agar mengambil artikel terbitan terbaru langsung dari tabel CMS internal di database menggunakan client server-side, menyelesaikan error 400 Bad Request.

### **G. Resolusi Bug Batasan Proxy & Format Tanggal Evaluasi (1 Juli 2026 - Hotfix)**
* **Masalah 1:** Unggahan berkas berukuran besar (seperti PDF daily report, gambar pendaftaran) gagal dengan pesan *"Request body exceeded 10MB"* atau *"Unexpected end of form"*.
* **Solusi 1:** Menambahkan konfigurasi `proxyClientMaxBodySize: 524288000` (500MB) di bawah preferensi `experimental` pada berkas `next.config.ts`. Ini mengonfigurasi proxy middleware Next.js agar menerima muatan (payload) berkas besar hingga 500MB sesuai dengan konfigurasi Server Actions.
* **Masalah 2:** Halaman riwayat kuis di LMS peserta magang (`app/dashboard/intern/lms/[courseId]/quizzes/[quizId]/page.tsx`) mengalami error fatal *"TypeError: Invalid option : timeStyle"* ketika memformat waktu penyelesaian kuis.
* **Solusi 2:** Mengganti penggunaan metode `toLocaleDateString` atau format `toLocaleString` yang tidak standar dengan pemanggilan terpisah yang sangat kompatibel: `toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })` dipadukan dengan `toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })`. Hal ini menjamin format waktu kuis stabil 100% dan tidak memicu error server components rendering.
* **Masalah 3:** Galat JavaScript *"Cannot read properties of null (reading 'reset')"* terjadi saat mengunggah lampiran di fitur tugas intern.
* **Solusi 3:** Menambahkan perlindungan di `features/tasks/TaskAttachmentForm.tsx` dengan melakukan pengecekan tipe objek sebelum menjalankan method `.reset()` (menggunakan `if (form && typeof form.reset === "function")` di dalam blok `try-catch`).

### **H. Kustomisasi Template Sertifikat Magang & A4 Print Landscape (2 Juli 2026)**
* **Masalah:** Sertifikat magang otomatis belum dapat disesuaikan menggunakan desain template visual buatan instansi sendiri.
* **Solusi:**
  - Membuat migrasi `supabase/migrations/0013_certificate_template.sql` untuk menambahkan kolom `certificate_template_path` pada tabel `attendance_settings`.
  - Menambahkan panel pengaturan unggah berkas gambar template sertifikat secara visual di bagian atas halaman Penilaian Akhir (`app/dashboard/mentor/assessments/page.tsx`) yang memicu server action `uploadCertificateTemplateAction`.
  - Memperbarui halaman cetak sertifikat (`app/dashboard/intern/certificate/print/page.tsx`) agar membaca `certificate_template_path`. Jika diisi, layout cetak otomatis menonaktifkan border default, sudut ornamen emas, dan watermark graduation cap, lalu mengganti seluruh latar belakang dengan gambar template kustom Anda, sementara teks dinamis (Nama, Nilai, Predikat, Nomor Sertifikat) tetap ter-overlay dengan presisi pada kertas ukuran A4 landscape.

### **I. Integrasi Geofencing GPS Absensi & Lokasi Kantor (2 Juli 2026)**
* **Masalah:** Kehadiran peserta magang dapat dilakukan dari mana saja secara remote tanpa ada batasan jarak dari kantor Utero Academy.
* **Solusi:**
  - Membuat migrasi `supabase/migrations/0014_attendance_geofencing.sql` untuk menambahkan kolom `office_latitude`, `office_longitude`, `allow_geofencing`, dan `radius_meters` pada tabel `attendance_settings`.
  - Menyempurnakan panel Pengaturan Jam Kerja di dashboard absensi mentor (`app/dashboard/mentor/attendance/page.tsx`) dengan menambahkan formulir visual untuk mengatur koordinat kantor (Latitude/Longitude), radius aman absensi (dalam meter), dan tombol aktifkan/nonaktifkan pembatasan Geofencing.
  - Memperbarui Server Action check-in (`checkInAction`) dan check-out (`checkOutAction`) di `features/attendance/actions.ts` dengan menyertakan perhitungan jarak menggunakan rumus matematis Haversine. Jika Geofencing aktif dan jarak peserta melebihi radius aman (misal: 100 meter), permintaan absensi otomatis ditolak dengan informasi jarak deviasinya.

### **J. Pembenahan Statistik Absensi & Target Jam Bulanan (2 Juli 2026)**
* **Masalah:** Nilai persentase pemenuhan target jam magang di bulan aktif (`totalHoursThisMonth`) bernilai kosong/NaN pada panel detail absensi peserta magang, serta belum tersedianya input untuk memfilter riwayat absensi berdasarkan tanggal tertentu.
* **Solusi:**
  - Memperbaiki kueri pemetaan data pada `app/dashboard/mentor/attendance/page.tsx` untuk mengembalikan properti `totalHoursThisMonth` ke objek ter-render.
  - Menambahkan validasi pembagian dengan nol (`targetHours > 0`) untuk mencegah nilai `NaN` pada kalkulasi persentase pencapaian jam magang.
  - Mengintegrasikan input filter tanggal (`type="date"`) di samping tombol Pengaturan Jam Kerja pada panel atas absensi mentor agar pemantauan kehadiran harian spesifik dapat dilakukan secara instan.

---

## 4.1. Rilis Perbaikan & Fitur Baru (9 Juli 2026)

Fitur-fitur baru yang telah diselesaikan dalam sprint terbaru:

### **K. Export Rekapitulasi Absensi Bulanan ke Excel/CSV (9 Juli 2026)**
* **Masalah:** Mentor kesulitan membuat laporan rekapitulasi absensi peserta magang secara manual, terutama untuk ekspor data bulanan yang kompleks mencakup total jam, keterlambatan, izin, dan status pencapaian target.
* **Solusi:**
  - Membuat API endpoint `app/dashboard/mentor/attendance/export/route.ts` yang menghasilkan file CSV terstruktur berisi rekapitulasi absensi lengkap per peserta magang.
  - Endpoint mendukung dua mode ekspor: **Monthly** (ekspor seluruh data satu bulan berdasarkan parameter `?month=YYYY-MM`) dan **Range** (ekspor custom date range dengan parameter `?mode=range&start=YYYY-MM-DD&end=YYYY-MM-DD`).
  - CSV mencakup kolom: Nama, Email, Jurusan, No. HP, Periode, Tanggal Mulai, Tanggal Selesai, Total Hadir, Total Jam, Target Jam Bulanan, Mode Target, Status Target, Total Telat, Total Menit Telat, Total Izin, Total Sakit, Pending Review, dan Invalid.
  - Kalkulasi otomatis untuk total jam (dari check-in dan check-out), keterlambatan berdasarkan tolerance setting, dan status pencapaian target (Terpenuhi/Belum Terpenuhi).
  - Fitur UTF-8 BOM dan CSV escaping untuk kompatibilitas dengan MS Excel dan aplikasi spreadsheet lainnya.

### **L. Fitur Ubah Password Pengguna (9 Juli 2026)**
* **Masalah:** Pengguna tidak dapat mengubah password mereka sendiri dengan alur validasi yang aman.
* **Solusi:**
  - Membuat Server Action `features/auth/change-password-action.ts` yang menghandle validasi password lama, kesamaan password baru, dan verifikasi identitas pengguna melalui re-authentication dengan Supabase Auth.
  - Validasi ketat mencakup: minimal 8 karakter, password baru berbeda dari password lama, konfirmasi password cocok, dan password lama diverifikasi dengan sign-in ulang.
  - Integrasi ke halaman profil pengguna (`app/dashboard/profile/page.tsx`) agar setiap user dapat mengubah password mereka secara mandiri dengan aman.
  - Pesan error yang jelas dan user-friendly untuk setiap skenario validasi gagal.

### **M. PDF Preview Modal untuk Daily Report & Attachment (9 Juli 2026)**
* **Masalah:** Pengguna hanya melihat nama file attachment saja tanpa bisa preview konten PDF sebelum didownload, serta tidak ada visual indicator bahwa file tersebut adalah dokumen PDF.
* **Solusi:**
  - Membuat komponen Client `features/daily-reports/PDFPreview.tsx` yang menyediakan tombol "Lihat PDF" dengan icon file yang terlihat jelas.
  - Implementasi React Portal untuk merender modal preview PDF di atas semua elemen (z-index 9999) dengan backdrop blur semi-transparent.
  - Modal menampilkan embed iframe PDF viewer yang responsive dan mendukung zoom, scroll, dan download built-in dari browser.
  - Close button dan click-outside-modal-to-close untuk UX yang intuitif.
  - Reusable component dengan props `src` (URL file), `fileName` (nama display), dan `className` (custom styling).

### **N. Containerization dengan Docker & Nginx Reverse Proxy (9 Juli 2026)**
* **Masalah:** Aplikasi belum di-containerize untuk deployment yang konsisten di berbagai environment dan sulit untuk scaling.
* **Solusi:**
  - Membuat `Dockerfile` dengan multi-stage build: stage 1 build Next.js app, stage 2 runtime container yang lean berbasis Node.js alpine.
  - Konfigurasi environment variables, expose port 3000, dan health check endpoint untuk monitoring container status.
  - Membuat `docker-compose.yml` untuk orchestration lokal yang memudahkan development dan testing dengan volume mounts untuk hot-reload.
  - Membuat `nginx.conf` sebagai reverse proxy yang meforward traffic ke Next.js container, menangani static file caching, compression, dan security headers (HSTS, X-Content-Type-Options, X-Frame-Options).
  - Nginx dikonfigurasi listen di port 80 (HTTP) dengan kemampuan untuk diperluas ke HTTPS di production.

---
## 4.2. MVP Awal School Portal (9 Juli 2026)

### **O. Dashboard Sekolah, Daftar Siswa, dan Detail Siswa (9 Juli 2026)**
* **Penyelesaian:** Merapikan ulang portal sekolah agar memiliki alur MVP yang lebih jelas, dimulai dari halaman overview dashboard sekolah, halaman daftar siswa, dan halaman detail siswa terpisah.
* **Penyelesaian:** Menambahkan halaman `app/dashboard/school/students/page.tsx` untuk menampilkan daftar siswa dari instansi yang sama dengan fitur pencarian nama, email, dan jurusan.
* **Penyelesaian:** Menambahkan halaman `app/dashboard/school/students/[studentId]/page.tsx` untuk menampilkan ringkasan attendance rate, total jam, izin, sakit, profil intern, nilai akhir, sertifikat, serta riwayat kehadiran terbaru.
* **Penyelesaian:** Merapikan `features/school/queries.ts` menjadi query reusable untuk dashboard sekolah, daftar siswa, attendance, daily report, dan detail siswa.
* **Penyelesaian:** Menambahkan type khusus school portal di `features/school/types.ts` dan menyiapkan migrasi `supabase/migrations/0016_school_portal_reports.sql` untuk fondasi laporan periodik sekolah.

---
## 4.3. Manajemen Instansi Super Admin (9 Juli 2026)

### **P. CRUD Instansi dan Pengelolaan Relasi School Portal**
* **Penyelesaian:** Menambahkan halaman `app/dashboard/super-admin/schools/page.tsx` untuk menambah, mengedit, dan menghapus instansi sekolah/kampus partner tanpa perlu akses SQL manual.
* **Penyelesaian:** Menambahkan aksi `createSchoolAction`, `updateSchoolAction`, dan `deleteSchoolAction` di `features/super-admin/actions.ts` dengan audit log dan proteksi agar instansi yang masih punya perwakilan atau siswa tidak bisa dihapus langsung.
* **Penyelesaian:** Menambahkan query `getSuperAdminSchoolsData()` untuk menampilkan daftar instansi, jumlah perwakilan, dan jumlah siswa yang terhubung.
* **Penyelesaian:** Menambahkan navigasi Manajemen Instansi dari dashboard Super Admin dan halaman User Management agar alur tambah instansi lalu link user role `school` lebih jelas.

---
## 4.4. Link Siswa ke Instansi School Portal (9 Juli 2026)

### **Q. Penghubungan Intern ke Sekolah/Kampus dari Super Admin**
* **Penyelesaian:** Menambahkan aksi `linkInternToSchoolAction` untuk menghubungkan atau melepaskan siswa dari instansi melalui update `intern_profiles.school_id`.
* **Penyelesaian:** Menambahkan daftar siswa terhubung per instansi dan form **Link Siswa ke Instansi Ini** di halaman `app/dashboard/super-admin/schools/page.tsx`.
* **Penyelesaian:** Menambahkan indikator siswa yang belum terhubung ke instansi agar administrasi School Portal lebih mudah dibersihkan.

---
## 4.5. Phase 2 School Portal - Laporan Periodik (9 Juli 2026)

### **R. Generate dan Export Laporan Siswa Magang per Periode**
* **Penyelesaian:** Menambahkan query agregasi `getSchoolReportMetrics()` untuk menghitung metrik siswa per periode: attendance rate, total jam, keterlambatan, izin, sakit, dan nilai akhir.
* **Penyelesaian:** Menambahkan halaman `app/dashboard/school/reports/page.tsx` untuk form generate laporan dan riwayat laporan yang pernah dibuat.
* **Penyelesaian:** Menambahkan route `app/dashboard/school/reports/generate/download/route.ts` untuk generate dan download CSV laporan siswa secara real-time tanpa library eksternal.
* **Penyelesaian:** Menyimpan metadata laporan ke tabel `school_reports` agar school portal punya audit trail laporan yang pernah di-generate.

---
## 4.5. Tab Alumni Portal Sekolah & Cleanup Orphan Data (9 Juli 2026)

### **R. Filter Alumni di Portal Sekolah**
* **Penyelesaian:** Menambahkan tab filter Aktif/Alumni di halaman daftar siswa sekolah `app/dashboard/school/students/page.tsx`.
* **Penyelesaian:** Sekolah sekarang bisa melihat siswa dengan status `completed` (alumni) dan memantau track record mereka termasuk nilai akhir dan periode magang.
* **Penyelesaian:** Badge visual berbeda untuk status aktif vs alumni, serta kolom periode magang (start_date s/d end_date).

### **S. Tool Cleanup Orphan Data Super Admin**
* **Penyelesaian:** Menambahkan query `detectOrphanData` untuk mendeteksi data orphan: perwakilan sekolah tanpa user valid, siswa terhubung ke sekolah yang sudah dihapus.
* **Penyelesaian:** Menambahkan action `cleanupOrphanDataAction` untuk membersihkan data orphan secara massal atau selektif.
* **Penyelesaian:** Menambahkan halaman `app/dashboard/super-admin/orphan-cleanup/page.tsx` dengan UI deteksi dan cleanup otomatis data broken.
* **Penyelesaian:** Link navigasi dari dashboard Super Admin untuk akses mudah ke tool cleanup.

---
## 4.6. Manajemen Masa Magang Intern (9 Juli 2026)

### **S. Periode Magang, Progress, dan Sisa Hari Intern**
* **Penyelesaian:** Menambahkan aksi `updateInternPeriodAction` untuk mengatur tanggal mulai, tanggal selesai, jurusan, kelas/semester, dan status intern dari Super Admin.
* **Penyelesaian:** Menambahkan form edit masa magang per siswa di halaman `app/dashboard/super-admin/schools/page.tsx` agar periode magang bisa diisi setelah siswa terhubung ke instansi.
* **Penyelesaian:** Menambahkan card masa magang di dashboard intern (`app/dashboard/intern/page.tsx`) dengan progress persentase, hari berjalan, total hari, dan sisa hari.
* **Penyelesaian:** Menambahkan card masa magang di detail siswa School Portal (`app/dashboard/school/students/[studentId]/page.tsx`) agar sekolah dapat memantau progress periode magang setiap siswa.

---
## 4.7. Perapihan UI Manajemen Instansi (9 Juli 2026)

### **T. Layout Ringkas Berbasis Accordion untuk Instansi**
* **Penyelesaian:** Mengubah form Tambah Instansi Baru menjadi panel toggle agar halaman tidak langsung penuh oleh form input.
* **Penyelesaian:** Mengubah daftar instansi dari tabel lebar menjadi baris ringkas per instansi dengan tombol **Lihat Detail** untuk membuka informasi lengkap.
* **Penyelesaian:** Merapikan tampilan siswa terhubung menjadi card compact dengan detail masa magang yang bisa dibuka melalui accordion **Edit Masa Magang**.
* **Penyelesaian:** Mengurangi kebutuhan horizontal scroll dan membuat pengelolaan instansi lebih mudah dibaca oleh Super Admin.

## 4.8. Rilis Perbaikan, Optimalisasi Timezone, & Perapihan UI (10 Juli 2026)

### **U. Penguncian Tanggal Laporan Harian (Daily Report)**
* **Penyelesaian:** Menghapus form pemilih tanggal pada pembuatan laporan harian intern (`features/daily-reports/DailyReportForm.tsx`).
* **Penyelesaian:** Tanggal otomatis terkunci ke hari ini menggunakan zona waktu Asia/Jakarta (WIB) untuk melatih kedisiplinan pengisian laporan sebelum pulang.

### **V. Absensi Geofencing Out-of-Range**
* **Penyelesaian:** Memperbarui `checkInAction` di `features/attendance/actions.ts` dan `features/attendance/CheckInForm.tsx` untuk menangani deteksi jarak di luar radius kantor.
* **Penyelesaian:** Menyediakan formulir alasan (`outOfRangeReason`) dan unggah berkas bukti (`outOfRangeProof`) dengan kewajiban berfoto selfie. Jika disetujui mentor, status absensi akan diubah menjadi valid (dihitung hadir).

### **W. Izin Multi-Hari & Approval Flow**
* **Penyelesaian:** Mengubah form pengajuan izin/sakit (`features/attendance/PermitForm.tsx`) agar mendukung rentang tanggal (Mulai s.d. Selesai).
* **Penyelesaian:** Membuat tabel `permits` (`supabase/migrations/0017_out_of_range_and_multi_day_permits.sql`) dan antrean persetujuan (`features/attendance/PendingPermitsList.tsx`) di dashboard mentor. Mentor dapat mengedit tanggal selesai izin sebelum memberikan persetujuan yang secara otomatis menghasilkan entri absen harian di tabel `attendances`.

### **X. Perbaikan Timezone Tanggal Absensi**
* **Penyelesaian:** Mengganti semua format penentuan tanggal hari ini dari `.toISOString().slice(0, 10)` (UTC) menjadi berbasis Asia/Jakarta (`Intl.DateTimeFormat`) di seluruh logika absensi.

### **Y. Perapihan Tampilan UI/UX Responsif**
* **Penyelesaian:** Mengubah list absensi mentor (`app/dashboard/mentor/attendance/page.tsx`) dan daily report mentor (`features/daily-reports/MentorReportsManager.tsx`) menjadi grid responsif 2 kolom di layar HP.
* **Penyelesaian:** Merampingkan visual kartu profil, logo status, dan text wrap (`line-clamp-2 break-words`) untuk mencegah melubernya nama panjang.
* **Penyelesaian:** Mengubah stats grid modal detail absensi menjadi 2 kolom di layar HP dan membungkus form Export Rekap CSV ke dalam accordion details yang praktis.
* **Penyelesaian:** Memperbaiki teks tombol filter siswa school portal agar tetap kontras (putih) di atas warna biru.
* **Penyelesaian:** Menampilkan list role dinamis dari tabel `user_roles` di halaman edit profil (`app/dashboard/profile/page.tsx`).

### **Z. Resolusi Prerender Build Docker**
* **Penyelesaian:** Menambahkan `export const dynamic = "force-dynamic"` pada seluruh halaman publik dinamis agar Next.js tidak melakukan static prerendering saat runtime env Supabase belum di-mount pada proses Docker build.

### **AA. Visualisasi Grafik & Statistik Interaktif (Dashboard School & Intern)**
* **Penyelesaian:** Membuat komponen `StatsVisualization.tsx` berbasis custom SVG untuk merender visual grafik garis (*line chart*) dan diagram batang (*bar chart*) tanpa menggunakan package external tambahan.
* **Penyelesaian:** Mengintegrasikan grafik interaktif pada Dashboard Portal Sekolah (`app/dashboard/school/page.tsx`) untuk menampilkan statistik tren kehadiran siswa mingguan dan distribusi status akademik.
* **Penyelesaian:** Menambahkan grafik visual absensi pada halaman detail siswa portal sekolah (`app/dashboard/school/students/[studentId]/page.tsx`).
* **Penyelesaian:** Mengintegrasikan grafik pada Dashboard Intern (`app/dashboard/intern/page.tsx`) untuk visualisasi data penyelesaian tugas dan diagram absensi kehadiran.

### **AA. Visualisasi Grafik & Statistik Interaktif (Dashboard School & Intern)**
* **Penyelesaian:** Membuat komponen `StatsVisualization.tsx` berbasis custom SVG untuk merender visual grafik garis (*line chart*) dan diagram batang (*bar chart*) tanpa menggunakan package external tambahan.
* **Penyelesaian:** Mengintegrasikan grafik interaktif pada Dashboard Portal Sekolah (`app/dashboard/school/page.tsx`) untuk menampilkan statistik tren kehadiran siswa mingguan dan distribusi status akademik.
* **Penyelesaian:** Menambahkan grafik visual absensi pada halaman detail siswa portal sekolah (`app/dashboard/school/students/[studentId]/page.tsx`).
* **Penyelesaian:** Mengintegrasikan grafik pada Dashboard Intern (`app/dashboard/intern/page.tsx`) untuk visualisasi data penyelesaian tugas dan diagram absensi kehadiran.

---
## 5. Rencana Tahap Pengembangan Berikutnya (Revisi & Fitur Lanjutan)

Berdasarkan evaluasi terbaru dan file referensi gambar dari Anda, berikut adalah rancangan roadmap untuk tahap pengerjaan berikutnya:

### **Bagian 1: Manajemen Pengguna Premium (dashboard/super-admin/users)**
* **Tampilan Tabel Premium:** Merancang ulang antarmuka tabel pengguna agar memiliki fitur pencarian lanjutan, filter (Semua Role, Semua Status, Semua Login), serta kolom terstruktur: Nama, Email, Role, Login, Label/Kode, Status, Balance, Bergabung, dan Menu Aksi (...).
* **Menu Aksi (... Dropdown):** Menyediakan pilihan dropdown yang memicu popup modal untuk:
  - **Ubah Role** (penggantian role dinamis).
  - **Ubah Password** (reset/ubah kata sandi secara aman).
  - **Ubah Status** (mengaktifkan/menonaktifkan akun).
  - **Lihat Profil Detail** (khusus role intern untuk melihat rangkuman task, absensi, dan data akademik di halaman terpisah).
  - **Hapus User** (menghapus akun beserta data terkait).

<!-- Bagian 2 dipindahkan ke 4.8 karena sudah selesai -->

### **Bagian 3: Deprecate Penempatan (dashboard/admin/penempatan)**
* **Penyelesaian:** Menu penempatan mentor telah dinonaktifkan dan dihapus dari sidebar navigasi admin karena semua pengguna admin secara default dapat membimbing seluruh peserta magang secara global.

### **Bagian 4: Pengaturan Absensi Presisi (dashboard/mentor/attendance)**
* **Skop Khusus Intern:** Membatasi agar tabel peninjauan absensi hanya menampilkan pengguna dengan role intern saja.
* **Target Magang Bulanan Dinamis:** Mengubah sistem target bulanan agar dihitung dinamis berdasarkan jumlah hari kerja efektif (di mana hari minggu dikecualikan secara otomatis dari target jam magang).

### **Bagian 5: Pengelompokan & Ekspor Daily Report (dashboard/mentor/daily-reports)**
* **Grid Profil Intern:** Mengubah tampilan daily report mentor dari list memanjang menjadi grid profil anak magang (seperti absensi) agar lebih tertata per user.
* **Filter Waktu:** Menyediakan filter berbasis Harian, Mingguan, dan Bulanan.
* **Ekspor PDF Rekap:** Membuat fungsi untuk mencetak ringkasan rekapitulasi kinerja mingguan/bulanan per anak magang ke dalam dokumen PDF resmi.

### **Bagian 6: Kustomisasi Halaman Utama (CMS Website)**
* **CRUD Landing Page:** Menyediakan antarmuka manajemen di menu CMS admin agar pengelola dapat dengan mudah mengubah konten teks, gambar banner, info kompetensi, dan logo partner yang tampil di halaman depan website.

### **Bagian 8: Dashboard Analitik Admin**
* **Grafik Pendapatan & Metrik:** Menyusun dashboard admin utama yang dilengkapi dengan diagram garis tren (seperti di referensi Image #3) serta panel metrik total pengguna, tugas terselesaikan, dan statistik keaktifan.









