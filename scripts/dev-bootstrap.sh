#!/usr/bin/env bash
set -euo pipefail

echo "[1/3] Generating API clients from OpenAPI..."
pnpm --filter @workspace/api-spec run codegen

echo "[2/3] Checking library types..."
pnpm run typecheck:libs

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[3/3] Skipping DB seeds (DATABASE_URL is not set)."
  echo "Done. To seed RBAC, set DATABASE_URL and run: pnpm run seed"
  exit 0
fi

echo "[3/3] Seeding RBAC..."
pnpm run seed

echo "Bootstrap complete."
