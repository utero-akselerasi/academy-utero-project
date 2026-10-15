# Latihan rollback staging fase 13

Status: prosedur dan validator tersedia; **restore belum dijalankan**. Tidak berlaku untuk production. Snapshot awal staging `supabase-02` tercatat di `docs/17-runbook-fase-13-supabase-cutover.md`; bukan backup cutover final dan tidak boleh dipakai untuk memulihkan production.

1. Bekukan penulisan staging dan hentikan app staging. Pastikan operator telah mengidentifikasi `supabase-02` secara langsung di host, volume, container, dan konfigurasi; tunnel sumber saat audit adalah gateway `127.0.0.1:18100` dan DB `127.0.0.1:15532`. Jangan restore melalui port tersebut. Instance pengganti wajib memakai project/container, volume, gateway `127.0.0.1:18200`, DB `127.0.0.1:15632`, dan app `127.0.0.1:3100` yang berbeda. Jangan lanjut jika identitas instance, pemilik data, atau hash snapshot belum bisa dibuktikan. Simpan keadaan staging sekarang terpisah untuk forensik.
2. Catat SHA-256 dump PostgreSQL, arsip Storage, dan arsip config, beserta jumlah user `auth.users`, baris `utero_academy.user_profiles`, objek `storage.objects` untuk bucket yang diuji dari snapshot sumber. Verifikasi seluruh hash terhadap manifest backup *sebelum* restore. Jangan keluarkan service key, password, atau PII ke laporan. Pastikan ruang kosong cukup dan seluruh writer staging berhenti.
3. Restore hanya ke instance staging pengganti yang kosong dan telah diverifikasi terpisah dari `supabase-01`. Ikuti format arsip nyata dan alat `pg_restore`/`psql` sesuai header dump; restore DB Auth dan metadata Storage sebagai satu unit, lalu arsip byte Storage serta config staging. Jangan mengganti config JWT/key dengan kredensial production. Bila jenis arsip atau jalur mount belum jelas, hentikan; jangan coba restore in-place atau menebak perintah.
4. Setelah instance pengganti hidup, buat `evidence.json` privat dengan field `target: "staging"`, `endpoint: "http://127.0.0.1:18200"`, `database: "postgres@127.0.0.1:15632/postgres"`, `app: "http://127.0.0.1:3100"`, `sourceInstance: "supabase-02"`, `replacementInstance` dengan awalan `supabase-02-rollback-`, `replacementIdentitySha256`, `snapshotSha256`, `storageSha256`, `configSha256`, `authUsers`, `academyProfiles`, `storageObjects`, dan `storageBucket` (mis. `academy-private`). `replacementIdentitySha256` adalah digest manifest berisi nama project/container, path volume nyata, bind port, dan image digest pengganti; jangan masukkan secret. Semua hash hex SHA-256; jumlah berasal dari snapshot, bukan hasil restore. Simpan di luar repo.
5. Set `DEPLOY_TARGET=staging`, `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_DATABASE_URL`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` sesuai endpoint loopback yang dikunci validator. Jalankan `node scripts/verify-phase13-rollback-staging.mjs evidence.json snapshot.dump storage.tar config.tgz`. Exit 0 mengonfirmasi checksum ketiga artefak, jumlah Auth/DB/metadata Storage, bucket, dan HTTP app; **bukan** bukti kesamaan seluruh byte Storage setelah restore atau login. Cek unduhan objek dan signed URL dengan `smoke:phase13-storage-staging` setelah menyiapkan clone sumber sesuai script tersebut, lalu login/logout dengan akun uji, akses app dan alur dasar melalui browser. Catat status dan waktu tiap probe.
6. Jika salah satu cek gagal, pertahankan maintenance dan jangan alihkan traffic. Jika semua lulus, minta persetujuan operator untuk mengalihkan hanya traffic staging. Simpan instance gagal untuk investigasi dan catat bukti hash, count, smoke, app, serta approval tanpa rahasia.

Validator tidak menjalankan restore dan tidak menulis ke server. Bukti live restore tetap blocker sampai latihan manual dilakukan pada staging tervalidasi.

## Hasil pemeriksaan 2026-10-12 (NO-GO)

- `Test-NetConnection 127.0.0.1 -Port 18100 -InformationLevel Quiet`, port `15532`, dan port `3000`: ketiganya `True`. Proses tunnel terbukti meneruskan `18100` ke gateway `8100` dan `15532` ke DB staging sumber. Port ini bukan target replacement dan sekarang ditolak validator rollback.
- Environment proses tidak memuat `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_DATABASE_URL`, `SUPABASE_STAGING_SERVICE_ROLE_KEY`, `DEPLOY_TARGET`, atau `ROLLBACK_EVIDENCE_FILE`. Tidak ditemukan dump/manifest snapshot rollback di workspace. Jangan ambil credential production atau memakai snapshot pra-freeze sebagai baseline cutover.
- `node scripts/verify-phase13-rollback-staging.mjs I:\academy-utero-backups\rollback-staging\evidence.json I:\academy-utero-backups\rollback-staging\snapshot.dump` menghasilkan `Rollback staging NO-GO: ENOENT: no such file or directory, lstat 'I:\academy-utero-backups\rollback-staging\evidence.json'` (exit `1`); path tersebut belum tersedia, bukan bukti restore.
- Restore, hash arsip, dan probe Auth/DB/Storage/app **belum dijalankan**. Dilarang mengubah container, volume, atau DB yang sudah berjalan hanya berdasarkan listener lokal. Operator perlu menyediakan manifest dan snapshot terpercaya beserta hash, kredensial staging, bukti pemetaan tunnel ke instance terisolasi, identitas volume/mount, serta izin maintenance sebelum langkah 1–5. Simpan keluaran tiap perintah (timestamp, exit code, hash, tanpa rahasia) di luar repo.

## Audit blocker 2026-10-13

- Host `supabase-server` memiliki hanya direktori instance `supabase-01` dan `supabase-02`. `docker ps -a` tidak menemukan nama container `replacement` atau `rollback`; seluruh container `supabase-02-*` sedang hidup. Restore in-place ditolak.
- Snapshot tercatat tersedia di `/data/supabase/instances/supabase-02/academy-staging-pre-rehearsal-20261012T110258Z/`: `postgres.dump` 567487 byte dan `storage.tgz` 259931135 byte. `sha256sum -c SHA256SUMS` lulus untuk keduanya: DB `d57541611b0b3aaa3ff83e544bd4121c926eea3d0db8aab22f2b879fb422cfd0`, Storage `477426292e28545127688a86c05557b285cfdafb41d6d6e0d380f4a9d8f6664e`.
- Config tercatat tersedia di `/data/supabase/instances/supabase-02/config-pre-academy-staging-20261012T103646Z.tgz`, 142133 byte, SHA-256 `db91695417749b744dcbeaaec2e79b0bc1c7aa318dbe9baca344f2891e2d8067`.
- Dump dikenali sebagai PostgreSQL custom dump v1.16; arsip Storage dan config dapat dibaca. Snapshot ini adalah pra-latihan staging, bukan backup final pasca-freeze production.
- Keputusan: **NO-GO restore** sampai instance pengganti dengan volume baru dan port `18200/15632` tersedia serta identitasnya direkam dan di-hash. Tidak ada mutasi server pada audit ini.

## Preflight provisioning 2026-10-13

- `ssh -o BatchMode=yes maskhar@20.20.20.3 'df -h /data /var/lib/docker; df -i /data'`: `/data` 853 GiB dan 60.992.061 inode tersedia; root filesystem Docker 7,6 GiB tersedia. Ruang `/data` bukan blocker, tetapi root Docker tetap perlu dihitung sebelum provisioning.
- `ssh ... 'stat -c "%A %U %G %n" /data/supabase/instances; test -w /data/supabase/instances ...; sudo -n true ...'`: parent instance `drwxr-xr-x root root`, `parent_writable=no`, `sudo_noninteractive=no`. Tidak ada otorisasi membuat sibling instance di lokasi yang diwajibkan gate.
- `docker inspect supabase-02-db` membuktikan project `supabase-02` menggunakan bind mount DB di `/data/supabase/instances/supabase-02/config/volumes/db/data` dan volume `supabase-02_db-config`. Compose sumber memakai `container_name: supabase-02-*`, gateway `127.0.0.1:8100`, pooler `127.0.0.1:5532/6643`; port `8200/5632/6743` kosong saat pemeriksaan. Jangan menjalankan Compose sumber apa adanya sebagai replacement.
- Template manifest privat yang harus diisi setelah provisioning: `{"sourceInstance":"supabase-02","project":"supabase-02-rollback-drill","root":"/data/supabase/instances/supabase-02-rollback-drill","gatewayPort":8200,"databasePort":5632,"mounts":["/data/supabase/instances/supabase-02-rollback-drill/db","/data/supabase/instances/supabase-02-rollback-drill/storage"],"containers":["supabase-02-rollback-drill-db","supabase-02-rollback-drill-auth"],"images":["sha256:<digest image nyata>"]}`. Isi semua container, image, dan mount dari `docker inspect` nyata, bukan menyalin contoh. Jalankan `node scripts/preflight-phase13-rollback-replacement.mjs <manifest.json>`; verifikasi digest keluaran terhadap `replacementIdentitySha256` di evidence. Gate file ini **tidak** membuktikan topology live: cocokkan lagi `docker inspect`, `ss -ltn`, kepemilikan path, image digest, dan tunnel `18200:127.0.0.1:8200` serta `15632:127.0.0.1:5632` secara langsung sebelum restore.
- **NO-GO:** belum ada replacement, manifest identitas nyata, app replacement, atau kredensial replacement; tidak ada restore atau probe pasca-restore. Operator dengan hak provisioning perlu membuat sibling instance dan volume baru secara terisolasi tanpa mengganti source; setelah itu validasi snapshot dan identitas sebelum setiap perintah `pg_restore`, ekstraksi Storage, atau menjalankan container.

## Percobaan provision dan handoff operator (2026-10-13)

Percobaan nyata memakai SSH `maskhar@20.20.20.3`, bukan `sudo`: `target=/data/supabase/instances/supabase-02-rollback-drill; resolved=$(readlink -m -- "$target"); test "$resolved" = "$target"; test ! -e "$target"; mkdir -- "$target"`. Guard path absolut dan target belum ada lulus; `mkdir` gagal `Permission denied` (exit 1). `stat -c '%A %U:%G %n' /data/supabase/instances` menunjukkan `drwxr-xr-x root:root`; `sudo -n true` gagal, target tetap belum ada. Tidak ada volume/container/tunnel baru. **Restore dan verifikasi Auth, DB, Storage, app belum dapat dijalankan**; jangan memakai source `supabase-02` sebagai replacement.

Operator dengan hak root: jalankan blok berikut di `supabase-server` setelah memeriksa host dan pemilik target. Blok ini hanya membuat direktori baru yang belum ada; tidak menyalin config, menjalankan Compose, mengekstrak arsip, atau mengubah source.

```sh
set -eu
test "$(hostname)" = supabase-server
parent=/data/supabase/instances
target=/data/supabase/instances/supabase-02-rollback-drill
test "$(readlink -e -- "$parent")" = "$parent"
test "$(readlink -m -- "$target")" = "$target"
test "$(dirname -- "$target")" = "$parent"
test ! -e "$target"
test ! -L "$target"
test "$(stat -c '%U:%G' -- "$parent")" = root:root
install -d -o maskhar -g maskhar -m 0750 -- "$target"
stat -c '%A %U:%G %n' -- "$target"
```

Sebelum melanjutkan, operator wajib menyediakan Compose replacement yang direview: semua `container_name`, port publik, network, named volume, bind mount, JWT/key, dan callback URL terpisah dari `supabase-01`/`supabase-02`. Konfirmasi read-only `docker compose -p supabase-02-rollback-drill -f <compose-replacement> config`, `docker inspect <container-replacement>` dan `ss -ltn`; catat image digest serta root volume kanonis dalam manifest privat dan jalankan `node scripts/preflight-phase13-rollback-replacement.mjs <manifest.json>`. Pastikan port gateway `8200`, DB `5632`, pooler transaksi `6743` dan tunnel workstation `18200/15632` tidak mengenai source. Ulang `sha256sum -c SHA256SUMS` di direktori snapshot dan cek SHA-256 config `db91695417749b744dcbeaaec2e79b0bc1c7aa318dbe9baca344f2891e2d8067` sebelum restore. Jangan gunakan `pg_restore --clean`, perintah ekstraksi, atau `docker compose up` sebelum seluruh gate identitas dan kecocokan target DB kosong lulus; perintah restore akhir harus diturunkan dari Compose replacement dan format dump yang telah diaudit, bukan dari Compose source.
