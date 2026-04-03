#!/bin/bash
set -e

# Database Restore Script
# Usage: ./restore-db.sh <backup-file>

BACKUP_FILE=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$API_DIR/backups"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/*.sql* 2>/dev/null || echo "No backups found"
    exit 1
fi

# Verify required environment variables
if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    log_error "DB_USER and DB_NAME must be set"
    exit 1
fi

# Check if file exists
FULL_PATH="$BACKUP_DIR/$BACKUP_FILE"
if [ ! -f "$FULL_PATH" ]; then
    # Try without directory prefix
    if [ -f "$BACKUP_FILE" ]; then
        FULL_PATH="$BACKUP_FILE"
    else
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

log_warn "=== DATABASE RESTORE ==="
log_warn "This will REPLACE all data in $DB_NAME"
log_warn "Backup file: $FULL_PATH"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Restore cancelled"
    exit 0
fi

# Create a backup before restore
PRE_RESTORE_BACKUP="backup-pre-restore-$(date +%Y%m%d%H%M%S).sql"
log_info "Creating safety backup before restore: $PRE_RESTORE_BACKUP"
docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$PRE_RESTORE_BACKUP"

# Restore
log_info "Restoring database..."

if [[ "$FULL_PATH" == *.gz ]]; then
    # Decompress and restore
    gunzip -c "$FULL_PATH" | docker compose exec -T postgres psql -U "$DB_USER" "$DB_NAME"
else
    # Restore directly
    docker compose exec -T postgres psql -U "$DB_USER" "$DB_NAME" < "$FULL_PATH"
fi

log_info "=== Restore completed ==="
log_info "Safety backup: $BACKUP_DIR/$PRE_RESTORE_BACKUP"
