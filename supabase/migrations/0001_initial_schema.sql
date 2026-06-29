create extension if not exists "pgcrypto";

create type utero_academy.application_status as enum (
  'draft',
  'submitted',
  'reviewed',
  'accepted',
  'rejected',
  'cancelled'
);

create type utero_academy.internship_status as enum (
  'pending',
  'active',
  'paused',
  'completed',
  'failed',
  'alumni'
);

create type utero_academy.report_status as enum (
  'submitted',
  'approved',
  'revision_requested'
);

create type utero_academy.attendance_status as enum (
  'pending',
  'valid',
  'invalid',
  'manual_review'
);

create type utero_academy.assessment_status as enum (
  'draft',
  'submitted',
  'finalized'
);

create type utero_academy.certificate_status as enum (
  'pending',
  'generated',
  'signed',
  'issued',
  'revoked'
);

create type utero_academy.publish_status as enum (
  'draft',
  'published',
  'archived'
);

create or replace function utero_academy.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table utero_academy.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table utero_academy.role_permissions (
  role_id uuid not null references utero_academy.roles(id) on delete cascade,
  permission_id uuid not null references utero_academy.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table utero_academy.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references utero_academy.roles(id) on delete cascade,
  scope_type text,
  scope_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role_id, scope_type, scope_id)
);

