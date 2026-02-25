# Disher.io — Architecture

This document describes the system design, component interactions, data models, and key architectural decisions for Disher.io.

---

## Overview

Disher.io is a **single-tenant** application. One deployment serves one restaurant. This design choice was intentional:

- Simpler configuration and maintenance for restaurant owners
- No risk of data leakage between tenants
- Deployable on minimal hardware (Raspberry Pi 4)
- No subscription management or billing complexity

Each restaurant runs its own isolated Docker stack.

---

## Service Architecture

```
Internet / LAN
      │
      ▼
┌─────────────────────────────────────────────┐
│               Caddy (Port 80/443)           │
│                                             │
│  Routes:                                    │
│    /api/*        → backend:3000             │
│    /socket.io/*  → backend:3000 (WS)        │
│    /*            → frontend:80 (SPA)        │
│                                             │
│  Features: Auto-TLS, gzip/zstd, headers     │
└────────────────────┬────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐         ┌──────────────────┐
│   Backend    │         │    Frontend      │
│  Node.js 20  │         │   Angular 21     │
│  Express 5   │         │   Nginx (prod)   │
│  Port 3000   │         │   Port 80        │
└──────┬───────┘         └──────────────────┘
       │
       ├── REST API (/api/*)
       ├── Socket.io (WebSocket)
       │
       ▼
┌──────────────┐
│  MongoDB 7   │
│  Port 27017  │
└──────────────┘
```

---

## Request Flow

### Admin / Staff Request

```
Browser → Caddy → Frontend (Angular SPA)
                       │
                       ├─ HTTP Request → Caddy → Backend /api/*
                       │                              │
                       │                   JWT Middleware (verifyToken)
                       │                              │
                       │                   Route Handler
                       │                              │
                       │                   MongoDB Query
                       │                              │
                       │                   JSON Response
                       │                              │
                       └─ Socket.io Event ←── io.emit()
                             (all clients notified)
```

### Customer Order Flow

```
Customer Phone (QR Scan)
        │
        ▼
  /:tableNumber  →  Angular SPA loads
        │
        ├── GET /api/restaurant  (load branding)
        ├── GET /api/menu        (load items)
        └── POST /api/orders     (place order — no auth required)
                  │
                  └── io.emit('order-update') → KDS + POS notified instantly
```

---

## Frontend Module Breakdown

The Angular app is organized by user role. Each module corresponds to a route and a specific staff function.

```
src/app/
├── login/              Public login form
│
├── dashboard/          Admin only
│   └── Real-time stats: active orders, revenue, table status
│
├── kds/                Kitchen Display System
│   └── Real-time order cards, per-item status updates
│
├── pos/                Point of Sale / Cashier
│   └── Table list, order summary, checkout, payment split
│
├── menu-editor/        Admin only
│   └── CRUD for menu items: name, price, category, variants, allergens
│
├── store-config/       Admin only
│   └── Branding, billing (VAT/tip), totem/table management
│
├── user-management/    Admin only
│   └── Staff accounts: create, edit, delete, assign roles
│
├── customer-view/      Public (no auth)
│   └── Digital menu, add to order, view cart
│
└── checkout/           Public (no auth)
    └── Review order, select payment method, confirm
```

---

## Backend Module Breakdown

```
src/
├── index.js            Entry point: HTTP server, Socket.io, DB connection, seeding
├── app.js              Express app: middleware stack, health endpoint, error handler
│
├── middleware/
│   └── auth.middleware.js    JWT generation and verification
│
├── models/
│   ├── User.js         Staff accounts with bcrypt password hashing
│   ├── Restaurant.js   Global config: branding, billing, totems
│   ├── MenuItem.js     Menu items: variants, addons, allergens, availability
│   ├── Order.js        Active orders with per-item status tracking
│   ├── Ticket.js       Closed payment records
│   └── ActivityLog.js  Admin action audit trail
│
└── routes/
    ├── index.js              Route registration
    ├── auth.routes.js        POST /login
    ├── restaurants.routes.js GET|PATCH /restaurant, totems, QR, logs, history
    ├── menu.routes.js        GET|POST|DELETE /menu, toggle availability
    ├── orders.routes.js      Full order lifecycle
    └── users.routes.js       Staff management (admin only)
```

---

## Data Models

### User

| Field | Type | Description |
|-------|------|-------------|
| `username` | String | Unique login name |
| `password` | String | bcrypt hash (10 rounds) |
| `role` | Enum | `admin`, `kitchen`, `pos`, `customer` |
| `active` | Boolean | Soft disable without deletion |

### Restaurant

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Display name |
| `logo` | String | URL or base64 image |
| `theme` | Object | `primaryColor`, `secondaryColor` |
| `billing` | Object | `vatPercentage`, `tipEnabled`, `tipPercentage` |
| `totems` | Array | Table list: `{ id, name, active }` |
| `nextTotemId` | Number | Auto-increment counter for new tables |
| `socials` | Object | Optional social links |

