# DisherIo

[![DisherIo](https://img.shields.io/badge/DisherIo-Restaurant_Platform-1E88E5)](https://hismar.dev)
[![License](https://img.shields.io/badge/License-AGPL--3.0--only-yellow)](LICENSE)
[![Developer](https://img.shields.io/badge/Developer-hismar.dev-orange)](https://hismar.dev)

![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-21.2-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED?logo=docker&logoColor=white)
![Caddy](https://img.shields.io/badge/Caddy-2-00C7B7?logo=caddy&logoColor=white)

[Spanish Version (README_es.md)](README_es.md) | [French Version (README_fr.md)](README_fr.md)

> **Live Demo:** [http://194.26.100.91](http://194.26.100.91)
>
> | Role | Username | Password | URL |
> |------|----------|----------|-----|
> | Admin | `admin` | `e54HBfxhf4CXrozOl2u6` | [http://194.26.100.91/admin](http://194.26.100.91/admin) |
> | Kitchen (KDS) | `cocinero` | `cocinero` | [http://194.26.100.91/kds](http://194.26.100.91/kds) |
> | Tables (TAS) | `camarero` | `camarero` | [http://194.26.100.91/tas](http://194.26.100.91/tas) |
> | Cashier (POS) | `cajero` | `cajero` | [http://194.26.100.91/pos](http://194.26.100.91/pos) |
>
> **Self-service totem (Table 1 demo):** Scan the QR to place an order from the table — no login required.
>
> <img src="docs/images/qr-mesa1-demo.png" alt="QR code for Table 1 demo totem" width="150" height="150" />

## Gallery

Step-by-step walkthroughs live in the [User Guide](docs/USER_GUIDE.md).

### Administration

| Control Panel | Menu | Totems |
|:---:|:---:|:---:|
| [![Dashboard](docs/images/gallery/admin-dashboard-desktop.jpg)](docs/images/gallery/admin-dashboard-desktop.jpg) | [![Menu](docs/images/gallery/admin-menu-desktop.jpg)](docs/images/gallery/admin-menu-desktop.jpg) | [![Totems](docs/images/gallery/admin-totems-desktop.jpg)](docs/images/gallery/admin-totems-desktop.jpg) |

### Kitchen (KDS) and Cashier (POS)

| Order board | Stock control | Sessions | Payment |
|:---:|:---:|:---:|:---:|
| [![KDS board](docs/images/gallery/kds-board-desktop.jpg)](docs/images/gallery/kds-board-desktop.jpg) | [![KDS stock](docs/images/gallery/kds-stock-desktop.jpg)](docs/images/gallery/kds-stock-desktop.jpg) | [![POS sessions](docs/images/gallery/pos-tables-desktop.jpg)](docs/images/gallery/pos-tables-desktop.jpg) | [![POS payment](docs/images/gallery/pos-payment-desktop.jpg)](docs/images/gallery/pos-payment-desktop.jpg) |

### Table Assistance (TAS)

| Tables | Session detail | Pending cart |
|:---:|:---:|:---:|
| [![TAS tables](docs/images/gallery/tas-tables-desktop.jpg)](docs/images/gallery/tas-tables-desktop.jpg) | [![TAS session](docs/images/gallery/tas-session-desktop.jpg)](docs/images/gallery/tas-session-desktop.jpg) | [![TAS cart](docs/images/gallery/tas-cart-desktop.jpg)](docs/images/gallery/tas-cart-desktop.jpg) |

### Customer Totem (mobile)

| Welcome | Menu | My order |
|:---:|:---:|:---:|
| <img src="docs/images/gallery/totem-welcome-mobile.jpg" alt="Totem welcome" width="195" /> | <img src="docs/images/gallery/totem-menu-mobile.jpg" alt="Totem menu" width="195" /> | <img src="docs/images/gallery/totem-cart-mobile.jpg" alt="Totem cart" width="195" /> |

---

DisherIo is an integrated restaurant management platform providing solutions for self-service ordering, table assistance, kitchen display systems (KDS), and point-of-sale (POS) operations.

---

## Table of Contents

1. [Documentation Index](#documentation-index)
2. [Gallery](#gallery)
3. [Core Modules](#core-modules)
4. [Technology Stack](#technology-stack)
5. [Quick Start](#quick-start)
6. [Service Architecture](#service-architecture)
7. [Administration](#administration)
8. [License](#license)

---

## Documentation Index

Full index with Architecture Decision Records: [docs/README.md](docs/README.md)

### For Users

| Document | Description |
|----------|-------------|
| [User Guide](docs/USER_GUIDE.md) | Annotated walkthrough of every module with screenshots |

### For Operators

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/INSTALL.md) | System requirements, guided installer, deployment procedures |
| [Configuration and Maintenance](docs/CONFIGURE.md) | Script usage, hot-reconfiguration, backups, and local resource checks |
| [Deployment and Infrastructure Guide](docs/DEPLOYMENT.md) | Deployment modes, infrastructure topology, security, operation, and scaling |
| [HTTPS and TLS Setup](docs/HTTPS.md) | TLS modes, certificates, security headers, verification, and troubleshooting |
| [Troubleshooting](docs/ERRORS.md) | Error codes, diagnostic procedures, log inspection |
| [Uninstallation Guide](docs/UNINSTALL.md) | Full decommissioning procedures |

### For Developers

| Document | Description |
|----------|-------------|
| [Development Guide](docs/DEVELOPMENT.md) | Local setup, verification commands, frontend build/test standards |
| [Architecture and Technology Stack](docs/ARCHITECTURE.md) | Service topology, design patterns, security model |
| [API Reference](docs/API_CONTRACTS.md) | HTTP routes and Socket.IO event contracts |
| [Error Codes Reference](docs/ERROR_CODES.md) | Complete ErrorCode enum with HTTP status mapping |
| [Database Migrations](docs/MIGRATIONS.md) | Versioned migration runner and authoring rules |
| [Security Model and Audit Guide](docs/SECURITY.md) | Enforced controls, trust boundaries, accepted limitations, audit classification |

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
1. **Deployment type**: domain (HTTPS) / trusted local IP (HTTP) / public IP (HTTP, unencrypted)
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
