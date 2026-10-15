# Baseline replay 0001–0037: checkpoint

Status: **REPLAY COMPLETE / BASELINE NOT PROVEN**. Tidak ada tracker baseline ditulis pada database lama, staging, ataupun production; keputusan koreksi tetap NO-GO sampai diff katalog ditinjau.

## Bukti bootstrap lokal

- Container `academy-phase13-pg17` memakai image `supabase/postgres:17.6.1.136`, port `127.0.0.1:55439`. `template1` hanya punya extension `plpgsql`, tidak punya `auth.users` atau `storage.buckets`.
- Image menyediakan `/docker-entrypoint-initdb.d/init-scripts/*.sql`, tetapi `00000000000000-initial-schema.sql` membuat role global `anon`, `authenticated`, dan `service_role`; `00000000000001-auth-schema.sql` membuat role `supabase_auth_admin`; `00000000000002-storage-schema.sql` hanya membuat schema `storage`, **bukan** tabel `storage.buckets`/`storage.objects`. Script ini adalah bootstrap cluster, tidak aman dijalankan ulang pada cluster yang punya DB lama.
- DB `phase13`, `phase13_current_prod`, dan `phase13_current_dev` sudah punya schema `utero_academy`; `phase13` memiliki 51 entri `schema_migrations`. Semuanya tidak memenuhi prasyarat platform bersih. Saat inspeksi awal belum ada DB bernama `phase13_replay_baseline_*`.
- Dengan otorisasi operator, dibuat **hanya** DB baru `phase13_replay_baseline_probe_20261012` dari `template1` pada container lokal. Query identitas `template1` memastikan `auth.users` dan `storage.buckets` tidak ada. Eksekusi nyata `node scripts/diff-phase13-baseline.mjs` dengan dua URL lokal (`phase13_replay_baseline_probe_20261012` dan `phase13_current_prod`) berhenti dengan `Diff baseline gagal: Identitas atau bootstrap platform tidak valid` (exit nonzero); tidak ada file migrasi yang dijalankan. DB probe sengaja dibiarkan untuk inspeksi, belum berisi data Academy.
- Changelog Supabase mencatat breaking change Postgres 17 dan perilaku Data API; versi platform/Storage bersih yang kompatibel harus dipastikan sebelum replay. Jangan menganggap schema buatan manual atau salinan DB lama sebagai bootstrap bersih.

## Replay pada stack Supabase CLI bersih

- Pada stack Supabase CLI bersih dengan PostgreSQL 17.6, `auth.users` dan `storage.buckets` tersedia, sedangkan objek Academy belum ada sebelum replay. Ini berbeda dari DB probe `template1` di atas; keberhasilan bootstrap platform pada stack CLI tidak membuktikan kesetaraan ownership dengan target.
- Replay ulang memakai role `supabase_admin` pada DB `postgres` di `127.0.0.1:54322` berhasil menjalankan tepat 43 file historis 0001–0037. Tracker, nama file, dan checksum wajib diverifikasi lagi oleh harness sebelum snapshot diterima.
- Kegagalan percobaan sebelumnya pada 0007 diklasifikasikan sebagai **platform owner role drift** pada role runner/ownership `storage.objects`, bukan bukti drift definisi Academy. Replay berhasil setelah memakai role administratif platform, tetapi hal ini tidak membuktikan owner role platform sama dengan clone production.
- `pg_dump` whole-stack ke clone tidak dipakai sebagai bukti karena gagal pada fungsi platform terkait `log_min_messages`. Audit beralih ke query katalog terkurasi baca-saja pada dua instance berbeda; kegagalan dump tidak boleh ditutup dengan perubahan fungsi/owner platform.

## Harness diff baca-saja

