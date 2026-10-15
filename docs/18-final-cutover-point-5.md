# Point 5 — Cutover Final

Status awal selalu **NO-GO**. Dokumen ini menyiapkan mekanisme; tidak memberi izin menjalankan perubahan production.

## Maintenance dan write freeze

1. Jadwalkan window, operator utama, reviewer, pencatat waktu, dan kanal insiden.
2. Siapkan `/opt/academy-maintenance/maintenance.html` tanpa aset eksternal. Halaman harus menyebut layanan sementara tidak tersedia, waktu evaluasi berikutnya, dan kanal bantuan.
3. Review `scripts/final-cutover-maintenance.nginx.conf` terhadap konfigurasi deployment aktual. Uji pada clone/staging: `GET /healthz` harus `200`; seluruh URL aplikasi harus halaman maintenance; `POST`, `PUT`, `PATCH`, dan `DELETE` harus tidak mencapai aplikasi.
4. Saat window disetujui, operator mengaktifkan include maintenance di proxy, menjalankan `nginx -t`, lalu reload. Bukti write freeze wajib mencakup request tulis UI, API, upload Storage, job/cron, webhook, dan worker. Jika satu jalur masih menulis, hentikan cutover.
5. Catat `freezeAt` dan `expiresAt`. Gate menolak bukti yang belum aktif atau kedaluwarsa.

## Backup final di `/data`

Gunakan run ID unik dan direktori privat, contoh `/data/academy-cutover/20261012-220000`. Jangan simpan secret atau backup PII di repository.

```sh
install -d -m 0700 /data/academy-cutover/20261012-220000
pg_dump --format=custom --file=/data/academy-cutover/20261012-220000/postgres.dump "$PRODUCTION_DATABASE_URL"
# Ekspor Auth dan konfigurasi sesuai deployment self-hosted; jangan cetak secret ke terminal/log.
node scripts/backup-supabase-storage.mjs --target production --source /absolute/storage/path --destination /data/academy-cutover --user backup_reader --run-id 20261012-220000
sha256sum /data/academy-cutover/20261012-220000/* > /data/academy-cutover/20261012-220000/SHA256SUMS
```

Backup baru valid setelah restore ke instance pengganti, verifikasi login Auth, metadata/object Storage, RLS, dan smoke test. Jangan restore ke live sebagai uji.

## Checklist operator

Salin JSON berikut ke luar repository. Isi hash file nyata; jangan menandai gate `true` berdasarkan rencana.

```json
{
  "target": "production",
  "status": "NO-GO",
  "freezeAt": "2026-10-12T15:00:00Z",
  "expiresAt": "2026-10-12T16:00:00Z",
  "pilotSchoolId": "school-id",
  "rollbackCommand": "docker compose -p academy-replacement -f /data/academy-cutover/RUN_ID/rollback-compose.yml up -d",
  "gates": {
    "maintenancePageReviewed": false,
    "baselineReplay": false,
    "stagingReadiness": false,
    "smokeTest": false,
    "productionPreflight": false,
    "dataDeltaReconciled": false,
    "developWriteFreezeVerified": false,
    "productionWriteFreezeVerified": false,
    "databaseBackupVerified": false,
    "authBackupVerified": false,
    "configBackupVerified": false,
    "storageBackupVerified": false,
    "restoreDrillPassed": false,
    "rollbackDrillPassed": false,
    "pilotSchoolApproved": false
  },
  "artifacts": [
    { "kind": "postgres", "path": "/data/academy-cutover/RUN_ID/postgres.dump", "sizeBytes": 1, "capturedAt": "2026-10-12T15:10:00Z", "sha256": "64-hex" },
    { "kind": "auth", "path": "/data/academy-cutover/RUN_ID/auth.dump", "sizeBytes": 1, "capturedAt": "2026-10-12T15:10:00Z", "sha256": "64-hex" },
    { "kind": "config", "path": "/data/academy-cutover/RUN_ID/config.tar", "sizeBytes": 1, "capturedAt": "2026-10-12T15:10:00Z", "sha256": "64-hex" },
    { "kind": "storage", "path": "/data/academy-cutover/RUN_ID/storage-manifest.json", "sizeBytes": 1, "capturedAt": "2026-10-12T15:10:00Z", "sha256": "64-hex" }
  ],
  "reports": [
    { "kind": "baselineReplay", "path": "/data/academy-cutover/RUN_ID/baselineReplay.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "stagingReadiness", "path": "/data/academy-cutover/RUN_ID/stagingReadiness.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "smokeTest", "path": "/data/academy-cutover/RUN_ID/smokeTest.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "rollbackDrill", "path": "/data/academy-cutover/RUN_ID/rollbackDrill.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "productionWriteFreeze", "path": "/data/academy-cutover/RUN_ID/productionWriteFreeze.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "finalBackupRestore", "path": "/data/academy-cutover/RUN_ID/finalBackupRestore.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "productionPreflight", "path": "/data/academy-cutover/RUN_ID/productionPreflight.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "dataDeltaReconciled", "path": "/data/academy-cutover/RUN_ID/dataDeltaReconciled.json", "sizeBytes": 1, "sha256": "64-hex" },
    { "kind": "pilotSchool", "path": "/data/academy-cutover/RUN_ID/pilotSchool.json", "sizeBytes": 1, "sha256": "64-hex" }
  ]
}
```

