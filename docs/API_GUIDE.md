# Guía de Referencia de la API Disher.io

Esta documentación detalla los endpoints REST y los eventos de WebSocket disponibles para interactuar con la plataforma Disher.io.

---

## 1. Convenciones Generales

### Autenticación y Sesiones
El sistema utiliza **cookies httpOnly** para la gestión de sesiones. Tras una autenticación exitosa, el servidor emite una cookie segura que el navegador incluirá automáticamente en las solicitudes posteriores. No se requiere la gestión manual de tokens en el frontend.

### Control de Concurrencia
Para garantizar la integridad de los datos en entornos multi-usuario, todas las actualizaciones de estado críticas (pedidos, configuración del restaurante) utilizan **Optimistic Concurrency Control (OCC)** mediante el campo `__v`. Si se intenta actualizar un recurso que ha sido modificado previamente por otro usuario, la API devolverá un error de conflicto.

### Roles de Usuario
- **`admin`**: Acceso total a todos los recursos y configuraciones.
- **`waiter`**: Acceso a la gestión de mesas y pedidos activos.
- **`kitchen`**: Acceso exclusivo al sistema de gestión de cocina (KDS).
- **`pos`**: Acceso a la gestión de cobros e historial de tickets.

---

## 2. Endpoints de Autenticación

### Inicio de Sesión
`POST /api/auth/login`
Autentica al personal del restaurante y establece la cookie de sesión.

**Cuerpo de la Solicitud:**
```json
{
  "username": "nombre_usuario",
  "password": "contraseña_segura"
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "username": "nombre_usuario",
  "role": "admin"
}
```

### Cierre de Sesión
`POST /api/auth/logout`
Invalida la cookie de sesión actual. No requiere cuerpo de solicitud.

---

## 3. Configuración del Restaurante

### Obtener Información Global
`GET /api/restaurant`
Retorna la configuración completa del establecimiento (branding, facturación, mesas). Endpoint público.

### Actualizar Configuración
`PATCH /api/restaurant` (Requiere rol: **Admin**)
Permite la modificación parcial o total de la identidad visual y parámetros de facturación. Dispara el evento `config-updated` vía WebSocket.

### Carga de Logotipo
`POST /api/upload-logo` (Requiere rol: **Admin**)
Procesa y optimiza el logotipo del restaurante. Convierte la imagen a formato WebP y ajusta dimensiones.

---

## 4. Gestión de Pedidos

### Listar Pedidos Activos
`GET /api/orders` (Requiere autenticación)
Retorna todos los pedidos en estado `active`, ordenados cronológicamente por fecha de creación.

### Creación de Pedido
`POST /api/orders`
Utilizado tanto por clientes (autoservicio) como por personal de sala para la creación de un nuevo ciclo de pedido.

**Estructura del Ítem de Pedido:**
```json
{
  "name": "Nombre del Producto",
  "price": 10.50,
  "quantity": 1,
  "status": "pending",
  "isCustom": false,
  "selectedVariant": { "name": "Grande", "priceAddon": 2.00 }
}
```

### Actualización de Estado de Ítem
`PATCH /api/orders/:orderId/items/:itemId`
Permite modificar el estado granular de un plato individual (ej. de `pending` a `preparing`).

---

## 5. Eventos en Tiempo Real (Socket.io)

El sistema emite eventos broadcast a todos los terminales conectados para asegurar la sincronización de la interfaz.

| Evento | Descripción | Payload |
| :--- | :--- | :--- |
| `order-update` | Notifica la creación de un nuevo pedido. | Objeto `IOrder` completo. |
| `order-updated` | Notifica cualquier cambio en el estado de un pedido o sus ítems. | Objeto `IOrder` actualizado. |
| `menu-update` | Notifica cambios en el catálogo de productos o disponibilidad. | Objeto `IMenuItem` o ID del ítem eliminado. |
| `config-updated` | Notifica cambios globales en la configuración del sistema. | Objeto `IRestaurant` actualizado. |

---

## 6. Manejo de Errores

Todas las respuestas de error siguen una estructura estandarizada:

```json
{
  "error": "Descripción legible del error",
  "status": 400,
  "requestId": "timestamp-uuid"
}
```

### Códigos de Estado Comunes
- **400 Bad Request**: Datos de entrada malformados o inválidos.
- **401 Unauthorized**: Sesión expirada o token inexistente.
- **403 Forbidden**: El usuario no posee los privilegios necesarios para la acción.
- **404 Not Found**: El recurso solicitado no existe.
- **429 Too Many Requests**: Límite de intentos de acceso superado.
- **500 Internal Server Error**: Error inesperado en el procesamiento del servidor.
