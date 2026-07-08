create table if not exists utero_academy.school_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references utero_academy.schools(id) on delete cascade,
  report_type text not null check (report_type in ('weekly', 'monthly', 'semester')),
  period_start date not null,
  period_end date not null,
  generated_by uuid references auth.users(id) on delete set null,
  file_path text,
  file_size bigint,
  total_students integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_school_reports_school_id on utero_academy.school_reports(school_id);
create index if not exists idx_school_reports_period on utero_academy.school_reports(period_start, period_end);
create index if not exists idx_school_reports_created_at on utero_academy.school_reports(created_at desc);

alter table utero_academy.school_reports enable row level security;

drop policy if exists school_reports_select_own_school on utero_academy.school_reports;
create policy school_reports_select_own_school
on utero_academy.school_reports
for select
using (
  exists (
    select 1
    from utero_academy.school_contacts sc
    where sc.school_id = school_reports.school_id
      and sc.user_id = auth.uid()
  )
);

drop policy if exists school_reports_admin_all on utero_academy.school_reports;
create policy school_reports_admin_all
on utero_academy.school_reports
for all
using (utero_academy.has_role(auth.uid(), 'admin'))
with check (utero_academy.has_role(auth.uid(), 'admin'));

drop trigger if exists set_school_reports_updated_at on utero_academy.school_reports;
create trigger set_school_reports_updated_at
before update on utero_academy.school_reports
for each row execute function utero_academy.set_updated_at();

grant all privileges on table utero_academy.school_reports to service_role;
grant select on table utero_academy.school_reports to authenticated;