`scripts/diff-phase13-baseline.mjs` hanya menerima replay `postgresql://supabase_admin:...@127.0.0.1:54322/postgres` dan clone `postgresql://postgres:...@127.0.0.1:55439/phase13_current_prod`. Host, port, database, dan user harus cocok tepat; query string, host alias, serta target lain ditolak. Kedua koneksi memakai transaksi `READ ONLY` dan koneksi default read-only, timeout, pemeriksaan identitas DB, keberadaan `auth.users`/`storage.buckets`/schema Academy, serta tracker replay tepat 43 versi, nama file, dan SHA-256 file migrasi lokal. Kegagalan salah satu syarat menghentikan diff.

Jalankan dengan `PHASE13_REPLAY_DATABASE_URL` dan `PHASE13_CLONE_PROD_DATABASE_URL` menuju kedua DB lokal tersebut. Diff mencakup relations/RLS/views, columns, constraints, types, functions, triggers, policies, indexes, grants, default grants, Storage policies dan bucket, serta owner tabel platform utama `auth.users`, `storage.objects`, dan `storage.buckets`. Output memuat `missingInProduction`, `productionOnly`, `ownerRoleDrift`, dan `definitionDrift`. Exit code nonzero bila ada selisih atau prasyarat gagal. `baselineProven` selalu `false`: kesamaan katalog akhir tidak membuktikan urutan historis, parity data, atau perilaku policy.

## Hasil diff mentah 2026-10-12

- Artefak operator: `I:\DevData\TEMP\phase13-baseline-diff-20261012.json`. Diff baca-saja selesai dengan exit code 1, `differences: 2699`, dan `baselineProven: false` pada 13 kategori.
- Contoh selisih material mentah: relations 1 replay-only dan 16 production-only; functions 12 production-only dan 9 changed; policies 33 production-only dan 60 changed. Angka ini belum menjadi proposal koreksi dan perlu pemeriksaan definisi per objek.
- Grants menghasilkan 1.087 replay-only dan 486 production-only. Hasil tersebut tidak dapat dipakai sebagai bukti drift privilege karena ID memakai `a.grantee::text`, yaitu OID role yang bersifat lokal per cluster. Harness diperbaiki memakai `pg_get_userbyid(a.grantee)` pada grants dan default grants; kategori ACL wajib diambil ulang sebelum diklasifikasi.
- Kategori columns juga berpotensi memuat metadata lingkungan dari `information_schema.columns`; changed massal harus ditinjau terhadap field definisi sebelum dianggap drift schema. Owner role platform tetap konteks lingkungan, bukan target normalisasi otomatis.

## Klasifikasi tiga-arah offline 2026-10-13

Sumber katalog mentah: replay 0037 `I:\DevData\TEMP\phase13-catalog-37-20261013.json` SHA-256 `9455b940cdd83863c9aeb8a079efd0b78f7602399eb781503de0cb2fb7b85d94`; replay 0048 `I:\DevData\TEMP\phase13-catalog-48-20261013.json` SHA-256 `8213bbe76cec96c4d6b0e892306c26f392add9f67a690c25a9d6f8052f0cb940`; clone production `I:\DevData\TEMP\phase13-catalog-prod-20261013.json` SHA-256 `6b7e06d0a8f81c766dd790e474081ab710481fc4316708cb7cf7051b26ab99d2`. File mentah tidak mengandung tracker atau identitas DB, sehingga laporan menandai `trackerVerified: false` untuk kedua replay dan `identityVerified: false` untuk clone. Verifikasi tracker 54|max=0048 yang dilakukan operator adalah bukti eksternal, bukan sesuatu yang dapat dibuktikan ulang dari JSON katalog.

Jalankan ulang klasifikasi tanpa koneksi DB: `node scripts/diff-phase13-baseline.mjs --three-way <0037.json> <0048.json> <prod.json>`. Untuk setiap ID katalog: `expectedBy0038to0048` bila definisi berubah dari 0037 ke 0048 dan clone cocok persis dengan 0048; `productionDrift` bila dua replay sama tetapi clone berbeda; `unresolved` untuk konflik pola lain. Owner platform, beda owner relation/function, dan default grants selalu unresolved; columns diklasifikasi setelah field catalog lingkungan dibuang. Grants mentah tetap unresolved sampai query hak efektif menghasilkan tiga snapshot baru. Klasifikasi **bukan atribusi kausal** ke SQL tertentu dan `baselineProven: false` selalu.

