create table if not exists auth.email_verification_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists email_verification_tokens_user_idx
  on auth.email_verification_tokens (user_id, created_at desc);

grant select, insert, update, delete on auth.email_verification_tokens to academy_api;
grant update (email_confirmed_at, updated_at) on auth.users to academy_api;
