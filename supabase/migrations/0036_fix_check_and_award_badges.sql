-- Perbaiki utero_academy.check_and_award_badges dan award_points.
-- DITULIS, JANGAN DIJALANKAN tanpa izin eksplisit.
--
-- ## (A) Bug yang dilaporkan: kolom yang tidak ada
--
-- `0022:196` menanyakan `course_enrollments WHERE user_id = p_user_id`. Tabel itu
-- (`0001_initial_schema.sql:263-270`) tidak punya kolom `user_id` sama sekali —
-- kuncinya `intern_id` yang menunjuk `intern_profiles(id)`. Jadi setiap pemanggilan
-- `check_and_award_badges(<user>, 'course')` berhenti dengan
-- `42703 column "user_id" does not exist`.
--
-- plpgsql menyiapkan pernyataan SQL saat DIEKSEKUSI, bukan saat dibuat, jadi
-- `CREATE OR REPLACE` di `0022` sukses tanpa keluhan apa pun. Kesalahannya baru
-- muncul saat fungsi benar-benar dipanggil dengan kategori `course` — dan ia
-- membatalkan seluruh pemanggilan, bukan hanya satu badge.
--
-- Ironisnya `v_intern_id` sudah diambil di `0022:176-178` untuk cabang
-- quiz/assignment. Cabang `complete_courses` saja yang tidak memakainya.
--
-- ## (B) Kenapa ini belum pernah meledak di produksi
--
-- Dicatat apa adanya supaya urgensinya tidak dibesar-besarkan: **tidak ada satu
-- pun pemanggil.** Dicek ke seluruh repo — nol `.rpc("check_and_award_badges")`,
-- nol `.rpc("award_points")`, dan nol trigger di `supabase/` yang memanggil
-- keduanya. `user_badges`, `user_points`, dan `point_transactions` hanya DIBACA
-- oleh aplikasi (`features/lms/actions.ts:913,929`), tidak pernah ditulis.
--
-- Jadi konsekuensi sebenarnya bukan error di produksi, melainkan: seluruh jalur
-- tulis gamifikasi mati, dan halaman badge selalu kosong untuk semua peserta.
-- Fungsi ini diperbaiki supaya ketika jalur pemanggilnya dipasang, ia tidak
-- membawa masuk empat bug sekaligus.
--
-- ## (C) Tiga bug lain yang ditemukan di fungsi yang sama
--
-- 1. **Tiga dari 14 badge yang di-seed tidak punya cabang kriteria sama sekali.**
--    `login_streak` ('Consistent Learner', 'Dedication') dan
--    `assignment_excellence` ('Excellence') tidak pernah dievaluasi, jadi
--    `should_award` tetap false dan badge-nya mustahil didapat. Bukan kegagalan
--    yang terlihat — cuma badge yang tak pernah menyala. Kedua cabang
--    ditambahkan; datanya sudah ada di `user_streaks` dan
--    `assignment_submissions.score`.
--
-- 2. **Poin bisa diberikan dua kali untuk satu badge.** `0022:254-266` memakai
--    `INSERT ... ON CONFLICT DO NOTHING` lalu memanggil `award_points` TANPA
--    memeriksa apakah baris benar-benar masuk. Penjaga `IF EXISTS ... CONTINUE`
--    di atasnya tidak cukup: dua pemanggilan berbarengan bisa lolos berdua,
--    salah satu insert-nya jadi no-op, dan poinnya tetap ditambahkan. Sekarang
--    `ROW_COUNT` diperiksa, jadi poin hanya menyusul badge yang benar-benar baru.
--
-- 3. **`RETURNING ... INTO` pada `ON CONFLICT DO NOTHING` tidak mengembalikan
--    apa pun.** Bukan bug di `award_points` hari ini (ia memakai `DO UPDATE`),
--    tapi `v_new_total` di sana akan NULL kalau ada yang mengubahnya jadi
--    `DO NOTHING`. Perhitungan level dipindahkan supaya membaca nilai tersimpan,
--    bukan bergantung pada `RETURNING`.
--
-- ## (D) Yang TIDAK diperbaiki di sini, dan alasannya
--
-- `user_points.points_this_month` / `points_this_week` hanya pernah ditambah,
-- tidak pernah direset — tidak ada job terjadwal di repo ini yang meresetnya.
-- Jadi keduanya sebenarnya total sepanjang waktu dengan nama yang menyesatkan.
-- Memperbaikinya butuh keputusan produk (reset terjadwal, atau hitung dari
-- `point_transactions.created_at` saat dibaca), bukan keputusan migrasi.
-- Dibiarkan dan dicatat.
--
-- ## (E) PENTING — kenapa `SET search_path` ditulis ulang di sini
--
-- `0033_fix_view_and_function_security.sql` memaku `search_path` pada SETIAP
-- fungsi di schema ini lewat `ALTER FUNCTION ... SET search_path`. Nilai itu
-- disimpan di `pg_proc.proconfig`, dan `CREATE OR REPLACE FUNCTION` **menghapus
-- proconfig** kalau definisi barunya tidak menyebut klausa `SET`.
--
-- Artinya: mengganti fungsi ini tanpa `SET search_path` akan MENCABUT
-- pengencangan `0033` secara senyap — fungsi kembali me-resolve nama tabel lewat
-- search_path pemanggil, persis lubang yang `0033` tutup. Karena itu klausanya
-- ditulis eksplisit di kedua fungsi di bawah, dengan daftar yang identik dengan
-- `0033` (`pg_temp` wajib dan harus TERAKHIR).
--
-- Aturan yang sama berlaku untuk setiap migrasi setelah `0033` yang memakai
-- `CREATE OR REPLACE FUNCTION`.
--
-- Idempoten: `CREATE OR REPLACE` saja, tanpa `DELETE`, `DROP TABLE`, maupun
-- `DROP FUNCTION`.

