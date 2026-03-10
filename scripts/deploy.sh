#!/usr/bin/env bash
# =============================================================================
# RideFlow — деплой на VPS
# Использование: bash scripts/deploy.sh
# =============================================================================
set -euo pipefail

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
APP_DIR="/opt/rideflow"
SSH_KEY="/home/runner/.ssh/id_ed25519_vps"

if [ -z "$VPS_HOST" ]; then
  echo "Ошибка: переменная VPS_HOST не задана"
  exit 1
fi

SSH="ssh -i $SSH_KEY -p $VPS_PORT -o StrictHostKeyChecking=no"
SCP="scp -i $SSH_KEY -P $VPS_PORT -o StrictHostKeyChecking=no"
RSYNC="rsync -az --delete -e \"ssh -i $SSH_KEY -p $VPS_PORT -o StrictHostKeyChecking=no\""

echo "▶ Деплой на $VPS_USER@$VPS_HOST..."

# 1. Сборка API сервера
echo "▶ Сборка API..."
cd artifacts/api-server
pnpm run build
cd ../..

# 2. Сборка Platform Admin (статика)
echo "▶ Сборка Platform Admin..."
cd artifacts/platform-admin
pnpm run build
cd ../..

# 3. Копирование API сервера
echo "▶ Копирование API..."
eval $RSYNC \
  --exclude='node_modules' \
  --exclude='.env' \
  ./artifacts/api-server/dist/ \
  $VPS_USER@$VPS_HOST:$APP_DIR/api/dist/

# package.json нужен для pnpm install на сервере
$SCP artifacts/api-server/package.json $VPS_USER@$VPS_HOST:$APP_DIR/api/

# 4. Копирование статики Platform Admin
echo "▶ Копирование Platform Admin..."
eval $RSYNC \
  ./artifacts/platform-admin/dist/ \
  $VPS_USER@$VPS_HOST:$APP_DIR/admin/

# 5. Копирование конфига PM2
$SCP scripts/ecosystem.config.cjs $VPS_USER@$VPS_HOST:$APP_DIR/

# 6. Перезапуск на сервере
echo "▶ Перезапуск приложения..."
$SSH $VPS_USER@$VPS_HOST "
  cd $APP_DIR/api &&
  NODE_ENV=production pm2 startOrRestart $APP_DIR/ecosystem.config.cjs --update-env &&
  pm2 save
"

echo "✅ Деплой завершён!"
echo "   API:          https://$VPS_HOST/api/healthz"
echo "   Platform Admin: https://$VPS_HOST/platform-admin/"
