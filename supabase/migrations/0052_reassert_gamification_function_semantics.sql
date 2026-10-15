do $$
declare
  schema_owner name;
  signature text;
begin
  select pg_get_userbyid(nspowner) into schema_owner from pg_namespace where nspname = 'utero_academy';
  if schema_owner is null or not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role' and rolbypassrls) then
    raise exception '0052 schema atau role wajib tidak cocok';
  end if;
  if not exists (select 1 from pg_roles where rolname = current_user and rolsuper)
     and not pg_has_role(current_user, schema_owner, 'USAGE') then
    raise exception '0052 runner tidak memiliki kewenangan owner schema %', schema_owner;
  end if;
  foreach signature in array array[
    'award_points(uuid,integer,character varying,uuid,text)',
    'check_and_award_badges(uuid,character varying)'
  ] loop
    if not exists (
      select 1 from pg_proc p
      where p.oid = to_regprocedure(format('utero_academy.%s', signature))
        and pg_get_userbyid(p.proowner) = schema_owner
        and not p.prosecdef
        and p.proconfig @> array['search_path=utero_academy, public, pg_temp']::text[]
    ) then
      raise exception '0052 signature/owner/security/search_path tidak cocok: %', signature;
    end if;
    if has_function_privilege('public', format('utero_academy.%s', signature), 'execute')
       or has_function_privilege('anon', format('utero_academy.%s', signature), 'execute')
       or has_function_privilege('authenticated', format('utero_academy.%s', signature), 'execute')
       or has_function_privilege('service_role', format('utero_academy.%s', signature), 'execute') then
      raise exception '0052 wajib dijalankan setelah hardening 0051: %', signature;
    end if;
  end loop;
end
$$;

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

    select total_points into v_new_total
    from utero_academy.user_points
    where user_id = p_user_id;

    update utero_academy.user_points
    set
        level          = floor(v_new_total / 100.0) + 1,
        level_progress = v_new_total % 100
    where user_id = p_user_id;
end;
$$;


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
            if v_intern_id is not null then
                select count(*) into user_progress
                from utero_academy.course_enrollments
                where intern_id = v_intern_id and completed_at is not null;

                should_award := user_progress >= (criteria_data->>'count')::integer;
            end if;

        elsif criteria_data->>'type' = 'quiz_passed' then
            if v_intern_id is not null then
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
            if v_intern_id is not null then
                select count(*) into user_progress
                from utero_academy.assignment_submissions
                where intern_id = v_intern_id
                  and reviewed_at is not null
                  and score >= coalesce((criteria_data->>'min_score')::integer, 90);

                should_award := user_progress >= (criteria_data->>'count')::integer;
            end if;

        elsif criteria_data->>'type' = 'login_streak' then
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
            raise notice 'check_and_award_badges: tipe kriteria tak dikenal "%" pada badge % (%)',
                criteria_data->>'type', badge_record.name, badge_record.id;
        end if;

        if should_award then
            insert into utero_academy.user_badges (user_id, badge_id)
            values (p_user_id, badge_record.id)
            on conflict (user_id, badge_id) do nothing;

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

revoke execute on function
  utero_academy.award_points(uuid,integer,character varying,uuid,text),
  utero_academy.check_and_award_badges(uuid,character varying)
from public, anon, authenticated, service_role;

do $$
declare
  award_body text;
  badge_body text;
  signature text;
begin
  select p.prosrc into award_body from pg_proc p
  where p.oid = 'utero_academy.award_points(uuid,integer,character varying,uuid,text)'::regprocedure;
  select p.prosrc into badge_body from pg_proc p
  where p.oid = 'utero_academy.check_and_award_badges(uuid,character varying)'::regprocedure;
  if award_body not like '%select total_points into v_new_total%'
     or badge_body not like '%where intern_id = v_intern_id and completed_at is not null%'
     or badge_body not like '%assignment_excellence%'
     or badge_body not like '%login_streak%'
     or badge_body not like '%get diagnostics v_inserted = row_count%' then
    raise exception '0052 semantic marker fungsi tidak cocok';
  end if;
  foreach signature in array array[
    'award_points(uuid,integer,character varying,uuid,text)',
    'check_and_award_badges(uuid,character varying)'
  ] loop
    if has_function_privilege('public', format('utero_academy.%s', signature), 'execute')
       or has_function_privilege('anon', format('utero_academy.%s', signature), 'execute')
       or has_function_privilege('authenticated', format('utero_academy.%s', signature), 'execute')
       or has_function_privilege('service_role', format('utero_academy.%s', signature), 'execute') then
      raise exception '0052 EXECUTE app role terbuka kembali: %', signature;
    end if;
  end loop;
end
$$;
