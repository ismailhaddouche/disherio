# API Reference

> Verified against the current Express route definitions. This document
> describes the current implementation; Zod schemas in `shared/schemas` and
> route/controller code remain the executable source of truth.

**Base URL:** `/api`

All protected endpoints require a valid session. Authentication uses the
HttpOnly `auth_token` and `refresh_token` cookies. Browsers send them
automatically. Non-browser API clients may send an access token through
`Authorization: Bearer <token>`.

Rate limiting applies globally (1000 requests per 15 minutes). Authentication
allows 5 failed attempts per 15 minutes, strict mutations allow 20 requests per
15 minutes, uploads allow 10 requests per hour, public QR traffic allows 30
requests per minute, and QR probing allows 10 attempts per 15 minutes.

## Current HTTP route inventory

| Area | Methods and paths |
|------|-------------------|
| Authentication | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| Dishes | `GET /dishes`, `GET /dishes/:id`, `POST /dishes`, `PATCH /dishes/:id`, `DELETE /dishes/:id`, `PATCH /dishes/:id/toggle` |
| Categories | `GET /dishes/categories`, `GET /dishes/categories/:id`, `POST /dishes/categories`, `PATCH /dishes/categories/:id`, `DELETE /dishes/categories/:id` |
| Orders | `GET /orders/kitchen`, `GET /orders/service-items`, `GET /orders/session/:sessionId`, `POST /orders`, `POST /orders/items`, `POST /orders/items/batch`, `PATCH /orders/items/:id/state`, `PATCH /orders/items/:id/assign`, `DELETE /orders/items/:id` |
| Payments | `GET /orders/payments/history`, `POST /orders/payments`, `PATCH /orders/payments/:id/ticket` |
| Public totem | `GET /totems/menu/:qr`, `GET /totems/menu/:qr/dishes`, `POST /totems/menu/:qr/session`, `POST /totems/menu/:qr/order`, `GET|POST /totems/menu/:qr/session/:sessionId/customers`, `GET /totems/menu/:qr/session/:sessionId/orders`, `GET /totems/menu/:qr/session/:sessionId/customers/:customerId/orders` |
| Protected totem | `GET|POST /totems`, `GET|PATCH|DELETE /totems/:id`, `POST /totems/:id/regenerate-qr`, `POST /totems/:totemId/session`, `GET /totems/:totemId/sessions` |
| Totem sessions | `GET /totems/sessions/active`, `POST /totems/sessions/:sessionId/close`, `POST /totems/sessions/:sessionId/reopen`, `POST /totems/sessions/:sessionId/archive`, `POST /totems/sessions/:sessionId/cancel` |
| Restaurant | `GET|PATCH /restaurant/me`, `GET|PATCH /restaurant/settings` |
| Staff and roles | `GET /staff`, `GET|PATCH|DELETE /staff/:id`, `POST /staff`, `GET /staff/me/profile`, `PATCH /staff/me/preferences`, `GET /staff/roles/all`, `POST /staff/roles` |
| Customers | `GET /customers/session/:sessionId`, `POST /customers`, `DELETE /customers/:id` |
| Dashboard | `GET /dashboard/stats`, `GET /dashboard/popular-dishes`, `GET /dashboard/category-stats`, `GET /dashboard/realtime`, `GET /dashboard/logs`, `GET /dashboard/logs/users` |
| Uploads | `POST /uploads/dishes/:id`, `POST /uploads/categories/:id`, `POST /uploads/restaurant` |

The dashboard log routes return the latest recorded activity for each order
item. They are an operational view, not an immutable security audit trail.

Operational endpoints are outside `/api`: `GET /health`, `/health/ready`,
`/health/live`, `/health/simple`, and the internal metrics endpoint
`GET /metrics`. The metrics response uses Prometheus exposition format, but the
repository does not bundle a collector, dashboard, Alertmanager, or exporters,
and Caddy does not route this endpoint publicly.

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

Sets the `auth_token` and `refresh_token` HttpOnly cookies. Returns the user
object without either raw token.

