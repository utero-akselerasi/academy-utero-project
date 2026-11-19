# Backend mandiri Academy (tahap migrasi)

## Strategi migrasi aktif: identitas saja

PostgreSQL target dibuat baru dari migrasi skema repository dan seed role/permission. Hanya UUID akun Academy, email, nama, dan profil yang disalin dari sumber. Password, sesi, role assignment user, data domain, file avatar, serta objek storage **tidak disalin**. Rujuk [runbook migrasi identitas](../docs/35-selfhosted-identity-only.md) untuk langkah migrate, user-profile-copy, bootstrap, assignment role, dan undangan aktivasi. Persiapan production tetap NO-GO sampai gate dan persetujuan operator selesai.

Stack Docker hanya memakai `compose.yaml` dengan nilai dari `.env` di root repo. PostgreSQL berada di volume Docker; storage internal berada di bind mount `./data/storage` dan tidak diisi dari Supabase pada strategi aktif. Jangan menjalankan job `db-copy` atau `storage-import` sebagai prosedur migrasi saat ini.

## Catatan implementasi historis (bukan langkah cutover aktif)

**Production masih NO-GO** sampai readiness gate, TLS, UAT, backup/restore, dan approval operator lulus.

## Jalankan stack baru

1. Isi satu file `.env` dari `.env.example`. Gunakan secret unik, URL-encode password pada URL PostgreSQL, dan jangan commit `.env`.
2. Gunakan hanya `compose.yaml` dan satu `.env` di root, dibuat dari `.env.example`. File konfigurasi develop dan Compose lama sudah dipensiunkan.
3. Siapkan network reverse proxy bersama sekali per host: `docker network create carubra-network`, `docker network create uteroindonesia-network`, dan `docker network create utero-id-network`. Perintah aman diulang dengan memeriksa `docker network inspect <nama>` lebih dahulu; jangan hapus network yang sudah dipakai service lain.
4. Jalankan seluruh stack dengan `docker compose --env-file .env -f compose.yaml up -d --build`.
5. Periksa API dengan `docker compose --env-file .env -f compose.yaml exec -T api node -e "fetch('http://127.0.0.1:3001/health/ready').then(r=>console.log(r.status))"`.

Untuk menjalankan web, API, PostgreSQL, nginx, dan storage lokal sebagai satu stack:

`docker compose --env-file .env -f compose.yaml up -d --build`

Web uji lokal tersedia pada `http://127.0.0.1:${ACADEMY_HTTP_PORT:-9984}`. `compose.yaml` hanya memuat konfigurasi production TLS; URL HTTPS kanonis, sertifikat valid, dan `ACADEMY_SECURE_COOKIES=true` wajib sebelum deploy.

Setelah akun uji lima role diisi pada `.env`, jalankan gerbang login dan endpoint dasar:

`docker compose --env-file .env -f compose.yaml --profile operations run --rm role-smoke`

Pendaftaran email baru mewajibkan `PUBLIC_APP_URL` yang mengarah ke web, serta `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, dan `SMTP_FROM`. Tanpa SMTP siap, pendaftaran gagal tertutup; akun tidak boleh diberi status terverifikasi otomatis. Link verifikasi memakai token sekali pakai yang kedaluwarsa.

PostgreSQL menyimpan data pada named volume `postgres_data`. Storage disimpan di bind mount `./data/storage:/srv/storage`, yakni direktori lokal proyek. Port PostgreSQL dan API tidak dipublikasikan. Backend tidak membaca volume dari stack Supabase lain. Jaga backup kedua volume sebagai satu generasi snapshot; volume database saja tidak cukup untuk memulihkan berkas.

Database kosong dijalankan dari `backend/migrations/0001_platform.sql`, SQL migrasi yang masih menjadi bagian skema aplikasi, seed RBAC repo, dan seri `backend/migrations/9000+`. Tracker SHA-256 membuat migrasi yang sudah dijalankan gagal bila sumber SQL berubah. Skema `storage.objects` adalah metadata kompatibilitas; file fisik tersimpan di `./data/storage`.

Instalasi baru tanpa migrasi identitas: isi `BOOTSTRAP_SUPER_ADMIN_EMAIL`, password acak 16–128 karakter, `CONFIRM_BOOTSTRAP_SUPER_ADMIN=bootstrap-initial-super-admin`, dan `CONFIRM_EMPTY_DATABASE_BOOTSTRAP=create-first-super-admin` di env operator terlindung. Jalankan `docker compose --profile migration run --rm --build bootstrap-super-admin` dari root. Script membuat satu akun pertama hanya bila `auth.users`, `user_profiles`, dan `user_roles` kosong; ia menolak eksekusi ulang. Segera kosongkan kedua variabel konfirmasi dan keluarkan password bootstrap dari env setelah tersimpan di pengelola password. Untuk migrasi identitas lama, **jangan** set flag database kosong: impor dan verifikasi identitas sebelum bootstrap sesuai runbook.

## Impor snapshot staging lama (tidak berlaku untuk migrasi identitas)

Source database digunakan **read-only**. Target DB dan direktori file ditulis. Bekukan semua writer Academy lebih dahulu; tool tidak membuat snapshot source DB dan source file atomik. Backup dan uji restore sebelum menjalankan profile migrasi.

1. Export file dari Supabase sebagai `<STORAGE_IMPORT_SOURCE>/<bucket>/<object-path>` dan audit kepemilikan bucket shared. Jangan mengasumsikan setiap file dalam shared bucket milik Academy.
2. Set `SOURCE_DATABASE_URL`, `STORAGE_IMPORT_SOURCE`, `CONFIRM_DATABASE_COPY=copy-to-local-academy`, dan `CONFIRM_STORAGE_IMPORT=copy-to-local-storage` hanya saat staging siap diimpor. `SOURCE_DATABASE_URL` harus memakai user read-only.
3. `docker compose --env-file .env -f compose.yaml --profile migration run --rm db-copy`. Export Auth, Academy, dan metadata storage memakai satu snapshot konsisten PostgreSQL; impor DB target dalam satu transaksi. Snapshot database tidak mencakup file fisik storage: writer dan upload harus tetap dibekukan. Tetap bandingkan tabel dan Auth sesudahnya.
4. `docker compose --env-file .env -f compose.yaml --profile migration run --rm storage-import`. Ia menolak file target yang hash-nya berbeda dan melanjutkan file yang cocok.
5. `docker compose --env-file .env -f compose.yaml --profile migration run --rm migration-verify`. Verifier membandingkan checksum data/Auth, owner dan manifest storage, SHA-256 byte setiap file export terhadap storage internal, role/permission, serta FK. Pastikan `storageBytesChecked` sama dengan jumlah objek sumber; selisih sekecil apa pun adalah NO-GO.

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
