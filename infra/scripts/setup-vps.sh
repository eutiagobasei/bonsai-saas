#!/bin/bash
set -e

# VPS Initial Setup Script
# Run this on a fresh VPS to set up the infrastructure

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "=== VPS Initial Setup ==="

# Update system
log_info "Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    log_info "Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
else
    log_info "Docker Compose already installed"
fi

# Create directory structure
log_info "Creating directory structure..."
mkdir -p /opt/{traefik/{dynamic,letsencrypt},my-saas/{dev,prod}/{backups}}

# Set permissions
chmod 600 /opt/traefik/letsencrypt
chmod 700 /opt/my-saas/dev /opt/my-saas/prod

# Create Traefik network
if ! docker network ls | grep -q traefik-public; then
    log_info "Creating Traefik network..."
    docker network create traefik-public
else
    log_info "Traefik network already exists"
fi

# Configure firewall
log_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    ufw --force enable
    log_info "UFW firewall configured"
fi

# Create deploy user (optional, for CI/CD)
if ! id -u deploy &>/dev/null; then
    log_info "Creating deploy user..."
    useradd -m -s /bin/bash -G docker deploy
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    log_warn "Remember to add SSH public key to /home/deploy/.ssh/authorized_keys"
fi

log_info "=== Setup Complete ==="
echo ""
log_info "Next steps:"
echo "1. Copy Traefik config to /opt/traefik/"
echo "2. Copy environment files to /opt/my-saas/{dev,prod}/"
echo "3. Set correct permissions on .secrets files (chmod 600)"
echo "4. Start Traefik: cd /opt/traefik && docker compose up -d"
echo "5. Deploy app: cd /opt/my-saas/dev && ./deploy.sh"
