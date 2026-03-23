# Referencia de API de Disher.io

**Versión:** 1.2
**Arquitectura:** Single-tenant — todos los endpoints operan sobre una única instancia de restaurante.
**Integridad:** Todos los cambios de estado críticos están protegidos por **Control de Concurrencia Optimista (OCC)** usando el campo `__v`.

---

## URL Base

| Entorno | URL Base |
|---------|----------|
| Desarrollo | `http://localhost:3000/api` |
| Producción | `https://tudominio.com/api` |

---

## Autenticación

La autenticación usa **cookies httpOnly**. El token se establece automáticamente por el servidor al iniciar sesión y es enviado por el navegador en cada petición posterior — no se requiere manejo manual del token.

---

## Endpoints de Autenticación

### POST /auth/login
Inicia sesión y establece la cookie de sesión.

**Request Body:**
```json
{
  "username": "admin",
  "password": "tu_contraseña"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "admin",
    "role": "admin"
  }
}
```

### POST /auth/logout
Cierra sesión y elimina la cookie.

**Response:**
```json
{
  "success": true
}
```

---

## Endpoints de Restaurant

### GET /restaurant
Obtiene la configuración completa del restaurante.

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "Mi Restaurante",
  "phone": "+34 900 123 456",
  "website": "https://mirestaurante.com",
  "theme": "midnight",
  "vat": 21,
  "tipEnabled": true,
  "tipPercentage": 5,
  "tipDescription": "La propina es opcional",
  "printers": [...],
  "__v": 0
}
```

### PUT /restaurant
Actualiza la configuración del restaurante.

**Request Body:**
```json
{
  "name": "Mi Restaurante Actualizado",
  "phone": "+34 900 123 456",
  "vat": 21,
  "__v": 0
}
```

**Response:**
```json
{
  "success": true,
  "restaurant": { /* configuración actualizada */ }
}
```

---

## Endpoints de Menú

### GET /menu
Obtiene todo el menú con categorías y platos.

**Response:**
```json
{
  "categories": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Entrantes",
      "order": 1,
      "items": [...]
    }
  ]
}
```

### POST /menu/categories
Crea una nueva categoría.

**Request Body:**
```json
{
  "name": "Postres",
  "order": 3
}
```

### PUT /menu/categories/:id
Actualiza una categoría.

### DELETE /menu/categories/:id
Elimina una categoría.

### POST /menu/items
Crea un nuevo plato.

**Request Body:**
```json
{
  "name": "Ensalada César",
  "description": "Lechuga, pollo, parmesano",
  "price": 8.50,
  "category": "507f1f77bcf86cd799439011",
  "allergens": ["gluten", "lacteos"],
  "available": true
}
```

---

## Endpoints de Pedidos

### GET /orders
Obtiene todos los pedidos (con filtros opcionales).

**Query Parameters:**
- `status`: `pending`, `confirmed`, `ready`, `delivered`, `cancelled`
- `table`: ID de la mesa

**Response:**
```json
{
  "orders": [
    {
      "id": "507f1f77bcf86cd799439011",
      "table": "mesa-1",
      "status": "pending",
      "items": [...],
      "total": 25.50,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "__v": 0
    }
  ]
}
```

### POST /orders
Crea un nuevo pedido.

**Request Body:**
```json
{
  "table": "mesa-1",
  "items": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "quantity": 2,
      "notes": "Sin cebolla"
    }
  ]
}
```

### PUT /orders/:id/status
Actualiza el estado de un pedido.

**Request Body:**
```json
{
  "status": "confirmed",
  "__v": 0
}
```

---

## Endpoints de Mesas

### GET /tables
Obtiene todas las mesas.

**Response:**
```json
{
  "tables": [
    {
      "id": "mesa-1",
      "name": "Mesa 1",
      "qr": "data:image/png;base64,...",
      "active": true
    }
  ]
}
```

### POST /tables
Crea una nueva mesa.

**Request Body:**
```json
{
  "name": "Mesa 5"
}
```

### DELETE /tables/:id
Elimina una mesa.

---

## Endpoints de Usuarios

### GET /users
Obtiene todos los usuarios (requiere rol admin).

**Response:**
```json
{
  "users": [
    {
      "id": "507f1f77bcf86cd799439011",
      "username": "camarero1",
      "role": "waiter",
      "active": true
    }
  ]
}
```

### POST /users
Crea un nuevo usuario.

**Request Body:**
```json
{
  "username": "cocinero1",
  "password": "contraseña123",
  "role": "kitchen"
}
```

---

## Eventos WebSocket

### Conexión
```javascript
const socket = io('wss://tudominio.com');
```

### Eventos Disponibles

#### order:new
Se emite cuando se crea un nuevo pedido.
```json
{
  "type": "order:new",
  "data": { /* pedido completo */ }
}
```

#### order:status
Se emite cuando cambia el estado de un pedido.
```json
{
  "type": "order:status",
  "data": {
    "orderId": "507f1f77bcf86cd799439011",
    "status": "ready"
  }
}
```

#### table:updated
Se emite cuando se actualiza una mesa.
```json
{
  "type": "table:updated",
  "data": { /* mesa actualizada */ }
}
```

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request — datos inválidos |
| 401 | Unauthorized — no autenticado |
| 403 | Forbidden — sin permisos |
| 409 | Conflict — OCC detectado, recarga los datos |
| 500 | Internal Server Error |

---

## Control de Concurrencia (OCC)

Todos los recursos importantes incluyen el campo `__v`. Al actualizar, debes incluir el valor actual:

```json
{
  "name": "Nuevo nombre",
  "__v": 3  // valor actual
}
```

Si `__v` no coincide, recibirás error 409. Debes recargar el recurso y reintentar.
