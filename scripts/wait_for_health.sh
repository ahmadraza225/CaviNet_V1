#!/usr/bin/env bash
# Wait until the CaviNet health endpoint reports status "ok".
# Usage: scripts/wait_for_health.sh [url] [timeout-seconds]
set -euo pipefail

url="${1:-http://localhost:8080/api/health}"
timeout="${2:-180}"
deadline=$((SECONDS + timeout))

echo "Waiting for ${url} (up to ${timeout}s)..."
while (( SECONDS < deadline )); do
  if body="$(curl -fsS "${url}" 2>/dev/null)" && [[ "${body}" == *'"status":"ok"'* ]]; then
    echo "CaviNet is up: ${body}"
    exit 0
  fi
  sleep 3
done

echo "CaviNet did not become healthy within ${timeout}s. Last response:" >&2
curl -sS "${url}" >&2 || true
echo >&2
echo "Inspect the services with: docker compose ps && docker compose logs" >&2
exit 1
