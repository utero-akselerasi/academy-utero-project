# Audit keamanan grant 0050 — 13 Oktober 2026

Status **PARTIAL / NO-GO**. Audit ini memakai clone lokal `phase13_candidate_0050_20261013`, inventaris call-site statis, dan query katalog read-only. Tidak ada perubahan Auth/DB/Storage live.

## Temuan terukur

- Scope query service-role pada `app/`/`features/`: 45 file, 368 operasi statis; inventaris menghasilkan 151 pasangan object-privilege, dengan 150 valid/efektif pada clone dan satu referensi `tasks` tanpa tabel. Perbaikan dashboard admin berada di `features/admin/dashboard-queries.ts`.
- Dari 78 tabel `utero_academy`, 77 memakai RLS; pengecualian `schema_migrations` tidak memiliki grant bagi role aplikasi namun harus direview sebagai defense-in-depth. View `user_quiz_attempts_summary` memiliki `security_invoker=true`.
- `authenticated` memiliki schema USAGE setelah `0050`, sedangkan `anon` dan `PUBLIC` tidak. Tujuh tabel allowlist `authenticated` mempunyai policy yang perlu diuji dengan JWT pengguna sebenarnya; katalog saja tidak membuktikan isolasi tenant.
- Sembilan fungsi schema Academy masih mempunyai `PUBLIC EXECUTE` pada clone. Termasuk `can_attempt_quiz`, `update_daily_activity`, `update_user_streak`, `award_points`, `check_and_award_badges`, dan `current_user_has_role` (SECURITY DEFINER). Untuk tiga RPC update/quiz, `anon` mempunyai hak EXECUTE efektif tetapi tidak memiliki schema USAGE, sehingga tidak dapat diasumsikan dapat diakses melalui Data API. Sebaliknya, `authenticated` memiliki USAGE: review body, otorisasi, dan exposed schema wajib sebelum GO.
- Perbandingan 0050 dengan probe 0048 menambah grant terbatas, bukan GRANT ALL atau default privileges. SQL `0050` tidak otomatis mencabut `PUBLIC EXECUTE`; kebijakan revocation memerlukan review call-site/policy terpisah.

## Gate berikut

1. Uji Data API sebagai anon, authenticated lintas sekolah, dan service_role pada clone yang benar-benar menjalankan gateway/API; rekam HTTP, JWT scope, operasi negative-case, dan cleanup.
2. Audit sembilan fungsi `PUBLIC EXECUTE`, terutama `current_user_has_role` SECURITY DEFINER dan dua fungsi badge/points yang drift semantik. Revoke hanya setelah dependensi RLS/internal terbukti aman.
3. Pastikan dashboard admin memakai `task_cards`, periksa semantik list `Done`, dan jalankan smoke UI terikat clone/staging.
4. Audit 16 relasi dan fungsi hilang yang tidak direkonsiliasi `0050`, empat Academy policies ekstra, delapan Storage policies SoundPub, dan 16 bucket ekstra sebelum izin promosi.

**Tidak ada izin menerapkan `0050` pada production atau staging dari bukti ini.**
