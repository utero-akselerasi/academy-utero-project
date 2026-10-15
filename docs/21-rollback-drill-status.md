# Status rollback drill staging — 2026-10-13

**Status poin 4–5: PLATFORM RESTORE PASS / APP DRILL NO-GO.** Restore DB/Auth/Storage ke replacement terisolasi dan probe platform pasca-restore lulus. Snapshot tidak memuat schema/data Academy, app replacement belum dijalankan, dan tidak ada traffic switch. Production dan source `supabase-02` tidak diubah.

## Bukti operasi nyata

| Check | Command (host `supabase-server`, akun `maskhar`) | Hasil |
| --- | --- | --- |
| Path pilihan standar | `target=/data/supabase/instances/supabase-02-rollback-drill; resolved=$(readlink -m -- "$target"); test "$resolved" = "$target"; test ! -e "$target"; mkdir -- "$target"` | Guard lulus; `mkdir` exit 1 `Permission denied`. Parent `root:root`, `sudo -n true` gagal. |
| Alternatif terisolasi | `readlink -e /home/maskhar; df -h /home/maskhar /var/lib/docker /data; docker info --format '{{.DockerRootDir}}'; docker exec supabase-02-db du -sh /var/lib/postgresql/data; docker exec supabase-02-storage du -sh /var/lib/storage` | Home writable; root Docker `/var/lib/docker` punya 7,6 GiB bebas, `/data` 853 GiB; DB sumber 79,9 MiB, Storage 280,3 MiB. Ini perkiraan, bukan bukti cukup untuk semua image/runtime. |
| Port | `ss -ltn 'sport = :8200'`, ulang untuk `5632` dan `6743` | Tiga port bebas saat diperiksa. |
| Integritas snapshot | `cd /data/supabase/instances/supabase-02/academy-staging-pre-rehearsal-20261012T110258Z && sha256sum -c SHA256SUMS`; bandingkan SHA-256 config dengan `db91695417749b744dcbeaaec2e79b0bc1c7aa318dbe9baca344f2891e2d8067` | DB dan Storage `OK`; hash config cocok. Tanpa menampilkan secret. |
| Provision alternatif | `install -d -m 0700 -- /home/maskhar/supabase-replacements /home/maskhar/supabase-replacements/supabase-02-rollback-drill /home/maskhar/supabase-replacements/supabase-02-rollback-drill/config`; `tar -xzf /data/supabase/instances/supabase-02/config-pre-academy-staging-20261012T103646Z.tgz -C /home/maskhar/supabase-replacements/supabase-02-rollback-drill/config` | Berhasil; path absolut telah diverifikasi `readlink`, target semula belum ada. Owner `maskhar:maskhar`, mode `0700`; hanya arsip config di tree baru (~820 KiB). Tidak ada move/delete. |
| Isolasi Compose | `grep -nE 'container_name:|127\.0\.0\.1:(8100|5532|6643)' /home/maskhar/supabase-replacements/supabase-02-rollback-drill/config/docker-compose.yml` | Arsip masih menyebut `supabase-02-*` dan port sumber `8100/5532/6643`; tidak aman dijalankan. Variable URL dalam `.env` berkelas loopback; nilainya tidak ditampilkan. `node` dan `jq` tidak ada di host untuk memproses output JSON Compose; belum ada bukti seluruh mount/network/env terisolasi. |
| Kandidat Compose replacement | Kandidat privat dibuat di tree replacement dari resolved Compose, seluruh 11 image diganti RepoDigest lokal, project/network/volume/container/mount/port/callback ditargetkan ke replacement. File mode 0600; SHA-256 file 1f71ed65fd3d36ffc73f961d00b6bcb969800d92e90c1259deb809c68941eaed. Validator dijalankan lewat SSH stdin agar secret tidak disimpan di workstation. | PASS statis: 11 service, 11 container, 16 bind mount, 2 named volume, port 8200/5632/6743, satu network; canonical Compose SHA-256 70d53a4b506e6c97d4708ff992ccc1870ff40d37d71ff473997a8d6d92f73870. Docker Compose parse PASS. Container replacement belum dijalankan. |
| Runtime replacement setelah persetujuan operator | Sebelum start, SHA Compose dan ketersediaan port dicek; ketiga source DB/Auth/Storage dalam status running. Docker Compose start project replacement saja, tanpa opsi hapus volume dan tanpa restore. | 11/11 container running dan health healthy; semua hanya di network supabase-02-rollback-drill_default. Host port hanya loopback 8200/5632/6743. Source DB/Auth/Storage tetap running. Endpoint Auth gateway memberi 401 tanpa key, bukan bukti Auth login. DB replacement memiliki auth dan storage bootstrap tetapi belum memiliki schema Academy; sesuai belum restore. |
| Manifest live | Docker inspect 11 container menjadi manifest non-secret privat pada root replacement, SHA-256 file 12d98857f4401241d2bfe63a7cab51a089ef3a1415169d4d9e28bad20c25adb9. Validator dijalankan dalam container Node sementara dengan network none dan root replacement read-only. | PASS: 11 container, 16 bind mount kanonis di root replacement, 11 image ID; identity SHA-256 6cc619b22aa0e8ffbcf8dbcdc4ec15fb84040e9e7bff104e92a884ac418555bb. Manifest harus tetap dibandingkan dengan docker inspect baru sebelum restore. |

