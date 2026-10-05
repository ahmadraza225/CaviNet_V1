#!/usr/bin/env bash
# Restore a backup made by scripts/backup.sh. This REPLACES the current data.
# Usage: scripts/restore.sh backups/<timestamp>
set -euo pipefail

dir="${1:-}"
if [[ -z "${dir}" || ! -f "${dir}/database.sql" || ! -f "${dir}/data.tar.gz" ]]; then
  echo "Usage: make restore BACKUP=backups/<timestamp>" >&2
  echo "(the folder must contain database.sql and data.tar.gz)" >&2
  exit 1
fi

# Typed at a terminal: confirm first, because everything stored since the backup is lost.
if [[ -t 0 && "${CAVINET_RESTORE_CONFIRMED:-}" != "yes" ]]; then
  echo "This replaces ALL current CaviNet data (accounts, patients, scans, results, audit log)"
  echo "with the backup in ${dir}. Anything added since that backup will be lost."
  read -r -p "Type yes to continue: " answer
  if [[ "${answer}" != "yes" ]]; then
    echo "Nothing was changed."
    exit 1
  fi
fi

docker compose exec -T postgres sh -c \
  'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "${dir}/database.sql"
docker compose exec -T backend sh -c \
  'find /data -mindepth 1 -delete && tar -C /data -xzf -' < "${dir}/data.tar.gz"

echo "Restored from ${dir}"
