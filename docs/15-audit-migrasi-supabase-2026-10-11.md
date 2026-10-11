# Audit Migrasi Supabase — 11 Oktober 2026

Audit dilakukan baca-saja melalui REST, Auth Admin API, dan Storage API. Tidak ada data, schema, user, atau file yang diubah.

## Target

- Lama/dev: `supabase.carubra.com` (`20.20.20.173`)
- Baru/calon utama: `supabase.carubra.space` (`20.20.20.3`)

Kunci service-role yang tersedia diterima kedua endpoint. PostgreSQL port `5432` dan `6543` terbuka pada kedua IP, tetapi repository belum memiliki `DATABASE_URL`, sehingga audit langsung PostgreSQL belum dilakukan.

## Hasil Database

| Data | Lama | Baru | Kesimpulan |
| --- | ---: | ---: | --- |
| Auth users | 208 | 209 | 1 ID lama tidak ada di baru; 2 ID hanya ada di baru |
| user_profiles | 29 | 29 | ID dan isi sama |
| intern_profiles | 44 | 44 | ID dan isi sama |
| roles | 5 | 5 | ID dan isi sama |
| user_roles | 27 | 27 | ID dan isi sama |
| schools | 5 | 5 | ID dan isi sama |
| attendances | 1.179 | 1.032 | 161 ID lama hilang; 14 ID hanya ada di baru |
| daily_reports | 1.017 | 906 | 126 ID lama hilang; 15 ID hanya ada di baru |
| audit_logs | 73 | 73 | ID dan isi sama |

Perbedaan tekstual timestamp `+07:00` dan `+00:00` sudah dinormalisasi ke instan UTC. Pada tabel yang diperiksa rinci (`roles`, `user_roles`, `schools`, `intern_profiles`, `attendances`, `daily_reports`, `audit_logs`), baris dengan ID sama tidak memiliki perubahan isi; perbedaan utama adalah baris yang hanya ada pada salah satu server.

Data terbaru memperlihatkan server telah bercabang:

- Attendance lama terbaru: `2026-10-11T09:50:41.521079+07:00`
- Attendance baru terbaru: `2026-10-09T10:29:47.427049+00:00`
- Daily report lama terbaru: `2026-10-10T23:48:47.638979+07:00`
- Daily report baru terbaru: `2026-10-09T11:58:59.234973+00:00`

## Hasil Storage

- Kedua server mempunyai 25 bucket dengan nama dan flag public/private yang sama.
- Scan `avatars`: server lama memiliki sedikitnya 2.178 objek sebelum batas audit tercapai; server baru selesai dipindai dengan 466 objek.
- Bucket sensitif `avatars`, `daily-report`, `task`, dan `learning` masih berstatus public pada kedua server. Migrasi hardening repository belum diterapkan.

## Keputusan

Database baru **belum aman dijadikan sumber utama**. Menyalin lama ke baru secara overwrite juga tidak aman karena server baru sudah memiliki data eksklusif.

Cutover perlu rekonsiliasi berbasis primary key:

1. Bekukan penulisan pada kedua aplikasi atau tetapkan satu sumber tulis.
2. Ambil backup penuh PostgreSQL, Auth, dan Storage dari kedua server.
3. Gabungkan baris hanya-di-lama dan hanya-di-baru berdasarkan kebijakan bisnis.
4. Tangani konflik Auth user terpisah; jangan membuat UUID baru untuk profil yang sudah berelasi.
5. Sinkronkan Storage berdasarkan bucket dan object path, lalu verifikasi checksum atau ukuran.
6. Jalankan migrasi repository secara berurutan di staging baru.
7. Ulangi audit count, ID set, foreign key, RLS, Auth login, signed URL, dan alur peserta sebelum mengganti env aplikasi.

## Biodata Peserta

`0038_complete_intern_profile.sql` menambahkan data kontak dan RPC transaksi untuk menyimpan `user_profiles` serta `intern_profiles` bersamaan. Peserta wajib melengkapi identitas, kontak, jurusan, tingkat, nama sekolah/kampus, alamat, dan guru/dosen pembimbing. Email bersumber dari akun Auth dan hanya dibaca. Nama sekolah yang diisi peserta **tidak** mengubah `school_id` terverifikasi milik admin. Kontak darurat opsional, tetapi nama dan nomor harus diisi bersama.

Kode dashboard baru mengarahkan peserta dengan biodata belum lengkap ke `/dashboard/profile`. **Jangan deploy kode baru sebelum migrasi 0038 diterapkan di target yang benar**, setelah migrasi sebelumnya dan verifikasi keamanan. Jika tidak, dashboard peserta akan terus redirect karena kolom baru belum ada. Migrasi ini hanya disiapkan di repo; belum diterapkan pada kedua server.
