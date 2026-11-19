# Production Infrastructure Runbook

Dokumen ini hanya mencakup deployment Docker, Cloudflare Tunnel, reverse proxy, port host, dan konfigurasi environment. Dokumen ini tidak menjalankan migrasi data, publikasi DNS, atau cutover.

## Topologi

```text
Internet
  | HTTPS
  v
Cloudflare Edge (TLS termination)
  | Cloudflare Tunnel -> http://127.0.0.1:9984
  v
Nginx (HTTP origin, loopback only)
  | Docker network: web:3000
  v
Next.js web
  | Docker network only: api:3001
  v
Fastify API
  | Docker network only: postgres:5432
  v
PostgreSQL named volume
```

Hanya service `nginx` mempublikasikan port host, terikat ke loopback (`127.0.0.1:9984` secara default). Cloudflare Tunnel berjalan pada host dan meneruskan ke alamat tersebut. `web`, `api`, dan `postgres` memakai `expose` atau jaringan internal Compose tanpa mapping host.

## Prasyarat

- Docker Engine dan Docker Compose v2 yang mendukung tag `!override`.
- Cloudflare Tunnel aktif pada host dan dikonfigurasi menuju `http://127.0.0.1:9984`.
- DNS publik dan TLS dikelola Cloudflare. Nginx origin tidak membutuhkan sertifikat atau port TLS lokal.
- Secret, URL kanonis HTTPS, dan SMTP disiapkan operator. Repo tidak menentukan domain atau nilai secret.
- Direktori `data/storage` dan `data/backups` memiliki ownership dan permission yang sesuai bagi container.

## Imutabilitas Image Production

Image production memakai tag versi eksplisit dan digest OCI image index agar byte image tidak berubah tanpa review, sambil tetap membiarkan Docker memilih manifest platform host. Digest diverifikasi pada 2026-10-15 langsung dari Docker Hub memakai `docker buildx imagetools inspect <image>:<tag>`:

| Penggunaan | Referensi immutable | Platform terverifikasi |
| --- | --- | --- |
| PostgreSQL | `postgres:17.6-alpine3.22@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94` | `linux/amd64`, `linux/arm64/v8` |
| Nginx | `nginx:1.27.5-alpine3.21@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10` | `linux/amd64`, `linux/arm64/v8` |
| Backend Node | `node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf` | `linux/amd64`, `linux/arm64/v8` |

`Dockerfile.selfhosted` menjadi pola acuan dan memakai digest Node yang sama. Saat memperbarui image, verifikasi ulang tag serta platform pada registry, ubah tag dan digest dalam satu review, lalu jalankan validasi Compose sebelum deployment.

## Environment

Salin `.env.example` ke lokasi aman di host, misalnya `.env`, lalu isi seluruh nilai wajib. Batasi permission file agar hanya operator deployment dapat membacanya.

Nilai berikut wajib konsisten:

- `NEXT_PUBLIC_APP_URL` dan `PUBLIC_APP_URL` memakai URL HTTPS kanonis yang sama.
- Password di `ACADEMY_MIGRATION_DATABASE_URL` sama dengan `ACADEMY_POSTGRES_PASSWORD`.
- Password di `ACADEMY_API_DATABASE_URL` sama dengan `ACADEMY_API_PASSWORD`.
- `ACADEMY_STORAGE_SIGNING_SECRET` berupa secret acak minimal 32 karakter.
- `SMTP_HOST` dan `SMTP_FROM` wajib terisi; uji kirim-verifikasi dan reset email sebelum GO.
- Secure cookie dipaksa aktif pada API dan web lewat override production; jangan gunakan HTTP untuk login production.
- Tunnel meneruskan HTTPS publik ke origin HTTP lokal. Jangan publikasikan port origin ke interface publik.

Jangan menaruh kredensial produksi dalam file contoh, shell history, image Docker, atau repository.

Variabel `SOURCE_DATABASE_URL`, `STORAGE_IMPORT_SOURCE`, dan kedua `CONFIRM_*` hanya digunakan pada maintenance migrasi. Kosongkan `CONFIRM_*` setelah job selesai. Akun `SMOKE_*` wajib akun khusus pengujian dengan data terkontrol, bukan akun pribadi operator. `ACADEMY_OFFSITE_BACKUP_ROOT` harus menunjuk media atau host berbeda; path lokal project tidak memenuhi backup off-host production.

## Validasi Tanpa Menjalankan Stack