```json
{
  "user": {
    "staffId": "64a...",
    "restaurantId": "64b...",
    "role": "Admin",
    "permissions": ["ADMIN"],
    "name": "Administrador"
  },
  "expires_in_ms": 900000
}
```

**Errors**

| Code | Reason |
|------|--------|
| 400 | Validation error (missing fields) |
| 401 | Invalid credentials |
| 429 | Too many attempts |

---

### POST /auth/refresh

Rotate the HttpOnly refresh token cookie and issue a new access cookie. The
opaque refresh token is looked up in Redis by its SHA-256 hash under the key
`refresh:<staffId>:<hash>`; a Redis-side atomic operation consumes the old
token, records its family tombstone, and issues a new one in the same family.
Reuse of an already-consumed token
revokes the entire family. Refresh tokens supplied in the request body are
rejected. Concurrent 401 responses are coalesced into one refresh request by
the frontend, then the original requests are retried.

**Response 200** — same shape as `/auth/login`.

---

### POST /auth/logout

Clear the session cookie.

**Response 200**

```json
{ "message": "LOGOUT_SUCCESS" }
```

---

## Dishes

### GET /dishes

List the dishes of the authenticated staff's restaurant, paginated.

**Auth:** Required

**Query params:** `page` (default 1) and `limit` (default 50, max 100)

**Response 200**

Localized fields are arrays of `{ "lang", "value" }` entries. `lang` is an app
language code (`es` | `en` | `fr`) aligned with the restaurant's
`enabled_languages`. Categories are not embedded here; they are listed
separately through `GET /dishes/categories`, which returns an array of
category objects.

```json
{
  "data": [
    {
      "_id": "...",
      "restaurant_id": "...",
      "category_id": "...",
      "disher_name": [{ "lang": "es", "value": "Ensalada" }, { "lang": "en", "value": "Salad" }],
      "disher_description": [{ "lang": "es", "value": "Con tomate" }],
      "disher_url_image": "/uploads/abc123.webp",
      "disher_status": "ACTIVATED",
      "disher_price": 8.5,
      "disher_type": "KITCHEN",
      "disher_alergens": ["gluten"],
      "disher_variant": false,
      "variants": [],
      "extras": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### POST /dishes/categories

Create a category.

**Auth:** Required (permission to create `Category`)

**Request** — validated by `CategorySchema`; `restaurant_id` is taken
from the authenticated staff token, not from the body

```json
{
  "category_name": [{ "lang": "es", "value": "Postres" }, { "lang": "en", "value": "Desserts" }],
  "category_order": 0,
  "category_description": [{ "lang": "es", "value": "Dulces y helados" }],
  "category_image_url": "https://example.com/postres.webp",
  "unlimited_orders": false
}
```

Only `category_name` is required. `category_order` defaults to `0` and
`unlimited_orders` defaults to `false`.

**Response 201** — created category object

---

### POST /dishes

Create a dish.

**Auth:** Required (ADMIN)

**Request** — validated by Zod dish schema

Full dish creation and `PATCH /dishes/:id` require administrative dish
management. KTS accounts may read dishes and use only `PATCH
/dishes/:id/toggle`, which changes availability without accepting price,
category, content, variant, extra, or image fields. Dish creation and updates
reject a `category_id` that belongs to another restaurant.

---

## Orders

### POST /orders

Create a new order linked to a totem session.

**Auth:** Required (permission to create `Order`)

**Request** — `session_id` is the only accepted field

```json
{
  "session_id": "64c..."
}
```

**Response 201** — order object

---

### POST /orders/items

Add an item to an existing order. The name and price are snapshotted on
the server from the current dish; the client does not send them.

**Auth:** Required (permission to create `ItemOrder`)

**Request** — validated by `AddItemRequestSchema`

```json
{
  "order_id": "64e...",
  "session_id": "64c...",
  "dish_id": "64f...",
  "customer_id": "64d...",
  "variant_id": "650...",
  "extras": ["651..."]
}
```

`order_id`, `session_id`, and `dish_id` are required ObjectId strings.
`customer_id`, `variant_id`, and `extras` (ObjectId array, max 50) are
optional.

**Response 201** — created item order object

---

### PATCH /orders/items/:id/state

Advance the state of an order item.

**Auth:** Required

**Item state machine**

```
KITCHEN:  ORDERED -> ON_PREPARE -> SERVED
SERVICE:  ORDERED -> SERVED
CANCELED: allowed only from ORDERED (both types) or ON_PREPARE (KITCHEN only)
SERVED and CANCELED are terminal states
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

