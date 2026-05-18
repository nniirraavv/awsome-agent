#!/bin/bash
# One-command deploy: push to GitHub then deploy to EC2.
# Usage: bash scripts/deploy-ec2.sh
# Run from project root: /Users/eternal/projects/aws-devops-chatbot

set -e

# ── Config ────────────────────────────────────────────────────────────────────
EC2_IP="34.195.8.30"
EC2_USER="ubuntu"
SSH_KEY="$HOME/Downloads/pers-ubuntu.pem"
REPO="nniirraavv/awsome-agent"
APP_DIR="/home/ubuntu/awsome-agent"
BRANCH="main"
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}==> $1${NC}"; }
warn() { echo -e "${YELLOW}==> $1${NC}"; }
fail() { echo -e "${RED}==> ERROR: $1${NC}"; exit 1; }

# ── 1. Check SSH key ──────────────────────────────────────────────────────────
[ -f "$SSH_KEY" ] || fail "SSH key not found at $SSH_KEY"
chmod 400 "$SSH_KEY"

# ── 2. Push to GitHub ─────────────────────────────────────────────────────────
log "Pushing to GitHub (github.com/$REPO)..."
git add -A
git diff --cached --quiet && warn "Nothing new to commit — skipping commit" || \
  git commit -m "deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin "$BRANCH"
log "GitHub push done."

# ── 3. Deploy on EC2 ─────────────────────────────────────────────────────────
log "Connecting to EC2 at $EC2_IP..."

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << ENDSSH
set -e

export PATH="\$HOME/.local/bin:\$PATH"
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && source "\$NVM_DIR/nvm.sh"

echo "==> Pulling latest code..."
if [ -d "$APP_DIR" ]; then
  cd $APP_DIR
  git pull origin $BRANCH
else
  git clone https://github.com/$REPO.git $APP_DIR
  cd $APP_DIR
fi

echo "==> Installing backend dependencies..."
npm install --prefix backend

echo "==> Installing frontend dependencies..."
npm install --prefix frontend

echo "==> Building frontend..."
npm run build --prefix frontend

echo "==> Copying nginx config..."
sudo cp scripts/nginx.conf /etc/nginx/sites-available/awsome-agent
sudo ln -sf /etc/nginx/sites-available/awsome-agent /etc/nginx/sites-enabled/awsome-agent
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "==> Starting/restarting backend with PM2..."
if pm2 list | grep -q "chatbot-backend"; then
  pm2 restart chatbot-backend
else
  cd $APP_DIR/backend
  pm2 start "npm run dev" --name chatbot-backend
  pm2 save
  pm2 startup | tail -1 | sudo bash || true
fi

echo "==> Deploy complete!"
echo "    App running at: http://$EC2_IP"
echo "    Backend health: http://$EC2_IP/health"
ENDSSH

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Deploy complete!"
log "Frontend : http://$EC2_IP"
log "Health   : http://$EC2_IP/health"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
