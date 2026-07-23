# DisherIo

[Spanish Version (README_es.md)](README_es.md) | [French Version (README_fr.md)](README_fr.md)

> **Live Demo:** [http://194.26.100.91](http://194.26.100.91)
>
> | Role | Username | Password | URL |
> |------|----------|----------|-----|
> | Admin | `admin` | `s1kiyZYBLQjNaGW2j37W` | [http://194.26.100.91/admin](http://194.26.100.91/admin) |
> | Kitchen (KDS) | `cocinero` | `cocinero` | [http://194.26.100.91/kds](http://194.26.100.91/kds) |
> | Tables (TAS) | `camarero` | `camarero` | [http://194.26.100.91/tas](http://194.26.100.91/tas) |
> | Cashier (POS) | `cajero` | `cajero` | [http://194.26.100.91/pos](http://194.26.100.91/pos) |

DisherIo is an integrated restaurant management platform providing solutions for self-service ordering, table assistance, kitchen display systems (KDS), and point-of-sale (POS) operations.

---

## Table of Contents

1. [Documentation Index](#documentation-index)
2. [Core Modules](#core-modules)
3. [Technology Stack](#technology-stack)
4. [Quick Start](#quick-start)
5. [Service Architecture](#service-architecture)
6. [Administration](#administration)
7. [License](#license)

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/INSTALL.md) | System requirements, guided installer, deployment procedures |
| [Configuration and Maintenance](docs/CONFIGURE.md) | Script usage, hot-reconfiguration, backups, and local resource checks |
| [Architecture and Technology Stack](docs/ARCHITECTURE.md) | Service topology, design patterns, security model |
| [Security Model and Audit Guide](docs/SECURITY.md) | Enforced controls, trust boundaries, accepted limitations, audit classification |
| [Development Guide](docs/DEVELOPMENT.md) | Local setup, verification commands, frontend build/test standards |
| [Troubleshooting](docs/ERRORS.md) | Error codes, diagnostic procedures, log inspection |
| [Error Codes Reference](docs/ERROR_CODES.md) | Complete ErrorCode enum with HTTP status mapping |
| [Uninstallation Guide](docs/UNINSTALL.md) | Full decommissioning procedures |
| [Deployment and Infrastructure Guide](docs/DEPLOYMENT.md) | Deployment modes, infrastructure topology, security, operation, and scaling |

---

## Core Modules

### Self-Service Totem
Customer-facing interface for order placement through a rate-limited QR flow. Enables autonomous ordering without staff intervention. Public Socket.IO connections validate the totem QR token at handshake (`{ publicTotem: true, qr: '<token>' }`) and do not require a staff JWT.

### Kitchen Display System (KDS)
Real-time order lifecycle management for kitchen operations. Socket.IO channel `kds:*` with `KTS` permission required. Normal flow is `ORDERED → ON_PREPARE → SERVED`; cancellation is a terminal transition from an active state.

### Point of Sale (POS)
Transaction, ticket splitting, payment history, order processing, and session archiving. Closing keeps a session available for payment; archiving settles every ticket, removes it from active POS/TAS views, and preserves it in payment history. Socket.IO channel `pos:*` with `POS` permission required.

### Table Assistance Service (TAS)
Digital waiter tools for table management, service requests, and customer communication. Socket.IO channel `tas:*` with `TAS` permission required.

### Administrative Dashboard
Centralized analytics, staff administration, menu configuration, and business intelligence reporting. Protected by `ADMIN` CASL permission (`can('manage', 'all')`).

---

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Angular 21.2, TailwindCSS 3.4, Socket.IO Client 4.8, CASL Ability 6.8 |
| Backend | Node.js 24, Express 5.2, Socket.IO 4.8, Mongoose 9.3 |
| Database | MongoDB 7 (replica set `rs0` for transactions) |
| Cache | Redis 7-alpine (cache + Socket.IO adapter + token blocklist) |
| Reverse Proxy | Caddy 2-alpine (automatic HTTPS via Let's Encrypt) |
| Observability | Pino logs, health checks, and an internal Prometheus-format endpoint |
| Image Processing | Sharp 0.35 (WebP conversion, resize, EXIF orientation) |
| Validation | Zod 4.3 (shared schemas between frontend and backend) |
| Authorization | CASL 6.8 (Attribute-Based Access Control) |
| Logging | Pino 10.3 with redaction of secrets |
| Language | TypeScript 5.9 (frontend, backend, and shared) |

DisherIo does not bundle Grafana, a Prometheus server, Alertmanager, or any
exporter containers. The backend still exposes `/metrics` in Prometheus
exposition format for optional operator-provided tooling, but Caddy does not
publish that endpoint and the default Compose topology does not scrape it.

---

## Quick Start

### Production Installation (recommended)

The universal installer (`scripts/install.sh`) handles Docker installation,
secret generation, image builds, ordered service startup, and database seeding.
It requests five deployment values and then offers one optional example-data
confirmation.

```bash
# Clone the repository
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Run the universal installer (requires root)
sudo ./scripts/install.sh
```

The installer will ask:
1. **Deployment type**: domain (HTTPS) / trusted local IP
2. **Domain**: only if domain mode was selected
3. **Language**: es / en / fr
4. **Restaurant name**: default `DisherIO Restaurant`
5. **Currency**: EUR / USD / GBP
6. **Example data**: optional categories, dishes, and an example table;
   fixed-credential demo staff are created only outside production

All sensitive values are generated with cryptographic randomness. Runtime
secrets are written as mode-`0600` files under `config/secrets/`; only the
initial administrator access details are written to `.credentials` (also
mode `0600`). Neither installation summaries nor `status` print the password.

### Development / Multi-environment Configuration

For development or advanced deployment modes (local, local-ip, public-ip with Cloudflare/ngrok, domain):

```bash
./infrastructure/scripts/configure.sh
```

### Combined quick start

```bash
./quickstart.sh   # configure + verify + start
```

### Prerequisites

- Linux (Ubuntu 22.04 LTS / Debian 12 / Google Cloud Compute Engine recommended)
- Root/sudo access
- Outbound internet access

Docker and Docker Compose v2 are **auto-installed** by `install.sh` if missing.

---

## Service Architecture

```
                    Internet
                       │
               ┌───────┴───────┐
               │  Caddy :80/:443 │  ← TLS termination and reverse proxy
               └───────┬───────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    Frontend       Backend      /uploads/*
    Angular 21    Express 5    (static files
    Caddy :4200   Node :3000    from volume)
         │            │
         │     ┌──────┴──────┐
         │     │             │
         │  MongoDB       Redis
         │  Mongo :27017  Redis :6379
         │  (rs0 replica)  (cache+adapter
         │                  +blocklist)
```

### Service startup order (enforced by `install.sh`)

1. MongoDB (creates app user + indexes via `init-mongo.js`)
2. Replica set initialization (`mongo-init-replica` one-shot)
3. App user verification (force-create if volume pre-exists)
4. Redis
5. Backend (waits for mongo + replica + redis healthy)
6. Frontend
7. Seed (creates restaurant, 4 roles, admin user, and optional examples)
8. Caddy (waits for backend + frontend healthy)

### Data flow

- **HTTP API**: client → Caddy `/api/*` → Backend (Express)
- **WebSocket**: client → Caddy `/socket.io/*` → Backend (Socket.IO + Redis adapter)
- **Static uploads**: client → Caddy `/uploads/*` → volume (served by Caddy, written by backend)
- **Diagnostics**: `/health/*`, structured logs, and the backend-only `/metrics` endpoint

---

## Administration

### Universal script (`scripts/install.sh`)

| Command | Description |
|---------|-------------|
| `sudo ./scripts/install.sh` | Full guided installation (five deployment values plus optional example data) |
| `sudo ./scripts/install.sh start` | Start all services |
| `sudo ./scripts/install.sh stop` | Stop all services |
| `sudo ./scripts/install.sh restart` | Restart all services |
| `sudo ./scripts/install.sh status` | Show service status and access URLs without printing secrets |
| `sudo ./scripts/install.sh logs [service]` | Live logs (backend/frontend/mongo/redis/caddy) |
| `sudo ./scripts/install.sh backup` | Protected backup of MongoDB, uploads, and deployment configuration |
| `sudo ./scripts/install.sh restore FILE` | Verify and restore a supported backup archive |
| `sudo ./scripts/install.sh update` | Pull + rebuild + restart |
| `sudo ./scripts/install.sh uninstall` | Full removal (containers, volumes, images, config) |
| `sudo ./scripts/install.sh help` | Show help |

### Other scripts

| Script | Location | Purpose |
|--------|----------|---------|
| `configure.sh` | `scripts/` | Hot-reconfiguration: network, port, admin password, language |
| `check-resources.sh` | `scripts/` | On-demand or terminal-based CPU/RAM checks; it is not a monitoring service |
| `info.sh` | `scripts/` | Alias for `install.sh status` |
| `backup.sh` | `scripts/` | Alias for `install.sh backup` |
| `restore.sh` | `scripts/` | Alias for `install.sh restore` |
| `restart.sh` | `scripts/` | Alias for `install.sh restart` |

### Credentials

After installation, administrator access details are saved to `.credentials`
(mode `0600`):
- Access URL, admin username, admin password
- Restaurant name, language, currency

MongoDB, Redis, JWT, administrator, and tunnel secrets live only in
`config/secrets/` for the generated deployment. `.env` contains non-secret
runtime settings and usernames. Containers receive `*_FILE` paths or a
secret-backed provider configuration, so secret values are not exposed by
`docker inspect` environment metadata.

---

## License

DisherIo is open-source software licensed under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). You may use, copy, modify, and distribute it under the terms of that license.

Modified versions and works based on DisherIo must remain under the same license, preserve the license and copyright notices, state significant changes, and make their complete corresponding source code available. This source-availability requirement also applies when a modified version is offered to users over a network.

Copyright (C) Ismail Haddouche Rhali.

---

For support or inquiries, please refer to the documentation or contact the development team.
