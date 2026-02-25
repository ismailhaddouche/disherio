# Disher.io v1.0 — Open-Source Restaurant Management Platform

Disher.io is a production-ready, self-hosted restaurant management platform built for small and medium restaurants. It provides real-time order synchronization between customers, kitchen staff, and cashiers — all from a single deployment.

[![CI/CD](https://github.com/ismailhaddouche/disherio/actions/workflows/docker-build.yml/badge.svg)](https://github.com/ismailhaddouche/disherio/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-21-red)](https://angular.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-brightgreen)](https://mongodb.com)

---

## What is Disher.io?

Disher.io replaces paper tickets, walkie-talkies, and disconnected POS systems with a unified platform that runs on your own hardware. Customers scan a QR code at their table, place their order, and the kitchen sees it instantly. The cashier closes the bill with one click — split payments included.

It runs on anything from a Raspberry Pi to a cloud server, with no subscription fees and no vendor lock-in.

---

## System Architecture

```
                        ┌─────────────────────────────────────────────────┐
                        │                  Caddy (Reverse Proxy)          │
                        │           TLS/SSL · Compression · Routing       │
                        └──────────────┬──────────────────┬───────────────┘
                                       │                  │
                          /api/*  ─────┘                  └─── /* (frontend)
                                       │
              ┌────────────────────────▼────────────────────────┐
              │              Backend (Node.js 20 + Express)      │
              │                                                   │
              │   REST API · JWT Auth · RBAC · Socket.io         │
              │   Rate Limiting · Helmet · Activity Logs         │
              └────────────┬────────────────────┬───────────────┘
                           │                    │
               ┌───────────▼──────┐   ┌─────────▼───────────┐
               │  MongoDB 7       │   │  Socket.io (WS)      │
               │  Orders · Menu   │   │  Real-time events    │
               │  Users · Tickets │   │  to all clients      │
               └──────────────────┘   └─────────────────────┘

              ┌──────────────────────────────────────────────────┐
              │              Frontend (Angular 21)               │
              │                                                   │
              │  ┌────────────┐  ┌──────────┐  ┌─────────────┐  │
              │  │  Admin     │  │  KDS     │  │  Customer   │  │
              │  │  Dashboard │  │  Kitchen │  │  Menu + QR  │  │
              │  └────────────┘  └──────────┘  └─────────────┘  │
              │  ┌────────────┐  ┌──────────┐  ┌─────────────┐  │
              │  │  POS /     │  │  Menu    │  │  Checkout   │  │
              │  │  Cashier   │  │  Editor  │  │  Self-Pay   │  │
              │  └────────────┘  └──────────┘  └─────────────┘  │
              └──────────────────────────────────────────────────┘
```

---

## Features

### For Customers
- Scan a QR code at the table — no app download required
- Browse the full menu with categories, variants, and allergens
- Place orders directly from their phone
- Self-checkout with optional tip

### For Kitchen Staff (KDS)
- Real-time order display on any tablet or screen
- Mark individual items as preparing or ready
- Visual alerts for new and pending orders

### For Cashiers (POS)
- Table overview with order status at a glance
- One-click checkout with VAT calculation
- Equal payment splitting across N people
- Cash and card payment methods

### For Administrators
- Full menu management (categories, variants, addons, allergens)
- Staff account management with role-based access
- Restaurant branding (logo, colors, name)
- QR totem generation and table management
- Activity audit logs
- Billing configuration (VAT, tip percentage)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Node.js + Express | 20 / 5.x |
| Frontend | Angular + Signals API | 21 |
| Database | MongoDB | 7 |
| Reverse Proxy | Caddy | 2 |
| Real-time | Socket.io | 4.x |
| Auth | JWT (jsonwebtoken) | 9.x |
| Containerization | Docker + Compose | — |
| CI/CD | GitHub Actions | — |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2+
- A domain name (for production) or a local IP (for local mode)
- Ports **80** and **443** open (production) or **4200** / **3000** (development)

---

## Quick Start

### Option 1 — Automated Installer (Recommended)

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
chmod +x install.sh
sudo ./install.sh
```

The installer will prompt you to choose a deployment mode:

| Mode | Use Case |
|------|----------|
| **Local** | Single restaurant, LAN only, no internet required |
| **Production** | Public domain with automatic HTTPS via Let's Encrypt |
| **Raspberry Pi** | Low-resource deployment, optimized for ARM |

### Option 2 — Manual Docker Compose

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Copy and configure environment
cp .env.example .env
nano .env   # Set DOMAIN, JWT_SECRET, and other required values

# Start all services
docker compose up -d --build
```

### Option 3 — Development Mode (No Docker)

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev
# API available at http://localhost:3000/api

# Terminal 2 — Frontend
cd frontend
npm install
npm start
# UI available at http://localhost:4200
```

> **Default credentials:** `admin` / `password`
> Change the password immediately after first login at `/admin/config`.

---

## Accessing the Platform

Once running, open your browser and navigate to your configured domain or IP.

| Module | URL | Role |
|--------|-----|------|
| Admin Dashboard | `/admin/dashboard` | Admin |
| Kitchen Display (KDS) | `/admin/kds` | Kitchen, Admin |
| Point of Sale (POS) | `/admin/pos` | POS, Admin |
| Menu Editor | `/admin/menu` | Admin |
| Staff Management | `/admin/users` | Admin |
| Store Configuration | `/admin/config` | Admin |
| Customer Menu | `/:tableNumber` | Public |
| Customer Checkout | `/:tableNumber/checkout` | Public |

---

## Deployment Modes

### Local (LAN)
Designed for restaurants with a local network and no public internet access. Uses HTTP on the local IP. Ideal for a single tablet setup or Raspberry Pi behind the bar.

### Production
Connects to a public domain with automatic TLS via Caddy and Let's Encrypt. Suitable for restaurants that want remote access or cloud hosting.

### Raspberry Pi
Identical to Local mode but with memory and CPU resource limits configured for 1–4GB RAM systems. Tested on Raspberry Pi 4.

---

## Project Structure

```
disherio/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── middleware/      # Auth (JWT), error handling
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route handlers
│   │   └── app.js           # Express app configuration
│   └── Dockerfile
├── frontend/                # Angular 21 application
│   ├── src/app/
│   │   ├── components/      # Dashboard, KDS, POS, Menu, etc.
│   │   └── services/        # Auth, Communication, Theme
│   └── Dockerfile
├── docs/                    # Full documentation
│   ├── ARCHITECTURE.md      # System design and data models
│   ├── API.md               # Complete API reference
│   ├── QUICK_START.md       # Setup and first steps
│   └── MAINTENANCE.md       # Backup, restore, operations
├── .github/
│   └── workflows/           # CI/CD pipelines
├── docker-compose.yml       # Development
├── docker-compose.prod.yml  # Production overlay
├── docker-compose.rpi.yml   # Raspberry Pi overlay
├── Caddyfile                # Reverse proxy configuration
├── .env.example             # All environment variables documented
└── install.sh               # Automated installer
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](./docs/QUICK_START.md) | Installation, first setup, common commands |
| [Architecture](./docs/ARCHITECTURE.md) | System design, data models, flow diagrams |
| [API Reference](./docs/API.md) | All endpoints, request/response examples |
| [Maintenance](./docs/MAINTENANCE.md) | Backup, restore, updates, performance |
| [Contributing](./CONTRIBUTING.md) | How to contribute code or report issues |
| [Security](./SECURITY.md) | Vulnerability disclosure and security notes |
| [Changelog](./CHANGELOG.md) | Version history |

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

For bug reports and feature requests, use the [GitHub Issue tracker](https://github.com/ismailhaddouche/disherio/issues).

---

## Security

If you discover a vulnerability, please follow the responsible disclosure process in [SECURITY.md](./SECURITY.md). Do not open a public issue for security problems.

---

## License

Disher.io is released under the [MIT License](./LICENSE). You are free to use, modify, and distribute it for any purpose, including commercial use.
