# Remediation Progress — Audit Produksi 2026-09-26

Status: `[ ]` belum · `[~]` jalan / sumber sudah di-commit tapi belum diuji · `[x]` selesai & ter-push

Catatan penting: `[x]` berarti **sumber sudah ter-commit dan `tsc` bersih**, BUKAN berarti sudah
terverifikasi di produksi. Repo ini belum punya test runner, jadi tidak ada satu pun perilaku guard
yang terbukti lewat test otomatis. Item yang butuh migrasi DB tetap `[ ]` sampai migrasinya benar-benar
diterapkan.

Untuk migrasi, `[~]` berarti **berkasnya ditulis dan ter-push, tapi belum dijalankan di DB mana pun.**
Tidak satu pun migrasi di dokumen ini sudah diterapkan.

Terakhir diperbarui: 2026-09-27 (Batch 0 ditambahkan; B1.5, B4.4, B6.1, B6.3, B6.5 dikoreksi; B6.2/B6.3/B6.4 selesai).

Referensi ID temuan mengikuti Master Deep Audit Report (C-x kritis, H-x tinggi, M-x sedang).

## Keputusan Kebijakan

- Role `mentor` **dihapus** sebagai peran login. Role `admin` = administrator **sekaligus** pembimbing.
- Role `admin_academy` **digabung** ke `admin`.
- Assignment `mentor` / `admin_academy` lama dimigrasikan menjadi `admin`. **Tidak ada akun, profil,
  penempatan, atau data domain yang dihapus** karena konsolidasi peran ini.
- Entitas domain tetap bernama `mentor_profiles`, `mentor_assignments`, `mentor_id`.
- Login `admin` tetap mendarat di `/dashboard/admin`; route `/dashboard/mentor/*` tetap dipakai sebagai
  area kerja operasional admin.
- Temuan C-5 (mentor lockout) **dibatalkan** — bukan bug, sesuai kebijakan di atas.
- Baris `mentor_profiles` **bukan** bukti otorisasi (C-2). Otorisasi hanya dari `user_roles`.

---

## Batch 0 — Eksposur data publik (MENDAHULUI SISA BACKLOG)

Batch 1–3b memperbaiki lapisan **aplikasi**. Probe read-only membuktikan lapisan
**database dan storage** tidak dilindungi sama sekali: kunci anon publik — kunci
yang memang dikirim ke setiap browser — membaca 17 tabel produksi dengan jumlah
baris identik dengan service role, dan `check_in_selfie_path` nyata terambil tanpa
header auth sama sekali (HTTP 200, image/jpeg). Artinya seluruh guard Batch 1–3b
bisa dilewati lewat jalur samping.

Detail lengkap ada di plan Batch 0. Ringkasnya, tiga migrasi saling menumpuk:
`0007` membuka `GRANT ALL ... TO anon` + `ALTER DEFAULT PRIVILEGES` (tabel baru
lahir terbuka) + `"Public Access"` `using (true)` pada `storage.objects`;
`seed/0002` membuktikan itu regresi karena ia sengaja menetapkan bucket sensitif
`public = false`; dan `_fix_admin_queries_to_srv.js` memindahkan hampir seluruh
aplikasi ke service role, yang melewati RLS — sehingga tidak ada satu pun fitur
yang pernah gagal akibat RLS bolong, dan bolongnya tak terlihat sampai diprobe.

### B0.1 Migrasi pengencangan — **DITULIS, TIDAK DIJALANKAN**

Ketiga belas berkas sudah ter-commit dan ter-push. Tidak satu pun sudah diterapkan
ke DB mana pun. Tidak satu pun memuat `DELETE`, `DROP TABLE`, `TRUNCATE`, atau
`DROP ROLE`; satu-satunya `DROP` adalah `drop policy if exists`.

- [~] `0028_consolidate_staff_roles.sql` — insert role `admin` (tidak pernah
      di-seed), turunkan permission `admin_academy` ∪ `mentor` dari baris hidup,
      migrasi assignment lewat `insert ... on conflict do nothing` **tanpa
      inference** (satu-satunya bentuk yang mencakup partial index `0001:588-595`),
      + kolom `is_assignable`. **Nol penghapusan** — baris legacy dibiarkan utuh
- [~] `0029_enable_rls_remaining_tables.sql` — `enable` + `force row level
      security` untuk tabel yang belum punya, lewat loop ber-penjaga `pg_class`
- [~] `0030a_policies_identity.sql` — 7 tabel identitas
- [~] `0030b_policies_attendance.sql` — 3 tabel absensi
- [~] `0030c_policies_reports_program.sql` — 13 tabel laporan + program
- [~] `0030d_policies_lms.sql` — 19 tabel LMS + gamifikasi
- [~] `0030e_policies_tasks.sql` — 7 tabel task. **Men-drop lubang `0004`**: dua
      policy `using (true)` pada `task_subtasks` yang memberi baca/tulis penuh ke
      setiap user login. Postgres meng-OR policy permissive, jadi drop ini yang
      paling menentukan di seluruh batch
- [~] `0030f_policies_cms_audit.sql` — 13 tabel CMS/audit/permission.
      `audit_logs`: select super_admin, **tanpa policy tulis untuk siapa pun**
- [~] `0031_revoke_blanket_grants.sql` — `alter default privileges ... revoke`
      lebih dulu (matikan pewarisan), lalu revoke massal, lalu kembalikan hanya
      allowlist yang terbukti dipakai klien sesi
- [~] `0032a_storage_limits_and_policies.sql` — batas ukuran + `allowed_mime_types`
      + ganti keempat policy longgar `0007`. Aman dijalankan kapan pun
- [~] `0032b_storage_flip_private.sql` — flip 5 bucket sensitif jadi privat.
      **Berisi palang pengaman yang membatalkan migrasi sendiri** kalau backfill
      B0.3 belum tuntas. Urutan wajib: B0.2 → B0.3 → verifikasi → berkas ini
- [~] `0033_fix_view_and_function_security.sql` — `user_quiz_attempts_summary`
      jadi `security_invoker` (sekarang bocorkan percobaan kuis setiap peserta),
      + `search_path` dipaku untuk **seluruh** fungsi schema, karena
      `current_user_has_role()` SECURITY DEFINER adalah dasar setiap predikat
      policy `0030a-f`
- [~] `0034_verify_hardening.sql` — 10 blok asersi **baca-saja**, aman diulang,
      dijalankan **terakhir**. Ini satu-satunya bukti otomatis yang dimiliki batch
      ini: repo tidak punya test framework, dan predikat RLS yang salah tidak
      melempar error — ia mengembalikan nol baris, yang di aplikasi tampil sebagai
      "tidak ada data"

Total: **62 dari 62 tabel** `utero_academy` punya postur eksplisit.

### B0.2 Sisa pekerjaan sumber — **SELESAI, `tsc` hijau**

Ketiganya tuntas dan ter-push. Ini seluruh pekerjaan Batch 0 yang **tidak**
menyentuh produksi; sisanya (B0.3) menunggu izin eksplisit.

Perlu ditegaskan supaya tidak salah baca: **tidak satu pun lubang kritis
tertutup oleh B0.2.** Sumbernya sudah siap, tapi kunci anon masih membaca 17
tabel produksi dan storage masih terbuka tanpa auth sampai B0.3a–B0.3c
dijalankan. Yang sudah dicapai adalah: migrasinya ada, runner-nya gagal-keras,
dan aplikasinya tidak akan rusak saat migrasi itu diterapkan.

