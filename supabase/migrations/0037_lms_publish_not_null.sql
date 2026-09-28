-- Hentikan NULL di ketiga kolom `is_published` LMS.
-- DITULIS, JANGAN DIJALANKAN tanpa izin eksplisit.
--
-- ## Apa yang salah
--
-- `0015_lms_publish_status.sql` menambahkan `is_published boolean DEFAULT true`
-- ke `lessons`, `quizzes`, dan `assignments` — **tanpa `NOT NULL`**. `DEFAULT`
-- hanya berlaku saat kolom tidak disebut dalam `INSERT`; sebuah `INSERT` yang
-- menyebut kolom itu dengan nilai NULL tetap lolos, begitu juga `UPDATE ... SET
-- is_published = NULL`. Jadi tri-state-nya nyata, bukan teoretis.
--
-- Konsekuensinya bukan error, melainkan **dua jawaban berbeda untuk satu
-- pertanyaan**: "apakah materi ini terbit?"
--
--   * Policy RLS (`0030d_policies_lms.sql:91,306`) menulis
--     `is_published is not false` → NULL **TERBIT**.
--   * Jalur baca aplikasi (`features/lms/queries.ts`, dan seluruh
--     `app/dashboard/mentor/lms/[courseId]/page.tsx`) menulis `!== false` →
--     NULL **TERBIT**. Cocok.
--   * Tapi `features/lms/actions.ts:334` dulu memakai
--     `.neq("is_published", false)`, dan di SQL `is_published <> false` bernilai
--     NULL untuk baris ber-NULL — jadi `neq` ikut **membuang** baris itu →
--     NULL diperlakukan **TIDAK TERBIT**.
--
-- Titik ketiga itulah yang merusak: hitungan kelulusan course. Lesson ber-NULL
-- bisa dibuka dan diselesaikan peserta (policy mengizinkan) tapi tidak ikut
-- dihitung, jadi `lessonIds.every(...)` lulus lebih awal dan **sertifikat terbit
-- padahal masih ada materi yang belum selesai.** Tidak ada error di jalur mana
-- pun; yang keliru cuma sertifikatnya.
--
-- Titik itu sudah diperbaiki di aplikasi (`.or("is_published.is.null,is_published.eq.true")`).
-- Migrasi ini menutup **sumbernya**, supaya bentuk `neq` yang ditulis siapa pun
-- di masa depan tidak bisa salah lagi: kalau NULL tidak mungkin ada, `neq` dan
-- `is not false` menjadi setara.
--
-- ## Arah backfill: NULL → true, bukan false
--
-- Ini bukan pilihan bebas. `is not false` di policy sudah **mengizinkan peserta
-- membaca** baris ber-NULL, dan data kemajuan (`lesson_completions`,
-- `quiz_attempts`, `assignment_submissions`) mungkin sudah tercatat atasnya.
-- Membackfill ke `false` akan **menyembunyikan materi yang sudah dikerjakan
-- peserta** dan membuat kemajuan mereka menggantung tanpa induk yang terlihat.
-- `true` mempertahankan apa yang produksi sudah perlihatkan selama ini.
--
-- ## Sifat migrasi
--
-- Idempoten dan tahan-penyimpangan: `UPDATE ... WHERE is_published IS NULL`
-- tidak mengenai satu baris pun pada jalan kedua, dan `SET NOT NULL` pada kolom
-- yang sudah `NOT NULL` adalah no-op di Postgres. Penjaga `information_schema`
-- membuat berkas ini tidak membatalkan dirinya kalau salah satu tabel belum ada
-- di produksi (lihat masalah penyimpangan produksi di plan Batch 0).
--
-- `SET NOT NULL` mengambil `ACCESS EXCLUSIVE LOCK` dan memindai seluruh tabel.
-- Ketiga tabel ini kecil, jadi jedanya singkat — tapi itu tetap alasan berkas ini
-- tidak ikut jalan otomatis.
--
-- ## Yang SENGAJA tidak disentuh
--
-- `course_announcements.is_published` (`0024_course_announcements.sql:16`) juga
-- nullable, tapi **tidak** ikut diperketat di sini. Satu-satunya jalur tulisnya
-- (`features/lms/actions.ts:1136`) selalu menyetel `true` secara eksplisit, jadi
-- NULL tidak terjangkau dan pengetatannya akan mengunci tabel tanpa menutup
-- cacat apa pun. Dicatat, bukan dilewatkan.

do $$
declare
  v_tabel text;
  v_terisi bigint;
begin
  foreach v_tabel in array array['lessons', 'quizzes', 'assignments']
  loop
    -- Penjaga keberadaan: referensi keras ke tabel yang tidak ada akan
    -- membatalkan SELURUH migrasi, bukan hanya satu langkah.
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'utero_academy'
        and table_name = v_tabel
        and column_name = 'is_published'
    ) then
      raise notice 'utero_academy.%.is_published tidak ada — dilewati.', v_tabel;
      continue;
    end if;

    execute format(
      'update utero_academy.%I set is_published = true where is_published is null',
      v_tabel
    );
    get diagnostics v_terisi = row_count;

    if v_terisi > 0 then
      raise notice 'utero_academy.%: % baris NULL diisi true.', v_tabel, v_terisi;
    end if;

    -- Dijalankan tanpa syarat: no-op kalau kolomnya sudah `NOT NULL`.
    execute format(
      'alter table utero_academy.%I alter column is_published set not null',
      v_tabel
    );

    -- `DEFAULT true` ditegaskan ulang. `0015` sudah menyetelnya, tapi berkas ini
    -- harus tahan-penyimpangan: tanpa default, `INSERT` yang tidak menyebut
    -- kolom ini akan gagal `23502` setelah `NOT NULL` berlaku — dan ke-3 jalur
    -- pembuatan materi di `features/lms/actions.ts` memang tidak menyebutnya.
    execute format(
      'alter table utero_academy.%I alter column is_published set default true',
      v_tabel
    );
  end loop;
end
$$;

-- Asersi: kalau salah satu kolom masih nullable, migrasi ini gagal keras
-- alih-alih melaporkan sukses palsu.
do $$
declare
  v_sisa text;
begin
  select string_agg(table_name, ', ' order by table_name)
  into v_sisa
  from information_schema.columns
  where table_schema = 'utero_academy'
    and table_name in ('lessons', 'quizzes', 'assignments')
    and column_name = 'is_published'
    and is_nullable = 'YES';

  if v_sisa is not null then
    raise exception 'is_published masih nullable di: %', v_sisa;
  end if;
end
$$;
