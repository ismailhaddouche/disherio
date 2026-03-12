#!/bin/bash

# Disher.io Backup Script
# This script dumps the MongoDB database from the Docker container, compresses it, and keeps a 7-day rotation.

# 1. Configuration
BACKUP_DIR="./backups"
DB_CONTAINER="disher-db"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="disher_backup_$DATE"
RETENTION_DAYS=7

# 2. Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# 3. Load DB Credentials from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# 4. Perform mongodump inside the container
echo "[$(date)] Starting backup of container $DB_CONTAINER..."
docker exec "$DB_CONTAINER" mongodump \
    --username "$MONGO_INITDB_ROOT_USERNAME" \
    --password "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --archive="/tmp/$BACKUP_NAME.archive"

# 5. Extract the archive from container to host and compress
docker cp "$DB_CONTAINER:/tmp/$BACKUP_NAME.archive" "$BACKUP_DIR/$BACKUP_NAME.archive"
docker exec "$DB_CONTAINER" rm "/tmp/$BACKUP_NAME.archive"

tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME.archive"
rm "$BACKUP_DIR/$BACKUP_NAME.archive"

# 6. Check results
if [ -f "$BACKUP_DIR/$BACKUP_NAME.tar.gz" ]; then
    echo "[$(date)] SUCCESS: Backup created at $BACKUP_DIR/$BACKUP_NAME.tar.gz"
    echo "$(date) - SUCCESS - $BACKUP_NAME.tar.gz" >> "$BACKUP_DIR/backup.log"
else
    echo "[$(date)] ERROR: Backup failed!"
    echo "$(date) - ERROR - Backup failed" >> "$BACKUP_DIR/backup.log"
    exit 1
fi

# 7. Rotation: Delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "disher_backup_*.tar.gz" -mtime +$RETENTION_DAYS -exec rm {} \;
echo "[$(date)] Rotation completed. Old backups removed."
