# Checklist Go-Live Production

Dokumen ini menyiapkan pekerjaan operasional yang dapat dilakukan sebelum secret dan host live tersedia. Keputusan tetap **NO-GO** sampai env production lengkap, 11 evidence production lolos evaluator existing, dan operator serta reviewer menyetujui cutover. Tidak ada ambang persentase ruang disk untuk keputusan GO.

## Ringkasan Read-Only

Command berikut hanya membaca file lokal. Command tidak menjalankan network probe, tidak membuat atau mengubah file, tidak menampilkan nilai env, dan tidak melakukan cutover.

```powershell
npm run readiness:production -- `
  --env-file (Resolve-Path .env).Path `
  --checklist C:\secure\academy-evidence\uat-checklist.json
```

Hasil `PASS` hanya muncul jika dua pemeriksaan lulus:

1. Env lolos penuh `validateSelfhostedProductionEnv`: nilai wajib, placeholder, origin HTTPS, secure cookie, isolasi database, SMTP, signing secret, file TLS, dan optional cutover input. Nilai env tidak dicetak.
2. Checklist berisi tepat 11 jenis evidence dan lolos `evaluate-selfhosted-uat-gate.mjs`. Wrapper tidak menyalin, mengurangi, atau mengganti aturan evaluator tersebut.
Input dapat dihilangkan untuk melihat gap, tetapi status menjadi `NO-GO`. Error baca, file invalid, atau evaluator gagal juga menghasilkan `NO-GO` dan exit code non-zero. Disk penuh bukan alasan penolakan berbasis persentase; penulisan file, backup, atau database yang gagal tetap menghasilkan error dan memerlukan penanganan operator.

## 1. Isi dan Validasi Env

Gunakan satu file runtime root `.env`, dibuat dari satu-satunya template `.env.example`. `.env` diabaikan Git; jangan menimpa file nilai yang sudah ada tanpa backup. Jangan commit template yang telah diisi, secret, password, token, sertifikat, atau URL database berkredensial.

Isi `.env` di root repository dari `.env.example`; batasi akses file untuk akun operator. Jangan buat salinan env bernama lain di repository.

Ringkasan readiness menjalankan validator production existing secara langsung. Command validator berikut tetap berguna untuk pemeriksaan env secara terpisah:

```powershell
npm run validate:selfhosted-production-env -- --env-file (Resolve-Path .env).Path
```

Global status tidak dapat menjadi `PASS` bila validator env gagal. Placeholder, fixture, secret pendek atau sama, URL tidak aman, target database tidak cocok, SMTP invalid, dan file TLS yang hilang menghasilkan `NO-GO`.

## 2. Write Freeze dan Snapshot Final

Tetapkan maintenance window, rollback owner, operator, dan reviewer sebelum menyentuh production. Jangan menjalankan copy identity, migrasi, backup candidate, restore, atau perubahan writer production tanpa approval operasional yang tercatat.

Bekukan atau buktikan nonaktif untuk semua writer: web, API, scheduled jobs, edge functions, webhooks, legacy clients, dan direct uploads. Pastikan antrean kosong dan source write probe terblokir. Ambil snapshot sumber final hanya setelah freeze terverifikasi, lalu buat evidence `writeFreeze` dengan operator dan reviewer berbeda. Identity copy pada langkah berikutnya wajib memakai snapshot final yang sudah dibekukan; snapshot sebelum freeze tidak boleh dipakai untuk cutover.

## 3. Migrasi Identity-Only

Ikuti `docs/35-selfhosted-identity-only.md`. Urutan wajib:

1. Buat target PostgreSQL kosong dan jalankan migrasi skema.
2. Pakai `SOURCE_DATABASE_URL` read-only dan aktifkan hanya konfirmasi `CONFIRM_USER_PROFILE_COPY=copy-user-profiles-only` saat copy.
3. Konfirmasi evidence freeze dan approval masih berlaku, lalu jalankan `user-profile-copy` hanya pada snapshot final dari langkah sebelumnya.
4. Jalankan `identity-verify` dengan `IDENTITY_VERIFY_TARGET=production` sebelum bootstrap atau pemberian role.
5. Simpan evidence `identityOnlyMigration`; jangan membawa password, sesi, role assignment, data domain, atau storage lama.

## 4. Backup, Restore, dan Rollback

Ikuti `docs/31-selfhosted-backup-restore.md` pada backup production candidate satu generasi:

1. Buat backup database dan storage saat writer tertutup.
2. Salin ke media off-host berbeda dan verifikasi checksum.
3. Restore ke target terisolasi, bukan database live.
4. Verifikasi readiness, marker database/storage, signed URL, dan catat RTO/RPO.
5. Lakukan rollback rehearsal dan simpan evidence `backupRestore` serta `rollbackRehearsal` production yang belum kedaluwarsa.

## 5. UAT Lima Role

Siapkan akun terpisah untuk `super_admin`, `admin`, `school`, `intern`, dan `applicant`. Uji login positif, akses negatif lintas role/sekolah/pengguna, aktivasi akun, email, upload, signed URL private, LMS, attendance, report, task, dan audit log. Jalankan probe read-only performance sesuai `docs/33-selfhosted-uat-performance-gate.md` dan simpan evidence `rbacVerification`, `roleSmoke`, serta `readonlyUatPerformance`.

## 6. TLS, SMTP, Health, dan Monitoring

Pada host live, hasilkan evidence `tlsPreflight`, `smtpSmoke`, dan `opsHealth` memakai producer existing. Verifikasi alert benar-benar diterima operator untuk kegagalan API, database, backup, error rate, dan latency. Reviewer berbeda harus memeriksa source artifact sebelum membuat `monitoringReadiness`. Kegagalan tulis akibat disk penuh tetap insiden yang harus ditangani, bukan keberhasilan operasional.

## 7. Pilot dan Approval

Sebelum DNS cutover:

1. Jalankan pilot pada sekolah yang disetujui dengan data dan akun production terbatas.
2. Verifikasi journey utama, akses private, email, audit log, kapasitas, dan prosedur dukungan.
3. Catat hasil pilot, issue terbuka, rollback owner, TTL DNS, maintenance window, dan kanal insiden.
4. Operator dan reviewer berbeda memeriksa semua evidence serta menyetujui GO secara eksplisit.

## 8. Bangun dan Evaluasi Checklist

Kumpulkan tepat 11 evidence yang diwajibkan evaluator existing, lalu bangun checklist:

```powershell
node scripts/build-selfhosted-uat-checklist.mjs `
  --evidence-dir C:\secure\academy-evidence `
  --operator operator-a `
  --reviewer reviewer-b `
  --output C:\secure\academy-evidence\uat-checklist.json
```

Jalankan ringkasan akhir:

```powershell
npm run readiness:production -- `
  --env-file (Resolve-Path .env).Path `
  --checklist C:\secure\academy-evidence\uat-checklist.json
```

`PASS` bukan tindakan cutover otomatis. Setelah approval final, operator menjalankan DNS cutover secara terpisah, memantau health dan error rate, lalu menjalankan rollback bila acceptance criteria gagal.
