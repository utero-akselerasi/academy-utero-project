create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists academy_storage;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

alter role service_role bypassrls;

grant anon, authenticated to academy_api;

create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text default 'authenticated',
  role text default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  confirmation_token text default '',
  recovery_token text default '',
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth.identities (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id text not null,
  identity_data jsonb not null default '{}'::jsonb,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, provider_id)
);

create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on auth.sessions(user_id);
create index if not exists sessions_expires_at_idx on auth.sessions(expires_at);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  owner_id text,
  metadata jsonb,
  user_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  unique (bucket_id, name)
);

create table if not exists academy_storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  original_name text,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);
create index if not exists storage_objects_owner_idx on academy_storage.objects(owner_id);
