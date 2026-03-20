#!/bin/bash

# Disher.io Professional Backup Script
# Robust version with error handling, dynamic container discovery, and absolute paths.

# 1. Setup absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

BACKUP_DIR="$SCRIPT_DIR/backups"
LOG_FILE="$BACKUP_DIR/backup.log"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="disher_backup_$DATE"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 2. Load DB Credentials
if [ -f .env ]; then
    set -a
    # shellcheck source=.env
    source .env
    set +a
else
    log "ERROR: .env file not found in $SCRIPT_DIR"
    exit 1
fi

# 3. Discover DB Container Name
# We try to get the container name from docker-compose to avoid hardcoding
DB_CONTAINER=$(docker compose ps -q database 2>/dev/null)

if [ -z "$DB_CONTAINER" ]; then
    log "WARNING: Could not find container for service 'database' via docker-compose. Falling back to default 'disher-db'."
    DB_CONTAINER="disher-db"
fi

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    # Maybe it's an ID, check by ID
    if ! docker ps -q --no-trunc | grep -q "^${DB_CONTAINER}"; then
        log "ERROR: Database container '$DB_CONTAINER' is not running."
        exit 1
    fi
fi

log "Starting backup of container: $DB_CONTAINER"

# 4. Perform mongodump inside the container
# We use a temporary file inside the container
docker exec "$DB_CONTAINER" mongodump \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --archive="/tmp/$BACKUP_NAME.archive" \
    --gzip

if [ $? -ne 0 ]; then
    log "ERROR: mongodump failed inside the container."
    exit 1
fi

# 5. Extract the archive to host
docker cp "$DB_CONTAINER:/tmp/$BACKUP_NAME.archive" "$BACKUP_DIR/$BACKUP_NAME.archive"
CP_STATUS=$?

# Clean up inside container immediately
docker exec "$DB_CONTAINER" rm "/tmp/$BACKUP_NAME.archive"

if [ $CP_STATUS -ne 0 ]; then
    log "ERROR: Failed to copy backup archive from container to host."
    exit 1
fi

# 6. Final compression and verification
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME.archive"
TAR_STATUS=$?
rm "$BACKUP_DIR/$BACKUP_NAME.archive"

if [ $TAR_STATUS -eq 0 ] && [ -f "$BACKUP_DIR/$BACKUP_NAME.tar.gz" ]; then
    log "SUCCESS: Backup created at $BACKUP_DIR/$BACKUP_NAME.tar.gz"
else
    log "ERROR: Final compression failed."
    exit 1
fi

# 7. Rotation: Delete backups older than RETENTION_DAYS
log "Running rotation (Retention: $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "disher_backup_*.tar.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
log "Backup process finished."