-- ---------------------------------------------------------------------------
-- award_points
-- ---------------------------------------------------------------------------

create or replace function utero_academy.award_points(
    p_user_id uuid,
    p_points integer,
    p_activity_type varchar(50),
    p_reference_id uuid default null,
    p_description text default null
)
returns void
language plpgsql
set search_path = utero_academy, public, pg_temp
as $$
declare
    v_new_total integer;
begin
    insert into utero_academy.point_transactions (user_id, points, activity_type, reference_id, description)
    values (p_user_id, p_points, p_activity_type, p_reference_id, p_description);

    insert into utero_academy.user_points (user_id, total_points, points_this_month, points_this_week, last_activity_at)
    values (p_user_id, p_points, p_points, p_points, now())
    on conflict (user_id) do update
    set
        total_points       = user_points.total_points + p_points,
        points_this_month  = user_points.points_this_month + p_points,
        points_this_week   = user_points.points_this_week + p_points,
        last_activity_at   = now();

    -- Dibaca kembali, bukan lewat `RETURNING ... INTO`. `RETURNING` pada
    -- `ON CONFLICT` hanya menghasilkan baris untuk cabang yang benar-benar
    -- menulis: begitu ada yang mengubah `DO UPDATE` menjadi `DO NOTHING`,
    -- `v_new_total` jadi NULL, `v_new_level` jadi NULL, dan UPDATE di bawah
    -- menimpa level dengan NULL tanpa satu pun error. Membaca nilai tersimpan
    -- tidak punya mode gagal itu.
    select total_points into v_new_total
    from utero_academy.user_points
    where user_id = p_user_id;

    update utero_academy.user_points
    set
        -- 100 poin per level. `level_progress` adalah sisa dalam level saat ini;
        -- `0022` menulisnya sebagai `((v % 100) * 100) / 100`, yang nilainya
        -- identik tapi membuat rumusnya terlihat seperti persentase dari sesuatu.
        level          = floor(v_new_total / 100.0) + 1,
        level_progress = v_new_total % 100
    where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_and_award_badges
