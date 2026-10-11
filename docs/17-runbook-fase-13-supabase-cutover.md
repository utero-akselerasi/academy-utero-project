# Runbook fase 13: pemisahan develop dan production

Status: 12 Oktober 2026. Cutover production masih **NO-GO**. Dokumen ini tidak memberi izin menjalankan migrasi pada server live.

## Mitigasi keamanan live (11 Oktober 2026)

- Atas permintaan perbaikan temuan 36 tabel tanpa RLS, develop dan production menerima perbaikan terarah dalam transaksi atomik: kolom `is_published` dari `0015`, policy dan RLS dari `0029–0030f`, pencabutan grant selimut dari `0031`, serta penguatan view/fungsi dari `0033`. Production juga mencabut default ACL lama milik `supabase_admin` sebelum `SET ROLE postgres` dalam transaksi yang sama. Sebelum setiap commit, rangkaian diuji dengan `ROLLBACK`. **Tidak ada baseline atau entri baru di `utero_academy.schema_migrations`.** Perubahan live ini tidak mencakup `0032a/0032b` maupun `0038–0046`.
- Backup sebelum perubahan: develop `/home/maskhar/academy-phase13-backups/2026-10-11/develop-pre-rls-fix.dump` SHA-256 `19930d74d6af1ef122d6825a97001f5fb228cc9921b35848a7ba641ab2b69136`; production `/home/maskhar/academy-phase13-backups/2026-10-11/production-pre-rls-fix.dump` SHA-256 `9c1e1c11ee663eb1aea1f17e1d99800f546adfebfa71dd345dd2d1d2385d3f57`. Ini rollback point database, bukan backup cutover final. Jangan restore langsung ke live tanpa analisis karena penulisan berlanjut.
- Query authenticated awal mengungkap `school_contacts` diperlukan sebagai subquery policy `intern_profiles`; kedua server diberi `GRANT SELECT` pada tabel tersebut. Policy `school_contacts_select` membatasi baris ke pemilik kontak dan staf. Perbaikan permanen ada di `0046_grant_school_contacts_policy_dependency.sql`, diuji pada kedua clone menggunakan transaksi yang di-rollback. Migrasi `0031` lama tetap tanpa perubahan checksum.
- Verifikasi kedua server: **0 dari 62 tabel tanpa RLS**, grant `anon` hanya `internship_applications:INSERT`, default ACL `anon` nol, serta 145 policy. Query baca-saja dengan role `authenticated` dan klaim peserta berhasil pada seluruh tabel sesi termasuk `school_contacts` dan `attendances`. Asersi `0034` lolos poin 1–7 setelah `0033`; hasil keseluruhan masih gagal di Storage: policy `storage.objects` lama longgar dan beberapa bucket shared-host tanpa batas. Jangan jalankan `0032a` pada seluruh Storage tanpa inventaris aplikasi lain, dan jangan sebut hardening Storage selesai.
- Mitigasi ini tidak membuktikan riwayat `0001–0037`, tidak menyelesaikan divergensi data, dan tidak membuka gate cutover. Lakukan smoke test interaktif dengan akun peserta, staf, dan sekolah; pantau error `42501`/`403` setelah pencabutan grant. Sebelum migrasi resmi, rekonsiliasi riwayat schema dan checksum dengan keadaan live baru.

## Kemajuan tahap 1 (11 Oktober 2026)