### POST /orders/items/batch

Create one order and its item batch atomically.

**Auth:** Required (permission to create `ItemOrder`)

**Body**

```json
{
  "request_id": "123e4567-e89b-42d3-a456-426614174000",
  "session_id": "65f...",
  "as_served": false,
  "items": [{ "dishId": "65f...", "quantity": 1, "customerId": "65f...", "variantId": "65f...", "extras": ["65f..."] }]
}
```

`request_id` is a required UUID idempotency key scoped to `session_id`. Reusing
the same key and payload returns the originally persisted order and items and
does not emit duplicate real-time events. Reusing the key with a different
payload returns `409 IDEMPOTENCY_CONFLICT`.

**Response 201** — `{ "orderId": "...", "items": [...] }`

---

### POST /orders/payments

Create the payment and ticket breakdown for an active or completed session. If
the session is active, it is closed in the same transaction and closure events
are emitted only after commit. The session
remains visible until every ticket is paid or `POST
/totems/sessions/:sessionId/archive` archives it.

**Auth:** Required (POS or TAS with permission to create `Payment`)

**Request**

```json
{
  "session_id": "64e...",
  "payment_type": "ALL",
  "parts": 1,
  "tips": 0
}
```

**Response 201** — payment object. New payments include `restaurant_id` and a
`totem_snapshot` (`totem_id`, `totem_name`, and `totem_type`) for durable
history. `BY_USER` excludes cancelled items and allocates the complete payable
total, including tips and cent rounding, proportionally across customer tickets;
the ticket amounts always sum exactly to `payment_total`.

---

### GET /totems/sessions/active

List the restaurant's operational sessions. The response includes `STARTED`
sessions and `COMPLETE` sessions awaiting payment or archive; terminal `PAID`
and `CANCELLED` sessions are excluded.

**Auth:** Required (permission to read `TotemSession`)

**Response 200** — array of session objects with attached totem data,
`order_limit_status`, and `item_count`. `item_count` is the number of
non-cancelled items in the session and lets POS/TAS render every sidebar row
without loading each session's item list.

---

### POST /totems/sessions/:sessionId/close

Move an active session from `STARTED` to `COMPLETE`. The session remains in
the POS/TAS operational views as pending payment and can be reopened or
archived.

**Auth:** Required (POS or TAS with permission to update `TotemSession`)

**Response 200** — session with `totem_state: "COMPLETE"`

---

### POST /totems/sessions/:sessionId/reopen

Move a completed session back to `STARTED` and rotate its public
`session_token`. Reopening is rejected after any payment record exists.

**Auth:** Required (POS or TAS with permission to update `TotemSession`)

**Response 200** — session with `totem_state: "STARTED"`

---

### POST /totems/sessions/:sessionId/archive

Archive a completed session as paid. If no payment breakdown exists, the
backend creates a single full-payment ticket first. Ticket settlement, any new
payment, and the `COMPLETE -> PAID` transition are committed together. The session is
removed from active POS/TAS views but remains available through
`GET /orders/payments/history`. Payment history retains a table snapshot so a
temporary totem can be deleted without losing its historical entry.

**Auth:** Required (POS or TAS with permission to update `TotemSession`)

**Response 200** — archived session with `totem_state: "PAID"`

---

### POST /totems/sessions/:sessionId/cancel

Cancel a `STARTED` session that has no items. Cancellation moves it to
`CANCELLED`, removes it from active POS/TAS views, and does not create a
payment-history entry. A temporary totem is deleted after cancellation.

**Auth:** Required (POS or TAS with permission to update `TotemSession`)

**Response 200** — session with `totem_state: "CANCELLED"`

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

Delete a totem. Deletion is rejected while the totem has an operational
(`STARTED` or `COMPLETE`) session; close or cancel that session first.

**Auth:** Required (ADMIN)