-- ---------------------------------------------------------------------------

create or replace function utero_academy.check_and_award_badges(
    p_user_id uuid,
    p_category varchar(50)
)
returns void
language plpgsql
set search_path = utero_academy, public, pg_temp
as $$
declare
    badge_record   record;
    criteria_data  jsonb;
    user_progress  integer;
    should_award   boolean;
    v_intern_id    uuid;
    v_inserted     integer;
begin
    -- Satu peserta = satu baris intern_profiles (`user_id` unik di
    -- `0001:148`), jadi tidak ada keraguan baris mana yang terpilih.
    select id into v_intern_id
    from utero_academy.intern_profiles
    where user_id = p_user_id;

    for badge_record in
        select * from utero_academy.badges
        where category = p_category and is_active = true
    loop
        if exists (
            select 1 from utero_academy.user_badges
            where user_id = p_user_id and badge_id = badge_record.id
        ) then
            continue;
        end if;

        criteria_data := badge_record.criteria;
        should_award  := false;

        if criteria_data->>'type' = 'complete_courses' then
            -- INI BUG YANG DILAPORKAN. `course_enrollments` tidak punya
            -- `user_id`; kuncinya `intern_id`. Penjaga `v_intern_id is not null`
            -- ikut ditambahkan: tanpa itu, `intern_id = NULL` menghitung nol
            -- baris tanpa error untuk staf yang tidak punya profil peserta —
            -- benar secara kebetulan, dan menyesatkan saat dibaca.
            if v_intern_id is not null then
                select count(*) into user_progress
                from utero_academy.course_enrollments
                where intern_id = v_intern_id and completed_at is not null;

                should_award := user_progress >= (criteria_data->>'count')::integer;
            end if;

        elsif criteria_data->>'type' = 'quiz_passed' then
            if v_intern_id is not null then
                -- `q.passing_score` nullable (`0001:287`), dan
                -- `score >= NULL` bernilai NULL, bukan true — kuis tanpa
                -- ambang lulus tidak pernah terhitung lulus. Itu memang
                -- perilaku yang diinginkan (tak ada ambang = tak ada lulus),
                -- dicatat supaya tidak "diperbaiki" jadi COALESCE(…, 0), yang
                -- akan membuat setiap percobaan dianggap lulus.
                select count(distinct quiz_id) into user_progress
                from utero_academy.quiz_attempts qa
                join utero_academy.quizzes q on q.id = qa.quiz_id
                where qa.intern_id = v_intern_id and qa.score >= q.passing_score;

                should_award := user_progress >= (criteria_data->>'count')::integer;
            end if;

        elsif criteria_data->>'type' = 'quiz_perfect' then
            if v_intern_id is not null then
                select count(distinct quiz_id) into user_progress
                from utero_academy.quiz_attempts
                where intern_id = v_intern_id
                  and score >= coalesce((criteria_data->>'min_score')::integer, 90);

                should_award := user_progress >= (criteria_data->>'count')::integer;
            end if;

        elsif criteria_data->>'type' = 'quiz_perfect_score' then
            if v_intern_id is not null then
                should_award := exists (
                    select 1 from utero_academy.quiz_attempts
                    where intern_id = v_intern_id and score = 100
                );
            end if;

        elsif criteria_data->>'type' = 'assignment_submitted' then
            if v_intern_id is not null then
                select count(*) into user_progress
                from utero_academy.assignment_submissions
                where intern_id = v_intern_id and submitted_at is not null;

                should_award := user_progress >= (criteria_data->>'count')::integer;
            end if;

        elsif criteria_data->>'type' = 'assignment_excellence' then
            -- Cabang BARU. Badge 'Excellence' di-seed `0022:107` tapi tidak
            -- punya cabang di `0022`, jadi ia mustahil didapat siapa pun.
            -- `reviewed_at is not null` ikut disyaratkan: `score` bisa terisi
            -- sebelum penilaian dirampungkan, dan nilai sementara tidak layak
            -- jadi dasar badge.
            if v_intern_id is not null then
                select count(*) into user_progress
                from utero_academy.assignment_submissions
                where intern_id = v_intern_id
                  and reviewed_at is not null
                  and score >= coalesce((criteria_data->>'min_score')::integer, 90);

                should_award := user_progress >= (criteria_data->>'count')::integer;
            end if;

        elsif criteria_data->>'type' = 'login_streak' then
            -- Cabang BARU. 'Consistent Learner' dan 'Dedication' (`0022:110-111`)
            -- juga tidak punya cabang di `0022`.
            --
            -- Dibaca dari `longest_streak_days`, bukan `current_streak_days`:
            -- badge adalah pencapaian, dan pencapaian tidak hilang saat
            -- streak-nya putus. Memakai `current` berarti badge yang sudah
            -- didapat tidak bisa didapat ulang setelah putus — dan karena
            -- `user_badges` unik per (user, badge), itu bukan masalah
            -- duplikasi, melainkan pencapaian yang tercabut.
            --
            -- Kriterianya memakai kunci `days`, bukan `count` (lihat seed
            -- `0022:110-111`). Menyalin `count` ke sini akan menghasilkan
            -- `NULL >= NULL` = NULL dan badge yang tetap tak pernah menyala.
            select coalesce(longest_streak_days, 0) into user_progress
            from utero_academy.user_streaks
            where user_id = p_user_id;

            should_award := coalesce(user_progress, 0) >= (criteria_data->>'days')::integer;

        elsif criteria_data->>'type' = 'comments_posted' then
            select count(*) into user_progress
            from utero_academy.lesson_comments
            where user_id = p_user_id;

            should_award := user_progress >= (criteria_data->>'count')::integer;

        elsif criteria_data->>'type' = 'comments_pinned' then
            select count(*) into user_progress
            from utero_academy.lesson_comments
            where user_id = p_user_id and is_pinned = true;

            should_award := user_progress >= (criteria_data->>'count')::integer;

        else
            -- Tipe kriteria yang tak dikenal. `0022` mendiamkannya, jadi badge
            -- dengan `criteria` salah ketik tidak pernah menyala dan tidak
            -- pernah mengeluh. `raise notice`, bukan `raise exception`: satu
            -- baris badge yang rusak tidak boleh menggagalkan pemberian badge
            -- lain, tapi harus meninggalkan jejak di log.
            raise notice 'check_and_award_badges: tipe kriteria tak dikenal "%" pada badge % (%)',
                criteria_data->>'type', badge_record.name, badge_record.id;
        end if;

        if should_award then
            insert into utero_academy.user_badges (user_id, badge_id)
            values (p_user_id, badge_record.id)
            on conflict (user_id, badge_id) do nothing;

            -- Poin hanya menyusul badge yang BENAR-BENAR baru masuk.
            --
            -- `0022` memanggil `award_points` tanpa syarat setelah
            -- `ON CONFLICT DO NOTHING`. Penjaga `IF EXISTS ... CONTINUE` di atas
            -- tidak menutup celahnya: dua pemanggilan berbarengan bisa lolos
            -- berdua, insert kedua jadi no-op, dan poinnya tetap ditambahkan —
            -- satu badge dibayar dua kali, dengan dua baris di
            -- `point_transactions` yang keduanya terlihat sah.
            get diagnostics v_inserted = row_count;

            if v_inserted > 0 then
                perform utero_academy.award_points(
                    p_user_id,
                    badge_record.points,
                    'badge_earned',
                    badge_record.id,
                    'Earned badge: ' || badge_record.name
                );
            end if;
        end if;
    end loop;
end;
$$;

comment on function utero_academy.check_and_award_badges(uuid, varchar) is
  'Evaluasi kriteria badge satu kategori untuk satu user dan berikan yang memenuhi syarat. Idempoten; poin hanya diberikan untuk badge yang benar-benar baru.';
