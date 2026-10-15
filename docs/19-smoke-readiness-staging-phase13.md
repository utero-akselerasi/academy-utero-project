# Smoke dan readiness staging fase 13

Scope dokumen ini hanya validasi staging. Tidak menjalankan bootstrap, migrasi, seed, restore, atau perubahan production. Semua koneksi database yang dipakai verifier lama wajib `BEGIN READ ONLY`; smoke baru di bawah hanya memakai HTTP `GET` ke loopback.

## Gate otomatis aman

1. Siapkan tunnel staging Storage/API di `http://127.0.0.1:18100` dan app staging pada port loopback lain.
2. Set `PHASE13_STAGING_APP_URL`, misalnya `http://127.0.0.1:3000/`. Jangan memakai URL production.
3. Opsional: set `PHASE13_SOUNDPUB_AVATAR_PATH` ke satu object path avatar uji non-PII yang memang boleh publik. Jangan menaruh URL bertoken, nama orang, email, atau key di variabel ini.
4. Verifikasi proses tunnel benar-benar mengarah ke gateway instance `supabase-02` di port `8100`, container dan mount DB milik `supabase-02`, serta app lokal menggunakan URL Supabase staging. Alamat SSH host saja bukan bukti identitas instance. Jangan jalankan smoke app bila `.env` masih menunjuk develop/production.
5. Jalankan `npm run smoke:phase13-journeys-staging`. Script membuktikan halaman `/register` dan `/login` merespons 200 serta, bila sampel tersedia, avatar SoundPub tetap dapat dibaca sebagai image. Hasil `passed` untuk halaman hanya membuktikan HTTP, bukan target backend maupun signup end-to-end. Output hanya status; tidak mencetak URL sampel atau secret.
6. Jalankan `npm run smoke:phase13-storage-staging` untuk CV, portofolio, dan template sertifikat beserta kategori Storage lain. Script lama ini baca-saja, tetapi membutuhkan clone lokal yang dikunci namanya. `missing` berarti tidak ada sampel data dan bukan kelulusan.
7. Jalankan `npm run verify:phase13-readiness -- staging` untuk Auth Admin, bucket, dan tracker migrasi. Perintah ini baca-saja; hasil `ready: false` tetap NO-GO.

## Smoke manual terkontrol

Gunakan akun dan data sintetis staging. Catat waktu, commit, operator, status, dan ID acak internal bila perlu; jangan salin nama, email, token, file, atau isi jawaban ke evidence.

| Alur | Bukti lulus minimum | Cleanup |
| --- | --- | --- |
| Signup | akun pelamar staging tercipta, login berhasil, role/dashboard benar | hapus akun uji lewat prosedur staging |
| CV dan portofolio | file sintetis valid terunggah; path tersimpan; signed URL dapat dibuka; public/anon direct ditolak | hapus objek dan aplikasi uji |
| Seleksi | assignment terlihat; attempt mulai; jawaban tersimpan; submit, grading, dan keputusan berjalan sesuai status | hapus fixture lewat prosedur staging |
| Onboarding | keputusan lulus menghasilkan penerimaan/profil intern tepat satu kali; retry tidak menggandakan data | hapus fixture atau restore snapshot staging |
| Portal sekolah | akun sekolah hanya melihat aplikasi/siswa sekolahnya; ID sekolah lain ditolak; report download sesuai scope | hapus fixture/report sintetis |
| Sertifikat | template privat terbaca lewat signed URL; generate/print memakai template; sertifikat peserta lain ditolak | hapus template dan sertifikat uji |
| SoundPub | avatar publik sampel tetap 200 sebelum/sesudah smoke; upload/update aplikasi SoundPub dilakukan hanya bila pemilik sistem menyetujui akun uji | kembalikan avatar akun uji |

