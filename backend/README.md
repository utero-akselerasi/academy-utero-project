# Backend mandiri Academy (tahap migrasi)

## Strategi migrasi aktif: identitas saja

PostgreSQL target dibuat baru dari migrasi skema repository dan seed role/permission. Hanya UUID akun Academy, email, nama, dan profil yang disalin dari sumber. Password, sesi, role assignment user, data domain, file avatar, serta objek storage **tidak disalin**. Rujuk [runbook migrasi identitas](../docs/35-selfhosted-identity-only.md) untuk langkah migrate, user-profile-copy, bootstrap, assignment role, dan undangan aktivasi. Persiapan production tetap NO-GO sampai gate dan persetujuan operator selesai.

Stack Docker memakai `docker-compose.backend.yml` dan overlay `docker-compose.selfhosted.yml` atau `docker-compose.production.yml` sesuai lingkungan. PostgreSQL berada di volume Docker; storage internal berada di bind mount `./data/storage` dan tidak diisi dari Supabase pada strategi aktif. Jangan menjalankan job `db-copy` atau `storage-import` sebagai prosedur migrasi saat ini.

## Catatan implementasi historis (bukan langkah cutover aktif)

**Belum untuk cutover production.** Stack ini terisolasi dari `docker-compose.yml` lama. Web Next.js masih memakai Supabase di beberapa alur; backend mandiri mencakup Auth, RBAC session, storage, dan sebagian besar domain operasional. Jangan arahkan trafik production ke stack ini sampai seluruh fitur dipindahkan dan diuji.

## Jalankan stack baru

1. Siapkan nilai dalam `backend/.env` dari `backend/.env.example`. Pilih dua password kuat berbeda; URL password wajib URL-encoded bila mengandung karakter khusus. Jangan gunakan kredensial Supabase production untuk database target.
2. Muat env ke shell atau pakai `docker compose --env-file backend/.env -f docker-compose.backend.yml ...` pada setiap perintah. Jangan mencampur dengan Compose lama.
3. `docker compose --env-file backend/.env -f docker-compose.backend.yml up -d --build postgres migrate api`.
4. `docker compose --env-file backend/.env -f docker-compose.backend.yml exec -T api node -e "fetch('http://127.0.0.1:3001/health/ready').then(r=>console.log(r.status))"`.

Untuk menjalankan web, API, PostgreSQL, nginx, dan storage lokal sebagai satu stack:

`docker compose --env-file backend/.env -f docker-compose.backend.yml -f docker-compose.selfhosted.yml up -d --build`

Web tersedia pada `${ACADEMY_HTTP_PORT:-9982}`. Gunakan TLS pada reverse proxy production dan biarkan `ACADEMY_SECURE_COOKIES=true`. Untuk pengujian HTTP lokal saja, set `ACADEMY_SECURE_COOKIES=false`.

Setelah akun uji lima role diisi pada `backend/.env`, jalankan gerbang login dan endpoint dasar:

`docker compose --env-file backend/.env -f docker-compose.backend.yml --profile operations run --rm role-smoke`

