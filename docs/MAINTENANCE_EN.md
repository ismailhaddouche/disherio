# Disher.io v2.6 Maintenance Guide

This guide covers backups, restorations, updates, and security for a Disher.io deployment.

---

## Database Backups and Restoration

### 1. Create a Backup (Recommended)

Use the automated `backup.sh` script included in the project root to create consistent, compressed backups.

```bash
chmod +x backup.sh
sudo ./backup.sh
```

The script will generate a file `backups/disher_backup_YYYY-MM-DD_HH-MM-SS.tar.gz`. Only the last 7 copies are kept to preserve disk space.

**Save this file in an external, secure location.**

### 2. Restore from a Backup

> **Warning:** Restoration overwrites all current data.

```bash
# 1. Load environment variables from your .env file
# This step is CRITICAL for authentication!
set -a
source .env
set +a

# 2. Stop the backend service to avoid conflicts
sudo docker compose stop backend

# 3. Execute the restoration command
# Use "database", which is the official service name.
# Replace "backup-file.tar.gz" with your file name.
sudo docker exec -i database mongorestore \
    --username="$MONGO_INITDB_ROOT_USERNAME" \
    --password="$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase=admin \
    --archive --gzip --drop < backup-file.tar.gz

# 4. Restart the backend
sudo docker compose start backend
```

### 3. Backup Automation (Cron Job)

To automate backups, use a cron job. Ensure the executing script loads environment variables first.

**Step A: Create a backup script (`/opt/disher_backup.sh`)**

```bash
#!/bin/bash

# Load environment from the Disher.io directory
cd /home/user/disherio # <-- Adjust this path to your project directory
set -a
source .env
set +a

# Define the backup directory
BACKUP_DIR="/var/backups/disher"
mkdir -p "$BACKUP_DIR"

# Execute the backup
docker compose exec -T database mongodump \
    --username="$MONGO_INITDB_ROOT_USERNAME" \
    --password="$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase=admin \
    --archive --db=disher --gzip > "$BACKUP_DIR/disher-backup-$(date +%Y-%m-%d).tar.gz"
```

**Step B: Add the script to cron**

```bash
# Open the crontab editor
crontab -e

# Add this line for a daily backup at 4:00 AM (adjust the path)
0 4 * * * cd /home/user/disherio && ./backup.sh > /dev/null 2>&1
```

---

## Credential and Security Management

### Change User Passwords

Use the configuration script to change passwords securely.

```bash
sudo ./configure.sh
```

1.  Select option **"1) Change a user's password"**.
2.  Enter the username (`admin`, `waiter`, etc.) and the new password.

### Rotate Session Secret (JWT_SECRET)

If you think your session secret has been exposed, generate a new one.

```bash
# 1. Generate a new secret
openssl rand -hex 32

# 2. Update the JWT_SECRET value in your .env file
sudo nano .env

# 3. Restart the backend to apply the change
# This will close all active sessions.
sudo docker compose restart backend
```

---

## Updates and Diagnostics

### Update the Application

The installation script also serves for updating.

```bash
# 1. Get the latest changes
git pull origin main

# 2. Run the installer in update mode
sudo ./install.sh
```

### Export Diagnostic Logs

Use option **"6) Export Diagnostic Logs"** in `sudo ./configure.sh` to get a file with all system logs.

---

## DNS Configuration Consultation

If your installation uses a public domain, you can view the necessary DNS records at any time by running:

```bash
sudo ./show-dns.sh
```

The script will show the server's public IP, recommended A and CAA records, and the configured access URL.
