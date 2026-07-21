# Configuration and Maintenance

This document provides guidelines for the operational configuration and maintenance of the DisherIo platform using integrated management scripts.

---

## Universal Script (`scripts/install.sh`)

The universal script is the primary entry point for all operations. It requires root privileges.

### Commands

```bash
sudo ./scripts/install.sh                # Guided installation plus optional example-data confirmation
sudo ./scripts/install.sh install        # Same as above
sudo ./scripts/install.sh start          # Start all services
sudo ./scripts/install.sh stop           # Stop all services
sudo ./scripts/install.sh restart        # Restart all services
sudo ./scripts/install.sh status         # Service status + access URLs + credentials
sudo ./scripts/install.sh logs [service] # Live logs (backend/frontend/mongo/redis/caddy)
sudo ./scripts/install.sh backup         # MongoDB, uploads, and deployment configuration
sudo ./scripts/install.sh restore FILE   # Verified destructive restore
sudo ./scripts/install.sh update         # Pull images + rebuild + restart
sudo ./scripts/install.sh uninstall      # Full removal (interactive confirmation)
sudo ./scripts/install.sh help           # Show help
```

### Hot-reconfiguration (`scripts/configure.sh`)

For post-installation adjustments without reinstalling:

```bash
sudo ./scripts/configure.sh
```

Menu options:
1. **Change network mode / domain / IP** — rewrites Caddyfile and `FRONTEND_URL` in `.env`, restarts services
2. **Change access port** — updates Caddyfile and `FRONTEND_URL` (validates 1-65535 range)
3. **Reset admin password** — connects to running backend, updates bcrypt hash in MongoDB (credentials passed via env vars, no JS injection)
4. **Change default language** — updates `DEFAULT_LANGUAGE` and `APP_LANG` in `.env`
5. **View current configuration** — shows `.env` values (secrets redacted)
6. **Exit**

---

## Other Scripts

### `scripts/check-resources.sh`

Local container resource checker with terminal warnings (default threshold
80%). It reads `docker stats`; it does not run as a daemon, retain time-series
data, send notifications, or replace an external monitoring platform.

```bash
./scripts/check-resources.sh                  # Check all containers once
./scripts/check-resources.sh -w               # Refresh terminal output every 30 seconds
./scripts/check-resources.sh -w 60            # Refresh terminal output every 60 seconds
./scripts/check-resources.sh -c disherio_mongo # Check single container
./scripts/check-resources.sh -t 90            # Set alert threshold to 90%
```

Portable: uses `bc` if available, falls back to `awk` for arithmetic. No external dependencies required on minimal Debian/Ubuntu/GCE.

### Operational signals and monitoring boundary

The bundled deployment uses three direct diagnostic sources:

- Pino JSON logs through `docker compose logs` or `install.sh logs`.
- `/health`, `/health/ready`, `/health/live`, and `/health/simple` through Caddy.
- The backend-only `/metrics` endpoint in Prometheus exposition format.

Grafana, Prometheus server, Alertmanager, and exporter containers are not part
of the repository or the default Compose topology. If an operator adds such a
platform, it must be deployed, authenticated, network-restricted, backed up,
and maintained independently. Do not expose `/metrics` directly to the public
Internet.

### Wrapper scripts

| Script | Delegates to |
|--------|--------------|
| `scripts/backup.sh` | `install.sh backup` |
| `scripts/restore.sh` | `install.sh restore` |
| `scripts/info.sh` | `install.sh status` |
| `scripts/restart.sh` | `install.sh restart` |

### `infrastructure/scripts/configure.sh`

Multi-environment deployment configurator (alternative to `install.sh` for development modes):

```bash
./infrastructure/scripts/configure.sh
```

Supports 4 modes: `local`, `local-ip`, `public-ip` (Cloudflare/ngrok), `domain`. Auto-generates all secrets (MongoDB, Redis, JWT) with cryptographic randomness. Persists existing secrets on reconfiguration (does not invalidate sessions).

`local-ip` limits photographed-QR reuse from outside the restaurant only when
the host firewall permits the application port exclusively from the trusted
LAN and there is no tunnel, port forwarding, or public reverse proxy. The
`public-ip` and `domain` modes cannot establish customer presence from a static
QR: anyone who possesses a copy of that QR can reach the public bootstrap
endpoint. Use a separate table/session code, POS/TAS approval, or trusted local
network assertion if an Internet-facing installation requires proximity
enforcement. These presence gates are not currently built into DisherIo.

### `infrastructure/scripts/verify.sh`

Pre-deployment verification:

```bash
./infrastructure/scripts/verify.sh
```

Checks: Docker installation, daemon status, config files, environment variables, port availability, system resources.

### `quickstart.sh`

Combined: configure + verify + start.

```bash
./quickstart.sh
```

---

## Environment Variables

