# Runbook fase 13: pemisahan develop dan production

Status: 12 Oktober 2026. Cutover production masih **NO-GO**. Dokumen ini tidak memberi izin menjalankan migrasi pada server live.

## Point 6: production read-only preflight

`scripts/preflight-phase13-production.mjs` memakai HTTP `GET`, PostgreSQL `default_transaction_read_only=on` dengan `BEGIN READ ONLY`, dan SSH `df -Pk / /data`. Tidak membuat baseline atau mengubah production. Target terkunci ke production.

Operator menyimpan baseline JSON dari snapshot final yang disetujui setelah write freeze di lokasi terlindungi di luar repo. Bentuk wajib: `{"target":"production","counts":{"auth.users":209,"utero_academy.attendances":1180,"utero_academy.daily_reports":1032,"utero_academy.daily_report_attachments":1307,"storage.objects:academy-private":417},"minFreeKiB":10485760,"rlsSha256":"<64 hex>","policiesSha256":"<64 hex>","bucketsSha256":"<64 hex>"}`. Angka di sini **contoh, bukan baseline sah**. `counts` wajib memuat seluruh tabel yang dicek dan semua bucket dengan object. Digest adalah SHA-256 dari JSON baris terurut hasil query masing-masing untuk RLS, policy Academy/Storage, dan bucket; bandingkan bukti dari snapshot terpercaya. Jangan menghasilkan baseline langsung dari hasil preflight live lalu menyebutnya valid.

Jalankan hanya bila kredensial tersedia dan host key SSH sudah dipercaya:

```powershell
$env:SUPABASE_PROD_URL='https://supabase.carubra.space'
$env:SUPABASE_PROD_DATABASE_URL='postgresql://...@20.20.20.3/postgres'
$env:SUPABASE_PROD_SERVICE_ROLE_KEY='...'
$env:PHASE13_PROD_SSH_USER='operator'
node scripts/preflight-phase13-production.mjs 'I:\secure-evidence\phase13-production-baseline.json'
```

Exit `0` hanya bila delta data nol, kedua mount `/` dan `/data` cukup ruang, seluruh tabel Academy tetap RLS-enabled, digest RLS/policy/bucket cocok, serta Auth/REST/Storage/PostgreSQL/SSH dapat dihubungi. Baseline hilang, timeout, respons tidak valid, perbedaan, atau HTTP non-2xx menghasilkan exit nonzero. Jangan ubah baseline untuk meluluskan gate; investigasi dan minta persetujuan pemilik data/keamanan.

## Latihan staging terisolasi 12 Oktober 2026

Verifier readiness memeriksa Auth lewat `GET /auth/v1/admin/users?page=1&per_page=1` dengan service-role, bukan endpoint settings publik. Tracker migrasi dicek keberadaannya dengan `to_regclass` dalam transaksi baca-saja; jika tidak ada, hasilnya `migrationTrackerExists: false`, seluruh versi repo hilang, dan status NO-GO. Pemeriksaan ini tidak membuat tracker maupun baseline. Bahkan tracker lengkap hanya bukti catatan versi, bukan pembuktian efek historis SQL; audit baseline terpisah tetap wajib sebelum cutover.

