# UAT, Performance, dan Gerbang Produksi Self-Hosted

Dokumen ini hanya menilai kesiapan. Skrip tidak mengubah data, DNS, reverse proxy, container, database, atau storage.

## Probe read-only berbatas

Jalankan melalui URL publik TLS setelah stack production candidate tersedia. Gunakan jam trafik rendah dan mulai dari 20 request. Naikkan hanya setelah metrik server stabil.

```powershell
node scripts/selfhosted-readonly-load.mjs `
  --base-url https://academy.example.com `
  --paths /api/health,/login `
  --requests 100 `
  --concurrency 4 `
  --timeout-ms 10000 `
  --p95-ms 1500 `
  --max-error-rate 0.01 `
  --output C:\secure-evidence\academy-cutover\readonlyUatPerformance.json
```

Batas keras: 500 request, concurrency 10, timeout 15 detik, maksimal 10 path. Probe hanya memakai `GET`, tanpa cookie/token, tidak mengikuti redirect, dan tidak menerima query string. Target non-loopback wajib HTTPS. PASS membutuhkan error rate dan p95 di bawah budget, serta setiap path minimal sekali berhasil.

## Checklist evidence

Semua laporan wajib JSON dengan `gate`, `target: "production"`, `status: "PASS"`, `finishedAt`, dan `expiresAt`. Checklist menyimpan path absolut, ukuran byte, dan SHA-256 setiap file. Operator dan reviewer harus berbeda.

| Evidence | Bukti minimum |
| --- | --- |
| `migrationVerification` | checksum tabel/Auth, FK, hitungan sumber-target tanpa selisih |
| `storageVerification` | manifest bucket/path/size/SHA-256 dan owner tanpa selisih |
| `rbacVerification` | role/permission sama, tanpa orphan atau scope rusak |
| `roleSmoke` | lima role lulus positif/negatif dan seluruh cookie sesi production memakai `Secure` |
| `readonlyUatPerformance` | keluaran probe script ini dalam budget |
| `backupRestore` | restore database dan storage satu generasi berhasil |
| `rollbackRehearsal` | rehearsal terukur, RTO dan langkah operator tercatat |
| `tlsPreflight` | sertifikat, chain, hostname, header keamanan, dan HTTP redirect lulus |
| `smtpSmoke` | email verifikasi/reset diterima tanpa secret di log |
| `opsHealth` | probe production API/DB, kapasitas disk, backup lokal dan off-host terbaru, serta isolasi device off-host lulus |
| `monitoringReadiness` | alert API, DB, disk, storage, error rate, latency tersedia |
| `writeFreeze` | semua writer/upload sumber dibekukan dan diverifikasi |

`role-smoke` pada stack production menulis evidence atomik ke `./data/ops-evidence/roleSmoke.json` dengan
`target: "production"`. Jalankan memakai ketiga file Compose production agar override target dan output aktif:

```powershell
docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  --profile operations run --no-deps --rm role-smoke
```

`migration-verify` memakai override production `MIGRATION_VERIFY_TARGET=production` dan menulis `migration-verification.json` serta `storage-verification.json` ke `./data/ops-evidence`. Kedua laporan baru dinyatakan PASS bila tidak ada mismatch, tabel/FK terverifikasi, dan semua byte objek dibandingkan. Jalankan setelah import final memakai tiga file Compose pada runbook cutover, kemudian tempatkan salinan evidence yang direview bersama checklist di satu direktori aman. Jangan mengganti target lokal menjadi production secara manual pada JSON fixture.

Jalankan verifikasi RBAC read-only dengan override production; hasil atomik ditulis ke `./data/ops-evidence/rbacVerification.json`:

```powershell
docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  --profile operations run --no-deps --rm rbac-verify
```

Evidence lain yang masih manual harus berisi struktur minimum yang diuji evaluator: `backupRestore` memuat `checks.database/storage/safetyBackup.ok: true`; `rollbackRehearsal` memuat `rtoSeconds`, marker DB/storage, dan readiness HTTP 200; `monitoringReadiness` memuat alert delivery, error rate, latency, capacity; `writeFreeze` memuat writer `web`, `api`, `scheduled-jobs`, `edge-functions`, `webhooks`, `legacy-clients`, `direct-uploads` dalam status beku, probe sumber, dan antrean kosong. Writer yang tidak dipakai harus diverifikasi nonaktif, bukan dihilangkan. Field yang lengkap saja belum membuktikan kejadian: reviewer wajib mencocokkan log, snapshot, dan persetujuan operator.

Gunakan CLI berikut untuk membuat dua evidence manual tersebut. CLI hanya menerima `target: "production"`, mewajibkan operator dan reviewer berbeda, dan gagal tertutup bila source artifact hilang, symlink, hash berubah, timestamp di masa depan, atau lebih tua dari 24 jam. Output ditulis atomik dengan mode `0600`.

```powershell
node scripts/create-selfhosted-operator-evidence.mjs `
  --input C:\secure-evidence\academy-cutover\operator-review.json `
  --monitoring-output C:\secure-evidence\academy-cutover\monitoringReadiness.json `
  --write-freeze-output C:\secure-evidence\academy-cutover\writeFreeze.json
```