Setiap artifact wajib memuat `sizeBytes` dan `capturedAt`; waktu capture harus berada antara `freezeAt` dan `expiresAt`. Setiap entri report juga wajib memuat `sizeBytes` nyata. Setiap isi report JSON wajib memuat `gate`, `status: "PASS"`, `exitCode: 0`, command asli, `startedAt`, `finishedAt`, target yang benar, serta operator dan reviewer berbeda. Report `productionWriteFreeze`, `finalBackupRestore`, `productionPreflight`, `dataDeltaReconciled`, dan `pilotSchool` wajib seluruhnya berada dalam window freeze. Report pilot juga wajib memuat `pilotSchoolId` yang sama dengan checklist. Preflight menghasilkan JSON probe, bukan report gate: reviewer harus mencocokkan output asli dengan wrapper report terpisah sebelum memberi PASS. Hash dan ukuran mengikat file ke checklist, tetapi tidak membuktikan report tidak dipalsukan; reviewer tetap wajib mencocokkan report dengan log sumber/read-only probe. Verifier sengaja tidak pernah mengubah hasil ini menjadi GO.

Ubah `status` ke `EVIDENCE_READY` hanya setelah file bukti lengkap. Validasi hanya membaca file lokal, gagal tertutup, dan **tidak pernah mengeluarkan GO**:

```sh
node scripts/final-cutover-gate.mjs --checklist /data/academy-cutover/RUN_ID/checklist.json --backup-root /data/academy-cutover/RUN_ID
```

## Pilot satu sekolah

Pilih satu sekolah dengan PIC tersedia. Jalankan login sekolah, daftar peserta, aktivasi akun, biodata, upload/download signed URL, seleksi, status/nilai, notifikasi, dan audit log. Pantau `4xx/5xx`, error RLS `42501`, antrean/outbox, latensi, serta duplikasi data. PIC sekolah dan operator wajib menyetujui bukti sebelum `pilotSchoolApproved=true`. Kegagalan apa pun mempertahankan maintenance dan status NO-GO.

## Rollback

Rollback memakai image lama dan restore backup final ke **instance pengganti**, bukan overwrite live. Perintah konkret disimpan dalam checklist dan harus lolos drill. Urutan: aktifkan/pertahankan maintenance, hentikan traffic ke aplikasi baru, jalankan instance pengganti, restore PostgreSQL/Auth/konfigurasi/Storage, verifikasi hash dan smoke, lalu alihkan endpoint. Simpan instance gagal untuk forensik.

Jangan buka maintenance sebelum audit pasca-cutover, pilot, dan rollback gate seluruhnya lulus. Keluaran `EVIDENCE_FILES_VALID_NOT_GO` hanya membuktikan konsistensi file lokal, bukan autentisitas bukti, freeze nyata, maupun izin cutover. Keputusan tetap NO-GO sampai operator dan reviewer memverifikasi bukti langsung dan menandatangani keputusan terpisah.

