# Audit 0051: Academy PUBLIC EXECUTE (clone lokal)

Status: **clone-only PASS; staging/production NO-GO** sampai review dan uji cutover terpisah. Tidak ada akses atau perubahan ke DB staging/production. Supabase CLI `migration new harden_academy_public_execute` dipakai membuat berkas, lalu disesuaikan ke format runner `supabase/migrations/0051_harden_academy_public_execute.sql`. Eksekusi manual tidak menulis entri migration tracker.

## Sumber dan risiko

Pada clone lokal sesudah 0050, `pg_proc`/`aclexplode` menunjukkan tepat sembilan fungsi `utero_academy` dengan `PUBLIC EXECUTE`; tiga memiliki ACL eksplisit `=X/supabase_admin`, enam mewarisi default `proacl IS NULL`. `authenticated` memiliki schema USAGE dari 0050 sehingga dapat memanggil fungsi yang memiliki PUBLIC EXECUTE; `anon` tidak memiliki schema USAGE pada clone ini, tetapi fungsi tetap tidak patut bergantung pada pembatasan schema sebagai satu-satunya lapisan keamanan. Hak `service_role`/`BYPASSRLS` tidak menggantikan GRANT objek. Pemeriksaan sesuai dokumentasi resmi Supabase tentang [explicit grants dan RLS](https://supabase.com/docs/guides/api/securing-your-api) serta [API keys/role](https://supabase.com/docs/guides/api/api-keys).

| Function | Dependency terverifikasi | Hak setelah 0051 |
| --- | --- | --- |
| `award_points(uuid,integer,varchar,uuid,text)` | Hanya dipanggil body `check_and_award_badges`; tidak ada RPC aplikasi/trigger | owner saja; tanpa PUBLIC/app-role |
| `can_attempt_quiz(uuid,uuid)` | `features/lms/actions.ts` dua RPC service-role | service_role EXECUTE |
| `check_and_award_badges(uuid,varchar)` | Tidak ada RPC aplikasi/trigger; SQL 0036 memanggil `award_points` | owner saja; tanpa PUBLIC/app-role |
| `current_user_has_role(text)` | SECURITY DEFINER; 122 policy pada clone, semuanya `TO authenticated` | authenticated EXECUTE |
| `set_announcement_published_at()` | Satu trigger | owner saja; tanpa PUBLIC/app-role |
| `set_updated_at()` | 45 trigger | owner saja; tanpa PUBLIC/app-role |
| `update_daily_activity(uuid,varchar,integer,integer)` | `features/lms/actions.ts` RPC service; INSERT/UPDATE pada `daily_activity` | service_role EXECUTE + INSERT/UPDATE tabel |
| `update_updated_at_column()` | Tujuh trigger | owner saja; tanpa PUBLIC/app-role |
| `update_user_streak(uuid)` | `features/lms/actions.ts` RPC service; INSERT/UPDATE pada `user_streaks` | service_role EXECUTE + INSERT/UPDATE tabel |

Migrasi hanya mencabut EXECUTE untuk sembilan signature dari PUBLIC/anon/authenticated/service_role, lalu memberi ulang helper policy dan tiga RPC pada role yang benar. Dua helper gamifikasi tidak diberi service-role karena saat ini tidak ada call-site aktif; bila kelak dipakai, audit izin tabel internal/definisi body dahulu. Tidak ada perubahan owner, definisi body, RLS/policy, trigger, atau default privileges. Guard sebelum REVOKE memeriksa owner schema/fungsi, signature, security mode, search_path, policy authenticated, trigger, serta owner/RLS dua tabel dependency. Asersi setelah GRANT memeriksa matriks privilege role dan ketiadaan PUBLIC EXECUTE. Migrasi ini belum membuktikan keamanan seluruh fungsi Academy di lingkungan lain.

## Uji disposable

Clone baru `phase13_public_exec_0051_disposable_20261013` berasal dari clone sesudah 0050 `phase13_grants_0050_disposable_20261013` pada container lokal `academy-phase13-pg17`; dijalankan sebagai `supabase_admin` dengan `psql -1 -v ON_ERROR_STOP=1`. SQL 0051 sukses dua kali (idempotent). `has_function_privilege` menunjukkan sembilan fungsi ditolak untuk anon, delapan ditolak untuk authenticated kecuali `current_user_has_role`, dan tiga RPC diperbolehkan untuk service_role. Jumlah fungsi dengan PUBLIC EXECUTE setelah migrasi: **0**.

Uji negatif `SET LOCAL ROLE authenticated; SELECT ...can_attempt_quiz(...)` memberi `permission denied for function can_attempt_quiz`; anon ditolak pada schema/function. `service_role` ditolak memanggil `award_points`. Uji positif: `current_user_has_role('admin')` sebagai authenticated tanpa sesi menghasilkan `false` tanpa error; `can_attempt_quiz(NULL,NULL)` sebagai service_role berhasil membaca; pada transaksi rollback service_role menjalankan `update_daily_activity`, `update_user_streak`, UPDATE `user_streaks` (trigger `update_updated_at_column`), dan UPDATE `user_profiles` (trigger `set_updated_at`). Semuanya sukses; fixture tersebut di-rollback. Trigger `set_announcement_published_at` hanya diverifikasi melalui metadata/dependency, belum lewat perubahan baris karena tidak disiapkan fixture announcement. Sebelum koreksi fixture, uji UPDATE satu kali gagal karena nama variabel PL/pgSQL ambigu; bukan kegagalan migrasi/privilege. Setelah perbaikan fixture, uji sukses. Tracker tetap **11|max=0048**, `user_streaks` kembali **0 baris**.

**Verdict:** candidate hardening 0051 terverifikasi secara semantik pada satu clone disposable dengan aplikasi belum diuji end-to-end. Jangan jalankan pada staging/production hanya berdasar uji ini. Audit fungsi lain/default EXECUTE/role membership dan seluruh jalur Data API sebelum keputusan GO.

## Keputusan dua semantic drift — kandidat 0052

`0052_reassert_gamification_function_semantics.sql` mengulang body canonical dari `0036` untuk `award_points` dan `check_and_award_badges`. Migrasi hanya boleh berjalan sesudah 0051: guard menolak bila PUBLIC/anon/authenticated/service_role masih dapat EXECUTE. Setelah replace, ACL dicabut ulang dan marker body diverifikasi. Tidak ada caller aplikasi atau trigger, dan tabel `user_points`, `user_badges`, serta `point_transactions` kosong pada clone saat keputusan dibuat.

Uji clone `phase13_public_exec_0051_disposable_20261013`: SQL 0052 sukses tiga kali; fixture rollback memanggil `award_points(...,150,...)` dan menghasilkan `level=2`, `level_progress=50`; `check_and_award_badges(...,'course')` tidak lagi gagal karena kolom `course_enrollments.user_id` yang tidak ada. Setelah rollback, nol transaksi fixture tersisa dan PUBLIC EXECUTE kedua fungsi tetap nol. Status **clone-only PASS / staging-production NO-GO** sampai 0049–0052 berjalan melalui runner pada target reviewed dan Data API/staging smoke lulus.
