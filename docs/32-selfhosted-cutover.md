# Cutover Supabase ke Academy Self-Hosted

**Status: belum cutover produksi.** Pengujian lokal memakai fixture; jumlah objek dan data produksi belum dibuktikan pada target. Jangan arahkan DNS produksi sebelum seluruh gerbang GO terpenuhi.

## Prasyarat dan keputusan NO-GO

- Tetapkan operator, waktu maintenance, akses read-only ke PostgreSQL sumber, export lengkap file Academy dari seluruh bucket, serta inventaris objek shared bucket beserta owner. Pastikan `SOURCE_DATABASE_URL` menunjuk sumber yang benar, dan `STORAGE_IMPORT_SOURCE` menunjuk export `<bucket>/<object-path>`. Jangan menyalin objek layanan lain dari shared bucket.
- Siapkan domain dan sertifikat TLS untuk `nginx.production.conf`, cookie aman, `PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_URL`, SMTP, rahasia signing, serta network/firewall. Jalankan tiga file Compose sesuai `docs/production-infra-runbook.md`; database, API, dan web tidak boleh dipublikasikan langsung.
- Ambil backup sumber yang dapat dipulihkan dan uji restore. Siapkan backup target PostgreSQL **dan** `./data/storage` sebagai satu generasi, lalu salin ke media off-host. Ikuti [backup/restore](31-selfhosted-backup-restore.md). `postgres_data` ialah Docker volume; `./data/storage` ialah bind mount lokal project.
- Uji alur lima role dan kasus akses ditolak lintas pengguna/sekolah, termasuk signed URL file privat. NO-GO bila data, pemilik file, permission, sertifikat, email, TLS, atau backup/restore belum sesuai.

## Status Rehearsal Restore dan Rollback

Drill fixture pada target terisolasi lulus 15 Oktober 2026: preflight role, safety backup, restore database/storage, verifikasi 3 pengguna Auth dan 3 metadata objek, SHA-256 byte storage, serta readiness API HTTP `200`. Restore baseline menghapus marker tambahan, kemudian restore snapshot rollback mengembalikan marker database dan file. Tidak ada perpindahan trafik atau mutasi stack utama.

Bukti lokal ini tidak menggantikan rehearsal snapshot production candidate, media off-host berbeda, pengukuran durasi, smoke lima role, signed URL privat, atau verifikasi manifest final. Cutover production tetap **NO-GO**.

Producer evidence terpisah tersedia di `scripts/create-selfhosted-rollback-evidence.mjs`. Producer tidak menjalankan restore dan tidak menulis DB/storage: inputnya dua file evidence `.env` dari restore berurutan (baseline lalu rollback) serta satu JSON hasil probe read-only untuk marker database, marker storage, dan readiness pada kedua fase. Timestamp `startedAt`/`finishedAt` harus mengapit timestamp kedua restore dalam urutan yang benar; `rtoSeconds` dihitung dari interval terverifikasi tersebut. Semua status, marker, SHA-256 storage, HTTP `GET` readiness `200`, dan flag `readOnly` wajib cocok atau producer berhenti tanpa evidence PASS.

Target default ialah `local`. Fixture hanya menghasilkan klaim `isolated-fixture-rollback-rehearsed` dan `productionRollbackClaimed: false`. Kandidat production harus memakai `dataClass: "production-candidate"`, `--target production`, dan konfirmasi eksplisit; fixture pada target production ditolak.

```powershell
node scripts/create-selfhosted-rollback-evidence.mjs `
  --baseline-restore C:\secure\evidence\restore-baseline.env `
  --rollback-restore C:\secure\evidence\restore-rollback.env `
  --probes C:\secure\evidence\rollback-readonly-probes.json `
  --output C:\secure\evidence\rollback-rehearsal.json

node scripts/create-selfhosted-rollback-evidence.mjs `
  --baseline-restore C:\secure\evidence\restore-production-baseline.env `
  --rollback-restore C:\secure\evidence\restore-production-rollback.env `
  --probes C:\secure\evidence\production-rollback-readonly-probes.json `
  --output C:\secure\evidence\production-rollback-rehearsal.json `
  --target production --confirm production-candidate-rollback-rehearsal
