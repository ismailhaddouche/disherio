# API Reference

**Base URL:** `/api`

All protected endpoints require a valid session. Authentication is cookie-based: the server sets an `auth_token` HttpOnly cookie on login. Browsers send it automatically. Non-browser clients may fall back to an `Authorization: Bearer <token>` header.

Rate limiting applies globally (100 req / 15 min per IP). Auth endpoints have a stricter limit (10 req / 15 min). Public QR endpoints are limited to 30 req / min.

---

## Authentication

### POST /auth/login

Login with username and password.

**Request**

```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response 200**

Sets `auth_token` HttpOnly cookie. Returns the user object.

```json
{
  "user": {
    "staffId": "64a...",
    "restaurantId": "64b...",
    "role": "Admin",
    "permissions": ["ADMIN"],
    "name": "Administrador"
  }
}
```

**Errors**

| Code | Reason |
|------|--------|
| 400 | Validation error (missing fields) |
| 401 | Invalid credentials |
| 429 | Too many attempts |

---

### POST /auth/pin

Login with a 4-digit PIN code.

**Request**

```json
{
  "pin_code": "1234",
  "restaurant_id": "64b..."
}
```

**Response 200** — same as `/auth/login`

---

### POST /auth/logout

Clear the session cookie.

**Response 200**

```json
{ "message": "Logged out" }
```

---

## Dishes

### GET /dishes

List all dishes and categories for the authenticated staff's restaurant.

**Auth:** Required

**Response 200**

```json
{
  "categories": [
    { "_id": "...", "category_name": { "es": "Entrantes" } }
  ],
  "dishes": [
    {
      "_id": "...",
      "dish_name": { "es": "Ensalada", "en": "Salad" },
      "dish_base_price": 8.5,
      "category_id": "...",
      "variants": [],
      "extras": [],
      "allergens": []
    }
  ]
}
```

---

### POST /dishes/categories

Create a category.

**Auth:** Required (ADMIN)

**Request**

```json
{
  "category_name": { "es": "Postres", "en": "Desserts" }
}
```

**Response 201** — created category object

---

### POST /dishes

Create a dish.

**Auth:** Required (ADMIN)

**Request** — validated by Zod dish schema

---

## Orders

### POST /orders

Create a new order linked to a totem session.

**Auth:** Required

**Request**

```json
{
  "session_id": "64c...",
  "customer_id": "64d..."
}
```

**Response 201** — order object

---

### POST /orders/items

Add an item to an existing order.

**Auth:** Required

**Request**

```json
{
  "order_id": "64e...",
  "dish_id": "64f...",
  "item_quantity": 2,
  "item_base_price": 8.5,
  "item_name_snapshot": { "es": "Ensalada" },
  "variant_id": null,
  "extras": []
}
```

**Response 201** — created item order object

---

### PATCH /orders/items/:id/state

Advance the state of an order item.

**Auth:** Required

**Item state machine**

```
ORDERED -> ON_PREPARE -> SERVED
                      -> CANCELED (from any state)
```

**Request**

```json
{ "state": "ON_PREPARE" }
```

**Response 200** — updated item order object

**Errors**

| Code | Reason |
|------|--------|
| 400 | Invalid state transition |
| 404 | Item not found |

---

### GET /orders/kitchen

List all active kitchen items (state `ORDERED` or `ON_PREPARE`) for the restaurant.

**Auth:** Required (KTS)

**Response 200** — array of item order objects

---

### POST /orders/payments

Record a payment for an order.

**Auth:** Required (POS)

**Request**

```json
{
  "order_id": "64e...",
  "payment_method": "CASH",
  "amount_paid": 20.00
}
```

**Response 201** — payment object

---

## Totems

### GET /totems

List all totems for the restaurant.

**Auth:** Required (ADMIN)

---

### POST /totems

Create a totem. A unique QR token is generated automatically.

**Auth:** Required (ADMIN)

**Request**

```json
{
  "totem_name": "Table 5"
}
```

**Response 201** — totem object including `totem_qr`

---

### PATCH /totems/:id

Update a totem.

**Auth:** Required (ADMIN)

---

### DELETE /totems/:id

Delete a totem. All active sessions are closed before deletion.

**Auth:** Required (ADMIN)

**Response 204**

---

### POST /totems/:id/regenerate-qr

Generate a new QR token, invalidating the previous one.

**Auth:** Required (ADMIN)

**Response 200**

```json
{ "qr": "new-uuid-token" }
```

---

### POST /totems/:totemId/session

Start a totem session. If an active session already exists it is returned.

**Auth:** Required

**Response 201** — session object

---

### GET /totems/menu/:qr

Get totem info by QR token. Public, no auth required.

**Rate limit:** 10 req / 15 min per IP (brute-force protection)

**Response 200** — totem object

**Errors**

| Code | Reason |
|------|--------|
| 404 | QR token not found |
| 429 | Too many requests |

---

### GET /totems/menu/:qr/dishes

Get the full menu (categories + dishes) for the restaurant linked to a QR token. Public, no auth required.

**Rate limit:** 30 req / min per IP

**Response 200**

```json
{
  "categories": [...],
  "dishes": [...]
}
```

---

## Restaurant

### GET /restaurant

Get the restaurant configuration for the authenticated user's restaurant.

**Auth:** Required

---

### POST /restaurant

Update restaurant configuration.

**Auth:** Required (ADMIN)

---

## Staff

### GET /staff

List staff members.

**Auth:** Required (ADMIN)

---

### POST /staff

Create a staff member.

**Auth:** Required (ADMIN)

**Request**

```json
{
  "staff_name": "Maria",
  "username": "maria",
  "password": "secure-password",
  "pin_code": "5678",
  "role_id": "64a..."
}
```

**Response 201** — staff object (password fields omitted)

---

## Dashboard

### GET /dashboard

Returns revenue, order counts, and top dishes for the restaurant.

**Auth:** Required (ADMIN)

---

## Uploads

### POST /uploads

Upload an image file. Accepted formats: JPEG, PNG, WebP. The file is resized and stored under `/uploads/`.

**Auth:** Required

**Content-Type:** `multipart/form-data`

**Response 200**

```json
{ "url": "/uploads/abc123.webp" }
```

---

## Health

### GET /health

Returns the server status. Does not require auth.

**Response 200**

```json
{ "status": "ok" }
```

---

## Global Error Format

All errors follow this structure:

```json
{
  "error": "Human-readable message"
}
```

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Validation error |
| 401 | Not authenticated or token expired |
| 403 | Authenticated but insufficient permissions |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## WebSocket — KDS

Connect to Socket.IO with `withCredentials: true`. The `auth_token` cookie is sent automatically during the handshake.

The KDS namespace requires the `KTS` permission.

### Client-to-server events

| Event | Payload | Description |
|-------|---------|-------------|
| `kds:join` | `sessionId: string` | Subscribe to a session room |
| `kds:item_prepare` | `{ itemId: string }` | Transition item to `ON_PREPARE` |
| `kds:item_serve` | `{ itemId: string }` | Transition item to `SERVED` |

### Server-to-client events

| Event | Payload | Description |
|-------|---------|-------------|
| `kds:joined` | `{ sessionId }` | Room join confirmed |
| `kds:new_item` | item object | New item entered the kitchen |
| `item:state_changed` | `{ itemId, newState }` | An item's state changed |
| `kds:error` | `{ message, ... }` | Error from a previous action |

### POS client-to-server events

| Event | Payload | Description |
|-------|---------|-------------|
| `pos:join` | `sessionId: string` | Subscribe to session updates |
| `pos:leave` | `sessionId: string` | Unsubscribe |
