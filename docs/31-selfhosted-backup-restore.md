# Backup dan Restore Self-Hosted

Runbook ini mencakup PostgreSQL dan storage internal project. Backup disimpan di `./data/backups`; file aplikasi tetap berada di `./data/storage`. Database aktif berada di Docker volume `postgres_data`.

Seluruh perintah di bawah harus memakai project Compose yang sama dengan aplikasi aktif. Untuk production gunakan `--env-file C:\secure\academy-production.env -f docker-compose.backend.yml -f docker-compose.selfhosted.yml -f docker-compose.production.yml` pada **setiap** perintah, termasuk job operations. Contoh `backend/.env` di bawah hanya berlaku untuk stack self-hosted lokal, bukan production. Jangan restore ke database live sebagai drill; gunakan instance terisolasi dan snapshot satu generasi.

## Backup

Hentikan trafik tulis saat backup agar snapshot database dan storage konsisten. Saat maintenance, hentikan tiga service aplikasi terlebih dahulu.

```powershell
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  stop nginx web api

$env:BACKUP_NAME = "academy-before-release-20261014"
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  --profile operations run --no-deps --rm backup

docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  up -d api web nginx
```

Hasil:

```text
data/backups/<BACKUP_NAME>/database.dump
data/backups/<BACKUP_NAME>/storage.tar.gz
data/backups/<BACKUP_NAME>/storage.files.sha256
data/backups/<BACKUP_NAME>/metadata.env
data/backups/<BACKUP_NAME>/SHA256SUMS
```

Backup baru dipromosikan setelah checksum, daftar dump PostgreSQL, gzip, tipe entri tar, dan path arsip lulus verifikasi.
Artefak dibuat dengan permission ketat (`umask 077`). Service `backup-verify` berjalan sebagai root hanya untuk membaca mount backup yang read-only; service tersebut tidak memiliki network.

## Replikasi Off-Host

Set `ACADEMY_OFFSITE_BACKUP_ROOT` ke mount disk/NFS yang berada di perangkat atau host lain. Default lokal hanya untuk development dan akan ditolak karena filesystem sama.

```powershell
$env:BACKUP_NAME = "academy-before-release-20261014"
$env:ACADEMY_OFFSITE_BACKUP_ROOT = "Z:\academy-backups"
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  --profile operations run --no-deps --rm backup-offsite
```

Transfer memakai direktori `.incoming`, memverifikasi salinan, lalu rename atomik. Direktori final yang sudah ada tidak ditimpa.

Verifikasi ulang tanpa membuat backup:

```powershell
$env:BACKUP_NAME = "academy-before-release-20261014"
docker compose --env-file backend/.env -f docker-compose.backend.yml `
  --profile operations run --no-deps --rm backup-verify
```

## Retensi

Dry-run adalah default. Minimal tujuh backup terbaru dipertahankan walau sudah melewati 30 hari.

```powershell
$env:RETENTION_DAYS = "30"
$env:RETENTION_MINIMUM_KEEP = "7"
docker compose --env-file backend/.env -f docker-compose.backend.yml --profile operations run --no-deps --rm backup-prune

$env:CONFIRM_PRUNE = "prune-expired-backups"
docker compose --env-file backend/.env -f docker-compose.backend.yml --profile operations run --no-deps --rm backup-prune
```

## Restore Drill

Restore bersifat destruktif. Jalankan hanya setelah API dan web dihentikan. Jangan gunakan `down -v` karena perintah itu menghapus volume PostgreSQL.
Target baru untuk disaster recovery wajib menjalankan service `migrate` sekali sebelum restore agar role PostgreSQL `anon`, `authenticated`, `service_role`, dan `academy_api` tersedia. Restore melakukan preflight role dan berhenti sebelum mutasi bila bootstrap belum dilakukan. Pada target production yang sudah aktif, role tersebut sudah tersedia dari migrasi awal.

Untuk target recovery kosong, gunakan tiga file Compose production dan env operator yang sama dengan command restore di bawah; jalankan `up -d postgres`, lalu `run --no-deps --rm migrate` sebelum `run --no-deps --rm restore`. Jangan jalankan bootstrap ini untuk mencoba "memperbaiki" database production yang sudah berisi data tanpa audit operator. Hasil rehearsal terisolasi dan batas evidencenya dicatat pada bagian **Hasil Drill Terisolasi**.

```powershell
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  stop nginx web api

$env:RESTORE_BACKUP_NAME = "academy-before-release-20261014"
$env:CONFIRM_RESTORE = "restore-local-academy"
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  --profile operations run --no-deps --rm restore

docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  up -d --force-recreate api web nginx
```

Restore memverifikasi SHA-256, menolak path arsip berbahaya, membuat safety backup `pre-restore-*` dari target aktif, mengekstrak SQL restore ke staging, lalu menjatuhkan empat schema Academy dan memulihkannya dalam **satu transaksi**. Ini juga membersihkan objek target baru yang tidak ada dalam backup, tanpa kehilangan state bila SQL gagal. Siapkan ruang sementara untuk SQL hasil ekstraksi (bisa jauh lebih besar dari dump terkompresi). Restore mewajibkan `/srv` sebagai mount terpisah dan menolak mount langsung `/srv/storage`, lalu mengekstrak storage ke direktori sibling, memverifikasi manifest, dan mengganti direktori aktif dengan rename. Storage lama dipertahankan sampai probe database pascarestore sukses.

Jika terjadi kegagalan setelah database target selesai dipulihkan, script otomatis memulihkan database dari safety backup dalam satu transaksi dan memasang kembali storage lama. Kegagalan salah satu rollback dilaporkan sebagai kondisi kritis dan direktori recovery tidak dihapus, sehingga writer harus tetap tertutup sampai operator menyelesaikan recovery. Hentikan API/web saat restore dan buat ulang container API setelahnya agar mount baru terpasang. Service restore memiliki akses tulis ke `./data` dan `./data/backups`; service lain memakai mount minimum sesuai kebutuhannya.

Evidence audit `./data/ops-evidence/restore-*.env` baru ditulis secara atomik setelah probe database pascarestore bernilai `1`; restore gagal atau rollback tidak boleh meninggalkan evidence sukses. Setelah itu restore menerbitkan `./data/ops-evidence/backupRestore.json` untuk gate UAT. Kedua evidence dibuat melalui temporary file pada direktori yang sama, diberi mode `600`, lalu di-rename atomik. JSON memakai `gate: backupRestore`, `status: PASS`, check `database`, `storage`, dan `safetyBackup` bernilai `ok: true`, serta `finishedAt`/`expiresAt` dengan masa berlaku tepat 24 jam.

Target evidence default adalah `local` melalui `RESTORE_EVIDENCE_TARGET`. Overlay `docker-compose.production.yml` memaksa target `production`; gunakan tiga file Compose production saat restore candidate agar evidence diterima evaluator production. Jangan mengubah target secara manual untuk membuat drill lokal terlihat seperti production.

## Hasil Drill Terisolasi

Pada 15 Oktober 2026, restore backup fixture pada project Compose terpisah lulus: preflight role, safety backup `pre-restore-*`, 3 pengguna Auth, 3 metadata objek storage, SHA-256 byte storage, dan readiness API HTTP `200`. Restore baseline menghapus tabel dan file marker yang baru dibuat pada target. Restore snapshot rollback berikutnya mengembalikan `utero_academy.rollback_probe` dan `rollback-probe.txt`, keduanya berisi `rollback-origin`; readiness API kembali HTTP `200`. Bukti lokal tersimpan di `data/restore-drill/evidence/restore-academy-rollback-origin-20261015-20261015T060843Z.env`. Stack utama tidak dimutasi; project drill dihentikan tanpa menghapus volume.

Sesudah perubahan parent mount, drill kedua pada project terpisah lulus: restore baseline menghapus marker tambahan; restore snapshot rollback mengembalikan marker database/file. Bukti ada di `data/restore-drill/evidence/restore-academy-safe-validation-20261015-20261015T062456Z.env` dan `data/restore-drill/evidence/restore-academy-rollback-origin-20261015-20261015T062516Z.env`. Kegagalan ekstraksi/swap dalam test Linux mempertahankan storage lama; crash mendadak saat jendela dua rename tetap membutuhkan pemeriksaan manual direktori `.storage.previous.*` dengan writer tertutup sebelum mengulang restore. Jangan menghapus direktori recovery itu sebelum state DB/storage diverifikasi.

Ini membuktikan mekanisme restore/rollback fixture, bukan RTO/RPO production, media off-host berbeda, signed URL privat, smoke lima role pada data nyata, atau rekonsiliasi tulis pasca-cutover. Ulangi pada backup satu generasi production candidate sebelum keputusan GO.

## Verifikasi

```powershell
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  ps

Invoke-WebRequest http://127.0.0.1:9982/api/health
```

Readiness API memeriksa koneksi PostgreSQL, keberadaan schema inti, dan akses baca/tulis ke `./data/storage`; status sehat bukan sekadar koneksi database.

Sesudah restore, jalankan smoke test lima role dan cek file private melalui signed URL sebelum membuka trafik.
