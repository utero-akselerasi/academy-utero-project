#!/bin/sh
set -eu
: "${ACADEMY_API_PASSWORD:?ACADEMY_API_PASSWORD wajib diisi}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v api_password="$ACADEMY_API_PASSWORD" <<'SQL'
create role academy_api login password :'api_password';
SQL