- Instance `supabase-02` di server production diaktifkan **sebagai staging terpisah**, bukan `supabase-01` production. Data awal instance kosong untuk Academy dan Storage. Snapshot sebelum restore staging disimpan di `/data/supabase/instances/supabase-02/academy-staging-pre-rehearsal-20261012T110258Z/` (dump PostgreSQL dan archive Storage beserta SHA-256); konfigurasi awal disimpan pada `config-pre-academy-staging-20261012T103646Z.tgz`. Jangan hapus volume instance lain.
- Gateway staging `8100` serta port pooler `5532/6643` sekarang hanya bind `127.0.0.1` di server. Operator memakai tunnel SSH `127.0.0.1:18100` ke gateway dan `127.0.0.1:15532` ke database; tanpa tunnel, staging tidak dapat diakses dari workstation. Pada awal latihan gateway sempat terbuka lewat HTTP IP publik dan sejumlah objek disalin. `JWT_SECRET`, anon key, dan service-role key staging kemudian dirotasi; token service-role lama terbukti ditolak HTTP 400 dan token baru diterima HTTP 200. Tetap tinjau akses dan batasi staging PII sebelum pilot. Jangan gunakan kredensial staging untuk develop/production.
- `0047` dan asersi pengganti host-aware `0048` lulus di staging serta dalam transaksi rollback pada clone. `0048` hanya mengasersi bucket Academy; **tidak** menandai `0032a/0032b/0034` sebagai telah diterapkan, tidak mengubah `avatars` SoundPub, dan tidak mengizinkan replay historis pada server bersama. Runner migrasi kini menolak `--baseline` tanpa bukti, menolak replay historis ke schema Academy yang sudah ada, dan `--status` baca-saja ketika tracker belum ada.
- Tiga allowlist cocok: 417 `avatars` production, 1.693 `avatars` develop, dan 108 `daily-report` develop. Pada staging, ketiganya sudah disalin dan **2.218 path diverifikasi SHA-256/ukuran** melalui tunnel. Storage production memberi HTTP 500 `ENODATA` pada mayoritas objek karena extended attribute tidak ada; 415 objek diambil dari salinan backup production yang diverifikasi manifest SHA-256, dua objek sisanya cocok lewat API. Jangan mengubah extended attribute server production tanpa audit/rollback. Snapshot backup production **bukan** backup final saat write freeze.
- Staging menerima salinan terbatas dari clone rekonsiliasi: 209 user Auth dan schema/data `utero_academy`; Storage metadata tetap utuh. Migrasi `0038–0048` dijalankan satu per satu di staging. Tidak ada migrasi atau deploy Academy pada server live. Instance staging sekarang mengandung PII; aksesnya harus tetap terbatas dan data harus dihapus aman setelah latihan selesai.
- Smoke Storage staging berhasil untuk selfie masuk/keluar, bukti luar lokasi, surat sakit, izin, avatar, dan lampiran laporan; tiap probe mengecek unduhan service-role, signed URL, serta penolakan akses publik/anon. CV, portofolio, dan template sertifikat belum memiliki contoh path di clone; status **missing**, bukan passed. Signup/onboarding/interaktif sekolah dan SoundPub end-to-end belum diuji. Verifier readiness staging masih **NO-GO**: tracker `schema_migrations` historis tidak ada dan bucket Academy lain belum lengkap.
- Validasi repository setelah patch: **912 tes**, typecheck, lint CI, dan build Next.js lulus. Build khusus target staging juga lulus melalui verifier yang hanya menerima endpoint Supabase `127.0.0.1:18100` dan URL aplikasi loopback. Peluncuran server lokal dari harness ditolak kebijakan proses, sehingga ini bukti build, bukan smoke UI interaktif. Pada staging lama, template `roles.sql` awal tidak menyelaraskan password TCP; lima role internal diselaraskan melalui parameter SQL dan koneksi network untuk empat role diuji berhasil. `verify:phase13-readiness -- staging` tetap gagal (HTTP 503 intermiten pada endpoint Auth lewat CLI; tracker migrasi historis pun belum ada), sehingga **jangan** menyebut staging siap cutover.
- Audit baca-saja kedua clone menghasilkan digest katalog Academy yang sama tetapi `baselineProven=false` untuk 43 migrasi historis `0001–0037`; tracker tidak ada. Production live saat pemeriksaan tetap memiliki RLS pada 62/62 tabel Academy, bucket `avatars` SoundPub tetap public, dan empat policy Storage selimut lama tidak ada. Pemeriksaan itu tidak membuktikan seluruh baseline ataupun seluruh alur SoundPub.
- **Jangan lanjutkan langkah 7–8 production** sebelum: replay/diff schema historis dan keputusan adopsi migrasi terbukti; selesaikan contoh tiga kategori smoke dan tes SoundPub; siapkan domain/env deploy terpisah; tulis jadwal serta pemilik write freeze dan pilot; lakukan backup final PostgreSQL/Auth/Storage yang konsisten dan uji restore; audit delta pasca-freeze; jalankan rollback instance pengganti. Server production hanya punya sekitar 8 GiB kosong di root; backup final harus memakai `/data` atau lokasi lain yang cukup. Restore backup awal saat penulisan masih berjalan tidak valid sebagai rollback cutover.

## Isolasi Storage Academy: tahap persiapan 12 Oktober 2026