- [x] B0.2a Union `RoleCode` dikecilkan jadi
      `"super_admin" | "admin" | "school" | "intern"`. Sepuluh situs yang jadi
      error kompilasi diperbaiki semua, **`tsc` hijau (`TSC_EXIT=0`)** — itulah
      buktinya tidak ada jalur kode `admin_academy`/`mentor` yang masih
      terjangkau lewat sistem role bertipe. Ini membuka B1.1/B1.3/B1.6.

      Dua penyimpangan sadar dari rencana awal:

      1. **`.eq("is_assignable", true)` TIDAK dipakai** di
         `features/super-admin/queries.ts`. Kolom itu baru ada **setelah** 0028
         dijalankan (B0.3a), dan filter PostgREST atas kolom yang belum ada
         menggagalkan **seluruh** kueri — halaman super-admin akan mati total
         sekarang. Penyaringan dipindah ke kode lewat `isActiveRoleCode()`.
         Setelah 0028 diterapkan, filter database boleh ditambahkan sebagai
         lapis kedua.
      2. `tsc` hanya menjaga situs bertipe `RoleCode`. Situs bertipe `string`
         (`Role.code`, `currentUserRole`, parameter `roleCode`) harus dicari
         lewat grep dan disaring runtime — karena itu `isActiveRoleCode()`
         diekspor dan dipakai di `app/dashboard/profile/page.tsx`,
         `features/lms/components/LessonComments.tsx`, dan
         `features/super-admin/queries.ts`.

      Sekalian diperbaiki di luar rencana: `resolveActiveRole()` menggantikan
      `.find()` + `|| allowedRoles[0]` di `ProtectedDashboardLayout`. Yang lama
      bergantung pada urutan baris database (sidebar user `super_admin`+`admin`
      bisa berganti sendiri antar-permintaan) dan fallback-nya merender sidebar
      peran yang user belum tentu punya.

      **Titik yang SENGAJA tetap menerima kode legacy** (jangan "diperbaiki"):
      `provisionDomainProfile` (`features/super-admin/actions.ts:92`) dan
      `detectMissingDomainProfiles` (`features/super-admin/queries.ts:204`).
      Keduanya menyediakan baris data domain, bukan otorisasi — baris
      `mentor_profiles` bukan bukti otorisasi (keputusan C-2) — dan user lama
      yang cuma punya baris `mentor`/`admin_academy` tetap harus bisa
      dilengkapi profilnya selama baris itu masih hidup.
- [x] B0.2b `lib/storage-urls.ts` + konversi **16 titik tulis** (simpan object
      path, bukan URL) & titik baca (tanda tangani di server). **Selesai, `tsc`
      hijau (`TSC_EXIT=0`).** Delapan domain: absensi, profil, pendaftaran,
      laporan harian, task, LMS, portal sekolah, template sertifikat, CMS.

      Resolusi selalu ditaruh di **lapisan kueri**, bukan per titik render —
      aturan yang berulang di kedelapan domain. Melebarkan tipe kolom ke
      `string | null` dipakai sebagai **alat penemuan**: `tsc` yang menunjukkan
      titik render mana yang belum menangani objek yatim, bukan grep.

      Keempat jebakan tertangani:

      1. Cek ekstensi dipindah ke object path lewat `isPdfPath()` dan
         `isImagePath()` di `lib/storage-urls.ts` — signed URL selalu berakhir
         `?token=...`, jadi keputusan tipe tidak boleh diambil dari URL final.
      2. `hero_image_path` diselesaikan dengan **memisah state**, bukan mengonversi
         nilai. `LandingPageEditor` memegang dua state: `heroImagePath` yang
         dikirim balik lewat form dan `heroImagePreviewUrl` yang dirender. Field
         tersembunyi ikut diganti nama `heroImageUrl` → `heroImagePath`; nama
         lamanya justru yang mengundang bug ini.
      3. Halaman cetak sertifikat dapat TTL lebih panjang.
      4. Titik render publik tertangani **secara struktural**, bukan lewat
         pengecualian per titik: `PUBLIC_BUCKETS` merutekan `gallery`/`article`/
         `mentor`/`school-logo` ke `getPublicUrl()`, dan `0032b` tidak pernah
         mem-flip keempatnya. Tidak ada token yang bisa masuk ke HTML ter-cache.

      **Dua koreksi terhadap rencana, ditemukan dari sumber:**

      1. `uploadCmsFileAction` melayani **empat** field, bukan hanya
         `hero_image_path`. Karena itu ia sekarang mengembalikan `{ path, url }` —
         sebelumnya hanya URL, jadi object path-nya hilang di batas klien.
      2. **Tiga di antaranya sengaja TIDAK dikonversi.** `skills[].icon_url`,
         `expertisers[].avatar`, `partnerships[].logo_url` ada di JSONB bebas-isi
         yang juga memuat path aset lokal aplikasi (`/images/expert-dadik.jpg`)
         dan URL eksternal tempelan admin. `toObjectPath` memetakan kedua bentuk
         itu ke `null`, jadi mengonversinya akan **menghapus senyap** gambar yang
         sudah benar. Ketiganya tetap menyimpan URL; aman karena bucket `gallery`
         tetap publik. Ini satu-satunya `getPublicUrl()` yang dipertahankan di
         aplikasi.

      Dua titik baca yang tidak ada di peta awal ditemukan saat pengerjaan:
      `features/school/queries.ts` dan `app/(public)/blog/[slug]/page.tsx` —
      keduanya punya kueri sendiri, bukan lewat kueri terpusat. Di
      `blog/[slug]` resolusinya **hanya** di cabang DB; cabang
      `artikelApiConfigured()` mengembalikan URL dari `cms.carubra.com`, bucket
      asing yang `toObjectPath` petakan ke `null`.

      Catatan jujur soal bucket publik: konversi ke object path di sana **tidak**
      memberi kerahasiaan apa pun (isinya memang publik). Yang didapat cuma dua:
      kolom DB berhenti menyimpan base URL yang bisa berubah, dan object path-nya
      tersedia untuk `storage.remove()` kalau penghapusan objek yatim dikerjakan.
- [x] B0.2c `apply-migration.js` diganti `scripts/migrate.mjs` +
      `schema_migrations` + penegakan checksum. Prasyarat, bukan item Batch 6:
      runner lama nama berkasnya di-hardcode ke `0004`, fallback ke
      `localhost:54322` sehingga env hilang **menarget database salah secara
      senyap**, dan keluar dengan **exit code 0 meski migrasi gagal**. Ini juga
      mekanisme yang membuat penyimpangan produksi terdeteksi ke depan
      (menggantikan B6.5).

      Terverifikasi: `node scripts/migrate.mjs --dry-run` keluar `0` dan
      mendaftar 40 berkas berurutan tanpa menyentuh database. `pg@^8.22.0`
      sudah ter-deklarasi, dan ketiga skrip npm (`migrate`, `migrate:status`,
      `migrate:apply`) terpasang — `migrate` sengaja dry-run, jadi
      penerapan ke DB harus diminta eksplisit.

      Dua hal di luar rencana yang ikut dibuat:

      1. Penanda `-- migrate:no-transaction` di baris awal berkas, untuk
         pernyataan yang tidak boleh jalan di dalam transaksi
         (`CREATE INDEX CONCURRENTLY`).
      2. `assertNoBackfilledGaps()`: celah nomor **di bawah** versi tertinggi
         yang sudah diterapkan menghentikan run. Tanpa ini, keadaan DB tidak bisa
         lagi disimpulkan dari nomor tertinggi — persis penyakit yang membuat
         penyimpangan produksi sekarang tak terlacak.

      Penomoran final berbeda dari plan, dan **urutannya yang penting**:
      `0029` aktifkan RLS → `0030a`–`0030f` policy per domain → `0031` cabut
      grant. Pencabutan sesudah policy, sesuai K-2.

### B0.3 Gerbang izin — menyentuh produksi

- [ ] B0.3a Jalankan `0028`–`0032a`, `0033` di staging lalu produksi, berurutan
- [ ] B0.3b **Backfill kolom storage. Menulis ulang baris produksi — risiko
      tertinggi di batch ini, butuh izin terpisah dan eksplisit.** Satu `UPDATE`
      per kolom memangkas prefix URL jadi object path
- [ ] B0.3c Verifikasi nol baris berawalan `http`, baru jalankan `0032b`
- [ ] B0.3d Jalankan `0034` terakhir; harus selesai tanpa `raise exception`
- [ ] B0.3e Ulangi probe kunci anon (read-only) sebagai bukti lubang tertutup

### Penyimpangan produksi (mengikat bentuk semua migrasi)

