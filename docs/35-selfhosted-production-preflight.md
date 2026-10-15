# Production preflight self-hosted

Probe ini read-only dan menghasilkan evidence `tlsPreflight` untuk gate UAT. Jalankan dari host yang memakai jalur DNS dan jaringan yang sama dengan pengguna production.

```bash
node scripts/selfhosted-production-preflight.mjs \
  --base-url https://academy.example.com \
  --health-path /api/health \
  --min-cert-days 14 \
  --output /secure/evidence/tls-preflight.json
```

Kontrol yang wajib lulus: sertifikat dipercaya dan cocok dengan hostname, masa berlaku tersisa memenuhi batas, HTTP mengarah ke HTTPS pada hostname yang sama, health endpoint memberi `2xx`, serta HTTPS memberi HSTS minimal 180 hari, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, dan `Content-Security-Policy`.

Script hanya mengirim `GET` tanpa kredensial dan tidak mengikuti redirect. Evidence selalu bertarget `production`, berlaku 24 jam, dan berstatus `FAIL` bila probe jaringan atau salah satu kontrol gagal. Exit code nonzero berarti NO-GO. Simpan file evidence di lokasi akses terbatas; masukkan `path`, `sizeBytes`, dan `sha256` keluaran CLI ke checklist UAT.
