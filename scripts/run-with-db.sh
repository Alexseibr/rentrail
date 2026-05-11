#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[db-check] DATABASE_URL is not set."
  echo "[db-check] Start local DB: docker compose -f docker-compose.dev.yml up -d"
  echo "[db-check] Then export env: export DATABASE_URL=postgres://postgres:postgres@localhost:5432/rentrail"
  exit 1
fi

"$@"