```

Output JSON diterbitkan atomik dengan permission privat dan tidak menimpa file evidence yang sudah ada. Simpan input/output di lokasi evidence terlindungi di luar repository.

## Urutan cutover

1. Ulangi rehearsal yang sudah lulus secara lokal memakai salinan final production candidate dan target terpisah. Ukur durasi restore dan rollback, verifikasi checksum, lalu catat manifest objek sumber (bucket, path, ukuran, SHA-256) beserta hitungan tabel dan Auth. Evidence fixture lokal tidak dapat menggantikan evidence production.
2. Mulai maintenance. Bekukan **seluruh** writer ke Supabase: web/API, job terjadwal, Edge Functions, webhook, klien lama, dan upload langsung. Pastikan antrean selesai. Jangan biarkan target dan Supabase sama-sama menerima tulis.
3. Ambil snapshot final database dan export final semua file Academy dari titik beku yang sama. Pertahankan snapshot sumber tanpa perubahan sampai keputusan akhir. Cadangkan pula target sebelum menimpa. Audit manifest akhir dan file yang hilang.
4. Siapkan env operator production di luar repository dari `docker-compose.production.env.example`, set `SOURCE_DATABASE_URL` read-only, `STORAGE_IMPORT_SOURCE`, `CONFIRM_DATABASE_COPY=copy-to-local-academy`, `CONFIRM_STORAGE_IMPORT=copy-to-local-storage`. Pastikan `ACADEMY_MIGRATION_DATABASE_URL` menunjuk **target** `academy`, bukan sumber. Gunakan kombinasi tiga file Compose production yang sama pada seluruh perintah agar job migrasi memakai volume database dan storage stack yang benar. `db-copy` menulis/mengganti data target: jangan jalankan pada database dengan data penting yang belum dicadangkan.
5. Impor sambil akses publik tetap ditutup:

   ```powershell
   docker compose --env-file C:\secure\academy-production.env -f docker-compose.backend.yml -f docker-compose.selfhosted.yml -f docker-compose.production.yml --profile migration run --no-deps --rm db-copy
   docker compose --env-file C:\secure\academy-production.env -f docker-compose.backend.yml -f docker-compose.selfhosted.yml -f docker-compose.production.yml --profile migration run --no-deps --rm storage-import
   docker compose --env-file C:\secure\academy-production.env -f docker-compose.backend.yml -f docker-compose.selfhosted.yml -f docker-compose.production.yml --profile migration run --no-deps --rm migration-verify
   ```

6. Periksa exit code dan laporan verifier: checksum tabel/Auth, owner dan manifest setiap objek (bucket, path, ukuran), SHA-256 byte file export terhadap storage internal, serta FK. Import memakai `storage.objects.owner` dan fallback `owner_id` teks hanya bila UUID valid; konflik keduanya menggagalkan import. Pastikan `storageBytesChecked` sama dengan jumlah objek sumber. Tuntaskan file privat tanpa owner dan larang akses lintas role/sekolah. Selisih apa pun berarti NO-GO.
7. Isi akun smoke khusus production untuk lima role pada env operator, lalu jalankan `docker compose --env-file C:\secure\academy-production.env -f docker-compose.backend.yml -f docker-compose.selfhosted.yml -f docker-compose.production.yml --profile operations run --no-deps --rm role-smoke`. Lanjutkan uji web/API melalui domain TLS: signup/verifikasi email, aplikasi dan keputusan admin, profil sekolah, absensi/laporan intern, Tasks/LMS dan lampiran privat, CMS, assessment dan sertifikat. Uji `super_admin`, `admin`, `school`, `intern`, `applicant`, serta penolakan akses negatif. Simpan bukti hasil dan persetujuan GO/NO-GO operator.
8. Bila GO, arahkan reverse proxy/DNS ke stack baru, pertahankan sumber dalam mode read-only, buka hanya writer baru, pantau error, job, disk volume, PostgreSQL, storage, dan email. Setelah stabil, ambil backup target lengkap dan off-host.

## Rollback

Jika gagal **sebelum** writer target dibuka, tutup trafik target dan arahkan kembali ke sumber setelah memastikan sumber siap menulis; target tetap terisolasi. Jika target **sudah** menerima tulis, hentikan semua writer dahulu. Jangan langsung membuka sumber lama: data target baru harus direkonsiliasi atau dipulihkan dengan rencana tersendiri agar tidak hilang. Restore target hanya dengan backup satu generasi dan prosedur pada [runbook backup/restore](31-selfhosted-backup-restore.md). Jangan gunakan `docker compose down -v`; perintah itu menghapus volume database.