`attendances` (`0001:671`) dan `audit_logs` (`0001:686`) diperlakukan **identik**
di migrasi — keduanya RLS aktif, keduanya nol policy, yang di PostgreSQL berarti
menolak semua baris. Tapi probe menunjukkan anon membaca 959 baris dari
`attendances` dan **0** dari `audit_logs`. Berkas migrasi tidak bisa menjelaskan
ini: **DB produksi sudah menyimpang dari berkas migrasi.** Karena itu setiap
migrasi di atas ditulis idempoten dan tahan-penyimpangan — `enable row level
security` tanpa syarat, `drop policy if exists` dengan nama persis sebelum setiap
`create policy`, dan penjaga existence untuk setiap sapuan banyak-tabel.

---

## Batch 1 — Konsolidasi RBAC (`admin` = mentor)

- [x] B1.1 `mentor` & `admin_academy` dihapus dari `RoleCode`, `rolePriority`, `dashboardByRole` di `features/auth/roles.ts` (dikerjakan di B0.2a). Catatan TODO lama bahwa ini "tertahan sampai `0028` jalan" **tidak berlaku**: user lama tidak kehilangan pemetaan dashboard karena `getUserRoleCodes` menyaring kode legacy jadi array kosong, dan `requireRole` mengarahkannya ke `/dashboard/forbidden` — bukan ke halaman rusak. Yang memang masih tertahan sampai 0028 jalan adalah **kemampuan login mereka**: sampai assignment lama di-insert jadi `admin`, user yang cuma punya baris legacy akan kena 403. Itu asersi Tingkat-3 nomor 2
- [x] B1.2 Helper otorisasi terpusat di `features/auth/guards.ts` (`requireUser`, `requireRole`, `requireAdmin`, `requireSuperAdmin`, `requireIntern`, `requireSchool`, + varian `requireRoute*` untuk route handler)
- [x] B1.3 Entri `mentor` & `admin_academy` dihapus dari `roleLabelMap` & `sidebarItemsMap` (`features/auth/ProtectedDashboardLayout.tsx`). Array sidebar `admin_academy` ternyata **duplikat byte-identik** dari `admin`, dan `mentor: []` memang kosong — jadi tidak ada item navigasi yang hilang
- [x] B1.4 Halaman 403 `app/dashboard/forbidden` untuk user login-tapi-tak-berwenang
- [~] B1.5 Migrasi SQL `0028_consolidate_staff_roles.sql` — **sudah ditulis & ter-push, belum dijalankan** (lihat B0.1). Judul lama di TODO ini salah: berkasnya **tidak menghapus role apa pun**. `user_roles.role_id` adalah `ON DELETE CASCADE`, jadi `delete from roles` akan **menghapus senyap** seluruh riwayat assignment yang merujuknya — melanggar batasan tanpa-penghapusan. Yang dipakai: role `admin` di-insert (tidak pernah di-seed), assignment lama di-*insert* jadi `admin`, baris legacy dibiarkan utuh, dan kedua role lama ditandai `is_assignable = false`. Baris legacy jadi mati sendiri setelah B0.2a, karena `rolePriority` berfungsi sebagai allowlist yang menyaring kode di luar union
- [x] B1.6 Referensi string peran legacy diperbarui di `app/dashboard/profile/page.tsx` (badge disaring `isActiveRoleCode`), `features/lms/components/LessonComments.tsx` (`isMentorOrAdmin` + `getRoleBadge`; komponen ini terbukti **tidak pernah dirender** di repo — diperbaiki defensif saja), `features/lms/actions.ts`, `features/tasks/actions.ts`, `app/dashboard/intern/certificate/print/page.tsx`, `features/auth/guards.ts`, dan ketiga layout. `features/auth/edit-profile-action.ts` **tidak perlu diubah**: satu-satunya kemunculan "mentor" di sana adalah `getMentorProfileId` / `mentor_profiles`, yaitu identifier domain.

      Identifier domain `mentor_profiles`/`mentor_assignments`/`mentor_id`, href `/dashboard/mentor/*`, dan teks "pembimbing" **tidak diubah** sesuai Keputusan Kebijakan. Yang tersisa dan memang dibiarkan: `features/tasks/ChecklistItem.tsx:15` (`segments.includes("mentor")` — itu segmen URL, bukan peran), komentar di `features/auth/scope.ts:23` dan `app/dashboard/school/reports/generate/download/route.ts:24`, serta dua titik provisioning di B0.2a
- [x] B1.7 `0027_super_admin_role.sql` sudah ter-track (H-9). **Status penerapan ke DB produksi belum dikonfirmasi**

## Batch 2 — Tutup lubang otorisasi terbukti (C-2, C-3, C-4)

- [x] B2.1 Auto-insert `mentor_profiles` di `getMentorProfileId()` dihapus — eskalasi hak (C-2)
- [x] B2.2 Guard role + scope pada `app/dashboard/mentor/attendance/export/route.ts` (C-3)
- [x] B2.3 Netralkan CSV formula injection di kedua jalur ekspor (`lib/csv.ts`) (H-10)
- [x] B2.4 Otorisasi-sebelum-fetch di semua halaman super-admin
- [x] B2.5 `select("*")` diganti kolom eksplisit di halaman super-admin (C-4)

## Batch 3 — Otorisasi Server Actions (C-1, H-5, H-6)

- [~] B3.1 `features/attendance/actions.ts`: guard admin pada settings/permit/review + allowlist status + batas rentang tanggal — sumber ter-commit, belum diuji
- [~] B3.2 `features/daily-reports/actions.ts`: guard admin + cek ownership laporan (H-3) — sumber ter-commit, belum diuji
- [~] B3.3 `features/lms/actions.ts`: guard admin untuk semua mutasi staf (duplikat mati ikut dihapus) — sumber ter-commit, belum diuji
- [~] B3.4 `features/tasks/actions.ts`: predikat ownership/keanggotaan pada mutasi (H-5) — sumber ter-commit, belum diuji
- [~] B3.5 Pilihan status client disamakan dengan allowlist `reviewAttendanceAction` (H-6) — sumber ter-commit, belum diuji

## Batch 3b — Temuan tambahan selama remediasi (tidak ada di laporan awal)

- [x] B3b.1 **Guard peran dipasang di setiap page dashboard, bukan hanya di layout.** Di App Router layout dan page dirender bersamaan, jadi `redirect()` di layout tidak menghentikan fetch data page. 16 page (termasuk `/dashboard/admin/cms` & `/dashboard/admin/landing`) hanya memeriksa "ada sesi"
- [x] B3b.2 **Tulis data di jalur GET dihentikan.** `features/admin/queries.ts` dan `getInternProfileId()`/`getMentorProfileId()` dulu menyisipkan baris saat halaman dirender: tanpa proteksi CSRF, bisa dipicu prefetch, tanpa jejak audit
- [x] B3b.3 **Pembuatan profil jadi aksi eksplisit ber-audit.** `provisionDomainProfile()` dipanggil dari `assignUserRoleAction` & `createUserManualAction`; `detectMissingDomainProfiles()` (hanya baca) + `backfillDomainProfilesAction()` melengkapi kekurangan lama lewat UI super-admin
- [x] B3b.4 **Bacaan staf dibatasi ke scope bimbingan** (`resolveStaffInternScope`, batas penempatan aktif Asia/Jakarta): daily report, submission LMS, task board, monitoring. Sebelumnya bacaan lebih luas daripada guard aksinya
- [x] B3b.5 **Pendaftaran course ditegakkan di LMS peserta**: materi, kuis (termasuk kunci jawaban di kolom `questions`), dan tugas hanya terbaca oleh peserta yang terdaftar. `course_id` diambil dari baris sumber, bukan dari URL
- [x] B3b.6 **Course draft tidak lagi masuk payload halaman peserta** — penyaringan pindah dari render ke query (`getPublishedCourses`)
- [x] B3b.7 **IDOR cetak sertifikat ditutup** + pemalsuan sertifikat lewat action ID ditutup
- [x] B3b.8 **Generate laporan sekolah tidak lagi memutasi data saat render GET** — dipindah ke POST
- [x] B3b.9 **Validasi upload terpusat** di `lib/uploads.ts`, dipakai seluruh jalur upload

## Batch 4 — Lapisan data: storage, upload, XSS (C-6, C-7, H-4)