Untuk signed URL, bukti wajib mencakup: URL memiliki token dan host staging; byte unduhan sama dengan direct service-role; URL objek lain tidak diterima; akses public/anon ke bucket privat ditolak. Jangan menyimpan URL bertoken di log atau screenshot.

## Keputusan readiness

GO hanya bila semua gate otomatis `passed`/`ready: true`, seluruh baris manual berstatus lulus, tidak ada kebocoran lintas tenant, dan cleanup terbukti. `missing`, `untested`, akses staging tidak tersedia, atau bukti manual tanpa operator/timestamp menghasilkan NO-GO. Production tetap tidak disentuh.

## Status bukti saat dokumen dibuat

- Terbukti melalui unit test: target app dikunci ke loopback dan bukan port Supabase/DB; request smoke baru hanya `GET`; redirect tidak dianggap lulus; path traversal SoundPub ditolak; sampel kosong dilaporkan `untested`.
- Catatan awal (2026-10-12): koneksi staging belum diuji. Hasil pemeriksaan berikutnya dicatat terpisah di bawah; HTTP dan keberadaan data tidak membuktikan alur end-to-end.

## Pemeriksaan lanjutan 2026-10-13 (baca-saja, NO-GO)

Tunnel SSH aktif: `18100` diteruskan ke `127.0.0.1:8100`, `15532` ke DB container melalui host bersama. `docker ps` dan `docker inspect` di host membuktikan gateway, Auth, Storage, dan mount DB adalah milik `supabase-02`; `supabase-01` tidak diakses. Tidak ada variabel staging dalam proses lokal atau `.env`, meski key staging tersedia di konfigurasi container `supabase-02` (nilai tidak dikeluarkan). Tidak ada request write ataupun perubahan data.

| Gate/alur | Bukti aktual | Status |
| --- | --- | --- |
| App HTTP | GET `/register` dan `/login` pada port lokal 3000 sama-sama 200; `.env` workspace menunjuk **develop**, konfigurasi proses app belum dibuktikan staging | untested untuk staging |
| Auth staging | GET Auth Admin dengan key staging di gateway `supabase-02`: HTTP 200, tanpa output user | endpoint passed; signup untested |
| Bucket readiness | GET daftar bucket: `academy-private`, `daily-report`, `selection-answers`; bucket wajib lainnya tidak ada | failed |
| Migrasi | Query `BEGIN READ ONLY` menunjukkan `utero_academy.schema_migrations` tidak ada | failed |
| CV, portofolio | Count path non-kosong pada `internship_applications`: 0 untuk masing-masing | missing; upload/signed URL untested |
| Sertifikat | Count path template dan file sertifikat: 0 untuk masing-masing | missing; generate/print/signed URL untested |
| Seleksi | Tidak ada baris assignment, decision, atau application; hanya keberadaan diperiksa | untested |
| Onboarding | Tabel intern profile ada, tetapi tanpa fixture onboarding terverifikasi | untested |
| Portal sekolah | Tabel sekolah dan kontak ada, tetapi tanpa akun/fixture uji scoped | untested |
| SoundPub | Tidak ada path avatar sintetis yang disetujui; GET objek dan upload tidak dijalankan | untested |

GET `/auth/v1/health` tanpa key mendapat 401, GET `/storage/v1/status` mendapat 200; itu hanya bukti gateway terjangkau, bukan status alur. Tidak ada mutasi fixture karena identitas target app belum terbukti staging dan data staging kosong untuk alur kritis. Siapkan deploy app yang benar-benar terikat staging, akun/objek sintetis dan pemilik cleanup, lalu ulangi gate serta smoke manual. Jangan tafsirkan hasil 200 port lokal sebagai kelulusan staging.

## Point 3: binding app dan rencana fixture (2026-10-13)

`npm run verify:phase13-staging-app-binding` sekarang memeriksa empat hal sebelum app dianggap staging: `DEPLOY_TARGET=staging`, URL Supabase tepat `http://127.0.0.1:18100`, app berada pada loopback terpisah, serta bundle browser memuat endpoint staging dan tidak memuat domain develop/production. Pemeriksaan bundle hanya memakai GET dan tidak mencetak key.

