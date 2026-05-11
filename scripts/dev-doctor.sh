#!/usr/bin/env bash
set -euo pipefail

MODE="text"
if [[ "${1:-}" == "--json" ]]; then
  MODE="json"
fi

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

detect_os() {
  case "$(uname -s)" in
    Linux*) echo "linux" ;;
    Darwin*) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

install_hint() {
  local tool="$1"
  local os="$2"

  case "$tool:$os" in
    node:linux)
      echo "Install Node.js LTS: https://nodejs.org/en/download"
      ;;
    node:macos)
      echo "brew install node"
      ;;
    node:windows)
      echo "Install Node.js LTS: https://nodejs.org/en/download"
      ;;
    pnpm:linux|pnpm:macos|pnpm:windows)
      echo "npm install -g pnpm"
      ;;
    docker:linux)
      echo "Install Docker Engine/Desktop: https://docs.docker.com/engine/install/"
      ;;
    docker:macos|docker:windows)
      echo "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
      ;;
    *)
      echo "Install $tool and ensure it is available in PATH"
      ;;
  esac
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

os="$(detect_os)"

if [[ "$MODE" == "json" ]]; then
  printf '{"ok":%s,"os":"%s","checks":{"node":%s,"pnpm":%s,"docker":%s,"databaseUrlSet":%s},"hints":{"node":"%s","pnpm":"%s","docker":"%s"}}\n' \
    "$ok" "$os" "$node_ok" "$pnpm_ok" "$docker_ok" "$db_set" \
    "$(install_hint node "$os")" \
    "$(install_hint pnpm "$os")" \
    "$(install_hint docker "$os")"
  [[ "$ok" == true ]] && exit 0 || exit 1
fi

[[ "$node_ok" == true ]] && echo "[ok] node: $(command -v node)" || echo "[fail] node is not installed"
[[ "$pnpm_ok" == true ]] && echo "[ok] pnpm: $(command -v pnpm)" || echo "[fail] pnpm is not installed"
[[ "$docker_ok" == true ]] && echo "[ok] docker: $(command -v docker)" || echo "[fail] docker is not installed"
[[ "$db_set" == true ]] && echo "[ok] DATABASE_URL is set" || echo "[warn] DATABASE_URL is not set (dev:test will use local default URL)"

if [[ "$ok" != true ]]; then
  echo ""
  echo "Doctor failed. Install missing tools and retry."
  [[ "$node_ok" == true ]] || echo "- node: $(install_hint node "$os")"
  [[ "$pnpm_ok" == true ]] || echo "- pnpm: $(install_hint pnpm "$os")"
  [[ "$docker_ok" == true ]] || echo "- docker: $(install_hint docker "$os")"
  exit 1
fi

echo "Doctor passed."
