revoke select on utero_academy.schools from authenticated;

create or replace function utero_academy.lookup_referral_school(p_code text)
returns table(id uuid, name text, referral_quota integer, referral_expires_at timestamptz, partner_status utero_academy.partner_status)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_code is null or length(p_code) > 80 then return; end if;
  return query
    select s.id, s.name, s.referral_quota, s.referral_expires_at, s.partner_status
    from utero_academy.schools s
    where upper(s.referral_code) = upper(p_code)
      and s.partner_status in ('verified', 'active_partner')
      and (s.referral_expires_at is null or s.referral_expires_at > now())
    for update of s;
end $$;

create or replace function utero_academy.referral_school_active(p_school_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from utero_academy.schools s
    where s.id = p_school_id and s.partner_status in ('verified', 'active_partner')
      and (s.referral_expires_at is null or s.referral_expires_at > now())
  )
$$;

revoke all on function utero_academy.lookup_referral_school(text) from public, anon;
revoke all on function utero_academy.referral_school_active(uuid) from public, anon;
grant execute on function utero_academy.lookup_referral_school(text) to authenticated;
grant execute on function utero_academy.referral_school_active(uuid) to authenticated;

create policy academy_applicant_referral_insert on utero_academy.internship_applications
  for insert to authenticated
  with check (
    source = 'self' and school_id is not null
    and applicant_user_id = auth.uid() and submitted_by_user_id = auth.uid()
    and utero_academy.referral_school_active(school_id)
  );
