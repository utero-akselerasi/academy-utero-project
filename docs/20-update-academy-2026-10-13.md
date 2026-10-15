# Update Academy — 13 Oktober 2026

Materi ringkas untuk presentasi status. Angka di bawah berasal dari replay dan pemeriksaan teknis, bukan klaim bahwa fitur sudah live di production.

## 1. Apa yang sudah dibangun

- Alur pendaftaran dan pengelolaan aplikasi sekolah, termasuk impor CSV, seleksi, onboarding, dan status peserta tersedia dalam codebase.
- Modul pembelajaran, portofolio, sertifikat, signed URL Storage, dan integrasi SoundPub memerlukan pembuktian smoke end-to-end pada staging yang benar-benar terikat ke `supabase-02`.
- Kebijakan rilis tetap fail-closed: tidak ada migrasi atau perubahan production selama gate belum lulus.

## 2. Bukti teknis terkini

- Replay migrasi `0001–0037` lulus 43/43; replay `0038–0048` lulus 11/11 pada database bersih lokal.
- Report diff katalog menunjukkan 1.172 perbedaan baseline: 339 sesuai evolusi `0038–0048`, 155 kandidat drift production, dan 803 belum terselesaikan.
- Clone production lokal yang mendapat `0038–0048` masih memiliki 60 kandidat legacy drift dan 1.053 perbedaan belum terselesaikan. Dua function berbeda secara semantik; tujuh hanya line-ending.
- Pemeriksaan hak efektif menemukan 91 objek-role kehilangan hak `service_role` dan sembilan privilege aplikasi dibanding replay bersih.
- Migrasi kandidat `0049` untuk skema sertifikat lulus uji idempotensi dan dua uji negatif pada clone disposable; belum diterapkan ke staging atau production.
- Migrasi kandidat `0050` mengembalikan grant eksplisit tanpa blanket grant. Versi deployable lulus dua kali pada clone disposable; guard owner/RLS menolak fixture buruk dan rollback berhasil. Audit Data API/PUBLIC masih menahan penerapan lebih luas.

## 3. Gate rilis

| Gate | Status | Alasan |
| --- | --- | --- |
| Baseline + drift | Tertahan | `0050` lulus pada clone, tetapi audit Data API/PUBLIC dan sisa drift belum selesai |
| Staging readiness + smoke | Tertahan | Binding aplikasi, migration tracker, bucket, fixture, dan cleanup belum lengkap |
| Restore + rollback | Tertahan | Instance replacement terpisah belum tersedia |
| Production preflight | Tertahan | Baseline production sah dan kredensial terpisah belum tersedia |
| Cutover | **NO-GO** | Semua gate wajib lulus sebelum write freeze atau perubahan production |

## 4. Rencana kerja

1. Koreksi grant hanya setelah review allowlist dan uji pada clone terisolasi; uji Auth, RLS, RPC, signed URL, dan jalur service-role.
2. Bangun replacement staging dengan volume/port terpisah; restore snapshot dan buktikan rollback menyeluruh tanpa mematikan source.
3. Buktikan aplikasi staging memakai `supabase-02`; buat fixture yang bisa dibersihkan; jalankan smoke signup, seleksi, onboarding, sekolah, sertifikat, dan SoundPub.
4. Jalankan production preflight baca-saja dari baseline dan kredensial tervalidasi; evaluasi gate ulang.

## 5. Pesan keputusan

Pengembangan Academy berlanjut. Bukti kode dan replay migrasi tersedia, tetapi kesiapan production **belum terbukti**. Jadwal cutover ditentukan oleh hasil gate, bukan target presentasi. Production tetap berjalan seperti semula sampai semua gate lulus dan rollback terbukti.

Referensi: `docs/19-baseline-replay-evidence.md`, `docs/19-smoke-readiness-staging-phase13.md`, `docs/18-rollback-staging-phase13.md`, `docs/18-final-cutover-point-5.md`.
