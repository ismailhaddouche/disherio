# Disher.io — Everything your restaurant needs, in one platform

> **Versión en español:** [README.md](./README.md) | **Documentación en español:** [docs/](./docs/) (archivos sin sufijo `_EN.md`)

Disher.io is a complete, free system that digitizes your entire restaurant operation: from when a customer scans a QR code at their table until they pay the bill, passing through the kitchen and the cash register. All connected in real time, no monthly fees, and running on your own server.

---

## 1. What problem does it solve?

If you manage a restaurant, bar, or café, you probably recognize some of these situations:

- Waiters constantly go back and forth between tables and the kitchen with paper orders.
- The kitchen doesn't know which tables have priority or which dishes are pending.
- Billing is done by eye, with no clear record of who ordered what.
- You pay a monthly subscription for a POS that doesn't adapt to your way of working.

**Disher.io eliminates all of that.** It's a platform that connects your customers, waiters, kitchen, and cash register in a single screen, in real time.

### How does it work in practice?

1. **The customer** scans a QR code at their table, sees the menu on their phone, and places their order directly.
2. **The kitchen** receives the order instantly on their screen (KDS), without waiting for the waiter, and marks each dish when it's ready.
3. **The waiter** sees on their phone which tables need attention, which dishes are ready to serve, and can take additional orders.
4. **The cash register** has the complete breakdown of each table: who ordered what, tips, and can charge per person, split equally, or the entire bill.

All this happens **simultaneously and in real time**. If a customer adds a dish, the kitchen sees it immediately.

### What's included?

| Module | What does it do? |
|--------|------------------|
| **Digital Menu with QR** | Each table is a shared session: customers scan the QR, see the menu on their phone, and order individually or as a group. Each dish is associated with the person who ordered it. No apps, no downloads. |
| **Kitchen Display System (KDS)** | The kitchen manages orders on a touchscreen: pending → preparing → ready. |
| **Waiter View** | Floor staff see tables in real time, take orders, and know which dishes to serve. |
| **Point of Sale (POS)** | Payments with per-person breakdown, receipts with tax, history, and cash register closing. |
| **Admin Panel** | Manage menu, prices, allergens, users, printers, and venue configuration. |
| **Table and Totem Management** | Create physical and temporary tables (terrace, extra bar) with unique QR codes. |

### Why Disher.io and not another system?

- **Free and Open Source** — No monthly fees, no commissions, no fine print. The code is yours.
- **With or without internet** — You can install it on a cloud server (accessible from anywhere) or on a device within your local venue (works only with WiFi, no internet connection needed).
- **You control your data** — Everything is stored on your own server. No one else has access to your business information.
- **Adapts to any hardware** — Works from a €40 Raspberry Pi at the bar to a cloud server.
- **Bilingual** — Complete interface in Spanish and English, for venues with international clientele.
- **5-minute installation** — A single command installs and configures the entire system automatically.

---

## 2. Technical Details

> *This section is for developers and technical personnel. If you're in hospitality, you can jump directly to the [Quick Start Guide](./docs/QUICK_START.md).*

### Technical Features
- **Real-time Synchronization**: WebSockets (Socket.io) for instant status updates across all terminals.
- **Adaptive Architecture**: Runs on resource-limited hardware (Raspberry Pi/ARM64) and high-performance servers (AMD64).
- **Technology Independence**: Self-hosted solution without dependency on external services or third-party subscriptions.
- **Production-Ready**: Action auditing, optimistic concurrency control, and global error management.

### Technology Stack

The project is built on a modern, scalable, 100% TypeScript stack from end to end:

