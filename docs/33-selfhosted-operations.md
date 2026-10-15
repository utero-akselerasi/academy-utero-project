# Operasi Production Self-Hosted

Runbook ini mencakup health, log, kapasitas, backup, dan respons insiden. TLS, migrasi, serta RBAC berada di runbook terpisah. Contoh perintah memakai stack lokal; pada production ganti `--env-file backend/.env` dengan env operator dan **selalu** tambahkan `-f docker-compose.production.yml` setelah file self-hosted. Semua operasi wajib memakai project Compose production yang sama, termasuk `backup`, `restore`, `backup-prune`, dan `ops-health`.

## Pemeriksaan Terjadwal

Jalankan setiap 5 menit melalui scheduler host. Exit code non-zero berarti alert.

```powershell
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  --profile operations run --no-deps --rm ops-health
```

Output satu baris JSON memeriksa:

- readiness API;
- query PostgreSQL;
- ruang bebas storage dan backup, default minimal 15%;
- umur backup lokal dan salinan off-host terbaru, default maksimal 26 jam;
- kapasitas filesystem storage, backup lokal, dan backup off-host.
- device backup off-host berbeda dari device backup lokal.

`ops-health` berjalan sebagai root agar dapat membaca metadata backup berpermission `0700`, tetapi seluruh mount datanya read-only dan akses jaringan dibatasi ke network backend untuk probe API/PostgreSQL.
Probe PostgreSQL memakai role `academy_api`, bukan superuser migrasi.
Pada override production, output memakai `gate: opsHealth`, `target: production`, masa berlaku 10 menit, dan dapat ditulis atomik melalui `OPS_HEALTH_OUTPUT=/evidence/ops-health.json`. Path output wajib absolut. Penulisan memakai file sementara pada direktori yang sama lalu rename, sehingga pembaca tidak melihat JSON parsial. Status gagal tetap exit nonzero.

`opsHealth` dan `monitoringReadiness` adalah evidence terpisah. Output `ops-health` hanya membuktikan probe API, database, disk, backup, dan isolasi off-host pada satu waktu; jangan mengganti `gate` atau memasukkannya sebagai evidence `monitoringReadiness`. Evidence `monitoringReadiness` harus dibuat terpisah setelah jalur alert terbukti diterima operator dan pemantauan error rate, latency, serta kapasitas telah diverifikasi.

Atur `OPS_MINIMUM_FREE_PERCENT`, `OPS_MAXIMUM_BACKUP_AGE_HOURS`, dan `OPS_HEALTH_TIMEOUT_MS` sesuai SLO. Alert wajib diteruskan ke operator; skrip tidak mengirim notifikasi sendiri.

## Jadwal Minimum

- Setiap 5 menit: `ops-health`.
- Setiap hari setelah jam sepi: maintenance writer, `backup`, `backup-offsite`, lalu buka writer setelah keduanya lulus.
- Setiap minggu: `backup-verify` pada satu backup lokal dan satu salinan off-host.
- Setiap bulan: restore drill terisolasi, smoke lima role, signed URL private, dan simpan evidence.
- Setiap hari setelah backup: dry-run `backup-prune`; eksekusi hanya setelah output diperiksa.

## Log

PostgreSQL, API, web, dan nginx memakai driver `json-file` dengan rotasi default `10m` x 5 file. Ubah melalui `ACADEMY_LOG_MAX_SIZE` dan `ACADEMY_LOG_MAX_FILES`.

```powershell
docker compose --env-file backend/.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  logs --since 30m postgres api web nginx
```

Jangan menyalin cookie, token, password, URL bertanda tangan, atau dump data ke tiket insiden. Simpan log off-host bila kebutuhan retensi melebihi rotasi Docker.

## Ambang Alert

- Critical: readiness gagal dua kali berturut-turut, PostgreSQL gagal, free disk di bawah 10%, atau backup lebih tua dari 30 jam.
- Warning: free disk di bawah 20%, lonjakan HTTP 5xx, restart container, atau backup off-host gagal satu kali.
- NO-GO deploy: backup lokal/off-host belum terverifikasi, restore drill kedaluwarsa, atau disk di bawah ambang.

## Respons Awal

1. Pertahankan bukti: waktu UTC, output `ops-health`, `docker compose ps`, dan log 30 menit terakhir.
2. Hentikan writer bila ada risiko korupsi database/storage atau disk hampir penuh.
3. Jangan jalankan `docker compose down -v`.
4. Untuk restore, ikuti `docs/31-selfhosted-backup-restore.md`; jangan restore langsung ke live sebagai eksperimen.
5. Buka trafik hanya setelah readiness, smoke lima role, akses private file, dan evidence restore lulus.
