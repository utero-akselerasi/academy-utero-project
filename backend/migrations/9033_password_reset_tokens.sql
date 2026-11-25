create table auth.password_reset_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index password_reset_tokens_user_idx
  on auth.password_reset_tokens (user_id);

grant select, insert, update, delete on auth.password_reset_tokens to academy_api;
