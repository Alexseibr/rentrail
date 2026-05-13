#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgres://postgres:postgres@localhost:5432/rentrail"
  echo "[db-check] DATABASE_URL is not set; using default: ${DATABASE_URL}"
  echo "[db-check] If tests fail to connect, start local DB: docker compose -f docker-compose.dev.yml up -d"
fi

"$@"