- [x] B4.1 **Sanitasi HTML (stored XSS)** — `lib/sanitize.ts` terpasang di **kedua** sink: `app/(public)/blog/[slug]/page.tsx:65` (body CMS) dan `features/lms/components/RichTextViewer.tsx:20` (materi LMS). Penulisnya staf, tapi staf bukan super-admin dan pembacanya publik/peserta (H-4).

      Tiga `dangerouslySetInnerHTML` sisa **bukan** sink XSS dan sengaja dibiarkan: dua blok `<style>` cetak (`certificate/print`, `daily-reports/print`) berisi CSS literal tanpa input user, dan `features/shared/AutoPrint.tsx` justru catatan bahwa `<script>`-nya sudah dihapus.
- [x] B4.2 Content-Security-Policy — `lib/security-headers.ts`, dipasang dari `proxy.ts` (Next.js 16 hanya mengizinkan salah satu antara `proxy.ts` dan `middleware.ts`). Nonce per-permintaan + `'strict-dynamic'`, jadi chunk Next tetap jalan **tanpa** `'unsafe-inline'` di `script-src`; `'unsafe-eval'` hanya di dev untuk react-refresh.

      CSP di sini adalah **lapis kedua di atas B4.1**, bukan penggantinya: sanitasi bisa terlewat kalau nanti ada sink `innerHTML` baru yang lupa memanggilnya, dan script tanpa nonce tetap tidak dieksekusi browser. Ikut dipasang: `nosniff`, `referrer-policy`, `frame-ancestors 'none'`, `object-src 'none'`, `permissions-policy`, dan HSTS (produksi saja — di dev aplikasi diakses lewat http).

      `img-src` sengaja longgar (`https:`): cover artikel CMS eksternal dari host lain. Ini juga sebabnya `next.config.ts` `remotePatterns` yang salah bukan penghalang — nol pemakaian `next/image` di repo.
- [x] B4.3 Validasi upload registrasi publik: MIME, ukuran, magic bytes, error generik (C-7). **Verifikasi per jalur selesai: 16 dari 16 titik unggah lewat `validateUpload()`**, dan tak satu pun mengunggah `File` mentah — semuanya mengunggah `.buffer` hasil validasi. Jalur selfie base64 punya `validateBase64Image()` sendiri yang **mengabaikan prefix `data:image/...` dari klien sepenuhnya** dan menentukan tipe dari hasil dekode.

      Yang membuat validasinya bukan sekadar kosmetik:

      - Tipe ditentukan dari **magic byte**, bukan dari `file.type` atau ekstensi nama — keduanya dikirim klien. `contentType` dan `ext` yang dipakai saat unggah adalah hasil deteksi server, jadi berkas yang menyamar sebagai gambar tidak bisa lolos.
      - Ukuran dicek **dua kali**: sekali dari `file.size` (murah, tapi asalnya klien) lalu sekali lagi dari `buffer.byteLength` setelah berkas benar-benar dibaca.
      - Batas ukuran diperiksa ulang **per jenis terdeteksi**, bukan cuma terhadap batas terbesar di antara `allowedKinds` — jadi titik yang menerima `["image","document"]` tidak ikut mewarisi batas dokumen untuk gambar.
      - Nama tampilan disanitasi (kontrol karakter + karakter path Windows dibuang, dipotong 120 karakter) dan punya fallback, jadi nama berkas tak pernah jadi vektor.

      Validasi ini **tetap diperlukan meski bucket-nya publik** — ia menahan berkas yang menyamar, terpisah dari soal siapa yang boleh membaca. Catatan itu sengaja ditulis di keempat titik CMS supaya tidak dibuang sebagai "tidak perlu, kan publik".
- [~] B4.4 Migrasi bucket privat + `file_size_limit` + `allowed_mime_types` + policy `storage.objects` (C-6). Ditulis sebagai `0032a`/`0032b` di B0.1. **Bucket masih publik sampai B0.3c dijalankan.** Cakupannya lebih luas dari dugaan awal: `avatars` adalah keranjang campur — avatar profil bersama CV, portofolio, selfie absensi, surat sakit, dan template sertifikat — jadi satu flag `public` tidak bisa memisahkan avatar dari surat sakit, dan seluruh bucket harus privat
- [~] B4.5 Signed URL untuk CV, selfie absensi, bukti laporan (C-6) — **sisi sumber selesai di B0.2b**, tapi belum berlaku sampai B0.3b/B0.3c dijalankan: baris lama masih menyimpan URL penuh dan bucketnya masih publik. Karena `avatars` jadi privat, **avatar profil pun butuh signed URL**, dan itu dirender di setiap halaman dashboard untuk setiap role — penandatanganannya ditaruh di `ProtectedDashboardLayout` (yang sudah membaca `avatar_path`), bukan per komponen.

      `toObjectPath()` sengaja menerima **dua bentuk sekaligus** (URL publik penuh
      dan object path) justru karena backfill B0.3b masih menunggu izin: satu
      kolom bisa memuat URL lama di baris lama dan object path di baris baru.

## Batch 5 — Integritas data (H-2, H-10, H-12, H-13, H-14, M-1, M-2, M-4, M-5, M-7)

- [x] B5.1 Pengiriman quiz diikat ke enrollment
- [~] B5.2 `certificate-helper` sesuai schema + jangan telan error; integritas sertifikat (H-12) — **kode selesai; `0035_fix_course_certificates.sql` ditulis, belum dijalankan**
  - **Temuannya lebih berat dari kalimat TODO-nya: insert sertifikat course tidak pernah berhasil sekali pun, sejak hari pertama.** Bukan "tidak sesuai schema" dalam arti rapuh — ia melanggar tiga hal sekaligus. `final_score` dan `notes` tidak ada di tabel `certificates` (dicek ke seluruh `supabase/`: `0021` cuma menambah `course_id` + `certificate_type`, tidak ada migrasi lain yang menyentuh tabel ini), dan `assessment_id` yang `not null` tidak pernah diisi.
  - **Yang membuatnya tak pernah terlihat justru komentarnya sendiri:** `console.error` diikuti `// Don't throw error, just log it`. Peserta menuntaskan seluruh course, `course_enrollments.completed_at` terisi, halaman menampilkan course selesai — dan sertifikatnya tidak ada. Tidak ada satu pun pesan gagal di antarmuka. Berapa banyak sertifikat yang hilang tidak bisa dihitung dari repo; angkanya cuma ada di log server.
  - `0021` sendiri tidak pernah bisa bekerja: ia menambah `course_id` untuk sertifikat course tapi membiarkan `assessment_id not null`, dan sertifikat course tidak punya assessment untuk ditunjuk.
  - **`0035` (ditulis, JANGAN dijalankan):** tambah `final_score` + `notes`, `assessment_id` jadi nullable, `certificate_type` jadi NOT NULL (`0021` memberinya DEFAULT saja, dan `NULL` lolos CHECK `IN (...)` — nilai yang lolos constraint tapi gagal setiap `.eq("certificate_type", …)` di aplikasi), constraint `certificates_assessment_or_course` yang menuntut **tepat satu** dari `assessment_id`/`course_id` sesuai tipenya, dan unique index parsial `(intern_id, course_id)`.
  - **Constraint itu bukan hiasan.** Melepas `not null` tanpa menggantinya mengizinkan baris tanpa `assessment_id` MAUPUN `course_id` — sertifikat yang tidak merujuk apa pun. Sengaja **tanpa `not valid`**: kalau ada baris produksi yang melanggar, migrasi harus gagal dan menampilkannya, bukan menerimanya diam-diam.
  - **Unique index parsialnya yang jadi jaminan asli.** Cek `maybeSingle()` di awal helper adalah optimasi, bukan penjaga: dua `markLessonCompleteAction` berbarengan bisa lolos berdua. Tabrakannya sekarang ditangani sebagai idempoten (`return`, bukan error), dibedakan dari tabrakan nomor sertifikat lewat nama constraint di pesan Postgres.
  - **Ruang nomor sertifikat sempit dan itu ditangani, bukan diabaikan:** `CERT/LMS/<tahun>/<4 digit>` = 9000 nilai per tahun, jadi pada ~120 sertifikat setahun peluang minimal satu tabrakan sudah di atas 50%. Format dipertahankan (nomor tercetak, dan jalur assessment memakai bentuk sama), tabrakan diundi ulang sampai 8 kali. `Math.random()` diganti `randomInt` dari `node:crypto` — nomor dokumen resmi tidak boleh bisa ditebak dari nomor sebelumnya.
  - **Dua kegagalan baca yang sebelumnya dibaca sebagai "belum ada sertifikat"** sekarang melempar: `existingError` yang didiamkan membuat insert jalan lalu ditolak unique index, dan penolakan itu diperlakukan sebagai sukses idempoten — kegagalan baca yang berakhir terlihat seperti keberhasilan. `"Unknown Course"` sebagai fallback judul juga dihapus: string itu tercetak apa adanya di badan sertifikat resmi.
  - **Bug ketiga, di berkas lain, yang baru jadi aktif JUSTRU karena perbaikan ini:** `getInternCertificate` (`features/assessments/queries.ts`) memakai `.maybeSingle()` tanpa menyaring jenis sertifikat. Selama insert course selalu gagal, satu peserta tidak mungkin punya dua baris. Begitu `0035` diterapkan dan helper-nya bekerja, peserta yang punya sertifikat penilaian **dan** sertifikat course membuat `maybeSingle()` melempar `PGRST116` — halaman sertifikat akhirnya menampilkan error, bukan sertifikatnya. Ditutup dengan `.not("assessment_id", "is", null)`; disaring lewat `assessment_id` (ada sejak `0001`) dan **bukan** `certificate_type` (baru ada sejak `0021`), karena filter PostgREST atas kolom yang belum ada di produksi menggagalkan seluruh kueri dan mematikan halaman itu total.
  - Helper sekarang MELEMPAR. Progres lesson sudah tersimpan sebelum titik ini, jadi lemparannya muncul sebagai pesan gagal sementara progresnya utuh — pola yang sama dengan jalur assessment di `features/assessments/actions.ts`.
  - Masih `[~]`: perbaikannya tidak berlaku sampai `0035` dijalankan (B0.3-gated), dan tanpa test framework (B6.7) tidak ada yang membuktikan jalur idempoten maupun undian ulang nomor.
