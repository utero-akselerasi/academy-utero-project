#!/bin/sh
set -eu
umask 077

: "${DATABASE_URL:?DATABASE_URL wajib diisi}"

storage_root="${STORAGE_ROOT:-/srv/storage}"
backup_root="${BACKUP_ROOT:-/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="${BACKUP_NAME:-academy-$timestamp}"

require_real_directory() {
  directory="$1"
  label="$2"
  if [ ! -d "$directory" ] || [ -L "$directory" ] || [ "$(realpath "$directory")" != "$directory" ]; then
    echo "$label wajib direktori absolut nyata tanpa komponen symlink: $directory" >&2
    exit 1
  fi
}

storage_snapshot() {
  destination="$1"
  (
    cd "$storage_root"
    find . -type f -exec sha256sum -- {} \; | LC_ALL=C sort
  ) > "$destination"
}

case "$backup_name" in
  *[!a-zA-Z0-9._-]*|'') echo "BACKUP_NAME tidak aman" >&2; exit 1 ;;
esac

require_real_directory "$storage_root" "Storage root"
if [ -n "$(find "$storage_root" ! -type f ! -type d -print -quit)" ]; then
  echo "Storage memuat symlink atau file khusus; backup dibatalkan" >&2
  exit 1
fi
if find "$storage_root" -mindepth 1 -exec sh -c '
  root=$1; shift
  for item do
    relative=${item#"$root"/}
    case "$relative" in *"
"*) exit 1 ;; esac
  done
' sh "$storage_root" {} +; then :; else
  echo "Storage memuat nama file dengan newline; backup dibatalkan" >&2
  exit 1
fi

mkdir -p "$backup_root"
require_real_directory "$backup_root" "Backup root"
temporary="$backup_root/.${backup_name}.tmp"
target="$backup_root/$backup_name"
if [ -e "$temporary" ] || [ -e "$target" ]; then
  echo "Backup tujuan sudah ada: $target" >&2
  exit 1
fi

mkdir "$temporary"
cleanup() { rm -rf "$temporary"; }
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

storage_snapshot "$temporary/storage.files.sha256.before"

echo "Membuat dump PostgreSQL"
PGOPTIONS='-c default_transaction_read_only=on' pg_dump "$DATABASE_URL" \
  --format=custom --compress=9 --no-owner \
  --file="$temporary/database.dump"

echo "Membuat arsip storage"
tar -C "$storage_root" -czf "$temporary/storage.tar.gz" .
storage_snapshot "$temporary/storage.files.sha256"
if ! cmp -s "$temporary/storage.files.sha256.before" "$temporary/storage.files.sha256"; then
  echo "Storage berubah selama backup; backup dibatalkan" >&2
  exit 1
fi
rm "$temporary/storage.files.sha256.before"

cat > "$temporary/metadata.env" <<EOF
BACKUP_FORMAT=1
BACKUP_NAME=$backup_name
CREATED_AT_UTC=$timestamp
DATABASE_DUMP_FORMAT=custom
STORAGE_ARCHIVE_FORMAT=tar.gz
EOF

(
  cd "$temporary"
  sha256sum database.dump storage.tar.gz storage.files.sha256 metadata.env > SHA256SUMS
)

BACKUP_ROOT="$backup_root" BACKUP_NAME=".$backup_name.tmp" \
  sh backend/scripts/verify-selfhosted-backup.sh --allow-temporary

mv "$temporary" "$target"
trap - EXIT INT TERM
echo "Backup selesai: $target"
