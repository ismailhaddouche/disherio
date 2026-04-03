# DisherIo

[Spanish Version (README_es.md)](README_es.md) | [French Version (README_fr.md)](README_fr.md)

DisherIo is an integrated restaurant management platform providing solutions for self-service ordering, table assistance, kitchen display systems (KDS), and point-of-sale (POS) operations.

---

## Table of Contents

1. [Documentation Index](#documentation-index)
2. [Core Modules](#core-modules)
3. [Technology Stack](#technology-stack)
4. [Quick Start](#quick-start)
5. [Deployment Modes](#deployment-modes)
6. [Maintenance](#maintenance)
7. [License](#license)

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/INSTALL.md) | System requirements and deployment procedures |
| [Configuration and Maintenance](docs/CONFIGURE.md) | Operational management and script usage |
| [Architecture and Technology Stack](docs/ARCHITECTURE.md) | Technical overview and design patterns |
| [Troubleshooting](docs/ERRORS.md) | Error resolution and diagnostic procedures |
| [Deployment Guide](infrastructure/docs/DEPLOYMENT_GUIDE.md) | Multi-environment deployment documentation |
| [Infrastructure Architecture](infrastructure/docs/ARCHITECTURE.md) | Infrastructure design and components |

---

## Core Modules

### Self-Service Totem
Customer-facing interface for order placement via QR code authentication. Enables autonomous ordering without staff intervention.

### Kitchen Display System (KDS)
Real-time order lifecycle management for kitchen operations. Optimizes preparation workflow and reduces ticket loss.

### Point of Sale (POS)
Comprehensive transaction and payment processing system with receipt generation and shift management.

### Table Assistance Service (TAS)
Digital waiter tools for table management, service requests, and customer communication.

### Administrative Dashboard
Centralized analytics, staff administration, menu configuration, and business intelligence reporting.

---

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Angular 21, TailwindCSS, Socket.IO Client |
| Backend | Node.js (Express 5), Socket.IO, Mongoose 9 |
| Database | MongoDB 7 |
| Cache | Redis 7 |
| Infrastructure | Docker, Docker Compose, Caddy (Reverse Proxy) |
| Language | TypeScript 5 |

For detailed technical specifications, refer to the [Architecture Documentation](docs/ARCHITECTURE.md).

---

## Quick Start

DisherIo supports four deployment modes with automated HTTPS configuration:

### Installation

```bash
# Clone the repository
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Interactive configuration wizard
./infrastructure/scripts/configure.sh

# Or use the quickstart (configure + verify + start)
./quickstart.sh
```

### Prerequisites

- Docker 20.10 or higher
- Docker Compose 2.0 or higher
- Git 2.0 or higher

---

## Deployment Modes

| Mode | HTTPS | Use Case | Documentation |
|------|-------|----------|---------------|
| `local` | No | Development on localhost | [Local Deployment](infrastructure/docs/DEPLOYMENT_GUIDE.md#modo-local) |
| `local-ip` | No | Local network (192.168.x.x) | [Local Network](infrastructure/docs/DEPLOYMENT_GUIDE.md#modo-red-local) |
| `public-ip` | Yes (via tunnel) | Public IP without domain | [Public IP](infrastructure/docs/DEPLOYMENT_GUIDE.md#modo-ip-publica) |
| `domain` | Yes (Let's Encrypt) | Custom domain | [Domain](infrastructure/docs/DEPLOYMENT_GUIDE.md#modo-dominio-propio) |

### Mode Selection Guide

**Development (local)**: Use for local development on your machine. No HTTPS, accessible only from localhost.

**Local Network (local-ip)**: Use for restaurant or office deployments where all devices are on the same WiFi/Ethernet network. No domain or DNS configuration required.

**Public IP (public-ip)**: Use when you need to expose the application to the Internet without owning a domain. Uses Cloudflare Tunnel (recommended) or ngrok to provide HTTPS.

**Production (domain)**: Use for professional deployments with your own domain. Automatic HTTPS via Let's Encrypt with certificate renewal.

For detailed deployment instructions, see the [Deployment Guide](infrastructure/docs/DEPLOYMENT_GUIDE.md).

---

## Maintenance

### Directory Structure

```
disherio/
├── backend/              # Backend API source code
├── frontend/             # Frontend application source code
├── shared/               # Shared types and schemas
├── scripts/              # System administration scripts
├── infrastructure/       # Deployment configuration
│   ├── scripts/          # Configuration and verification tools
│   ├── caddy-templates/  # Reverse proxy configurations
│   └── docs/             # Infrastructure documentation
└── docker-compose.yml    # Base orchestration file
```

### Administration Scripts

| Script | Location | Purpose |
|--------|----------|---------|
| `install.sh` | `scripts/` | Orchestrates full system deployment |
| `configure.sh` | `infrastructure/scripts/` | Interactive deployment configuration |
| `verify.sh` | `infrastructure/scripts/` | Pre-deployment verification |
| `backup.sh` | `scripts/` | Database persistence routines |
| `quickstart.sh` | `./` | Combined configuration and start |

### Common Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Update to latest version
git pull
docker compose up -d --build
```

Refer to the [Configuration Guide](docs/CONFIGURE.md) for detailed operational procedures.

---

## License

Proprietary. All rights reserved.

Copyright (c) 2024 DisherIo. Unauthorized copying, distribution, or use is strictly prohibited.

---

For support or inquiries, please refer to the documentation or contact the development team.
