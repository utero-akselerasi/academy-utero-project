# Production Infrastructure Runbook

Dokumen ini hanya mencakup deployment Docker, TLS, reverse proxy, port host, dan konfigurasi environment. Dokumen ini tidak menjalankan migrasi data, publikasi DNS, atau cutover.

## Topologi

```text
Internet
  | TCP 80/443
  v
Nginx (TLS termination)
  | Docker network only: web:3000
  v
Next.js web
  | Docker network only: api:3001
  v
Fastify API
  | Docker network only: postgres:5432
  v
PostgreSQL named volume
```

Hanya service `nginx` yang mempublikasikan port host. `web`, `api`, dan `postgres` memakai `expose` atau jaringan internal Compose dan tidak boleh diberi mapping `ports` pada production.

## Prasyarat

- Docker Engine dan Docker Compose v2 yang mendukung tag `!override`.
- Firewall host mengizinkan inbound TCP 80 dan 443 saja untuk aplikasi ini.
- Direktori TLS berisi `fullchain.pem` dan `privkey.pem` yang valid serta dapat dibaca Docker.
- DNS, sertifikat, secret, URL kanonis, dan SMTP disiapkan operator. Repo tidak menentukan domain atau nilai secret.
- Direktori `data/storage`, `data/backups`, dan `data/acme` memiliki ownership dan permission yang sesuai bagi container.

## Imutabilitas Image Production

Image production memakai tag versi eksplisit dan digest OCI image index agar byte image tidak berubah tanpa review, sambil tetap membiarkan Docker memilih manifest platform host. Digest diverifikasi pada 2026-10-15 langsung dari Docker Hub memakai `docker buildx imagetools inspect <image>:<tag>`:

| Penggunaan | Referensi immutable | Platform terverifikasi |
| --- | --- | --- |
| PostgreSQL | `postgres:17.6-alpine3.22@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94` | `linux/amd64`, `linux/arm64/v8` |
| Nginx | `nginx:1.27.5-alpine3.21@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10` | `linux/amd64`, `linux/arm64/v8` |
| Backend Node | `node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf` | `linux/amd64`, `linux/arm64/v8` |

`Dockerfile.selfhosted` menjadi pola acuan dan memakai digest Node yang sama. Saat memperbarui image, verifikasi ulang tag serta platform pada registry, ubah tag dan digest dalam satu review, lalu jalankan validasi Compose sebelum deployment.

## Environment

Salin `docker-compose.production.env.example` ke lokasi aman di host, misalnya `/etc/academy/production.env`, lalu isi seluruh nilai wajib. Batasi permission file agar hanya operator deployment dapat membacanya.

Nilai berikut wajib konsisten:

- `NEXT_PUBLIC_APP_URL` dan `PUBLIC_APP_URL` memakai URL HTTPS kanonis yang sama.
- Password di `ACADEMY_MIGRATION_DATABASE_URL` sama dengan `ACADEMY_POSTGRES_PASSWORD`.
- Password di `ACADEMY_API_DATABASE_URL` sama dengan `ACADEMY_API_PASSWORD`.
- `ACADEMY_STORAGE_SIGNING_SECRET` berupa secret acak minimal 32 karakter.
- `SMTP_HOST` dan `SMTP_FROM` wajib terisi; uji kirim-verifikasi dan reset email sebelum GO.
- Secure cookie dipaksa aktif pada API dan web lewat override production; jangan gunakan HTTP untuk login production.
- `ACADEMY_TLS_CERT_DIR` berupa path absolut dan berisi dua file TLS yang diwajibkan.

Jangan menaruh kredensial produksi dalam file contoh, shell history, image Docker, atau repository.

Variabel `SOURCE_DATABASE_URL`, `STORAGE_IMPORT_SOURCE`, dan kedua `CONFIRM_*` hanya digunakan pada maintenance migrasi. Kosongkan `CONFIRM_*` setelah job selesai. Akun `SMOKE_*` wajib akun khusus pengujian dengan data terkontrol, bukan akun pribadi operator. `ACADEMY_OFFSITE_BACKUP_ROOT` harus menunjuk media atau host berbeda; path lokal project tidak memenuhi backup off-host production.

## Validasi Tanpa Menjalankan Stack