- Backup PostgreSQL develop dan production telah diperiksa hash-nya dan berhasil direstore pada PostgreSQL lokal. Restore develop mengabaikan objek extension `pg_cron` khusus instance karena extension itu hanya boleh dipasang pada database `postgres`; data tabel aplikasi dan Auth tetap direstore.
- Salinan Storage develop awal ada pada `/home/maskhar/academy-phase13-backups/2026-10-11/storage/develop/`. Berisi 4.312 berkas / sekitar 12 GB; hash isi per path dibandingkan dengan source dan **cocok saat pemeriksaan**. Backup ini belum konsisten lintas DB/Storage karena penulisan aplikasi masih aktif.
- Snapshot Storage production awal di `I:\academy-utero-backups\production\20261011-182300` telah dilanjutkan dengan run-id yang sama setelah SSH pulih. `manifest.json` tercipta, `.incoming` sudah dipromosikan menjadi `files`, dan verifikasi mandiri `--verify true` lulus untuk 2.346 file. SHA-256 manifest adalah `e80c3de492371b574e86c3c4ec0ed3c75eeb55a60f154992ed3327cc6cd04a9d`. Snapshot ini tetap belum konsisten lintas DB/Storage karena penulisan aplikasi belum dibekukan.
- Audit tabel memberi 161 attendance dan 126 daily report hanya di develop; 14 attendance dan 15 daily report hanya di production. Semua baris eksklusif ini memiliki `intern_profiles.id` induk pada kedua clone; itu **bukan** izin merge otomatis karena relasi lain dan histori penulisan masih harus diperiksa. Auth memiliki 1 user hanya di develop dan 2 hanya di production.
- Kedua dump mendapat uji migrasi `0038` sampai `0045` pada clone terpisah. Baseline `0001–0037` yang dipakai pada clone hanyalah alat pengujian migrasi baru, **bukan bukti** bahwa seluruh riwayat SQL lama sudah tercermin di server live. Jangan baseline server live tanpa pembuktian schema per versi.
- `0041–0045` menutup celah direct bypass/status seleksi, menambah approval admin onboarding, keputusan atomik, pembatasan jendela tes, dan perbaikan pemilik RPC. Tidak satu pun migrasi `0038–0046` diterapkan ke server live.
- Query baca-saja langsung melalui container `supabase-db` memastikan `utero_academy.schema_migrations` tidak ada pada develop maupun production. Kedua server hanya memiliki tracker migrasi milik komponen Supabase dan aplikasi lain. Audit kesesuaian schema repository `0001–0037` masih wajib sebelum baseline apa pun.
- **Temuan keamanan awal yang sudah dimitigasi:** asersi `0034_verify_hardening.sql` semula gagal pada kedua server: 36 tabel `utero_academy` tanpa RLS, dengan grant penuh untuk `anon` dan `authenticated` dalam schema Data API. Perbaikan dan verifikasi tercatat di bagian mitigasi live. Sisa risiko Storage dan cutover tetap **NO-GO**.
- Pada checkpoint awal sebelum mitigasi, dump `develop-pre-migration-615b39d7.dump` dibuat di `/home/maskhar/academy-phase13-backups/2026-10-11/` dengan SHA-256 `b623bcd70cafc0a97203ce9933036dd58e8058865b51a6492f1a914992081c05` (sekitar 5,2 MB). Saat itu belum ada migrasi live. Tracker `utero_academy.schema_migrations` tidak ada di develop; kesesuaian tiap versi `0001–0037` belum dibuktikan. Port publik `5432` memakai routing Supavisor, bukan jalur langsung PostgreSQL. Baseline/apply tetap ditunda sampai audit versi lama selesai; mitigasi di atas memakai koneksi langsung dalam container DB.

## Target tetap

| Lingkungan | Supabase | IP |
| --- | --- | --- |
| Develop | `https://supabase.carubra.com` | `20.20.20.173` |
| Production | `https://supabase.carubra.space` | `20.20.20.3` |

Build Docker wajib memakai target dan build secret yang cocok:

```powershell
docker build --build-arg DEPLOY_TARGET=develop --secret id=supabase_build_env,src=.env.develop -t academy-utero:develop .
docker build --build-arg DEPLOY_TARGET=production --secret id=supabase_build_env,src=.env.production -t academy-utero:production .
```