**Response 204**

**Errors**

| Code | Reason |
|------|--------|
| 409 | `ACTIVE_SESSION_EXISTS` — the totem still has an operational session |

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

### POST /totems/menu/:qr/session

Get or create the active session for the totem identified by the QR token. Public, no auth required.

If the table already has a `STARTED` session, every scanner joins that session.
If it has no active session, a fresh session is created even when older
`COMPLETE`, `PAID`, or `CANCELLED` sessions exist.

**Rate limit:** 30 req / min per IP

**Response 200 / 201**

```json
{
  "session_id": "65f...",
  "totem_id": "65f...",
  "totem_name": "Table 5",
  "restaurant_id": "65f...",
  "totem_state": "STARTED",
  "session_token": "ephemeral-per-session-credential",
  "order_limit_status": { ... }
}
```

The printed QR is the bearer credential that bootstraps public access. The returned `session_token` binds subsequent calls to the current session and prevents reuse after close/reopen. The client keeps it in per-tab session storage; it must never be placed in a URL. The client echoes it on every subsequent public call and on the `totem:join_session` socket event.

When the entry point is restricted to the trusted restaurant LAN, that network
boundary prevents use from outside the LAN as long as no tunnel, forwarding, or
public reverse proxy exists. On an Internet-facing server, including a public
cloud deployment, possession of the static QR is sufficient to reach this
bootstrap endpoint; neither TLS nor `session_token` proves physical presence.
Deployments that require proximity enforcement need an additional
session-specific code, POS/TAS approval, or trusted local-network assertion.
Those presence gates are not part of the current API.

---

### POST /totems/menu/:qr/order

Create an order with items for the active session. Public, no auth required.

**Rate limit:** 30 req / min per IP

**Body**

```json
{
  "request_id": "123e4567-e89b-42d3-a456-426614174000",
  "session_id": "65e...",
  "items": [{ "dishId": "...", "quantity": 1, "variantId": "...", "extras": ["..."] }],
  "customer_id": "65f...",
  "session_token": "ephemeral-per-session-credential"
}
```

`session_id` and `session_token` are required and must match the active session
returned by `POST /totems/menu/:qr/session`. This endpoint never creates a new
session when the supplied credentials are stale or invalid.
`request_id` is a required UUID idempotency key scoped to the active session.
Reusing it with the same payload returns the original order and items without
duplicate real-time events; using it with a different payload returns `409
IDEMPOTENCY_CONFLICT`.

**Response 201** — `{ "order_id": "...", "items": [...] }`

---

### POST /totems/menu/:qr/session/:sessionId/customers

Create a customer for a session. Public, no auth required.

**Rate limit:** 30 req / min per IP

**Body**

```json
{ "customer_name": "Alice", "session_token": "ephemeral-per-session-credential" }
```

`session_token` is required.

**Response 201** — `{ "customer_id": "...", "customer_name": "Alice", "session_id": "..." }`

---

### GET /totems/menu/:qr/session/:sessionId/customers

List customers for a session. Public, no auth required.

**Rate limit:** 30 req / min per IP

**Header:** `x-session-token: <ephemeral-per-session-credential>` (required)

---

### GET /totems/menu/:qr/session/:sessionId/orders

List all items for a session. Public, no auth required.

**Rate limit:** 30 req / min per IP

**Header:** `x-session-token: <ephemeral-per-session-credential>` (required)

---

### GET /totems/menu/:qr/session/:sessionId/customers/:customerId/orders

List items for a specific customer. Public, no auth required.

**Rate limit:** 30 req / min per IP

**Header:** `x-session-token: <ephemeral-per-session-credential>` (required)

---

## Totem Socket Events

All `totem:*` socket events require a socket that has successfully joined a session via `totem:join_session`. Authenticated staff sockets are rejected (`FORBIDDEN`) from totem events.

Public totem connections connect with handshake `auth = { publicTotem: true, qr: '<totem QR token>' }`; the server validates the QR against the database at handshake time and rejects connections with an unknown QR (or a missing QR). The per-session `session_token` is still re-validated on every `totem:*` event.

### totem:join_session

