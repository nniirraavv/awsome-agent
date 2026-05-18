#!/bin/bash
# Run this ONCE on a fresh EC2 Ubuntu instance to install all dependencies.
# Usage: bash setup-ec2.sh

set -e

echo "==> Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "==> Installing build tools..."
sudo apt-get install -y git curl unzip nginx

echo "==> Installing PM2..."
sudo npm install -g pm2

echo "==> Installing uv (for MCP servers)..."
curl -LsSf https://astral.sh/uv/install.sh | sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"

echo "==> Installing Java 17 (for DynamoDB Local if needed)..."
sudo apt-get install -y openjdk-17-jre-headless

echo "==> Verifying installations..."
node --version
npm --version
pm2 --version
uvx --version || echo "uvx installed, restart shell to use"

echo ""
echo "==> EC2 setup complete. Now run deploy.sh from your local machine."