Sebelum Compose, cek konsistensi env tanpa mencetak secret memakai `node scripts/validate-selfhosted-production-env.mjs --env-file (Resolve-Path .env).Path` (PowerShell). Setelah stack production tersedia lewat hostname nyata, jalankan `node scripts/selfhosted-production-preflight.mjs --base-url https://academy.example.com --output C:\secure\evidence\tls-preflight.json` dengan mengganti contoh domain. Kedua validator tidak membuktikan data sumber atau memberikan izin DNS cutover; ikuti `docs/33-selfhosted-uat-performance-gate.md`.

Setelah env lolos dan mailbox smoke khusus tersedia, ikuti `docs/37-selfhosted-smtp-smoke.md`. Perintah SMTP memerlukan token konfirmasi eksplisit karena benar-benar mengirim satu email; evidence PASS tetap harus dikonfirmasi diterima oleh operator/reviewer.

Jalankan dari root repository dengan file environment produksi:

```powershell
docker compose --env-file .env `
  -f compose.yaml `
  config --quiet
```

Periksa hasil render dan pastikan hanya Nginx memiliki `ports` serta bind address loopback:

```powershell
docker compose --env-file .env `
  -f compose.yaml `
  config
```

Uji sintaks Nginx tanpa menjalankan aplikasi:

```powershell
docker run --rm `
  --add-host web:127.0.0.1 `
  -v "${PWD}\nginx.conf:/etc/nginx/nginx.conf:ro" `
  nginx:1.27.5-alpine3.21@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 nginx -t
```

Alias `web` pada perintah ini hanya untuk resolusi nama saat uji sintaks; tidak menguji koneksi aplikasi. Sertifikat tidak dibutuhkan pada origin.

Next.js sudah mengirim CSP bernonce pada respons halaman; Nginx tidak menambahkan CSP kedua yang dapat menghambat skrip sah. Preflight HTTPS publik memeriksa CSP pada respons aplikasi dan header keamanan yang diteruskan Cloudflare. Jalankan smoke halaman utama dan dashboard pada setiap perubahan CSP.

## Start dan Pemeriksaan

Build dan start seluruh stack hanya setelah validasi konfigurasi dan backup data lulus; perintah ini dapat menjalankan migrasi database:

```powershell
docker compose --env-file .env `
  -f compose.yaml `
  up -d --build
```

Pada host Linux, gunakan bentuk setara berikut:

```sh
docker compose --env-file .env \
  -f compose.yaml \
  up -d --build
```

Untuk perubahan Nginx saja pada stack aktif, gunakan `docker compose --env-file .env -f compose.yaml up -d --no-deps --no-build nginx` agar migrasi tidak ikut berjalan.

Pemeriksaan minimum sebelum perubahan DNS atau cutover:

```powershell
docker compose --env-file .env `
  -f compose.yaml `
  ps

curl.exe -I http://127.0.0.1:9984/healthz
```

HTTP `/healthz` origin harus memberi `200`. Verifikasi URL publik HTTPS melalui Cloudflare sesudah tunnel aktif; validasi chain TLS dilakukan pada edge, bukan Nginx.

## Firewall

Inbound firewall:

- Tidak perlu membuka port aplikasi 80/443 ke internet; Cloudflare Tunnel membuat koneksi keluar.
- Port administrasi host, misalnya SSH, hanya dari sumber tepercaya sesuai kebijakan server.

Deny inbound publik:

- TCP 3000 untuk Next.js.
- TCP 3001 untuk Fastify API.
- TCP 5432 untuk PostgreSQL.

Jangan mengandalkan firewall saja. Pemeriksaan `docker compose config` juga harus membuktikan ketiga service internal tidak memiliki `ports`.

## TLS dan Tunnel

TLS publik berakhir di Cloudflare Edge. Cloudflare Tunnel menuju `http://127.0.0.1:9984`; origin HTTP hanya terikat pada loopback host dan tidak memerlukan sertifikat lokal. Atur mode SSL/TLS Cloudflare yang sesuai kebijakan, aktifkan HTTPS untuk hostname, lalu verifikasi endpoint publik dan header keamanan. Nginx tetap meneruskan `X-Forwarded-Proto: https` agar aplikasi mengenali skema publik dan secure cookies tetap aktif.

## Rollback Infrastruktur

Rollback image menggunakan tag atau digest image terakhir yang sudah diverifikasi, lalu jalankan kembali `compose.yaml`. Jangan menghapus volume PostgreSQL atau direktori storage. Perintah seperti `docker compose down -v` dilarang karena menghapus data persisten.

Rollback DNS, database, dan data mengikuti runbook cutover terpisah. Konfigurasi ini tidak memberi izin untuk publish atau cutover.
