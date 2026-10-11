# Runbook fase 13: pemisahan develop dan production

Status: 11 Oktober 2026. Cutover production masih **NO-GO**. Dokumen ini tidak memberi izin menjalankan migrasi pada server live.

## Kemajuan tahap 1 (11 Oktober 2026)

- Backup PostgreSQL develop dan production telah diperiksa hash-nya dan berhasil direstore pada PostgreSQL lokal. Restore develop mengabaikan objek extension `pg_cron` khusus instance karena extension itu hanya boleh dipasang pada database `postgres`; data tabel aplikasi dan Auth tetap direstore.
- Salinan Storage develop awal ada pada `/home/maskhar/academy-phase13-backups/2026-10-11/storage/develop/`. Berisi 4.312 berkas / sekitar 12 GB; hash isi per path dibandingkan dengan source dan **cocok saat pemeriksaan**. Backup ini belum konsisten lintas DB/Storage karena penulisan aplikasi masih aktif.
- Snapshot Storage production awal diarahkan ke `I:\academy-utero-backups\production\20261011-182300` menggunakan `scripts/backup-supabase-storage.mjs`. Transfer awal mencapai 2.346 file, tetapi SSH tar mengembalikan kode 2 saat sumber live dibaca; segera sesudah itu SSH `20.20.20.3:22` timeout. Berkas berada di `.incoming` dan **belum terverifikasi**. Setelah SSH pulih, ulangi perintah dengan run-id sama; tool menghitung ulang hash dan hanya mengirim file hilang/berubah. Hasil baru dianggap backup valid ketika `manifest.json` tercipta dan `--verify true` lulus. Jangan hapus `.incoming` atau menganggap staging sebagai backup final.
- Audit tabel memberi 161 attendance dan 126 daily report hanya di develop; 14 attendance dan 15 daily report hanya di production. Semua baris eksklusif ini memiliki `intern_profiles.id` induk pada kedua clone; itu **bukan** izin merge otomatis karena relasi lain dan histori penulisan masih harus diperiksa. Auth memiliki 1 user hanya di develop dan 2 hanya di production.
- Kedua dump mendapat uji migrasi `0038` sampai `0045` pada clone terpisah. Baseline `0001–0037` yang dipakai pada clone hanyalah alat pengujian migrasi baru, **bukan bukti** bahwa seluruh riwayat SQL lama sudah tercermin di server live. Jangan baseline server live tanpa pembuktian schema per versi.
- `0041–0045` menutup celah direct bypass/status seleksi, menambah approval admin onboarding, keputusan atomik, pembatasan jendela tes, dan perbaikan pemilik RPC. Tidak satu pun migrasi ini diterapkan ke server live.
- Setelah SSH pulih, jalankan `npm run backup:supabase-storage -- --target production --source /data/supabase/instances/supabase-01/config/volumes/storage --destination I:\academy-utero-backups --user maskhar --run-id 20261011-182300`, lalu `npm run backup:supabase-storage -- --verify true --target production --destination I:\academy-utero-backups --run-id 20261011-182300`.

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

Storage belum memiliki backup penuh. Develop sekitar 12 GB dan production sekitar 11 GB. Cutover dilarang sampai lokasi backup dengan kapasitas cukup tersedia dan hasil restore diverifikasi.

## Audit rekonsiliasi

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
