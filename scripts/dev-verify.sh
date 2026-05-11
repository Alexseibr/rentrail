#!/usr/bin/env bash
set -euo pipefail

echo "[verify 1/3] Bootstrap (codegen + typecheck + optional seed)"
pnpm run dev:bootstrap

echo "[verify 2/3] API DB-backed tests"
pnpm run test:api

echo "[verify 3/3] Integration tests"
pnpm run test:integration

echo "Verification complete."
