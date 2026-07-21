# Installation Guide

This document outlines the procedures for deploying and removing the DisherIo platform.

---

## System Prerequisites

- **Operating System**: Linux (Ubuntu 22.04 LTS, Debian 12, Google Cloud Compute Engine, or any modern Debian/Ubuntu-based VPS).
- **Privileges**: Root/sudo access.
- **Connectivity**: Unrestricted outbound internet access (for Docker image pulls and Let's Encrypt).

### Hardware Recommendations

| Environment | CPU | RAM | Disk |
|-------------|-----|-----|------|
| Development (local) | 2 cores | 4 GB | 20 GB |
| Production (domain) | 4 cores | 8 GB | 50 GB |
| High-load production | 8 cores | 16 GB | 100 GB |

### Auto-installed dependencies

The installer (`install.sh`) automatically installs these if missing:
- `curl`, `wget`, `ca-certificates`, `gnupg`, `openssl` (system utilities)
- `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-compose-plugin` (Docker + Compose v2)

---

## Automated Deployment

The universal installer (`scripts/install.sh`) performs a complete, ordered
deployment in phases `0` through `7`. It requests five deployment values plus
one optional example-data confirmation; all secrets are auto-generated.

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
sudo ./scripts/install.sh
```

### Installation sequence (7 steps)

| Step | Action | What happens |
|------|--------|--------------|
| 0 | Pre-flight | Installs `curl`, `openssl`, etc. if missing; creates log directory; detects distro via `/etc/os-release`; detects local + public IP |
| 1 | Configuration | Deployment type, domain/IP, language, restaurant name, currency, and optional example data |
| 2 | Docker setup | Verifies/installs Docker Engine + Compose v2 (distro-specific repo) |
| 3 | Secret generation | JWT (64 chars), MongoDB root + app passwords, Redis password, admin password (20 chars), and the MongoDB keyfile; an existing installation keeps its infrastructure credentials when its data volumes are retained |
| 4 | Configuration files | Writes `.env` (chmod 600) with quoted values and generates the Caddy routes for uploads, API, Socket.IO, and the frontend |
| 5 | Port verification | Checks that ports 80/443 are available before building |
| 6 | Image build | `docker compose pull` + `docker compose build` (backend + frontend) |
| 7 | Service startup (ordered) | MongoDB → replica set init → app user verification → Redis → backend → frontend → seed and optional example seed → Caddy |

The installed topology does not include Grafana, a Prometheus server,
Alertmanager, or exporter containers. The backend's internal `/metrics`
endpoint remains available for optional operator-provided tooling, but it is
not published by Caddy or scraped by the default installation.

### What the seed creates

The `seed` service (`dist/seeders/index.js`) creates:
- **1 restaurant** with the user-specified name, currency, tax rate, language, and theme
- **4 roles**: Admin (`ADMIN`), KTS (`KTS`), POS (`POS`), TAS (`TAS`)
- **1 admin user**: username `admin`, with auto-generated password (bcrypt-hashed with cost 12)

The seed is **idempotent**: re-running it updates the existing restaurant and admin credentials rather than duplicating.

### Post-installation

At the end of the installation, the script displays:
- Access URL (`https://domain` or a trusted-LAN `http://IP`)
- Admin credentials (username, password)
- Quick-access links (`/admin`, `/pos`, `/kds`, `/tas`)
- Credentials file location (`.credentials`, chmod 600)
- Log file location (`/var/log/disherio.log`)

### Reinstallation / cleanup

If a previous installation exists, the installer asks whether to:
1. Remove previous containers (with confirmation)
2. Remove previous data volumes (separate confirmation, optional)

When the data volumes are retained, the installer reuses the existing MongoDB,
Redis, and JWT credentials instead of generating credentials that no longer
match the persisted services. Direct HTTP deployment on a public IP is rejected;
Internet access requires domain TLS or the HTTPS tunnel mode configured by the
infrastructure configurator.

---

## Manual Development Setup

For local development without Docker:

1. **Install dependencies** (requires Node.js 24 and npm 11):
   ```bash
   npm install
   npm run build --workspace=shared
   ```

2. **Start MongoDB** (replica set required for transactions):
   ```bash
   docker run -d -p 27017:27017 --name disherio-mongo mongo:7 --replSet rs0
   # Initiate replica set:
   docker exec disherio-mongo mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"
   ```

3. **Start Redis**:
   ```bash
   docker run -d -p 6379:6379 --name disherio-redis redis:7-alpine
   ```

4. **Environment configuration**: Create `.env` in `backend/` from `.env.example` and define:
   - `MONGODB_URI` — MongoDB connection string with `replicaSet=rs0`
   - `JWT_SECRET` — at least 32 characters, not the default value
   - `JWT_REFRESH_SECRET` — at least 32 characters
   - `REDIS_URL` — `redis://localhost:6379`
   - `FRONTEND_URL` — `http://localhost:4200`
   - `ADMIN_PASSWORD` — required for seed

5. **Run services**:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm start

   # Terminal 3: Seed (first time only)
   cd backend && npm run seed
   ```

### Local verification checklist

Before pushing frontend or shared-contract changes, run:

```bash
npm run build
npm run test --workspace=backend
npm run test --workspace=frontend
```

The frontend package script locates Chrome or Chromium and propagates assertion,
launcher, and browser-disconnection failures as a non-zero exit status.

See [Development Guide](DEVELOPMENT.md) for frontend-specific build warnings, Karma notes, and login validation expectations.

---

## System Removal

### Standard removal (keep data)

```bash
sudo ./scripts/install.sh uninstall
```

This stops and removes all containers, volumes, images, and config files (`.env`, `.credentials`, `Caddyfile`). Requires typing `SI` to confirm.

### Soft stop (keep everything)

```bash
sudo ./scripts/install.sh stop
# Or:
docker compose down
```

### Complete data purge (manual)

```bash
docker compose down --volumes --remove-orphans
docker volume rm disherio_mongo_data disherio_redis_data disherio_uploads \
  disherio_caddy_data disherio_caddy_config
docker rmi disherio_backend disherio_frontend disherio_seed 2>/dev/null || true
rm -f .env .credentials Caddyfile
```

> **Warning**: Complete purge results in permanent loss of all database records and uploaded media. Run `sudo ./scripts/install.sh backup` before purging and verify the archive with a restore in an isolated installation.
