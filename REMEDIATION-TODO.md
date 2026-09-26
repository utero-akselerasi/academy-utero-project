# Remediation Progress — Audit Produksi 2026-09-26

Status: `[ ]` belum · `[~]` jalan / sumber sudah di-commit tapi belum diuji · `[x]` selesai & ter-push

Catatan penting: `[x]` berarti **sumber sudah ter-commit dan `tsc` bersih**, BUKAN berarti sudah
terverifikasi di produksi. Repo ini belum punya test runner, jadi tidak ada satu pun perilaku guard
yang terbukti lewat test otomatis. Item yang butuh migrasi DB tetap `[ ]` sampai migrasinya benar-benar
diterapkan.

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

## Batch 1 — Konsolidasi RBAC (`admin` = mentor)

- [ ] B1.1 Hapus `mentor` & `admin_academy` dari `RoleCode`, `rolePriority`, `dashboardByRole` di `features/auth/roles.ts` — **tertahan sampai migrasi `0028` jalan**, kalau tipe dihapus lebih dulu user lama kehilangan pemetaan dashboard
- [x] B1.2 Helper otorisasi terpusat di `features/auth/guards.ts` (`requireUser`, `requireRole`, `requireAdmin`, `requireSuperAdmin`, `requireIntern`, `requireSchool`, + varian `requireRoute*` untuk route handler)
- [ ] B1.3 Hapus entri `mentor` di `roleLabelMap` & `sidebarItemsMap` (`features/auth/ProtectedDashboardLayout.tsx`) — ikut B1.1
- [x] B1.4 Halaman 403 `app/dashboard/forbidden` untuk user login-tapi-tak-berwenang
- [ ] B1.5 Migrasi SQL `0028_remove_legacy_staff_roles.sql`: pindahkan assignment `mentor` & `admin_academy` → `admin`, lalu hapus kedua role. **Belum ditulis.** Butuh inventaris read-only produksi lebih dulu (lihat bagian bawah)
- [ ] B1.6 Perbarui referensi string `"mentor"` / `"admin_academy"` di `app/dashboard/profile/page.tsx`, `features/auth/edit-profile-action.ts`, `features/lms/components/LessonComments.tsx` — ikut B1.1
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

- [ ] B4.1 **Sanitasi HTML (stored XSS)** — masih terbuka. Dua sink: `app/(public)/blog/[slug]/page.tsx:50` (`dangerouslySetInnerHTML` atas body CMS) dan `features/lms/components/RichTextViewer.tsx:12` (materi LMS). Penulisnya staf, tapi staf bukan super-admin dan pembacanya publik/peserta (H-4)
- [ ] B4.2 Content-Security-Policy belum ada sama sekali
- [~] B4.3 Validasi upload registrasi publik: MIME, ukuran, magic bytes, error generik (C-7) — `lib/uploads.ts` ter-commit, perlu verifikasi magic-bytes per jalur
- [ ] B4.4 Migrasi bucket privat + `file_size_limit` + `allowed_mime_types` + policy ber-scope path (C-6). **Bucket masih publik**
- [ ] B4.5 Signed URL untuk CV, selfie absensi, bukti laporan (C-6) — bergantung B4.4

## Batch 5 — Integritas data (H-2, H-10, H-12, H-13, H-14, M-1, M-2, M-4, M-5, M-7)

- [x] B5.1 Pengiriman quiz diikat ke enrollment
- [ ] B5.2 `certificate-helper` sesuai schema + jangan telan error; integritas sertifikat (H-12)
- [ ] B5.3 Migrasi perbaikan `check_and_award_badges` (`user_id` → `intern_id`) (H-13)
- [x] B5.4 Generate laporan sekolah idempoten + tidak memutasi saat render GET (H-10)
- [ ] B5.5 Paginasi `listUsers` pada deteksi orphan (H-14) — masih `perPage: 1000`, user ke-1001 tak pernah terperiksa
- [ ] B5.6 `getLateMinutes()` memakai timezone runtime, bukan `Asia/Jakarta` — telat/tidaknya absensi bisa berubah tergantung host
- [ ] B5.7 Koordinat/radius geofence default di-hardcode di `features/attendance/actions.ts` (`-7.9671`/`112.6375`); `||` → `??`; tangani update nol baris (M-1, M-2)
- [ ] B5.8 Cleanup MediaStream saat unmount `LiveCameraInput` (M-4)
- [ ] B5.9 Perbaiki `\n` literal + `iconMap` `BookOpen` (M-5, M-7)

## Batch 6 — Release engineering & CI (C-9, H-7, H-8, M-14, M-16)

- [ ] B6.1 Satu lockfile + `packageManager` konsisten; deklarasikan `recharts` (C-9). Saat ini ada `pnpm-lock.yaml` & `pnpm-workspace.yaml` belum ter-track
- [ ] B6.2 Perbaiki Dockerfile: base image dipin, prune dev deps (C-9)
- [ ] B6.3 TLS + HSTS di nginx; hapus publish port 3000; healthcheck (H-7)
- [ ] B6.4 Endpoint `/api/health` (M-16)
- [ ] B6.5 Ganti `apply-migration.js` dengan runner berurutan yang gagal-keras (M-14)
- [ ] B6.6 Script `lint` + CI: install → lint → typecheck → build → test (H-8)
- [ ] B6.7 **Tidak ada test framework sama sekali** (`package.json` hanya `dev`/`build`/`start`/`typecheck`). Matriks test otorisasi per role × action/route (H-8) — ini yang membuat semua `[~]` di atas tidak bisa naik jadi `[x]`

## Batch 7 — Aksesibilitas

- [ ] B7.1 Remediasi temuan `.audit-accessibility.txt`

---

## Butuh Tindakan Kamu (tidak bisa aku kerjakan)

- [ ] **Rotasi kredensial** yang terdeteksi (C-8) — hanya kamu yang punya akses ke penerbitnya.
      Rotasi harus lewat proses produksi yang berwenang; nilai rahasianya tidak akan aku tampilkan
      atau salin ke mana pun
- [ ] Jalankan query verifikasi **read-only** §8 laporan audit pada DB produksi, lalu kirim hasilnya —
      menentukan isi migrasi `0028` (B1.5) dan semua item **[DEP]**
- [ ] Konfirmasi apakah `0027` sudah diterapkan ke DB produksi
- [ ] Konfirmasi apakah ada TLS terminator di depan nginx bawaan
- [ ] Konfirmasi package manager yang dipakai di produksi (npm vs pnpm) untuk B6.1