## Kunci langkah 7–8 production

**ABORT tanpa mutasi production** jika salah satu gate baseline, readiness, smoke staging, rollback staging, atau preflight production gagal/tidak tersedia. Gate harus dijalankan dengan konfigurasi target yang benar dan keluaran asli disimpan di luar repo bersama waktu, operator, command, exit code, serta digest SHA-256. Jangan menganggap JSON checklist sebagai hasil probe. Periksa juga bukti parity data, schema historis, restore clone, domain/env terpisah, dan keputusan konflik bisnis. Jangan menjalankan migrasi, deploy, atau copy ke production sebelum semua bukti pra-cutover diverifikasi reviewer.

Setelah semua gate pra-cutover lulus dan window disetujui: aktifkan write freeze pada **semua** jalur penulisan; buktikan tidak ada tulis tertunda; ambil backup final konsisten PostgreSQL/Auth/konfigurasi/Storage di `/data` dan uji restore ke instance pengganti; ulang audit delta setelah freeze; copy hanya delta allowlist yang sudah diverifikasi SHA-256; jalankan migrasi production; deploy image terverifikasi; ulang audit dan smoke production; lakukan pilot satu sekolah; pantau error/outbox; baru putuskan membuka freeze. Kegagalan tahap mana pun: ABORT, pertahankan maintenance, ikuti rollback instance pengganti. Jangan restore snapshot pra-freeze ke live.

Bukti nyata yang **belum tersedia di repository ini**: log lulus baseline/readiness/smoke/rollback/preflight terbaru, bukti freeze semua writer, backup final konsisten pasca-freeze dan restore teruji, audit delta final, domain/env production terpisah terverifikasi, hasil pilot dan persetujuan sekolah, serta perintah rollback spesifik deployment yang sudah diuji. Karena itu langkah 7–8 tetap NO-GO.

## Point 7 — keputusan audit kesiapan

Keputusan per 12 Oktober 2026: **NO-GO**. Kredensial aman `SUPABASE_PROD_URL`, `SUPABASE_PROD_DATABASE_URL`, `SUPABASE_PROD_SERVICE_ROLE_KEY`, dan `PHASE13_PROD_SSH_USER` tidak tersedia pada sesi audit, sehingga preflight live tidak dijalankan. Tidak ada mutasi production.

Pemeriksaan lokal memastikan preflight hanya memakai HTTP `GET`, transaksi PostgreSQL `BEGIN READ ONLY` dengan `default_transaction_read_only=on`, dan SSH `df -Pk / /data`. Gate bukti lokal kini menolak artifact tanpa SHA-256, ukuran, waktu capture pasca-freeze, atau lokasi nyata di bawah `/data`; menolak report freeze/restore/preflight/delta/pilot di luar window; dan menolak pilot yang tidak cocok dengan sekolah yang disetujui.

Operator boleh menjalankan `npm run preflight:phase13-production -- <baseline.json>` hanya saat empat kredensial tersedia melalui kanal aman dan baseline pasca-freeze sudah disetujui. Simpan stdout, exit code, command, waktu, operator, reviewer, ukuran, dan SHA-256 di `/data/academy-cutover/RUN_ID`. Jangan menjalankan migrasi, upload, restore, reload service, atau perintah tulis lain sebagai bagian preflight.

Baseline stage 6 wajib `version: 1`, `target: "production"`, `status: "REVIEWED"`, dan `synthetic: false`. Metadata `evidence` wajib menyatakan `source: "historical-production-clone"`, `cloneDatabase: "phase13_current_prod"`, `readOnlyCapture: true`, path artifact absolut, SHA-256 artifact sumber, waktu capture/review, serta operator dan reviewer berbeda. Preflight menolak baseline draft, synthetic, snapshot live ad hoc, final backup yang belum mungkin ada, atau baseline tanpa provenance sebelum HTTP/DB/SSH I/O.

