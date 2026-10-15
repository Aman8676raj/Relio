#!/bin/bash
set -e

# Deployment Script for Relio Backend
cd ~/relio/backend

echo "🚀 Starting backend deployment..."

# 1. Install ONLY production dependencies (Saves RAM!)
npm install --omit=dev

# 2. Run Database Migrations & Generate Client
echo "📦 Running Prisma migrations..."
npx prisma migrate resolve --rolled-back "20260406183412_sync"
npx prisma migrate deploy

echo "⚙️ Regenerating Prisma Client..."
npx prisma generate

# 3. Restart or Start the application with PM2
echo "🔄 Restarting application with PM2..."
if pm2 status | grep -q "relio-api"; then
    pm2 restart relio-api
else
    pm2 start dist/src/main.js --name relio-api
fi

echo "✅ Server restart complete!"
