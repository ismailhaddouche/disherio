# Disher.io API Reference

> **Versión en español:** [API.md](./API.md)

**Version:** 1.2
**Architecture:** Single-tenant — all endpoints operate on a single restaurant instance.
**Integrity:** All critical state changes are protected by **Optimistic Concurrency Control (OCC)** using the `__v` field.

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:3000/api` |
| Production | `https://yourdomain.com/api` |

---

## Authentication

Authentication uses **httpOnly cookies**. The token is set automatically by the server on login and sent by the browser on every subsequent request — no manual token handling required.

For **API clients** (scripts, integrations, curl), the legacy `Authorization: Bearer <token>` header is still accepted as a fallback.

Tokens expire after **24 hours**. Call `POST /api/auth/logout` to invalidate the session cookie immediately.

**Role levels:**
- `admin` — Full access to all endpoints
- `waiter` — Access to orders and tables (Waiter View)
- `kitchen` — Access to orders (KDS)
- `pos` — Access to orders and checkout (POS)
- `customer` — No authenticated access (uses public endpoints)

---

## Endpoints

### Authentication

#### Login
`POST /api/auth/login`

Authenticates a staff member and returns a JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "yourpassword"
}
```

**Response `200 OK`:**
```json
{
  "username": "admin",
  "role": "admin"
}
```

The JWT token is set as a `Set-Cookie: disher_token` header — `HttpOnly`, `Secure`, `SameSite=Strict`. It is **not** returned in the response body.

**Response `400 Bad Request`:** (missing fields)
```json
{ "error": "Username is required" }
```

**Response `401 Unauthorized`:**
```json
{ "error": "Invalid credentials" }
```

**Response `429 Too Many Requests`:** (after 10 failed attempts in 15 min)
```json
{ "error": "Too many login attempts. Please try again in 15 minutes." }
```

#### Logout
`POST /api/auth/logout`

Clears the authentication cookie. No request body required.

**Response `200 OK`:**
```json
{ "message": "Logged out successfully" }
```

#### Customer Guest Session
`POST /api/auth/customer-session`

Generates a temporary session token for a customer joining a table. Employs `httpOnly` cookies.

**Request:**
```json
{
  "restaurantSlug": "default",
  "totemId": 1,
  "name": "Juan"
}
```

**Response `200 OK`:**
```json
{
  "username": "Juan",
  "role": "customer",
  "restaurantSlug": "default",
  "totemId": 1
}
```

---

### System

#### Health Check
`GET /api/health`

Returns system status. No authentication required. Used by Docker health checks and monitoring tools.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "uptime": 3600.42,
  "domain": "yourdomain.com",
  "mode": "production"
}
```

---

### Restaurant Configuration

#### Get Restaurant Info
`GET /api/restaurant`

Returns the full restaurant configuration including branding, billing, and totem list. Public — no authentication required (used by the customer-facing menu to load branding).

**Response `200 OK`:**
```json
{
  "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
  "name": "La Bonne Table",
  "logo": "https://yourdomain.com/logo.png",
  "theme": {
    "primaryColor": "#E63946",
    "secondaryColor": "#1D3557"
  },
  "billing": {
    "vatPercentage": 10,
    "tipEnabled": true,
    "tipPercentage": 5
  },
  "totems": [
    { "id": 1, "name": "Mesa 1", "active": true },
    { "id": 2, "name": "Mesa 2", "active": true }
  ],
  "nextTotemId": 3
}
```

#### Update Restaurant Info
`PATCH /api/restaurant` — **Requires: Admin**

Updates any restaurant field (branding, theme, billing, socials). Sends a `config-updated` Socket.io event to all connected clients.

**Request (partial update example):**
```json
{
  "name": "La Bonne Table",
  "theme": {
    "primaryColor": "#E63946"
  },
  "billing": {
    "vatPercentage": 10,
    "tipEnabled": true,
    "tipPercentage": 5
  }
}
```

**Response `200 OK`:** Full updated restaurant object.

#### Upload Logo
`POST /api/upload-logo` — **Requires: Admin**

Uploads and optimizes the restaurant logo (converts to WebP, forces 500x500px boundaries). Accepts `multipart/form-data` with a `logo` file field.

**Response `200 OK`:**
```json
{
  "url": "/uploads/logo-1708691400000.webp"
}
```

#### Close Shift (Cierre de Caja)
`POST /api/close-shift` — **Requires: Admin**

