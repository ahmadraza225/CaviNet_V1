#!/usr/bin/env bash
# Back up the CaviNet database and stored files into backups/<timestamp>/.
# The stack must be running (make up).
set -euo pipefail

out="${BACKUP_DIR:-backups}/$(date +%Y%m%d-%H%M%S)"
mkdir -p "${out}"

docker compose exec -T postgres sh -c \
  'pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "${out}/database.sql"
docker compose exec -T backend tar -C /data -czf - . > "${out}/data.tar.gz"

echo "Backup written to ${out}"