- [~] B5.3 Migrasi perbaikan `check_and_award_badges` (`user_id` → `intern_id`) (H-13) — **`0036_fix_check_and_award_badges.sql` ditulis, belum dijalankan**
  - Bug yang dilaporkan terkonfirmasi: `0022:196` menanyakan `course_enrollments WHERE user_id = p_user_id`, padahal tabel itu (`0001:263-270`) tidak punya kolom `user_id` — kuncinya `intern_id`. Setiap pemanggilan kategori `course` berhenti dengan `42703`. plpgsql menyiapkan SQL saat dieksekusi, jadi `CREATE OR REPLACE` di `0022` sukses tanpa keluhan; kesalahannya baru muncul saat dipanggil, dan ia membatalkan seluruh pemanggilan bukan satu badge. `v_intern_id` sudah diambil di `0022:176` untuk cabang quiz — cabang course saja yang tidak memakainya.
  - **Urgensinya dicatat apa adanya: belum pernah meledak, karena tidak ada satu pun pemanggil.** Nol `.rpc("check_and_award_badges")`, nol `.rpc("award_points")`, nol trigger di `supabase/`. `user_badges`/`user_points`/`point_transactions` hanya DIBACA aplikasi (`features/lms/actions.ts:913,929`), tak pernah ditulis. Jadi akibat sebenarnya bukan error produksi, melainkan seluruh jalur tulis gamifikasi mati dan halaman badge selalu kosong untuk semua peserta. Diperbaiki supaya saat pemanggilnya dipasang, ia tidak membawa masuk empat bug sekaligus.
  - **Bug kedua: 3 dari 14 badge yang di-seed tidak punya cabang kriteria sama sekali.** `login_streak` ('Consistent Learner', 'Dedication') dan `assignment_excellence` ('Excellence') tidak pernah dievaluasi, jadi mustahil didapat siapa pun. Bukan kegagalan yang terlihat — cuma badge yang tak pernah menyala. Kedua cabang ditambahkan; datanya sudah ada di `user_streaks` dan `assignment_submissions.score`. `login_streak` dibaca dari `longest_streak_days`, bukan `current_streak_days`: badge adalah pencapaian dan tidak boleh tercabut saat streak putus. Kriterianya juga memakai kunci `days`, bukan `count` — menyalin `count` menghasilkan `NULL >= NULL` dan badge yang tetap mati.
  - **Bug ketiga: poin bisa dibayar dua kali untuk satu badge.** `0022:254-266` memakai `INSERT ... ON CONFLICT DO NOTHING` lalu memanggil `award_points` tanpa memeriksa apakah baris benar-benar masuk. Penjaga `IF EXISTS ... CONTINUE` tidak menutupnya: dua pemanggilan berbarengan lolos berdua, insert kedua jadi no-op, poin tetap ditambah — dua baris `point_transactions` yang keduanya terlihat sah. Sekarang `GET DIAGNOSTICS ... ROW_COUNT` jadi syarat.
  - **Bug keempat: `RETURNING ... INTO` di `award_points` rapuh.** Bukan salah hari ini (`DO UPDATE` selalu mengembalikan baris), tapi begitu ada yang mengubahnya jadi `DO NOTHING`, `v_new_total` jadi NULL dan UPDATE berikutnya menimpa `level` dengan NULL tanpa satu pun error. Diganti membaca nilai tersimpan.
  - **Jebakan yang nyaris terlewat: `CREATE OR REPLACE FUNCTION` MENGHAPUS `proconfig`.** `0033` memaku `search_path` pada setiap fungsi di schema lewat `ALTER FUNCTION ... SET`. Mengganti fungsi tanpa menyebut klausa `SET` akan mencabut pengencangan itu secara senyap — fungsi kembali me-resolve nama tabel lewat search_path pemanggil, persis lubang yang `0033` tutup. `set search_path = utero_academy, public, pg_temp` ditulis eksplisit di kedua fungsi. **Aturan ini berlaku untuk setiap migrasi setelah `0033` yang memakai `CREATE OR REPLACE FUNCTION`.**
  - Tipe kriteria tak dikenal sekarang `raise notice` alih-alih didiamkan — `notice`, bukan `exception`, supaya satu badge rusak tidak menggagalkan pemberian badge lain.
  - **Dibiarkan dan dicatat, bukan diperbaiki:** `user_points.points_this_month`/`points_this_week` hanya pernah ditambah, tidak pernah direset, dan tidak ada job terjadwal di repo ini yang meresetnya — keduanya sebenarnya total sepanjang waktu dengan nama menyesatkan. Perbaikannya keputusan produk (reset terjadwal vs hitung dari `point_transactions.created_at`), bukan keputusan migrasi.