Terminates all active table sessions globally. Emits `all-sessions-ended` via Socket.io to disconnect all customers. Used typically at the end of the day.

**Response `200 OK`:**
```json
{
  "message": "Cierre de caja realizado. Todas las sesiones de clientes han sido liquidadas."
}
```

---

### Totems (Tables)

#### List Totems
`GET /api/totems`

Returns the list of all configured tables/totems. Public — no authentication required.

**Response `200 OK`:**
```json
[
  { "id": 1, "name": "Mesa 1", "active": true, "isVirtual": false, "currentSessionId": "DSH-ABC123-2026-2027" },
  { "id": 2, "name": "Barra", "active": true, "isVirtual": true, "currentSessionId": null }
]
```

#### Add New Totem
`POST /api/totems` — **Requires: Admin**

Creates a new table. The `id` is auto-incremented. The `name` defaults to `Mesa {id}` if not provided.

**Request:**
```json
{
  "name": "Terraza 2"
}
```

**Response `201 Created`:**
```json
{
  "id": 3,
  "name": "Terraza 2",
  "active": true,
  "isVirtual": false,
  "createdBy": "admin"
}
```

#### Update Totem
`PATCH /api/totems/:id` — **Requires: Admin**

Updates an existing table's name.

**Request:**
```json
{
  "name": "Terraza VIP"
}
```

#### Delete Totem
`DELETE /api/totems/:id` — **Requires: Admin (Waiters can delete virtual totems)**

Permanently removes a table from the restaurant config. Kills any active sessions on that table.

#### Get Totem Session
`GET /api/totems/:id/session`

Retrieves the currently active `sessionId` for a specific table. If the session has expired or the table is empty, `sessionId` will be `null`.

**Response `200 OK`:**
```json
{
  "sessionId": "DSH-XYZ789-2026-2027",
  "totemId": 1,
  "tableNumber": "Mesa 1"
}
```

#### Start Totem Session
`POST /api/totems/:id/session`

Generates and opens a new session for a table. Required before a customer can place an order via QR or via public session code link. If an active session already exists, it returns the existing one. It also initializes an empty order lock in the backend.

**Response `200 OK`:**
```json
{
  "sessionId": "DSH-NEW123-2026-2027",
  "totemId": 1,
  "tableNumber": "Mesa 1"
}
```

#### Get QR Code
`GET /api/qr/:totemId`

Returns a PNG image of the QR code for the specified table. Scan the code to open the customer menu for that table. No authentication required.

**Parameters:**
- `totemId` (number) — The table ID

**Response:** `image/png` binary

**Usage:** Open directly in browser or `<img src="/api/qr/1">` in HTML.

> The QR code URL is built from the `DOMAIN` environment variable. Set it correctly before printing QR codes.

---

### Menu

#### List Menu Items
`GET /api/menu`

Returns all menu items sorted by category, then by `order` field, then alphabetically. Public — no authentication required.

**Response `200 OK`:**
```json
[
  {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e2",
    "name": "Margherita",
    "description": "Tomato, mozzarella, basil",
    "price": 12.50,
    "category": "Pizza",
    "available": true,
    "variants": [
      { "name": "Small", "priceDelta": -2 },
      { "name": "Large", "priceDelta": 3 }
    ],
    "addons": [
      { "name": "Extra cheese", "price": 1.5 }
    ],
    "allergens": ["gluten", "dairy"],
    "order": 1
  }
]
```

#### Create or Update Menu Item
`POST /api/menu` — **Requires: Admin**

- If `_id` is **omitted**: creates a new item.
- If `_id` is **provided**: updates the existing item.

Sends a `menu-update` Socket.io event to all connected clients.

**Request (create):**
```json
{
  "name": "Caesar Salad",
  "price": 9.00,
  "category": "Starters",
  "available": true,
  "allergens": ["dairy", "gluten"]
}
```

**Request (update):**
```json
{
  "_id": "65a1b2c3d4e5f6a7b8c9d0e2",
  "price": 10.00,
  "available": false
}
```

**Response `200 OK`:** Full item object.

#### Delete Menu Item
`DELETE /api/menu/:id` — **Requires: Admin**

Permanently deletes a menu item. Sends a `menu-update` event with `{ deleted: id }`.

**Response `200 OK`:**
```json
{ "message": "Menu item deleted" }
```

