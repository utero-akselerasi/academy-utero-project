# Kandidat clone 0049–0050 — 13 Oktober 2026

Status **PARTIAL / NO-GO**. Semua operasi DB di bawah dilakukan pada container PostgreSQL lokal `academy-phase13-pg17`, bukan production, staging, atau source `phase13_current_prod`.

## Provenance dan batas

Clone disposable `phase13_candidate_0050_20261013` dibuat dari `phase13_prod_0048_probe_20261013`, yang sebelumnya berasal dari `phase13_current_prod` dan menerima `0038–0048` (11/11). Ini **bukan** snapshot production terbaru yang disahkan reviewer. Sebelum `0049`, tracker clone berisi 11 entri, maksimum `0048`. `0049` dan `0050` dieksekusi manual via `docker exec -i ... psql -1 -v ON_ERROR_STOP=1`, masing-masing dua kali tanpa error. Setelahnya tracker masih 11 entri/maksimum `0048`: tidak ada klaim runner historis sukses untuk `0049–0050` dan tidak ada baseline palsu.

## Diff dan data

Katalog read-only tersimpan di `I:\DevData\TEMP\phase13-catalog-candidate0050-20261013.json`; perbandingan dengan probe 0048 di `I:\DevData\TEMP\phase13-diff-probe48-candidate0050-20261013.json`. Total 79 objek/ID berbeda: certificates mengubah `assessment_id` dan `certificate_type`, menambah `final_score`, `notes`, satu CHECK, satu index; 73 perubahan ID grants. Tidak ada beda hubungan lain, function, trigger, type, policy, Storage policy, ataupun bucket antara probe dan kandidat. Dibanding clean replay 0048 masih ada 1.107 perbedaan katalog (termasuk drift platform/owner, grant dan bucket); hasil ini **bukan** parity production.

Hitungan source probe dan kandidat sama: Auth users **209**, intern profiles **44**, attendances **1.032**, daily reports **906**, attachments **1.190**, certificates **0**, Storage objects **2.295**, buckets **27**. Kesamaan count tidak membuktikan kesamaan byte per object, row, ACL, maupun perilaku aplikasi.

Uji statis call-site service-role `app/` dan `features/` menghasilkan 151 pasangan object-privilege dari 63 nama tabel. Pada kandidat, **150 pasangan untuk objek yang ada memiliki hak efektif**; satu mengacu `utero_academy.tasks` yang **tidak ada**. Query dashboard admin sudah dialihkan ke `task_cards` + relasi `task_lists`, dengan error Supabase tidak lagi diabaikan. Inventaris statis tidak membuktikan setiap jalur data dinamis maupun respons Data API.

## Yang belum lulus

- Clone hanya DB lokal; tidak ada Auth API/Storage API, key, app staging, atau cleanup fixture yang terbukti terikat clone. Signup, seleksi, onboarding, portal sekolah, CV/portofolio, sertifikat/signed URL, dan SoundPub tetap **untested end-to-end**.
- Runner migrasi, audit row-hash/Storage byte, peran reviewer, dan provenance snapshot production terbaru masih diperlukan sebelum kandidat boleh dipromosikan.
- Drift function, owner, policy, grant yang tersisa wajib diputuskan per objek, bukan disamakan secara otomatis.

Keputusan: **NO-GO staging/production**. Clone disposable dibiarkan utuh untuk verifikasi lanjutan; source tidak diubah.