| Layer | Technology | Details |
|-------|------------|---------|
| **Frontend** | Angular 21 | Signals API for granular reactivity, standalone components, Material Design 3 |
| **Backend** | Node.js 20 + Express 5 | REST API + WebSockets, optimistic concurrency control (OCC) |
| **Database** | MongoDB 7 | Mongoose schemas with versioning (`__v`) for multi-user integrity |
| **Real-time** | Socket.io 4.x | Bidirectional instant synchronization between all terminals |
| **Reverse Proxy** | Caddy 2 | Automatic TLS termination (Let's Encrypt), compression, and security headers |
| **Infrastructure** | Docker + Compose | Multi-architecture (AMD64/ARM64), health checks, and resource limits |
| **CI/CD** | GitHub Actions | Multi-arch build, security audit (Trivy), automated deployment |
| **i18n** | ngx-translate | Complete bilingual support (Spanish / English) |
| **Testing** | Jest + Supertest | Integration tests with in-memory MongoDB (`mongodb-memory-server`) |

### System Architecture

Disher.io follows **Clean Architecture** principles, clearly separating responsibilities between presentation layer, business logic, and data persistence.

#### Frontend Module Structure
The Angular application is organized into specialized functional modules:

- **Admin Dashboard**: Central statistics and administrative management panel.
- **KDS (Kitchen Display System)**: Reactive interface for coordinating kitchen orders.
- **Waiter View**: Table and order management tool for floor staff.
- **POS (Point of Sale)**: Payment terminal with support for bill splitting and invoicing.
- **Menu Editor**: Real-time catalog and inventory editing suite.
- **Customer View**: Self-service interface for customers accessible via QR.

#### State and Data Management
- **Angular Signals**: Implemented for granular reactivity in components.
- **TypeScript Interfaces**: Strict definitions for all entities (IOrder, IMenuItem, IUser, IRestaurant).
- **Concurrency Control (OCC)**: Use of `__v` field in MongoDB to prevent accidental overwrites in multi-user environments.

---

## 3. Quick Start Guide

The system includes an automated installation script that manages infrastructure provisioning.

### Prerequisites
- Docker Engine >= 24.0.0
- Docker Compose Plugin >= 2.20.0
- Administrator access (sudo)

### Installation
```bash
# Clone the repository
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Run the automated installer
chmod +x install.sh
sudo ./install.sh
```

The installer will guide you through network configuration (local IP or FQDN), cryptographic key generation, and container deployment.

If you choose a **public domain**, the installer will automatically configure **Caddy with Let's Encrypt** for HTTPS and display the necessary DNS records (A and CAA). This information can be consulted at any time:

```bash
sudo ./show-dns.sh
```

---

## 4. Maintenance and Operations

### 4.1 Update from Existing Installation

The installation script also acts as an updater. It preserves data and rebuilds images with new code.

```bash
# 1. Get the latest changes from the repository
git pull origin main

# 2. Run the installer in update mode
sudo ./install.sh
```

### 4.2 Database Backup

Use the automated script included in the project root to create consistent, compressed backups.

```bash
chmod +x backup.sh
sudo ./backup.sh
```

The script generates `backups/disher_backup_YYYY-MM-DD_HH-MM-SS.tar.gz` and automatically retains the last 7 copies. **Save this file in an external, secure location.**

For restoring a backup or configuring automatic cron backups, consult the [Maintenance Guide](./docs/MAINTENANCE.md).

### 4.3 Standard Shutdown (Preserves Data)

Stops all containers while preserving volumes (database, images, and configuration) intact.

```bash
docker compose down
```

*To restart the system: `docker compose up -d`*

### 4.4 Complete Infrastructure Removal (Full Docker Purge)

> **Destructive and irreversible action.** Deletes containers, networks, compiled images, volumes, and all persisted data.

```bash
cd disherio

# 1. Stop services destroying volumes, compiled images, and orphan containers
docker compose down -v --rmi all --remove-orphans

# 2. Deep system-level Docker purge (cleans unused caches and data)
docker system prune -a --volumes -f

# 3. Forced removal of the project directory
cd ..
sudo rm -rf disherio
```

### 4.5 Corrupt Installation Resolution

In case of state corruption (critical power outage, manual volume modification, Docker daemon corruption), execute the following complete forced reset sequence:

```bash
# 1. Preliminary diagnosis
docker ps -a
docker compose logs backend

# 2. Exhaustive destruction of the stack and all traces
cd disherio
docker compose down -v --rmi all --remove-orphans
docker system prune -a --volumes -f

# 3. Directory removal
cd ..
sudo rm -rf disherio

# 4. Clean reinstallation from scratch
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
chmod +x install.sh
sudo ./install.sh
```

---

## 5. Opening Ports on Cloud Servers

When Disher.io is installed on a VPS or cloud instance, the provider has its **own network firewall**, independent of the server's operating system. Even if the application is running correctly inside the server, external access will be blocked until the necessary ports are opened from the provider's panel.

- **Port 80** (HTTP) — mandatory for all installations.
- **Port 443** (HTTPS) — mandatory if you use a public domain with Let's Encrypt.

### Google Cloud (Compute Engine)

The most reliable way is from the **web console**, as network permissions are often restricted from within the VM.

**Option A — Web console:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Navigate to **VPC Network → Firewall**
3. Click **"+ CREATE FIREWALL RULE"** and use these values:

| Field | Value |
|-------|-------|
| Name | `allow-http-80` |
| Network | `default` |
| Direction of traffic | `Ingress` |
| Action on match | `Allow` |
| Targets | `All instances in the network` |
| Source filter | `IPv4 ranges` |
| Source IPv4 ranges | `0.0.0.0/0` |
| Protocols and ports | `TCP: 80, 443` |

4. Click **"Create"**. The rule activates in less than 30 seconds.

**Option B — gcloud CLI** (requires network admin permissions in the project):

```bash
gcloud compute firewall-rules create allow-disher \
  --allow tcp:80,tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --description "Disher.io HTTP + HTTPS"
```

> **Note:** If you see the error `Request had insufficient authentication scopes`, the VM doesn't have permissions to manage the firewall from within. Use Option A from the web console.

### AWS (EC2)

1. Go to **EC2 → Instances → select your instance**
2. In the **Security** tab, click the **Security Group**
3. In **Inbound rules**, add:
   - Type: `HTTP`, Port: `80`, Source: `0.0.0.0/0`
   - Type: `HTTPS`, Port: `443`, Source: `0.0.0.0/0`
4. Save the changes.

### Azure (Virtual Machine)

1. Go to your VM in the Azure portal
2. In **Networking**, add **Inbound port rules**:
   - Port: `80`, Protocol: `TCP`, Action: `Allow`
   - Port: `443`, Protocol: `TCP`, Action: `Allow`

---

## 6. Technical Documentation

For detailed information on specific aspects of the system, consult the following documents in the `/docs` folder:

- **[QUICK_START.md](./docs/QUICK_START.md)**: Quick start guide, network variants, and cloud provider firewall configuration.
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Design decisions, flow diagrams, and security layers.
- **[API_GUIDE.md](./docs/API_GUIDE.md)**: Technical specification of REST endpoints and WebSocket events.
- **[API.md](./docs/API.md)**: Quick API reference.
- **[MAINTENANCE.md](./docs/MAINTENANCE.md)**: Backups, restoration, credential management, and updates.
- **[TESTING_AND_CI.md](./docs/TESTING_AND_CI.md)**: Testing strategy and CI/CD pipeline.
- **[CONTRIBUTING.md](./docs/CONTRIBUTING.md)**: Contribution guide, code conventions, and Pull Request flow.

---

## 7. Security and Resilience

- **Global Error Management**: Implementation of a `GlobalErrorHandler` in the frontend for centralized exception capture and notification.
- **MD3 Notification System**: Based on Material Design 3, integrated with the messaging system for critical and success alerts.
- **Action Auditing**: Immutable logging of sensitive administrative operations.
- **Optimized CI/CD**: GitHub Actions pipeline that includes type validation, dependency security audit (Trivy), and multi-architecture image building.

---

## 8. License

This project is distributed under the **MIT** license. For more details, consult the `LICENSE` file in the repository root.