## Gate historis sebelum restore (sudah dilalui)

1. Operator review manifest runtime dan kapasitas, lalu menyetujui restore drill terpisah. Persetujuan start sebelumnya tidak mencakup restore.
2. Tepat sebelum restore, bandingkan lagi manifest dengan docker inspect, port/network/mount dan SHA-256 snapshot. Pastikan backup dipakai hanya sebagai source baca dan DB target hanya instance replacement.
3. Restore non-in-place ke replacement, lalu probe Auth, DB, Storage byte, dan app pada tunnel replacement `18200/15632`. Jika salah satu cek gagal, hentikan dan jangan alihkan traffic. Digest manifest harus terikat `replacementIdentitySha256` pada evidence restore.

Tidak ada otorisasi memakai source `supabase-02` atau production sebagai target restore. Tree alternatif yang sudah dibuat sengaja dibiarkan utuh untuk tindak lanjut; jangan hapus secara otomatis.

## Update restore terverifikasi — 2026-10-13

- Secret replacement dirotasi sebelum restore. Audit non-secret menemukan 39 nilai sensitif non-empty berbeda dari source; dua kesamaan tersisa hanya placeholder key Functions. Compose canonical SHA-256 sesudah rotasi: `a7da4f5376581608996f3f08249e8dc4ee0962be5f88c73821035d8dd521b7d6`.
- Snapshot `academy-staging-pre-rehearsal-20261012T110258Z` lulus `sha256sum -c`. Dump berisi 245 entry Auth, 106 entry Storage, dan nol entry Academy.
- Restore PostgreSQL memakai `supabase_admin`, `--clean --if-exists --exit-on-error --single-transaction`, target hanya DB replacement. Hasil: `auth.users=0`, `storage.objects=2218`, schema `utero_academy` tidak ada.
- Restore Storage lulus verifikasi seluruh arsip: 2.218 file, 2.396 direktori, 270.364.441 byte, set path dan SHA-256 per file cocok. Sampel 50 row DB cocok ke file version fisik.
- Pasca-restore: 11/11 container `running` dan `healthy`; Auth health `200`, REST service-role `200`, Storage bucket API `200`, unduh satu object terautentikasi `200` dengan 66.751 byte.
- Manifest runtime baru dari `docker inspect`: 11 container, 11 image ID, 16 bind mount. SHA-256 file `7c7f75eae5ad2e3d00e3274b65d3d5782a30851cfa729de224b885f0a25466b7`; validator network-none PASS, identity SHA-256 `6cc619b22aa0e8ffbcf8dbcdc4ec15fb84040e9e7bff104e92a884ac418555bb`.

## Gate lanjut setelah restore

1. Siapkan backup staging current-state yang memuat Academy, Auth fixture, tracker migrasi, dan Storage aplikasi; snapshot lama tidak dapat membuktikan journey Academy.
2. Jalankan app replacement terpisah pada port `3100`, tunnel replacement `18200/15632`, lalu smoke browser/server tanpa mengalihkan traffic.
3. Jalankan E2E write+cleanup dan JWT matrix lintas persona pada staging current-state.
4. Production tetap **NO-GO** sampai baseline production clone `REVIEWED`, preflight production, backup final, reviewer, dan rollback command final tersedia.

## Status runtime setelah drill

Atas persetujuan operator, 11 container `supabase-02-rollback-drill-*` dihentikan memakai `docker compose stop`. Semua berstatus `exited`; volume, bind mount, manifest, dan bukti restore tidak dihapus. Stack `supabase-02-*` dan stack lama `supabase-*` tetap berjalan sampai pemilik menentukan satu instance yang harus dipertahankan.

Operator kemudian menetapkan stack pertama `supabase-*` sebagai satu-satunya Supabase aktif di host. Sebelas container `supabase-02-*` dihentikan memakai `docker stop` tanpa menghapus container atau volume; seluruhnya diverifikasi `exited`. Stack utama `supabase-*` tetap berjalan; DB, Auth, Storage, dan gateway `healthy`. Staging `supabase-02` tidak tersedia untuk smoke/JWT sampai dipindahkan ke host terpisah. Jangan menganggap shutdown sebagai bukti production siap.
