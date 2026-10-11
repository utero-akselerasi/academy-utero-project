# Implementasi fase 1–13 pendaftaran dan seleksi

Status dokumen: 11 Oktober 2026. Kode aplikasi selesai dan tervalidasi lokal. Migrasi belum diterapkan ke Supabase lama maupun baru.

## Fase

1. **Model jalur pendaftaran** — sumber `self`, `school`, dan `admin`; akun pelamar memakai role `applicant`.
2. **Akun pelamar** — signup, verifikasi email Supabase, provisioning profil dan role idempoten.
3. **Pendaftaran mandiri** — program, identitas sekolah, NIS/NIM, jurusan, periode, motivasi, CV, portofolio, dan kode partner.
4. **Partner sekolah** — status partner, kode referral, masa berlaku, kuota, serta validasi sekolah terverifikasi/aktif.
5. **Pendaftaran sekolah** — input satuan dan import CSV maksimal 200 baris dengan hasil per baris.
6. **Review administrasi** — status dokumen dan workflow dilindungi dari perubahan peserta/sekolah.
7. **Materi dan bank tes** — jalur per jurusan, materi, paket berversi, soal objektif/esai/berkas, jadwal, durasi, dan batas percobaan.
8. **Pelaksanaan seleksi** — tes peserta, autosave jawaban, batas waktu server, penilaian otomatis dan manual.
9. **Keputusan seleksi** — lulus, tidak lulus, daftar tunggu; hasil publik terpisah dari catatan internal.
10. **Bypass Super Admin** — hanya `super_admin`, alasan wajib, audit, tanpa membuat nilai palsu.
11. **Penerimaan dan onboarding** — konversi atomik ke role `intern`, profil peserta, periode resmi, daftar ulang, dan biodata lengkap.
12. **Aktivasi fitur magang** — absensi, laporan, task, dan LMS ditolak server sebelum biodata lengkap atau tanggal mulai resmi.
13. **Notifikasi, monitoring, dan rollout** — outbox notifikasi in-app, portal sekolah untuk status/nilai, test lokal, serta rencana pilot.

## Validasi lokal

- `npm run typecheck`: lulus.
- `npm run lint:ci`: lulus.
- `npm test`: 730 test lulus.
- `npm run build`: build produksi lulus.
- `npm run migrate`: dry-run menemukan 45 migrasi sampai `0039`; tidak membuka koneksi database.

## Batas deployment

Fase 13 belum boleh dinyatakan selesai di produksi. Audit `docs/15-audit-migrasi-supabase-2026-10-11.md` membuktikan database dan Storage Supabase lama serta baru masih bercabang. Sebelum apply `0038`/`0039` dan cutover:

1. Bekukan penulisan atau siapkan sinkronisasi delta dua arah.
2. Backup database, Auth, dan seluruh bucket Storage kedua server.
3. Rekonsiliasi ID attendance, daily report, user Auth, dan objek Storage.
4. Uji `0038` dan `0039` pada clone/staging PostgreSQL melalui transaksi nyata.
5. Jalankan smoke test tiga jalur, tes seleksi, bypass, onboarding, dan aktivasi tanggal.
6. Pilot satu sekolah, pantau error/outbox, lalu putuskan cutover dengan rollback plan tertulis.
