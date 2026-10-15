create unique index if not exists auth_users_email_lower_active_idx
  on auth.users (lower(email)) where deleted_at is null;

grant select, insert on auth.identities to academy_api;
