### Skenario I: Penilaian Akhir & Penerbitan Sertifikat Otomatis

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

