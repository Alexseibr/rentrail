#!/usr/bin/env bash
set -euo pipefail

ok=1

check_cmd() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    echo "[ok] $name: $(command -v "$name")"
  else
    echo "[fail] $name is not installed"
    ok=0
  fi
}

check_cmd node
check_cmd pnpm
check_cmd docker

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "[ok] DATABASE_URL is set"
else
  echo "[warn] DATABASE_URL is not set (dev:test will use local default URL)"
fi

if [[ $ok -eq 0 ]]; then
  echo ""
  echo "Doctor failed. Install missing tools and retry."
  exit 1
fi

echo "Doctor passed."
