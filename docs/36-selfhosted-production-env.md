# Validator environment production self-hosted

Validator ini memeriksa konfigurasi lokal sebelum stack production dijalankan. Ia tidak membuka koneksi jaringan, tidak login ke layanan mana pun, dan tidak mencetak nilai environment atau secret.

## Menjalankan

Gunakan env operator di luar repository dan berikan path absolut:

```powershell
node scripts/validate-selfhosted-production-env.mjs --env-file C:\secure\academy-production.env
```

```bash
node scripts/validate-selfhosted-production-env.mjs --env-file /etc/academy/production.env
```

Exit code `0` menghasilkan JSON ringkas dengan `ready: true` dan nama kelompok pemeriksaan. Kesalahan apa pun menghasilkan exit code nonzero. Output gagal hanya menyebut nama variabel atau jenis pemeriksaan, bukan nilainya.

## Pemeriksaan fail-closed

- Semua konfigurasi runtime inti wajib terisi dan tidak boleh memakai placeholder atau fixture yang dikenal.
- `NEXT_PUBLIC_APP_URL` dan `PUBLIC_APP_URL` wajib berupa origin HTTPS kanonis yang identik, tanpa kredensial, path, query, fragment, atau trailing slash.
- `ACADEMY_SECURE_COOKIES=true`; `docker-compose.production.yml` juga wajib memaksa `ACADEMY_SECURE_COOKIES: "true"` pada web dan `SECURE_COOKIES: "true"` pada API.
- URL migrasi dan API wajib menunjuk database target yang sama dengan user terpisah. Password pada URL wajib cocok dengan variabel password terkait.
- `SOURCE_DATABASE_URL` optional sebelum cutover. Bila terisi, URL harus valid dan tidak boleh menunjuk host, port, serta database target yang sama.
- SMTP host, port, user, password, dan alamat pengirim wajib valid secara struktural. Validator tidak mencoba mengirim email.
- Signing secret minimal 32 byte. Password PostgreSQL, API, SMTP, dan signing secret wajib berbeda.
- `ACADEMY_TLS_CERT_DIR` wajib absolut dan memuat `fullchain.pem` serta `privkey.pem` nonkosong.
- `STORAGE_IMPORT_SOURCE` optional sebelum cutover. Bila terisi, path wajib absolut dan menunjuk direktori yang ada.

Template `docker-compose.production.env.example` hanya referensi nama variabel. Jangan menaruh env production nyata di repository atau meneruskannya melalui argumen command line selain path file.

## Batasan

Kelulusan validator hanya membuktikan bentuk dan konsistensi konfigurasi lokal. Hasil ini tidak menggantikan `docker compose config`, validasi sertifikat terhadap domain, koneksi PostgreSQL sumber/target, uji SMTP, verifikasi migrasi data dan byte storage, smoke lima role, health check, backup/restore drill, monitoring, ataupun persetujuan GO/NO-GO production live.
