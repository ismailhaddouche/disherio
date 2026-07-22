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
| 4 | Configuration files | Writes non-secret runtime settings to `.env`, mode-`0600` secrets to `config/secrets/`, and generates the Caddy routes for uploads, API, Socket.IO, and the frontend |
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
- Admin username and the protected credentials-file location; the password is not printed
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

## Local Development Setup

Install Node.js 24/npm 11 dependencies for compilation and tests:

```bash
npm ci
npm run build --workspace=shared
```

For a complete local runtime, use the supported configurator. It creates the
MongoDB keyfile, authenticated service secrets, local Caddyfile, and Compose
override required by the hardened base topology:

```bash
./infrastructure/scripts/configure.sh
# Select: local
./infrastructure/scripts/verify.sh
docker compose up -d --build --wait
```

Do not copy `.env.example` unchanged and do not start the production MongoDB or
Redis images with unauthenticated host-wide port mappings. `.env.example` is a
catalog with intentionally empty secret fields; the configurator is the
supported way to turn it into a runnable environment. Developers who run the
backend directly on the host must provide their own loopback-only MongoDB
replica set and Redis instance and point a non-production environment at them.

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

This stops and removes all containers, volumes, images, and generated secrets
and configuration (`.env`, `.credentials`, `Caddyfile`,
`config/mongo-keyfile`, and `config/secrets/`). It requires typing `SI` to
confirm.

### Soft stop (keep everything)

```bash
sudo ./scripts/install.sh stop
# Or:
docker compose down
```

### Complete data purge (manual)

```bash
docker compose down --volumes --remove-orphans --rmi local
docker volume rm disherio_mongo_data disherio_redis_data disherio_uploads \
  disherio_caddy_data disherio_caddy_config
rm -f .env .credentials Caddyfile docker-compose.override.yml config/mongo-keyfile
rm -rf config/secrets
```

> **Warning**: Complete purge results in permanent loss of all database records and uploaded media. Run `sudo ./scripts/install.sh backup` before purging and verify the archive with a restore in an isolated installation.
