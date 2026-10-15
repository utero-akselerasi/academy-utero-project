#!/bin/sh
set -eu
umask 077

: "${DATABASE_URL:?DATABASE_URL wajib diisi}"
: "${RESTORE_BACKUP_NAME:?RESTORE_BACKUP_NAME wajib diisi}"
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=restore-local-academy}"

case "$DATABASE_URL" in
  postgresql://*@postgres:5432/academy|postgres://*@postgres:5432/academy) ;;
  *) echo "Restore hanya boleh ke database academy pada service postgres" >&2; exit 1 ;;
esac

if [ "$CONFIRM_RESTORE" != "restore-local-academy" ]; then
  echo "Konfirmasi restore tidak cocok" >&2
  exit 1
fi

case "$RESTORE_BACKUP_NAME" in
  *[!a-zA-Z0-9._-]*|'') echo "RESTORE_BACKUP_NAME tidak aman" >&2; exit 1 ;;
esac

storage_root="${STORAGE_ROOT:-/srv/storage}"
backup_root="${BACKUP_ROOT:-/backups}"
evidence_root="${OPS_EVIDENCE_ROOT:-/evidence}"
evidence_target="${RESTORE_EVIDENCE_TARGET:-local}"
source="$backup_root/$RESTORE_BACKUP_NAME"
restore_started_at="$(date -u +%Y%m%dT%H%M%SZ)"

case "$evidence_target" in
  local|production) ;;
  *) echo "RESTORE_EVIDENCE_TARGET wajib local atau production" >&2; exit 1 ;;
esac

if [ "$storage_root" != "/srv/storage" ] || [ ! -d "$storage_root" ] || [ -L "$storage_root" ]; then
  echo "Storage root restore wajib /srv/storage dan direktori nyata" >&2
  exit 1
fi
if [ ! -d "/srv" ] || [ -L "/srv" ] || [ "$(realpath /srv)" != "/srv" ]; then
  echo "Parent storage /srv wajib direktori nyata" >&2
  exit 1
fi
if ! awk '$5 == "/srv" { mounted=1 } END { exit !mounted }' /proc/self/mountinfo; then
  echo "Parent storage /srv wajib mount terpisah agar swap dan rollback persisten" >&2
  exit 1
fi
if awk '$5 == "/srv/storage" { mounted=1 } END { exit !mounted }' /proc/self/mountinfo; then
  echo "Storage root tidak boleh bind mount langsung; mount parent /srv agar swap storage aman" >&2
  exit 1
fi
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

BACKUP_ROOT="$backup_root" BACKUP_NAME="$RESTORE_BACKUP_NAME" \
  sh backend/scripts/verify-selfhosted-backup.sh

missing_roles="$(psql "$DATABASE_URL" -XAtqc "select roles.required_role from unnest(array['anon','authenticated','service_role','academy_api']) as roles(required_role) left join pg_roles on rolname = roles.required_role where pg_roles.oid is null order by roles.required_role")"
if [ -n "$missing_roles" ]; then
  echo "Role PostgreSQL prerequisite belum tersedia; jalankan service migrate sebelum restore: $(printf '%s' "$missing_roles" | tr '\n' ' ')" >&2
  exit 1
fi

mkdir -p "$evidence_root"
if [ -L "$evidence_root" ] || [ ! -d "$evidence_root" ] || [ "$(realpath "$evidence_root")" != "$evidence_root" ]; then
  echo "Evidence root wajib direktori nyata" >&2
  exit 1
fi

stage="$(mktemp -d)"
storage_parent="$(dirname "$storage_root")"
storage_name="$(basename "$storage_root")"
storage_stage="$(mktemp -d "$storage_parent/.${storage_name}.restore.XXXXXX")"
storage_previous=""
storage_failed=""
evidence_stage=""
restore_evidence_stage=""
evidence=""
restore_evidence_published=0
gate_evidence_published=0
pre_restore_backup=""
database_restored=0
restore_committed=0

rollback_safety_backup() {
  rollback_failed=0
  echo "Restore gagal setelah database berubah; memulihkan safety backup" >&2

  if [ "$gate_evidence_published" -eq 1 ]; then rm -f "$evidence_root/backupRestore.json"; gate_evidence_published=0; fi
  if [ "$restore_evidence_published" -eq 1 ] && [ -n "$evidence" ]; then rm -f "$evidence"; restore_evidence_published=0; fi

  rollback_sql="$stage/rollback.sql"
  if ! pg_restore "$backup_root/$pre_restore_backup/database.dump" --clean --if-exists --no-owner --file="$rollback_sql" ||
     ! psql "$DATABASE_URL" -X --set ON_ERROR_STOP=1 --single-transaction \
       --command='DROP SCHEMA IF EXISTS academy_storage CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS storage CASCADE; DROP SCHEMA IF EXISTS utero_academy CASCADE;' \
       --file="$rollback_sql"; then
    echo "KRITIS: rollback database dari safety backup gagal" >&2
    rollback_failed=1
  fi

  if [ -n "$storage_previous" ] && [ -d "$storage_previous" ]; then
    if [ -e "$storage_root" ]; then
      storage_failed="$(mktemp -d "$storage_parent/.${storage_name}.failed.XXXXXX")"
      rmdir "$storage_failed"
      if ! mv "$storage_root" "$storage_failed"; then
        echo "KRITIS: storage hasil restore tidak dapat dipindahkan untuk rollback" >&2
        rollback_failed=1
      fi
    fi
    if [ ! -e "$storage_root" ]; then
      if mv "$storage_previous" "$storage_root"; then
        storage_previous=""
        if [ -n "$storage_failed" ]; then rm -rf "$storage_failed"; storage_failed=""; fi
      else
        echo "KRITIS: rollback storage lama gagal: $storage_previous" >&2
        rollback_failed=1
      fi
    fi
  fi

  [ "$rollback_failed" -eq 0 ]
}