Pendaftaran email baru mewajibkan `PUBLIC_APP_URL` yang mengarah ke web, serta `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, dan `SMTP_FROM`. Tanpa SMTP siap, pendaftaran gagal tertutup; akun tidak boleh diberi status terverifikasi otomatis. Link verifikasi memakai token sekali pakai yang kedaluwarsa.

PostgreSQL menyimpan data pada named volume `postgres_data`. Storage disimpan di bind mount `./data/storage:/srv/storage`, yakni direktori lokal proyek. Port PostgreSQL dan API tidak dipublikasikan. Backend tidak membaca volume dari stack Supabase lain. Jaga backup kedua volume sebagai satu generasi snapshot; volume database saja tidak cukup untuk memulihkan berkas.

Database kosong dijalankan dari `backend/migrations/0001_platform.sql`, seluruh SQL `supabase/migrations/0001–0053`, seed RBAC repo, dan seri `backend/migrations/9000+`. Tracker SHA-256 membuat migrasi yang sudah dijalankan gagal bila sumber SQL berubah. Skema `storage.objects` adalah metadata kompatibilitas untuk proses copy; file fisik di `./data/storage`, bukan pada server Supabase.

## Impor snapshot staging lama (tidak berlaku untuk migrasi identitas)

Source database digunakan **read-only**. Target DB dan direktori file ditulis. Bekukan semua writer Academy lebih dahulu; tool tidak membuat snapshot source DB dan source file atomik. Backup dan uji restore sebelum menjalankan profile migrasi.

1. Export file dari Supabase sebagai `<STORAGE_IMPORT_SOURCE>/<bucket>/<object-path>` dan audit kepemilikan bucket shared. Jangan mengasumsikan setiap file dalam shared bucket milik Academy.
2. Set `SOURCE_DATABASE_URL`, `STORAGE_IMPORT_SOURCE`, `CONFIRM_DATABASE_COPY=copy-to-local-academy`, dan `CONFIRM_STORAGE_IMPORT=copy-to-local-storage` hanya saat staging siap diimpor. `SOURCE_DATABASE_URL` harus memakai user read-only.
3. `docker compose --env-file backend/.env -f docker-compose.backend.yml --profile migration run --rm db-copy`. Export Auth, Academy, dan metadata storage memakai satu snapshot konsisten PostgreSQL; impor DB target dalam satu transaksi. Snapshot database tidak mencakup file fisik storage: writer dan upload harus tetap dibekukan. Tetap bandingkan tabel dan Auth sesudahnya.
4. `docker compose --env-file backend/.env -f docker-compose.backend.yml --profile migration run --rm storage-import`. Ia menolak file target yang hash-nya berbeda dan melanjutkan file yang cocok.
5. `docker compose --env-file backend/.env -f docker-compose.backend.yml --profile migration run --rm migration-verify`. Verifier membandingkan checksum data/Auth, owner dan manifest storage, SHA-256 byte setiap file export terhadap storage internal, role/permission, serta FK. Pastikan `storageBytesChecked` sama dengan jumlah objek sumber; selisih sekecil apa pun adalah NO-GO.

Urutan freeze, gerbang GO/NO-GO, DNS, dan rollback: [runbook cutover](../docs/32-selfhosted-cutover.md). Uji fixture lokal tidak menggantikan verifikasi produksi.

`storage.objects.owner_id` pada shared bucket bisa kosong pada sumber. Importer memakai kolom `owner` bila ada; file privat yang tetap tanpa owner hanya bisa dibaca admin. **Jangan cutover** sebelum pemetaan owner dan hak baca sekolah/intern ditetapkan berdasarkan relasi domain dan diuji negatif lintas akun.

## Status fitur

- Ada: Auth password/signup/email verification/session, penerimaan undangan, dan reset administratif; bcrypt lama diverifikasi lalu di-rehash scrypt; RBAC lima role aktif; profil, pendaftaran applicant, storage lokal dan signed URL, absensi, daily report, CMS, assessment, certificate, school, super-admin, sebagian Tasks/LMS; PostgreSQL, API, web, nginx Docker; migrasi database/storage staging. Backup/restore PostgreSQL+storage berhasil diuji pada stack lokal dengan ACL tetap berfungsi. Lihat [runbook backup/restore](../docs/31-selfhosted-backup-restore.md).
- Belum tervalidasi: seluruh alur OAuth, sisa aksi LMS dan admin, E2E matrix lima role dengan data produksi, cutover produksi dan rollback sesudah target menerima tulis.
- Jangan jalankan `docker compose down -v`: itu menghapus database target. Jangan hapus data shared Supabase.

## Verifikasi RBAC

Sumber acuan RBAC adalah `supabase/seed/0001_rbac_seed.sql`, konsolidasi role pada
`supabase/migrations/0028_consolidate_staff_roles.sql`, dan role applicant pada
`supabase/migrations/0039_registration_selection_system.sql`. Backend lokal harus memiliki role aktif
`super_admin`, `admin`, `school`, `intern`, `applicant`; `visitor` nonassignable.
Role legacy `mentor` dan `admin_academy` tidak dibuat pada database bersih, tetapi bila
terbawa dari database lama harus tetap tersimpan sebagai nonassignable.

Jalankan verifier terhadap database lokal dengan:

```sh
DATABASE_URL=postgresql://... node backend/scripts/verify-rbac.mjs
```

Verifier berjalan dalam transaksi read-only dan gagal bila role aktif/nonassignable atau permission
berbeda dari acuan, ada assignment yatim/duplikat, pasangan `scope_type` dan `scope_id` tidak lengkap,
atau role aktif memiliki assignment berscope. Larangan scope aktif disengaja: resolver identity backend
lokal saat ini membaca assignment role sebagai global dan belum menerapkan pembatasan berdasarkan scope.
