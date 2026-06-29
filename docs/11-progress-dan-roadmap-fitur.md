# Progres Implementasi & Rencana Pengembangan Fitur

Dokumen ini mencatat seluruh fitur yang telah diperbaiki, dikembangkan, serta rencana langkah pengembangan berikutnya.

---

## 1. Fitur & Perbaikan yang Telah Diselesaikan

### A. Autentikasi & Manajemen Sesi (Session Persistency)
* **Penyelesaian Masalah Sesi Terputus / Auto-Logout:**
  * Memanfaatkan file `proxy.ts` di root sebagai Middleware Next.js untuk memperbarui dan menyelaraskan token sesi Supabase Auth pada setiap request.
  * Memperbaiki halaman `/login` agar mendeteksi otomatis jika pengguna telah login dan mengarahkannya langsung ke dashboard yang sesuai (Intern, Mentor, School, Admin, Superadmin) tanpa meminta kredensial ulang.
* **Perbaikan Hak Akses & Mengatasi Admin Terpental (RLS Recursion Fix):**
  * Memperbaiki fungsi `getUserRoleCodes` di `features/auth/roles.ts` agar menggunakan Service Role Client saat memvalidasi role dari server. Ini memecahkan bug rekursi tak terbatas (infinite recursion) pada tabel `user_roles` di database PostgreSQL akibat implementasi RLS (Row Level Security) yang memanggil function check-role.
  * Memperbaiki `ProtectedDashboardLayout.tsx` agar menu sidebar dan label role memuat data yang sesuai dengan role aktif pengguna, bukan elemen default pertama dari daftar role yang diizinkan. Ini mencegah Admin Academy melihat menu Super Admin (seperti modul tambah pengguna) dan menghindari Admin terpental ke halaman login.

### B. Dashboard Penempatan Mentor (Admin Academy & Super Admin)
* **Penayangan Data Peserta Magang & Mentor:**
  * Menulis ulang query pada `features/admin/queries.ts` (`getActiveInterns`, `getMentors`, dan `getMentorAssignments`) dengan memisahkan pemanggilan data tabel utama (seperti `user_roles` dan `user_profiles`) dan menggabungkannya secara manual di memori server.
  * Solusi ini sukses mem-bypass batasan PostgREST yang sebelumnya gagal melakukan JOIN karena tidak adanya relasi Foreign Key langsung antara `user_roles` ke `user_profiles` dan dari `mentor_profiles` ke `user_profiles`.

### C. Laporan Harian (Daily Report - Intern & Mentor)
* **Pengunggahan Banyak File (Multi-File Upload):**
  * Memperbarui input form daily report untuk mendukung multi-file upload (`multiple`).
  * Membatasi ukuran berkas maksimal 1MB per file dengan indikasi visual merah di UI client-side dan validasi server-side.
* **Integrasi Tautan Google Drive (Fallback File Besar):**
  * Menyediakan kolom input link Google Drive opsional yang menjadi wajib (required) diisi apabila anak magang mengunggah berkas lebih dari 1MB.
  * Tautan Google Drive ini akan disimpan langsung ke tabel `daily_report_attachments` dengan properti `mime_type: "url"`, sehingga secara otomatis terintegrasi dengan tampilan daftar lampiran yang sudah ada.
* **Fitur Edit Revisi Laporan:**
  * Mengaktifkan tombol **Edit Revisi** pada daftar riwayat laporan jika statusnya `revision_requested`.
  * Membuka form edit dengan mengisi data default laporan yang akan direvisi, menampilkan lampiran lama, serta mereset status laporan kembali ke `submitted` agar mentor dapat melakukan peninjauan kembali.
* **Preview Gambar Lampiran:**
  * Mendeteksi tipe lampiran (ekstensi gambar atau `mime_type` gambar) dan langsung merendernya sebagai preview gambar (`<img />`) di halaman riwayat laporan (Intern) dan halaman review laporan (Mentor), bukan hanya sekadar tautan teks.
* **Penyelesaian Error Review Mentor:**
  * Memperbaiki query `getMentorDailyReports` di `features/daily-reports/queries.ts` dengan melakukan mapping metadata nama user secara manual di memori server untuk mengatasi error join RLS.

### D. Manajemen Tugas (Task Board & Kanban - Mentor & Intern)
* **Fitur Delete/Hapus:**
  * Menambahkan aksi `deleteBoardAction` untuk menghapus board tugas di dashboard mentor.
  * Menambahkan aksi `deleteCardAction` untuk menghapus task card di dashboard detail board mentor.
* **Fitur Assign/Penugasan:**
  * Menambahkan select dropdown berisi peserta magang aktif saat membuat task card baru.
  * Menambahkan form update penugasan (`assignCardToInternAction`) langsung pada task card di halaman detail board mentor.
* **Otomatisasi Daily Report ke Task Board:**
  * Setiap kali peserta magang mengirimkan daily report (baru maupun edit), sistem secara otomatis membuat atau memperbarui task card di list pertama pada board bimbingan mentor yang bersangkutan. Card memuat judul tanggal laporan, nama anak magang, serta deskripsi pekerjaan harian dan tautan Google Drive-nya.
* **Resolusi Error Render Server Components & Storage Upload:**
  * Menggunakan `createUteroAcademyServiceRoleClient` untuk membaca/menulis data card/tugas di backend guna mem-bypass batasan RLS pada database yang tidak memiliki select policy.
  * Menggunakan `createSupabaseServiceRoleClient` di server action untuk mengunggah file bukti tugas ke bucket storage `"task"`, menghindari error *403 Forbidden* pada bucket private.

---

## 2. Rencana Pengembangan Fitur Berikutnya

Berikut adalah daftar fitur yang disiapkan untuk tahap implementasi selanjutnya:
1. **LMS (Learning Management System):**
   * Pengembangan modul kursus/materi, kuis, tugas kelas, pelacakan kemajuan pelajaran (lesson progress), dan penilaian tugas oleh mentor.
2. **Review Absensi Harian:**
   * Peningkatan fungsionalitas bagi mentor dan sekolah untuk melihat log absensi harian peserta magang (waktu check-in, check-out, foto kamera, dan lokasi).
3. **Penilaian Akhir (Assessment) & Sertifikat:**
   * Fitur bagi mentor untuk mengisi formulir evaluasi akhir kinerja anak magang.
   * Pembuatan sertifikat magang otomatis dalam format PDF yang dapat diunduh langsung oleh peserta magang yang telah menyelesaikan masa baktinya.
4. **Portal Pemantauan Sekolah (School Portal):**
   * Halaman pemantauan khusus bagi instansi sekolah/kampus asal peserta magang untuk meninjau status absensi, laporan harian, penilaian mentor, dan sertifikat mahasiswa mereka.
