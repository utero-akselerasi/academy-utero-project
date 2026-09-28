-- Perbaiki tabel `certificates` supaya sertifikat penyelesaian course benar-benar
-- bisa ditulis. DITULIS, JANGAN DIJALANKAN tanpa izin eksplisit.
--
-- ## Apa yang rusak
--
-- `features/lms/certificate-helper.ts` menulis empat field yang TIDAK ADA di
-- tabel — `final_score`, `notes`, dan mengandalkan `assessment_id` boleh kosong.
-- Bentuk tabel sebenarnya (`0001_initial_schema.sql:454-466`, ditambah
-- `0021_course_completion_certificate.sql` yang cuma menambah `course_id` dan
-- `certificate_type`):
--
--   assessment_id uuid NOT NULL UNIQUE references assessments(id)
--   intern_id     uuid NOT NULL
--   certificate_number text UNIQUE
--   file_path, status, issued_at, signed_at, revoked_at, created_at, updated_at
--
-- Jadi setiap `insert` dari helper itu melanggar tiga hal sekaligus: kolom
-- `final_score`/`notes` tidak ada (PGRST204), dan `assessment_id` NOT NULL tidak
-- pernah diisi (23502). Insert-nya **tidak pernah bisa berhasil, satu kali pun**.
--
-- `0021` menambahkan `course_id` dan `certificate_type` tapi tidak menyentuh
-- `assessment_id`, jadi fitur yang diniatkannya tidak pernah bisa jalan: sebuah
-- sertifikat course tidak punya assessment untuk ditunjuk.
--
-- ## Kenapa ini tidak pernah terlihat
--
-- Helper-nya menelan error: `console.error` lalu komentar "Don't throw error,
-- just log it". Peserta menyelesaikan seluruh course, `course_enrollments`
-- ter-update `completed_at`, halaman merender "selesai" — dan sertifikatnya
-- tidak ada. Tidak ada pesan gagal di mana pun kecuali di log server.
--
-- ## Perubahan
--
-- 1. `assessment_id` jadi nullable. Sertifikat course tidak punya assessment.
-- 2. Constraint `certificates_assessment_or_course` menggantikan jaminan yang
--    hilang: tepat satu dari `assessment_id`/`course_id` harus terisi, sesuai
--    `certificate_type`. Tanpa ini, melonggarkan NOT NULL akan mengizinkan baris
--    tanpa kedua-duanya — sertifikat yang tidak merujuk apa pun.
-- 3. `certificate_type` jadi NOT NULL. `0021` memberinya DEFAULT tapi bukan NOT
--    NULL, jadi `NULL` lolos `check_certificate_type` (perbandingan `IN` dengan
--    NULL bernilai NULL, dan CHECK menerima NULL) — nilai yang lolos constraint
--    tapi gagal setiap `.eq("certificate_type", ...)` di aplikasi.
-- 4. Unique index parsial per (intern, course) menggantikan `UNIQUE` di
--    `assessment_id` untuk jalur course. Ini yang membuat satu peserta tidak bisa
--    punya dua sertifikat untuk course yang sama.
-- 5. `final_score` dan `notes` ditambahkan — dipakai jalur course, dan berguna
--    untuk jalur assessment.
--
-- Idempoten dan tahan-penyimpangan: `if not exists` / `drop ... if exists`
-- sebelum setiap penambahan, dan tidak ada `DELETE` maupun `DROP TABLE`.

-- ---------------------------------------------------------------------------
-- (1) Kolom yang ditulis aplikasi tapi tidak ada di tabel.
-- ---------------------------------------------------------------------------

alter table utero_academy.certificates
  add column if not exists final_score numeric(5,2);

alter table utero_academy.certificates
  add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- (2) `assessment_id` nullable — sertifikat course tidak punya assessment.
--
-- `drop not null` idempoten secara alami: menjalankannya pada kolom yang sudah
-- nullable bukan error.
-- ---------------------------------------------------------------------------

alter table utero_academy.certificates
  alter column assessment_id drop not null;

-- ---------------------------------------------------------------------------
-- (3) `certificate_type` NOT NULL.
--
-- Baris lama diisi lebih dulu. `0001` membuat tabel tanpa kolom ini dan `0021`
-- menambahkannya dengan DEFAULT 'assessment'; DEFAULT hanya berlaku untuk baris
-- BARU, jadi baris yang sudah ada saat 0021 jalan bisa bernilai NULL.
-- ---------------------------------------------------------------------------

update utero_academy.certificates
set certificate_type = case
  when course_id is not null then 'course_completion'
  else 'assessment'
end
where certificate_type is null;

alter table utero_academy.certificates
  alter column certificate_type set default 'assessment';

alter table utero_academy.certificates
  alter column certificate_type set not null;

-- ---------------------------------------------------------------------------
-- (4) Tepat satu dari assessment_id / course_id terisi, sesuai tipenya.
--
-- Ini menggantikan jaminan yang hilang saat NOT NULL dilepas di (2). Ditulis
-- sebagai satu CHECK atas kombinasi, bukan dua CHECK terpisah, supaya bentuk
-- "assessment tanpa assessment_id" dan "course tanpa course_id" keduanya
-- tertolak.
--
-- `not valid` TIDAK dipakai: kalau ada baris produksi yang melanggar, migrasi ini
-- HARUS gagal dan menampilkannya, bukan menerimanya diam-diam. Baris seperti itu
-- adalah sertifikat yang tidak merujuk apa pun, dan memperbaikinya butuh
-- keputusan manusia — bukan keputusan migrasi.
-- ---------------------------------------------------------------------------

alter table utero_academy.certificates
  drop constraint if exists certificates_assessment_or_course;

alter table utero_academy.certificates
  add constraint certificates_assessment_or_course check (
    (certificate_type = 'assessment'        and assessment_id is not null and course_id is null)
    or
    (certificate_type = 'course_completion' and course_id     is not null and assessment_id is null)
  );

-- ---------------------------------------------------------------------------
-- (5) Satu sertifikat per (peserta, course).
--
-- `UNIQUE` di `assessment_id` sudah menjamin ini untuk jalur assessment. Jalur
-- course tidak punya padanannya, jadi tanpa index ini dua penyelesaian yang
-- berbarengan bisa menerbitkan dua sertifikat untuk course yang sama —
-- pemeriksaan `maybeSingle()` di aplikasi adalah race, bukan jaminan.
--
-- Parsial (`where course_id is not null`) supaya baris assessment, yang
-- `course_id`-nya selalu null, tidak saling bertabrakan.
-- ---------------------------------------------------------------------------

create unique index if not exists idx_certificates_intern_course_unique
  on utero_academy.certificates (intern_id, course_id)
  where course_id is not null;

-- ---------------------------------------------------------------------------
-- (6) Dokumentasi kolom baru.
-- ---------------------------------------------------------------------------

comment on column utero_academy.certificates.final_score is
  'Nilai akhir. Untuk course_completion selalu 100 (lulus = semua materi selesai).';
comment on column utero_academy.certificates.notes is
  'Catatan bebas, mis. judul course untuk sertifikat course_completion.';
comment on column utero_academy.certificates.assessment_id is
  'NULL untuk certificate_type = course_completion. Lihat constraint certificates_assessment_or_course.';
