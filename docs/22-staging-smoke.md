# Staging app dan smoke fase 13

Status 2026-10-13: **NO-GO**. Production tidak diakses atau diubah. Tidak ada akun, row, object Storage, tracker, bucket, atau migrasi yang dibuat pada staging.

## Bukti aktual

- Tunnel lokal `127.0.0.1:18100` menuju gateway `supabase-02` port 8100 dan `127.0.0.1:15532` menuju DB container `supabase-02-db`. Container Envoy, Auth, Storage, dan DB staging hidup; volume DB berada di path instance `supabase-02`.
- Arsip pra-latihan staging memiliki checksum yang lulus, tetapi bukti tersebut bukan backup keadaan staging saat ini. Tidak ada bukti restore/current-state provenance yang cukup untuk mengubah tracker atau bucket.
- DB staging memiliki Auth, schema Academy, 209 user Auth, 2.218 metadata object Storage, dan tiga bucket: `academy-private`, `daily-report`, `selection-answers`. Tracker `utero_academy.schema_migrations` tidak ada. Prefix `phase13-smoke/` berisi nol object; aplikasi dan assignment seleksi juga nol pada pemeriksaan sebelumnya.
- App Academy aktif pada port 3000 memakai konfigurasi develop. Port 3100 milik layanan lain. Salinan source terpisah dibuat di `I:\DevData\TEMP\academy-phase13-staging-app-20261013-0755`, tetapi build belum dimulai: tidak ada `.next`, marker build, atau secret file.
- Build staging diblokir kebijakan eksekusi ketika mencoba mengambil key dari container staging. Karena build/runtime tidak ada, browser dan server runtime binding ke `supabase-02` belum terbukti.

## Gate perubahan

`scripts/assess-phase13-staging-smoke.mjs` menginventaris klaim identitas `supabase-02`, backup, tracker terbaru `0052` beserta checksum, bucket, binding runtime, dan cleanup. File evidence bukan bukti independen; sekalipun semua klaim bernilai true, hasilnya `EVIDENCE_CLAIMED_NOT_VERIFIED`, **bukan izin write**. `fixtureAllowed` dan `smokeAllowed` selalu false sampai ada runner/verifier independen yang benar-benar menguji seluruh gate. Kegagalan gate menghasilkan `NO-GO`.

Evidence non-secret: `I:\DevData\TEMP\phase13-staging-smoke-evidence-v2-20261013.json` (SHA-256 `3aa4324d845136dc83bf9b9d7c03b84720ce7717b831a6cd22b2a89b2750b57f`). Report: `I:\DevData\TEMP\phase13-staging-smoke-report-v2-20261013.json` (SHA-256 `fd0b939613d3e388c4606678cfdfb010e45ef426dea378eb3dcfcb5a8d4b836b`). Command `node scripts/assess-phase13-staging-smoke.mjs <evidence> <report>` menghasilkan `NO-GO` dan blocker `backup, tracker, buckets, appBinding, cleanup` dengan exit code 1. Versi awal tanpa `-v2` tetap di TEMP, tetapi superseded karena menandai zero-residue terlalu dini; gunakan hanya v2.

Tracker dan bucket **tidak diperbaiki**. Backup yang ada hanya bukti pra-latihan; mengadopsi tracker atau membuat bucket sekarang akan mengubah staging tanpa baseline/current-state recovery yang sah.

## Status E2E

| Alur | Status | Bukti |
| --- | --- | --- |
| GET register/login | tested parsial | HTTP 200 pada app develop; bukan app staging |
| Auth Admin staging | tested parsial | service key staging diterima HTTP 200; tidak ada data user dicetak |
| Signup/login staging | untested | app runtime staging tidak tersedia |
| CV/portofolio dan signed URL | untested | tidak ada fixture dan cleanup belum terbukti |
| Seleksi | untested | tidak ada fixture |
| Onboarding | untested | tidak ada fixture |
| Portal sekolah | untested | tidak ada fixture tenant-scoped |
| Sertifikat | untested | tidak ada template/file fixture |
| SoundPub | untested | tidak ada object sintetis yang disetujui |
| Fixture cleanup | untested | cleanup lintas Auth/DB/Storage belum pernah mencapai zero-residue |

## Blocker

1. App build/runtime staging belum tersedia dan tidak memiliki evidence binding server ke `supabase-02`.
2. Backup pra-latihan bukan backup current-state dengan provenance restore yang dapat dipakai untuk recovery perubahan tracker/bucket.
3. Tracker migrasi tidak ada; adopsi baseline belum dibuktikan aman pada staging.
4. Enam bucket wajib belum tersedia.
5. Runner fixture write+cleanup belum teruji; cleanup lintas layanan tidak atomik.

Sebelum smoke write: siapkan backup current-state staging dan uji restore ke instance disposable, review/adopsi tracker secara eksplisit, lengkapi bucket lewat migrasi terverifikasi, bangun app staging dengan kanal secret yang disetujui, buktikan runtime binding, lalu uji satu fixture minimum dengan cleanup `finally` dan verifikasi zero-residue. Sampai itu selesai, fixture dan smoke mutasi dilarang.
