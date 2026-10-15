# Rehearsal rollback replacement — 2026-10-13

**Status: PLATFORM RESTORE PASS / APP REHEARSAL NO-GO.** Replacement terisolasi sudah dijalankan, secret dipisahkan, DB/Auth/Storage direstore, dan platform diprobe. Snapshot tidak memiliki Academy dan app replacement belum dijalankan. Source `supabase-02` dan production tidak diubah.

## Bukti persiapan

Target: `/home/maskhar/supabase-replacements/supabase-02-rollback-drill/config`. `readlink -e` memastikan root dan config kanonis di home `maskhar`. Arsip config yang sudah di-hash dan diekstrak dalam rehearsal sebelumnya tetap dipakai. `docker-compose.source.yml` dan `.env.source` disimpan di tree replacement; `.env` dan `.env.source` mode `0600`. Hanya salinan `docker-compose.yml` yang diganti nama container dan port; tidak menjalankan Compose source.

Command audit resolved Compose (di host, dari direktori config): `docker compose -p supabase-02-rollback-drill config --format json` lalu parse JSON dan **cetak hanya** nama service, container, port, network, mount serta hasil pass/fail; jangan log environment. Hasil:

| Gate | Hasil |
| --- | --- |
| 11 service/container | Semua `supabase-02-rollback-drill-*`; tidak ada nama `supabase-02-*` asli. |
| Host port | `127.0.0.1:8200`, `127.0.0.1:5632`, `127.0.0.1:6743` saja. Percobaan audit pertama gagal karena arsip menggunakan `8100/5532/6643` tanpa bind host eksplisit; salinan diperbaiki lalu audit lulus. |
| Bind mounts | Seluruh path resolved di bawah `/home/maskhar/supabase-replacements/supabase-02-rollback-drill/`; tidak ada mount source/production. |
| Network dan named volumes | `supabase-02-rollback-drill_default`, `supabase-02-rollback-drill_db-config`, `supabase-02-rollback-drill_deno-cache`; tidak memakai resource project sumber. |
| Env references | Resolved env dicek tanpa menampilkan nilai; tidak ditemukan referensi eksplisit `supabase-01`, `supabase-02` di luar prefix replacement, IP publik server, domain production, atau URL loopback port sumber `8100/5532/6643`. |
| Secret comparison dengan `.env` source live | `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` berbeda; **`POSTGRES_PASSWORD` dan `SECRET_KEY_BASE` sama**. Nilai rahasia/hash tidak dicetak. |

**Blocker tepat:** kredensial DB dan secret base masih sama dengan source. Konfigurasi arsip juga menyimpan referensi internal yang belum diuji runtime; kesamaan secret cukup untuk menggagalkan gate. Jangan menjalankan `docker compose up`, `pg_restore`, atau ekstraksi arsip Storage ke container sebelum dua rahasia tersebut dirotasi **hanya di replacement** dan keterkaitan antar layanan (password database/pooler, token/cookie) diverifikasi. Audit ulang *seluruh* secret penting terhadap source (termasuk encryption keys dan dashboard), URL redirect, tag/digest image, root volume, serta bind host; buat manifest identitas aktual dan jalankan `node scripts/preflight-phase13-rollback-replacement.mjs <manifest.json>`. Pastikan akses hanya lewat tunnel replacement `18200:127.0.0.1:8200` dan `15632:127.0.0.1:5632`. Tidak boleh memakai credential production.

Sesudah gate lulus dan DB pengganti dibuktikan kosong, ulang `sha256sum -c SHA256SUMS` pada snapshot di `/data/supabase/instances/supabase-02/academy-staging-pre-rehearsal-20261012T110258Z` serta hash config `db91695417749b744dcbeaaec2e79b0bc1c7aa318dbe9baca344f2891e2d8067`; baru lakukan restore DB, byte Storage, verifikasi Auth/DB/Storage, dan app replacement dengan evidence privat. Jika app belum disiapkan pada port `3100`, status tetap NO-GO. Jangan alihkan traffic.

Tidak ada penghapusan atau move file; tree replacement dan salinan konfigurasi tetap tersedia untuk tindak lanjut.