Hasil aktual: port 3000 menjalankan proses Academy, tetapi command line tidak menandai staging dan environment proses pemeriksaan tidak memiliki target/key staging. Verifier berhenti dengan `Binding app staging gagal diverifikasi.` App HTTP sebelumnya tetap bukan bukti E2E staging.

`plan-phase13-staging-fixture.mjs` menghasilkan rencana identitas `@invalid.example`, marker UUID unik, prefix Storage khusus, urutan create, dan cleanup exact-ID/exact-prefix. Planner selalu menghasilkan `executable: false`; belum ada runner write. Gate menolak selain `supabase-02`, gateway selain `127.0.0.1:8100`, volume di luar path `supabase-02`, key yang belum diterima staging, binding app gagal, atau cleanup dry-run belum terbukti.

Fixture **tidak dibuat**. Alasan:

- Binding Academy app ke `supabase-02` gagal dibuktikan.
- Service key dari konfigurasi container `supabase-02` diterima Auth Admin staging, tetapi belum ada runner app staging yang memakai key tersebut.
- Cleanup mencakup Auth, schema Academy, dan Storage sehingga bukan satu transaksi PostgreSQL. Belum ada prosedur kompensasi yang diuji dengan fixture sintetis dan verifikasi nol-sisa.
- Bucket dan migration tracker staging belum memenuhi readiness.

Status E2E aktual untuk signup, CV/portofolio, seleksi, onboarding, portal sekolah, sertifikat/signed URL, dan SoundPub tetap `untested`. Status endpoint/readiness parsial tidak berubah dari tabel pemeriksaan sebelumnya. Langkah aman berikutnya: deploy app staging pada port loopback baru dengan env tervalidasi, jalankan verifier binding, siapkan runner fixture dengan manifest privat dan cleanup `finally`, uji cleanup pada satu fixture minimum, baru lanjut smoke alur lain.

## Audit task 3–5, 2026-10-13

- Tunnel lokal terbukti mengarah ke gateway `supabase-02` port 8100 dan DB container `supabase-02-db` pada IP internal staging. Mount DB berada di `/data/supabase/instances/supabase-02/`; container Envoy, Auth, dan Storage staging berstatus running.
- App Academy port 3000 masih memakai workspace env develop. Port 3100 milik aplikasi lain. Tidak ada `.env.staging`, `DEPLOY_TARGET`, key staging, atau proses Academy dengan marker staging.
- Upaya membuat salinan build staging terpisah pada port 3110 ditolak kebijakan eksekusi sebelum file atau proses dibuat. App binding tidak diperbaiki secara live.
- Verifier binding kini membedakan marker bundle browser dari binding runtime server. Hasil bundle dapat `passed`, tetapi `serverRuntimeBinding` tetap `untested` dan `bindingProven: false` sampai proses runtime staging dibuktikan melalui evidence khusus.
- Fixture gate tidak lagi meminta pembuktian memakai production key. Service key wajib berasal dari env container `supabase-02-envoy` dan diterima endpoint staging. Cleanup wajib terbukti untuk Auth, DB, Storage, serta pemeriksaan zero-residue.
- Cleanup lintas Auth/DB/Storage tidak atomik dan belum pernah lulus dengan fixture sintetis. Tidak ada runner write; planner tetap `executable: false`. Tidak ada akun, row, atau object dibuat.

Blocker konkret: tidak ada Academy app staging yang aktif; runtime server binding belum dapat diuji; environment staging lokal belum tersedia; bucket readiness belum lengkap; tracker migrasi tidak ada; dan prosedur cleanup kompensasi belum terbukti zero-residue. Semua alur E2E tetap `untested`; keputusan tetap **NO-GO**.
