#!/bin/sh
set -eu
umask 077

backup_root="${BACKUP_ROOT:-/backups}"
offsite_root="${OFFSITE_ROOT:-/offsite}"
backup_name="${BACKUP_NAME:?BACKUP_NAME wajib diisi}"

case "$backup_name" in
  *[!a-zA-Z0-9._-]*|'') echo "BACKUP_NAME tidak aman" >&2; exit 1 ;;
esac
for root in "$backup_root" "$offsite_root"; do
  if [ ! -d "$root" ] || [ -L "$root" ] || [ "$(realpath "$root")" != "$root" ]; then
    echo "Root harus direktori absolut nyata tanpa komponen symlink: $root" >&2
    exit 1
  fi
done
if [ "$(realpath "$backup_root")" = "$(realpath "$offsite_root")" ]; then
  echo "Root backup dan off-host tidak boleh sama" >&2
  exit 1
fi
if [ "${ALLOW_SAME_DEVICE_FOR_TEST:-false}" != true ] && \
   [ "$(stat -c %d "$backup_root")" = "$(stat -c %d "$offsite_root")" ]; then
  echo "Tujuan off-host masih pada filesystem yang sama" >&2
  exit 1
fi

BACKUP_ROOT="$backup_root" BACKUP_NAME="$backup_name" sh backend/scripts/verify-selfhosted-backup.sh
source="$backup_root/$backup_name"
temporary="$offsite_root/.${backup_name}.incoming"
target="$offsite_root/$backup_name"
if [ -e "$temporary" ] || [ -e "$target" ]; then
  echo "Tujuan off-host sudah ada" >&2
  exit 1
fi

mkdir "$temporary"
cleanup() { rm -rf "$temporary"; }
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM
cp -a "$source"/. "$temporary"/
BACKUP_ROOT="$offsite_root" BACKUP_NAME=".$backup_name.incoming" \
  sh backend/scripts/verify-selfhosted-backup.sh --allow-temporary
mv "$temporary" "$target"
trap - EXIT INT TERM
BACKUP_ROOT="$offsite_root" BACKUP_NAME="$backup_name" sh backend/scripts/verify-selfhosted-backup.sh
echo "Replikasi off-host selesai: $target"
