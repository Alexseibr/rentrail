#!/usr/bin/env bash
# =============================================================================
# RideFlow — первоначальная настройка VPS (запускается один раз)
# Использование: bash scripts/setup-vps.sh
# =============================================================================
set -euo pipefail

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
SSH_KEY="/home/runner/.ssh/id_ed25519_vps"

if [ -z "$VPS_HOST" ]; then
  echo "Ошибка: переменная VPS_HOST не задана"
  exit 1
fi

SSH="ssh -i $SSH_KEY -p $VPS_PORT -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST"

echo "▶ Настройка сервера $VPS_HOST..."

$SSH bash <<'REMOTE'
set -euo pipefail

echo "=== Обновление системы ==="
apt-get update -qq && apt-get upgrade -y -qq

echo "=== Установка зависимостей ==="
apt-get install -y -qq curl git nginx ufw

echo "=== Установка Node.js 24 ==="
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y -qq nodejs
node --version

echo "=== Установка pnpm ==="
npm install -g pnpm pm2

echo "=== Настройка директорий ==="
mkdir -p /opt/rideflow/api/dist
mkdir -p /opt/rideflow/admin
mkdir -p /opt/rideflow/logs

echo "=== Настройка firewall ==="
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo "=== Создание .env для API ==="
cat > /opt/rideflow/api/.env <<'ENV'
NODE_ENV=production
PORT=8080
# Заполните эти значения:
# DATABASE_URL=postgresql://user:pass@host:5432/dbname
# JWT_ACCESS_SECRET=ваш_секрет_минимум_32_символа
# JWT_REFRESH_SECRET=ваш_другой_секрет
# SESSION_SECRET=ваш_сессия_секрет
ENV

echo "=== Настройка Nginx ==="
cat > /etc/nginx/sites-available/rideflow <<'NGINX'
server {
    listen 80;
    server_name _;

    # Platform Admin (статика)
    location /platform-admin/ {
        alias /opt/rideflow/admin/;
        try_files $uri $uri/ /platform-admin/index.html;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # Редирект корня на Platform Admin
    location = / {
        return 301 /platform-admin/;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/rideflow /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== Сервер готов к деплою ==="
REMOTE

echo "✅ Настройка сервера завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Отредактируйте /opt/rideflow/api/.env на сервере — добавьте DATABASE_URL и секреты JWT"
echo "2. Запустите: bash scripts/deploy.sh"
