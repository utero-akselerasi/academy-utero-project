#!/bin/sh
set -eu
umask 077

retention_root="${RETENTION_ROOT:-/backups}"
retention_days="${RETENTION_DAYS:-30}"
minimum_keep="${RETENTION_MINIMUM_KEEP:-7}"
confirm="${CONFIRM_PRUNE:-}"

case "$retention_days:$minimum_keep" in
  *[!0-9:]*|:*|*:) echo "Retensi wajib bilangan bulat" >&2; exit 1 ;;
esac
if [ ! -d "$retention_root" ] || [ -L "$retention_root" ] || [ "$(realpath "$retention_root")" != "$retention_root" ] || [ "$retention_root" = / ]; then
  echo "RETENTION_ROOT tidak aman" >&2
  exit 1
fi

list="$(mktemp)"
cleanup() { rm -f "$list"; }
trap cleanup EXIT INT TERM
for candidate in "$retention_root"/*; do
  [ -d "$candidate" ] || continue
  [ -L "$candidate" ] && continue
  name="$(basename "$candidate")"
  case "$name" in .*) continue ;; esac
  case "$name" in *[!a-zA-Z0-9._-]*|'') continue ;; esac
  printf '%s %s\n' "$(stat -c %Y "$candidate")" "$name"
done | sort -rn > "$list"

position=0
while read -r _modified name; do
  [ -n "${name:-}" ] || continue
  position=$((position + 1))
  [ "$position" -le "$minimum_keep" ] && continue
  candidate="$retention_root/$name"
  if ! BACKUP_ROOT="$retention_root" BACKUP_NAME="$name" sh backend/scripts/verify-selfhosted-backup.sh >/dev/null 2>&1; then
    echo "Dilewati, backup tidak valid: $candidate" >&2
    continue
  fi
  if find "$candidate" -maxdepth 0 -mtime "+$retention_days" -print -quit | grep -q .; then
    if [ "$confirm" = "prune-expired-backups" ]; then
      if [ ! -d "$candidate" ] || [ -L "$candidate" ] || [ "$(realpath "$candidate")" != "$candidate" ]; then
        echo "Target retensi berubah atau tidak aman: $candidate" >&2
        exit 1
      fi
      rm -rf -- "$candidate"
      echo "Dihapus: $candidate"
    else
      echo "Akan dihapus: $candidate"
    fi
  fi
done < "$list"
