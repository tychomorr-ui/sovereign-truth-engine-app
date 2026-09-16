#!/usr/bin/env bash
set -Eeuo pipefail

# Run from the Lightsail browser console as a sudo-capable Ubuntu user.
# Before first use, copy .env.example to .env and fill in every required value.

APP_DIR="${APP_DIR:-/opt/keira}"
REPO_URL="${REPO_URL:-https://github.com/tychomorr-ui/keira.git}"
BRANCH="${BRANCH:-main}"
KEIRA_DOMAIN="${KEIRA_DOMAIN:-keira.xinus.one}"
APP_PORT="${APP_PORT:-3210}"

required_environment_variables=(
  DATABASE_URL
  JWT_SECRET
  PORTAL_OWNER_ACCESS_TOKEN
  PORTAL_S3_BUCKET
  PORTAL_S3_REGION
)

require_env_file() {
  if [[ ! -f .env ]]; then
    cat > .env <<'ENVIRONMENT'
NODE_ENV=production
PORT=3210
DATABASE_URL=mysql://portal_user:replace-with-password@replace-with-rds-endpoint:3306/portal_db
JWT_SECRET=replace-with-a-long-random-secret
PORTAL_OWNER_ACCESS_TOKEN=replace-with-a-long-random-owner-token
LOCAL_LLM_BASE_URL=
LOCAL_LLM_MODEL=
LOCAL_LLM_API_KEY=
LOCAL_LLM_MAX_TOKENS=4096
LOCAL_LLM_TEMPERATURE=0.1
LOCAL_LLM_TOP_P=0.9
LOCAL_LLM_TIMEOUT_MS=60000
PORTAL_S3_BUCKET=replace-with-an-s3-bucket-name
PORTAL_S3_REGION=sa-east-1
ENVIRONMENT
    chmod 600 .env
    echo "Created $APP_DIR/.env. Fill it with real secrets, then rerun this script."
    exit 1
  fi

  for key in "${required_environment_variables[@]}"; do
    value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true)"
    if [[ -z "$value" || "$value" == *"replace-with"* || "$value" == "CHANGE_ME" ]]; then
      echo "Missing required production environment variable: ${key}"
      exit 1
    fi
  done
}

echo "Installing base packages and Node.js 22..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl git build-essential nginx certbot python3-certbot-nginx
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(`.`)[0]')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pnpm pm2

echo "Retrieving the audited KEIRA source..."
if [[ -d "$APP_DIR/.git" ]]; then
  sudo git -C "$APP_DIR" fetch origin "$BRANCH"
  sudo git -C "$APP_DIR" checkout "$BRANCH"
  sudo git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  sudo git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
sudo chown -R "$(id -u):$(id -g)" "$APP_DIR"
cd "$APP_DIR"

require_env_file

echo "Installing, applying committed migrations, and building KEIRA..."
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm build

echo "Starting KEIRA through PM2..."
pm2 delete keira-intelligence 2>/dev/null || true
pm2 start dist/index.js --name keira-intelligence --cwd "$APP_DIR" --update-env
pm2 save

echo "Configuring the Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/keira >/dev/null <<NGINX
limit_req_zone \$binary_remote_addr zone=keira_auth:10m rate=10r/m;

server {
    listen 80;
    server_name ${KEIRA_DOMAIN};

    # Ignored by browsers over HTTP, enforced after Certbot enables TLS.
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location ~ ^/api/trpc/auth\.(login|register|ownerBootstrap) {
        limit_req zone=keira_auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
sudo ln -sfn /etc/nginx/sites-available/keira /etc/nginx/sites-enabled/keira
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo
echo "KEIRA is running locally at http://127.0.0.1:${APP_PORT}."
echo "Verify with: curl -I http://127.0.0.1:${APP_PORT}/ && pm2 logs keira-intelligence --lines 50"
echo "After the DNS A record for ${KEIRA_DOMAIN} points to this instance, issue TLS with:"
echo "  sudo certbot --nginx -d ${KEIRA_DOMAIN}"
echo "For startup after reboots, run the command printed by: pm2 startup"
