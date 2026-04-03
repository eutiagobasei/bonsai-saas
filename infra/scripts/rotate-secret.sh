#!/bin/bash
set -e

# Secret Rotation Script
# Usage: ./rotate-secret.sh <SECRET_NAME> <NEW_VALUE> <ENV>

SECRET_NAME=$1
NEW_VALUE=$2
ENV=$3

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate arguments
if [[ -z "$SECRET_NAME" || -z "$NEW_VALUE" || -z "$ENV" ]]; then
    log_error "Usage: $0 <SECRET_NAME> <NEW_VALUE> <ENV>"
    echo ""
    echo "Arguments:"
    echo "  SECRET_NAME - Name of the secret to rotate (e.g., DB_PASSWORD, JWT_SECRET)"
    echo "  NEW_VALUE   - New value for the secret"
    echo "  ENV         - Environment (dev or prod)"
    echo ""
    echo "Example:"
    echo "  $0 JWT_SECRET 'new-super-secret-key' prod"
    exit 1
fi

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
    log_error "Invalid environment: $ENV. Must be 'dev' or 'prod'"
    exit 1
fi

PROJECT_DIR="/opt/my-saas/$ENV"
SECRETS_FILE="$PROJECT_DIR/.secrets"

# Check if secrets file exists
if [[ ! -f "$SECRETS_FILE" ]]; then
    log_error "Secrets file not found: $SECRETS_FILE"
    exit 1
fi

# Validate secret name exists
if ! grep -q "^${SECRET_NAME}=" "$SECRETS_FILE"; then
    log_error "Secret '$SECRET_NAME' not found in $SECRETS_FILE"
    echo ""
    echo "Available secrets:"
    grep -E "^[A-Z_]+=" "$SECRETS_FILE" | cut -d= -f1
    exit 1
fi

log_warn "=== SECRET ROTATION ==="
log_info "Environment: $ENV"
log_info "Secret: $SECRET_NAME"

# Create backup
BACKUP_FILE="${SECRETS_FILE}.backup.$(date +%Y%m%d%H%M%S)"
cp "$SECRETS_FILE" "$BACKUP_FILE"
log_info "Backup created: $BACKUP_FILE"

# Update secret
# Escape special characters in the value
ESCAPED_VALUE=$(printf '%s\n' "$NEW_VALUE" | sed 's/[&/\]/\\&/g')
sed -i "s/^${SECRET_NAME}=.*/${SECRET_NAME}=${ESCAPED_VALUE}/" "$SECRETS_FILE"
log_info "Secret updated in $SECRETS_FILE"

# Restart services
log_info "Restarting services..."
cd "$PROJECT_DIR"
docker compose up -d

# Wait for services to be healthy
log_info "Waiting for health check..."
sleep 15

if curl -sf http://localhost:3000/health > /dev/null; then
    log_info "=== Secret rotation complete ==="

    # Clean up old backup
    rm -f "$BACKUP_FILE"
else
    log_error "Health check failed after secret rotation"
    log_warn "Restoring from backup..."

    # Restore backup
    cp "$BACKUP_FILE" "$SECRETS_FILE"
    docker compose up -d

    log_warn "Secret rotation rolled back"
    exit 1
fi