Artefak klasifikasi naive operator `I:\DevData\TEMP\phase13-three-way-classification-20261013.json` melaporkan 626 explained, 2.322 drift, dan 2.099 unchanged. Angka itu tidak berlaku sebagai klasifikasi final: columns membawa nama database pada `udt_catalog`/`domain_catalog`/`scope_catalog` dan field catalog lain; functions membawa ACL mentah `DEFAULT` versus eksplisit; grants membawa ekspansi ACL/default/owner yang tidak setara dengan hak efektif lintas cluster.

Harness kini menormalkan seluruh field `*_catalog` lingkungan pada columns dan mengabaikan ACL mentah pada definisi functions karena effective grants dicatat terpisah. Query snapshot grants baru memakai `has_schema_privilege`, `has_table_privilege`, `has_sequence_privilege`, dan `has_function_privilege` untuk role aplikasi `anon`, `authenticated`, dan `service_role`; grant owner/admin tidak dibandingkan sebagai ACL eksplisit. Default grants tetap unresolved karena creator role dan provenance platform berbeda. Snapshot mentah lama tidak memiliki marker effective-grant, sehingga seluruh delta grants lama sengaja diklasifikasikan unresolved, bukan production drift.

Rerun offline atas tiga katalog mentah setelah normalisasi menghasilkan `baselineDifferences: 1172`; total `expectedBy0038to0048: 339`, `productionDrift: 155`, `unresolved: 803`. Fokus kategori dalam urutan expected/drift/unresolved: columns 198/24/0; functions 0/9/12; triggers 15/0/0; policies 14/64/16; grants 0/0/712; default grants 0/0/24; storage policies 0/8/0; storage buckets 1/16/1; platform owners 0/0/3. Counts grants belum dapat dipersempit sampai ketiga snapshot diambil ulang dengan query effective privilege. Counts adalah triage, bukan daftar migrasi koreksi; path objek tersedia di array kategori laporan penuh.

## Probe clone production setelah 0048

Operator membuat **hanya clone lokal** `phase13_prod_0048_probe_20261013` dari `phase13_current_prod`, lalu menerapkan 0038–0048 sebanyak 11/11 dan menyimpan katalog `I:\DevData\TEMP\phase13-catalog-prod48-probe-20261013.json` SHA-256 `3247e4eab09672195dffe3191cb5465bd4a7ef32decd6e2ccdba105ad2ff8d3d`. Probe ini membandingkan clean replay 0048 dengan clone production yang mendapat migrasi masa depan sama, sehingga selisih tersisa lebih kuat sebagai kandidat legacy drift daripada perbandingan 0037-vs-production. File katalog tetap tidak membuktikan tracker/identitas DB secara mandiri; provenance 11/11 adalah bukti operator eksternal.

Raw operator melaporkan 3.810 differences: 21 functions changed, 4 extra Academy policies, 8 extra Storage policies, 16 extra Storage buckets, 3 owner differences, 9 columns changed, serta grants 3.403 clean-only/306 probe-only; triggers dan types nol. Setelah normalisasi field catalog dan ACL fungsi, harness melaporkan `legacyDrift: 60`, `unresolved: 1053`: columns 18/0, functions 9/0, triggers 0/0, types 0/0, policies 4/0, grants 0/1024, default grants 0/24, Storage policies 8/0, Storage buckets 16/0, platform owners 0/3, dalam urutan legacy/unresolved. Perbedaan count columns mencakup perubahan, penambahan, dan penghapusan ID; raw angka 9 hanya changed. Functions turun dari 21 raw menjadi 9 setelah ACL mentah dikeluarkan. Grants dan owner belum boleh disebut legacy drift sebelum snapshot effective-privilege tersedia.

