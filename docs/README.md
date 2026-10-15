# Peta dokumentasi

## Aktif: backend mandiri

- [Struktur proyek](08-repository-structure.md): lokasi kode, migrasi, operasi, dan arsip.
- [Migrasi identitas saja](35-selfhosted-identity-only.md): satu-satunya rencana penyalinan data sumber yang disetujui. Hanya email, nama, dan profil Academy.
- [Environment production](36-selfhosted-production-env.md) dan [SMTP smoke](37-selfhosted-smtp-smoke.md): persiapan lingkungan dan pengujian email.
- [Infrastruktur production](production-infra-runbook.md) dan [operasi](33-selfhosted-operations.md): deployment, backup, pemantauan.
- [Status readiness](34-production-readiness-status.md): riwayat penilaian lama; bagian migrasi penuh bukan gerbang GO saat ini.

## Historis

Dokumen fase 13 tentang Supabase, copy database penuh, copy storage, dan cutover lama disimpan sebagai referensi historis; **bukan** instruksi migrasi production strategi identitas saja. Snapshot HTML lama ada di `archive/legacy/`, laporan presentasi di `archive/reports/`. Folder `backend/migrations/` dan `supabase/migrations/` tetap diperlukan untuk membangun skema target baru, bukan berarti data lama disalin.
