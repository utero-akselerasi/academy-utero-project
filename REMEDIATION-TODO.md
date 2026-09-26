# Remediation Progress — Audit Produksi 2026-09-26

Status: `[ ]` belum · `[~]` jalan · `[x]` selesai & ter-push

Referensi ID temuan mengikuti Master Deep Audit Report (C-x kritis, H-x tinggi, M-x sedang).

## Keputusan Kebijakan

- Role `mentor` **dihapus**. Role `admin` = administrator **sekaligus** mentor.
- Assignment `mentor` lama dimigrasikan menjadi `admin` (tidak ada akun dihapus).
- Login `admin` tetap mendarat di `/dashboard/admin`; route `/dashboard/mentor/*` tetap dipakai sebagai area kerja operasional admin.
- Temuan C-5 (mentor lockout) **dibatalkan** — bukan bug, sesuai kebijakan di atas.

---

## Batch 1 — Konsolidasi RBAC (`admin` = mentor)

- [ ] B1.1 Hapus `mentor` dari `RoleCode`, `rolePriority`, `dashboardByRole` di `features/auth/roles.ts`
- [ ] B1.2 Tambah helper otorisasi terpusat (`requireUser`, `requireRole`, `requireAdmin`, `requireSuperAdmin`) di `features/auth/guards.ts`
- [ ] B1.3 Hapus entri `mentor` di `roleLabelMap` & `sidebarItemsMap` (`features/auth/ProtectedDashboardLayout.tsx`)
- [ ] B1.4 Ganti redirect `/login` untuk user login-tapi-tak-berwenang jadi halaman 403 (`app/dashboard/forbidden`)
- [ ] B1.5 Migrasi SQL `0028`: buat role `admin`, pindahkan assignment `mentor` → `admin`, hapus role `mentor`
- [ ] B1.6 Perbarui referensi string `"mentor"` di `app/dashboard/profile/page.tsx`, `features/auth/edit-profile-action.ts`, `features/lms/components/LessonComments.tsx`, `features/super-admin/actions.ts`
- [ ] B1.7 Commit `0027_super_admin_role.sql` yang belum ter-track (H-9)

## Batch 2 — Tutup lubang otorisasi terbukti (C-2, C-3, C-4)

- [ ] B2.1 Hapus auto-insert `mentor_profiles` di `getMentorProfileId()` — eskalasi hak (C-2)
- [ ] B2.2 Guard role + scope pada `app/dashboard/mentor/attendance/export/route.ts` (C-3)
- [ ] B2.3 Netralkan CSV formula injection di kedua jalur ekspor (H-10)
- [ ] B2.4 Otorisasi-sebelum-fetch di 5 halaman super-admin tanpa guard (C-4)
- [ ] B2.5 Ganti `select("*")` jadi kolom eksplisit di halaman super-admin (C-4)

## Batch 3 — Otorisasi Server Actions (C-1, H-5, H-6)

- [ ] B3.1 `features/attendance/actions.ts`: guard admin pada settings/permit/review + allowlist status + batas rentang tanggal
- [ ] B3.2 `features/daily-reports/actions.ts`: guard admin + cek ownership laporan (H-3)
- [ ] B3.3 `features/lms/actions.ts` + `actions-comments.ts`: guard admin untuk mutasi staf
- [ ] B3.4 `features/tasks/actions.ts`: predikat ownership/keanggotaan pada 14 mutasi (H-5)
- [ ] B3.5 Samakan pilihan client pada `reviewAttendanceAction` (H-6)

## Batch 4 — Lapisan data: storage, upload, XSS (C-6, C-7, H-4)

- [ ] B4.1 Sanitasi HTML CMS pada blog publik (H-4)
- [ ] B4.2 Validasi upload registrasi publik: MIME, ukuran, magic bytes, error generik (C-7)
- [ ] B4.3 Migrasi `0029`: bucket privat + `file_size_limit` + `allowed_mime_types` + policy ber-scope path (C-6)
- [ ] B4.4 Signed URL untuk CV, selfie absensi, bukti laporan (C-6)

## Batch 5 — Integritas data (H-2, H-10, H-12, H-13, H-14, M-1, M-2, M-4, M-5, M-7)

- [ ] B5.1 Ikat pengiriman quiz ke enrollment + tegakkan `can_attempt_quiz` (H-2)
- [ ] B5.2 Perbaiki `certificate-helper` agar sesuai schema; jangan telan error (H-12)
- [ ] B5.3 Migrasi `0030`: perbaiki `check_and_award_badges` (`user_id` → `intern_id`) (H-13)
- [ ] B5.4 Jadikan generate laporan sekolah idempoten; hentikan mutasi saat render GET (H-10)
- [ ] B5.5 Paginasi `listUsers` pada deteksi orphan (H-14)
- [ ] B5.6 `||` → `??` untuk koordinat/radius; tangani update nol baris (M-1, M-2)
- [ ] B5.7 Cleanup MediaStream saat unmount `LiveCameraInput` (M-4)
- [ ] B5.8 Perbaiki `\n` literal + `iconMap` `BookOpen` (M-5, M-7)

## Batch 6 — Release engineering & CI (C-9, H-7, H-8, M-14, M-16)

- [ ] B6.1 Commit satu lockfile + `packageManager`; deklarasikan `recharts` (C-9)
- [ ] B6.2 Perbaiki Dockerfile: base image dipin, prune dev deps (C-9)
- [ ] B6.3 TLS + HSTS di nginx; hapus publish port 3000; healthcheck (H-7)
- [ ] B6.4 Endpoint `/api/health` (M-16)
- [ ] B6.5 Ganti `apply-migration.js` dengan runner berurutan yang gagal-keras (M-14)
- [ ] B6.6 Script `lint` + CI GitHub Actions: install → lint → typecheck → build → test (H-8)
- [ ] B6.7 Matriks test otorisasi per role × action/route (H-8)

---

## Butuh Tindakan Kamu (tidak bisa aku kerjakan)

- [ ] **Rotasi kredensial** yang terdeteksi di `.env` lokal (C-8) — hanya kamu yang punya akses ke penerbitnya
- [ ] Jalankan query verifikasi read-only §8 laporan audit pada DB produksi, lalu kirim hasilnya (menentukan semua item **[DEP]**)
- [ ] Konfirmasi apakah `0027` sudah diterapkan ke DB produksi
- [ ] Konfirmasi apakah ada TLS terminator di depan nginx bawaan