Report `productionPreflight` pada final gate wajib menyatakan `readOnly: true`, `syntheticBaseline: false`, `baselineStatus: "REVIEWED"`, `baselineSource: "historical-production-clone"`, serta SHA-256 baseline dan artifact sumber clone. Report ini tidak diikat ke backup final karena preflight stage 6 mendahului freeze/backup stage 7. Secara terpisah, report `finalBackupRestore` wajib menyatakan `restoreVerified: true` dan source path/hash yang persis sama dengan artifact backup PostgreSQL final pada checklist. Kecocokan file hanya menghasilkan `EVIDENCE_FILES_VALID_NOT_GO`; keputusan GO tetap manual.

### Audit preflight 13 Oktober 2026

Keputusan: **NO-GO; probe production tidak dijalankan**. Pemeriksaan metadata lokal tidak menemukan `SUPABASE_PROD_URL`, `SUPABASE_PROD_DATABASE_URL`, `SUPABASE_PROD_SERVICE_ROLE_KEY`, atau `PHASE13_PROD_SSH_USER` pada process/user/machine environment maupun file env repository. `I:\secure-evidence` tidak tersedia dan tidak ditemukan kandidat baseline/preflight/checklist JSON di `I:\academy-utero-backups`; karena itu tidak ada baseline input yang dapat dinilai sah.

SSH `known_hosts` memuat host key untuk `20.20.20.3`. Tunnel lokal pada `127.0.0.1:18100` dan `127.0.0.1:15532` aktif, tetapi command tunnel menunjuk gateway staging `127.0.0.1:8100` dan database staging `172.20.0.4:5432` melalui host production. Tunnel ini **bukan** bukti koneksi ke database production dan dilarang dipakai sebagai substitusi target preflight production.

Karena target tidak lengkap dan baseline tidak ada, audit berhenti sebelum HTTP `GET`, koneksi PostgreSQL, atau SSH `df`. Tidak ada write freeze, migrasi, backup, upload, reload service, atau mutasi production. Untuk percobaan berikutnya, operator harus menyediakan baseline pasca-freeze yang direview di path absolut terlindungi dan empat env production melalui kanal aman; validator tetap harus mengunci endpoint ke `https://supabase.carubra.space`, database host ke `20.20.20.3`, SSH dengan `StrictHostKeyChecking=yes`, serta query ke `BEGIN READ ONLY`/`SELECT`/`ROLLBACK` saja.

Pencarian lanjutan Point 5 memeriksa parent workspace, konfigurasi user, Windows Credential Manager, dan direktori bukti tanpa mencetak nilai secret. Credential Manager memiliki login Supabase CLI, tetapi token umum itu bukan bukti otorisasi proyek Academy dan tidak digunakan. `.env` proyek memiliki service-role untuk target lain: endpoint-nya bukan `https://supabase.carubra.space` dan tidak memiliki database URL production. File staging di direktori backup juga tidak memuat key preflight production. Tidak ditemukan JSON yang memuat struktur baseline `rlsSha256` atau checklist `EVIDENCE_READY` pada direktori bukti yang tersedia.

Dilarang merakit konfigurasi campuran dari service-role target lain, tunnel staging, user SSH yang terlihat dari proses lain, atau token Supabase CLI. Preflight hanya boleh berjalan saat satu sumber konfigurasi aman yang direview menyediakan keempat nilai production dan satu baseline terpisah lolos `validateBaseline`; baseline tidak boleh dibuat dari hasil live.

### Evaluasi Task 6–7, 13 Oktober 2026

Keputusan: **NO-GO**. Path `/data` pada sesi Windows ter-resolve menjadi `I:\data`, tetapi objek itu file biasa, bukan direktori backup; final gate akan menolaknya. `I:\academy-utero-backups` tidak berisi baseline/checklist, `I:\secure-evidence` tidak tersedia, dan empat env production tetap tidak ada. `I:\DevData\TEMP\cutover-*` ialah fixture test, bukan evidence production.

Baseline clone historis reviewed/non-synthetic dan kredensial production tidak tersedia; preflight berhenti sebelum HTTP `GET`, `BEGIN READ ONLY`, atau SSH `df`. Final gate tidak memiliki checklist nyata untuk dievaluasi. Blocker stage 6: baseline clone historis reviewed dan kredensial production. Blocker stage 7: backup PostgreSQL/Auth/config/Storage di `/data`, restore drill yang terikat hash backup final, serta report freeze/delta/pilot.
