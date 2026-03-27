# DisherIo

Restaurant management system covering point of sale, kitchen display, table assistance, and self-service totem ordering.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Development](#development)
- [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [Permissions](#permissions)
- [API Overview](#api-overview)
- [WebSocket Events](#websocket-events)
- [Scripts](#scripts)

---

## Architecture

```
                    Caddy (Reverse Proxy)
                       Ports 80 / 443
                    /                  \
           Frontend                  Backend
           Angular 21                Express 5
           Port 4200                 Port 3000
                                         |
                                      MongoDB
                                      Port 27017
```

All traffic enters through Caddy. Paths starting with `/api/` or `/socket.io/` are proxied to the backend; everything else goes to the frontend.

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Angular | 21.2 |
| Frontend | TailwindCSS | 3.4 |
| Frontend | Socket.IO Client | 4.8 |
| Backend | Node.js | 20 LTS |
| Backend | Express | 5.2 |
| Backend | Socket.IO | 4.8 |
| Database | MongoDB | 7 |
| ODM | Mongoose | 9.3 |
| Validation | Zod | 4 |
| Auth | JWT + CASL | - |
| Proxy | Caddy | 2 |
| Language | TypeScript | 5.4 (backend) / 5.9 (frontend) |

---

## Installation

See [INSTALL.md](INSTALL.md) for the full installation guide.

**Quick start on a Linux server:**

```bash
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
sudo ./scripts/install.sh
```

The installer handles Docker installation, configuration, image builds, database seeding, and prints the access URL and admin credentials when done.

---

## Development

### Prerequisites

- Node.js 20+
- Docker (for MongoDB)
- npm

### Setup

```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongo mongo:7

# Backend
cd backend
npm install
cp ../.env.example .env   # adjust MONGODB_URI, JWT_SECRET
npm run dev               # starts on :3000

# Frontend (separate terminal)
cd frontend
npm install --legacy-peer-deps
npm start                 # starts on :4200
```

### Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000 |
| Health check | http://localhost:3000/health |

### Running Tests

```bash
# Backend (Jest)
cd backend
npm test

# Frontend (Vitest)
cd frontend
npm test
```

---

## Environment Variables

The installer generates `.env` automatically. For manual setup, copy `.env.example` and fill in the values.

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `production` or `development` | Yes |
| `PORT` | HTTP port Caddy listens on | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for signing JWTs, min 32 chars | Yes |
| `JWT_EXPIRES` | Token lifetime, e.g. `8h` | Yes |
| `FRONTEND_URL` | Full origin URL, used for CORS | Yes |
| `LOG_LEVEL` | Pino log level (`info`, `debug`, `error`) | No |

The backend validates `JWT_SECRET` on startup and exits immediately if it is missing or set to the default placeholder.

---

## Authentication

Login is performed via `POST /api/auth/login` with a username and password. The server sets an `auth_token` HttpOnly cookie in the response. All subsequent requests send this cookie automatically; no Authorization header is required.

The login response body contains the user object (id, name, role, permissions) so the frontend can display user information without reading the cookie.

Logout via `POST /api/auth/logout` clears the cookie.

Socket.IO connections authenticate using the same cookie, sent automatically when `withCredentials: true` is set on the client.

---

## Permissions

| Permission | Role | Access |
|------------|------|--------|
| `ADMIN` | Administrator | Full system access |
| `POS` | Cashier | Point of sale, orders, payments |
| `TAS` | Waiter | Table assistance, order management |
| `KTS` | Kitchen staff | Kitchen display, item state updates |

Each JWT payload contains the user's permission list. Route-level enforcement is handled by the `requirePermission` middleware using CASL.

---

## API Overview

Base path: `/api`

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Login with username and password |
| POST | `/auth/pin` | No | Login with PIN code |
| POST | `/auth/logout` | No | Clear session cookie |

### Dishes and Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dishes` | Yes | List dishes and categories |
| POST | `/dishes` | Yes (ADMIN) | Create dish |
| PUT | `/dishes/:id` | Yes (ADMIN) | Update dish |
| DELETE | `/dishes/:id` | Yes (ADMIN) | Delete dish |
| GET | `/dishes/categories` | Yes | List categories |
| POST | `/dishes/categories` | Yes (ADMIN) | Create category |

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/orders` | Yes | Create order for a totem session |
| POST | `/orders/items` | Yes | Add item to existing order |
| PATCH | `/orders/items/:id/state` | Yes | Advance item state |
| GET | `/orders/kitchen` | Yes (KTS) | List active kitchen items |
| POST | `/orders/payments` | Yes (POS) | Record payment for an order |

**Item state machine:** `ORDERED` → `ON_PREPARE` → `SERVED`. Items can also be set to `CANCELED`.

### Totems

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/totems` | Yes (ADMIN) | List totems |
| POST | `/totems` | Yes (ADMIN) | Create totem |
| PATCH | `/totems/:id` | Yes (ADMIN) | Update totem |
| DELETE | `/totems/:id` | Yes (ADMIN) | Delete totem and close active sessions |
| POST | `/totems/:id/regenerate-qr` | Yes (ADMIN) | Regenerate QR token |
| POST | `/totems/:totemId/session` | Yes | Start a totem session |
| GET | `/totems/menu/:qr` | No | Get totem info by QR (rate limited) |
| GET | `/totems/menu/:qr/dishes` | No | Get menu dishes by QR (rate limited) |

### Restaurant and Staff

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/restaurant` | Yes | Get restaurant configuration |
| POST | `/restaurant` | Yes (ADMIN) | Update restaurant configuration |
| GET | `/staff` | Yes (ADMIN) | List staff members |
| POST | `/staff` | Yes (ADMIN) | Create staff member |
| GET | `/dashboard` | Yes (ADMIN) | Analytics dashboard |
| POST | `/uploads` | Yes | Upload an image |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Service health check |

---

## WebSocket Events

The Socket.IO server is mounted at `/socket.io`. Authentication uses the `auth_token` HttpOnly cookie, sent automatically when `withCredentials: true`.

### KDS (Kitchen Display System)

Requires `KTS` permission.

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client → Server | `kds:join` | `sessionId: string` | Join a session room |
| Client → Server | `kds:item_prepare` | `{ itemId: string }` | Mark item as ON_PREPARE |
| Client → Server | `kds:item_serve` | `{ itemId: string }` | Mark item as SERVED |
| Server → Client | `kds:joined` | `{ sessionId }` | Confirmation of room join |
| Server → Client | `kds:new_item` | `ItemOrder` | New item entered the kitchen |
| Server → Client | `item:state_changed` | `{ itemId, newState }` | An item changed state |
| Server → Client | `kds:error` | `{ message, ... }` | Error response |

### POS (Point of Sale)

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client → Server | `pos:join` | `sessionId: string` | Subscribe to session updates |
| Client → Server | `pos:leave` | `sessionId: string` | Unsubscribe from session |
| Server → Client | `item:state_changed` | `{ itemId, newState }` | An item changed state |

---

## Scripts

| Script | Description |
|--------|-------------|
| `sudo ./scripts/install.sh` | Full installation: dependencies, config, build, seed |
| `sudo ./scripts/configure.sh` | Reconfigure domain, port, or admin password post-install |
| `sudo ./scripts/backup.sh` | Backup MongoDB to `/var/backups/disherio/` |
| `sudo ./scripts/info.sh` | Display network info, service status, and resource usage |

### Docker commands

```bash
# View running containers
docker compose ps

# Follow logs for a service
docker compose logs -f backend
docker compose logs -f caddy

# Restart a service
docker compose restart backend

# Shell into a container
docker compose exec backend sh
docker compose exec mongo mongosh disherio
```

---

## License

Proprietary. All rights reserved.
