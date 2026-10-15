# SMTP Production Smoke Evidence

Tool ini mengirim tepat satu email melalui SMTP production untuk membuktikan TLS, autentikasi, dan penerimaan alamat smoke. Perintah bersifat mutasi eksternal: jalankan hanya saat mailbox tujuan diawasi operator.

## Prasyarat

- Gunakan Node.js sesuai `package.json` dan dependency `nodemailer` yang sudah terpasang.
- Simpan env production di file privat di luar repository. Variabel wajib: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, dan `SMTP_FROM`.
- Gunakan `SMTP_PORT=465` untuk implicit TLS atau `SMTP_PORT=587` untuk STARTTLS wajib. Port lain ditolak.
- `SMTP_HOST` wajib hostname DNS production. IP, localhost, placeholder, fixture, dan sertifikat tidak valid ditolak.
- Siapkan mailbox khusus penerima smoke yang berbeda dari `SMTP_FROM`. Jangan gunakan alamat pelanggan.
- Gunakan path absolut berbeda untuk env dan evidence.

## Menjalankan

PowerShell:

```powershell
node scripts/selfhosted-smtp-smoke.mjs `
  --env-file C:\secure\academy-production.env `
  --to production-smoke@academy.id `
  --output C:\secure\evidence\smtp-smoke.json `
  --confirm send-production-smoke-email
```

Linux:

```bash
node scripts/selfhosted-smtp-smoke.mjs \
  --env-file /secure/academy-production.env \
  --to production-smoke@academy.id \
  --output /secure/evidence/smtp-smoke.json \
  --confirm send-production-smoke-email
```

Token konfirmasi wajib sama persis. Tanpa token tersebut tool tidak membuka koneksi SMTP atau mengirim email.

## Evidence dan keamanan

- Evidence memakai `schemaVersion: 1`, `gate: smtpSmoke`, `target: production`, dan status `PASS` atau `FAIL`.
- `PASS` hanya terjadi bila `verify()` membuktikan TLS/auth dan hasil `sendMail()` menerima alamat tujuan tanpa recipient yang ditolak.
- Evidence kedaluwarsa tepat 24 jam setelah `finishedAt`; jalankan ulang bila melewati `expiresAt`.
- Subject unik memuat waktu UTC dan UUID sehingga operator dapat mencocokkan email dengan evidence.
- Message ID hanya disimpan sebagai SHA-256. Password, username, dan error mentah provider tidak ditulis ke stdout, stderr, atau evidence.
- Evidence ditulis melalui file sementara lalu rename dan dibuat dengan mode `0600` pada platform yang mendukungnya.
- `FAIL` menghasilkan exit code nonzero. Jangan mempromosikan evidence gagal ke checklist UAT.

## Verifikasi operator

1. Pastikan proses keluar dengan status `PASS` dan exit code `0`.
2. Buka mailbox khusus lalu cocokkan subject persis dengan field `subject` pada evidence.
3. Pastikan email diterima setelah `startedAt` dan sebelum `finishedAt` dengan header `X-Academy-Smoke-Test: production`.
4. Hitung SHA-256 dan ukuran file evidence saat memasukkannya sebagai kind `smtpSmoke` ke checklist UAT.
5. Reviewer berbeda dari operator menjalankan evaluator UAT sebelum `expiresAt`.

Test otomatis memakai dependency injection untuk transport, waktu, dan UUID. Test tidak membuka koneksi SMTP dan tidak mengirim email nyata.