Mode laporan menerima probe opsional: `node scripts/diff-phase13-baseline.mjs --three-way <0037.json> <clean48.json> <prod.json> <prod48probe.json>`. Output `post0048Probe.categories` memuat path `legacyDrift` dan `unresolved`. Probe tidak mengusulkan migrasi koreksi dan tidak memberi izin perubahan live.

### Review 9 function drift clean48 vs prod48 probe

Review offline memakai `phase13-catalog-48-20261013.json` SHA-256 `8213bbe76cec96c4d6b0e892306c26f392add9f67a690c25a9d6f8052f0cb940` dan `phase13-catalog-prod48-probe-20261013.json` SHA-256 `3247e4eab09672195dffe3191cb5465bd4a7ef32decd6e2ccdba105ad2ff8d3d`. Tidak ada koneksi atau perubahan production. Kesembilan fungsi memiliki owner `supabase_admin`, mode security, signature/attributes, dan `search_path = 'utero_academy', 'public', 'pg_temp'` yang sama; tidak ada owner-only atau search_path-only drift.

**Drift semantik nyata — 2 fungsi:**

- `utero_academy.award_points(uuid, integer, varchar, uuid, text)`: prod48 probe masih memakai body legacy `0022_badges_and_achievements_system.sql`, termasuk `RETURNING total_points INTO v_new_total` dan variabel `v_new_level`. Clean48 memakai koreksi `0036_fix_check_and_award_badges.sql`: membaca kembali `user_points.total_points` setelah upsert dan menghitung level langsung. Hasil normal biasanya setara saat cabang `DO UPDATE` tetap ada, tetapi kontrak kegagalan dan ketahanan terhadap perubahan upsert berbeda; ini body/semantic drift nyata.
- `utero_academy.check_and_award_badges(uuid, varchar)`: prod48 probe masih memakai body legacy `0022`, termasuk referensi `user_id` pada tabel yang berkunci `intern_id`, tidak menangani `assignment_excellence`/`login_streak`, dan selalu memberi poin setelah `ON CONFLICT DO NOTHING`. Clean48 memakai koreksi `0036`: memetakan `intern_id`, menambah cabang badge yang hilang, dan memberi poin hanya saat insert badge benar-benar terjadi. Ini drift nyata dengan dampak correctness dan potensi double-award saat concurrency.

**Formatting-only — 7 fungsi:**

- `utero_academy.can_attempt_quiz(uuid, uuid)`
- `utero_academy.current_user_has_role(text)`
- `utero_academy.set_announcement_published_at()`
- `utero_academy.set_updated_at()`
- `utero_academy.update_daily_activity(uuid, varchar, integer, integer)`
- `utero_academy.update_updated_at_column()`
- `utero_academy.update_user_streak(uuid)`

Untuk tujuh objek tersebut, definisi menjadi byte-identik setelah normalisasi CRLF ke LF. Tidak ada perubahan body SQL, owner, security mode, signature, attributes, atau search_path. Jangan membuat migrasi koreksi untuk ketujuhnya; perbedaan berasal dari line ending hasil capture/deparse.

Kesimpulan: count functions `legacyDrift: 9` perlu dipersempit menjadi **2 semantic drift nyata + 7 formatting-only**. Dua drift nyata berasal dari objek yang didefinisikan awal di `supabase/migrations/0022_badges_and_achievements_system.sql` dan dikoreksi oleh `supabase/migrations/0036_fix_check_and_award_badges.sql`; prod48 probe menunjukkan koreksi 0036 tidak hadir pada lineage production clone. Status tetap **NO-GO** untuk baseline/adopsi tracker: jangan menandai 0036 applied atau menimpa fungsi live tanpa verifikasi runner, dependency/caller, data behavior, dan uji clone terpisah.

## Keputusan koreksi

### Effective grants clean48 vs prod48 probe (2026-10-13)