Manifest input memakai struktur berikut. Setiap `path` wajib absolut dan menunjuk file/log reguler non-symlink. `sha256` wajib digest lowercase isi file; `observedAt` dan `reviewedAt` wajib ISO UTC dan maksimal berumur 24 jam.

```json
{
  "schemaVersion": 1,
  "target": "production",
  "operator": "operator-a",
  "reviewer": "reviewer-b",
  "reviewedAt": "2026-10-15T09:45:00.000Z",
  "monitoring": {
    "alertDelivery": { "path": "C:\\secure-evidence\\sources\\alert.log", "sha256": "<64 hex>", "observedAt": "2026-10-15T09:30:00.000Z" },
    "errorRate": { "path": "C:\\secure-evidence\\sources\\error-rate.json", "sha256": "<64 hex>", "observedAt": "2026-10-15T09:30:00.000Z" },
    "latency": { "path": "C:\\secure-evidence\\sources\\latency.json", "sha256": "<64 hex>", "observedAt": "2026-10-15T09:30:00.000Z" },
    "capacity": { "path": "C:\\secure-evidence\\sources\\capacity.json", "sha256": "<64 hex>", "observedAt": "2026-10-15T09:30:00.000Z" }
  },
  "writers": [
    { "name": "web", "state": "frozen", "artifact": { "path": "C:\\secure-evidence\\sources\\web.log", "sha256": "<64 hex>", "observedAt": "2026-10-15T09:30:00.000Z" } }
  ],
  "sourceWriteProbe": { "blocked": true, "artifact": { "path": "C:\\secure-evidence\\sources\\write-probe.log", "sha256": "<64 hex>", "observedAt": "2026-10-15T09:30:00.000Z" } },
  "queueDrained": { "pending": 0, "artifact": { "path": "C:\\secure-evidence\\sources\\queue-drain.log", "sha256": "<64 hex>", "observedAt": "2026-10-15T09:30:00.000Z" } }
}
```

Array `writers` wajib berisi tepat tujuh nama yang disebutkan sebelumnya, masing-masing tepat sekali. Gunakan `state: "inactive"` untuk writer yang memang tidak digunakan; artifact tetap wajib membuktikan kondisi nonaktif tersebut.

Bangun checklist langsung dari tepat 12 file evidence JSON dalam satu direktori aman. Manifest sumber bernama `operator-review.json` boleh berada di direktori yang sama dan dikecualikan dari hitungan; JSON tambahan lain tetap ditolak. Nama file evidence boleh berbeda, tetapi setiap `gate` wajib unik dan harus cocok dengan daftar evidence di atas. Output harus berada dalam direktori yang sama; builder menghitung ukuran dan SHA-256, menulis atomik dengan mode `0600`, lalu menjalankan evaluator sebelum memublikasikan checklist:

```powershell
node scripts/build-selfhosted-uat-checklist.mjs `
  --evidence-dir C:\secure-evidence\academy-cutover `
  --operator operator-a `
  --reviewer reviewer-b `
  --output C:\secure-evidence\academy-cutover\uat-checklist.json
```

Hitung hash PowerShell secara manual bila perlu audit silang:

```powershell
Get-FileHash -Algorithm SHA256 C:\secure-evidence\academy-cutover\readonlyUatPerformance.json
```

Evaluasi:

```powershell
node scripts/evaluate-selfhosted-uat-gate.mjs `
  --checklist C:\secure-evidence\academy-cutover\uat-checklist.json
```

Exit code 0 dan `decision: "GO"` berarti paket bukti lengkap, cocok hash, isi minimum tiap jenis evidence tersedia, dan belum kedaluwarsa. Tiap file wajib memuat `expiresAt` sendiri; checklist tidak dapat memperpanjangnya. Batas umur evidence `opsHealth` adalah 10 menit dan evidence lain maksimal 24 jam. `opsHealth` wajib terpisah dari `monitoringReadiness`; file hasil probe health tidak membuktikan jalur alert atau observabilitas. Validasi JSON/hash tidak membuktikan identitas penulis atau keaslian data manual: reviewer wajib mencocokkan sumber dan hasil probe asli secara independen. Hasil bukan tindakan publish: perubahan DNS/cutover tetap keputusan operator terpisah. Evidence hilang, gagal, berubah, kedaluwarsa, berada di luar direktori checklist, atau direview operator yang sama menghasilkan NO-GO.

Probe dengan URL loopback selalu menghasilkan `target: "local"`, bukan evidence production. Jalankan ulang memakai hostname TLS publik dan bukti deployment yang benar sebelum mengisi checklist production.

## Gerbang operasional

GO hanya bila semua evidence PASS dan reviewer menyetujui window yang sama. NO-GO bila ada selisih data/file, role salah, private object bocor, p95/error rate melewati budget, backup tidak dapat direstore, TLS/SMTP/monitoring gagal, atau write freeze belum terbukti.

Saat NO-GO, jangan ubah DNS dan jangan membuka writer target. Simpan evidence gagal, perbaiki penyebab, lalu ulangi hanya gate terkait dan evaluasi paket lengkap kembali.
