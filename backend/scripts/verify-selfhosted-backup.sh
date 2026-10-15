#!/bin/sh
set -eu
umask 077

backup_root="${BACKUP_ROOT:-/backups}"
backup_name="${BACKUP_NAME:?BACKUP_NAME wajib diisi}"
allow_temporary=false
[ "${1:-}" = "--allow-temporary" ] && allow_temporary=true

case "$backup_name" in
  *[!a-zA-Z0-9._-]*|'') echo "BACKUP_NAME tidak aman" >&2; exit 1 ;;
esac
if [ "$allow_temporary" != true ]; then
  case "$backup_name" in .*) echo "Backup temporary tidak boleh diverifikasi sebagai final" >&2; exit 1 ;; esac
fi

source="$backup_root/$backup_name"
if [ ! -d "$backup_root" ] || [ -L "$backup_root" ] || [ "$(realpath "$backup_root")" != "$backup_root" ]; then
  echo "Backup root wajib direktori absolut nyata tanpa komponen symlink" >&2
  exit 1
fi
if [ ! -d "$source" ] || [ -L "$source" ] || [ "$(realpath "$source")" != "$source" ]; then
  echo "Backup tidak ditemukan atau bukan direktori nyata: $source" >&2
  exit 1
fi

for file in database.dump storage.tar.gz storage.files.sha256 metadata.env SHA256SUMS; do
  if [ ! -f "$source/$file" ] || [ -L "$source/$file" ]; then
    echo "File backup tidak valid: $file" >&2
    exit 1
  fi
done

entry_count=0
for entry in "$source"/*; do
  [ -e "$entry" ] || continue
  entry_count=$((entry_count + 1))
  case "$(basename "$entry")" in
    database.dump|storage.tar.gz|storage.files.sha256|metadata.env|SHA256SUMS) ;;
    *) echo "Backup memuat entry tak dikenal: $(basename "$entry")" >&2; exit 1 ;;
  esac
done
[ "$entry_count" -eq 5 ] || { echo "Jumlah entry backup tidak valid" >&2; exit 1; }
awk '
  NF != 2 { bad=1 }
  length($1) != 64 || $1 !~ /^[0-9a-f]+$/ { bad=1 }
  $2 != "database.dump" && $2 != "storage.tar.gz" && $2 != "storage.files.sha256" && $2 != "metadata.env" { bad=1 }
  { seen[$2]++ }
  END {
    if (NR != 4 || seen["database.dump"] != 1 || seen["storage.tar.gz"] != 1 || seen["storage.files.sha256"] != 1 || seen["metadata.env"] != 1) bad=1
    exit bad ? 1 : 0
  }
' "$source/SHA256SUMS" || { echo "SHA256SUMS tidak valid" >&2; exit 1; }

(cd "$source" && sha256sum -c SHA256SUMS)
grep -qx 'BACKUP_FORMAT=1' "$source/metadata.env"
expected_name="$backup_name"
if [ "$allow_temporary" = true ]; then
  expected_name="${backup_name#.}"
  expected_name="${expected_name%.tmp}"
  expected_name="${expected_name%.incoming}"
fi
grep -Fqx "BACKUP_NAME=$expected_name" "$source/metadata.env"
if [ "$(wc -l < "$source/metadata.env")" -ne 5 ] || ! awk -F= '
  NF != 2 { bad=1 }
  $1 != "BACKUP_FORMAT" && $1 != "BACKUP_NAME" && $1 != "CREATED_AT_UTC" && $1 != "DATABASE_DUMP_FORMAT" && $1 != "STORAGE_ARCHIVE_FORMAT" { bad=1 }
  { seen[$1]++ }
  END { for (key in seen) if (seen[key] != 1) bad=1; exit bad ? 1 : 0 }
' "$source/metadata.env"; then
  echo "Metadata backup tidak valid" >&2
  exit 1
fi
pg_restore --list "$source/database.dump" >/dev/null
gzip -t "$source/storage.tar.gz"

if tar -tzf "$source/storage.tar.gz" | awk '
  /^\// { bad=1 }
  /(^|\/)\.\.($|\/)/ { bad=1 }
  END { exit bad ? 0 : 1 }
'; then
  echo "Arsip storage memuat path berbahaya" >&2
  exit 1
fi
if tar -tvzf "$source/storage.tar.gz" | awk '
  substr($0, 1, 1) !~ /[-d]/ { bad=1 }
  END { exit bad ? 0 : 1 }
'; then
  echo "Arsip storage memuat symlink atau file khusus" >&2
  exit 1
fi

stage="$(mktemp -d)"
actual_manifest="$(mktemp)"
cleanup() { rm -rf "$stage"; rm -f "$actual_manifest"; }
trap cleanup EXIT INT TERM
tar -C "$stage" -xzf "$source/storage.tar.gz" --no-same-owner --no-same-permissions
if [ -n "$(find "$stage" ! -type f ! -type d -print -quit)" ]; then
  echo "Hasil ekstraksi storage memuat symlink atau file khusus" >&2
  exit 1
fi
(
  cd "$stage"
  find . -type f -exec sha256sum -- {} \; | LC_ALL=C sort
) > "$actual_manifest"
if ! cmp -s "$source/storage.files.sha256" "$actual_manifest"; then
  echo "Isi arsip storage tidak cocok dengan manifest" >&2
  exit 1
fi

echo "Backup terverifikasi: $source"