Capture read-only pada `127.0.0.1:54322/postgres` (`supabase_admin`, tracker 54/54 dan checksum lokal cocok) serta `127.0.0.1:55439/phase13_prod_0048_probe_20261013` (`supabase_admin`, tracker suffix 0038–0048 11/11 dan checksum lokal cocok) menghasilkan `I:\DevData\TEMP\phase13-effective-grants-clean48-20261013.json` (300 objek-role) dan `I:\DevData\TEMP\phase13-effective-grants-prod48-probe-20261013.json` (306 objek-role). Laporan object-level `I:\DevData\TEMP\phase13-effective-grants-classification-20261013.json` dibuat dengan `node scripts/diff-phase13-baseline.mjs --compare-effective-grants <clean48.json> <prod48probe.json>`. Input offline divalidasi terhadap nama DB, tracker hash sesuai file migrasi lokal, marker effective, dan ID unik; JSON tidak mengandung bukti kriptografis koneksi DB, sehingga provenance tetap bergantung pada capture operator. `baselineProven: false`.

Per objek-role, `serviceRoleMissing: 91` (78 relasi, 12 fungsi, schema USAGE), `applicationMissing: 9` (7 relasi authenticated, 2 schema USAGE), `probeExcess: 0`, `restricted: 175`, `aligned: 49`, `structural: 6`. Daftar ID dan setiap privilege tersedia dalam kategori laporan JSON; satu ID dapat muncul di kategori aligned dan restricted karena hak berbeda. Enam structural hanya `storage_path_backfill_snapshot` dan sequence terkait untuk ketiga role, ada di probe saja; semua hak terukur false. Tidak ada grant tambahan pada probe untuk role yang diuji.

`restricted` menandai hak false pada kedua sisi, selaras prinsip deny-by-default `0031_revoke_blanket_grants.sql` yang mencabut grant selimut `0007` bagi anon/authenticated dan mengembalikan allowlist. Ini **bukan** 175 bukti bahwa 0031 sendiri penyebabnya: termasuk hak yang tak pernah diberikan, serta revoke/kolom spesifik migrasi berikutnya (0038, 0039, 0040, 0041). Grant SELECT tabel penuh bernilai false tidak membuktikan ketiadaan column-level SELECT/UPDATE. Fungsi yang tetap executable bagi anon/authenticated pada kedua sisi (termasuk RPC LMS) perlu review tersendiri terhadap default `PUBLIC` dan schema USAGE; kesamaan hak bukan persetujuan keamanan.

`applicationMissing` pada probe: `attendances` (SELECT/INSERT/UPDATE), `intern_profiles` (SELECT), `mentor_assignments` (SELECT/INSERT/DELETE), `mentor_profiles` (SELECT/UPDATE), `roles`, `user_profiles`, `user_roles` (SELECT), dan schema `utero_academy` USAGE untuk anon/authenticated. Ketujuh relasi ini masuk allowlist 0031; absennya bukan intentional revoke 0031, melainkan kandidat drift/ketidakcocokan owner/grant yang memerlukan pemeriksaan akses per role. Schema USAGE anon/authenticated juga ditegaskan ulang oleh 0031; hilangnya dapat membuat grant relasi lain tak efektif melalui PostgREST.

`serviceRoleMissing` meliputi 78 relasi termasuk `certificates`, `daily_reports`, `selection_attempts`, `user_profiles`, `schema_migrations`, serta 12 fungsi termasuk `accept_application_as_intern`, `approve_application_onboarding`, `decide_selection_atomically`, `provision_applicant_user`, `visible_selection_results`, dan `current_user_school_ids`; semua 78 relasi kehilangan tujuh hak tabel terukur, 12 fungsi kehilangan EXECUTE, dan schema kehilangan USAGE. 0031 secara eksplisit **menegaskan ulang** hak `service_role` pada schema/seluruh tabel/sequence/fungsi, jadi ini bukan revoke yang disengaja. Risiko putusnya jalur service-role tinggi, tetapi `has_*_privilege` tidak menguji aplikasi end-to-end, privilege kolom, kepemilikan, role inheritance, atau perilaku BYPASSRLS. Jangan auto-GRANT: periksa pemilik/default ACL platform, ketergantungan aplikasi, dan provenance clone lebih dulu; jangan jalankan SQL koreksi pada live/staging.

