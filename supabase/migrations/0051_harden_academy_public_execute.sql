do $$
declare
  schema_owner name;
  target record;
begin
  select pg_get_userbyid(n.nspowner) into schema_owner
  from pg_namespace n where n.nspname = 'utero_academy';

  if schema_owner is null
     or not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role' and rolbypassrls) then
    raise exception '0051 schema atau role wajib tidak cocok';
  end if;

  if not exists (select 1 from pg_roles where rolname = current_user and rolsuper)
     and not pg_has_role(current_user, schema_owner, 'USAGE') then
    raise exception '0051 runner tidak memiliki kewenangan owner schema %', schema_owner;
  end if;

  for target in select * from (values
      ('award_points(uuid,integer,character varying,uuid,text)', false, false),
      ('can_attempt_quiz(uuid,uuid)', false, false),
      ('check_and_award_badges(uuid,character varying)', false, false),
      ('current_user_has_role(text)', true, false),
      ('set_announcement_published_at()', false, true),
      ('set_updated_at()', false, true),
      ('update_daily_activity(uuid,character varying,integer,integer)', false, false),
      ('update_updated_at_column()', false, true),
      ('update_user_streak(uuid)', false, false)
    ) as expected(signature, security_definer, trigger_function)
  loop
    if not exists (
      select 1 from pg_proc p
      where p.oid = to_regprocedure(format('utero_academy.%s', target.signature))
        and pg_get_userbyid(p.proowner) = schema_owner
        and p.prosecdef = target.security_definer
        and p.proconfig @> array['search_path=utero_academy, public, pg_temp']::text[]
        and (not target.trigger_function or p.prorettype = 'trigger'::regtype)
    ) then
      raise exception '0051 signature/owner/security/search_path tidak cocok: %', target.signature;
    end if;
  end loop;

  if not exists (
      select 1 from pg_policies
      where schemaname = 'utero_academy'
        and roles = array['authenticated']::name[]
        and (coalesce(qual,'') || coalesce(with_check,'')) like '%current_user_has_role%'
    ) or (select count(*) from pg_trigger t
      where not t.tgisinternal and t.tgfoid in (
        'utero_academy.set_announcement_published_at()'::regprocedure,
        'utero_academy.set_updated_at()'::regprocedure,
        'utero_academy.update_updated_at_column()'::regprocedure
      )) < 3 then
    raise exception '0051 dependency policy atau trigger tidak cocok';
  end if;

  if not exists (
      select 1 from pg_class c
      where c.oid = 'utero_academy.daily_activity'::regclass
        and c.relkind = 'r' and c.relrowsecurity
        and pg_get_userbyid(c.relowner) = schema_owner
    ) or not exists (
      select 1 from pg_class c
      where c.oid = 'utero_academy.user_streaks'::regclass
        and c.relkind = 'r' and c.relrowsecurity
        and pg_get_userbyid(c.relowner) = schema_owner
    ) then
    raise exception '0051 dependency table RPC tidak cocok';
  end if;
end
$$;

revoke execute on function
  utero_academy.award_points(uuid,integer,character varying,uuid,text),
  utero_academy.can_attempt_quiz(uuid,uuid),
  utero_academy.check_and_award_badges(uuid,character varying),
  utero_academy.current_user_has_role(text),
  utero_academy.set_announcement_published_at(),
  utero_academy.set_updated_at(),
  utero_academy.update_daily_activity(uuid,character varying,integer,integer),
  utero_academy.update_updated_at_column(),
  utero_academy.update_user_streak(uuid)
from public, anon, authenticated, service_role;

grant execute on function utero_academy.current_user_has_role(text) to authenticated;

grant execute on function
  utero_academy.can_attempt_quiz(uuid,uuid),
  utero_academy.update_daily_activity(uuid,character varying,integer,integer),
  utero_academy.update_user_streak(uuid)
to service_role;

grant insert, update on table
  utero_academy.daily_activity,
  utero_academy.user_streaks
to service_role;

do $$
declare
  target record;
  actual boolean;
begin
  for target in select * from (values
      ('anon', 'award_points(uuid,integer,character varying,uuid,text)', false),
      ('anon', 'can_attempt_quiz(uuid,uuid)', false),
      ('anon', 'check_and_award_badges(uuid,character varying)', false),
      ('anon', 'current_user_has_role(text)', false),
      ('anon', 'set_announcement_published_at()', false),
      ('anon', 'set_updated_at()', false),
      ('anon', 'update_daily_activity(uuid,character varying,integer,integer)', false),
      ('anon', 'update_updated_at_column()', false),
      ('anon', 'update_user_streak(uuid)', false),
      ('authenticated', 'award_points(uuid,integer,character varying,uuid,text)', false),
      ('authenticated', 'can_attempt_quiz(uuid,uuid)', false),
      ('authenticated', 'check_and_award_badges(uuid,character varying)', false),
      ('authenticated', 'current_user_has_role(text)', true),
      ('authenticated', 'set_announcement_published_at()', false),
      ('authenticated', 'set_updated_at()', false),
      ('authenticated', 'update_daily_activity(uuid,character varying,integer,integer)', false),
      ('authenticated', 'update_updated_at_column()', false),
      ('authenticated', 'update_user_streak(uuid)', false),
      ('service_role', 'award_points(uuid,integer,character varying,uuid,text)', false),
      ('service_role', 'can_attempt_quiz(uuid,uuid)', true),
      ('service_role', 'check_and_award_badges(uuid,character varying)', false),
      ('service_role', 'current_user_has_role(text)', false),
      ('service_role', 'set_announcement_published_at()', false),
      ('service_role', 'set_updated_at()', false),
      ('service_role', 'update_daily_activity(uuid,character varying,integer,integer)', true),
      ('service_role', 'update_updated_at_column()', false),
      ('service_role', 'update_user_streak(uuid)', true)
    ) as allowed(role_name, signature, expected)
  loop
    actual := has_function_privilege(target.role_name,
      format('utero_academy.%s', target.signature), 'EXECUTE');
    if actual is distinct from target.expected then
      raise exception '0051 EXECUTE tidak cocok: % % expected %, actual %',
        target.role_name, target.signature, target.expected, actual;
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f'::"char", p.proowner))) a
    where p.oid in (
      'utero_academy.award_points(uuid,integer,character varying,uuid,text)'::regprocedure,
      'utero_academy.can_attempt_quiz(uuid,uuid)'::regprocedure,
      'utero_academy.check_and_award_badges(uuid,character varying)'::regprocedure,
      'utero_academy.current_user_has_role(text)'::regprocedure,
      'utero_academy.set_announcement_published_at()'::regprocedure,
      'utero_academy.set_updated_at()'::regprocedure,
      'utero_academy.update_daily_activity(uuid,character varying,integer,integer)'::regprocedure,
      'utero_academy.update_updated_at_column()'::regprocedure,
      'utero_academy.update_user_streak(uuid)'::regprocedure
    ) and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0051 PUBLIC EXECUTE masih ada';
  end if;

  if not has_table_privilege('service_role','utero_academy.daily_activity','INSERT')
     or not has_table_privilege('service_role','utero_academy.daily_activity','UPDATE')
     or not has_table_privilege('service_role','utero_academy.user_streaks','INSERT')
     or not has_table_privilege('service_role','utero_academy.user_streaks','UPDATE') then
    raise exception '0051 privilege dependency RPC belum efektif';
  end if;
end
$$;
