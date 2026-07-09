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