Sebelum Compose, cek konsistensi env tanpa mencetak secret memakai `node scripts/validate-selfhosted-production-env.mjs --env-file C:\secure\academy-production.env`. Setelah stack production tersedia lewat hostname nyata, jalankan `node scripts/selfhosted-production-preflight.mjs --base-url https://academy.example.com --output C:\secure\evidence\tls-preflight.json` dengan mengganti contoh domain. Kedua validator tidak membuktikan data sumber atau memberikan izin DNS cutover; ikuti `docs/33-selfhosted-uat-performance-gate.md`.

Setelah env lolos dan mailbox smoke khusus tersedia, ikuti `docs/37-selfhosted-smtp-smoke.md`. Perintah SMTP memerlukan token konfirmasi eksplisit karena benar-benar mengirim satu email; evidence PASS tetap harus dikonfirmasi diterima oleh operator/reviewer.

Jalankan dari root repository dengan file environment produksi:

```powershell
docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  config --quiet
```

Periksa hasil render dan pastikan hanya Nginx memiliki `ports`:

```powershell
docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  config
```

Uji sintaks Nginx tanpa menjalankan aplikasi:

```powershell
docker run --rm `
  -v "${PWD}\nginx.production.conf:/etc/nginx/nginx.conf:ro" `
  -v "C:\secure\academy-tls:/etc/nginx/tls:ro" `
  nginx:1.27.5-alpine3.21@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 nginx -t
```

Perintah terakhir membaca sertifikat aktual. Gunakan direktori TLS production yang sudah tersedia; jangan membuat sertifikat dummy untuk deployment.

Next.js sudah mengirim CSP bernonce pada respons halaman; Nginx tidak menambahkan CSP kedua yang dapat menghambat skrip sah. Preflight TLS memeriksa CSP pada respons aplikasi, selain header TLS dari Nginx. Jalankan smoke halaman utama dan dashboard pada setiap perubahan CSP.

## Start dan Pemeriksaan

Build dan start hanya setelah validasi konfigurasi lulus:

```powershell
docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  up -d --build
```

Pada host Linux, gunakan bentuk setara berikut:

```sh
docker compose --env-file /etc/academy/production.env \
  -f docker-compose.backend.yml \
  -f docker-compose.selfhosted.yml \
  -f docker-compose.production.yml \
  up -d --build
```

Pemeriksaan minimum sebelum perubahan DNS atau cutover:

```powershell
docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  ps

curl.exe -I http://127.0.0.1/healthz
curl.exe -k -I https://127.0.0.1/healthz
```

HTTP `/healthz` harus memberi `200`; request HTTP aplikasi harus memberi redirect `308` ke HTTPS. Pemeriksaan HTTPS dengan `-k` hanya memvalidasi jalur lokal sebelum DNS; pemeriksaan publik wajib tanpa `-k` agar chain dan hostname sertifikat diverifikasi.

## Firewall

Allow inbound:

- TCP 80 untuk redirect HTTPS dan ACME HTTP-01 bila digunakan.
- TCP 443 untuk trafik aplikasi.
- Port administrasi host, misalnya SSH, hanya dari sumber tepercaya sesuai kebijakan server.

Deny inbound publik:

- TCP 3000 untuk Next.js.
- TCP 3001 untuk Fastify API.
- TCP 5432 untuk PostgreSQL.

Jangan mengandalkan firewall saja. Pemeriksaan `docker compose config` juga harus membuktikan ketiga service internal tidak memiliki `ports`.

## TLS dan Renewal

Nginx membaca `/etc/nginx/tls/fullchain.pem` dan `/etc/nginx/tls/privkey.pem` dari mount read-only. Proses penerbitan atau renewal sertifikat dikelola operator di host. Setelah file diperbarui secara atomik, validasi lalu reload Nginx:

```powershell
docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  exec nginx nginx -t

docker compose --env-file C:\secure\academy-production.env `
  -f docker-compose.backend.yml `
  -f docker-compose.selfhosted.yml `
  -f docker-compose.production.yml `
  exec nginx nginx -s reload
```

Jangan reload bila `nginx -t` gagal. Pantau tanggal kedaluwarsa sertifikat dan jadwalkan renewal sebelum masa berlaku habis.

## Rollback Infrastruktur

Rollback image menggunakan tag atau digest image terakhir yang sudah diverifikasi, lalu jalankan kembali Compose dengan tiga file yang sama. Jangan menghapus volume PostgreSQL atau direktori storage. Perintah seperti `docker compose down -v` dilarang karena menghapus data persisten.

Rollback DNS, database, dan data mengikuti runbook cutover terpisah. Konfigurasi ini tidak memberi izin untuk publish atau cutover.
