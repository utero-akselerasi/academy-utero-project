# Paket keputusan baseline develop — 13 Oktober 2026

**Status: NO-GO.** Klasifikasi diff clone ini bukan persetujuan reviewer, bukti restore lengkap, atau izin migrasi live. Audit ini tidak menulis ke `20.20.20.173` dan tidak menghubungi `20.20.20.3`.

## Sumber dan batas

- Perbandingan read-only `phase13_clean_replay53_20261013` dan `phase13_live_dev_candidate53_20261013` menghasilkan ulang **187** diff. Keduanya clone lokal disposable; tracker kandidat 59 versi sampai `0053` sintetis, bukan bukti sejarah live.
- Laporan privat `I:\DevData\TEMP\phase13-diff-clean53-candidate53-dev-20261013.json` SHA-256 `c69e01eaf366056246edf11dde4d42bcefc000c03efb2d4bd3e1ba839daa8546`. Snapshot detail read-only tersimpan privat di `I:\DevData\TEMP\phase13_clean_replay53_20261013-catalog.json` dan `I:\DevData\TEMP\phase13_live_dev_candidate53_20261013-catalog.json`. Jangan commit dump atau snapshot katalog shared.
- Matriks clone `0051` di `I:\DevData\TEMP\phase13-rls-matrix-0051-20261013-v3.json` SHA-256 `f2cfb153e6573e3cbf7b0dfcce12b58f5b95db18bbc18921d0aa6a44b5c7d4fc` bukan bukti live atau clone final `0053`.
- Audit read-only kandidat `0053` dengan `scripts/audit-phase13-rls-matrix.mjs` lulus 10 check: anon deny, intern/sekolah own allow dan cross-tenant deny, admin/super-admin read, `user_profiles`/`user_roles` own allow dan foreign deny, authenticated direct write `user_roles` tidak memiliki grant, dan grant `service_role` pada `user_roles`. Bukti privat `I:\DevData\TEMP\phase13-rls-matrix-candidate53-20261013-v2.json` SHA-256 file `07c66a4e7b2f54a843c7453d49e9dbdec690629a2832d0a247aa494d26ee6766`. Audit ini **tidak** mengeksekusi UPDATE/INSERT/DELETE atau JWT Supabase nyata; tidak membuktikan write-RLS/E2E.
- Inventaris **live develop** read-only melalui transaksi `BEGIN READ ONLY` pada 13 Oktober 2026: `postgres`, tracker tetap absen, 25 bucket, 31 policy `storage.objects`; bucket `academy-private` **belum ada**. Bukti privat `I:\DevData\TEMP\phase13-live-develop-storage-inventory-20261013.json`, SHA-256 `c79ac07e12a99f658243e691f2a64dd9bccbcf287809c4be5ac31b043a4aff4c`. Snapshot ini bukan tanda tangan pemilik aplikasi lain.
- Draft review privat berisi tepat 187 ID, semuanya `PENDING_REVIEW` tanpa alasan/approval: `I:\DevData\TEMP\phase13-independent-review-draft-20261013.json`, SHA-256 `82c59054eef9212578472f4fb2da5793cb31c84336d1fbbab263175853475110`. Sumber diff versi baru dengan `formattingOnly`/`ordinalOnly`: `I:\DevData\TEMP\phase13-diff-clean53-candidate53-dev-20261013-v2.json`, SHA-256 `8c6853051b7f58d03e874f66fe8b082139c0fd673dc46d23f6bb02daa227e9c1`. Draft **bukan** manifest adoption; keputusan reviewer dan bukti ownership harus diisi terpisah.

## Klasifikasi 187 diff

| Objek | Jumlah | Keputusan sementara |
| --- | ---: | --- |
| Kolom Academy | 7 | Enam hanya urutan `ordinal_position`/`dtd_identifier`; tipe, nullability, default sama setelah `0053`. `role_permissions.name` hanya di kandidat: kolom legacy nullable. Periksa pemakai/data sebelum menghapus; jangan rebuild tabel demi urutan. |
| Fungsi Academy | 7 | `can_attempt_quiz`, `current_user_has_role`, `set_announcement_published_at`, `set_updated_at`, `update_daily_activity`, `update_updated_at_column`, `update_user_streak`: seluruh definisi cocok persis setelah hanya mengubah line ending CRLF menjadi LF; owner sama. Kategori `formattingOnly` dibuktikan ulang dari katalog final. Reviewer tetap periksa privilege; jangan replace demi line ending. |
| Policy Academy | 4 | Policy `user_profiles` read admin/super-admin, dua `user_roles` read, dan `user_roles` admin `ALL` hanya di kandidat. `ALL` permissive bisa memperluas tulis. **Drift keamanan; keputusan penghapusan terarah menunggu uji allow/deny dan review.** |
| Effective grants Academy | 89 | 88 beda `service_role`; satu `anon` schema `USAGE` (clean true, kandidat false). Uji `has_*_privilege`, schema USAGE, RLS, pemilik/role membership, dan call-site. Jangan salin 88 grant clean massal atau membuka `anon` tanpa alasan signup. |
| Default grants Academy | 24 | ACL default `supabase_admin` untuk `postgres`/`service_role` hanya di clean; kandidat mencabut grant selimut. Jangan pulihkan massal: audit migrasi objek baru dan `0050` explicit-grant allowlist. |
| Storage policies shared | 32 | Satu `public_buckets_read` hanya di clean dan 31 policy hanya di kandidat karena bootstrap replay sengaja mengosongkan policy app lain. **Tidak boleh drop/copy berdasarkan diff.** Tentukan pemilik, `bucket_id`, `USING`, `WITH CHECK`. |
| Storage buckets shared | 24 | 16 bucket hanya di kandidat (workload lain), delapan beda konfigurasi: `article`, `avatars`, `daily-report`, `gallery`, `learning`, `mentor`, `school-logo`, `task`. Empat bucket `avatars`, `daily-report`, `learning`, `task` public di kandidat namun private di clean; MIME dan limit juga berbeda. Inventaris kepemilikan/objek sebelum mengubah visibilitas. |

