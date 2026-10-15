do $$
declare
  unsafe_policy text;
begin
  with relevant_policy as (
    select policyname, cmd,
      case when cmd in ('SELECT', 'DELETE', 'UPDATE', 'ALL') then qual end as using_expression,
      case when cmd in ('INSERT', 'UPDATE', 'ALL') then coalesce(with_check, qual) end as check_expression
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles::text[] && array['anon', 'authenticated', 'public']
  ), policy_expression as (
    select policyname, expression
    from relevant_policy
    cross join lateral unnest(array[using_expression, check_expression]) expression
    where expression is not null
  )
  select string_agg(distinct policyname, ', ' order by policyname) into unsafe_policy
  from (
    select policyname from relevant_policy
    where (cmd in ('SELECT', 'DELETE', 'UPDATE', 'ALL') and using_expression is null)
      or (cmd in ('INSERT', 'UPDATE', 'ALL') and check_expression is null)
    union all
    select policyname from policy_expression
    where lower(expression) like '%academy-private%'
      or expression !~* '(?s)^(\(bucket_id = ((\x27[^\x27]+\x27::text)|ANY \(ARRAY\[(\x27[^\x27]+\x27::text)(, \x27[^\x27]+\x27::text)*\]\))\)|\(\(bucket_id = ((\x27[^\x27]+\x27::text)|ANY \(ARRAY\[(\x27[^\x27]+\x27::text)(, \x27[^\x27]+\x27::text)*\]\))\) AND .*\))$'
  ) unsafe;

  if unsafe_policy is not null then
    raise exception 'Policy Storage dapat menjangkau bucket baru atau scope-nya tidak dapat dibuktikan aman: %.', unsafe_policy;
  end if;

  if exists (
    select 1 from storage.buckets where id = 'academy-private'
      and (public is distinct from false
        or file_size_limit is distinct from 20971520
        or allowed_mime_types is distinct from array[
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]::text[])
  ) then
    raise exception 'Bucket academy-private sudah ada dengan konfigurasi berbeda.';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-private', 'academy-private', false, 20971520,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;
