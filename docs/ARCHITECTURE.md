# Arquitectura de Disher.io

Este documento describe el diseño del sistema, la interacción entre componentes, los modelos de datos y las decisiones arquitectónicas clave de Disher.io.

---

## Visión General

Disher.io es una aplicación **de inquilino único (single-tenant)**. Un despliegue sirve a un único restaurante. Esta decisión de diseño fue intencional para:

-   Simplificar la configuración y el mantenimiento para los propietarios de restaurantes.
-   Eliminar el riesgo de filtración de datos entre diferentes inquilinos.
-   Permitir el despliegue en hardware mínimo (como una Raspberry Pi).
-   Evitar la complejidad de la gestión de suscripciones o facturación.

Cada restaurante ejecuta su propio stack de Docker de forma aislada.

---

## Arquitectura de Servicios

```
Internet / Red Local
      │
      ▼
┌─────────────────────────────────────────────┐
│               Caddy (Puertos 80/443)        │
│                                             │
│  Rutas:                                     │
│    /api/*        → backend:3000             │
│    /socket.io/*  → backend:3000 (WebSocket) │
│    /*            → frontend:80 (SPA)        │
│                                             │
│  Funcionalidades: Auto-TLS, Compresión      │
└────────────────────┬────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────┐         ┌──────────────────┐
│   Backend    │         │    Frontend      │
│  Node.js 20  │         │   Angular 17     │
│  Express 5   │         │   Nginx (prod)   │
│  Puerto 3000 │         │   Puerto 80      │
└──────┬───────┘         └──────────────────┘
       │
       ├── REST API (/api/*)
       ├── Socket.io (WebSocket)
       │
       ▼
┌───────────────────────────────┐
│  MongoDB 7 (con Autenticación)│
│  Puerto 27017                 │
└───────────────────────────────┘
```

---

## Flujo de Peticiones

El flujo de una petición típica (por ejemplo, un administrador que actualiza el menú) sigue estos pasos:

1.  **Navegador a Caddy:** La petición llega al reverse proxy Caddy.
2.  **Caddy a Frontend:** Caddy sirve la Single-Page Application (SPA) de Angular.
3.  **Frontend a Backend (API):** La aplicación Angular realiza una petición HTTP a `/api/*`.
4.  **Autenticación y Autorización:** El backend valida el token JWT y verifica que el usuario tiene el rol adecuado (ej. `admin`).
5.  **Lógica de Negocio:** El controlador correspondiente procesa la petición.
6.  **Interacción con la Base de Datos:** Se realiza la consulta a MongoDB (con autenticación).
7.  **Respuesta y Evento en Tiempo Real:** El backend devuelve una respuesta JSON y emite un evento por Socket.io para notificar a todos los clientes conectados del cambio.

---

## Stack de Docker y Contenedores

Disher.io utiliza un único archivo `docker-compose.yml` que define todos los servicios, redes y volúmenes.

### Servicios

-   `database` (**Mongo 7**): La base de datos. Ahora requiere autenticación, con credenciales gestionadas por el instalador.
-   `backend` (**Node.js 20**): La API principal. Depende de que la base de datos esté saludable (`service_healthy`).
-   `frontend` (**Nginx**): El cliente web de Angular. Se sirve a través de Nginx.
-   `caddy` (**Caddy 2**): El reverse proxy. Dirige el tráfico al `frontend` o `backend` según corresponda.

### Logging

Todos los servicios están configurados con un **driver de logging `json-file`** que incluye rotación automática. Esto previene el consumo excesivo de disco por parte de los logs.

-   **Tamaño Máximo:** 10m (10 megabytes)
-   **Archivos a Conservar:** 3

### Redes y Volúmenes

-   **Red:** Todos los contenedores comparten una red interna de tipo bridge llamada `disher-network`. Solo Caddy expone los puertos 80 y 443 al exterior.
-   **Volúmenes:**
    -   `mongo-data`: Persistencia de los datos de la base de datos.
    -   `caddy-data`: Almacenamiento de certificados TLS.
    -   `caddy-config`: Configuración de Caddy.
    -   `uploads-data`: Almacenamiento de archivos subidos (como logos de restaurante).

---

## Capas de Seguridad

| Capa | Mecanismo | Descripción |
|---|---|---|
| **Transporte** | Caddy | Refuerza HTTPS con HSTS y gestiona automáticamente los certificados TLS. |
| **Autenticación (BD)** | MongoDB | El acceso a la base de datos requiere un nombre de usuario y contraseña. |
| **Autenticación (API)** | JWT en Cookies `HttpOnly` | El token de sesión no es accesible mediante JavaScript en el navegador. |
| **Autorización** | RBAC | Middleware que verifica los roles de usuario (`admin`, `waiter`, `kitchen`, `pos`) en cada ruta protegida. |
| **Validación de Entrada** | `express-validator` | Valida y sanea toda la entrada de la API para prevenir ataques de inyección. |
| **Contenedores** | Docker | Todos los servicios se ejecutan con **usuarios no-root** para minimizar el impacto de una posible vulnerabilidad. |
| **Dependencias** | `npm audit` | Se realizan auditorías de seguridad de las dependencias en el pipeline de CI/CD. |

---

## Decisiones Clave de Diseño

-   **Inquilino Único (Single-Tenant):** Simplifica radicalmente la arquitectura, la seguridad y el mantenimiento, haciéndolo ideal para el auto-alojamiento.
-   **MongoDB sobre Base de Datos Relacional:** El esquema flexible de MongoDB es perfecto para la estructura anidada y variable de los menús de restaurante.
-   **Caddy sobre Nginx (como proxy principal):** La gestión automática de certificados TLS de Caddy es una característica crítica para operadores no técnicos.
-   **Imágenes Multi-Arquitectura:** El uso de imágenes base compatibles con `amd64` y `arm64` permite que Disher.io se ejecute en una amplia gama de hardware sin cambios en el código.
