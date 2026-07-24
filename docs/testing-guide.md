# Panduan Pengujian Fitur & Perbaikan Utero Academy (10 Juli 2026)

Dokumen ini menjelaskan langkah-langkah untuk melakukan pengujian mandiri terhadap seluruh perbaikan bug, pembaruan timezone, formulir dinamis, dan perbaikan tampilan responsif yang telah selesai dikerjakan.

---

## 1. Prasyarat Pengujian (Prerequisites)

Sebelum mulai menguji di browser:
1. **Terapkan SQL Migration:**
   Salin dan jalankan seluruh isi file migrasi \supabase/migrations/0017_out_of_range_and_multi_day_permits.sql\ ke dalam SQL Editor di Dashboard Supabase Anda (https://supabase.carubra.com).
2. **Build & Jalankan Docker Container:**
   Jalankan perintah berikut di terminal:
   \\\ash
   docker compose up -d --build
   \\\
   Proses build dijamin akan berhasil tanpa memicu error prerender halaman publik lagi (karena halaman dinamis telah diatur ke \orce-dynamic\).

---

## 2. Skenario Pengujian Fitur

### Skenario A: Penguncian Tanggal Laporan Harian (Daily Report)
1. Login menggunakan akun dengan role \intern\.
2. Buka menu **Laporan Harian** (\/dashboard/intern/daily-reports\).
3. Tekan tombol **Kirim Laporan Harian** atau edit laporan yang berstatus perlu revisi.
4. **Verifikasi:** 
   - Kolom pemilihan tanggal sudah tidak ada lagi (tidak bisa diklik/dipilih mundur).
   - Sistem menampilkan tulisan statis yang informatif: \[Tanggal Hari Ini] (Hari Ini) - Harus dikirim hari ini sebelum pulang\.
   - Mengisi laporan baru akan otomatis tersimpan untuk hari berjalan.

### Skenario B: Absensi Geofencing Out-of-Range (Luar Jangkauan Kantor)
1. Login menggunakan akun dengan role \intern\.
2. Buka menu **Absensi** (\/dashboard/intern/attendance\) atau klik widget status absensi di Beranda.
3. Simulasikan lokasi GPS Anda berada di luar radius kantor (misal: kurangi parameter radius di pengaturan atau letakkan koordinat dummy di browser developer tools).
4. Tekan tombol **Check In Sekarang**.
5. **Verifikasi Warning:** 
   - Sistem akan memunculkan box peringatan berwarna jingga: *"Kamu di luar jangkauan Kantor. Mohon segera mendekat ke lokasi kantor yang sudah di tentukan oleh Pengurus atau Mentor Magang."*
   - Tombol utama check-in akan disembunyikan sampai Anda melakukan konfirmasi.
6. **Kirim Kegiatan Luar:**
   - Tekan tombol **Saya Sedang Kegiatan Luar**.
   - Isi formulir **Alasan Kegiatan** (min. 5 karakter, misal: *Mengikuti Kunjungan Industri Sekolah*).
   - Unggah berkas pendukung pada input **Bukti Dokumen (PDF/Gambar)**.
   - Ambil foto selfie wajib lewat kamera, lalu tekan **Check In Sekarang**.
7. **Verifikasi di Akun Mentor:**
   - Login menggunakan akun \mentor\ atau \dmin\.
   - Masuk ke menu **Kelola & Review Absensi** (\/dashboard/mentor/attendance\).
   - Cari nama intern bersangkutan. Kartu absen akan menampilkan status peninjauan.
   - Klik tombol **Detail Absen**.
   - **Verifikasi UI Baru:** Perhatikan kartu Check-In masuk telah dirancang ulang menggunakan layout minimalis (border bersih, text wrap, status check-in, info GPS terstruktur). Terdapat box peringatan kuning bertuliskan *"⚠️ Absen di Luar Jangkauan Kantor"* lengkap dengan Alasan dan Tautan Dokumen Bukti Kegiatan.
   - Klik **Approve** (Valid). Maka status absensi berubah menjadi Valid dan kehadiran dihitung hadir penuh.

### Skenario C: Pengajuan Izin / Sakit Multi-Hari (Multi-Day Permits)
1. Login menggunakan akun dengan role \intern\.
2. Buka menu **Absensi** (\/dashboard/intern/attendance\) dan gulir ke bagian **Form Izin / Sakit**.
3. **Verifikasi Input:**
   - Kolom **Tanggal Mulai** dan **Tanggal Selesai** kini tampil bersandingan.
   - Pilih rentang tanggal (misal: 3 hari ke depan).
   - Masukkan alasan izin (misal: *Menjaga orang tua sakit keras*).
   - Unggah surat keterangan (wajib jika memilih opsi Sakit), lalu submit.
4. **Persetujuan & Modifikasi oleh Mentor:**
   - Login menggunakan akun \mentor\ atau \dmin\.
   - Masuk ke menu **Kelola & Review Absensi** (\/dashboard/mentor/attendance\).
   - Di bagian atas list siswa, cari panel baru **"Antrean Izin / Sakit Menunggu Approval"**.
   - Periksa data pengajuan siswa.
   - **Verifikasi Pengeditan Selesai:** Mentor dapat memperpendek/memperpanjang tanggal selesai izin pada input tanggal sebelum menyetujui.
   - Tekan tombol **Approve**.
   - Buka kembali **Detail Absen** siswa tersebut.
   - **Verifikasi Absensi Otomatis:** Periksa riwayat kehadiran harian siswa. Sistem secara otomatis membuat entri absensi berstatus "Izin" atau "Sakit" pada setiap tanggal dalam rentang hari yang disetujui tanpa perlu siswa absen manual setiap hari.

### Skenario D: Perbaikan Timezone Tanggal Absensi
1. Lakukan check-in/check-out atau pengiriman izin pada pagi hari (misal jam 06:00 - 08:00 WIB).
2. **Verifikasi:** Tanggal yang tercatat di database dan di riwayat kehadiran adalah tanggal hari berjalan (sesuai WIB/GMT+7), bukan tanggal kemarin.

### Skenario E: Tampilan Responsif HP (Mobile Layout)
1. Aktifkan simulasi tampilan HP (*Chrome DevTools Device Mode* atau buka via HP langsung).
2. Masuk ke halaman-halaman berikut:
   - **Mentor Attendance** (\/dashboard/mentor/attendance\)
   - **Mentor Daily Reports** (\/dashboard/mentor/daily-reports\)
3. **Verifikasi:**
   - Daftar kartu profil peserta magang tampil rapi dalam susunan **2 kolom** yang pas, tidak lagi menumpuk 1 kolom memanjang.
   - Nama panjang (misal: *Muhammad Toyfur Dita Ramadan*) melipat rapi ke baris berikutnya (*word wrapping*) dan tidak meluber keluar dari batas kartu.
   - Pada modal detail absensi siswa, 4 kotak statistik utama (Lama Magang, Rate, dll.) tersusun seimbang dalam format petak 2x2.
   - Menu **Export Rekap CSV** kini diringkas rapi di dalam accordion details yang hemat ruang.


### Skenario F: Visualisasi Grafik & Statistik (School Portal & Intern Dashboard)
1. **Verifikasi Dashboard Sekolah:**
   - Login menggunakan akun perwakilan sekolah (`school` role).
   - Masuk ke **School Portal Dashboard** (`/dashboard/school`).
   - **Verifikasi Grafik:** Anda akan melihat bagian grafik visual interaktif baru:
     - **Tren Kehadiran Siswa:** Line chart yang memetakan perkembangan rata-rata absensi mingguan.
     - **Distribusi Status Siswa:** Bar chart berwarna biru cerah yang menunjukkan distribusi status akademik siswa (Total, Aktif, Alumni, Perlu Perhatian).
     - Arahkan kursor (*hover*) pada poin/batang grafik untuk memunculkan *tooltip popup* angka detail.
2. **Verifikasi Detail Siswa (School Portal):**
   - Di Dashboard Sekolah, cari bagian **Siswa Terbaru** dan klik **Detail** pada salah satu nama siswa.
   - **Verifikasi Grafik:** Di atas profil siswa, perhatikan bagan batang **"Distribusi Absensi Kehadiran Siswa"** yang menggambarkan secara visual jumlah hari Hadir, Izin, dan Sakit siswa tersebut.
3. **Verifikasi Dashboard Intern:**
   - Login menggunakan akun dengan role `intern`.
   - Masuk ke **Beranda Dashboard** (`/dashboard/intern`).
   - **Verifikasi Grafik:** Gulir ke bagian bawah ringkasan widget. Anda akan melihat dua grafik visual:
     - **Distribusi Kehadiran:** Menampilkan jumlah kehadiran fisik, izin, dan sakit secara visual.
     - **Status Penyelesaian Tugas:** Menampilkan progres tugas yang Selesai vs Pending dalam diagram batang.

### Skenario G: Manajemen Pengguna Premium (Super Admin)
1. **Verifikasi Filter Tambahan:**
   - Login menggunakan akun `super_admin`.
   - Masuk ke menu **User & Role** (`/dashboard/super-admin/users`).
   - **Verifikasi Filter Login:** Coba gunakan dropdown **Filter Login** (Pernah Login vs Belum Pernah Login) untuk melihat efektivitas pencarian pengguna yang tidak aktif.
2. **Verifikasi Aksi Premium Dropdown:**
   - Klik ikon **tiga titik vertikal (...)** pada salah satu pengguna.
   - **Verifikasi Dropdown React Portal:** Pastikan menu dropdown tidak terpotong oleh tabel (tampil mulus melayang di atas konten).
   - Klik opsi **Edit Profil** untuk mencoba menonaktifkan pengguna sementara.
   - Klik opsi **Ubah Password** untuk memicu modal popup peresetan kata sandi.
   - Jika pengguna memiliki role `intern`, klik **Lihat Profil Detail** untuk memastikan halaman profil mendetail dimuat sempurna dengan visualisasi chart.
   - Jika diperlukan, klik opsi **Hapus User** yang memicu peringatan merah penghapusan permanen (pastikan menggunakan data *dummy* jika ingin mengujinya hingga tuntas).

### Skenario H: Dashboard Analitik Admin Utama
1. **Akses Dashboard Admin:**
   - Login menggunakan akun dengan role `admin`.
   - Masuk ke dashboard utama pengelola (`/dashboard/admin`).
   - **Verifikasi Layout & Metrik:** Dasbor kini tidak lagi me-redirect ke halaman pendaftaran, melainkan menyajikan halaman statistik beranda utama:
     - Banner penyambutan gradasi warna hijau teal/emerald yang gagah.
     - 4 buah kartu metrik statistik utama: **Peserta Aktif** (intern), **Instansi Partner** (sekolah/kampus), **Total Tugas** (checklist selesai), dan **Rata Kehadiran** (persentase rate global).
2. **Verifikasi Grafik Visual:**
   - Di bagian tengah dashboard, pastikan dua grafik utama dirender dengan sempurna:
     - **Keaktifan Absensi Mingguan:** Grafik garis (line chart) tren absensi harian.
     - **Progress Pengerjaan Tugas:** Grafik batang (bar chart) perbandingan tugas selesai vs pending.
     - Arahkan kursor (*hover*) pada poin/batang grafik untuk memverifikasi fungsionalitas tooltip angka detail.
3. **Verifikasi Alur Log & Pintasan:**
   - Buka bagian **Aktivitas Absensi Terbaru** untuk melihat log check-in riil terakhir peserta magang.
   - Coba klik menu pengelola di sisi kanan: **Pendaftaran Magang**, **Website CMS**, dan **Super Admin** untuk memastikan navigasi cepat berfungsi lancar.### Skenario I: Penilaian Akhir & Penerbitan Sertifikat Otomatis

#### 1. Mentor/Admin Memberikan Penilaian
1. **Akses Halaman Penilaian:**
   - Login menggunakan akun dengan role `admin` atau `mentor`.
   - Masuk ke menu **Penilaian & Sertifikat** (`/dashboard/mentor/assessments`).
   
2. **Verifikasi Halaman Utama:**
   - Pastikan tabel menampilkan daftar peserta magang aktif dengan kolom: Nama, Jurusan, Email, Nilai Akhir, Status Penilaian, dan Aksi.
   - Peserta yang belum dinilai menampilkan badge merah **"BELUM DINILAI"**.
   - Peserta yang sudah dinilai menampilkan nilai final dan badge status (**DRAFT** atau **FINALIZED**).
   
3. **Verifikasi Upload Template Sertifikat Kustom:**
   - Di bagian atas halaman, terdapat panel **Custom Template Sertifikat Magang**.
   - Coba upload file gambar (PNG/JPG) sebagai background template sertifikat.
   - Setelah berhasil, pastikan muncul link **"✓ Template aktif saat ini: Lihat Template"**.

4. **Beri Penilaian Peserta:**
   - Klik tombol **Beri Nilai** pada salah satu peserta magang.
   - Modal penilaian akan muncul dengan form interaktif.
   
5. **Verifikasi Form Penilaian Dinamis:**
   - **Kriteria Penilaian Custom:** Secara default akan muncul 3 kriteria (technical, discipline, attitude).
   - Klik tombol **+ Tambah Kriteria** untuk menambah kriteria baru (misal: "communication", "teamwork").
   - Isi nama kriteria dan skor (0-100) untuk setiap aspek.
   - Klik icon **trash** untuk menghapus kriteria yang tidak diperlukan.
   - Isi **Catatan Evaluasi / Rekomendasi** dengan feedback untuk peserta (minimal beberapa kalimat).

6. **Simpan sebagai Draft:**
   - Klik tombol **Simpan Draft** untuk menyimpan penilaian sementara tanpa finalisasi.
   - **Verifikasi:** Penilaian tersimpan dengan status **DRAFT** dan nilai final muncul di tabel.
   - Buka kembali modal penilaian dan pastikan data yang disimpan masih dapat diedit.

7. **Finalisasi Penilaian:**
   - Edit penilaian yang masih draft.
   - Pastikan semua kriteria dan feedback sudah lengkap.
   - Klik tombol **Finalisasi** (icon centang hijau).
   - **Verifikasi Konfirmasi:** Muncul dialog konfirmasi: *"Apakah Anda yakin ingin mem-finalisasi penilaian? Aksi ini akan menerbitkan sertifikat magang otomatis dan tidak dapat diubah lagi."*
   - Klik **OK** untuk melanjutkan.

8. **Verifikasi Setelah Finalisasi:**
   - Status penilaian berubah menjadi **FINALIZED** dengan badge hijau.
   - Nilai final terhitung otomatis (rata-rata dari semua kriteria).
   - Tombol aksi berubah menjadi **Detail** (read-only).
   - Sertifikat otomatis diterbitkan dengan nomor unik (format: `CERT/UA/[TAHUN]/[RANDOM]`).

#### 2. Intern Melihat & Mengunduh Sertifikat

1. **Akses Halaman Sertifikat:**
   - Login menggunakan akun dengan role `intern`.
   - Masuk ke menu **Sertifikat Saya** (`/dashboard/intern/certificate`).

2. **Verifikasi Sertifikat Belum Terbit:**
   - Jika penilaian belum difinalisasi, akan muncul pesan:
     - Icon peringatan kuning dengan teks **"Sertifikat Belum Diterbitkan"**.
     - Penjelasan: *"Evaluasi penilaian akhir Anda sedang dalam proses oleh admin/pembimbing."*

3. **Verifikasi Sertifikat Sudah Terbit:**
   - Setelah mentor melakukan finalisasi, halaman akan menampilkan:
     - **Transkrip Nilai Evaluasi** (sisi kiri):
       - Daftar kriteria penilaian dengan progress bar visual (0-100).
       - Contoh: Keterampilan Teknis, Kedisiplinan, Sikap & Kerja Sama.
       - Feedback pembimbing ditampilkan dalam box khusus dengan style italic.
     - **Ringkasan Nilai Akhir** (sisi kanan):
       - Nilai rata-rata final ditampilkan besar dengan font bold.
       - Badge status **"LULUS PROGRAM"** berwarna hijau.
       - Box sertifikat resmi dengan:
         - Icon sertifikat animasi bounce.
         - Nomor sertifikat unik.
         - Tanggal penerbitan.
         - Tombol **Cetak Sertifikat PDF** dengan icon printer.

4. **Cetak Sertifikat PDF:**
   - Klik tombol **Cetak Sertifikat PDF**.
   - Halaman akan membuka tab baru (`/dashboard/intern/certificate/print`).
   - **Verifikasi Layout Cetak:**
     - Halaman otomatis memicu dialog print browser (`window.print()`).
     - Layout sertifikat A4 landscape dengan border elegan atau background template custom.
     - Informasi yang ditampilkan:
       - Header: Logo Utero Academy dan "SERTIFIKAT KELULUSAN RESMI".
       - Nomor sertifikat unik.
       - Nama peserta (bold, underline).
       - Keterangan kelulusan program magang.
       - **Nilai Akhir** dan **Predikat** dalam box highlight.
       - Tanda tangan digital pembimbing dan Direktur Utero Group.
     - Jika template custom diupload, background akan menggunakan gambar tersebut.
     - Jika tidak ada template, tampil border ganda teal, ornamen sudut emas, dan watermark graduation cap.

5. **Verifikasi Print CSS:**
   - Saat melakukan print preview:
     - Ukuran halaman: **A4 Landscape** (297mm x 210mm).
     - Margin: **0** (full bleed).
     - Border sertifikat rapat tidak terpotong.
     - Text tetap terbaca jelas dengan warna yang sesuai.
     - Tidak ada header/footer browser default.

#### 3. School Portal Melihat Sertifikat Siswa

1. **Akses Detail Siswa:**
   - Login menggunakan akun dengan role `school`.
   - Masuk ke **School Portal Dashboard** (`/dashboard/school`).
   - Klik **Detail** pada salah satu siswa dari instansi yang sama.

2. **Verifikasi Data Sertifikat:**
   - Di halaman detail siswa (`/dashboard/school/students/[studentId]`), gulir ke bagian **Penilaian & Sertifikat**.
   - Jika siswa sudah lulus dan mendapat sertifikat:
     - Tampil **Nilai Akhir** dengan angka besar.
     - Tampil **Nomor Sertifikat** dan **Tanggal Terbit**.
     - Badge status **LULUS** berwarna hijau.
   - Jika belum ada sertifikat, tampil pesan: *"Belum ada penilaian akhir untuk siswa ini."*

#### 4. Super Admin Monitoring Sertifikat

1. **Lihat Profil Detail Intern:**
   - Login sebagai `super_admin`.
   - Masuk ke **User & Role** (`/dashboard/super-admin/users`).
   - Filter pengguna dengan role **intern**.
   - Klik icon **...** (dropdown), pilih **Lihat Profil Detail**.

2. **Verifikasi Data Assessment:**
   - Halaman detail intern akan menampilkan:
     - Ringkasan tugas dan absensi.
     - **Status Penilaian Akhir**: Draft/Finalized/Belum Dinilai.
     - **Nilai Final** jika sudah dinilai.
     - **Nomor Sertifikat** jika sudah diterbitkan.

#### 5. Testing Edge Cases

1. **Validasi Input:**
   - Coba input nilai di luar range (negatif atau > 100): Harus muncul error.
   - Coba submit tanpa mengisi feedback: Harus muncul error validasi.
   - Coba tambah kriteria dengan nama kosong: Harus muncul error.

2. **Finalisasi Ganda:**
   - Setelah finalisasi, coba buka kembali modal penilaian.
   - **Verifikasi:** Semua input field disabled, tombol edit hilang, hanya tombol **Tutup** tersedia.
   - Pesan info: *"Penilaian telah difinalisasi. Sertifikat magang otomatis telah terbit."*

3. **Delete Protection:**
   - Coba hapus peserta yang sudah punya sertifikat dari Super Admin.
   - **Verifikasi:** Sistem harus menghapus cascade dengan benar (assessment → certificate).

4. **Template Custom:**
   - Upload template dengan ukuran besar (>5MB): Verifikasi apakah upload berhasil atau ada limit.
   - Hapus template (upload template baru): Verifikasi sertifikat berikutnya menggunakan template terbaru.
   - Jika template tidak ada: Verifikasi default design tetap bagus dengan border & ornamen.

