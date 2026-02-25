# Disher.io Quick Start Guide

This guide gets you from zero to a running restaurant platform in under 10 minutes.

---

## Prerequisites

- Docker 24+ and Docker Compose v2+ installed
- Git installed
- Ports **80** and **443** available (production) or **3000** / **4200** (development)

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
```

---

## Step 2 — Choose Your Installation Mode

### Option A: Automated Installer (Recommended for First-Time Setup)

```bash
chmod +x install.sh
sudo ./install.sh
```

The script will:
1. Check that Docker is installed
2. Ask you to choose a deployment mode (Local / Production / Raspberry Pi)
3. Generate a secure `JWT_SECRET` automatically
4. Create and configure your `.env` file
5. Start all containers

### Option B: Manual Setup

```bash
cp .env.example .env
```

Open `.env` and set the required values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DOMAIN` | Yes | Your domain or local IP (`192.168.1.10` or `myrestaurant.com`) |
| `JWT_SECRET` | Yes | A random secret string (min 32 characters) |
| `INSTALL_MODE` | Yes | `local`, `production`, or `rpi` |
| `RESTAURANT_NAME` | No | Pre-fills the restaurant name on first boot |
| `NODE_ENV` | No | `production` (default) or `development` |

Generate a secure JWT_SECRET:
```bash
openssl rand -hex 32
```

Then start the stack:
```bash
# Local mode
docker compose up -d --build

# Production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Raspberry Pi mode
docker compose -f docker-compose.yml -f docker-compose.rpi.yml up -d --build
```

### Option C: Development Mode (No Docker)

Requires Node.js 20+ and a local MongoDB instance.

```bash
# Terminal 1 — Backend
cd backend
npm install
npm run dev

# Terminal 2 — Frontend
cd frontend
npm install
npm start
```

- API: `http://localhost:3000/api`
- UI: `http://localhost:4200`

In development mode, the backend auto-seeds the database with:
- An admin account (`admin` / `password`)
- A sample menu with placeholder items

---

## Step 3 — First Login

Open your browser and navigate to:

- **Local mode:** `http://<YOUR_IP>/login` or `http://localhost:4200/login` (dev)
- **Production mode:** `https://yourdomain.com/login`

**Default credentials:**
- Username: `admin`
- Password: `password`

> **Security:** Change the default password immediately. Go to **Store Configuration → Users** to update admin credentials.

---

## Step 4 — Initial Setup Workflow

Follow these steps in order for the best first-time experience:

### 1. Configure Your Restaurant
Go to `/admin/config`
- Set your restaurant name, logo, and brand colors
- Configure billing: enable VAT and set the percentage
- Enable tip if desired

### 2. Build Your Menu
Go to `/admin/menu`
- Create categories (Starters, Mains, Drinks, Desserts...)
- Add items with name, price, description, and allergens
- Add variants (Small/Large) and addons (Extra cheese, No onion) where needed
- Use the toggle switch to mark items as available or unavailable

### 3. Create Your Tables
Go to `/admin/config → Tables / Totems`
- Click "Add Table" for each table in your restaurant
- Give each table a name (`Mesa 1`, `Terraza A`, `Bar`)
- The system generates a unique QR code for each table

### 4. Print QR Codes
For each table, open `http://yourdomain.com/api/qr/<tableId>` in the browser and print or save the QR image.

Stick or frame each QR code at the corresponding table. When customers scan it, they open the digital menu for that table automatically.

### 5. Create Staff Accounts
Go to `/admin/users`
- Create a `kitchen` account for the KDS screen in the kitchen
- Create a `pos` account for the cashier station

### 6. Open Your Stations
- **Kitchen screen:** Open `/admin/kds` in a browser on the kitchen tablet/TV
- **Cashier station:** Open `/admin/pos` in a browser at the bar or counter
- **Admin dashboard:** Open `/admin/dashboard` for overview and stats

---

## Module Reference

| Module | URL | Role | Purpose |
|--------|-----|------|---------|
| Admin Dashboard | `/admin/dashboard` | Admin | Real-time overview: orders, revenue, table status |
| Kitchen Display (KDS) | `/admin/kds` | Kitchen, Admin | See and update order items in real-time |
| Point of Sale (POS) | `/admin/pos` | POS, Admin | Table management, checkout, payment split |
| Menu Editor | `/admin/menu` | Admin | Create and manage dishes |
| Staff Management | `/admin/users` | Admin | Create and manage staff accounts |
| Store Configuration | `/admin/config` | Admin | Branding, billing, tables, QR codes |
| Customer Menu | `/:tableNumber` | Public | Customer-facing digital menu |
| Customer Checkout | `/:tableNumber/checkout` | Public | Customer self-checkout |

---

## Management Commands

```bash
# View running services
docker compose ps

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f caddy

# Restart a service
docker compose restart backend

# Rebuild and restart after code changes
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove all data (destructive)
docker compose down -v
```

---

## Common Issues

| Problem | Symptoms | Solution |
|---------|----------|----------|
| White screen on frontend | Blank page, no error | Check `docker compose logs backend` — backend may not be running |
| "Unauthorized" error | 401 response on all requests | Session expired. Log out and log in again at `/login` |
| Socket disconnected | Real-time updates stopped | Verify Caddy is running. Check `DOMAIN` in `.env` matches your actual URL |
| QR code points to wrong URL | Customers get 404 after scanning | Set `DOMAIN` correctly in `.env` and restart Caddy |
| Cannot access from other devices | Works on localhost only | Use your machine's LAN IP (`192.168.x.x`) as `DOMAIN`, not `localhost` |
| Port already in use | Container fails to start | Run `docker compose down` and check if another process uses ports 80/443 |
| MongoDB not connecting | Backend crash on startup | Run `docker compose logs db` to check MongoDB health |

---

## Next Steps

- [Architecture](./ARCHITECTURE.md) — Understand how the system works
- [API Reference](./API.md) — Full endpoint documentation
- [Maintenance](./MAINTENANCE.md) — Backups, updates, performance tuning
- [Contributing](../CONTRIBUTING.md) — How to contribute code
