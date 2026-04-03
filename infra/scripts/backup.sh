#!/bin/bash
set -e

# Database Backup Script
# Usage: ./backup.sh [daily|manual|pre-deploy]

TYPE=${1:-manual}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load environment variables
if [[ -f "$PROJECT_DIR/.env" ]]; then
    source "$PROJECT_DIR/.env"
fi

if [[ -f "$PROJECT_DIR/.secrets" ]]; then
    source "$PROJECT_DIR/.secrets"
fi

# Verify required variables
if [[ -z "$DB_USER" || -z "$DB_NAME" ]]; then
    log_error "DB_USER and DB_NAME must be set"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_FILE="backup-${TYPE}-${TIMESTAMP}.sql"

log_info "Creating backup: $BACKUP_FILE"

# Create backup
cd "$PROJECT_DIR"

if docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE"; then
    # Verify backup is not empty
    if [[ ! -s "$BACKUP_DIR/$BACKUP_FILE" ]]; then
        log_error "Backup file is empty"
        rm -f "$BACKUP_DIR/$BACKUP_FILE"
        exit 1
    fi

    # Compress
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_FILE}.gz" | cut -f1)
    log_info "Backup created: ${BACKUP_FILE}.gz ($BACKUP_SIZE)"

    # Cleanup old backups based on type
    case "$TYPE" in
        daily)
            find "$BACKUP_DIR" -name "backup-daily-*.sql.gz" -mtime +30 -delete
            log_info "Cleaned up daily backups older than 30 days"
            ;;
        manual)
            find "$BACKUP_DIR" -name "backup-manual-*.sql.gz" -mtime +7 -delete
            log_info "Cleaned up manual backups older than 7 days"
            ;;
        pre-deploy)
            find "$BACKUP_DIR" -name "backup-pre-deploy-*.sql.gz" -mtime +14 -delete
            log_info "Cleaned up pre-deploy backups older than 14 days"
            ;;
    esac

    # Show recent backups
    log_info "Recent backups:"
    ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5

else
    log_error "Backup failed"
    exit 1
fi