Total Academy **131** (7 + 7 + 4 + 89 + 24), Storage shared **56** (32 + 24). Lingkup objek tidak sama dengan persetujuan perbedaan. Relations, constraints, types, triggers, indexes, dan owner platform: nol diff.

## Temuan Storage live

- `daily-report` memuat 1.218 metadata objek dan masih `public=true`; `learning` memuat satu objek dan `public=true`; `task` masih public walau kosong. Jangan memprivatkan bucket sebelum inventaris URL lama, bukti copy byte, dan pemilik seluruh objek menyetujui. `avatars` juga public dan dipakai policy SoundPub; bucket ini bukan milik Academy eksklusif.
- `Public Access` memberikan SELECT kepada `public` untuk 16 bucket, termasuk `daily-report`, `learning`, dan `task`. `Authenticated Upload`, `Authenticated Update`, `Authenticated Delete` hanya memeriksa `bucket_id` dalam enam bucket; ketiganya mencakup bucket Academy dan `avatars`. Empat policy khusus `daily-report`/`task` juga ada. Persilangan scope membuktikan **policy shared tidak boleh dijatuhkan massal**; empat policy khusus pun memerlukan keputusan pemilik.
- Inventaris teks policy membagi sementara 31 policy menjadi empat khusus bucket kandidat Academy, empat lintas scope, dan 23 yang menyebut bucket lain. Klasifikasi otomatis ini **bukan** bukti ownership: `avatars` adalah shared dan fungsi/ekspresi policy perlu review manual. `0047` menambah `academy-private` secara fail-closed setelah memeriksa policy; `0048` mengulang pengamanan tanpa mengubah policy shared. Keduanya belum dijalankan pada live.

## Gate reviewer dan operasi

1. Reviewer independen dari operator mencatat identitas, hash bukti, masa berlaku, keputusan eksplisit atas empat policy, tujuh fungsi, grant efektif/default, serta pemilik setiap bucket/policy terdampak. Jangan menyetujui angka total tanpa keputusan per objek.
2. Pada clone baru dari live, uji `anon`, peserta sendiri/lain, sekolah sendiri/lain, mentor, admin, super-admin, `service_role`: SELECT/INSERT/UPDATE/DELETE/RPC dan Storage. Catat allow **dan** deny, `has_schema_privilege`, `has_table_privilege`, `has_function_privilege`, RLS, JWT nyata, dan isolasi tenant. Ulang setelah koreksi/migrasi akhir.
3. Pemilik semua writer shared harus menyetujui jadwal write freeze develop, menghentikan DB write dan Storage upload, serta memverifikasi sumber tulis. Nol transaksi aktif sesaat bukan freeze. Ambil dump DB/Auth/roles/config dan byte Storage dalam freeze sama; hash dan cocokkan metadata dengan file.
4. Restore terisolasi **termasuk** roles/ACL, Auth, config, seluruh byte Storage; verifikasi signed URL, upload/read, JWT/RLS allow/deny, E2E, workload shared terkait, dan rollback. Restore lama `--no-owner --no-acl` dan manifest 4.345 file belum membuktikan replacement lengkap/atomik.
5. `scripts/adopt-phase13-baseline.mjs` kini menolak manifest tanpa operator berbeda dari reviewer, keputusan ID unik dan alasan per 187 objek, serta hash bukti matriks RLS, ownership Storage, dan restore drill. Struktur manifest saja **tidak** memverifikasi isi file atau tanda tangan reviewer; verifikasi independen tetap wajib. `--apply` tetap terkunci. Setelah gate benar-benar lulus, migrasikan **hanya** `20.20.20.173`, uji ulang JWT/RLS/Storage/E2E/cleanup. Production `20.20.20.3` baru preflight setelah staging hijau, freeze/backup/restore production, dan pilot.

**Belum terpenuhi:** reviewer independen, keputusan pemilik Storage, freeze terjadwal, backup konsisten, restore lengkap, dan matriks final staging. Production tetap NO-GO.