#### Toggle Item Availability
`POST /api/menu/:productId/toggle` — **Requires: Admin**

Flips the `available` flag without editing the item. Use this when an item sells out mid-service. Sends a `menu-update` Socket.io event.

**Response `200 OK`:** Full item object with updated `available` field.

---

### Orders

#### List Active Orders
`GET /api/orders` — **Requires: Token (any role)**

Returns all orders with `status: active`, sorted newest first. Used by KDS and POS.

**Response `200 OK`:** Array of order objects.

#### Get Order by Table
`GET /api/orders/table/:tableNumber`

Returns the active order for a specific table number. Public — used by the customer checkout view.

**Parameters:**
- `tableNumber` (string) — The table identifier (matches `totemId` or `name`)

**Response `200 OK`:** Order object or `null` if no active order.

#### Get Order by Session Code
`GET /api/orders/session/:sessionId`

Returns the active order linked to a specific alphanumeric session code. Public — used by the customer view when accessed out of local network.

**Response `200 OK`:** Order object or `null` if no active order matches the session.

#### Create New Order (Customer)
`POST /api/orders`

Creates a new order. Public — called when a customer confirms their cart. Sends an `order-update` Socket.io event.

**Request:**
```json
{
  "tableNumber": "1",
  "totemId": 1,
  "sessionId": "DSH-ABC123-2026-2027",
  "items": [
    {
      "name": "Margherita",
      "price": 12.50,
      "quantity": 2,
      "variants": ["Large"],
      "addons": ["Extra cheese"]
    }
  ]
}
```

**Response `201 Created`:** Full order object.

#### Add Items to Order (Waiter)
`POST /api/orders/table/:tableNumber/add-items` — **Requires: Token (any role)**

Appends items to an existing active order (or creates the order if the table is empty). This is the endpoint used by Waiters in the POS/Waiter interface.

**Request:**
```json
{
  "items": [
    { "name": "Beer", "price": 4.50, "quantity": 3 }
  ],
  "guestId": "guest-timestamp",
  "guestName": "Carlos"
}
```

**Response `200 OK`:** Full order object.

#### Update Order
`PATCH /api/orders/:orderId` — **Requires: Token (any role)**

Updates any field of an order (items, totalAmount, status, paymentStatus). Sends `order-updated` Socket.io event.

**Request (example — mark as ready):**
```json
{
  "status": "completed",
  "paymentStatus": "paid"
}
```

**Response `200 OK`:** Full updated order object.

#### Update Single Item Status
`PATCH /api/orders/:orderId/items/:itemId` — **Requires: Token (any role)**

Updates the status of a single item within an order. Used by KDS to mark items as `preparing` or `ready`.

**Item status values:**
| Status | Meaning |
|--------|---------|
| `pending` | Received, not started |
| `preparing` | Kitchen is working on it |
| `ready` | Ready to serve |
| `served` | Delivered to customer |
| `cancelled`| Cancelled order |

**Request:**
```json
{
  "status": "preparing"
}
```

**Response `200 OK`:** Full order object with updated item.

#### Associate Item to Customer
`PATCH /api/orders/:orderId/items/:itemId/associate` — **Requires: Token (any role)**

Changes the `orderedBy` tag of an individual item inside an order to a specific customer's name. Useful for waiters managing split bills.

**Request:**
```json
{
  "userId": "guest-timestamp-123",
  "userName": "Carlos"
}
```

**Response `200 OK`:** Full updated order object.

#### Bulk Status Update
`PATCH /api/orders/:orderId/items/bulk-status` — **Requires: Token (any role)**

Updates the status of *all* items in the order at once (excluding already `served` or `cancelled` items).

**Request:**
```json
{
  "status": "preparing"
}
```

**Response `200 OK`:** Full updated order object.

#### Complete an Order
`POST /api/orders/:orderId/complete` — **Requires: Token (any role)**

Sets order `status` to `completed` and `paymentStatus` to `paid`. Shortcut for simple full-table payments.

**Response `200 OK`:** Full updated order object.

#### Checkout (Payment Processing)
`POST /api/orders/:orderId/checkout` — **Requires: Token (any role)**

Processes payment for an order. Applies VAT and tip, splits into tickets if requested, and marks the order as completed.

**Request:**
```json
{
  "splitType": "equal",
  "parts": 2,
  "method": "card",
  "billingConfig": {
    "vatPercentage": 10,
    "tipEnabled": true,
    "tipPercentage": 5
  }
}
```

