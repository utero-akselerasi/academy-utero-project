# Status 12 Poin Migrasi Self-Hosted

Tanggal audit: 15 Oktober 2026. Status publikasi: **NO-GO** sampai seluruh evidence production tersedia dan health gate lulus.

**Perubahan scope 15 Oktober 2026:** pengguna memilih migrasi identitas/profil saja, tanpa migrasi seluruh database dan storage. Tabel 12 poin di bawah mendeskripsikan **rencana lama** dan bukan checklist GO untuk rencana baru. Ikuti `docs/35-selfhosted-identity-only.md`. Rehearsal terisolasi rencana baru berhasil untuk 29 akun/profil pada snapshot lama; role assignment, password, dan data domain tidak disalin. Production tetap **NO-GO** hingga validasi sumber terbaru, onboarding akun, UAT serta evidence operasi baru selesai. Persentase kesiapan lama di bawah bukan estimasi strategi baru.

| No. | Poin | Implementasi | Evidence saat ini | Gate production |
| --- | --- | --- | --- | --- |
| 1 | Backend mandiri dan PostgreSQL | Selesai untuk fixture | Backend 122/122 lulus di Linux; aplikasi 1131 lulus dan 1 tes symlink dilewati di Windows; lint, typecheck, dan build production lulus | Menunggu secret dan host production |
| 2 | Docker backend, web, API, database, storage | Selesai | Compose merge valid; hanya Nginx membuka 80/443 | Menunggu deployment host nyata |
| 3 | Role dan permission setara | Seed/verifier siap | Matriks RBAC, producer evidence read-only, dan smoke lima role pada fixture terdahulu lulus; stack uji aktif saat audit hanya memiliki pengguna `super_admin`, `school`, dan `applicant` (tanpa `admin`/`intern`), sehingga smoke lima role tidak dapat diulang pada stack ini | Wajib sediakan lima akun smoke terpisah dan uji negatif lintas sekolah, kepemilikan file, serta signed URL pada data production |
| 4 | Akses sumber dan inventaris Supabase | Tooling siap | Belum ada `SOURCE_DATABASE_URL` | NO-GO |
| 5 | Export storage sumber | Importer siap | Belum ada `STORAGE_IMPORT_SOURCE` atau export final | NO-GO |
| 6 | Freeze writer dan snapshot final | Producer evidence dan runbook siap | Producer `monitoringReadiness` dan `writeFreeze` memvalidasi source artifact, identitas operator/reviewer berbeda, lalu menulis evidence atomik; belum ada maintenance window atau bukti freeze production | NO-GO |
| 7 | Migrasi database dan storage | Rehearsal lulus | 76 tabel, 3 auth user fixture, 3 object fixture, 278 FK | Wajib dijalankan pada snapshot final production |
| 8 | Verifikasi checksum, owner, byte, FK | Selesai untuk fixture | Rehearsal verifier lulus tanpa selisih; producer evidence migrasi/storage siap | Wajib menghasilkan report production dari sumber nyata |
| 9 | Backup, off-host, restore, retensi | Mekanisme lokal dan producer evidence selesai | Restore/rollback fixture terisolasi lulus ulang dengan parent mount dan swap storage; backup fixture `local-health-20261015T192500Z` dibuat dan diverifikasi ulang dengan `pg_restore` pada stack uji; health menerima freshness backup; producer `rollbackRehearsal` menolak fixture sebagai klaim production | Wajib pakai backup production candidate, rehearsal production candidate, device off-host berbeda, dan catat RTO/RPO |
| 10 | TLS, secure cookie, SMTP | Konfigurasi, preflight, dan SMTP smoke tool siap | Nginx lokal 308/HTTPS lulus, satu CSP bernonce dari aplikasi; secure cookie dipaksa aktif; env validator dan SMTP smoke fail-closed | Sertifikat/domain dan SMTP smoke nyata belum tersedia |
| 11 | UAT, load, monitoring | Tooling dan producer evidence siap | Aplikasi 1131 lulus dan 1 tes symlink dilewati di Windows; backend 122/122 lulus di Linux; lokal 20/20 HTTP 200; `ops-health` aktual lulus untuk API, database, dan freshness backup lokal; producer monitoring/write-freeze dan checklist tersedia | `ops-health` tetap FAIL: disk hanya 4,53% bebas, backup off-host belum ada, kedua mount backup memakai device 79; probe domain TLS dan alert channel belum lulus |
| 12 | DNS cutover dan rollback | Runbook, checklist builder, dan fail-closed gate siap | Builder membaca tepat 12 evidence JSON, menghitung ukuran/SHA-256, menulis mode `0600` secara atomik, dan hanya memublikasikan checklist setelah evaluator menghasilkan `GO`; DNS cutover dan rollback trafik production belum dieksekusi | Memerlukan seluruh 12 jenis evidence production PASS dan persetujuan operator/reviewer |

Drill terisolasi membuktikan mekanisme restore/rollback lokal, bukan kesiapan cutover production. Status **NO-GO** tetap berlaku sampai evidence produksi, off-host berbeda, TLS/SMTP nyata, dan freeze writer tersedia.

## Kesiapan

- Estimasi kesiapan backend dan kode: **97%**.
- Estimasi kesiapan operasi untuk publish: **45%**.
- Status keputusan: **NO-GO**.

Persentase ini estimasi kasar, bukan hasil pengukuran readiness. Sisa pekerjaan membutuhkan data, kredensial, infrastruktur, domain, sertifikat, SMTP, ruang disk, maintenance window, uji akses negatif lintas akun dan signed URL, serta keputusan operator production yang tidak boleh dibuat memakai fixture lokal. Evaluator hanya memvalidasi struktur/isi minimum dan integritas file: reviewer masih wajib memeriksa keaslian evidence manual secara independen.

## Blocker Wajib

1. Tambah ruang disk sekitar 35 GiB agar mencapai minimal 15% bebas; target aman sebelum migrasi adalah 20% atau lebih.
2. Sediakan secret production melalui env file aman di host, bukan chat atau repository.
3. Sediakan akses read-only database sumber dan export storage final.
4. Sediakan domain, sertifikat TLS valid, dan SMTP production.
5. Tetapkan maintenance window, operator, reviewer berbeda, TTL DNS, dan rollback owner.
6. Jalankan seluruh producer evidence production pada `docs/33-selfhosted-uat-performance-gate.md`, bangun checklist dengan `scripts/build-selfhosted-uat-checklist.mjs`, lalu evaluasi paket lengkap sebelum perubahan DNS.

Fixture, URL loopback, sertifikat sementara, dan akun smoke lokal tidak boleh dipakai sebagai evidence production.
