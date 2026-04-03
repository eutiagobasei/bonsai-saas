#!/bin/bash
set -e

# Database Backup Script
# Usage: ./backup-db.sh [daily|manual]

TYPE=${1:-manual}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$API_DIR/backups"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verify required environment variables
if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    log_error "DB_USER and DB_NAME must be set"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_FILE="backup-${TYPE}-${TIMESTAMP}.sql"

log_info "Creating backup: $BACKUP_FILE"

if docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE"; then
    # Compress the backup
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    log_info "Backup created: $BACKUP_DIR/${BACKUP_FILE}.gz"

    # Cleanup old backups (keep last 30 days for daily, 7 days for manual)
    if [ "$TYPE" = "daily" ]; then
        find "$BACKUP_DIR" -name "backup-daily-*.sql.gz" -mtime +30 -delete
        log_info "Cleaned up backups older than 30 days"
    else
        find "$BACKUP_DIR" -name "backup-manual-*.sql.gz" -mtime +7 -delete
        log_info "Cleaned up manual backups older than 7 days"
    fi
else
    log_error "Backup failed"
    exit 1
fi