#### Kandidat 0050: rekonsiliasi eksplisit, bukan replay GRANT 0031

`supabase migration new reconcile_phase13_explicit_grants` dipakai membuat berkas, lalu namanya disesuaikan dengan runner bernomor menjadi `supabase/migrations/0050_reconcile_phase13_explicit_grants.sql`. Guard nama database dan tracker 0038–0048 **tidak ada dalam SQL migrasi**, agar runner dapat menerapkannya pada target yang kelak disetujui. Pembatasan target hanya dipakai saat uji pada clone; migrasi tetap fail-closed bila schema/role platform tidak cocok, runner bukan owner/member owner, salah satu dari 62 relasi/view atau lima fungsi berubah kind/owner/signature, atau RLS tabel hilang. Postcondition mengecek tiap privilege yang diminta dengan `has_table_privilege`, `has_function_privilege`, dan `has_schema_privilege`. Semua grant terdaftar eksplisit; tidak ada `ALL`, default privileges, `PUBLIC`, `anon`, sequence, atau objek `auth`/`storage`. Tidak ada auto-GRANT di lingkungan live.

Dasar allowlist: perbandingan object-level mencatat 91 objek-role `service_role` kehilangan hak pada probe, tetapi itu **bukan** daftar 91 objek yang boleh diberi seluruh privilege. Inventaris statis pemanggil `createUteroAcademyServiceRoleClient()` di `app/` dan `features/` memetakan `.from(...).select/insert/update/delete/upsert` menjadi 62 nama objek dan 152 pasangan object-privilege; `upsert` ditafsirkan membutuhkan INSERT dan UPDATE, SELECT hanya bila call-site menggunakannya. View `user_quiz_attempts_summary` hanya menerima SELECT. Lima `.rpc` yang teridentifikasi ialah `bypass_selection`, `can_attempt_quiz`, `decide_selection_atomically`, `update_daily_activity`, `update_user_streak`; dua dari lima RPC itu termasuk delta privilege hilang, sedangkan tiga sudah efektif melalui privilege lain, tetapi SQL mencantumkan kelimanya agar ketergantungan tidak bergantung pada default `PUBLIC`. Tidak ada hak TRUNCATE, REFERENCES, TRIGGER, grant untuk `schema_migrations`, objek snapshot storage, atau fungsi internal yang tidak dipanggil sebagai RPC. Scope koreksi adalah **62 dari 78 relasi** plus **5 RPC**, bukan 91 grant menyeluruh. Inventaris statis belum membuktikan seluruh alias/dynamic call atau kebutuhan fungsi internal via trigger; sisa 16 relasi dan 10 fungsi yang hilang tetap unresolved, bukan dianggap aman atau otomatis dikoreksi.

Untuk authenticated, 0050 hanya mengembalikan 12 privilege pada tujuh tabel yang hilang dari allowlist 0031 dan schema USAGE; untuk `anon`, schema USAGE yang hilang **tidak** dikembalikan karena membuka resolusi RPC yang telah memiliki EXECUTE melalui `PUBLIC` dan memerlukan review keamanan tersendiri. Untuk service_role, schema USAGE plus operasi nyata di 62 objek dan lima RPC. Data API mensyaratkan GRANT di samping RLS; `BYPASSRLS` service_role tidak mengatasi hak objek yang tidak diberikan. Perlu verifikasi per-role Data API dan review policy/function sebelum membuka akses lebih luas. Lihat dokumentasi resmi Supabase `guides/api/securing-your-api` dan `guides/api/api-keys` (Oct 2026).