- `0047_isolate_academy_storage_bucket.sql` membuat bucket privat `academy-private` dengan batas 20 MiB dan MIME gambar/PDF/DOCX. Migrasi tidak mengubah bucket `avatars` atau policy SoundPub. Pengujian pada clone `phase13_reconciled_prod_20261012` lulus dua kali (idempoten); hash policy SoundPub sebelum dan sesudah tetap sama. Pengujian pada clone develop dibatalkan dengan `ROLLBACK`. Belum dijalankan pada server live.
- Aplikasi sudah disiapkan untuk menulis file Academy baru ke `academy-private` dan menandatangani URL dari bucket tersebut. URL legacy `avatars` tetap dapat diparsing sebagai path, **tetapi tidak ada fallback baca jaringan ke bucket bersama**. Jangan deploy perubahan aplikasi sebelum semua objek lama disalin dan diverifikasi pada target Storage yang benar.
- Inventaris referensi `avatars` Academy pada clone production hasil rekonsiliasi: 2.115 referensi atau 2.110 object path unik. Sebanyak 417 path tersedia pada Storage production, 1.693 hanya tersedia pada Storage develop, dan nol hilang dari keduanya. Dari 391 path yang ada di keduanya, ukuran dan eTag metadata sama; verifikasi hash byte tetap wajib saat copy. Planner menghasilkan `production-paths.txt` (digest `99910c5017796e7e8969226dc4b8ab1028f9908391f40c8ed64efe4c4d4f023e`) dan `develop-paths.txt` (digest `be096b1c224a0f83b13e6e80cd8800cfa5e2e70ade7826ec58b5a5464360d67b`) pada `I:\academy-utero-backups\storage-isolation-20261012-planner-v3\`. ACL direktori dan kedua file telah diverifikasi protected, masing-masing hanya tiga rule: operator, SYSTEM, dan Administrators. Inventaris hanya snapshot saat audit; lakukan ulang sesudah write freeze.
- Khusus 117 lampiran laporan harian yang ditambahkan ke clone: 108 object path Storage semuanya ada di develop dan **nol** ada di production; sembilan lampiran lain berupa URL eksternal. Allowlist `daily-report-from-develop.paths` tersimpan pada direktori planner yang sama, digest `d0dbacc3009746702b5990e0ba9f20ed28e3c2a602a163aff61b16b2d758e4c5`, dengan ACL protected tiga rule. Copy bucket `daily-report` develop ke bucket bernama sama di production wajib dilakukan sebelum deploy, terpisah dari isolasi `avatars`.
- `scripts/copy-supabase-storage.mjs` menyediakan dry-run, allowlist path, hash SHA-256/ukuran setelah copy, dan resume. Jangan menyalin seluruh bucket `avatars` milik bersama; mode apply mewajibkan allowlist dan state privat. Tanpa target Storage staging terpisah serta kredensial service-role target yang diverifikasi, **jangan gunakan `--apply true` pada develop maupun production**.
- `0032a` dan `0032b` historis masih berisiko untuk SoundPub: keduanya memodifikasi policy/bucket bersama. Asersi `0034` juga mencakup bucket aplikasi lain dan belum lulus. Isolasi Academy saja tidak menyelesaikan gate ini; perlu pengganti migrasi host-aware beserta audit SoundPub dan pembuktian baseline sebelum apply live.

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

- Latihan dan validator rollback khusus staging ada di `docs/18-rollback-staging-phase13.md` dan `npm run verify:phase13-rollback-staging -- <evidence.json> <snapshot.dump> <storage.tar> <config.tgz>`. Validator mengunci instance pengganti ke gateway `18200`, DB `15632`, dan app `3100`; port source staging `18100/15532` serta production ditolak sebelum koneksi.
- Hentikan aplikasi baru dan aktifkan maintenance kembali.
- Kembalikan image sebelumnya.
- Jika schema/data berubah dan rollback SQL tidak aman, restore backup final production ke instance pengganti, verifikasi Auth/Storage, lalu alihkan endpoint.
- Simpan database gagal untuk forensik; jangan restore snapshot awal 11 Oktober sebagai pengganti backup final.

## Gate GO

Production hanya boleh GO saat semua syarat terpenuhi: parity data yang disetujui, backup PostgreSQL/Auth/Storage final, restore test sukses, migrasi clone sukses, smoke test sukses, pilot sekolah sukses, dan rollback tervalidasi.