- [x] B5.4 Generate laporan sekolah idempoten + tidak memutasi saat render GET (H-10)
- [x] B5.5 Paginasi `listUsers` pada deteksi orphan (H-14)
  - **Temuannya lebih berat dari kalimat TODO-nya.** "User ke-1001 tak pernah terperiksa" membacanya sebagai laporan yang kurang lengkap. Kenyataannya set id yang terpotong itu dipakai `cleanupOrphanDataAction` untuk **MENGHAPUS permanen** baris `school_contacts`. Satu user yang cuma tidak terambil cukup untuk membuat kontaknya dihapus — dan penghapusannya tercatat di audit log sebagai pembersihan yang berhasil, jadi tidak ada jejak bahwa itu salah.
  - **Tiga titik pemanggil, bukan satu:** `getSuperAdminUserManagementData`, `detectOrphanData` (`features/super-admin/queries.ts`), dan `cleanupOrphanDataAction` (`features/super-admin/actions.ts`).
  - `lib/auth-admin.ts` baru: `listAllAuthUsers()` menyusuri semua halaman, dedup per id, dan **MELEMPAR** kalau daftarnya tidak bisa dijamin lengkap. Sengaja tidak mengembalikan hasil separuh: pemanggil tidak punya cara membedakan "user ini tidak ada" dari "user ini tidak terambil", dan keduanya berakhir pada keputusan hapus yang sama.
  - **`data.nextPage` tidak bisa dipakai — parser `auth-js` rusak, dan ini diverifikasi empiris.** `parseInt(link.split(';')[0].split('=')[1].substring(0, 1))` cuma mengambil SATU karakter nomor halaman: pada `@supabase/auth-js` yang terpasang, `page=10` terparse jadi `1`. Mengikuti `nextPage` akan melompat balik ke halaman 1 begitu mencapai halaman 10 — loop tanpa akhir atas data yang sama. Penomoran halaman dikerjakan manual.
  - **Berhenti pada halaman KOSONG, bukan halaman pendek.** Cek "lebih pendek dari yang diminta berarti habis" terlihat benar tapi punya mode gagal yang persis sama dengan bug aslinya: kalau server memotong `per_page` jadi 100, SETIAP halaman lebih pendek dari 200 dan loop berhenti setelah halaman pertama. Ini kekeliruan yang sempat masuk draf pertama dan dicabut sebelum di-commit.
  - **Bug kedua, kelas berbeda, di berkas yang sama:** `detectOrphanData` dan `detectMissingDomainProfiles` menghitung temuan dari kueri yang mungkin gagal, lalu mengembalikan error **berdampingan** dengan temuannya. `allSchools.error` yang lolos menghasilkan `schoolIds` kosong, dan dengan set kosong itu SETIAP kontak sekolah memenuhi syarat yatim. Halaman pemanggil merender banner error dan daftar orphan secara terpisah, jadi hasilnya adalah "⚠ Ditemukan 25 Data Orphan" berikut tombol hapusnya, bersanding dengan peringatan koneksi yang mudah dibaca sebagai keluhan kosmetik. Ditutup di lapisan kueri (kembali lebih awal dengan nol temuan), bukan di UI.
  - `cleanupOrphanDataAction` ikut mendapat penjaga keras: kueri pembanding yang gagal **membatalkan pembersihan** dengan `throw`, bukan jatuh ke `|| []`. Kegagalan baca harus menghentikan penghapusan, bukan memperluasnya.
- [x] B5.6 `getLateMinutes()` memakai timezone runtime, bukan `Asia/Jakarta` — telat/tidaknya absensi bisa berubah tergantung host
  - **Bug ini laten, bukan aktif — dicatat apa adanya.** `TZ=Asia/Jakarta` sudah diset di `Dockerfile:17` dan `docker-compose.yml:23`, jadi hitungan telat di produksi saat ini benar. Tetap diperbaiki karena `TZ` yang hilang atau salah tidak melempar error apa pun: ia hanya menggeser angka telat ke nilai yang tetap terlihat wajar. `npm run dev`/`build` juga tidak memuat docker-compose, dan CI/cron belum tentu mewarisi `TZ`.
  - `lib/time.ts` baru: `jakartaDateString()`, `jakartaMinutesOfDay()`, `parseWallClockMinutes()`. `TZ` dipertahankan sebagai lapis kedua (log yang terbaca), bukan sumber kebenaran.
  - **`hourCycle: "h23"` wajib, dan ini diverifikasi empiris, bukan diasumsikan.** Tanpa opsi itu `Intl.DateTimeFormat("en-CA", …)` memakai siklus 12 jam: 00:30 Jakarta terformat `"12:30 a.m."`, jadi `Number(hourPart)` = 12 dan menitnya jadi 750 alih-alih 30 — salah 12 jam, senyap.
  - **`formatToParts` MELEMPAR `RangeError` untuk `Date` invalid** (diverifikasi), bukan mengembalikan bagian bernilai "NaN". Tanpa penjaga `Number.isNaN(getTime())`, satu timestamp rusak akan menggagalkan seluruh render halaman atau unduhan CSV, bukan satu baris.
  - **Bug kedua yang ketemu sambil jalan: tidak ada peserta yang pernah terhitung telat.** `check_in_time` diparse dengan `split(":").map(Number)` di dua titik; isi kolom yang rusak menghasilkan `NaN`, dan setiap perbandingan telat terhadap `NaN` bernilai false — jumlah telat terbaca nol tanpa satu pun error muncul. Sekarang lewat `parseWallClockMinutes()` dengan default 08:00 yang eksplisit.
  - 4 salinan helper tanggal Jakarta dikonsolidasi ke `jakartaDateString()` (`features/attendance/actions.ts`, `features/attendance/queries.ts`, `features/auth/scope.ts`, `app/dashboard/mentor/attendance/page.tsx`).
- [x] B5.7 Koordinat/radius geofence default di-hardcode di `features/attendance/actions.ts` (`-7.9671`/`112.6375`); `||` → `??`; tangani update nol baris (M-1, M-2)
  - **Tiga bug berbeda, bukan satu.** (1) Koordinat Malang sebagai fallback `||` berarti kolom `null` **memindahkan** geofence, bukan menonaktifkannya — setiap peserta dinilai di luar radius lalu dipaksa mengunggah alasan + bukti. (2) `radius_meters || 100` menimpa radius `0` yang sah ("tepat di kantor"). (3) Baris settings yang hilang tidak bisa dibedakan dari geofence yang sengaja dimatikan.
  - `resolveGeofence()` mengembalikan union `disabled | misconfigured | active`. `misconfigured` **menolak** absensi, bukan melewati pemeriksaan: melewatinya berarti geofence mati tanpa terlihat dan bisa mati berbulan-bulan. `Number.isFinite`, bukan cuma cek null — `double precision` Postgres bisa mengembalikan `NaN`, dan `NaN` lolos setiap perbandingan jarak sebagai false.
  - `attendanceSettingsSchema` baru memvalidasi tulis: koordinat nullable, `radiusMeters` int ≥ 0, dan `.refine()` memblokir "geofencing aktif tapi koordinat kosong" di titik tulis.
  - **`toOptionalNumber`, bukan `parseFloat`** — diverifikasi: `parseFloat("12abc")` = `12` (memotong sampah, menyimpan koordinat salah ketik sebagai angka yang terlihat sah), sedangkan `Number("")` = `0` bukan `NaN`, jadi isian kosong harus dipetakan ke `null` lebih dulu — kalau tidak, mengosongkan latitude menyimpan `0,0` (Teluk Guinea).
  - **M-2 ditutup:** upsert yang tidak mengenai satu baris pun mengembalikan `error: null`, jadi RLS yang menolak tulis tampil ke admin sebagai penyimpanan berhasil. Sekarang `.select("id")` + pemeriksaan nol baris.
  - **Prefill Malang di form ikut dihapus** (`app/dashboard/mentor/attendance/page.tsx`) — tanpa itu, lubang `||` yang baru dicabut dari action masuk kembali lewat UI: admin melihat kotak terisi, menyimpan, dan geofence terpasang di Malang tanpa pernah dipilih. `required` ikut dilepas karena kolomnya nullable; batas rentang ditegakkan di schema, bukan di atribut HTML.
  - UUID `attendance_settings` yang diduplikasi di **tujuh** tempat dikonsolidasi ke `ATTENDANCE_SETTINGS_ID`. Salah ketik di sana menghasilkan `maybeSingle()` = null, yang tidak melempar error — ia hanya berarti "pakai default", jadi salah ketiknya muncul sebagai geofence mati atau jam kerja berubah, bukan sebagai kegagalan.