Join a session room. The `sessionToken` is required and validated against the session's stored token.

**Payload**

```json
{ "sessionId": "...", "qr": "...", "customerName": "Alice", "customerId": "...", "sessionToken": "..." }
```

### totem:request_bill, totem:call_waiter, totem:subscribe_items, totem:get_table_info, totem:get_my_orders

All require the socket to be bound to an active session (verified at join time).
No additional token or customer identity field is accepted: the server
re-validates the bound token and obtains the customer identity from the socket
binding on every event.

## Restaurant

### GET /restaurant/me

Get the restaurant configuration for the authenticated user's restaurant.

**Auth:** Required

---

### PATCH /restaurant/me

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
  "role_id": "64a..."
}
```

**Response 201** — staff object (password fields omitted)

`username` is unique within the restaurant.

---

## Dashboard

### GET /dashboard/stats

Returns revenue, order counts, and top dishes for the restaurant.

**Auth:** Required (ADMIN)

---

## Uploads

### POST /uploads/dishes/:id

Upload a dish image. Category and restaurant-logo uploads use
`POST /uploads/categories/:id` and `POST /uploads/restaurant`. Dish and category
identifiers must belong to the authenticated restaurant. Accepted formats are
JPEG, PNG, and WebP. The image is validated, resized, converted to WebP, and
stored under `/uploads/`.

**Auth:** Required

**Content-Type:** `multipart/form-data`

**Response 201**

```json
{ "url": "/uploads/abc123.webp" }
```

---

## Health

### GET /health

Returns the overall status plus MongoDB, Redis, disk, and memory checks. It
returns `503` when the service is unhealthy and does not require authentication.
Use `/health/ready` for traffic readiness, `/health/live` for process liveness,
and `/health/simple` only for lightweight compatibility checks.

---

## Error Formats

Errors that reach the global handler use this structure:

```json
{
  "error": "Human-readable localized message",
  "errorCode": "VALIDATION_ERROR",
  "status": 400,
  "details": {}
}
```

`details` is present only when an operational error supplies structured detail.
Zod body-validation failures are returned directly by the validation middleware
as `{ "errors": { "field": ["message"] } }`. Rate-limit responses include
`error`, `errorCode`, and `retryAfter`. Authentication endpoints can return an
`errorCode`-only `401` when no valid refresh credential is available.

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

The KDS namespace requires the `KTS` permission. An authenticated KDS socket
automatically joins its restaurant discovery room so the first kitchen item of
a new session is delivered; `kds:join` adds the session-scoped subscription.

### Client-to-server events

| Event | Payload | Description |
|-------|---------|-------------|
| `kds:join` | `sessionId: string` | Subscribe to a session room |
| `kds:leave` | `sessionId: string` | Leave a session room |
| `kds:item_prepare` | `{ itemId: string }` | Transition item to `ON_PREPARE` |
| `kds:item_cancel` | `{ itemId: string, reason?: string }` | Cancel an active item |
| `kds:item_serve` | `{ itemId: string }` | Transition item to `SERVED` |

### Server-to-client events

| Event | Payload | Description |
|-------|---------|-------------|
| `kds:joined` | `{ sessionId }` | Room join confirmed |
| `kds:left` | `{ sessionId }` | Room leave confirmed |
| `kds:item_prepared` | `{ itemId, newState }` | Preparation confirmed |
| `kds:item_canceled` | `{ itemId, newState }` | Cancellation confirmed |
| `kds:item_served` | `{ itemId, newState }` | Service confirmed |
| `kds:new_item` | item object | New item entered the kitchen |
| `item:state_changed` | `{ itemId, newState }` | An item's state changed |
| `kds:error` | `{ message, ... }` | Error from a previous action |

### POS client-to-server events

| Event | Payload | Description |
|-------|---------|-------------|
| `pos:join` | `sessionId: string` | Subscribe to session updates |
| `pos:leave` | `sessionId: string` | Unsubscribe |

### POS server-to-client events

| Event | Payload | Description |
|-------|---------|-------------|
| `pos:error` | `{ message, details? }` | Error from a previous action |
| `pos:customer_bill_request` | `{ sessionId, customerId?, customerName?, splitType, requestedBy, timestamp }` | Customer requested the bill from the totem |

### Generic session-room events

POS (`pos:join`), TAS (`tas:join`), KDS (`kds:join`), and totem customers
(`totem:subscribe_items`) all subscribe to the `session:<sessionId>` room
and receive these item lifecycle events:

| Event | Payload | Description |
|-------|---------|-------------|
| `item:state_changed` | `{ itemId, newState }` | An item's state changed |
| `item:deleted` | `{ itemId }` | An `ORDERED` item was removed |
| `item:canceled` | `{ itemId, newState, canceledBy, staffId, timestamp }` | An item was canceled |
| `item:customer_assigned` | `{ itemId, customerId }` | An item was assigned to (or, with `customerId: null`, unassigned from) a customer |

---

## WebSocket — Totem (Customer)

For customers using totems or mobile devices to place orders.

### Client-to-server events

| Event | Payload | Description |
|-------|---------|-------------|
| `totem:join_session` | `{ sessionId: string, qr: string, sessionToken: string, customerName?: string, customerId?: string }` | Join the session scoped by its QR and session credentials |
| `totem:leave_session` | - | Leave current session |
| `totem:call_waiter` | `{ sessionId, tableId?, message? }` | Request help as the customer bound at join time |
| `totem:request_bill` | `{ sessionId, splitType? }` | Request bill as the customer bound at join time |
| `totem:subscribe_items` | `{ sessionId: string }` | Subscribe to item state updates |
| `totem:get_table_info` | `{ sessionId: string }` | Get info about who's at the table |
| `totem:get_my_orders` | `{ sessionId: string }` | Get orders placed by this customer |

### Server-to-client events

| Event | Payload | Description |
|-------|---------|-------------|
| `totem:session_joined` | `{ sessionId, customerName?, customerId?, otherCustomersAtTable[], timestamp }` | Successfully joined session |
| `totem:session_left` | `{ sessionId }` | Left session |
| `totem:help_request_sent` | `{ success, message, timestamp }` | Help request sent |
| `totem:bill_request_sent` | `{ success, message, timestamp }` | Bill request sent |
| `totem:items_subscribed` | `{ sessionId }` | Subscribed to updates |
| `totem:table_info` | `{ sessionId, customersAtTable[], totalCustomers, myCustomerId?, myCustomerName?, timestamp }` | Table info with all customers |
| `totem:my_orders` | `{ sessionId, customerId, orders, totalOrders, timestamp }` | Orders for the bound customer |
| `totem:customer_joined_table` | `{ sessionId, customerId?, customerName, joinedAt }` | Another customer joined |
| `totem:customer_left_table` | `{ sessionId, customerId?, customerName, leftAt }` | A customer left |
| `totem:session_closed` | `{ sessionId, closedBy, closedByName?, totalAmount?, reason?, message, timestamp }` | Session closed (bill requested) |
| `totem:force_disconnect` | `{ reason, message }` | Force disconnect after session closed |
| `order:item_update` | `{ itemId, newState, itemName?, timestamp }` | Item state changed |
| `order:items_added` | `{ items[], addedBy, addedByCustomerId?, timestamp }` | New items added to order |
| `item:state_changed` | `{ itemId, newState }` | Item state changed (generic) |
| `item:canceled` | `{ itemId, itemName, reason }` | An item was canceled |
| `notification:from_waiter` | `{ message, from, type, timestamp }` | Message from waiter |
| `totem:error` | `{ message, details?, closedBy?, closedAt? }` | Error occurred (includes SESSION_CLOSED) |

---

## WebSocket — TAS (Table Assistance Service)

Requires the `TAS` permission.

### Client-to-server events

| Event | Payload | Description |
|-------|---------|-------------|
| `tas:join` | `sessionId: string` | Join TAS session room |
| `tas:leave` | `sessionId: string` | Leave TAS session room |
| `tas:add_item` | `{ sessionId, orderId, dishId, customerId?, variantId?, extras?, itemData }` | Add item to order |
| `tas:serve_service_item` | `{ itemId: string }` | Mark SERVICE item as served |
| `tas:cancel_item` | `{ itemId: string, reason?: string }` | Cancel an item |
| `tas:request_bill` | `{ sessionId, requestedBy, customerId?, splitType? }` | Request bill |
| `tas:call_waiter_response` | `{ sessionId, acknowledged, message? }` | Acknowledge customer call |
| `tas:notify_customers` | `{ sessionId, message, type? }` | Notify customers at table |

### Server-to-client events (TAS)

| Event | Payload | Description |
|-------|---------|-------------|
| `tas:joined` | `{ sessionId, timestamp }` | Room join confirmed |
| `tas:left` | `{ sessionId }` | Room leave confirmed |
| `tas:item_added_confirm` | `{ success, sessionId, item, timestamp }` | Add-item request confirmed |
| `item:added` | `{ item, addedBy, staffId, timestamp }` | Item added in the joined session |
| `tas:service_item_served` | `{ itemId, sessionId, servedBy, timestamp }` | SERVICE item served |
| `tas:item_served_confirm` | `{ success, itemId, newState }` | Serve-item request confirmed |
| `tas:item_canceled` | `{ itemId, sessionId, canceledBy, reason, timestamp }` | Item canceled |
| `tas:item_canceled_confirm` | `{ success, itemId }` | Cancel-item request confirmed |
| `tas:bill_requested` | `{ sessionId, requestedBy, customerId?, splitType?, timestamp }` | Bill requested |
| `tas:bill_request_confirm` | `{ success, sessionId }` | Bill request confirmed |
| `tas:call_acknowledged_confirm` | `{ success, sessionId }` | Waiter acknowledgement confirmed |
| `tas:notify_confirm` | `{ success, sessionId }` | Customer notification confirmed |
| `tas:new_customer_order` | `{ item, sessionId, timestamp }` | New order from customer |
| `tas:customer_bill_request` | `{ sessionId, customerName?, timestamp }` | Customer requests bill |
| `tas:help_requested` | `{ sessionId, customerName?, tableId?, timestamp }` | Customer requests help |
| `tas:customer_joined` | `{ sessionId, customerName, customerId?, totalCustomersAtTable, timestamp }` | Customer joined the table session |
| `tas:customer_left` | `{ sessionId, customerId?, customerName?, remainingCustomers, timestamp }` | Customer left or disconnected |
| `tas:error` | `{ message, details? }` | Error from a previous action |

### Server-to-client events (from KDS to TAS)

| Event | Payload | Description |
|-------|---------|-------------|
| `tas:kitchen_item_update` | `{ itemId, itemName, newState, updatedBy, updatedByName, timestamp }` | Kitchen item state changed |
| `item:state_changed` | `{ itemId, newState, updatedBy?, updatedByStaffId? }` | Item state changed |

### Server-to-client session and payment events

| Event | Payload | Description |
|-------|---------|-------------|
| `pos:session_closed`, `tas:session_closed` | `{ sessionId, state: "COMPLETE" | "CANCELLED", closedBy?, timestamp }` | Session closed for payment or cancelled |
| `pos:session_reopened`, `tas:session_reopened` | `{ sessionId, reopenedBy?, timestamp }` | Session moved from `COMPLETE` back to `STARTED` |
| `pos:session_archived`, `tas:session_archived` | `{ sessionId, paymentTotal, paymentType, timestamp }` | Paid session archived and removed from active views |
| `pos:ticket_paid`, `tas:ticket_paid` | `{ sessionId, ticketPart, ticketAmount, paidBy?, remainingAmount?, timestamp }` | Partial payment (ticket paid) |
| `pos:item_canceled` | `{ itemId, itemName, itemType, canceledBy, canceledByName, reason, timestamp }` | Item canceled by POS/waiter |
| `pos:bill_requested` | `{ sessionId, requestedBy, customerId?, splitType?, timestamp }` | Bill requested |

Close/cancel, reopen, and archive events are sent to both the selected-session
room and the restaurant-scoped POS/TAS room. A connected client therefore
updates its full active-session list even when another session is selected.
Archive is the only terminal paid-session event; the former paid/bill-paid
aliases are not part of the contract.
