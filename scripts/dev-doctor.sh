#!/usr/bin/env bash
set -euo pipefail

MODE="text"
if [[ "${1:-}" == "--json" ]]; then
  MODE="json"
fi

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

node_ok=false
pnpm_ok=false
docker_ok=false
db_set=false

if has_cmd node; then node_ok=true; fi
if has_cmd pnpm; then pnpm_ok=true; fi
if has_cmd docker; then docker_ok=true; fi
if [[ -n "${DATABASE_URL:-}" ]]; then db_set=true; fi

ok=true
if [[ "$node_ok" != true || "$pnpm_ok" != true || "$docker_ok" != true ]]; then
  ok=false
fi

if [[ "$MODE" == "json" ]]; then
  printf '{"ok":%s,"checks":{"node":%s,"pnpm":%s,"docker":%s,"databaseUrlSet":%s}}\n' \
    "$ok" "$node_ok" "$pnpm_ok" "$docker_ok" "$db_set"
  [[ "$ok" == true ]] && exit 0 || exit 1
fi

[[ "$node_ok" == true ]] && echo "[ok] node: $(command -v node)" || echo "[fail] node is not installed"
[[ "$pnpm_ok" == true ]] && echo "[ok] pnpm: $(command -v pnpm)" || echo "[fail] pnpm is not installed"
[[ "$docker_ok" == true ]] && echo "[ok] docker: $(command -v docker)" || echo "[fail] docker is not installed"
[[ "$db_set" == true ]] && echo "[ok] DATABASE_URL is set" || echo "[warn] DATABASE_URL is not set (dev:test will use local default URL)"

if [[ "$ok" != true ]]; then
  echo ""
  echo "Doctor failed. Install missing tools and retry."
  exit 1
fi

echo "Doctor passed."