The `.env` file (chmod 600) defines all operational parameters. Generated automatically by `install.sh`.

### Core

| Parameter | Default | Description |
|-----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `3000` | Backend listen port |
| `HTTP_PORT` | `80` | Caddy HTTP port (host) |
| `HTTPS_PORT` | `443` | Caddy HTTPS port (host) |
| `FRONTEND_URL` | (auto) | Full URL for CORS/Socket.IO origins |
| `TRUST_PROXY` | `true` | Trust Caddy's `X-Forwarded-*` headers |
| `LOG_LEVEL` | `info` | Pino log level |

### Database (MongoDB)

| Parameter | Description |
|-----------|-------------|
| `MONGO_ROOT_USER` | Root username (default `admin`) |
| `MONGO_ROOT_PASS` | Root password (auto-generated, 32 chars) |
| `MONGO_APP_USER` | App username (default `disherio_app`) |
| `MONGO_APP_PASS` | App password (auto-generated, 32 chars) |
| `MONGODB_URI` | Connection string with `authSource=disherio&replicaSet=rs0` |
| `MONGODB_MAX_POOL_SIZE` | Connection pool size (default 50) |
| `MONGODB_SERVER_SELECTION_TIMEOUT` | Server selection timeout ms (default 30000) |
| `MONGODB_SOCKET_TIMEOUT` | Socket timeout ms (default 45000) |

### Cache (Redis)

| Parameter | Description |
|-----------|-------------|
| `REDIS_URL` | Redis URL (default `redis://redis:6379`) |
| `REDIS_PASSWORD` | Redis password (auto-generated, 24 chars); Redis uses AOF with `appendfsync everysec` so token revocations and refresh-token state survive restarts |

### Authentication

| Parameter | Description |
|-----------|-------------|
| `JWT_SECRET` | Access token secret (auto-generated, 64 chars; min 32, not default) |
| `JWT_EXPIRES` | Access token lifetime (default `15m`) |
| `JWT_REFRESH_SECRET` | Refresh token secret (auto-generated, 64 chars) |
| `JWT_REFRESH_EXPIRES` | Refresh token lifetime (default `7d`) |

### Application

| Parameter | Description |
|-----------|-------------|
| `RESTAURANT_NAME` | Restaurant name (user-specified) |
| `DEFAULT_LANGUAGE` | System language: `es`/`en`/`fr` |
| `DEFAULT_THEME` | UI theme: `light`/`dark` |
| `DEFAULT_TAX_RATE` | Tax rate (default 10) |
| `DEFAULT_CURRENCY` | Currency: `EUR`/`USD`/`GBP` |
| `ADMIN_USERNAME` | Admin username (default `admin`) |
| `ADMIN_PASSWORD` | Admin password (auto-generated, 20 chars) |

## Backups

### Automated backup

```bash
sudo ./scripts/install.sh backup
```

Procedure:
1. Runs `mongodump` inside the `mongo` container with root credentials
2. Copies the database dump, persistent uploads, `.env`, Caddy configuration, MongoDB keyfile, and active Compose override into a private staging directory
3. Writes an archive manifest and SHA-256 checksums
4. Encrypts the archive with `openssl enc -aes-256-cbc -pbkdf2` (password from
   `DISHERIO_BACKUP_PASSWORD` or an interactive prompt) and creates
   `/var/backups/disherio/disherio_backup_YYYYMMDD_HHMMSS.tar.gz.enc` with mode `0600`
5. Deletes backups older than 7 days (rotation)

### Restore

```bash
sudo ./scripts/install.sh restore /var/backups/disherio/disherio_backup_YYYYMMDD_HHMMSS.tar.gz.enc
```

Encrypted backups (`*.tar.gz.enc`) are decrypted first (password from
`DISHERIO_BACKUP_PASSWORD` or an interactive prompt); legacy unencrypted
`.tar.gz` backups still restore as before. Restore validates archive paths,
rejects symbolic links, verifies the manifest and checksums, and requires
typing `RESTAURAR`. It then replaces MongoDB, uploads, and deployment
configuration, initializes the replica set, runs `mongorestore --drop`,
restores ownership, and waits for application health. Because this is
destructive, test each backup against an isolated installation before relying
on it for recovery.

### Manual backup

```bash
docker compose exec -T mongo mongodump \
  --db disherio \
  --username admin \
  --password "$(grep MONGO_ROOT_PASS .env | cut -d= -f2 | tr -d '"')" \
  --authenticationDatabase admin \
  --out /tmp/dump
```

---

## Software Updates

```bash
sudo ./scripts/install.sh update
```

Or manually:
1. `git pull origin main`
2. `docker compose pull` (update base images)
3. `docker compose build` (rebuild app images)
4. `docker compose up -d --wait` (restart with health checks)

> **Recommended**: Run `sudo ./scripts/install.sh backup` before updating.
