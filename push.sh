#!/usr/bin/env bash
set -euo pipefail

# ─── Push to GitHub ────────────────────────────────────────────────
# Usage:  bash push.sh
# Requires: GITHUB_PERSONAL_ACCESS_TOKEN env var (already in Replit secrets)

GITHUB_USER="Alexseibr"
GITHUB_REPO="rentrail"
BRANCH="main"

if [[ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  echo "❌  GITHUB_PERSONAL_ACCESS_TOKEN не задан"
  exit 1
fi

REMOTE_URL="https://${GITHUB_USER}:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

echo "📦  Пушим ветку '${BRANCH}' → github.com/${GITHUB_USER}/${GITHUB_REPO} ..."

GIT_TERMINAL_PROMPT=0 git \
  -c http.postBuffer=524288000 \
  -c credential.helper="" \
  push "$REMOTE_URL" "${BRANCH}" 2>&1

echo "✅  Готово — код на GitHub актуален"