- [x] B5.8 Cleanup MediaStream saat unmount `LiveCameraInput` (M-4) — `features/attendance/LiveCameraInput.tsx`
  - **Lubang aslinya:** komponen hanya mengimpor `useRef, useState`. Tidak ada `useEffect` sama sekali, jadi tidak ada satu pun jalur yang menghentikan track video saat komponen dilepas. Berpindah halaman selagi kamera aktif meninggalkan lampu kamera menyala dan perangkat terpakai sampai tab ditutup. `<LiveCameraInput />` dirender tanpa syarat di `CheckInForm.tsx:77` dan `CheckOutForm.tsx:36`, jadi setiap peserta yang membuka form absensi lalu pergi tanpa mengambil foto meninggalkan satu stream hidup.
  - **Kenapa `useEffect` + state `stream` TIDAK cukup** (jebakan utama item ini): cleanup unmount harus jalan tepat sekali, artinya dependensinya `[]` — dan closure berdependensi kosong membekukan `stream` pada nilai render pertama, yaitu `null`. Versi "benar" yang memakai state akan memanggil `stop()` pada null dan kamera **tetap menyala**, tanpa error apa pun. Stream karena itu dipindah ke `streamRef`, dan hanya ada satu fungsi (`stopStream`) yang menghentikan track.
  - **Izin yang datang setelah unmount** ditangani lewat `mountedRef`. `getUserMedia` di-await: peserta bisa menekan tombol kamera lalu berpindah halaman sebelum menekan "Izinkan". Stream-nya tetap tiba — SETELAH unmount — jadi tidak ada cleanup effect yang bisa menjangkaunya. Track-nya dihentikan langsung di jalur itu.
  - **Klik ganda** dijaga `if (starting || streamRef.current) return`. Tanpa itu dua ketukan cepat menjalankan dua `getUserMedia`; yang kedua menimpa ref dan yang pertama tidak pernah dihentikan siapa pun — kebocoran yang persis sama, lewat pintu lain.
  - **`srcObject` dipindah ke effect.** Sebelumnya dipasang di dalam `startCamera` dengan penjaga `if (videoRef.current)`, padahal elemen `<video>` hanya dirender ketika `cameraActive` true — render itu belum terjadi saat `startCamera` menetapkannya. Penugasan yang terlewat muncul sebagai kotak hitam tanpa satu pun error.
  - **Bug sampingan yang ikut ditutup:** `takePhoto` jatuh ke `640 x 480` saat `video.videoWidth` masih 0, dan `drawImage` dari video yang belum punya frame menghasilkan kanvas KOSONG. Hasilnya selfie hitam yang tersimpan sebagai bukti absensi tanpa peringatan apa pun. Sekarang menolak dan meminta tangkap ulang.
  - Gate: `tsc` 0, `eslint --quiet` 0, `npm run build` 0.
- [ ] B5.9 Perbaiki `\n` literal + `iconMap` `BookOpen` (M-5, M-7)
- [ ] B5.9 Perbaiki `\n` literal + `iconMap` `BookOpen` (M-5, M-7)

## Batch 6 — Release engineering & CI (C-9, H-7, H-8, M-14, M-16)

- [x] B6.1 Satu lockfile + `packageManager` konsisten (C-9). **Bagian `recharts` usang** — sudah dideklarasikan di `package.json`
  - **Temuan yang lebih berat dari isi item ini: tidak ada lockfile yang ter-commit sama sekali.** `package-lock.json` ada di `.gitignore:23`. Artinya `npm ci` di Dockerfile membangun dari berkas yang tidak pernah ikut ke repo: versi dependensi ditentukan oleh **kapan image dibangun**, bukan oleh isi commit. Dua build dari commit yang sama bisa memasang versi berbeda — termasuk versi yang baru terkompromi. Baris ignore-nya dihapus dan lockfile-nya di-commit.
  - **npm, bukan pnpm — diputuskan dari bukti, bukan preferensi.** `node_modules` yang hidup cocok dengan `package-lock.json` (next 16.2.9 / react 19.2.7), **tidak** dengan `pnpm-lock.yaml` (16.2.11 / 19.2.8), dan `Dockerfile` memakai `npm ci`. Jadi `pnpm-lock.yaml` + `pnpm-workspace.yaml` (keduanya belum ter-track) dihapus. Dua lockfile yang tidak sinkron lebih buruk daripada satu: keduanya mengklaim jadi sumber kebenaran, dan yang dipakai produksi bukan yang dibaca orang.
  - `"packageManager": "npm@11.19.0"` — versi yang dibundel Node 24.20.0, jadi cocok dengan base image Dockerfile (B6.2). `"engines": { "node": ">=24.0.0" }` tanpa batas atas: memblokir Node 25 akan mematahkan CI di masa depan tanpa alasan keamanan apa pun.
  - `.npmrc` baru: `engine-strict=true` (tanpa itu `engines` cuma peringatan yang dicetak lalu diabaikan) dan `ignore-scripts=true` (skrip `postinstall` paket pihak ketiga adalah jalur eksekusi kode arbitrer saat install — jalur yang dipakai hampir setiap serangan rantai pasok npm). Terverifikasi aman: dari 238 entri lockfile hanya **satu** punya install script (`sharp`, dan itu `optional`); `sharp` dipasang dari binary prebuilt `@img/*`, dan repo ini **nol memakai `next/image`** jadi sharp tidak di jalur render mana pun. `engine-strict` juga aman: dari 110 paket yang mendeklarasikan `engines.node`, nol menolak Node 24.
  - `.npmrc` ikut di-`COPY` di kedua stage install Dockerfile. Tanpa itu, `npm ci` di dalam image berjalan dengan default — yaitu **menjalankan** skrip postinstall, tepat yang ingin ditutup.
  - `@types/sanitize-html` dipindah `dependencies` → `devDependencies` (paket `@types/*` tidak ada di runtime). `htmlparser2` **tidak** ditandai dev karena `sanitize-html` yang runtime juga memakainya — menandainya dev akan membuangnya dari image produksi dan mematahkan sanitasi HTML, yaitu mitigasi XSS B4.1.
  - Terverifikasi: `tsc --noEmit` EXIT=0, `npm run build` EXIT=0 (`/api/health` ikut terkompilasi), `npm ci` EXIT=0.
- [x] B6.2 Perbaiki Dockerfile: base image dipin, prune dev deps (C-9)
  - **Temuan yang lebih berat dari isi item ini: base image-nya EOL.** `node:20-alpine` — Node 20 berakhir **2026-04-30** (jadwal resmi `nodejs/Release/schedule.json`), yaitu **lima bulan sebelum hari ini**. Image itu sudah tidak menerima perbaikan keamanan sama sekali. Ini eksposur hidup, bukan kebersihan repo.
  - Dipin ke `node:24.20.0-alpine3.24@sha256:e67514e5...` — tag **dan** digest. Tag sendiri bergerak: isi image bisa berubah antar-build tanpa terlihat di diff. Node 24 LTS aktif sampai **2028-04-30**, dan `next@16` hanya mensyaratkan `node >= 20.9.0`, jadi kenaikannya tidak terhalang apa pun.
  - Prune lewat **stage `prod-deps` terpisah** (`npm ci --omit=dev`), bukan `npm prune --production` di runner. `prune` membuang dari `node_modules` yang sudah ada sehingga hasilnya bergantung keadaan sebelumnya; `npm ci` membangun dari lockfile sehingga hasilnya sama setiap kali.
  - **Kenapa prune aman padahal `next.config.ts` berkas TypeScript:** terverifikasi dari sumber `next@16.2.9` — `next/dist/server/config.js:47` memanggil `../build/next-config-ts/transpile-config`, yang memakai SWC bawaan Next (`loadBindings`, `syntax: 'typescript'`) atau type-stripping native Node. Daftar dependensi `next` **tidak memuat `typescript`** sama sekali. Jadi `typescript` boleh ikut terbuang tanpa mematahkan `next start`.
  - `COPY package.json package-lock.json` — bintang pada `package-lock.json*` dihapus. Dengan bintang, lockfile yang hilang tidak menggagalkan `COPY`; kegagalannya baru muncul di `npm ci` sebagai error yang tidak menunjuk ke penyebabnya.
- [x] B6.3 Hapus publish port `3000:3000` di `docker-compose.yml:10`; healthcheck (H-7). **Bagian TLS sudah terjawab**: `nginx.conf:45` memakai `$http_cf_connecting_ip`, jadi Cloudflare ada di depan dan menerminasi TLS — sisa pekerjaannya hanya menutup port yang terpublikasi
  - `ports: ["3000:3000"]` → `expose: ["3000"]`. nginx tetap menjangkau service lewat `utero_network` dengan hostname `web` (`proxy_pass http://web:3000`); jaringan Docker internal tidak butuh port yang dipublikasikan ke host.
  - **Yang dilewati pintu samping itu lebih dari TLS.** `nginx.conf:45` menetapkan `X-Real-IP` dari `$http_cf_connecting_ip` — header yang hanya ada kalau permintaan benar-benar lewat Cloudflare. Permintaan yang masuk langsung ke port 3000 karena itu tidak punya IP asli yang benar **sama sekali**, bukan cuma tanpa enkripsi.
  - Healthcheck dijalankan dengan `node -e` + `fetch`, bukan curl/wget: image runner-nya alpine tanpa keduanya, dan menambah paket hanya untuk healthcheck memperbesar permukaan image. `start_period: 40s` supaya boot Next.js tidak dianggap mati.
  - nginx dipin `nginx:alpine` → `nginx:1.27-alpine`, dan `depends_on` dinaikkan ke `condition: service_healthy`. `depends_on: [web]` saja hanya menunggu container **dibuat**, bukan menunggu aplikasinya siap — jadi nginx bisa mulai menyalurkan trafik ke proses yang masih boot.
  - `version: '3.8'` dihapus (usang di Compose v2, memicu peringatan).
  - Terverifikasi `docker compose config` → `EXIT=0`.
