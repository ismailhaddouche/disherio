# Scripts

All scripts must be run as root from the project root directory.

## install.sh

Full installation in a single command.

```bash
sudo ./scripts/install.sh
```

What it does:

1. Prompts for access mode: public domain (HTTPS), public IP, or local IP
2. Installs Docker and Docker Compose if not present
3. Configures UFW firewall (ports 22, 80, 443)
4. Generates a random `JWT_SECRET` and admin password
5. Writes `.env` and `Caddyfile`
6. Builds Docker images (`--no-cache`)
7. Starts all services with `docker compose up -d`
8. Waits for the backend health check to pass
9. Runs the database seeder to create the admin user
10. Prints the access URL and credentials

The full installation log is written to `/var/log/disherio_install.log`.

## configure.sh

Reconfigure a running installation without reinstalling.

```bash
sudo ./scripts/configure.sh
```

Options:

| Option | Description |
|--------|-------------|
| 1 | Change network mode / domain / IP |
| 2 | Change HTTP port |
| 3 | Reset admin password |
| 4 | Change default language |
| 5 | Show current configuration |

## backup.sh

Back up the MongoDB database.

```bash
sudo ./scripts/backup.sh
```

- Uses `mongodump` inside the running container
- Compresses the dump to a `.tar.gz` archive
- Stores it in `/var/backups/disherio/`
- Automatically removes backups older than 7 days

The retention period can be overridden with `RETENTION_DAYS=30 sudo ./scripts/backup.sh`.

## info.sh

Display a full status panel.

```bash
sudo ./scripts/info.sh
```

Shows:

- Configured access URL
- Local and public IP addresses
- DNS resolution for configured domain
- Container health and status
- CPU and memory usage per container
- Disk and volume usage
- Application version and system info

## Docker reference

```bash
# View all container statuses
docker compose ps

# Follow logs
docker compose logs -f backend
docker compose logs -f mongo
docker compose logs -f caddy

# Restart a single service
docker compose restart backend

# Open a shell inside a container
docker compose exec backend sh
docker compose exec mongo mongosh disherio

# Stop all services
docker compose down

# Start all services
docker compose up -d
```

## MongoDB reference

```bash
# Connect to the database
docker compose exec mongo mongosh disherio

# List all staff members
db.staffs.find().pretty()

# List all restaurants
db.restaurants.find().pretty()

# Manually reset a password (get hash with bcryptjs first)
db.staffs.updateOne(
  { username: "admin" },
  { $set: { password_hash: "<bcrypt_hash>" } }
)
```
