#!/bin/bash
set -e

# Deploy Script for My-SaaS
# Usage: ./deploy.sh [dev|prod] [version]

ENV=${1:-dev}
VERSION=${2:-latest}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
    log_error "Invalid environment: $ENV"
    echo "Usage: $0 [dev|prod] [version]"
    exit 1
fi

# Set paths
PROJECT_DIR="/opt/my-saas/$ENV"
COMPOSE_FILE="docker-compose.${ENV}.yml"

log_info "=== Deploying My-SaaS to $ENV ==="
log_info "Version: $VERSION"

cd "$PROJECT_DIR"

# Verify required files exist
if [[ ! -f ".env" ]]; then
    log_error ".env file not found"
    exit 1
fi

if [[ ! -f ".secrets" ]]; then
    log_error ".secrets file not found"
    exit 1
fi

# Production-specific checks
if [[ "$ENV" == "prod" ]]; then
    log_warn "=== PRODUCTION DEPLOYMENT ==="

    # Create backup before deployment
    log_info "Creating pre-deploy backup..."
    ./backup.sh || {
        log_error "Backup failed. Aborting deployment."
        exit 1
    }
fi

# Pull latest images
log_info "Pulling images..."
export VERSION
docker compose -f "$COMPOSE_FILE" pull

# Run database migrations (safe: only deploy, never create)
log_info "Running database migrations..."
docker compose -f "$COMPOSE_FILE" run --rm api npx prisma migrate deploy

# Deploy with zero-downtime for production
if [[ "$ENV" == "prod" ]]; then
    log_info "Performing zero-downtime deployment..."

    # Scale up API to 2 instances
    docker compose -f "$COMPOSE_FILE" up -d --no-deps --scale api=2 api
    sleep 15

    # Scale back down and update
    docker compose -f "$COMPOSE_FILE" up -d --no-deps api
    docker compose -f "$COMPOSE_FILE" up -d web
else
    log_info "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d
fi

# Health check
log_info "Running health checks..."
sleep 10

if ! curl -sf http://localhost:3000/health > /dev/null; then
    log_error "API health check failed!"

    if [[ "$ENV" == "prod" ]]; then
        log_warn "Attempting rollback..."
        # Get previous image tag
        PREV_TAG=$(docker images --format "{{.Tag}}" | grep -v latest | head -1)
        if [[ -n "$PREV_TAG" ]]; then
            export VERSION="$PREV_TAG"
            docker compose -f "$COMPOSE_FILE" up -d
            log_warn "Rolled back to $PREV_TAG"
        fi
    fi
    exit 1
fi

# Cleanup old images
log_info "Cleaning up old images..."
docker image prune -f

log_info "=== Deployment complete ==="
log_info "Environment: $ENV"
log_info "Version: $VERSION"

# Show running containers
docker compose -f "$COMPOSE_FILE" ps
