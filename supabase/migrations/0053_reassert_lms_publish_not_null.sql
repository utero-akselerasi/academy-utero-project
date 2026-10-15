do $$
declare
  relation_name text;
begin
  foreach relation_name in array array['lessons', 'quizzes', 'assignments']
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'utero_academy'
        and table_name = relation_name
        and column_name = 'is_published'
    ) then
      raise exception 'Kolom is_published tidak ditemukan pada utero_academy.%', relation_name;
    end if;

    execute format(
      'update utero_academy.%I set is_published = true where is_published is null',
      relation_name
    );
    execute format(
      'alter table utero_academy.%I alter column is_published set not null',
      relation_name
    );
    execute format(
      'alter table utero_academy.%I alter column is_published set default true',
      relation_name
    );
  end loop;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'utero_academy'
      and table_name in ('lessons', 'quizzes', 'assignments')
      and column_name = 'is_published'
      and (is_nullable is distinct from 'NO' or column_default is distinct from 'true')
  ) then
    raise exception 'Postcondition is_published NOT NULL/DEFAULT true gagal';
  end if;
end $$;