### MenuItem

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Item name |
| `description` | String | Optional description |
| `price` | Number | Base price |
| `category` | String | Display grouping |
| `available` | Boolean | Toggle without deleting |
| `variants` | Array | Size/type options with price deltas |
| `addons` | Array | Optional extras with individual prices |
| `allergens` | Array | Allergen tags |
| `order` | Number | Manual sort position within category |

### Order

| Field | Type | Description |
|-------|------|-------------|
| `tableNumber` | String | Table identifier |
| `totemId` | Number | QR totem reference |
| `items` | Array | See Order Item below |
| `totalAmount` | Number | Cumulative order total |
| `status` | Enum | `active`, `completed` |
| `paymentStatus` | Enum | `pending`, `paid` |
| `createdAt` | Date | Auto-set by Mongoose |

**Order Item fields:** `name`, `price`, `quantity`, `variants`, `addons`, `status` (`pending`, `preparing`, `ready`)

### Ticket

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | ObjectId | Reference to parent order |
| `customId` | String | Human-readable: `ABC123/1-2` |
| `method` | Enum | `cash`, `card` |
| `amount` | Number | Amount for this ticket (after VAT/tip) |
| `itemsSummary` | Array | String list of items |
| `timestamp` | Date | Auto-set |

---

## Authentication & Authorization

```
POST /api/auth/login
        │
        ├── Validate: username and password required (express-validator)
        ├── Rate limit: max 10 attempts per 15 min per IP
        ├── Find user by username (active: true)
        ├── bcrypt.compare(password, hash)
        └── On success:
              ├── Set-Cookie: disher_token=JWT; HttpOnly; Secure; SameSite=Strict
              └── Return { username, role } — token NOT in response body

Protected routes check:
        │
        ├── Read token from req.cookies.disher_token (httpOnly cookie)
        ├── Fallback: Authorization: Bearer <token> header (for API clients)
        ├── jwt.verify(token, JWT_SECRET)
        ├── Attach req.user = { userId, role }
        └── Route handler proceeds

Admin-only routes additionally check:
        └── req.user.role === 'admin'
```

**User roles and access:**

| Role | Dashboard | KDS | POS | Menu Editor | Users | Config |
|------|-----------|-----|-----|-------------|-------|--------|
| `admin` | Yes | Yes | Yes | Yes | Yes | Yes |
| `kitchen` | No | Yes | No | No | No | No |
| `pos` | No | No | Yes | No | No | No |
| `customer` | No | No | No | No | No | No |

---

## Real-time Events (Socket.io)

All events are broadcast to every connected client. There is no per-room scoping in the current version.

| Event | Trigger | Payload | Consumers |
|-------|---------|---------|-----------|
| `order-update` | New order created | Full order object | KDS, POS, Dashboard |
| `order-updated` | Order or item status changed | Full order object | KDS, POS, Dashboard |
| `menu-update` | Item created, updated, deleted, toggled | Item object or `{ deleted: id }` | Customer view |
| `config-updated` | Restaurant config changed | Full restaurant object | All (theme, branding) |

---

## Security Layers

| Layer | Mechanism |
|-------|-----------|
| Transport | Caddy enforces HTTPS with HSTS (1 year) |
| Headers | Helmet: CSP, X-Frame-Options DENY, XSS protection |
| Authentication | JWT in `httpOnly` cookie — inaccessible to JavaScript |
| Authorization | RBAC middleware on every protected route |
| Input Validation | `express-validator` on all routes — required fields, enums, MongoDB IDs |
| Rate Limiting | Global: 100 req/15min; Login: 10 req/15min per IP |
| Request Size | 1MB limit on JSON and URL-encoded bodies |
| Passwords | bcrypt with 10 salt rounds |
| Process Isolation | Backend and frontend run as non-root (UID 1001) |
| Dependency Auditing | `npm audit --omit=dev` runs in CI on every push |

---

## Docker Stack

```
docker-compose.yml (dev base)
        +
docker-compose.prod.yml (production overlay)
        or
docker-compose.rpi.yml (Raspberry Pi overlay)

Services:
  db        MongoDB 7  — named volume, health check
  backend   Node.js    — depends on db healthy
  frontend  Nginx      — depends on backend healthy
  caddy     Caddy 2    — depends on frontend healthy
                          routes to backend + frontend
```

**Networks:** All services share a single internal bridge network `disher-network`. Only Caddy is exposed to the host on ports 80/443.

**Volumes:**
- `mongo-data` — database persistence
- `caddy-data` — TLS certificates
- `caddy-config` — Caddy runtime config

---

## Key Design Decisions

**Single-tenant over multi-tenant**
Each restaurant gets its own deployment. This eliminates complex tenant isolation code, reduces the attack surface, and makes the system understandable for non-technical operators who self-host.

**MongoDB over relational DB**
Menu items have deeply nested variants and addons that change frequently. MongoDB's flexible schema avoids complex migrations when restaurants customize their menu structure.

**Caddy over Nginx**
Caddy handles Let's Encrypt certificate issuance and renewal automatically with zero configuration, which is critical for operators who are not system administrators.

**Angular Signals over NgRx**
For a single-tenant, single-restaurant app, the complexity of a full state management library is not justified. Angular Signals provide reactive state with minimal boilerplate.
