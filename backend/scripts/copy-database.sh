#!/bin/sh
set -eu

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL wajib diisi}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL wajib diisi}"
: "${CONFIRM_DATABASE_COPY:?Set CONFIRM_DATABASE_COPY=copy-to-local-academy}"

if [ "$CONFIRM_DATABASE_COPY" != "copy-to-local-academy" ]; then
  echo "Konfirmasi copy database tidak cocok" >&2
  exit 1
fi

target_database="${TARGET_DATABASE_NAME:-academy}"
case "$target_database" in *[!a-z0-9_]*|'') echo "TARGET_DATABASE_NAME tidak aman" >&2; exit 1 ;; esac
case "$TARGET_DATABASE_URL" in
  postgresql://*@postgres:5432/"$target_database"|postgres://*@postgres:5432/"$target_database") ;;
  *) echo "Target wajib database $target_database pada service postgres" >&2; exit 1 ;;
esac

if [ "$SOURCE_DATABASE_URL" = "$TARGET_DATABASE_URL" ]; then
  echo "Source dan target database tidak boleh sama" >&2
  exit 1
fi

workdir="$(mktemp -d)"
snapshot_keeper_pid=""
cleanup() {
  if [ -n "$snapshot_keeper_pid" ]; then
    kill "$snapshot_keeper_pid" 2>/dev/null || true
    wait "$snapshot_keeper_pid" 2>/dev/null || true
  fi
  rm -rf "$workdir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

database_identity_sql="select current_database() || '|' || coalesce(inet_server_addr()::text, 'local') || '|' || coalesce(inet_server_port()::text, 'local')"
source_database_identity="$(PGOPTIONS='-c default_transaction_read_only=on' psql "$SOURCE_DATABASE_URL" -AtX -v ON_ERROR_STOP=1 -c "$database_identity_sql")"
target_database_identity="$(PGOPTIONS='-c default_transaction_read_only=on' psql "$TARGET_DATABASE_URL" -AtX -v ON_ERROR_STOP=1 -c "$database_identity_sql")"
if [ "$source_database_identity" = "$target_database_identity" ]; then
  echo "Source dan target mengarah ke database PostgreSQL yang sama" >&2
  exit 1
fi

snapshot_file="$workdir/source-snapshot"
SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" node backend/scripts/hold-source-snapshot.mjs "$snapshot_file" &
snapshot_keeper_pid=$!

snapshot_wait=0
while [ ! -s "$snapshot_file" ]; do
  if ! kill -0 "$snapshot_keeper_pid" 2>/dev/null; then
    echo "Gagal membuka snapshot konsisten pada source database" >&2
    wait "$snapshot_keeper_pid"
    exit 1
  fi
  snapshot_wait=$((snapshot_wait + 1))
  if [ "$snapshot_wait" -ge 100 ]; then
    echo "Timeout membuka snapshot konsisten pada source database" >&2
    exit 1
  fi
  sleep 0.1
done
source_snapshot="$(tr -d '\r\n' < "$snapshot_file")"
case "$source_snapshot" in *[!0-9A-Fa-f-]*|'') echo "Snapshot source database tidak valid" >&2; exit 1 ;; esac

echo "Export auth users"
PGOPTIONS='-c default_transaction_read_only=on' psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -v source_snapshot="$source_snapshot" <<SQL
begin isolation level repeatable read read only;
set transaction snapshot :'source_snapshot';
\copy (select id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, last_sign_in_at, banned_until, deleted_at, created_at, updated_at from auth.users) to '$workdir/auth-users.csv' with (format csv)
commit;
SQL

echo "Export auth identities"
PGOPTIONS='-c default_transaction_read_only=on' psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -v source_snapshot="$source_snapshot" <<SQL
begin isolation level repeatable read read only;
set transaction snapshot :'source_snapshot';
\copy (select id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at from auth.identities) to '$workdir/auth-identities.csv' with (format csv)
commit;
SQL

echo "Export Academy schema data"
PGOPTIONS='-c default_transaction_read_only=on' pg_dump "$SOURCE_DATABASE_URL" \
  --data-only --schema=utero_academy --no-owner --no-acl --disable-triggers \
  --snapshot="$source_snapshot" \
  --file="$workdir/utero-academy.sql"

echo "Export Academy Storage metadata"
PGOPTIONS='-c default_transaction_read_only=on' psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -v source_snapshot="$source_snapshot" <<SQL
begin isolation level repeatable read read only;
set transaction snapshot :'source_snapshot';
\copy (select id, bucket_id, name, owner, owner_id, metadata, user_metadata, created_at, updated_at, last_accessed_at from storage.objects where bucket_id in ('avatars','academy-private','selection-answers','daily-report','task','certificate','learning','gallery','article','mentor','school-logo')) to '$workdir/storage-objects.csv' with (format csv)
commit;
SQL

kill "$snapshot_keeper_pid" 2>/dev/null || true
wait "$snapshot_keeper_pid" 2>/dev/null || true
snapshot_keeper_pid=""

echo "Build atomic import transaction"
cat > "$workdir/import.sql" <<'SQL'
do $$ declare statement text; begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ')
    into statement from pg_tables where schemaname = 'utero_academy';
  if statement is not null then execute 'truncate table ' || statement || ' cascade'; end if;
end $$;
truncate table auth.identities, auth.sessions, auth.users cascade;
truncate table academy_storage.objects;
truncate table storage.objects;
alter table auth.users disable trigger provision_utero_academy_applicant;
SQL

printf "\\\\copy auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, last_sign_in_at, banned_until, deleted_at, created_at, updated_at) from '%s/auth-users.csv' with (format csv)\n" "$workdir" >> "$workdir/import.sql"
printf "\\\\copy auth.identities(id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) from '%s/auth-identities.csv' with (format csv)\n" "$workdir" >> "$workdir/import.sql"
printf "\\\\copy storage.objects(id, bucket_id, name, owner, owner_id, metadata, user_metadata, created_at, updated_at, last_accessed_at) from '%s/storage-objects.csv' with (format csv)\n" "$workdir" >> "$workdir/import.sql"
cat "$workdir/utero-academy.sql" >> "$workdir/import.sql"
cat >> "$workdir/import.sql" <<'SQL'
alter table auth.users enable trigger provision_utero_academy_applicant;
  select 'auth.users' object, count(*) rows from auth.users
  union all select 'user_profiles', count(*) from utero_academy.user_profiles
  union all select 'user_roles', count(*) from utero_academy.user_roles
  union all select 'roles', count(*) from utero_academy.roles
  union all select 'permissions', count(*) from utero_academy.permissions
  order by object;
SQL

echo "Import snapshot as single transaction"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction --file="$workdir/import.sql"
