#!/bin/bash
set -e

# One-time Provisioning Script for Ubuntu 24.04 EC2 Instance (Relio Backend)
echo "🌟 Initializing EC2 Server Provisioning..."

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2
sudo npm install -g pm2

# 4. Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 5. Configure PostgreSQL
echo "💾 Configuring PostgreSQL Database..."
sudo -u postgres psql -c "CREATE DATABASE relio;" || echo "Database 'relio' already exists"
sudo -u postgres psql -c "CREATE USER relio WITH PASSWORD 'reliopassword123';" || echo "User 'relio' already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE relio TO relio;"
sudo -u postgres psql -d relio -c "GRANT ALL ON SCHEMA public TO relio;"

# 6. Install Redis
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 7. Install Nginx
sudo apt install -y nginx

# 8. Configure Nginx as Reverse Proxy
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/relio-api <<EOF
server {
    listen 80;
    server_name api.relio.in;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/relio-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 9. Install Git
sudo apt install -y git

# 10. Install Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

echo "✅ Provisioning complete!"
echo "👉 Now run: git clone https://github.com/JOSBEAK/relio.git ~/relio"
echo "👉 After cloning, configure your .env file in ~/relio/backend/.env"
echo "👉 Use DATABASE_URL=postgresql://relio:reliopassword123@localhost:5432/relio"
