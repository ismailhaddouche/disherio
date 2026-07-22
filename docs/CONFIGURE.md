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
sudo ./scripts/install.sh status         # Service status + access URLs; never prints secrets
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
3. **Reset admin password** — sends the value over stdin, requires a unique username, revokes refresh tokens, increments `auth_version`, updates only protected credential/secret files, and restarts the backend to close active sockets
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
- `/health`, `/health/ready`, `/health/live`, and `/health/simple` through
  Caddy for private/loopback clients or a request carrying the configured
  internal token.
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

The generated `.env` file defines non-secret operational parameters. Sensitive
values are separate mode-`0600` files under `config/secrets/` and containers
receive only `*_FILE` paths or a provider configuration mounted as a Compose
secret. `.env.example` lists accepted inputs but deliberately leaves sensitive
examples empty.

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
| `MONGO_APP_USER` | App username (default `disherio_app`) |
| `MONGODB_MAX_POOL_SIZE` | Connection pool size (default 50) |
| `MONGODB_SERVER_SELECTION_TIMEOUT` | Server selection timeout ms (default 30000) |
| `MONGODB_SOCKET_TIMEOUT` | Socket timeout ms (default 45000) |

### Cache (Redis)

| Parameter | Description |
|-----------|-------------|
| `REDIS_URL` | Redis URL (default `redis://redis:6379`) |

Redis uses AOF with `appendfsync everysec`, so refresh-token and revocation
state survives normal restarts. Its password is supplied by the
`redis_password` secret file, not `.env`.

### Authentication

| Parameter | Description |
|-----------|-------------|
| `JWT_EXPIRES` | Access token lifetime (default `15m`) |
| `JWT_REFRESH_EXPIRES` | Refresh token lifetime (default `7d`) |
| `BCRYPT_ROUNDS` | Password hash cost, 10-15 (default `12`) |

### Application

| Parameter | Description |
|-----------|-------------|
| `RESTAURANT_NAME` | Restaurant name (user-specified) |
| `DEFAULT_LANGUAGE` | System language: `es`/`en`/`fr` |
| `DEFAULT_THEME` | UI theme: `light`/`dark` |
| `DEFAULT_TAX_RATE` | Tax rate (default 10) |
| `DEFAULT_CURRENCY` | Currency: `EUR`/`USD`/`GBP` |
| `ADMIN_USERNAME` | Admin username (default `admin`) |
| `SEED_EXAMPLES_CONFIRM` | Explicit production opt-in for non-credential example data; fixed demo staff remain disabled in production |

### Secret files

| File under `config/secrets/` | Consumer |
|-------------------------------|----------|
| `mongo_root_password` | MongoDB initialization, health, backup, restore |
| `mongo_app_password` | MongoDB application-user creation |
| `mongodb_uri` | Backend and seed services (`authSource=disherio&replicaSet=rs0`) |
| `redis_password` | Redis and backend |
| `jwt_secret` | Access-token signing/verification |
| `jwt_refresh_secret` | Refresh-token successor derivation |
| `admin_password` | Initial seed and protected credential recovery |
| `cloudflare_tunnel_token` | Cloudflare tunnel profile only |
| `ngrok_config` | ngrok profile only (version-3 configuration) |

Legacy or interactive input names such as `MONGO_ROOT_PASS`, `MONGODB_URI`,
`JWT_SECRET`, `ADMIN_PASSWORD`, `CF_TUNNEL_TOKEN`, and `NGROK_AUTHTOKEN` are
read only to generate/migrate these files and are scrubbed from the resulting
`.env`. Do not restore them there manually.

## Backups

### Automated backup

```bash
sudo ./scripts/install.sh backup
```

Procedure:
1. Runs `mongodump` inside the `mongo` container with root credentials
2. Copies the database dump, persistent uploads, `.env`, Caddy configuration, MongoDB keyfile, and active Compose override into a private staging directory
3. Writes an archive manifest and SHA-256 checksums
4. Encrypts with AES-256-CBC/PBKDF2 (600,000 iterations), adds an outer
   HMAC-SHA256 that is verified before decryption, and creates
   `/var/backups/disherio/disherio_backup_YYYYMMDD_HHMMSS.tar.gz.enc` with mode `0600`
5. Deletes backups older than 7 days (rotation)

### Restore

```bash
sudo ./scripts/install.sh restore /var/backups/disherio/disherio_backup_YYYYMMDD_HHMMSS.tar.gz.enc
```

Authenticated encrypted backups (`*.tar.gz.enc`) are verified and decrypted
(password from
`DISHERIO_BACKUP_PASSWORD` or an interactive prompt); legacy unencrypted
`.tar.gz` backups still restore as before. Restore validates archive paths,
rejects symbolic links, verifies the manifest and checksums, and requires
typing `RESTAURAR`. It then replaces MongoDB, uploads, and deployment
configuration, initializes the replica set, runs `mongorestore --drop`,
restores ownership, and waits for application health. Because this is
destructive, test each backup against an isolated installation before relying
on it for recovery.

There is intentionally no supported password-in-command-line `mongodump`
example. The installer reads the MongoDB secret inside the container, includes
uploads and recovery configuration, authenticates the final envelope, and
cleans its private staging directory. Use that path for operational backups.

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