- [x] B6.4 Endpoint `/api/health` (M-16)
  - `app/api/health/route.ts`. **Sengaja tidak menyentuh database, Supabase, atau layanan luar apa pun.** Healthcheck Docker menentukan keputusan restart: kalau endpoint ini ikut memanggil database, satu gangguan sesaat di database membuat Docker me-restart aplikasi yang sehat — dan restart tidak memperbaiki database, jadi yang didapat cuma loop restart tepat saat gangguan. Yang dibuktikan endpoint ini cuma satu: proses Next.js hidup dan bisa melayani permintaan.
  - **Ditegakkan secara struktural, bukan cuma lewat niat**: `api/health` dikecualikan dari matcher `proxy.ts`. `updateSession()` memanggil `supabase.auth.getUser()` (`lib/supabase/middleware.ts:71`) untuk setiap path yang cocok, jadi tanpa pengecualian ini independensi dari Supabase-nya palsu.
  - Responsnya `{ status: "ok" }` saja — **tanpa versi, commit, hostname, atau isi environment.** Endpoint ini tak terautentikasi dan terekspos ke internet lewat nginx; versi paket adalah informasi yang memudahkan pemilihan exploit.
  - `dynamic = "force-dynamic"` + `cache-control: no-store` — respons ter-cache akan melaporkan "sehat" dari container yang sudah mati.
  - Karena dikecualikan dari matcher, header keamanan dipasang sendiri di route ini lewat `applySecurityHeaders` — pengecualian matcher tidak boleh sekalian jadi pengecualian header.
- [ ] B6.5 Ganti `apply-migration.js` dengan runner berurutan yang gagal-keras (M-14) — **dipindah ke B0.2c sebagai prasyarat**, bukan lagi item Batch 6: tanpa runner yang gagal-keras, menerapkan migrasi B0.1 ke produksi tidak aman
- [x] B6.6 Script `lint` + CI: install → lint → typecheck → build → test (H-8)
  - **`next lint` sudah dihapus di Next.js 16** — tidak ada `next-lint.js` di `node_modules/next/dist/cli/`. Jadi tidak ada linter apa pun yang bisa dijalankan di repo ini sebelum ini; eslint dipasang sebagai devDependency dan dipanggil langsung.
  - **eslint dipin ke `^9`, bukan 10.** `eslint-plugin-react` yang dibundel `eslint-config-next@16.3.6` belum mendukung eslint 10: hasilnya `TypeError: contextOrFilename.getFilename is not a function` saat memuat rule `react/display-name`, yaitu lint **gagal jalan sama sekali**. Alasannya dicatat di `eslint.config.mjs` supaya tidak "diperbaiki" balik.
  - Flat config tanpa `FlatCompat` — `eslint-config-next@16` sudah mengekspor array flat config asli.
  - **Dua tingkat keparahan.** Basis `eslint-config-next` sendiri menghasilkan **157 error** di hari pertama; gate yang merah sejak commit pertama akan dimatikan orang. Jadi hanya aturan keamanan/kebenaran yang jadi `error` (`react-hooks/rules-of-hooks`, `react/jsx-no-target-blank`), sisanya `warn` — **tidak ada yang di-`off`**, supaya hitungannya tetap terlihat dan bisa diturunkan bertahap.
  - **Lint langsung menemukan 2 kerentanan nyata:** `app/dashboard/school/reports/page.tsx:64,105` punya `target="_blank"` dengan `rel="noopener"` tapi **tanpa `noreferrer`** — dan href-nya signed URL yang membawa token akses di query string, jadi token itu terkirim ke situs tujuan lewat header `Referer`. Enam titik `target="_blank"` lain disapu dan aman.
  - 4 error sisanya diperbaiki setelah dibaca satu per satu, bukan lewat `--fix`: `prefer-const` di `features/attendance/actions.ts` sempat terlihat berbahaya karena `current` ada di dalam `while`, tapi `setDate()` **memutasi objek Date**, bukan menugaskan ulang variabel — jadi `const` benar. `require()` di `features/daily-reports/actions.ts` dinaikkan jadi import statis setelah dipastikan `lib/notification.ts` tidak punya efek samping di level modul.
  - Hasil akhir: **0 error**, 253 warning. `npm run lint:ci` (`--quiet`) EXIT=0.
  - `.github/workflows/ci.yml` baru (sebelumnya repo **tidak punya CI sama sekali**): `npm ci` → `lint:ci` → `lint` (laporan) → `typecheck` → `build` → `npm audit` (laporan). Env Supabase di langkah build **sengaja placeholder palsu dan hardcoded**, bukan GitHub Secrets — build tidak pernah menghubungi Supabase, jadi menaruh kunci asli di CI hanya memperluas permukaan kebocoran.
  - Langkah `test` **belum ada dan itu disengaja** — lihat B6.7; `npm test` yang pasti gagal akan membuat gate ini dimatikan.
  - Tiga skrip mati di root dihapus: `test-schema.js`, `test-revisi-error.js`, dan **`_fix_admin_queries_to_srv.js`** — codemod yang plan sebut sebagai akar masalah lubang RLS. Dipastikan sudah teraplikasi ke `features/admin/queries.ts` sebelum dihapus.
  - Verifikasi: `tsc --noEmit` EXIT=0, `npm run build` EXIT=0.
- [ ] B6.7 **Tidak ada test framework sama sekali** (`package.json` hanya `dev`/`build`/`start`/`typecheck`). Matriks test otorisasi per role × action/route (H-8) — ini yang membuat semua `[~]` di atas tidak bisa naik jadi `[x]`

## Batch 7 — Aksesibilitas

- [ ] B7.1 Remediasi temuan `.audit-accessibility.txt`

---

## Butuh Tindakan Kamu (tidak bisa aku kerjakan)

- [ ] **Rotasi kredensial** yang terdeteksi (C-8) — hanya kamu yang punya akses ke penerbitnya.
      Rotasi harus lewat proses produksi yang berwenang; nilai rahasianya tidak akan aku tampilkan
      atau salin ke mana pun. Catatan: `.env` **tidak pernah ter-commit** (dikonfirmasi via
      `git log --all`) dan dikecualikan `.dockerignore` — rotasi tetap perlu, tapi bukan karena
      kebocoran repo
- [ ] **Inventaris read-only produksi (Q1–Q13). GERBANG KERAS** — semuanya `SELECT`, aman
      dijalankan di produksi, tapi harus sebagai `postgres` (membaca katalog), bukan kunci anon.
      Menentukan: apakah `0027` benar-benar terpasang & batas `--baseline` runner (Q1), daftar
      tabel persis (Q2), signature fungsi untuk `0033` (Q3), **nama policy persis untuk setiap
      `drop policy if exists`** (Q4), cakupan revoke (Q5), **role mana yang wajib menjalankan
      `0031`** (Q6 — `alter default privileges ... revoke` hanya berlaku untuk default milik role
      yang menjalankannya, jadi salah koneksi = no-op senyap), grant `attendance_settings`/
      `landing_page_settings` (Q7), bucket & policy storage (Q8–Q10), premis `on conflict` (Q11),
      tabel migrasi yang sudah ada (Q12), reloptions view (Q13)
- [ ] Konfirmasi apakah `0027` sudah diterapkan ke DB produksi (bagian Q1)
- [ ] Konfirmasi package manager yang dipakai di produksi (npm vs pnpm) untuk B6.1
- [ ] **Izin eksplisit untuk B0.3** — tidak satu pun migrasi B0.1 akan aku jalankan tanpa itu.
      Yang paling butuh izin terpisah: backfill kolom storage (B0.3b), karena ia **menulis ulang
      baris produksi**