Uji hanya pada clone disposable `phase13_grants_0050_disposable_20261013`, dibuat sebagai `supabase_admin` dari `phase13_prod_0048_probe_20261013` pada instance lokal port 55439. 0050 dieksekusi dua kali dengan `psql -1 -v ON_ERROR_STOP=1`, keduanya lulus; `SET LOCAL ROLE service_role` berhasil membaca `user_roles` dengan LIMIT 0 dan hak schema/certificates/selection RPC benar; `authenticated` berhasil membaca `roles`, berhak INSERT `attendances`, tetapi tidak DELETE; anon ditolak `permission denied for schema utero_academy`. Dalam transaksi sementara, disable RLS pada `user_roles` dan ubah owner `roles` ke `postgres` masing-masing menghasilkan error preflight `0050 objek/owner/RLS tidak cocok`; session berakhir dengan rollback: owner `supabase_admin`, RLS aktif, tracker tetap 11|max 0048. Versi awal berkunci nama clone sempat diuji lalu diganti: **versi deployable terakhir** diuji dua kali pada clone disposable, bukan staging/production. Tidak ada tracker 0050 yang ditulis dalam uji manual.

Kandidat 0050 **belum GO**: grant yang disengaja tetap berisiko tanpa review akses Data API/PUBLIC, pemetaan alias dinamis dan kebutuhan internal, asal owner platform, serta test pada clone target yang disetujui. Jangan jalankan runner ke staging/production dari bukti ini saja.

### Report resmi offline, regenerasi 2026-10-13

Command (tanpa DB, tanpa koneksi staging/production):

```powershell
node scripts/diff-phase13-baseline.mjs --three-way 'I:\DevData\TEMP\phase13-catalog-37-20261013.json' 'I:\DevData\TEMP\phase13-catalog-48-20261013.json' 'I:\DevData\TEMP\phase13-catalog-prod-20261013.json' 'I:\DevData\TEMP\phase13-catalog-prod48-probe-20261013.json' | Set-Content -LiteralPath 'I:\DevData\TEMP\phase13-three-way-official-20261013.json' -Encoding utf8
```

Artefak JSON: `I:\DevData\TEMP\phase13-three-way-official-20261013.json`, SHA-256 `d9aa480121351887f08699f81f88a21abadba5796cb86a185a1c13fa0202db9e`. Parsing JSON berhasil; SHA-256 keempat raw catalog cocok dengan `sources` report. Jumlah array pada 13 kategori cocok dengan seluruh totals. `baselineProven: false`, `correctionMigrationProposed: false`; source flags tracker/identity tetap false karena raw JSON tidak menyimpan bukti tersebut.

| Kategori | Expected 0038–0048 | Production drift | Unresolved | Probe legacy | Probe unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
| Relations | 0 | 0 | 17 | 1 | 2 |
| Columns | 198 | 24 | 0 | 18 | 0 |
| Constraints | 64 | 31 | 18 | 2 | 0 |
| Types | 10 | 0 | 0 | 0 | 0 |
| Functions | 0 | 9 | 12 | 9 | 0 |
| Triggers | 15 | 0 | 0 | 0 | 0 |
| Policies | 14 | 64 | 16 | 4 | 0 |
| Indexes | 37 | 3 | 0 | 2 | 0 |
| Grants | 0 | 0 | 712 | 0 | 1.024 |
| Default grants | 0 | 0 | 24 | 0 | 24 |
| Storage policies | 0 | 8 | 0 | 8 | 0 |
| Storage buckets | 1 | 16 | 1 | 16 | 0 |
| Platform owners | 0 | 0 | 3 | 0 | 3 |
| **Total** | **339** | **155** | **803** | **60** | **1.053** |

`baselineDifferences: 1172` membandingkan replay 0037 vs clone production; total tiga kolom klasifikasi (1.297) tidak sama karena mencakup delta replay 0048. Raw grants belum memakai marker effective-grant, sehingga 712 dan 1.024 tetap unresolved. Tidak ada alasan untuk menafsirkan klasifikasi sebagai izin migrasi. Clean Supabase stack pada port 54321/54322 tidak diperlukan untuk regenerasi offline ini.

