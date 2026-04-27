# VPS Deployment Guide

This guide covers deploying My-SaaS to a VPS with Traefik as the reverse proxy.

## Prerequisites

- VPS with Docker and Docker Compose installed
- Domain pointing to your VPS IP (A record)
- SSH access to the server

## Architecture Overview

```
Internet → Traefik (443) → Docker Network → App Containers
                ↓
         Let's Encrypt (auto SSL)
```

## Pre-Deploy Checklist

- [ ] DNS A record configured for your domain
- [ ] DNS A record for subdomains (api.domain.com, dev.domain.com if needed)
- [ ] Docker and Docker Compose installed on VPS
- [ ] Firewall allows ports 80 and 443

## Step-by-Step Deployment

### 1. Create the Traefik Network

**This must be done BEFORE starting any containers.**

```bash
docker network create traefik-public
```

### 2. Configure Environment Variables

Copy and configure the environment files:

```bash
# Create directories
mkdir -p /opt/my-saas/{traefik,prod,dev}

# Copy .env.example to each location
cp .env.example /opt/my-saas/prod/.env
cp .env.example /opt/my-saas/dev/.env
```

Edit `/opt/my-saas/prod/.env`:

```bash
# Required changes
DOMAIN=yourdomain.com
ACME_EMAIL=admin@yourdomain.com  # CRITICAL: Let's Encrypt needs this
NODE_ENV=production
```

### 3. Configure Secrets

Create a `.secrets` file (never commit this):

```bash
# /opt/my-saas/prod/.secrets
DB_PASSWORD=your-secure-db-password
REDIS_PASSWORD=your-secure-redis-password
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
```

### 4. Generate Basic Auth Credentials

For the Traefik dashboard and admin routes:

```bash
# Install htpasswd if not available
apt-get install apache2-utils

# Generate credentials
htpasswd -nb admin your-secure-password
```

Output example:
```
admin:$apr1$ruca84Hq$mbjdMZBAG.KWn7vfN/SNK/
```

Update `infra/traefik/dynamic/middlewares.yml` with the generated hash.

### 5. Start Traefik First

```bash
cd /opt/my-saas/traefik
docker compose up -d

# Verify it's running
docker logs traefik
```

Look for:
- "Configuration loaded from file"
- "Starting provider aggregator"
- No certificate errors

### 6. Start Application

```bash
cd /opt/my-saas/prod
docker compose up -d

# Check logs
docker compose logs -f
```

## Startup Order

The correct startup order is critical:

1. **Traefik** (creates network routes)
2. **Database** (PostgreSQL)
3. **Redis** (cache/sessions)
4. **API** (backend)
5. **Web** (frontend)

## Verification

### Check Traefik Dashboard

Access `https://traefik.yourdomain.com` with the basic auth credentials.

### Check SSL Certificates

```bash
# Check certificate status
docker exec traefik cat /letsencrypt/acme.json | jq '.letsencrypt.Certificates[].domain'

# Or check via curl
curl -vI https://yourdomain.com 2>&1 | grep -A5 "Server certificate"
```

### Check Application Health

```bash
# API health check
curl https://api.yourdomain.com/health

# Web application
curl -I https://yourdomain.com
```

## Troubleshooting

### Let's Encrypt Certificate Not Generated

**Symptoms**: Site shows "Not Secure" or certificate error

**Causes & Solutions**:

1. **ACME_EMAIL not set**
   ```bash
   # Check if email is configured
   grep ACME_EMAIL /opt/my-saas/prod/.env
   ```

2. **DNS not propagated**
   ```bash
   # Verify DNS
   dig +short yourdomain.com
   ```

3. **Ports 80/443 blocked**
   ```bash
   # Check firewall
   ufw status
   # Allow if needed
   ufw allow 80/tcp
   ufw allow 443/tcp
   ```

4. **Rate limited** (too many attempts)
   - Wait 1 hour and try again
   - Use staging ACME server for testing

### Dashboard Returns 401 Unauthorized

**Cause**: Basic auth credentials not configured or incorrect

**Solution**:
1. Regenerate: `htpasswd -nb admin new-password`
2. Update `middlewares.yml` with new hash
3. Restart Traefik: `docker compose restart`

### Container Can't Connect to Network

**Symptoms**: "network traefik-public not found"

**Solution**:
```bash
# Create the network
docker network create traefik-public

# Then restart containers
docker compose up -d
```

### Application Returns 502 Bad Gateway

**Causes**:
1. App container not running
2. Wrong internal port configuration
3. Container not on traefik-public network

**Debug**:
```bash
# Check container status
docker ps -a

# Check if container is on network
docker network inspect traefik-public

# Check container logs
docker logs my-saas-api
```

## Useful Commands

```bash
# View all running containers
docker ps

# View Traefik logs
docker logs -f traefik

# Restart Traefik
docker compose -f /opt/my-saas/traefik/docker-compose.yml restart

# Force certificate renewal
docker exec traefik rm /letsencrypt/acme.json
docker compose restart

# Check network
docker network ls
docker network inspect traefik-public

# View container resources
docker stats
```

## Security Reminders

- [ ] Change default basic auth credentials
- [ ] Keep `.secrets` file secure (chmod 600)
- [ ] Never commit secrets to git
- [ ] Regularly update Docker images
- [ ] Monitor Traefik access logs
- [ ] Enable IP whitelist for admin routes if possible
