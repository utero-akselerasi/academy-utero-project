# Drill migrasi Academy pada Supabase shared — 2026-10-13

**Status: drill clone lulus / NO-GO live.** Develop Academy memakai instance shared di `20.20.20.173`; production shared tetap di `20.20.20.3`. Total user Auth dan object Storage seluruh host bukan milik Academy. Tidak ada SQL migrasi yang diterapkan pada database live kedua host.

## Bukti backup dan clone develop

- Backup logis PostgreSQL current-state hanya-baca disimpan privat di `/home/maskhar/academy-phase13-backups/2026-10-13/develop-shared-readonly-20261013.dump` pada host dev. Mode file `0600`, ukuran 5.506.940 byte, 3.409 entry, SHA-256 `ec7830443d741e3b5d3f1c6f5ff62ec4cbfe74e0145a4b0c7a652d9830c11d07`. Isi dump juga memuat project lain; jangan bagikan atau commit. Ini **bukan** snapshot atomik lintas DB/Storage/config, dan bukan backup lengkap untuk mengotorisasi migrasi live.
- Dua upaya clone pada cluster dev gagal karena extension `pg_cron` hanya dapat dibuat pada database `postgres`, lalu ACL fungsi `pg_graphql` tidak cocok. Target clone yang gagal dihapus; source dev tetap `running/healthy` dan count tidak berubah.
- Dump SHA-256 cocok setelah ditransfer sementara ke workstation. Restore ke PostgreSQL lokal pada DB baru `phase13_live_dev_20261013` berhasil dengan entri `pg_cron`/`cron` dikecualikan dan ACL dump tidak direplay. File dump sementara workstation dan daftar restore sementara dihapus; backup privat di host dev tetap ada.
- Clone segar: 63 tabel Academy, 29 profile Academy, 208 user Auth global, tracker Academy tidak ada. Count Storage saat dump 4.238, sedangkan audit live sebelumnya 4.228: writer bersama tetap berjalan; jangan klaim snapshot DB/Storage konsisten. Katalog column/function/index/policy/bucket pada clone cocok dengan capture live dev. Grant pada clone tidak dapat digunakan sebagai bukti kesetaraan live karena restore memakai `--no-acl`.

## Uji runner pada clone disposable

- DB probe `phase13_live_dev_probe_20261013` dibuat hanya dari clone segar. Sebanyak 43 versi `0001–0037` ditandai `applied_by=synthetic-clone-baseline` **hanya di probe**, bukan bukti migrasi tersebut pernah dijalankan pada host live. SHA-256 script baseline sintetis `1e2e02419ccea7eb495fb45f7bd4183e31a27eae6a55fecb74cd502b25b89c8a`.
- Runner `scripts/migrate.mjs --apply` pada probe menerapkan `0038–0046` (9 versi) dan mencatat checksum; `0047` ditolak dengan `P0001` karena guard policy Storage global. Tracker probe sekarang 52 entri/maksimum `0046`; `0047–0052` tidak dijalankan.
- Policy `Public Access` pada clone memakai allowlist bucket tanpa `academy-private`; policy `Authenticated Upload/Update/Delete` juga terbatas pada bucket lain. Kegagalan probe pertama berasal dari guard lama yang menolak nama policy, bukan cakupannya. Policy shared tidak dihapus: Buzzerhood/SoundPub dan workload lain tetap utuh.

## Drill lanjutan pada probe disposable

- `0047` dan `0048` sekarang mengevaluasi scope ekspresi `USING`/`WITH CHECK` policy berdasarkan role dan bentuk bucket equality/allowlist yang terdeparse PostgreSQL. Nama policy tidak dipakai sebagai bukti. Bentuk lain dan penyebutan `academy-private` ditolak. Uji policy adversarial `((bucket_id = 'avatars'::text) AND true) OR true` ditolak; uji penerapan keduanya dalam transaksi pada clone segar lulus, kemudian rollback. Validator masih memerlukan uji JWT dan HTTP pada staging sesungguhnya.
- Probe akhir `phase13_live_dev_probe3_20261013` diturunkan dari DB clone segar. Baseline sintetis **hanya pada probe** menandai 43 migrasi `0001–0037`; runner menerapkan 15 migrasi `0038–0052` tanpa gagal. Tracker probe berisi 58 versi, maksimum `0052`, dan checksum `0047`=`d276822335933bc7d4fb23b5dfedd964f2bbb06d060915adeeb9682dac0f07db`, `0048`=`ba8aca3753969c10e875339290a07d13cc4be32aff2d5322c787a65832b60874`. Ini **bukan** bukti baseline historis live. Probe kedua dengan checksum lama dihapus setelah probe akhir lulus.
- Policy `storage.objects` sebelum/sesudah identik (MD5 katalog `962f15240f84bfbb18fcd42375f6103e`). Seluruh bucket lama sebelum/sesudah identik; bucket Academy `selection-answers` dan `academy-private` baru ditambahkan. Bucket `academy-private`: `public=false`, batas 20 MiB, tidak ada policy Storage yang menyebut namanya.
- Transaksi probe dengan objek sintetis yang di-rollback: `anon` tidak melihat objek (`0` baris), `authenticated` tidak boleh INSERT (RLS menolak). Uji SELECT `authenticated` terhambat izin tabel SoundPub yang hilang pada clone `--no-acl`; **bukan** bukti izin SELECT live. Belum ada uji HTTP Storage/signed URL atau cleanup E2E.
- Tes lengkap 1.038 lulus (61 berkas), TypeScript dan lint lulus; setelah guard terakhir diubah, 4 tes terarah lulus ulang dan runner penuh lulus pada probe akhir. SQL pada live dev maupun production **tidak disentuh**.

## Gate lanjut

1. Uji validator terhadap clone production disposable dan tambah verifikasi negatif HTTP/JWT. Perubahan checksum `0047/0048` wajib direkonsiliasi pada clone lama yang sudah punya tracker; jangan edit riwayat live.
2. Siapkan backup shared-instance yang konsisten DB/Auth/Storage/config atau write-freeze yang disetujui operator, termasuk verifikasi restore byte Storage. Arsip Storage dev sekitar 11,3 GiB; jangan salin ke disk host tanpa kapasitas dan izin yang jelas.
3. Audit histori `0001–0037` pada clone bersumber live dan review operator. Jangan membuat tracker historis pada live dari baseline sintetis.
4. Sesudah semua gate lulus: migrasikan hanya environment develop di `20.20.20.173`, lalu jalankan JWT/RLS, Storage, E2E dan cleanup scoped ke Academy. Production tetap **NO-GO**.
