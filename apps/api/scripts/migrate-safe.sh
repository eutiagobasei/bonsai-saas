#!/bin/bash
set -e

# Safe Migration Script for Prisma
# Usage: ./migrate-safe.sh [dev|prod]

ENV=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$API_DIR/backups"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

if [ "$ENV" = "prod" ]; then
    log_warn "=== PRODUCTION ENVIRONMENT ==="
    log_info "Backup is MANDATORY before migrating"

    # Verify required environment variables
    if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
        log_error "DB_USER and DB_NAME must be set for production migrations"
        exit 1
    fi

    # 1. Create automatic backup
    BACKUP_FILE="backup-pre-migrate-$(date +%Y%m%d%H%M%S).sql"
    log_info "Creating backup: $BACKUP_FILE"

    if docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then
        log_info "Backup created successfully: $BACKUP_DIR/$BACKUP_FILE"

        # Verify backup is not empty
        if [ ! -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
            log_error "Backup file is empty. Aborting migration."
            rm -f "$BACKUP_DIR/$BACKUP_FILE"
            exit 1
        fi
    else
        log_error "Failed to create backup. Aborting migration."
        exit 1
    fi

    # 2. Only deploy existing migrations (never creates new ones)
    log_info "Applying migrations with 'prisma migrate deploy'..."
    cd "$API_DIR"
    npx prisma migrate deploy

    log_info "=== Migration completed successfully ==="
    log_info "Backup available at: $BACKUP_DIR/$BACKUP_FILE"

elif [ "$ENV" = "dev" ]; then
    log_info "=== DEVELOPMENT ENVIRONMENT ==="
    log_info "Running 'prisma migrate dev'..."

    cd "$API_DIR"
    npx prisma migrate dev

    log_info "=== Migration completed ==="

else
    log_error "Invalid environment: $ENV"
    echo "Usage: $0 [dev|prod]"
    exit 1
fi