Secret build hanya memuat `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `NEXT_PUBLIC_APP_URL`. `SUPABASE_SERVICE_ROLE_KEY` hanya diberikan saat runtime. Verifier menolak domain yang tertukar dan runtime yang berbeda dari hasil build.

Untuk Compose lama, gunakan override `docker-compose.phase13.yml` tanpa menyunting `docker-compose.yml` lokal:

```powershell
$env:DEPLOY_TARGET='develop'
$env:SUPABASE_BUILD_ENV_FILE='.env.develop'
$env:SUPABASE_RUNTIME_ENV_FILE='.env'
docker compose -f docker-compose.yml -f docker-compose.phase13.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.phase13.yml build web
```

Sebelum memulai container, pastikan `.env` runtime menunjuk domain target yang sama dan memuat service-role key target. Untuk production, ganti target dan file build ke `production`/`.env.production`, lalu gunakan file runtime production tersendiri (jangan pakai `.env` develop). File `.env.*` diabaikan dari Docker context; BuildKit secret tetap dapat membacanya dari host. Jangan jalankan `up` sampai gate GO terpenuhi.

## Bukti backup awal

Backup ini snapshot awal, bukan backup cutover setelah write freeze.

| Target | Path host | SHA-256 |
| --- | --- | --- |
| Develop | `/home/maskhar/academy-phase13-backups/2026-10-11/develop-postgres.dump` | `48e2a27c30dbea952250c64f8e47f4cd30cc5fb2afc5c47ff624ea895568c81d` |
| Production | `/home/maskhar/academy-phase13-backups/2026-10-11/production-postgres.dump` | `ce44ab4c143556131ed483899d090c9fee92d7bd30728be525ad3a0a049c0988` |

Snapshot awal Storage kedua target sudah lengkap dan lolos verifikasi hash, tetapi belum konsisten dengan snapshot PostgreSQL karena write freeze belum dilakukan. Cutover dilarang sampai backup final PostgreSQL/Auth/Storage diambil dalam maintenance window dan hasil restore diverifikasi.

## Audit rekonsiliasi

### Audit konflik clone terbaru (11 Oktober 2026)

- Ekspor fresh pasca-RLS dari kedua server berhasil direstore ke clone `phase13_current_dev` dan `phase13_current_prod`. Migrasi `0038–0046` dan build lokal lulus; belum ada migrasi aplikasi live atau cutover.
- Absensi berbeda ID: 161 hanya-develop dan 14 hanya-production, tetapi 13 dari masing-masing memakai pasangan `(intern_id, attendance_date)` yang sama dengan isi berbeda. Artinya hanya 148 pasangan tanggal-peserta baru di develop dan 1 di production; 13 konflik wajib diputuskan per baris sebelum union. Pada 1.018 pasangan yang sama, isi selain timestamp audit cocok setelah normalisasi zona waktu.
- Laporan harian: 126 pasangan `(intern_id, report_date)` hanya-develop, 15 hanya-production; 891 pasangan bersama punya isi sama selain timestamp audit. Sebanyak 117 lampiran terkait laporan yang hanya ada di develop; verifikasi keberadaan objek Storage wajib sebelum migrasi data.
- Auth: 1 email digunakan oleh UUID berbeda di kedua server dengan hash password berbeda. Pemilik akun harus menentukan identitas yang dipertahankan, pemetaan referensi, dan prosedur login/reset aman. Jangan salin user atau hash password langsung.
- Laporan konflik berpseudonim tersimpan **di luar repo** pada `I:\academy-utero-backups\reconciliation-20261011\conflict-audit-redacted-20261011.json`; fingerprint bukan identitas yang bisa diputuskan tanpa akses ekspor terlindungi. Gunakan bersama operator dan pemilik data, jangan unggah ke repo.
- Gate Storage belum lulus: `avatars` dipakai bersama SoundPub, 3.230 URL penuh di develop dan 2.886 di production. Uji `0034` masih gagal akibat batas ukuran/MIME bucket shared-host. Pisahkan bucket Academy atau setujui dampak lintas aplikasi, lalu uji akses aplikasi sebelum perubahan live.
- Pada 11 Oktober gate rollout belum lulus: domain develop terpisah belum tersedia, `.env.develop`/`.env.production` belum siap, write freeze, backup final konsisten, pilot sekolah, dan keputusan pemilik konflik belum ada. Keputusan konflik dicatat pada 12 Oktober di bawah. **Production NO-GO; jangan jalankan `apply-union.sql` pada live.**

### Keputusan rekonsiliasi dan latihan clone (12 Oktober 2026)

- Pemilik sistem menyetujui production sebagai sumber utama untuk konflik. Kebijakan tidak menghapus data sumber: 13 versi absensi develop yang bertabrakan dan 1 akun Auth develop dengan email sama dikeluarkan dari merge; bukti ekspor tetap disimpan di lokasi backup terlindungi.
- Generator `scripts/reconcile-phase13-clone.mjs` hanya menerima nama database berawalan `phase13_reconciled_`, menolak output SQL di dalam repository, memeriksa jumlah sumber, dan menghentikan transaksi bila clone berubah. SQL ber-PII tersimpan di luar repo pada `I:\academy-utero-backups\reconciliation-20261011\apply-prod-wins-clone-20261012.sql`.
- Clone baru `phase13_reconciled_prod_20261012` dibuat dari `phase13_current_prod`. Rekonsiliasi menambah 148 absensi unik develop, 126 laporan harian unik, dan 117 lampiran. Tidak ada user Auth yang ditambah atau dihapus.
- Verifikasi pasca-merge: 1.180 absensi dengan 1.180 pasangan `(intern_id, attendance_date)` unik; seluruh 13 konflik memakai baris production; 1.032 laporan dengan 1.032 pasangan unik; 1.307 lampiran dan nol relasi laporan yatim; jumlah Auth tetap 209.
- Sebanyak 108 object path Storage unik milik 117 lampiran yang dimigrasikan merespons HTTP `206` dari Storage develop pada 12 Oktober 2026. Sembilan lampiran lain adalah URL eksternal. Ini membuktikan sumber dapat dibaca saat pemeriksaan, bukan bahwa objek sudah disalin ke Storage production.
- Akun Auth develop yang dikeluarkan tidak memiliki referensi foreign key pada schema `utero_academy` di clone develop. UUID production tetap menjadi akun utama; reset password hanya dilakukan saat rollout dengan kanal pemilik akun yang sah.
- Latihan ini menyelesaikan kebijakan konflik pada clone, tetapi belum menyelesaikan pemindahan objek Storage, isolasi bucket `avatars`, backup final saat write freeze, audit baseline `0001–0037`, domain develop, smoke interaktif, atau pilot sekolah. Production tetap **NO-GO**.

Jalankan baca-saja:

```powershell
$env:SUPABASE_DEV_SERVICE_ROLE_KEY='...'
$env:SUPABASE_PROD_SERVICE_ROLE_KEY='...'
npm run audit:supabase-reconciliation
```

Audit terakhir menemukan data bercabang: `attendances` hanya-develop 161 dan hanya-production 14; `daily_reports` hanya-develop 126 dan hanya-production 15; Auth hanya-develop 1 dan hanya-production 2. Storage juga belum parity, terutama bucket `avatars` dan `daily-report`. Jangan overwrite salah satu server.

## Uji migrasi clone

Snapshot production berhasil direstore ke PostgreSQL 17 lokal. Migrasi berikut berhasil dijalankan nyata dan berurutan:

- `0038_complete_intern_profile.sql`
- `0039_registration_selection_system.sql`
- `0040_secure_selection_answers.sql`

Verifikasi clone memastikan bucket `selection-answers` privat, fungsi deadline memakai `SECURITY INVOKER`, dan role `anon`/`authenticated` tidak memiliki hak tulis langsung ke attempt atau jawaban.

## Urutan cutover wajib

1. Sediakan lokasi backup Storage dan ruang cukup untuk kedua server.
2. Aktifkan maintenance/write freeze pada aplikasi develop dan production.
3. Ambil backup final PostgreSQL, Auth, konfigurasi, dan Storage; simpan hash dan uji restore.
4. Jalankan audit final. Rekonsiliasi setiap ID/path eksklusif memakai keputusan bisnis; jangan overwrite massal.
5. Clone backup production final. Baseline riwayat migrasi hanya setelah schema diverifikasi, lalu jalankan migrasi tertunda di clone.
6. Jalankan smoke test signup tiga jalur, tes seleksi, bypass super admin, onboarding, biodata, tanggal aktivasi, portal sekolah, signed URL, dan notifikasi.
7. Terapkan migrasi ke production dalam maintenance window. Jangan jalankan `--baseline` live tanpa bukti schema per versi.
8. Deploy image production yang lolos target verifier. Ulangi audit, smoke test, dan pantau error/outbox.
9. Buka write freeze setelah seluruh gate lulus.

## Rollback

- Hentikan aplikasi baru dan aktifkan maintenance kembali.
- Kembalikan image sebelumnya.
- Jika schema/data berubah dan rollback SQL tidak aman, restore backup final production ke instance pengganti, verifikasi Auth/Storage, lalu alihkan endpoint.
- Simpan database gagal untuk forensik; jangan restore snapshot awal 11 Oktober sebagai pengganti backup final.

## Gate GO

Production hanya boleh GO saat semua syarat terpenuhi: parity data yang disetujui, backup PostgreSQL/Auth/Storage final, restore test sukses, migrasi clone sukses, smoke test sukses, pilot sekolah sukses, dan rollback tervalidasi.
