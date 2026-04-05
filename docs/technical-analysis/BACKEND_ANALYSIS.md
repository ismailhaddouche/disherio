# 📊 ANÁLISIS TÉCNICO COMPLETO DEL BACKEND - DisherIo

> **Fecha de Análisis:** 2026-04-05  
> **Versión del Proyecto:** 1.0.0  
> **Ubicación:** `/home/isma/Proyectos/disherio/backend/`  
> **Autor:** Agente de Análisis Backend

---

## 📑 ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Dependencias y Librerías](#3-dependencias-y-librerías)
4. [Configuración y Setup](#4-configuración-y-setup)
5. [Análisis Línea a Línea](#5-análisis-línea-a-línea)
6. [Endpoints y API](#6-endpoints-y-api)
7. [Patrones de Diseño](#7-patrones-de-diseño)
8. [Manejo de Errores](#8-manejo-de-errores)
9. [Tests](#9-tests)
10. [Conclusiones y Recomendaciones](#10-conclusiones-y-recomendaciones)

---

## 1. RESUMEN EJECUTIVO

### Descripción del Sistema

**DisherIo** es un sistema de gestión integral para restaurantes que proporciona:

- **Gestión de Pedidos (POS)**: Sistema de punto de venta con flujo completo de órdenes
- **Kitchen Display System (KDS)**: Pantalla de cocina para gestión de preparación
- **Table Service (TAS)**: Servicio de mesa y atención al cliente
- **Totems QR**: Acceso de clientes mediante códigos QR
- **Gestión de Menú**: Administración de platos, categorías y precios
- **Pagos**: Sistema de tickets y división de cuentas

### Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITECTURA DISHERIO                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Clientes   │  │     POS      │  │     KDS      │  │     TAS      │    │
│  │  (Totems QR) │  │   (Cajero)   │  │  (Cocina)    │  │  (Camarero)  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
│         └─────────────────┴─────────────────┴─────────────────┘            │
│                                   │                                         │
│                    ┌──────────────┴──────────────┐                         │
│                    │     Express.js + Socket.IO   │                         │
│                    │         (REST + WS)          │                         │
│                    └──────────────┬──────────────┘                         │
│                                   │                                         │
│         ┌─────────────────────────┼─────────────────────────┐              │
│         │                         │                         │              │
│  ┌──────┴──────┐         ┌────────┴────────┐      ┌────────┴────────┐     │
│  │   MongoDB   │         │     Redis       │      │  @disherio/     │     │
│  │  (Datos)    │         │   (Cache/Socket │      │    shared       │     │
│  │             │         │     Adapter)    │      │ (Validaciones)  │     │
│  └─────────────┘         └─────────────────┘      └─────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Métricas Clave

| Métrica | Valor |
|---------|-------|
| **Lenguaje** | TypeScript 5.4.5 |
| **Runtime** | Node.js 20 (Alpine) |
| **Framework Web** | Express.js 5.2.1 |
| **Base de Datos** | MongoDB (Mongoose 9.3.2) |
| **Cache** | Redis 5.11.0 |
| **WebSocket** | Socket.IO 4.8.3 |
| **Cobertura de Tests** | Unitarios + Integración |
| **Arquitectura** | Layered + Repository Pattern |

---

## 2. ESTRUCTURA DEL PROYECTO

### Árbol de Directorios

```
backend/
├── src/
│   ├── index.ts                    # Entry point principal
│   ├──
│   ├── abilities/                  # CASL Ability definitions (RBAC)
│   │   └── abilities.ts            # Definición de permisos por rol
│   │
│   ├── config/                     # Configuración del sistema
│   │   ├── db.ts                   # MongoDB connection + retry logic
│   │   ├── env.ts                  # Validación de variables de entorno (Zod)
│   │   ├── i18n.ts                 # Configuración internacionalización
│   │   ├── logger.ts               # Configuración Pino logger
│   │   ├── redis.ts                # Redis client initialization
│   │   └── socket.ts               # Socket.IO initialization + adapter
│   │
│   ├── controllers/                # Controladores HTTP (MVC)
│   │   ├── auth.controller.ts      # Autenticación (login/logout)
│   │   ├── dashboard.controller.ts # Estadísticas dashboard
│   │   ├── dish.controller.ts      # Gestión de platos/categorías
│   │   ├── image.controller.ts     # Subida de imágenes
│   │   ├── logs.controller.ts      # Logs del sistema
│   │   ├── order.controller.ts     # Gestión de pedidos/items
│   │   ├── restaurant.controller.ts # Configuración restaurante
│   │   ├── staff.controller.ts     # Gestión de personal
│   │   └── totem.controller.ts     # Gestión de totems/sesiones
│   │
│   ├── locales/                    # Traducciones i18n
│   │   ├── en/translation.json     # Inglés
│   │   ├── es/translation.json     # Español (default)
│   │   └── fr/translation.json     # Francés
│   │
│   ├── middlewares/                # Middlewares Express
│   │   ├── auth.ts                 # JWT validation
│   │   ├── cache.middleware.ts     # HTTP response caching
│   │   ├── error-handler.ts        # Global error handler
│   │   ├── index.ts                # Barrel exports
│   │   ├── language.ts             # Language detection
│   │   ├── rbac.ts                 # Role-based access control
│   │   ├── rateLimit.config.ts     # Configuración rate limiting
│   │   ├── rateLimit.ts            # Rate limiters (auth, API, QR)
│   │   ├── request-logger.ts       # HTTP request logging
│   │   ├── security.ts             # Helmet + CORS + Compression
│   │   ├── socketAuth.ts           # Socket.IO authentication
│   │   └── validate.ts             # Zod validation middleware
│   │
│   ├── models/                     # Mongoose Models (Schemas)
│   │   ├── customer.model.ts       # Clientes del restaurante
│   │   ├── dish.model.ts           # Platos, categorías, variantes, extras
│   │   ├── menu-language.model.ts  # Idiomas del menú
│   │   ├── order.model.ts          # Órdenes, items, pagos
│   │   ├── restaurant.model.ts     # Restaurantes, impresoras
│   │   ├── staff.model.ts          # Personal, roles, permisos
│   │   └── totem.model.ts          # Totems, sesiones, clientes sesión
│   │
│   ├── repositories/               # Repository Pattern (Data Access)
│   │   ├── base.repository.ts      # BaseRepository abstracto
│   │   ├── dish.repository.ts      # DishRepository, CategoryRepository
│   │   ├── index.ts                # Barrel exports
│   │   ├── menu-language.repository.ts
│   │   ├── order.repository.ts     # OrderRepository, ItemOrderRepository, PaymentRepository
│   │   ├── restaurant.repository.ts
│   │   ├── totem.repository.ts     # TotemRepository, TotemSessionRepository, CustomerRepository
│   │   └── user.repository.ts      # UserRepository, RoleRepository
│   │
│   ├── routes/                     # Definición de rutas API
│   │   ├── auth.routes.ts          # POST /login, /pin, /logout
│   │   ├── customer.routes.ts      # Rutas de clientes
│   │   ├── dashboard.routes.ts     # Estadísticas
│   │   ├── dish.routes.ts          # CRUD platos/categorías
│   │   ├── health.routes.ts        # Health checks (/health, /ready, /live)
│   │   ├── image.routes.ts         # Subida de imágenes
│   │   ├── menu-language.routes.ts # Gestión idiomas menú
│   │   ├── metrics.routes.ts       # Prometheus metrics
│   │   ├── order.routes.ts         # Gestión pedidos
│   │   ├── restaurant.routes.ts    # Configuración restaurante
│   │   ├── staff.routes.ts         # Gestión personal
│   │   └── totem.routes.ts         # Totems y sesiones
│   │
│   ├── schemas/                    # Validación Zod (re-export desde shared)
│   │   ├── auth.schema.ts          # LoginSchema, PinSchema
│   │   ├── dish.schema.ts          # Re-export desde @disherio/shared
│   │   └── order.schema.ts         # Re-export desde @disherio/shared
│   │
│   ├── seeders/                    # Datos iniciales
│   │   └── index.ts                # Seeding scripts
│   │
│   ├── services/                   # Business Logic Layer
│   │   ├── auth.service.ts         # Lógica autenticación
│   │   ├── cache.service.ts        # Redis caching utilities
│   │   ├── dish.service.ts         # Lógica platos/categorías
│   │   ├── image.service.ts        # Procesamiento imágenes (Sharp)
│   │   ├── index.ts                # Barrel exports
│   │   ├── menu-language.service.ts
│   │   ├── order.service.ts        # Lógica pedidos (Circuit Breakers)
│   │   ├── payment.service.ts      # Lógica pagos
│   │   ├── pin-security.service.ts # Rate limiting PIN
│   │   └── totem.service.ts        # Lógica totems
│   │
│   ├── sockets/                    # Socket.IO Handlers
│   │   ├── index.ts                # Barrel exports
│   │   ├── kds.handler.ts          # Kitchen Display System (612 líneas)
│   │   ├── pos.handler.ts          # Point of Sale (240 líneas)
│   │   ├── tas.handler.ts          # Table Assignment System
│   │   ├── totem.handler.ts        # Cliente Totem
│   │   └── middleware/
│   │       ├── connection-tracker.ts  # Tracking conexiones
│   │       ├── rate-limiter.ts        # Rate limiting sockets
│   │       └── session-validator.ts   # Validación sesiones
│   │
│   ├── utils/                      # Utilidades
│   │   ├── async-handler.ts        # Wrapper async/await
│   │   ├── calculation.utils.ts    # Cálculos precios/tickets
│   │   ├── circuit-breaker.ts      # Circuit Breaker pattern
│   │   ├── circuit-breaker-monitor.ts # Monitoreo CB
│   │   ├── file-security.ts        # Seguridad archivos
│   │   ├── jwt-validation.ts       # Validación JWT_SECRET
│   │   ├── pagination.ts           # Utilidades paginación
│   │   ├── query-profiler.ts       # Profiler MongoDB
│   │   ├── tax.ts                  # Cálculo impuestos
│   │   └── transactions.ts         # MongoDB transactions
│   │
│   └── __tests__/                  # Tests Jest
│       ├── setup.ts                # Configuración tests
│       ├── *.test.ts               # Tests unitarios
│       └── controllers/            # Tests controladores
│
├── dist/                           # Código compilado (TypeScript → JS)
├── coverage/                       # Reportes cobertura tests
├── scripts/                        # Scripts utilitarios
├── node_modules/                   # Dependencias
├── Dockerfile                      # Multi-stage build
├── jest.config.js                  # Configuración Jest
├── package.json                    # Dependencias y scripts
└── tsconfig.json                   # Configuración TypeScript
```

### Patrón de Arquitectura: Layered Architecture + Repository Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │   Routes    │ │ Controllers │ │  Socket.IO Handlers         │ │
│  │  (HTTP)     │ │  (HTTP)     │ │  (WebSocket)                │ │
│  └──────┬──────┘ └──────┬──────┘ └──────────────┬──────────────┘ │
└─────────┼───────────────┼───────────────────────┼────────────────┘
          │               │                       │
          ▼               ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BUSINESS LAYER                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Services                               │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐ │ │
│  │  │   Order     │ │    Auth     │ │   Dish/Restaurant     │ │ │
│  │  │  Service    │ │   Service   │ │      Services         │ │ │
│  │  │(CB Pattern) │ │             │ │                       │ │ │
│  │  └─────────────┘ └─────────────┘ └───────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Repositories                             │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐ │ │
│  │  │   Order     │ │    User     │ │   BaseRepository      │ │ │
│  │  │ Repository  │ │ Repository  │ │   (Abstract)          │ │ │
│  │  └─────────────┘ └─────────────┘ └───────────────────────┘ │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────┼────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
            ┌──────────────┐  ┌──────────────┐
            │   MongoDB    │  │    Redis     │
            │  (Mongoose)  │  │   (ioredis)  │
            └──────────────┘  └──────────────┘
```


---

## 3. DEPENDENCIAS Y LIBRERÍAS

### 3.1 Dependencias de Producción

| Paquete | Versión | Propósito | Justificación |
|---------|---------|-----------|---------------|
| **express** | ^5.2.1 | Framework web | Elegido por su madurez, rendimiento y ecosistema. v5 mejora manejo de errores async |
| **mongoose** | ^9.3.2 | ODM MongoDB | Abstracción robusta sobre MongoDB con schemas, validaciones, middlewares |
| **socket.io** | ^4.8.3 | WebSocket bidireccional | Necesario para comunicación en tiempo real (KDS, notificaciones) |
| **@socket.io/redis-adapter** | ^8.3.0 | Adapter multi-node | Permite escalar Socket.IO horizontalmente con Redis |
| **redis** | ^5.11.0 | Cliente Redis | Cache distribuida y session store |
| **bcryptjs** | ^2.4.3 | Hashing contraseñas | Seguro, pure JS (no dependencias nativas), battle-tested |
| **jsonwebtoken** | ^9.0.3 | JWT tokens | Autenticación stateless con cookies HttpOnly |
| **zod** | ^4.3.6 | Validación schemas | TypeScript-first, excelente DX, validación runtime |
| **@casl/ability** | ^6.8.0 | Autorización RBAC | Permisos granulares con condiciones |
| **helmet** | ^8.1.0 | Seguridad HTTP | Protección headers (XSS, clickjacking, etc.) |
| **cors** | ^2.8.6 | CORS handling | Configuración flexible de orígenes permitidos |
| **express-rate-limit** | ^8.3.1 | Rate limiting | Protección contra brute force y DoS |
| **compression** | ^1.8.1 | Gzip compression | Reduce tamaño de respuestas HTTP |
| **pino** | ^10.3.1 | Logger estructurado | Alto rendimiento, formato JSON, redacción automática |
| **i18next** | ^25.10.9 | Internacionalización | Sistema de traducciones con fallback |
| **multer** | ^2.1.1 | Upload files | Manejo multipart/form-data para imágenes |
| **sharp** | ^0.34.5 | Procesamiento imágenes | Optimización y conversión imágenes (WebP) |
| **prom-client** | ^15.1.3 | Métricas Prometheus | Export métricas para monitoring |
| **@disherio/shared** | file:../shared | Validaciones compartidas | Monorepo - validaciones Zod compartidas |

### 3.2 Seguridad de Dependencias

```
🔐 AUTENTICACIÓN
├── bcryptjs: Hashing con salt automático (cost 12)
├── jsonwebtoken: Tokens HMAC SHA-256
└── JWT_SECRET: Validación >=32 caracteres

🛡️ AUTORIZACIÓN
└── @casl/ability: RBAC declarativo

🚫 PROTECCIÓN
├── helmet: Headers de seguridad HTTP
├── express-rate-limit: Múltiples tiers
│   ├── authLimiter: 5 intentos/15min
│   ├── apiLimiter: 100 req/15min
│   ├── strictLimiter: 20 req/15min
│   └── qrBruteForceLimiter: 10 intentos/15min
└── cors: Whitelist orígenes

🔒 DATOS SENSIBLES
└── pino redact: Elimina passwords/tokens de logs
```

---

## 4. CONFIGURACIÓN

### 4.1 Variables de Entorno (env.ts)

```typescript
const envSchema = z.object({
  JWT_SECRET: z.string()
    .min(1)
    .refine(val => val !== DEFAULT_JWT_SECRET)
    .refine(val => val.length >= 32),
  MONGODB_URI: z.string().min(1),
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
});
```

### 4.2 MongoDB Connection (db.ts)

```typescript
const options: mongoose.ConnectOptions = {
  maxPoolSize: 50,        // Connection pool
  minPoolSize: 5,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
  bufferCommands: false,  // Fail fast
};

// Retry con exponential backoff + jitter
const getRetryDelay = (attempt: number) => {
  const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s...
  const jitter = Math.random() * 1000;
  return Math.min(delay + jitter, 30000);
};
```


---

## 5. ENDPOINTS Y API

### 5.1 Resumen de Endpoints

| Método | Ruta | Descripción | Auth | Rate Limit |
|--------|------|-------------|------|------------|
| **AUTENTICACIÓN** |
| POST | /api/auth/login | Login usuario/contraseña | No | authLimiter |
| POST | /api/auth/pin | Login con PIN | No | authLimiter |
| POST | /api/auth/logout | Cerrar sesión | Sí | authLimiter |
| **PLATOS** |
| GET | /api/dishes | Listar platos paginados | Sí | apiLimiter |
| GET | /api/dishes/:id | Obtener plato por ID | Sí | apiLimiter |
| POST | /api/dishes | Crear plato | Sí + create Dish | strictLimiter |
| PATCH | /api/dishes/:id | Actualizar plato | Sí + update Dish | strictLimiter |
| DELETE | /api/dishes/:id | Eliminar plato | Sí + delete Dish | strictLimiter |
| PATCH | /api/dishes/:id/toggle | Cambiar estado activo | Sí + update Dish | strictLimiter |
| **CATEGORÍAS** |
| GET | /api/dishes/categories | Listar categorías | Sí | apiLimiter |
| POST | /api/dishes/categories | Crear categoría | Sí + create Category | strictLimiter |
| PATCH | /api/dishes/categories/:id | Actualizar categoría | Sí + update Category | strictLimiter |
| DELETE | /api/dishes/categories/:id | Eliminar categoría | Sí + delete Category | strictLimiter |
| **PEDIDOS** |
| GET | /api/orders/kitchen | Items cocina (KDS) | Sí + read KDS | strictLimiter |
| GET | /api/orders/service-items | Items servicio | Sí + read ItemOrder | strictLimiter |
| GET | /api/orders/session/:id | Items por sesión | Sí + read Order | apiLimiter |
| POST | /api/orders | Crear orden | Sí + create Order | strictLimiter |
| POST | /api/orders/items | Agregar item | Sí + create ItemOrder | strictLimiter |
| PATCH | /api/orders/items/:id/state | Cambiar estado item | Sí + update ItemOrder | strictLimiter |
| PATCH | /api/orders/items/:id/assign | Asignar a cliente | Sí + update ItemOrder | strictLimiter |
| DELETE | /api/orders/items/:id | Eliminar item | Sí + delete ItemOrder | strictLimiter |
| POST | /api/orders/payments | Crear pago | Sí + create Payment | strictLimiter |
| PATCH | /api/orders/payments/:id/ticket | Marcar ticket pagado | Sí + update Payment | strictLimiter |
| **TOTEMS - PÚBLICO** |
| GET | /api/totems/menu/:qr | Menú por QR | No | qrBruteForceLimiter |
| GET | /api/totems/menu/:qr/dishes | Platos del menú | No | qrLimiter |
| POST | /api/totems/menu/:qr/session | Crear sesión QR | No | qrLimiter |
| POST | /api/totems/menu/:qr/order | Orden pública | No | qrLimiter |
| POST | /api/totems/session/:id/customers | Agregar cliente | No | qrLimiter |
| GET | /api/totems/session/:id/customers | Clientes sesión | No | qrLimiter |
| GET | /api/totems/session/:id/orders | Órdenes sesión | No | qrLimiter |
| **TOTEMS - PROTEGIDO** |
| GET | /api/totems | Listar totems | Sí + read Totem | apiLimiter |
| POST | /api/totems | Crear totem | Sí + create Totem | strictLimiter |
| PATCH | /api/totems/:id | Actualizar totem | Sí + update Totem | strictLimiter |
| DELETE | /api/totems/:id | Eliminar totem | Sí + delete Totem | strictLimiter |
| POST | /api/totems/:id/regenerate-qr | Nuevo QR | Sí + update Totem | strictLimiter |
| **RESTAURANTE** |
| GET | /api/restaurant/me | Mi restaurante | Sí | apiLimiter |
| PATCH | /api/restaurant/me | Actualizar datos | Sí | strictLimiter |
| GET | /api/restaurant/settings | Configuración | Sí | apiLimiter |
| PATCH | /api/restaurant/settings | Actualizar config | Sí + manage Restaurant | strictLimiter |
| **PERSONAL** |
| GET | /api/staff | Listar staff | Sí + read Staff | apiLimiter |
| POST | /api/staff | Crear empleado | Sí + create Staff | strictLimiter |
| PATCH | /api/staff/:id | Actualizar empleado | Sí + update Staff | strictLimiter |
| DELETE | /api/staff/:id | Eliminar empleado | Sí + delete Staff | strictLimiter |
| **HEALTH** |
| GET | /health | Health completo | No | - |
| GET | /health/ready | Readiness probe | No | - |
| GET | /health/live | Liveness probe | No | - |
| GET | /health/simple | Health simple | No | - |
| **METRICS** |
| GET | /metrics | Prometheus metrics | No | - |

### 5.2 Flujo de Estados - Items de Orden

```
┌──────────┐     ┌─────────────┐     ┌─────────┐
│ ORDERED  │────▶│ ON_PREPARE  │────▶│ SERVED  │
│  (Inicial)│     │  (Cocina)   │     │ (Final) │
└────┬─────┘     └──────┬──────┘     └─────────┘
     │                  │
     └──────────────────┘
            │
            ▼
     ┌─────────────┐
     │   CANCELED  │
     │  (Cancelado) │
     └─────────────┘

Restricciones:
- KITCHEN: ORDERED → ON_PREPARE → SERVED
- SERVICE: ORDERED → SERVED (sin ON_PREPARE)
- Cancelar solo desde ORDERED (a menos que tengas permiso POS/ADMIN)
```

---

## 6. PATRONES DE DISEÑO

### 6.1 Repository Pattern

```typescript
// BaseRepository - Clase abstracta con operaciones CRUD
abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;
  
  async findById(id: string): Promise<T | null>
  async find(filter: SimpleFilter): Promise<T[]>
  async create(data: Partial<T>, session?: ClientSession): Promise<T>
  async update(id: string, data: UpdateQuery<T>, session?: ClientSession): Promise<T | null>
  async delete(id: string, session?: ClientSession): Promise<T | null>
}

// Implementaciones específicas
class OrderRepository extends BaseRepository<IOrder> {
  async createOrder(sessionId: string, staffId?: string, customerId?: string, session?: ClientSession)
  async getOrdersWithItems(sessionId: string, options?: {...})
  async getDailyMetrics(sessionIds: string[], date: Date)
}
```

**Justificación**: 
- Abstrae acceso a datos
- Facilita testing (mocking)
- Centraliza validación ObjectId
- Manejo consistente de errores MongoDB

### 6.2 Circuit Breaker Pattern

```typescript
// Implementación propia con 3 estados
enum CircuitState { CLOSED = 'CLOSED', OPEN = 'OPEN', HALF_OPEN = 'HALF_OPEN' }

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  
  async execute<T>(...args: any[]): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('CIRCUIT_BREAKER_OPEN');
      }
    }
    
    try {
      const result = await this.operation(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}

// Uso en OrderService
const createOrderBreaker = new CircuitBreaker(
  async (sessionId, staffId, customerId) => { ... },
  { failureThreshold: 3, resetTimeout: 15000, halfOpenMaxCalls: 2 },
  'OrderService.createOrder'
);
```

**Justificación**:
- Prevenir cascada de fallos
- Proteger recursos agotados
- Recuperación automática
- Monitoreo de salud

### 6.3 Cache-Aside Pattern

```typescript
// cache.service.ts
async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.MENU
): Promise<T> {
  // 1. Intentar obtener del cache
  const cached = await cache.get<T>(key);
  if (cached !== null) return cached;
  
  // 2. Cache miss - obtener de fuente
  const data = await fetcher();
  
  // 3. Guardar en cache (fire-and-forget)
  await cache.set(key, data, ttlSeconds);
  
  return data;
}

// Uso en dish.service.ts
export async function getDishById(dishId: string): Promise<IDish | null> {
  return fetchWithCache(
    CacheKeys.dish(dishId),
    () => dishRepo.findByIdWithDetails(dishId),
    CACHE_TTL.MENU
  );
}
```

**Justificación**:
- Reduce carga en base de datos
- Mejora latencia lecturas
- Invalidación explícita en escrituras
- Tolerancia a fallo (Redis opcional)

### 6.4 Async Handler Pattern

```typescript
// Elimina try/catch repetitivo en controllers
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Uso
export const createDish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dish = await DishService.createDish(req.body);
  res.status(201).json(dish); // No necesita try/catch
});
```

### 6.5 Transaction Pattern

```typescript
// withTransaction - Wrapper automático
export async function withTransaction<T>(
  operations: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await startSession();
  
  try {
    session.startTransaction();
    const result = await operations(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Uso
const order = await withTransaction(async (session) => {
  const order = await orderRepo.createOrder(data, session);
  const item = await itemRepo.createItem(itemData, session);
  return order;
});
```

---

## 7. MANEJO DE ERRORES

### 7.1 Jerarquía de Errores

```
Error
├── AppError (operacional)
│   ├── createError.badRequest()      → 400
│   ├── createError.unauthorized()    → 401
│   ├── createError.forbidden()       → 403
│   ├── createError.notFound()        → 404
│   ├── createError.conflict()        → 409
│   └── createError.internal()        → 500
├── ValidationError (Repository)
└── Error de Mongoose
    ├── ValidationError               → 400
    ├── CastError                     → 400
    └── MongoServerError (code 11000) → 409
```

### 7.2 Códigos de Error Centralizados

```typescript
// Definidos en @disherio/shared
enum ErrorCode {
  // Auth
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_PIN = 'INVALID_PIN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Resources
  NOT_FOUND = 'NOT_FOUND',
  DISH_NOT_FOUND = 'DISH_NOT_FOUND',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  
  // Business Logic
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  SESSION_NOT_ACTIVE = 'SESSION_NOT_ACTIVE',
  CANNOT_DELETE_ITEM_NOT_ORDERED = 'CANNOT_DELETE_ITEM_NOT_ORDERED',
  REQUIRES_POS_AUTHORIZATION = 'REQUIRES_POS_AUTHORIZATION',
  NO_ITEMS_TO_PAY = 'NO_ITEMS_TO_PAY',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  AUTH_RATE_LIMIT_EXCEEDED = 'AUTH_RATE_LIMIT_EXCEEDED',
  QR_RATE_LIMIT_EXCEEDED = 'QR_RATE_LIMIT_EXCEEDED',
  
  // Server
  SERVER_ERROR = 'SERVER_ERROR',
  SERVER_CONFIGURATION_ERROR = 'SERVER_CONFIGURATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}
```

### 7.3 HTTP Status Mapping

```typescript
export const ERROR_HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.DISH_NOT_FOUND]: 404,
  [ErrorCode.CATEGORY_NOT_FOUND]: 404,
  [ErrorCode.ORDER_NOT_FOUND]: 404,
  [ErrorCode.SESSION_NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_STATE_TRANSITION]: 400,
  [ErrorCode.DUPLICATE_RESOURCE]: 409,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.AUTH_RATE_LIMIT_EXCEEDED]: 429,
  // ... más mapeos
};
```

### 7.4 Respuesta de Error Estándar

```json
{
  "error": "Plato no encontrado",
  "errorCode": "DISH_NOT_FOUND",
  "status": 404
}
```

---

## 8. TESTS

### 8.1 Configuración de Tests

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
};
```

### 8.2 Setup de Tests

```typescript
// src/__tests__/setup.ts
process.env.MONGODB_URI = 'mongodb://localhost:27017/disherio_test';
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Mocks globales
jest.mock('../config/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }))
}));
```

### 8.3 Tipos de Tests

| Tipo | Ubicación | Descripción |
|------|-----------|-------------|
| **Unitarios** | `*.unit.test.ts` | Funciones puras, utilidades |
| **Controladores** | `controllers/*.test.ts` | HTTP endpoints con mocks |
| **Integración** | `order-flow.test.ts` | Flujos completos con DB real |

### 8.4 Ejemplo Test de Controlador

```typescript
// auth.controller.test.ts
describe('POST /login/username', () => {
  it('should return 200 and user data on valid credentials', async () => {
    const mockUser = {
      staffId: 'staff123',
      restaurantId: 'rest123',
      role: 'ADMIN',
      permissions: ['ADMIN'],
      name: 'Test User',
    };
    
    req = {
      body: { username: 'testuser', password: 'password123' },
      secure: false,
      headers: {}
    };
    
    (authService.loginWithUsername as jest.Mock).mockResolvedValue({
      token: 'jwt_token',
      user: mockUser
    });
    
    await loginUsername(req as Request, res as Response, next);
    
    expect(cookieMock).toHaveBeenCalledWith(
      'auth_token',
      'jwt_token',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
      })
    );
  });
});
```

### 8.5 Ejemplo Test de Integración

```typescript
// order-flow.test.ts
describe('Order Flow Integration', () => {
  it('should create an order in an active session', async () => {
    const order = await createOrder(sessionId, staffId);
    expect(order._id).toBeDefined();
  });

  it('should transition item to ON_PREPARE', async () => {
    const items = await addItemToOrder(orderId, sessionId, dishId);
    const updated = await updateItemState(items._id.toString(), 'ON_PREPARE', staffId, ['POS']);
    expect(updated!.item_state).toBe('ON_PREPARE');
  });

  it('should block TAS from canceling ON_PREPARE items without POS', async () => {
    const item = await addItemToOrder(orderId, sessionId, dishId);
    await updateItemState(item._id.toString(), 'ON_PREPARE', staffId, ['TAS']);
    await expect(
      updateItemState(item._id.toString(), 'CANCELED', staffId, ['TAS'])
    ).rejects.toThrow('REQUIRES_POS_AUTHORIZATION');
  });
});
```

---

## 9. SOCKET.IO - ARQUITECTURA EN TIEMPO REAL

### 9.1 Namespaces y Rooms

```
socket.io/
├── connection
│   └── authMiddleware (valida JWT)
│
├── kds:session:{sessionId}     # Kitchen Display System
├── pos:session:{sessionId}     # Point of Sale
├── tas:session:{sessionId}     # Table Assignment
├── session:{sessionId}         # General
└── customer:session:{sessionId} # Clientes totem
```

### 9.2 Eventos Principales

| Handler | Evento | Descripción |
|---------|--------|-------------|
| **KDS** | `kds:join` | Unirse a sesión de cocina |
| | `kds:item_prepare` | Marcar item en preparación |
| | `kds:item_serve` | Marcar item servido |
| | `kds:item_cancel` | Cancelar item |
| **POS** | `pos:join` | Unirse a sesión POS |
| | `pos:session_closed` | Sesión cerrada |
| | `pos:session_paid` | Sesión pagada |
| | `pos:ticket_paid` | Ticket pagado |
| **TAS** | `tas:join` | Unirse a sesión TAS |
| | `tas:new_order` | Nueva orden recibida |
| | `tas:bill_request` | Solicitud de cuenta |

### 9.3 Middleware de Sockets

```typescript
// socketAuth.ts - Autenticación
io.use(socketAuthMiddleware);

// session-validator.ts - Validar acceso a sesión
validateSessionAccess(socket, sessionId);

// rate-limiter.ts - Rate limiting por socket
checkRateLimit(socket.id, eventName);

// connection-tracker.ts - Tracking conexiones
trackSocketConnection(socket, 'KDS', { userId: staffId });
```

---

## 10. CONCLUSIONES Y RECOMENDACIONES

### 10.1 Fortalezas del Sistema

| Aspecto | Evaluación |
|---------|------------|
| **Seguridad** | Excelente - JWT, RBAC, rate limiting, Helmet |
| **Escalabilidad** | Muy buena - Redis adapter, connection pooling |
| **Mantenibilidad** | Buena - Arquitectura por capas, TypeScript |
| **Observabilidad** | Buena - Pino, Prometheus, health checks |
| **Resiliencia** | Excelente - Circuit breakers, retry logic |
| **Testing** | Moderada - Unit + integración, cobertura variable |

### 10.2 Métricas de Código

| Métrica | Valor |
|---------|-------|
| Archivos TypeScript | ~90 |
| Líneas de código (aprox) | ~15,000 |
| Modelos Mongoose | 8 |
| Repositories | 6 |
| Controllers | 8 |
| Services | 9 |
| Routes | 12 |
| Socket Handlers | 4 |
| Middlewares | 12 |

### 10.3 Recomendaciones Técnicas

1. **Testing**: Aumentar cobertura de tests de integración para flujos críticos
2. **Documentación**: Generar OpenAPI/Swagger a partir de los schemas Zod
3. **Monitoreo**: Implementar tracing distribuido (OpenTelemetry)
4. **Performance**: Considerar aggregation pipelines adicionales para reportes
5. **Seguridad**: Implementar API versioning para cambios breaking

### 10.4 Stack Tecnológico Recomendado para Escalar

```
┌─────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                        │
│                    (Nginx/Traefik)                      │
└─────────────┬───────────────────────────────┬───────────┘
              │                               │
    ┌─────────▼──────────┐        ┌───────────▼─────────┐
    │   Node Instance 1  │        │   Node Instance 2   │
    │   (Express + WS)   │◄──────►│   (Express + WS)    │
    └─────────┬──────────┘        └───────────┬─────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │      Redis        │
                    │   (Pub/Sub +      │
                    │    Adapter)       │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │     MongoDB       │
                    │  (Replica Set)    │
                    └───────────────────┘
```

---

## ANEXOS

### A. Modelos de Datos

Ver documentación en `/src/models/*.ts`

### B. Environment Variables Template

```bash
# Required
JWT_SECRET=your_min_32_char_secret_here
MONGODB_URI=mongodb://localhost:27017/disherio

# Optional
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
FRONTEND_URL=http://localhost:4200
```

### C. Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Tests
npm test
npm run test:watch

# Seed
npm run seed

# Producción
npm start
```

---

*Documento generado automáticamente el 2026-04-05*
*Análisis completo del backend DisherIo v1.0.0*