create table utero_academy.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  city text,
  province text,
  address text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.school_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references utero_academy.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.mentor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  headline text,
  bio text,
  expertise text[] not null default '{}',
  photo_path text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.intern_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  school_id uuid references utero_academy.schools(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  major text,
  grade_or_semester text,
  status utero_academy.internship_status not null default 'pending',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  type text not null default 'internship',
  status utero_academy.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.curriculums (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references utero_academy.programs(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.batches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references utero_academy.programs(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  capacity integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.classes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references utero_academy.batches(id) on delete cascade,
  name text not null,
  mentor_id uuid references utero_academy.mentor_profiles(id) on delete set null,
  schedule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references utero_academy.classes(id) on delete cascade,
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (class_id, intern_id)
);

create table utero_academy.internship_applications (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references utero_academy.programs(id) on delete set null,
  school_id uuid references utero_academy.schools(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  school_name text,
  major text,
  motivation text,
  status utero_academy.application_status not null default 'submitted',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references utero_academy.mentor_profiles(id) on delete cascade,
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  started_at date not null default current_date,
  ended_at date,
  created_at timestamptz not null default now(),
  unique (mentor_id, intern_id, started_at)
);

create table utero_academy.courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references utero_academy.programs(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  status utero_academy.publish_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references utero_academy.courses(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  video_url text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references utero_academy.courses(id) on delete cascade,
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (course_id, intern_id)
);

create table utero_academy.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references utero_academy.lessons(id) on delete cascade,
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  completed_at timestamptz,
  progress_percent numeric(5,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (lesson_id, intern_id)
);

create table utero_academy.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references utero_academy.courses(id) on delete cascade,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  passing_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references utero_academy.quizzes(id) on delete cascade,
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  score numeric(5,2),
  submitted_at timestamptz not null default now()
);

create table utero_academy.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references utero_academy.courses(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references utero_academy.assignments(id) on delete cascade,
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  content text,
  attachment_path text,
  score numeric(5,2),
  feedback text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table utero_academy.task_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.task_lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references utero_academy.task_boards(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.task_cards (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references utero_academy.task_lists(id) on delete cascade,
  intern_id uuid references utero_academy.intern_profiles(id) on delete set null,
  mentor_id uuid references utero_academy.mentor_profiles(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  order_index integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.task_checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references utero_academy.task_cards(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.task_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references utero_academy.task_cards(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table utero_academy.task_attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references utero_academy.task_cards(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table utero_academy.attendances (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  attendance_date date not null,
  check_in_at timestamptz,
  check_in_latitude numeric(10,7),
  check_in_longitude numeric(10,7),
  check_in_selfie_path text,
  check_in_wifi_ssid text,
  check_out_at timestamptz,
  check_out_latitude numeric(10,7),
  check_out_longitude numeric(10,7),
  check_out_selfie_path text,
  check_out_wifi_ssid text,
  status utero_academy.attendance_status not null default 'pending',
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intern_id, attendance_date)
);

create table utero_academy.daily_reports (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  report_date date not null,
  today_work text not null,
  progress text,
  blockers text,
  tomorrow_plan text,
  status utero_academy.report_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intern_id, report_date)
);

create table utero_academy.daily_report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references utero_academy.daily_reports(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table utero_academy.daily_report_reviews (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references utero_academy.daily_reports(id) on delete cascade,
  mentor_id uuid not null references utero_academy.mentor_profiles(id) on delete cascade,
  status utero_academy.report_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table utero_academy.assessments (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  mentor_id uuid references utero_academy.mentor_profiles(id) on delete set null,
  score jsonb not null default '{}'::jsonb,
  final_score numeric(5,2),
  feedback text,
  status utero_academy.assessment_status not null default 'draft',
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.certificates (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references utero_academy.assessments(id) on delete cascade,
  intern_id uuid not null references utero_academy.intern_profiles(id) on delete cascade,
  certificate_number text unique,
  file_path text,
  status utero_academy.certificate_status not null default 'pending',
  issued_at timestamptz,
  signed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.cms_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.cms_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references utero_academy.cms_sites(id) on delete cascade,
  title text not null,
  slug text not null,
  seo jsonb not null default '{}'::jsonb,
  status utero_academy.publish_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table utero_academy.cms_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references utero_academy.cms_pages(id) on delete cascade,
  section_type text not null,
  title text,
  content jsonb not null default '{}'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.cms_navigation_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references utero_academy.cms_sites(id) on delete cascade,
  label text not null,
  href text not null,
  parent_id uuid references utero_academy.cms_navigation_items(id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.article_categories (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references utero_academy.cms_sites(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table utero_academy.articles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references utero_academy.cms_sites(id) on delete cascade,
  category_id uuid references utero_academy.article_categories(id) on delete set null,
  title text not null,
  slug text not null,
  excerpt text,
  content jsonb not null default '{}'::jsonb,
  cover_path text,
  seo jsonb not null default '{}'::jsonb,
  status utero_academy.publish_status not null default 'draft',
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table utero_academy.faqs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references utero_academy.cms_sites(id) on delete cascade,
  question text not null,
  answer text not null,
  order_index integer not null default 0,
  status utero_academy.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.testimonials (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references utero_academy.cms_sites(id) on delete cascade,
  name text not null,
  role text,
  quote text not null,
  photo_path text,
  order_index integer not null default 0,
  status utero_academy.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.galleries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references utero_academy.cms_sites(id) on delete cascade,
  title text not null,
  image_path text not null,
  description text,
  order_index integer not null default 0,
  status utero_academy.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table utero_academy.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  previous_value jsonb,
  next_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_user_roles_user_id on utero_academy.user_roles(user_id);
create unique index idx_user_roles_global_unique
on utero_academy.user_roles(user_id, role_id)
where scope_type is null and scope_id is null;

create unique index idx_user_roles_scoped_unique
on utero_academy.user_roles(user_id, role_id, scope_type, scope_id)
where scope_type is not null and scope_id is not null;

create index idx_intern_profiles_school_id on utero_academy.intern_profiles(school_id);
create index idx_mentor_assignments_mentor_id on utero_academy.mentor_assignments(mentor_id);
create index idx_mentor_assignments_intern_id on utero_academy.mentor_assignments(intern_id);
create index idx_internship_applications_status on utero_academy.internship_applications(status);
create index idx_task_cards_intern_id on utero_academy.task_cards(intern_id);
create index idx_task_cards_mentor_id on utero_academy.task_cards(mentor_id);
create index idx_attendances_intern_date on utero_academy.attendances(intern_id, attendance_date);
create index idx_daily_reports_intern_date on utero_academy.daily_reports(intern_id, report_date);
create index idx_articles_site_status on utero_academy.articles(site_id, status);
create index idx_audit_logs_resource on utero_academy.audit_logs(resource_type, resource_id);

create trigger set_user_profiles_updated_at before update on utero_academy.user_profiles for each row execute function utero_academy.set_updated_at();
create trigger set_roles_updated_at before update on utero_academy.roles for each row execute function utero_academy.set_updated_at();
create trigger set_schools_updated_at before update on utero_academy.schools for each row execute function utero_academy.set_updated_at();
create trigger set_school_contacts_updated_at before update on utero_academy.school_contacts for each row execute function utero_academy.set_updated_at();
create trigger set_mentor_profiles_updated_at before update on utero_academy.mentor_profiles for each row execute function utero_academy.set_updated_at();
create trigger set_intern_profiles_updated_at before update on utero_academy.intern_profiles for each row execute function utero_academy.set_updated_at();
create trigger set_programs_updated_at before update on utero_academy.programs for each row execute function utero_academy.set_updated_at();
create trigger set_curriculums_updated_at before update on utero_academy.curriculums for each row execute function utero_academy.set_updated_at();
create trigger set_batches_updated_at before update on utero_academy.batches for each row execute function utero_academy.set_updated_at();
create trigger set_classes_updated_at before update on utero_academy.classes for each row execute function utero_academy.set_updated_at();
create trigger set_internship_applications_updated_at before update on utero_academy.internship_applications for each row execute function utero_academy.set_updated_at();
create trigger set_courses_updated_at before update on utero_academy.courses for each row execute function utero_academy.set_updated_at();
create trigger set_lessons_updated_at before update on utero_academy.lessons for each row execute function utero_academy.set_updated_at();
create trigger set_quizzes_updated_at before update on utero_academy.quizzes for each row execute function utero_academy.set_updated_at();
create trigger set_assignments_updated_at before update on utero_academy.assignments for each row execute function utero_academy.set_updated_at();
create trigger set_task_boards_updated_at before update on utero_academy.task_boards for each row execute function utero_academy.set_updated_at();
create trigger set_task_lists_updated_at before update on utero_academy.task_lists for each row execute function utero_academy.set_updated_at();
create trigger set_task_cards_updated_at before update on utero_academy.task_cards for each row execute function utero_academy.set_updated_at();
create trigger set_task_checklists_updated_at before update on utero_academy.task_checklists for each row execute function utero_academy.set_updated_at();
create trigger set_attendances_updated_at before update on utero_academy.attendances for each row execute function utero_academy.set_updated_at();
create trigger set_daily_reports_updated_at before update on utero_academy.daily_reports for each row execute function utero_academy.set_updated_at();
create trigger set_assessments_updated_at before update on utero_academy.assessments for each row execute function utero_academy.set_updated_at();
create trigger set_certificates_updated_at before update on utero_academy.certificates for each row execute function utero_academy.set_updated_at();
create trigger set_cms_sites_updated_at before update on utero_academy.cms_sites for each row execute function utero_academy.set_updated_at();
create trigger set_cms_pages_updated_at before update on utero_academy.cms_pages for each row execute function utero_academy.set_updated_at();
create trigger set_cms_sections_updated_at before update on utero_academy.cms_sections for each row execute function utero_academy.set_updated_at();
create trigger set_cms_navigation_items_updated_at before update on utero_academy.cms_navigation_items for each row execute function utero_academy.set_updated_at();
create trigger set_article_categories_updated_at before update on utero_academy.article_categories for each row execute function utero_academy.set_updated_at();
create trigger set_articles_updated_at before update on utero_academy.articles for each row execute function utero_academy.set_updated_at();
create trigger set_faqs_updated_at before update on utero_academy.faqs for each row execute function utero_academy.set_updated_at();
create trigger set_testimonials_updated_at before update on utero_academy.testimonials for each row execute function utero_academy.set_updated_at();
create trigger set_galleries_updated_at before update on utero_academy.galleries for each row execute function utero_academy.set_updated_at();

alter table utero_academy.user_profiles enable row level security;
alter table utero_academy.roles enable row level security;
alter table utero_academy.permissions enable row level security;
alter table utero_academy.role_permissions enable row level security;
alter table utero_academy.user_roles enable row level security;
alter table utero_academy.schools enable row level security;
alter table utero_academy.school_contacts enable row level security;
alter table utero_academy.mentor_profiles enable row level security;
alter table utero_academy.intern_profiles enable row level security;
alter table utero_academy.programs enable row level security;
alter table utero_academy.curriculums enable row level security;
alter table utero_academy.batches enable row level security;
alter table utero_academy.classes enable row level security;
alter table utero_academy.class_enrollments enable row level security;
alter table utero_academy.internship_applications enable row level security;
alter table utero_academy.mentor_assignments enable row level security;
alter table utero_academy.courses enable row level security;
alter table utero_academy.lessons enable row level security;
alter table utero_academy.course_enrollments enable row level security;
alter table utero_academy.lesson_progress enable row level security;
alter table utero_academy.quizzes enable row level security;
alter table utero_academy.quiz_attempts enable row level security;
alter table utero_academy.assignments enable row level security;
alter table utero_academy.assignment_submissions enable row level security;
alter table utero_academy.task_boards enable row level security;
alter table utero_academy.task_lists enable row level security;
alter table utero_academy.task_cards enable row level security;
alter table utero_academy.task_checklists enable row level security;
alter table utero_academy.task_comments enable row level security;
alter table utero_academy.task_attachments enable row level security;
alter table utero_academy.attendances enable row level security;
alter table utero_academy.daily_reports enable row level security;
alter table utero_academy.daily_report_attachments enable row level security;
alter table utero_academy.daily_report_reviews enable row level security;
alter table utero_academy.assessments enable row level security;
alter table utero_academy.certificates enable row level security;
alter table utero_academy.cms_sites enable row level security;
alter table utero_academy.cms_pages enable row level security;
alter table utero_academy.cms_sections enable row level security;
alter table utero_academy.cms_navigation_items enable row level security;
alter table utero_academy.article_categories enable row level security;
alter table utero_academy.articles enable row level security;
alter table utero_academy.faqs enable row level security;
alter table utero_academy.testimonials enable row level security;
alter table utero_academy.galleries enable row level security;
alter table utero_academy.audit_logs enable row level security;