cleanup() {
  rm -rf "$stage" "$storage_stage"
  if [ -n "$evidence_stage" ]; then rm -f "$evidence_stage"; fi
  if [ -n "$restore_evidence_stage" ]; then rm -f "$restore_evidence_stage"; fi
}
on_exit() {
  status=$?
  trap - EXIT INT TERM
  if [ "$status" -ne 0 ] && [ "$database_restored" -eq 1 ] && [ "$restore_committed" -eq 0 ]; then
    if ! rollback_safety_backup; then status=1; fi
  fi
  cleanup
  exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT TERM

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
tar -C "$storage_stage" -xzf "$source/storage.tar.gz" --no-same-owner --no-same-permissions
if [ -n "$(find "$storage_stage" ! -type f ! -type d -print -quit)" ]; then
  echo "Hasil ekstraksi storage memuat symlink atau file khusus" >&2
  exit 1
fi
actual_storage_manifest="$stage/storage.files.sha256"
(
  cd "$storage_stage"
  find . -type f -exec sha256sum -- {} \; | LC_ALL=C sort
) > "$actual_storage_manifest"
if ! cmp -s "$source/storage.files.sha256" "$actual_storage_manifest"; then
  echo "Hasil staging storage tidak cocok dengan manifest" >&2
  exit 1
fi
chown -R 1000:1000 "$storage_stage"
cp "$source/database.dump" "$stage/database.dump"

for schema in academy_storage auth storage utero_academy; do
  if ! pg_restore --list "$stage/database.dump" | grep -Eq "SCHEMA - $schema "; then
    echo "Backup tidak memuat schema wajib: $schema" >&2
    exit 1
  fi
done
pg_restore "$stage/database.dump" --clean --if-exists --no-owner \
  --file="$stage/restore.sql"

pre_restore_backup="pre-restore-$restore_started_at"
if [ "$pre_restore_backup" = "$RESTORE_BACKUP_NAME" ]; then
  echo "Nama backup restore bertabrakan dengan safety backup" >&2
  exit 1
fi
echo "Membuat safety backup sebelum restore"
DATABASE_URL="$DATABASE_URL" STORAGE_ROOT="$storage_root" BACKUP_ROOT="$backup_root" BACKUP_NAME="$pre_restore_backup" \
  sh backend/scripts/backup-selfhosted.sh

echo "Memulihkan PostgreSQL"
psql "$DATABASE_URL" -X --set ON_ERROR_STOP=1 --single-transaction \
  --command='DROP SCHEMA IF EXISTS academy_storage CASCADE; DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS storage CASCADE; DROP SCHEMA IF EXISTS utero_academy CASCADE;' \
  --file="$stage/restore.sql"
database_restored=1

echo "Memulihkan storage"
storage_previous="$(mktemp -d "$storage_parent/.${storage_name}.previous.XXXXXX")"
rmdir "$storage_previous"
if ! mv "$storage_root" "$storage_previous"; then
  echo "Gagal memindahkan storage lama; storage tidak diubah" >&2
  exit 1
fi
if ! mv "$storage_stage" "$storage_root"; then
  echo "Swap storage baru gagal; safety backup akan dipulihkan" >&2
  exit 1
fi

if ! database_probe="$(psql "$DATABASE_URL" -XAtqc 'select 1')"; then
  echo "Probe database setelah restore gagal" >&2
  exit 1
fi
if [ "$database_probe" != "1" ]; then
  echo "Probe database setelah restore gagal" >&2
  exit 1
fi
restored_at="$(date -u +%Y%m%dT%H%M%SZ)"
evidence="$evidence_root/restore-${RESTORE_BACKUP_NAME}-$restored_at.env"
restore_evidence_stage="$(mktemp "$evidence_root/.restore.XXXXXX")"
cat > "$restore_evidence_stage" <<EOF
RESTORE_EVIDENCE_FORMAT=1
BACKUP_NAME=$RESTORE_BACKUP_NAME
PRE_RESTORE_BACKUP_NAME=$pre_restore_backup
RESTORED_AT_UTC=$restored_at
BACKUP_SHA256SUMS=$(sha256sum "$source/SHA256SUMS" | awk '{print $1}')
DATABASE_PROBE=$database_probe
EOF
chmod 600 "$restore_evidence_stage"
mv "$restore_evidence_stage" "$evidence"
restore_evidence_stage=""
restore_evidence_published=1

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
expires_at="$(node -e 'process.stdout.write(new Date(Date.parse(process.argv[1]) + 24 * 60 * 60 * 1000).toISOString())' "$finished_at")"
evidence_stage="$(mktemp "$evidence_root/.backupRestore.XXXXXX")"
cat > "$evidence_stage" <<EOF
{"schemaVersion":1,"gate":"backupRestore","target":"$evidence_target","status":"PASS","backupName":"$RESTORE_BACKUP_NAME","safetyBackupName":"$pre_restore_backup","finishedAt":"$finished_at","expiresAt":"$expires_at","checks":{"database":{"ok":true},"storage":{"ok":true},"safetyBackup":{"ok":true}}}
EOF
chmod 600 "$evidence_stage"
mv "$evidence_stage" "$evidence_root/backupRestore.json"
evidence_stage=""
gate_evidence_published=1

rm -rf "$storage_previous"
storage_previous=""
restore_committed=1

echo "Restore selesai dari: $source"