Satu kandidat koreksi telah terbukti pada clone lokal setelah 0038–0048: `utero_academy.certificates` kosong tetapi tidak memiliki `final_score`, `notes`, CHECK `certificates_assessment_or_course`, dan unique index parsial `idx_certificates_intern_course_unique`; `assessment_id` masih NOT NULL. Ini cocok dengan drift semantics 0035 dan kontrak `features/lms/certificate-helper.ts`, sehingga dibuat `0049_reassert_certificate_schema.sql` hanya untuk objek tersebut. Migrasi menolak certificate_type null, kombinasi assessment/course buruk, duplikat intern/course, tipe kolom bentrok, dan index bernama sama dengan definisi salah; tidak menghapus atau memperbaiki data diam-diam. `assessment_id` dibuat nullable agar sertifikat course tanpa assessment dapat ditulis, sedangkan CHECK mewajibkan tepat satu referensi sesuai tipe.

Uji perilaku terbatas pada DB probe lokal `phase13_prod_0048_probe_20261013` di container `academy-phase13-pg17`: sebelum uji `certificates` berisi 0 baris. `postgres` gagal mengubah tabel karena owner adalah `supabase_admin`; dua eksekusi SQL 0049 berikutnya dengan `supabase_admin` berhasil (`ON_ERROR_STOP=1`). Verifikasi akhir: `assessment_id uuid` nullable, `final_score numeric(5,2)` dan `notes text` tersedia, CHECK dan index bernama sesuai terpasang, jumlah baris tetap 0.

Uji negatif pada clone disposable juga membuktikan preflight gagal tertutup tanpa membersihkan data diam-diam. Fixture invalid berisi satu baris `course_completion` tanpa `course_id` setelah CHECK dilepas; 0049 menolak dengan SQLSTATE `P0001` dan pesan tepat `Data certificates melanggar certificates_assessment_or_course`. Fixture duplikat berisi dua baris dengan pasangan `intern_id`/`course_id` sama setelah unique index dilepas; 0049 menolak dengan SQLSTATE `P0001` dan pesan tepat `Data certificates memiliki duplikat intern_id/course_id`. Kedua skenario dijalankan dalam `BEGIN`, error migrasi diikuti `ROLLBACK`; hasil akhir `rowsAfter=0`, serta CHECK dan index asli tetap ada. Seluruh uji hanya memakai clone lokal disposable; production dan staging tidak disentuh.

Eksekusi manual ini mengubah **hanya skema probe**, tidak menulis entri tracker migrasi, dan tidak membuktikan keberhasilan pada DB lain. Gunakan runner dan verifikasi terpisah sebelum penerapan lebih luas.

Drift lain tetap tanpa usulan migrasi. Probe sesudah 0048 masih memiliki path yang perlu review SQL/perilaku dan banyak unresolved, terutama grants/default grants/owner. `ownerRoleDrift` tidak otomatis boleh dikoreksi; `productionOnly` tidak otomatis dihapus; `missingInProduction` tidak otomatis dibuat; `definitionDrift` tidak otomatis ditimpa. Tidak ada perubahan live dari audit ini.

## Blocker

**NO-GO untuk baseline dan koreksi drift lain:** replay, probe lokal, klasifikasi effective grants, dan review sembilan function drift sudah tersedia. Kandidat 0050 mengembalikan grant eksplisit yang dibutuhkan dan lulus dua kali pada clone disposable, tetapi audit akses Data API/PUBLIC, asal owner platform, dua function semantic drift nyata, serta 1.053 perbedaan probe belum seluruhnya dibuktikan aman. Migrasi 0049 adalah kandidat terbatas untuk certificates yang telah lulus uji idempotensi, verifikasi skema, serta uji negatif bad-data dan duplikat pada clone lokal; penerapan 0049/0050 pada target lain tetap memerlukan runner dan verifikasi terpisah. DB lama, staging, dan production tidak boleh diubah dalam audit ini.
