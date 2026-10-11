-- Foundation for registration, selection, onboarding, school monitoring, and notifications.
-- This migration is intentionally data-preserving and may be run more than once.

insert into utero_academy.roles (code, name, description)
values ('applicant', 'Applicant', 'Calon peserta yang sedang mengikuti pendaftaran dan seleksi.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

alter table utero_academy.roles
  add column if not exists is_assignable boolean not null default true;
update utero_academy.roles set is_assignable = true where code = 'applicant';

create or replace function utero_academy.provision_applicant_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare applicant_role_id uuid;
declare applicant_name text;
begin
  if coalesce(new.raw_user_meta_data ->> 'source_app', '') <> 'utero_academy_applicant' then
    return new;
  end if;
  applicant_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  if applicant_name is null then applicant_name := split_part(coalesce(new.email, new.id::text), '@', 1); end if;
  insert into utero_academy.user_profiles(id, full_name, is_active)
  values (new.id, applicant_name, true)
  on conflict (id) do update set full_name = excluded.full_name, updated_at = now();
  select id into applicant_role_id from utero_academy.roles where code = 'applicant';
  if applicant_role_id is null then raise exception 'Role applicant belum tersedia'; end if;
  insert into utero_academy.user_roles(user_id, role_id)
  select new.id, applicant_role_id
  where not exists (
    select 1 from utero_academy.user_roles ur
    where ur.user_id = new.id and ur.role_id = applicant_role_id and ur.scope_type is null and ur.scope_id is null
  );
  return new;
end $$;
revoke all on function utero_academy.provision_applicant_user() from public, anon, authenticated;
drop trigger if exists provision_utero_academy_applicant on auth.users;
create trigger provision_utero_academy_applicant
after insert on auth.users for each row execute function utero_academy.provision_applicant_user();

do $$
begin
  alter type utero_academy.application_status add value if not exists 'document_review';
  alter type utero_academy.application_status add value if not exists 'revision_requested';
  alter type utero_academy.application_status add value if not exists 'selection';
  alter type utero_academy.application_status add value if not exists 'waitlisted';
  alter type utero_academy.application_status add value if not exists 'converted';
exception when duplicate_object then null;
end $$;

do $$ begin
  create type utero_academy.partner_status as enum ('prospect', 'verified', 'active_partner', 'suspended', 'ended');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.application_source as enum ('self', 'school', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.selection_status as enum ('not_assigned', 'assigned', 'available', 'in_progress', 'submitted', 'grading', 'passed', 'failed', 'waitlisted', 'expired', 'bypassed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.onboarding_status as enum ('not_started', 'accepted_pending_onboarding', 'biodata_review', 'onboarding_complete', 'waiting_start', 'active', 'paused', 'completed', 'failed', 'alumni');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.selection_question_type as enum ('multiple_choice', 'true_false', 'short_answer', 'essay', 'file_upload');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.selection_attempt_status as enum ('not_started', 'in_progress', 'submitted', 'grading', 'graded', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.selection_decision_result as enum ('passed', 'failed', 'waitlisted', 'bypassed', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.document_review_status as enum ('pending', 'approved', 'revision_requested', 'rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type utero_academy.notification_status as enum ('pending', 'sent', 'failed', 'read', 'cancelled');
exception when duplicate_object then null; end $$;

alter table utero_academy.schools
  add column if not exists partner_status utero_academy.partner_status not null default 'prospect',
  add column if not exists referral_code text,
  add column if not exists referral_quota integer,
  add column if not exists referral_expires_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

alter table utero_academy.schools drop constraint if exists schools_referral_quota_check;
alter table utero_academy.schools add constraint schools_referral_quota_check check (referral_quota is null or referral_quota >= 0);
create unique index if not exists schools_referral_code_unique_idx on utero_academy.schools (upper(referral_code)) where referral_code is not null;
create index if not exists schools_partner_status_idx on utero_academy.schools (partner_status);

create table if not exists utero_academy.selection_tracks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  program_id uuid references utero_academy.programs(id) on delete set null,
  major_pattern text,
  passing_score numeric(6,2) not null default 70 check (passing_score between 0 and 100),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table utero_academy.internship_applications
  add column if not exists source utero_academy.application_source not null default 'self',
  add column if not exists applicant_user_id uuid references auth.users(id) on delete set null,
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists student_number text,
  add column if not exists proposed_start_date date,
  add column if not exists proposed_end_date date,
  add column if not exists approved_start_date date,
  add column if not exists approved_end_date date,
  add column if not exists selection_track_id uuid references utero_academy.selection_tracks(id) on delete set null,
  add column if not exists selection_status utero_academy.selection_status not null default 'not_assigned',
  add column if not exists onboarding_status utero_academy.onboarding_status not null default 'not_started',
  add column if not exists converted_intern_id uuid references utero_academy.intern_profiles(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists decided_at timestamptz,
  add column if not exists converted_at timestamptz;

alter table utero_academy.internship_applications drop constraint if exists internship_applications_proposed_dates_check;
alter table utero_academy.internship_applications add constraint internship_applications_proposed_dates_check check (proposed_end_date is null or proposed_start_date is null or proposed_end_date >= proposed_start_date);
alter table utero_academy.internship_applications drop constraint if exists internship_applications_approved_dates_check;
alter table utero_academy.internship_applications add constraint internship_applications_approved_dates_check check (approved_end_date is null or approved_start_date is null or approved_end_date >= approved_start_date);
create unique index if not exists internship_applications_applicant_open_unique_idx on utero_academy.internship_applications (applicant_user_id, program_id) where applicant_user_id is not null and status not in ('rejected', 'cancelled');
create unique index if not exists internship_applications_school_student_open_unique_idx on utero_academy.internship_applications (school_id, student_number, program_id) where school_id is not null and student_number is not null and status not in ('rejected', 'cancelled');
create index if not exists internship_applications_school_idx on utero_academy.internship_applications (school_id, created_at desc);
create index if not exists internship_applications_applicant_idx on utero_academy.internship_applications (applicant_user_id, created_at desc);
create index if not exists internship_applications_selection_idx on utero_academy.internship_applications (selection_status, selection_track_id);
create index if not exists internship_applications_onboarding_idx on utero_academy.internship_applications (onboarding_status, approved_start_date);

create or replace function utero_academy.protect_application_workflow_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('service_role', 'postgres') then return new; end if;
  if utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin') then return new; end if;
  if new.source is distinct from old.source
     or new.applicant_user_id is distinct from old.applicant_user_id
     or new.submitted_by_user_id is distinct from old.submitted_by_user_id
     or new.school_id is distinct from old.school_id
     or new.program_id is distinct from old.program_id
     or new.selection_track_id is distinct from old.selection_track_id
     or new.selection_status is distinct from old.selection_status
     or new.onboarding_status is distinct from old.onboarding_status
     or new.converted_intern_id is distinct from old.converted_intern_id
     or new.approved_start_date is distinct from old.approved_start_date
     or new.approved_end_date is distinct from old.approved_end_date
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.decided_at is distinct from old.decided_at
     or new.converted_at is distinct from old.converted_at then
    raise exception 'Field workflow pendaftaran hanya dapat diubah staf' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function utero_academy.protect_application_workflow_fields() from public, anon, authenticated;
drop trigger if exists protect_application_workflow_fields on utero_academy.internship_applications;
create trigger protect_application_workflow_fields before update on utero_academy.internship_applications
for each row execute function utero_academy.protect_application_workflow_fields();

create table if not exists utero_academy.selection_materials (
  id uuid primary key default gen_random_uuid(), track_id uuid not null references utero_academy.selection_tracks(id) on delete cascade,
  title text not null, content jsonb not null default '{}'::jsonb, attachment_path text,
  order_index integer not null default 0, is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists utero_academy.selection_test_packages (
  id uuid primary key default gen_random_uuid(), track_id uuid not null references utero_academy.selection_tracks(id) on delete restrict,
  code text not null, title text not null, description text, version integer not null default 1 check (version > 0),
  duration_minutes integer not null check (duration_minutes > 0), max_attempts integer not null default 1 check (max_attempts > 0),
  passing_score numeric(6,2) not null default 70 check (passing_score between 0 and 100),
  available_from timestamptz, available_until timestamptz, randomize_questions boolean not null default true,
  randomize_options boolean not null default true, is_published boolean not null default false, published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (code, version), check (available_until is null or available_from is null or available_until >= available_from)
);

create table if not exists utero_academy.selection_questions (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references utero_academy.selection_test_packages(id) on delete cascade,
  question_type utero_academy.selection_question_type not null, prompt jsonb not null, explanation jsonb,
  points numeric(8,2) not null default 1 check (points >= 0), order_index integer not null default 0,
  is_required boolean not null default true, answer_key jsonb, grading_rubric jsonb,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists utero_academy.selection_question_options (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references utero_academy.selection_questions(id) on delete cascade,
  label text not null, content jsonb not null, is_correct boolean not null default false, order_index integer not null default 0,
  created_at timestamptz not null default now(), unique (question_id, label)
);

create table if not exists utero_academy.selection_assignments (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references utero_academy.internship_applications(id) on delete cascade,
  package_id uuid not null references utero_academy.selection_test_packages(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null, assigned_at timestamptz not null default now(),
  available_from timestamptz, due_at timestamptz, max_attempts integer not null default 1 check (max_attempts > 0),
  status utero_academy.selection_status not null default 'assigned', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (application_id, package_id), check (due_at is null or available_from is null or due_at >= available_from)
);

create table if not exists utero_academy.selection_attempts (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references utero_academy.selection_assignments(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete restrict, attempt_number integer not null check (attempt_number > 0),
  status utero_academy.selection_attempt_status not null default 'not_started', started_at timestamptz, submitted_at timestamptz,
  expires_at timestamptz, auto_score numeric(8,2), manual_score numeric(8,2), final_score numeric(8,2),
  device_metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (assignment_id, attempt_number), check (submitted_at is null or started_at is null or submitted_at >= started_at)
);

create table if not exists utero_academy.selection_answers (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references utero_academy.selection_attempts(id) on delete cascade,
  question_id uuid not null references utero_academy.selection_questions(id) on delete restrict,
  selected_option_ids uuid[] not null default '{}', answer_text text, answer_payload jsonb, attachment_path text,
  auto_score numeric(8,2), manual_score numeric(8,2), is_final boolean not null default false,
  answered_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists utero_academy.selection_grades (
  id uuid primary key default gen_random_uuid(), answer_id uuid not null references utero_academy.selection_answers(id) on delete cascade,
  grader_user_id uuid references auth.users(id) on delete set null, score numeric(8,2) not null check (score >= 0),
  feedback text, rubric_scores jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (answer_id, grader_user_id)
);

create table if not exists utero_academy.selection_decisions (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references utero_academy.internship_applications(id) on delete restrict,
  attempt_id uuid references utero_academy.selection_attempts(id) on delete set null,
  result utero_academy.selection_decision_result not null, final_score numeric(8,2), public_note text, internal_note text,
  decided_by uuid not null references auth.users(id) on delete restrict, decided_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);

create table if not exists utero_academy.selection_bypasses (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references utero_academy.internship_applications(id) on delete restrict,
  assignment_id uuid references utero_academy.selection_assignments(id) on delete set null,
  reason text not null check (length(btrim(reason)) >= 10), supporting_document_path text,
  bypassed_by uuid not null references auth.users(id) on delete restrict, bypassed_at timestamptz not null default now(), revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict, revoke_reason text,
  check ((revoked_at is null and revoked_by is null and revoke_reason is null) or (revoked_at is not null and revoked_by is not null and length(btrim(revoke_reason)) >= 10))
);
create unique index if not exists selection_bypasses_active_unique_idx on utero_academy.selection_bypasses(application_id) where revoked_at is null;

create table if not exists utero_academy.application_document_requirements (
  id uuid primary key default gen_random_uuid(), code text not null, name text not null, description text,
  program_id uuid references utero_academy.programs(id) on delete cascade, selection_track_id uuid references utero_academy.selection_tracks(id) on delete cascade,
  application_source utero_academy.application_source, is_required boolean not null default true, allowed_mime_types text[] not null default '{}',
  max_file_size_bytes bigint check (max_file_size_bytes is null or max_file_size_bytes > 0), is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists application_document_requirements_scope_unique_idx on utero_academy.application_document_requirements (code, coalesce(program_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(selection_track_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(application_source, 'self'::utero_academy.application_source));

create table if not exists utero_academy.application_documents (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references utero_academy.internship_applications(id) on delete cascade,
  requirement_id uuid references utero_academy.application_document_requirements(id) on delete set null,
  document_code text not null, file_path text not null, file_name text, mime_type text, file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  review_status utero_academy.document_review_status not null default 'pending', review_note text,
  uploaded_by uuid references auth.users(id) on delete set null, reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists application_documents_application_idx on utero_academy.application_documents(application_id, document_code);

create table if not exists utero_academy.application_notifications (
  id uuid primary key default gen_random_uuid(), application_id uuid references utero_academy.internship_applications(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade, recipient_email text, channel text not null default 'in_app' check (channel in ('in_app', 'email', 'whatsapp')),
  template_code text not null, subject text, payload jsonb not null default '{}'::jsonb,
  status utero_academy.notification_status not null default 'pending', scheduled_at timestamptz, sent_at timestamptz, read_at timestamptz,
  error_message text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (recipient_user_id is not null or recipient_email is not null)
);
create index if not exists application_notifications_recipient_idx on utero_academy.application_notifications(recipient_user_id, status, created_at desc);
create index if not exists selection_assignments_application_idx on utero_academy.selection_assignments(application_id, status);
create index if not exists selection_attempts_applicant_idx on utero_academy.selection_attempts(applicant_user_id, status);
create index if not exists selection_answers_attempt_idx on utero_academy.selection_answers(attempt_id);
create index if not exists selection_decisions_application_idx on utero_academy.selection_decisions(application_id, decided_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['selection_tracks','selection_materials','selection_test_packages','selection_questions','selection_question_options','selection_assignments','selection_attempts','selection_answers','selection_grades','selection_decisions','selection_bypasses','application_document_requirements','application_documents','application_notifications']
  loop
    execute format('alter table utero_academy.%I enable row level security', table_name);
  end loop;
end $$;

create or replace function utero_academy.current_user_school_ids()
returns setof uuid language sql stable security invoker set search_path = '' as $$
  select sc.school_id from utero_academy.school_contacts sc where sc.user_id = auth.uid()
$$;
revoke all on function utero_academy.current_user_school_ids() from public, anon;
grant execute on function utero_academy.current_user_school_ids() to authenticated;

drop policy if exists internship_applications_access_select on utero_academy.internship_applications;
create policy internship_applications_access_select on utero_academy.internship_applications for select to authenticated using (
  applicant_user_id = (select auth.uid()) or submitted_by_user_id = (select auth.uid())
  or school_id in (select utero_academy.current_user_school_ids())
  or utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin')
);
drop policy if exists internship_applications_public_insert on utero_academy.internship_applications;
revoke insert on table utero_academy.internship_applications from anon;
drop policy if exists internship_applications_applicant_insert on utero_academy.internship_applications;
create policy internship_applications_applicant_insert on utero_academy.internship_applications for insert to authenticated
with check (source = 'self' and applicant_user_id = (select auth.uid()) and submitted_by_user_id = (select auth.uid()) and school_id is null);
drop policy if exists internship_applications_applicant_update on utero_academy.internship_applications;
create policy internship_applications_applicant_update on utero_academy.internship_applications for update to authenticated
using (applicant_user_id = (select auth.uid()) and status::text in ('draft', 'revision_requested'))
with check (applicant_user_id = (select auth.uid()) and status::text in ('draft', 'submitted'));
drop policy if exists internship_applications_school_insert on utero_academy.internship_applications;
create policy internship_applications_school_insert on utero_academy.internship_applications for insert to authenticated with check (
  source = 'school' and submitted_by_user_id = (select auth.uid()) and school_id in (select utero_academy.current_user_school_ids())
  and exists (select 1 from utero_academy.schools school where school.id = school_id and school.partner_status in ('verified', 'active_partner'))
);

do $$
declare table_name text;
begin
  foreach table_name in array array['selection_tracks','selection_materials','selection_test_packages','selection_questions','selection_question_options','selection_assignments','selection_grades','application_document_requirements']
  loop
    execute format('drop policy if exists %I on utero_academy.%I', table_name || '_staff_all', table_name);
    execute format('create policy %I on utero_academy.%I for all to authenticated using (utero_academy.current_user_has_role(''admin'') or utero_academy.current_user_has_role(''super_admin'')) with check (utero_academy.current_user_has_role(''admin'') or utero_academy.current_user_has_role(''super_admin''))', table_name || '_staff_all', table_name);
  end loop;
end $$;

drop policy if exists selection_decisions_staff_select on utero_academy.selection_decisions;
create policy selection_decisions_staff_select on utero_academy.selection_decisions for select to authenticated
using (utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin'));
drop policy if exists selection_decisions_staff_insert on utero_academy.selection_decisions;
create policy selection_decisions_staff_insert on utero_academy.selection_decisions for insert to authenticated
with check (decided_by = (select auth.uid()) and (utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin')));

do $$
declare table_name text;
begin
  foreach table_name in array array['selection_attempts','selection_answers','application_documents','application_notifications']
  loop
    execute format('drop policy if exists %I on utero_academy.%I', table_name || '_staff_all', table_name);
    execute format('create policy %I on utero_academy.%I for all to authenticated using (utero_academy.current_user_has_role(''admin'') or utero_academy.current_user_has_role(''super_admin'')) with check (utero_academy.current_user_has_role(''admin'') or utero_academy.current_user_has_role(''super_admin''))', table_name || '_staff_all', table_name);
  end loop;
end $$;

drop policy if exists selection_assignments_applicant_select on utero_academy.selection_assignments;
create policy selection_assignments_applicant_select on utero_academy.selection_assignments for select to authenticated using (exists (select 1 from utero_academy.internship_applications a where a.id = application_id and a.applicant_user_id = (select auth.uid())));
drop policy if exists selection_attempts_applicant_select on utero_academy.selection_attempts;
create policy selection_attempts_applicant_select on utero_academy.selection_attempts for select to authenticated using (applicant_user_id = (select auth.uid()));
drop policy if exists selection_attempts_applicant_insert on utero_academy.selection_attempts;
create policy selection_attempts_applicant_insert on utero_academy.selection_attempts for insert to authenticated with check (applicant_user_id = (select auth.uid()) and auto_score is null and manual_score is null and final_score is null);
drop policy if exists selection_attempts_applicant_update on utero_academy.selection_attempts;
create policy selection_attempts_applicant_update on utero_academy.selection_attempts for update to authenticated using (applicant_user_id = (select auth.uid())) with check (applicant_user_id = (select auth.uid()));
drop policy if exists selection_answers_applicant_select on utero_academy.selection_answers;
create policy selection_answers_applicant_select on utero_academy.selection_answers for select to authenticated using (exists (select 1 from utero_academy.selection_attempts sa where sa.id = attempt_id and sa.applicant_user_id = (select auth.uid())));
drop policy if exists selection_answers_applicant_insert on utero_academy.selection_answers;
create policy selection_answers_applicant_insert on utero_academy.selection_answers for insert to authenticated with check (auto_score is null and manual_score is null and exists (select 1 from utero_academy.selection_attempts sa where sa.id = attempt_id and sa.applicant_user_id = (select auth.uid())));
drop policy if exists selection_answers_applicant_update on utero_academy.selection_answers;
create policy selection_answers_applicant_update on utero_academy.selection_answers for update to authenticated using (exists (select 1 from utero_academy.selection_attempts sa where sa.id = attempt_id and sa.applicant_user_id = (select auth.uid()))) with check (exists (select 1 from utero_academy.selection_attempts sa where sa.id = attempt_id and sa.applicant_user_id = (select auth.uid())));
-- No participant SELECT on the base table: internal_note and metadata are staff-only.
drop policy if exists selection_decisions_participant_select on utero_academy.selection_decisions;
drop policy if exists application_documents_owner_select on utero_academy.application_documents;
create policy application_documents_owner_select on utero_academy.application_documents for select to authenticated using (exists (select 1 from utero_academy.internship_applications a where a.id = application_id and (a.applicant_user_id = (select auth.uid()) or a.school_id in (select utero_academy.current_user_school_ids()) or utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin'))));
drop policy if exists application_documents_owner_insert on utero_academy.application_documents;
create policy application_documents_owner_insert on utero_academy.application_documents for insert to authenticated with check (uploaded_by = (select auth.uid()) and review_status = 'pending' and reviewed_by is null and reviewed_at is null and exists (select 1 from utero_academy.internship_applications a where a.id = application_id and (a.applicant_user_id = (select auth.uid()) or a.school_id in (select utero_academy.current_user_school_ids()))));
drop policy if exists application_notifications_recipient_select on utero_academy.application_notifications;
create policy application_notifications_recipient_select on utero_academy.application_notifications for select to authenticated using (recipient_user_id = (select auth.uid()) or utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin'));
drop policy if exists application_notifications_recipient_update on utero_academy.application_notifications;
create policy application_notifications_recipient_update on utero_academy.application_notifications for update to authenticated using (recipient_user_id = (select auth.uid())) with check (recipient_user_id = (select auth.uid()));

create or replace function utero_academy.bypass_selection(p_application_id uuid, p_reason text, p_assignment_id uuid default null, p_supporting_document_path text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare bypass_id uuid;
begin
  if auth.uid() is null or not utero_academy.current_user_has_role('super_admin') then raise exception 'Hanya super admin yang dapat melakukan bypass seleksi' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'Alasan bypass minimal 10 karakter'; end if;
  if not exists (select 1 from utero_academy.internship_applications where id = p_application_id) then raise exception 'Pendaftaran tidak ditemukan'; end if;
  insert into utero_academy.selection_bypasses(application_id, assignment_id, reason, supporting_document_path, bypassed_by)
  values (p_application_id, p_assignment_id, btrim(p_reason), p_supporting_document_path, auth.uid()) returning id into bypass_id;
  insert into utero_academy.selection_decisions(application_id, result, public_note, internal_note, decided_by, metadata)
  values (p_application_id, 'bypassed', 'Lolos melalui keputusan khusus Utero Academy.', btrim(p_reason), auth.uid(), jsonb_build_object('bypass_id', bypass_id));
  update utero_academy.internship_applications set selection_status = 'bypassed', decided_at = now(), updated_at = now() where id = p_application_id;
  return bypass_id;
end $$;
revoke all on function utero_academy.bypass_selection(uuid,text,uuid,text) from public, anon;
grant execute on function utero_academy.bypass_selection(uuid,text,uuid,text) to authenticated;

create or replace function utero_academy.visible_selection_results(p_application_id uuid)
returns table (decision_id uuid, result utero_academy.selection_decision_result, final_score numeric, public_note text, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from utero_academy.internship_applications a
    where a.id = p_application_id and (
      a.applicant_user_id = auth.uid()
      or exists (select 1 from utero_academy.school_contacts sc where sc.school_id = a.school_id and sc.user_id = auth.uid())
      or utero_academy.current_user_has_role('admin')
      or utero_academy.current_user_has_role('super_admin')
    )
  ) then raise exception 'Akses hasil seleksi ditolak' using errcode = '42501'; end if;
  return query select sd.id, sd.result, sd.final_score, sd.public_note, sd.decided_at
  from utero_academy.selection_decisions sd where sd.application_id = p_application_id order by sd.decided_at desc;
end $$;
revoke all on function utero_academy.visible_selection_results(uuid) from public, anon;
grant execute on function utero_academy.visible_selection_results(uuid) to authenticated;

create or replace function utero_academy.accept_application_as_intern(
  p_application_id uuid,
  p_start_date date,
  p_end_date date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare application_row utero_academy.internship_applications%rowtype;
declare intern_role_id uuid;
declare intern_id uuid;
begin
  if auth.uid() is null or not (utero_academy.current_user_has_role('admin') or utero_academy.current_user_has_role('super_admin')) then
    raise exception 'Hanya admin yang dapat menerima peserta' using errcode = '42501';
  end if;
  if p_end_date < p_start_date then raise exception 'Tanggal selesai tidak valid'; end if;
  select * into application_row from utero_academy.internship_applications where id = p_application_id for update;
  if application_row.id is null then raise exception 'Pendaftaran tidak ditemukan'; end if;
  if application_row.applicant_user_id is null then raise exception 'Akun pelamar belum terhubung'; end if;
  if application_row.selection_status::text not in ('passed', 'bypassed') then raise exception 'Peserta belum dinyatakan lolos seleksi'; end if;
  select id into intern_role_id from utero_academy.roles where code = 'intern';
  insert into utero_academy.user_roles(user_id, role_id)
  select application_row.applicant_user_id, intern_role_id
  where not exists (select 1 from utero_academy.user_roles where user_id = application_row.applicant_user_id and role_id = intern_role_id and scope_type is null and scope_id is null);
  insert into utero_academy.intern_profiles(user_id, school_id, full_name, email, phone, major, status, start_date, end_date, school_name)
  values (application_row.applicant_user_id, application_row.school_id, application_row.full_name, application_row.email, application_row.phone, application_row.major, 'pending', p_start_date, p_end_date, application_row.school_name)
  on conflict (user_id) do update set school_id = excluded.school_id, full_name = excluded.full_name, email = excluded.email,
    phone = excluded.phone, major = excluded.major, start_date = excluded.start_date, end_date = excluded.end_date, updated_at = now()
  returning id into intern_id;
  update utero_academy.internship_applications set status = 'accepted', onboarding_status = 'accepted_pending_onboarding',
    approved_start_date = p_start_date, approved_end_date = p_end_date, converted_intern_id = intern_id,
    reviewed_by = auth.uid(), reviewed_at = now(), decided_at = now(), converted_at = now(), updated_at = now()
  where id = p_application_id;
  insert into utero_academy.application_notifications(application_id, recipient_user_id, channel, template_code, subject, payload, status)
  values (p_application_id, application_row.applicant_user_id, 'in_app', 'application_accepted', 'Pendaftaran diterima',
    jsonb_build_object('message', 'Lengkapi dan cocokkan biodata. Fitur magang aktif pada tanggal mulai resmi.'), 'pending');
  return intern_id;
end $$;
revoke all on function utero_academy.accept_application_as_intern(uuid,date,date) from public, anon;
grant execute on function utero_academy.accept_application_as_intern(uuid,date,date) to authenticated;

create or replace function utero_academy.enqueue_selection_decision_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient_id uuid;
begin
  select applicant_user_id into recipient_id from utero_academy.internship_applications where id = new.application_id;
  if recipient_id is not null then
    insert into utero_academy.application_notifications(application_id, recipient_user_id, channel, template_code, subject, payload, status, created_by)
    values (new.application_id, recipient_id, 'in_app', 'selection_decision', 'Hasil seleksi tersedia',
      jsonb_build_object('result', new.result, 'public_note', new.public_note, 'decided_at', new.decided_at), 'pending', new.decided_by);
  end if;
  return new;
end $$;
revoke all on function utero_academy.enqueue_selection_decision_notification() from public, anon, authenticated;
drop trigger if exists enqueue_selection_decision_notification on utero_academy.selection_decisions;
create trigger enqueue_selection_decision_notification after insert on utero_academy.selection_decisions
for each row execute function utero_academy.enqueue_selection_decision_notification();

revoke all on table utero_academy.selection_bypasses from anon, authenticated;
grant select, insert, update on table utero_academy.internship_applications to authenticated;
grant select, insert on table utero_academy.selection_attempts, utero_academy.selection_answers, utero_academy.application_documents to authenticated;
grant update (status, started_at, submitted_at, expires_at, device_metadata, updated_at) on table utero_academy.selection_attempts to authenticated;
grant update (selected_option_ids, answer_text, answer_payload, attachment_path, is_final, answered_at, updated_at) on table utero_academy.selection_answers to authenticated;
grant select, update (status, read_at, updated_at) on table utero_academy.application_notifications to authenticated;
grant select on table utero_academy.selection_tracks, utero_academy.selection_materials, utero_academy.selection_test_packages, utero_academy.selection_assignments, utero_academy.selection_grades, utero_academy.selection_decisions, utero_academy.application_document_requirements to authenticated;
revoke select on table utero_academy.selection_questions, utero_academy.selection_question_options from authenticated;
grant select (id, package_id, question_type, prompt, points, order_index, is_required) on table utero_academy.selection_questions to authenticated;
grant select (id, question_id, label, content, order_index) on table utero_academy.selection_question_options to authenticated;
grant insert, update, delete on table utero_academy.selection_tracks, utero_academy.selection_materials, utero_academy.selection_test_packages, utero_academy.selection_questions, utero_academy.selection_question_options, utero_academy.selection_assignments, utero_academy.selection_grades, utero_academy.selection_decisions, utero_academy.application_document_requirements to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['selection_tracks','selection_materials','selection_test_packages','selection_questions','selection_assignments','selection_attempts','selection_answers','selection_grades','application_document_requirements','application_documents','application_notifications']
  loop
    if not exists (select 1 from pg_trigger where tgname = 'set_' || table_name || '_updated_at' and tgrelid = format('utero_academy.%I', table_name)::regclass) then
      execute format('create trigger %I before update on utero_academy.%I for each row execute function utero_academy.set_updated_at()', 'set_' || table_name || '_updated_at', table_name);
    end if;
  end loop;
end $$;
