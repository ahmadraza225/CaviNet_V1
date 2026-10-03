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

docker compose exec -T postgres sh -c \
  'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "${dir}/database.sql"
docker compose exec -T backend sh -c \
  'find /data -mindepth 1 -delete && tar -C /data -xzf -' < "${dir}/data.tar.gz"

echo "Restored from ${dir}"
