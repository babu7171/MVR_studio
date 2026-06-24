#!/bin/bash
# deploy.sh — MVR Studio Linux Deployment Script
# Run this on your Linux VPS after uploading your files

set -e

echo "╔══════════════════════════════════════════╗"
echo "║   MVR Studio Linux Deployment Script     ║"
echo "╚══════════════════════════════════════════╝"

# 1. Install Node.js 22+ (if not installed)
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
  sudo apt install -y nodejs
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# 2. Install npm dependencies
echo "📦 Installing npm packages..."
cd server
npm install --production

# 3. Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env from example..."
  cp .env.example .env
  echo ""
  echo "⚠️  IMPORTANT: Edit server/.env and set your JWT_SECRET and ADMIN_PASSWORD!"
  echo "   Run: nano server/.env"
  echo ""
fi

# 4. Install PM2 globally (if not installed)
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2 process manager..."
  sudo npm install -g pm2
fi

# 5. Start/restart the app with PM2
echo "🚀 Starting server with PM2..."
pm2 stop mvr-studio 2>/dev/null || true
pm2 start server.js --name mvr-studio
pm2 save

# 6. Set up PM2 to auto-start on system boot
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Deployment Complete!                 ║"
echo "╠══════════════════════════════════════════╣"
echo "║  🌐 Site: http://YOUR_SERVER_IP:3000     ║"
echo "║  🔧 Admin: http://YOUR_SERVER_IP:3000/admin.html"
echo "║  📊 Status: pm2 status                  ║"
echo "║  📋 Logs: pm2 logs mvr-studio           ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "📌 Next Steps for Production:"
echo "   1. Edit server/.env — change JWT_SECRET and ADMIN_PASSWORD"
echo "   2. Set up Nginx reverse proxy (port 80 → 3000)"
echo "   3. Get SSL certificate with: sudo certbot --nginx -d yourdomain.com"
echo ""

# Optional: Print Nginx config template
echo "━━━ NGINX CONFIG TEMPLATE ━━━"
cat << 'NGINX'
# /etc/nginx/sites-available/mvr-studio
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Max upload size
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