**Fields:**
- `splitType` — `"equal"` to split evenly, or `"single"` / omit for no split
- `parts` — Number of people splitting the bill (used when `splitType` is `"equal"`)
- `method` — `"cash"` or `"card"`
- `billingConfig` — Pass the billing settings from `GET /api/restaurant`

**Response `200 OK`:**
```json
{
  "tickets": [
    {
      "_id": "...",
      "orderId": "...",
      "customId": "ABC123/1-2",
      "method": "card",
      "amount": 16.24,
      "itemsSummary": ["2x Margherita", "1x Caesar Salad"]
    },
    {
      "customId": "ABC123/2-2",
      "amount": 16.24
    }
  ]
}
```

---

### Users (Staff Management)

All user endpoints require **Admin** role.

#### List All Users
`GET /api/users` — **Requires: Admin**

Returns all user accounts. Password field is excluded.

**Response `200 OK`:**
```json
[
  {
    "_id": "65a1b2c3...",
    "username": "maria_kitchen",
    "role": "kitchen",
    "active": true
  }
]
```

#### Update Own Profile
`PATCH /api/users/me` — **Requires: Token (any role)**

Allows a logged-in user to change their username or password.

**Request:**
```json
{
  "username": "maria_chef",
  "password": "newSecurePassword123"
}
```

#### Create or Update User
`POST /api/users` — **Requires: Admin**

- If `_id` is **omitted**: creates a new user.
- If `_id` is **provided**: updates the existing user. Password is re-hashed if changed.

**Request (create):**
```json
{
  "username": "carlos_pos",
  "password": "securepassword123",
  "role": "pos",
  "active": true
}
```

**Available roles:** `admin`, `kitchen`, `pos`

**Response `200 OK`:** User object (without password).

#### Delete User
`DELETE /api/users/:id` — **Requires: Admin**

Permanently removes a user account.

**Response `200 OK`:**
```json
{ "message": "User deleted" }
```

#### Update Printer Settings
`PATCH /api/users/:id/print-settings` — **Requires: Admin**

Updates network printer configuration and receipt template details for a specific POS/Admin user.

**Request:**
```json
{
  "printerId": "192.168.1.100",
  "printTemplate": {
    "header": "Gracias por su visita",
    "showLogo": true
  }
}
```

#### Copy Printer Settings
`POST /api/users/:id/copy-print-settings/:sourceUserId` — **Requires: Admin**

Copies the printer configuration and template from the `sourceUserId` to the target `:id`. Very useful when setting up multiple POS terminals.

---

### Logs & History

#### Get Activity Logs
`GET /api/logs` — **Requires: Token (any role)**

Returns the last 100 admin activity log entries, sorted newest first.

#### Create Activity Log
`POST /api/logs`

Records an administrative action. Called by the frontend automatically.

**Request:**
```json
{
  "action": "menu_item_updated",
  "details": "Updated price for Margherita",
  "userId": "65a1b2c3..."
}
```

#### Get Order History
`GET /api/history` — **Requires: Token (any role)**

Returns the last 200 closed tickets, sorted newest first. Used by the POS history view.

**Response `200 OK`:** Array of Ticket objects.

#### Delete Ticket
`DELETE /api/tickets/:ticketId` — **Requires: Token (any role)**

Removes a ticket from history.

**Response `200 OK`:**
```json
{ "message": "Ticket deleted" }
```

---

## WebSocket Events (Socket.io)

Connect to the same host as the API. The server emits events to **all connected clients** when data changes.

**Connection:**
```javascript
import { io } from 'socket.io-client';
const socket = io('https://yourdomain.com', {
  transports: ['websocket', 'polling']
});
```

**Events:**

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `order-update` | Server → All | Order object | A new order was created |
| `order-updated` | Server → All | Order object | An order or item was updated |
| `menu-update` | Server → All | Item object or `{ deleted: id }` | Menu item changed |
| `config-updated` | Server → All | Restaurant object | Branding or billing changed |

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "status": 404,
  "requestId": "1708691400000-abc123"
}
```

| Status Code | Meaning |
|-------------|---------|
| `400` | Bad request — malformed input |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — insufficient role |
| `404` | Resource not found |
| `500` | Internal server error |

Include the `requestId` when reporting bugs — it links the error to the server logs.
