# Disher.io Maintenance Guide

This guide covers database backups, restores, system updates, security operations, and performance tuning for a production Disher.io deployment.

---

## Database Backups

### Automated Daily Backups (Recommended)

Add a cron job on the host machine to run a daily backup:

```bash
# Open crontab editor
crontab -e

# Add this line — runs every day at 3:00 AM
0 3 * * * docker exec disher-db mongodump --archive --gzip > /backups/disher_$(date +\%F).gz
```

Create the backup directory first:
```bash
mkdir -p /backups
```

### Manual Backup

```bash
# Create a compressed backup file with today's date
docker exec disher-db mongodump --archive --gzip > disher_backup_$(date +%F).gz
```

The file `disher_backup_YYYY-MM-DD.gz` will be created in your current directory.

### Automated Backup Rotation (Keep Last 7 Days)

Add this alongside the backup cron to prevent disk fill:

```bash
# Add after the backup line in crontab
0 3 * * * docker exec disher-db mongodump --archive --gzip > /backups/disher_$(date +\%F).gz && find /backups -name "disher_*.gz" -mtime +7 -delete
```

---

## Restore from Backup

> **Warning:** Restoring drops the existing database. Stop the backend first to avoid data conflicts.

```bash
# 1. Stop backend to prevent writes during restore
docker compose stop backend

# 2. Restore from backup file
docker exec -i disher-db mongorestore --archive --gzip --drop < disher_backup_2026-02-23.gz

# 3. Restart backend
docker compose start backend
```

Verify the restore worked:
```bash
docker exec -it disher-db mongosh --eval "use disher; db.orders.countDocuments()"
```

---

## System Updates

### Update to the Latest Version

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker compose up -d --build
```

### Update a Specific Service Only

```bash
# Rebuild backend only
docker compose up -d --build backend

# Rebuild frontend only
docker compose up -d --build frontend
```

### Update Docker Images (Base Images)

```bash
# Pull latest base images (Node, Nginx, MongoDB, Caddy)
docker compose pull

# Rebuild with updated base images
docker compose up -d --build
```

---

## Service Management

### Check Service Status

```bash
docker compose ps
```

Healthy output shows all services as `running (healthy)`.

### View Logs

```bash
# All services (live)
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f caddy

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart Services

```bash
# Graceful restart
docker compose restart backend

# Force recreate (use when config changed)
docker compose up -d --force-recreate backend
```

### Reload Caddy Configuration

When you change `Caddyfile` or `.env` domain settings without rebuilding:

```bash
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

---

## SSL/TLS Certificates

Caddy handles certificate issuance and renewal automatically via **Let's Encrypt**. No manual steps required.

**Requirements for automatic TLS:**
- `DOMAIN` in `.env` must point to your server's public IP
- Ports **80** and **443** must be open and accessible from the internet
- `INSTALL_MODE` must be `production` (not `local`)

**Check certificate status:**
```bash
docker compose logs caddy | grep -i "certificate\|tls\|acme"
```

**If a certificate fails to renew:**
```bash
# Restart Caddy — it will re-attempt issuance
docker compose restart caddy

# Check Caddy logs for errors
docker compose logs caddy -f
```

**Local mode (no TLS):** Local deployments use HTTP only. TLS is not applicable.

---

## Security Maintenance

### Change Admin Password

The preferred method is through the UI:
1. Log in as `admin`
2. Go to `/admin/users`
3. Edit the admin user and update the password

**Emergency reset via database (if locked out):**
```bash
# Open MongoDB shell
docker exec -it disher-db mongosh

# Switch to disher database
use disher

# Generate a new bcrypt hash — use the app or an online bcrypt tool
# Then update the admin user
db.users.updateOne(
  { username: "admin" },
  { $set: { password: "<new-bcrypt-hash>" } }
)

exit
```

> You must use a bcrypt-hashed value (cost factor 10). Use [bcrypt-generator.com](https://bcrypt-generator.com) or `htpasswd -nbB admin newpassword` on the command line.

### Reset the JWT Secret

If you suspect your JWT secret has been compromised:

```bash
# Generate a new secret
openssl rand -hex 32

# Update .env
nano .env
# Replace JWT_SECRET=... with the new value

# Restart backend (all existing tokens are immediately invalidated)
docker compose restart backend
```

> All currently logged-in users will be signed out after the restart.

### Review Activity Logs

The platform logs admin actions to the database. Review them via the API:

```bash
curl -H "Authorization: Bearer <token>" https://yourdomain.com/api/logs
```

---

## Performance Tuning

### Memory Configuration

Edit `.env` to adjust resource limits based on your hardware:

**For 1 GB RAM (Raspberry Pi 3 / low-end VPS):**
```bash
NODE_MAX_MEMORY_MB=256
MONGO_CACHE_SIZE_MB=128
```

**For 2 GB RAM (Raspberry Pi 4):**
```bash
NODE_MAX_MEMORY_MB=384
MONGO_CACHE_SIZE_MB=256
```

**For 4 GB+ RAM (standard VPS or local server):**
```bash
NODE_MAX_MEMORY_MB=512
MONGO_CACHE_SIZE_MB=1024
```

After changing, restart the affected services:
```bash
docker compose up -d --force-recreate backend db
```

### MongoDB Performance

Check if MongoDB is using indexes efficiently:

```bash
docker exec -it disher-db mongosh

use disher

# Check index usage on orders (most queried collection)
db.orders.getIndexes()

# View slow query stats
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ ts: -1 }).limit(5)
```

### Check Disk Usage

```bash
# Overall Docker disk usage
docker system df

# Named volume sizes
docker system df -v | grep disher

# Prune unused images and build cache
docker system prune -f
```

### Log Rotation

Docker log rotation is already configured in `docker-compose.prod.yml`. For the development compose file, add it manually if needed:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## Monitoring

### Quick Health Check

```bash
# Check API health
curl http://localhost:3000/api/health

# Check all container statuses
docker compose ps

# Check resource usage
docker stats --no-stream
```

### Check for Errors in Logs

```bash
# Backend errors in the last hour
docker compose logs --since=1h backend | grep -i "error\|warn\|fail"

# MongoDB errors
docker compose logs --since=1h db | grep -i "error\|warn"
```

---

## Disaster Recovery

### Full System Recovery

If you need to rebuild from scratch with an existing backup:

```bash
# 1. Clone the repository
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# 2. Restore your .env file (from backup or recreate it)
cp .env.example .env
nano .env  # Set your values

# 3. Start only the database first
docker compose up -d db

# 4. Restore your backup
docker exec -i disher-db mongorestore --archive --gzip --drop < disher_backup_YYYY-MM-DD.gz

# 5. Start everything else
docker compose up -d

# 6. Verify services are healthy
docker compose ps
curl http://localhost:3000/api/health
```

---

**Last Updated:** February 2026
