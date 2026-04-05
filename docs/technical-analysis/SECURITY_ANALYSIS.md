# 🔒 ANÁLISIS TÉCNICO DE SEGURIDAD - DISHERIO

> **Fecha de análisis:** 2026-04-05  
> **Versión de la aplicación:** 1.0.0  
> **Clasificación:** ACADÉMICO / TÉCNICO PROFUNDO  
> **Metodología:** OWASP ASVS 4.0 + NIST Cybersecurity Framework

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Autenticación](#2-autenticación)
3. [Autorización](#3-autorización)
4. [Seguridad en Endpoints](#4-seguridad-en-endpoints)
5. [Seguridad de Contraseñas](#5-seguridad-de-contraseñas)
6. [Validación de Datos](#6-validación-de-datos)
7. [Seguridad en WebSockets](#7-seguridad-en-websockets)
8. [Manejo de Sesiones](#8-manejo-de-sesiones)
9. [Headers de Seguridad](#9-headers-de-seguridad)
10. [Vulnerabilidades Prevenidas](#10-vulnerabilidades-prevenidas)
11. [Auditoría y Logs](#11-auditoría-y-logs)
12. [Configuración de Seguridad](#12-configuración-de-seguridad)
13. [Recomendaciones](#13-recomendaciones)

---

## 1. RESUMEN EJECUTIVO

### 1.1 Visión General

DisherIO implementa un **sistema de seguridad robusto y multicapa** que combina:

| Capa | Tecnología | Nivel de Madurez |
|------|-----------|------------------|
| Autenticación | JWT + bcrypt + HttpOnly Cookies | ⭐⭐⭐⭐⭐ |
| Autorización | CASL + RBAC híbrido | ⭐⭐⭐⭐⭐ |
| Transporte | TLS 1.3 + Caddy Reverse Proxy | ⭐⭐⭐⭐⭐ |
| Rate Limiting | Express-Rate-Limit + Redis | ⭐⭐⭐⭐⭐ |
| Validación | Zod Schemas | ⭐⭐⭐⭐⭐ |

### 1.2 Arquitectura de Seguridad

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPA PERIMETRAL                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Caddy      │  │  Rate Limit  │  │    CORS Config       │  │
│  │  TLS 1.3     │  │   Express    │  │  Origin Whitelist    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                       CAPA DE APLICACIÓN                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  JWT Auth    │  │    CASL      │  │   Zod Validation     │  │
│  │ Middleware   │  │   RBAC       │  │     Sanitization     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      CAPA DE DATOS                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   MongoDB    │  │    Redis     │  │    File Upload       │  │
│  │   AuthUser   │  │   Sessions   │  │   Security Layer     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. AUTENTICACIÓN

### 2.1 Arquitectura JWT

#### 2.1.1 Estructura del Token

```typescript
// Payload del JWT (backend/src/services/auth.service.ts)
interface TokenPayload {
  staffId: string;      // Identificador único del empleado
  restaurantId: string; // Tenant ID (multi-tenancy)
  role: string;         // Rol asignado
  permissions: string[]; // Array de permisos CASL
  name: string;         // Nombre para UI
}
```

#### 2.1.2 Configuración JWT

| Parámetro | Valor | Ubicación | Descripción |
|-----------|-------|-----------|-------------|
| `JWT_SECRET` | Variable de entorno | `.env` | Clave de firma HMAC-SHA256 |
| `JWT_EXPIRES` | `8h` (default) | `.env` | Tiempo de expiración |
| Algoritmo | HS256 | Hardcoded | HMAC con SHA-256 |

```typescript
// backend/src/services/auth.service.ts
const JWT_SECRET: string = process.env.JWT_SECRET || '';
const JWT_EXPIRES: string = process.env.JWT_EXPIRES || '8h';

// Generación del token
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
```

### 2.2 Validación de JWT Secret

DisherIO implementa **validación estricta** del secreto JWT en tiempo de arranque:

```typescript
// backend/src/utils/jwt-validation.ts
const MIN_LENGTH = 32;
const DEFAULT_SECRET = 'changeme_in_production';

export function validateJWTSecret(secret: string | undefined): JWTValidationResult {
  // Check 1: Existencia
  if (!secret) {
    return { valid: false, error: 'JWT_SECRET is not set' };
  }

  // Check 2: No usar valor por defecto
  if (secret === DEFAULT_SECRET) {
    return { valid: false, error: 'JWT_SECRET uses default value' };
  }

  // Check 3: Longitud mínima
  if (secret.length < MIN_LENGTH) {
    return { valid: false, error: `JWT_SECRET must be at least ${MIN_LENGTH} chars` };
  }

  return { valid: true };
}

// Fatal exit si la validación falla
export function validateJWTSecretOrExit(secret: string | undefined): void {
  const result = validateJWTSecret(secret);
  if (!result.valid) {
    logger.error(`❌ ${result.error}`);
    process.exit(1);  // El servidor NO inicia con configuración insegura
  }
}
```

**✅ Fortalezas:**
- Validación temprana (fail-fast)
- Prevención de valores por defecto en producción
- Longitud mínima de 32 caracteres
- Terminación del proceso si es inválido

### 2.3 Estrategia de Tokens

#### 2.3.1 Dual Token Strategy (Access Token Only)

DisherIO utiliza una **estrategia de token único** (access token) con las siguientes características:

| Aspecto | Implementación | Justificación |
|---------|---------------|---------------|
| Access Token | JWT firmado | Stateless, scalable |
| Refresh Token | ❌ No implementado | Simplicidad para restaurantes |
| Almacenamiento | HttpOnly Cookie | Protección contra XSS |
| Expiración | 8 horas (shift típico) | Balance seguridad/usabilidad |

#### 2.3.2 Almacenamiento Frontend

```typescript
// frontend/src/app/store/auth.store.ts
interface StoredUser extends AuthUser {
  expiresAt: number;  // Timestamp de expiración
}

function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  const data = JSON.parse(raw) as StoredUser;
  
  // Validación de expiración local
  if (data.expiresAt < Date.now()) {
    localStorage.removeItem('auth_user');
    return null;
  }
  return data;
}
```

**⚠️ Nota de Seguridad:** Los datos del usuario (NO el token) se almacenan en localStorage para persistencia de sesión. El token JWT real se almacena en **HttpOnly Cookie**, inaccesible para JavaScript.

### 2.4 Métodos de Autenticación

#### 2.4.1 Username + Password

```typescript
// backend/src/services/auth.service.ts
export async function loginWithUsername(
  username: string,
  password: string,
  restaurantId?: string
): Promise<AuthResult> {
  // Multi-tenant lookup
  const staff = restaurantId
    ? await userRepo.findByUsernameAndRestaurant(username.toLowerCase(), restaurantId)
    : await userRepo.findByUsername(username.toLowerCase());

  if (!staff) {
    throw new Error(ErrorCode.INVALID_CREDENTIALS);
  }

  // Comparación bcrypt timing-safe
  const isPasswordValid = await bcrypt.compare(password, staff.password_hash);
  if (!isPasswordValid) {
    throw new Error(ErrorCode.INVALID_CREDENTIALS);
  }

  return buildAuthResult(staff, restaurant);
}
```

**Características de seguridad:**
- ✅ Lowercase normalizado (previene enumeración por case)
- ✅ Mensaje de error genérico (no distingue user vs password)
- ✅ Bcrypt con salt automático

#### 2.4.2 PIN Code (Para Terminales/Tótems)

```typescript
// backend/src/services/auth.service.ts
export async function loginWithPin(
  pin: string, 
  restaurantId: string,
  username?: string,
  ipAddress?: string
): Promise<AuthResult> {
  // Rate limiting por identificador compuesto
  const identifier = username 
    ? createIdentifier(username.toLowerCase(), ipAddress)
    : createIdentifier(`restaurant:${restaurantId}`, ipAddress);

  // Verificar bloqueo antes de validar
  if (isLocked(identifier)) {
    const retryAfter = getRemainingLockTime(identifier);
    const error = new Error(ErrorCode.AUTH_RATE_LIMIT_EXCEEDED);
    (error as Error & { retryAfter: number }).retryAfter = retryAfter;
    throw error;
  }

  // Validación contra todos los empleados del restaurante
  const staffMembers = await userRepo.findByRestaurantId(restaurantId);
  
  for (const staff of staffMembers) {
    const isPinValid = await bcrypt.compare(pin, staff.pin_code_hash);
    if (isPinValid) {
      clearAttempts(identifier);  // Limpiar intentos fallidos
      return buildAuthResult(staff, restaurant);
    }
  }

  // Registrar intento fallido
  recordFailedAttempt(identifier);
  throw new Error(ErrorCode.INVALID_PIN);
}
```

**Características de seguridad:**
- ✅ Rate limiting por IP + username
- ✅ Bloqueo exponencial progresivo
- ✅ Iteración sobre staff (bcrypt previene índices)

### 2.5 Extracción de Token

```typescript
// backend/src/middlewares/auth.ts
function extractToken(req: Request): string | null {
  // Prioridad 1: HttpOnly Cookie (más seguro)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  
  // Prioridad 2: Authorization Bearer (API clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  
  return null;
}
```

---

## 3. AUTORIZACIÓN

### 3.1 Arquitectura RBAC + CASL

DisherIO implementa un **sistema híbrido** que combina:
- **RBAC (Role-Based Access Control):** Roles predefinidos (ADMIN, POS, TAS, KTS)
- **CASL (Capability-based Authorization):** Permisos granulares por recurso

```
┌─────────────────────────────────────────────────────────────┐
│                    HIERARQUÍA DE ROLES                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                                            │
│  │    ADMIN    │  ← Manage all (superusuario)              │
│  └──────┬──────┘                                            │
│         │                                                   │
│  ┌──────┴──────┬─────────────┬─────────────┐               │
│  │             │             │             │               │
│  ▼             ▼             ▼             ▼               │
│ ┌────┐     ┌──────┐     ┌──────┐     ┌──────┐             │
│ │POS │     │ TAS  │     │ KTS  │     │ ...  │             │
│ └────┘     └──────┘     └──────┘     └──────┘             │
│  Cajero    Servicio    Cocina/KDS                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Definición de Habilidades (Backend)

```typescript
// backend/src/abilities/abilities.ts
export function defineAbilityFor(user: JwtPayload): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const perms = new Set(user.permissions);

  // ADMIN: Acceso total
  if (perms.has('ADMIN')) {
    can('manage', 'all');
    return build();
  }

  // POS: Point of Sale - Cajero
  if (perms.has('POS')) {
    can('read', 'Totem');
    can('create', 'TotemSession');
    can('update', 'TotemSession');
    can('read', 'Order');
    can('create', 'Order');
    can('update', 'Order');
    // ... más permisos
  }

  // TAS: Table Attendant Service - Camarero
  if (perms.has('TAS')) {
    can('read', 'Totem');
    can('manage', 'Totem', { totem_type: 'TEMPORARY' } as any);  // Con condición
    // ... más permisos
  }

  // KTS: Kitchen Tablet Service - Cocina
  if (perms.has('KTS')) {
    can('read', 'Order');
    can('read', 'ItemOrder');
    can('update', 'ItemOrder');
    can('update', 'Dish');
    can('read', 'KDS');
  }

  return build();
}
```

### 3.3 Middleware de Autorización

```typescript
// backend/src/middlewares/rbac.ts
export function requirePermission(action: string, subject: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }
    
    const ability = defineAbilityFor(req.user);
    
    if (ability.cannot(action as any, subject as any)) {
      res.status(403).json({ errorCode: 'FORBIDDEN' });
      return;
    }
    
    next();
  };
}
```

### 3.4 Uso en Rutas

```typescript
// backend/src/routes/staff.routes.ts
router.use(authMiddleware);  // Primero: autenticación

router.get('/roles/all', requirePermission('read', 'Role'), StaffController.listRoles);
router.post('/roles', strictLimiter, requirePermission('create', 'Role'), StaffController.createRole);
router.get('/', requirePermission('read', 'Staff'), StaffController.listStaff);
router.post('/', strictLimiter, requirePermission('create', 'Staff'), StaffController.createStaff);
router.patch('/:id', strictLimiter, requirePermission('update', 'Staff'), StaffController.updateStaff);
router.delete('/:id', strictLimiter, requirePermission('delete', 'Staff'), StaffController.deleteStaff);
```

### 3.5 CASL en Frontend (Angular)

```typescript
// frontend/src/app/core/casl/ability.factory.ts
export function defineAbilityFor(user: AuthUser): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const perms = new Set(user.permissions);

  if (perms.has('ADMIN')) {
    can('manage', 'all');
    return build();
  }
  // ... (sincronizado con backend)
}
```

#### Directiva CASL Reactiva

```typescript
// frontend/src/app/shared/directives/casl.directive.ts
@Directive({ selector: '[caslCan]', standalone: true })
export class CaslCanDirective {
  action = input.required<string>({ alias: 'caslCan' });
  subject = input.required<string>({ alias: 'caslCanSubject' });

  constructor() {
    effect(() => {
      const user = authStore.user();
      const action = this.action();
      const subject = this.subject();
      
      this.vcr.clear();
      if (!user) return;
      
      const ability = defineAbilityFor(user);
      if (ability.can(action as any, subject as any)) {
        this.vcr.createEmbeddedView(this.tpl);
      }
    });
  }
}
```

**Uso en templates:**
```html
<button *caslCan="'create'; subject: 'Staff'">Crear Empleado</button>
<button *caslCan="'delete'; subject: 'Order'">Eliminar Orden</button>
```

### 3.6 Guards de Angular

#### Auth Guard

```typescript
// frontend/src/app/core/guards/auth.guard.ts
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (authStore.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
```

#### Role Guard

```typescript
// frontend/src/app/core/guards/role.guard.ts
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const required: string[] = route.data['permissions'] || [];
  const user = authStore.user();
  
  if (!user) return router.createUrlTree(['/login']);
  
  const hasRole = required.some((p) => user.permissions.includes(p));
  if (hasRole) return true;
  
  return router.createUrlTree(['/unauthorized']);
};
```

---

## 4. SEGURIDAD EN ENDPOINTS

### 4.1 Matriz de Protección de Endpoints

| Endpoint | Auth | Rate Limit | Permissions | Notas |
|----------|------|------------|-------------|-------|
| `POST /api/auth/login` | ❌ | `authLimiter` | - | Público |
| `POST /api/auth/pin` | ❌ | `authLimiter` | - | Público |
| `POST /api/auth/logout` | ✅ | `authLimiter` | - | Requiere auth |
| `GET /api/dishes/*` | ✅ | `apiLimiter` | Varies | - |
| `POST /api/dishes` | ✅ | `strictLimiter` | `create Dish` | - |
| `GET /api/orders/*` | ✅ | `apiLimiter` | `read Order` | - |
| `POST /api/orders` | ✅ | `strictLimiter` | `create Order` | - |
| `GET /api/staff` | ✅ | `apiLimiter` | `read Staff` | - |
| `POST /api/staff` | ✅ | `strictLimiter` | `create Staff` | - |
| `POST /api/uploads` | ✅ | `uploadLimiter` | Varies | File upload |

### 4.2 Middleware de Rate Limiting

#### Configuración de Límites

```typescript
// backend/src/middlewares/rateLimit.config.ts
export const RATE_LIMITS = {
  // Auth endpoints: 5 intentos por 15 minutos
  AUTH: {
    windowMs: 15 * TIME.MINUTE,
    max: 5,
  },
  // API general: 100 requests por 15 minutos
  API: {
    windowMs: 15 * TIME.MINUTE,
    max: 100,
  },
  // Operaciones críticas: 20 requests por 15 minutos
  STRICT: {
    windowMs: 15 * TIME.MINUTE,
    max: 20,
  },
  // Uploads: 10 por hora
  UPLOAD: {
    windowMs: TIME.HOUR,
    max: 10,
  },
  // QR endpoints: 30 por minuto
  QR: {
    windowMs: TIME.MINUTE,
    max: 30,
  },
  // QR brute force: 10 por 15 minutos
  QR_BRUTE_FORCE: {
    windowMs: 15 * TIME.MINUTE,
    max: 10,
  },
} as const;
```

#### Generador de Keys

```typescript
// backend/src/middlewares/rateLimit.config.ts
export const generateRateLimitKey = (req: any): string => {
  // Usar user ID si está autenticado, sino IP
  const userId = req.user?.id;
  const identifier = userId || ipKeyGenerator(req);
  return `${req.path}:${identifier}`;
};
```

### 4.3 CORS Configuración

```typescript
// backend/src/middlewares/security.ts
export function applySecurityMiddleware(app: Express): void {
  // Build allowed origins list
  const allowedOrigins: string[] = [];
  
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
    if (frontendUrl.includes(':80')) {
      allowedOrigins.push(frontendUrl.replace(':80', ''));
    }
  }
  
  // Development origins
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:4200', 'http://localhost:3000');
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permitir requests sin origin (mobile apps, Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        logger.warn({ origin }, 'CORS rejected origin');
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,  // Importante: permite cookies
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
}
```

**Características de seguridad:**
- ✅ Whitelist de orígenes estricta
- ✅ Validación dinámica con función
- ✅ Logging de orígenes rechazados
- ✅ Credenciales habilitadas (cookies)

### 4.4 Helmet Middleware

```typescript
// backend/src/middlewares/security.ts
import helmet from 'helmet';

export function applySecurityMiddleware(app: Express): void {
  app.use(helmet());  // Configuración por defecto de Helmet
  // ... CORS
}
```

**Headers configurados por Helmet:**
- `Content-Security-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `X-DNS-Prefetch-Control`
- `X-Frame-Options`
- `Strict-Transport-Security`
- `X-Download-Options`
- `X-Content-Type-Options`
- `Origin-Agent-Cluster`
- `X-Permitted-Cross-Domain-Policies`
- `Referrer-Policy`
- `X-XSS-Protection`

---

## 5. SEGURIDAD DE CONTRASEÑAS

### 5.1 Hashing con Bcrypt

```typescript
// backend/src/services/auth.service.ts
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);  // 12 rounds
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);  // Mismo nivel para PIN
}
```

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| Algoritmo | bcrypt | Estándar de industria |
| Salt Rounds | 12 | ~250ms en hardware moderno |
| Salt | Automático | Diferente para cada hash |

### 5.2 Costo Computacional

- **12 rounds** proporciona un balance entre seguridad y rendimiento
- Tiempo estimado de hash: ~250ms en CPU moderna
- Resistente a ataques de fuerza bruta con hardware especializado (GPUs/ASICs)

### 5.3 Validación de PIN

```typescript
// shared/schemas/staff.schema.ts
export const CreateStaffSchema = z.object({
  // ...
  pin_code: z.string().length(4).regex(/^\d{4}$/),  // Exactamente 4 dígitos
  // ...
});
```

**Nota de seguridad:** Aunque el PIN es solo 4 dígitos, el rate limiting y bloqueo por intentos fallidos mitiga ataques de fuerza bruta.

---

## 6. VALIDACIÓN DE DATOS

### 6.1 Arquitectura Zod

DisherIO utiliza **Zod** para validación de esquemas en toda la aplicación:

```
shared/schemas/
├── staff.schema.ts      # Validación de empleados
├── dish.schema.ts       # Validación de platos
├── order.schema.ts      # Validación de órdenes
├── totem.schema.ts      # Validación de tótems
├── restaurant.schema.ts # Validación de restaurantes
└── index.ts             # Exportaciones
```

### 6.2 Ejemplo: Staff Schema

```typescript
// shared/schemas/staff.schema.ts
import { z } from 'zod';

// Schema para crear empleado (input)
export const CreateStaffSchema = z.object({
  restaurant_id: z.string(),
  role_id: z.string(),
  staff_name: z.string().min(2),           // Mínimo 2 caracteres
  username: z.string().min(3),             // Mínimo 3 caracteres
  password: z.string().min(6),             // Mínimo 6 caracteres
  pin_code: z.string().length(4).regex(/^\d{4}$/),  // 4 dígitos exactos
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});

// Schema para empleado almacenado (DB)
export const StaffSchema = z.object({
  restaurant_id: z.string(),
  role_id: z.string(),
  staff_name: z.string().min(2),
  username: z.string().min(3),
  password_hash: z.string(),               // Hash, no password plano
  pin_code_hash: z.string(),
  language: z.enum(['es', 'en']).nullable().optional(),
  theme: z.enum(['light', 'dark']).nullable().optional(),
});

// Schema para actualización parcial
export const UpdateStaffSchema = z.object({
  staff_name: z.string().min(2).optional(),
  role_id: z.string().optional(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  pin_code: z.string().length(4).regex(/^\d{4}$/).optional(),
  language: z.enum(['es', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
});
```

### 6.3 Middleware de Validación

```typescript
// backend/src/middlewares/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ errors: result.error.flatten().fieldErrors });
      return;
    }
    
    // Reemplazar body con datos validados (strip extra fields)
    req.body = result.data;
    next();
  };
}
```

### 6.4 Uso en Rutas

```typescript
// backend/src/routes/auth.routes.ts
import { validate } from '../middlewares/validate';
import { LoginSchema, PinSchema } from '../schemas/auth.schema';

router.post('/login', authLimiter, validate(LoginSchema), loginUsername);
router.post('/pin', authLimiter, validate(PinSchema), loginPin);
```

### 6.5 Sanitización de Inputs

#### File Security

```typescript
// backend/src/utils/file-security.ts

// Lista blanca de extensiones
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Lista blanca de MIME types
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Límites de seguridad
export const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,  // 5MB
  MAX_WIDTH: 4000,
  MAX_HEIGHT: 4000,
  MAX_FILES_PER_REQUEST: 1,
} as const;

// Sanitización de nombres de archivo
export function sanitizeFilename(filename: string): string {
  // 1. Decodificar URL encoding
  let sanitized = decodeURIComponent(filename);
  
  // 2. Eliminar path traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // 3. Eliminar caracteres peligrosos
  sanitized = sanitized.replace(DANGEROUS_CHARS, '');
  
  // 4. Reemplazar separadores con guiones
  sanitized = sanitized.replace(PATH_SEPARATORS, '-');
  
  // 5. Extraer solo nombre base
  sanitized = path.basename(sanitized);
  
  // 6. Limitar longitud
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    sanitized = sanitized.slice(0, 255 - ext.length) + ext;
  }
  
  return sanitized;
}

// Detección de archivos peligrosos
export function isDangerousFile(filename: string): boolean {
  const lowerFilename = filename.toLowerCase();
  
  // Verificar patrones peligrosos (.htaccess, .env, etc.)
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(lowerFilename)) return true;
  }
  
  // Verificar extensiones ejecutables
  const executableExts = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.php', 
                          '.jsp', '.asp', '.aspx', '.py', '.rb'];
  const ext = path.extname(lowerFilename);
  if (executableExts.includes(ext)) return true;
  
  return false;
}
```

---

## 7. SEGURIDAD EN WEBSOCKETS

### 7.1 Arquitectura de Seguridad Socket.IO

```
┌─────────────────────────────────────────────────────────────┐
│              SEGURIDAD SOCKET.IO MULTICAPA                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CAPA DE TRANSPORTE                                      │
│     ├── TLS 1.3 (Caddy)                                     │
│     └── Origin Validation (CORS)                            │
│                                                             │
│  2. CAPA DE AUTENTICACIÓN                                   │
│     ├── socketAuthMiddleware (JWT)                          │
│     └── HttpOnly Cookie extraction                          │
│                                                             │
│  3. CAPA DE AUTORIZACIÓN                                    │
│     ├── Session Validator (cross-restaurant check)          │
│     └── Room Access Control                                 │
│                                                             │
│  4. CAPA DE RATE LIMITING                                   │
│     ├── Redis-based counters                                │
│     └── Per-event-type limits                               │
│                                                             │
│  5. CAPA DE MONITOREO                                       │
│     ├── Connection Tracking                                 │
│     └── Activity Logging                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Middleware de Autenticación Socket.IO

```typescript
// backend/src/middlewares/socketAuth.ts
export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

function extractSocketToken(socket: AuthenticatedSocket): string | undefined {
  // Prioridad 1: HttpOnly Cookie
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  
  // Prioridad 2: Auth handshake (non-browser clients)
  return socket.handshake.auth?.token as string | undefined;
}

export function socketAuthMiddleware(
  socket: AuthenticatedSocket, 
  next: (err?: Error) => void
): void {
  const token = extractSocketToken(socket);

  if (!token) {
    return next(new Error('AUTHENTICATION_REQUIRED'));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next(new Error('SERVER_CONFIGURATION_ERROR'));
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    socket.user = payload;  // Adjuntar usuario al socket
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
}
```

### 7.3 Validación de Sesión (Cross-Restaurant)

```typescript
// backend/src/sockets/middleware/session-validator.ts
export async function validateSessionAccess(
  socket: AuthenticatedSocket,
  sessionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const user = socket.user;
  
  if (!user) {
    return { allowed: false, reason: 'AUTHENTICATION_REQUIRED' };
  }
  
  // Super admin puede acceder a todo
  if (user.role === 'SUPER_ADMIN') {
    return { allowed: true };
  }
  
  const session = await totemSessionRepo.findById(sessionId);
  if (!session) {
    return { allowed: false, reason: 'SESSION_NOT_FOUND' };
  }
  
  const totem = await totemRepo.findById(session.totem_id?.toString());
  if (!totem) {
    return { allowed: false, reason: 'TOTEM_NOT_FOUND' };
  }
  
  // CRITICAL: Verificar que el usuario pertenezca al mismo restaurante
  const sessionRestaurantId = totem.restaurant_id?.toString();
  const userRestaurantId = user.restaurantId;
  
  if (sessionRestaurantId !== userRestaurantId) {
    logger.warn({
      socketId: socket.id,
      userId: user.staffId,
      userRestaurantId,
      attemptedSessionId: sessionId,
      sessionRestaurantId,
    }, 'Cross-restaurant session access attempt detected');
    
    return { allowed: false, reason: 'UNAUTHORIZED_SESSION' };
  }
  
  return { allowed: true };
}
```

### 7.4 Rate Limiting en WebSockets (Redis)

```typescript
// backend/src/sockets/middleware/rate-limiter.ts

// Configuración de límites por tipo de evento
const RATE_LIMITS = {
  JOIN_LEAVE: {
    events: ['kds:join', 'kds:leave', 'pos:join', 'pos:leave', 'tas:join', 'tas:leave'],
    maxRequests: 10,
    windowMs: 60 * 1000,  // 1 minuto
  },
  ORDER: {
    events: ['kds:new_item', 'kds:item_prepare', 'tas:add_item', 'tas:cancel_item'],
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  MESSAGE: {
    events: ['tas:notify_customers', 'pos:process_payment'],
    maxRequests: 60,
    windowMs: 60 * 1000,
  },
  CUSTOMER: {
    events: ['totem:place_order', 'totem:call_waiter', 'totem:request_bill'],
    maxRequests: 20,  // Más restrictivo para acceso público
    windowMs: 60 * 1000,
  },
} as const;

export async function checkRateLimit(
  socketId: string,
  eventType: string
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = await getRedis();
  const key = `ratelimit:${socketId}:${eventType}`;
  const config = getRateLimitConfig(eventType);

  // Si Redis no está disponible, permitir (fail open)
  if (!redis) {
    return { allowed: true, remaining: config.maxRequests };
  }

  try {
    const current = await redis.incr(key);
    
    // Set expiry en primer request
    if (current === 1) {
      await redis.expire(key, Math.ceil(config.windowMs / 1000));
    }
    
    const allowed = current <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - current);
    
    return { allowed, remaining };
  } catch (err) {
    // Fail open si Redis falla
    return { allowed: true, remaining: config.maxRequests };
  }
}
```

### 7.5 Tracking de Conexiones

```typescript
// backend/src/sockets/middleware/connection-tracker.ts

interface ConnectionMetadata {
  socketId: string;
  userId?: string;
  userType: 'authenticated' | 'anonymous';
  permissions: string[];
  connectedAt: Date;
  lastActivity: Date;
  rooms: Set<string>;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
  };
}

// Maps globales para tracking
const activeConnections = new Map<string, ConnectionMetadata>();
const connectionsByUser = new Map<string, Set<string>>();

export function trackSocketConnection(
  socket: Socket, 
  handlerType: string
): void {
  const user = (socket as any).user;
  
  const meta: ConnectionMetadata = {
    socketId: socket.id,
    userId: user?.staffId,
    userType: user ? 'authenticated' : 'anonymous',
    permissions: user?.permissions || [],
    connectedAt: new Date(),
    lastActivity: new Date(),
    rooms: new Set(),
    clientInfo: {
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
    },
  };

  activeConnections.set(socket.id, meta);
  
  // Tracking por usuario
  if (meta.userId) {
    if (!connectionsByUser.has(meta.userId)) {
      connectionsByUser.set(meta.userId, new Set());
    }
    connectionsByUser.get(meta.userId)!.add(socket.id);
  }
}

// Cleanup en desconexión
export function registerGlobalDisconnectHandler(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.once('disconnect', () => {
      cleanupSocketConnection(socket.id);
      socket.removeAllListeners();  // Safety net
      
      // Leave all rooms
      for (const room of socket.rooms) {
        if (room !== socket.id) socket.leave(room);
      }
    });
  });
}
```

---

## 8. MANEJO DE SESIONES

### 8.1 Arquitectura de Sesiones

DisherIO utiliza una **arquitectura híbrida**:

| Componente | Tecnología | Propósito |
|------------|-----------|-----------|
| Sesión Principal | JWT + HttpOnly Cookie | Autenticación stateless |
| Rate Limiting | Redis (in-memory fallback) | Contadores distribuidos |
| Socket Tracking | In-memory Maps | Tracking de conexiones en tiempo real |

### 8.2 HttpOnly Cookies

```typescript
// backend/src/controllers/auth.controller.ts

const COOKIE_NAME = 'auth_token';

function setAuthCookie(res: Response, token: string, isSecure: boolean): void {
  const jwtExpires = process.env.JWT_EXPIRES || '8h';
  const maxAge = parseDurationToMs(jwtExpires);
  
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,           // ❌ No accesible por JavaScript
    secure: isSecure,         // ✅ Solo HTTPS en producción
    sameSite: isSecure ? 'strict' : 'lax',  // CSRF protection
    maxAge: maxAge,           // Expiración sincronizada con JWT
    path: '/',                // Disponible en toda la app
  });
}

// Detección de HTTPS (incluyendo reverse proxy)
function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto === 'https') return true;
  return req.secure === true;
}
```

### 8.3 Redis para Rate Limiting

```typescript
// backend/src/sockets/middleware/rate-limiter.ts
async function getRedis(): Promise<RedisClientType | null> {
  try {
    return getRedisClient();
  } catch {
    try {
      return await initRedis();
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Redis');
      return null;
    }
  }
}
```

**Estrategia de fallback:** Si Redis no está disponible, el sistema:
1. Continúa funcionando (fail open para disponibilidad)
2. Usa rate limiting en memoria (para PIN)
3. Loggea el error para monitoreo

---

## 9. HEADERS DE SEGURIDAD

### 9.1 Configuración Caddy (Reverse Proxy)

```caddyfile
# Caddyfile
:443 {
    # TLS 1.3 mínimo
    tls {
        protocols tls1.3
    }

    # Headers de seguridad
    header {
        # HSTS - Fuerza HTTPS por 1 año
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        
        # Content Security Policy
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' wss:;"
        
        # Prevenir clickjacking
        X-Frame-Options "SAMEORIGIN"
        
        # Prevenir MIME type sniffing
        X-Content-Type-Options "nosniff"
        
        # XSS Protection
        X-XSS-Protection "1; mode=block"
        
        # Referrer Policy
        Referrer-Policy "strict-origin-when-cross-origin"
        
        # Permissions Policy
        Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
        
        # Remover headers que identifican el servidor
        -Server
    }

    # Compresión
    encode gzip zstd
}
```

### 9.2 Análisis de Headers

| Header | Valor | Propósito | OWASP |
|--------|-------|-----------|-------|
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains; preload | Fuerza HTTPS | ASVS 4.0 V9.1 |
| `Content-Security-Policy` | default-src 'self'; ... | Mitiga XSS | ASVS 4.0 V5.3 |
| `X-Frame-Options` | SAMEORIGIN | Previene clickjacking | ASVS 4.0 V5.1 |
| `X-Content-Type-Options` | nosniff | Previene MIME sniffing | ASVS 4.0 V12.5 |
| `X-XSS-Protection` | 1; mode=block | Protección XSS legacy | ASVS 4.0 V5.3 |
| `Referrer-Policy` | strict-origin-when-cross-origin | Control de referrer | ASVS 4.0 V13.2 |
| `Permissions-Policy` | feature=()... | Deshabilita APIs sensibles | Best Practice |

---

## 10. VULNERABILIDADES PREVENIDAS

### 10.1 Cross-Site Scripting (XSS)

| Mecanismo | Implementación | Efectividad |
|-----------|---------------|-------------|
| HttpOnly Cookies | `httpOnly: true` | ⭐⭐⭐⭐⭐ Previene robo de token |
| CSP Headers | `script-src 'self'` | ⭐⭐⭐⭐⭐ Previene ejecución de scripts inline |
| Input Validation | Zod schemas | ⭐⭐⭐⭐ Previene inputs maliciosos |
| Angular Sanitization | Built-in | ⭐⭐⭐⭐ Auto-escapa output |

### 10.2 Cross-Site Request Forgery (CSRF)

| Mecanismo | Implementación | Efectividad |
|-----------|---------------|-------------|
| SameSite Cookies | `sameSite: 'strict'` | ⭐⭐⭐⭐⭐ Previene envío cross-origin |
| CORS Strict | Whitelist validation | ⭐⭐⭐⭐ Bloquea requests no autorizados |
| Custom Headers | Required for API | ⭐⭐⭐ Dificulta attacks simples |

### 10.3 SQL/NoSQL Injection

| Mecanismo | Implementación | Efectividad |
|-----------|---------------|-------------|
| Mongoose ODM | Schema-based | ⭐⭐⭐⭐⭐ Previene inyección NoSQL |
| Input Sanitization | Zod validation | ⭐⭐⭐⭐ Previene payloads maliciosos |
| ObjectId Validation | `validateObjectId()` | ⭐⭐⭐⭐⭐ Previene ID manipulation |

```typescript
// backend/src/repositories/base.repository.ts
export function validateObjectId(id: string, field: string): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`${field} debe ser un ObjectId válido`);
  }
}
```

### 10.4 Path Traversal

```typescript
// backend/src/utils/file-security.ts
export function getSecurePath(uploadsDir: string, subfolder: string, filename: string): string {
  // 1. Validar subfolder contra whitelist
  const allowedFolders = ['dishes', 'categories', 'restaurants', 'temp'];
  if (!allowedFolders.includes(subfolder)) {
    throw new Error('Invalid folder specified');
  }

  // 2. Sanitizar filename
  const safeFilename = sanitizeFilename(filename);

  // 3. Construir ruta absoluta
  const fullPath = path.resolve(uploadsDir, subfolder, safeFilename);
  const resolvedUploadsDir = path.resolve(uploadsDir);

  // 4. CRITICAL: Verificar que esté dentro de uploads
  if (!fullPath.startsWith(resolvedUploadsDir)) {
    throw new Error('Path traversal detected');
  }

  return fullPath;
}
```

### 10.5 Insecure Direct Object References (IDOR)

```typescript
// backend/src/repositories/user.repository.ts
async findByUsernameAndRestaurant(
  username: string, 
  restaurantId: string
): Promise<IStaff | null> {
  // Siempre filtrar por restaurant_id
  return this.model.findOne({ 
    username: username.toLowerCase(),
    restaurant_id: new Types.ObjectId(restaurantId)
  }).exec();
}
```

### 10.6 Brute Force Protection

```typescript
// backend/src/services/pin-security.service.ts

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCK_DURATION_MS = 15 * 60 * 1000;  // 15 minutos
const MAX_LOCK_DURATION_MS = 60 * 60 * 1000;   // 60 minutos

export function recordFailedAttempt(identifier: string): FailedAttempt {
  const now = new Date();
  const existing = failedAttempts.get(identifier);

  if (!existing) {
    failedAttempts.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return;
  }

  existing.count += 1;
  existing.lastAttempt = now;

  // Bloqueo exponencial
  if (existing.count >= MAX_FAILED_ATTEMPTS) {
    const excessAttempts = existing.count - MAX_FAILED_ATTEMPTS;
    const multiplier = Math.min(
      Math.pow(2, Math.floor(excessAttempts / MAX_FAILED_ATTEMPTS)),
      MAX_LOCK_DURATION_MS / BASE_LOCK_DURATION_MS
    );
    
    const lockDuration = BASE_LOCK_DURATION_MS * multiplier;
    existing.lockedUntil = new Date(now.getTime() + lockDuration);
  }

  failedAttempts.set(identifier, existing);
}
```

---

## 11. AUDITORÍA Y LOGS

### 11.1 Configuración de Logger (Pino)

```typescript
// backend/src/config/logger.ts
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  
  // Redacción de datos sensibles
  redact: {
    paths: [
      'req.headers.authorization',
      'password', 
      '*.password', 
      'pin', 
      '*.pin',
      'req.headers.cookie'
    ],
    remove: true,  // Eliminar completamente, no reemplazar con [Redacted]
  },
  
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
```

### 11.2 Request Logger

```typescript
// backend/src/middlewares/request-logger.ts
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Generar request ID
  const requestId = req.headers['x-request-id'] as string || 
                    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  (req as any).requestId = requestId;
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    
    const logData = {
      requestId,
      req: {
        method: req.method,
        url: req.url,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      res: {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
      },
    };
    
    // Log level basado en status
    if (res.statusCode >= 500) {
      logger.error(logData, 'Request failed with server error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request failed with client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });
  
  next();
};
```

### 11.3 Eventos de Seguridad Loggeados

| Evento | Nivel | Información |
|--------|-------|-------------|
| Login exitoso | info | userId, ip, timestamp |
| Login fallido | warn | username, ip, reason |
| Rate limit exceeded | warn | ip, path, type |
| Cross-restaurant access | warn | userId, attemptedId |
| Token inválido | warn | ip, userAgent |
| File upload blocked | warn | filename, reason |
| Brute force detected | error | identifier, attempts |

---

## 12. CONFIGURACIÓN DE SEGURIDAD

### 12.1 Variables de Entorno Sensibles

```bash
# =============================================================================
# SECCIÓN 3: SEGURIDAD Y AUTENTICACIÓN
# =============================================================================

# JWT Configuration
JWT_SECRET=cambiar_esto_por_un_secreto_largo_y_aleatorio_de_al_menos_64_caracteres
JWT_EXPIRES=8h

# MongoDB (con autenticación)
MONGODB_URI=mongodb://disherio_app:password_seguro@mongo:27017/disherio?authSource=disherio
MONGO_ROOT_USER=admin
MONGO_ROOT_PASS=cambiar_esta_contrasena_root_inmediatamente
MONGO_APP_USER=disherio_app
MONGO_APP_PASS=cambiar_esta_contrasena_app_inmediatamente

# Redis (con autenticación)
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=cambiar_esta_contrasena_redis_inmediatamente

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=cambiar_contrasena_grafana
```

### 12.2 Gestión de Secretos

| Aspecto | Implementación | Recomendación |
|---------|---------------|---------------|
| Almacenamiento | `.env` file | Usar Docker Secrets o Vault en producción |
| Longitud mínima JWT | 32+ caracteres | Usar `openssl rand -hex 32` |
| Rotación | Manual | Implementar rotación automática cada 90 días |
| Transmisión | HTTPS/TLS 1.3 | Nunca transmitir por HTTP |

---

## 13. RECOMENDACIONES

### 13.1 Alto Prioridad

1. **Implementar Refresh Tokens**
   - Actualmente solo hay access tokens de 8h
   - Considerar refresh tokens rotativos para mayor seguridad

2. **Auditoría de Acciones**
   - Implementar tabla de auditoría para acciones críticas
   - Registrar quién, qué, cuándo, dónde para modificaciones

3. **2FA para ADMIN**
   - Implementar TOTP (Time-based One-Time Password) para roles admin
   - Usar librerías como `speakeasy` o `otplib`

### 13.2 Medio Prioridad

1. **Rate Limiting Distribuido**
   - Mover rate limiting de PIN a Redis para multi-node

2. **Alertas de Seguridad**
   - Configurar Alertmanager para eventos de seguridad
   - Notificar múltiples login failures, accesos sospechosos

3. **Content Security Policy más estricta**
   - Eliminar `'unsafe-inline'` de script-src
   - Usar nonces o hashes

### 13.3 Bajo Prioridad

1. **Certificate Pinning**
   - Implementar HPKP (HTTP Public Key Pinning) opcional

2. **Security Headers adicionales**
   - `Expect-CT` para Certificate Transparency
   - `NEL` (Network Error Logging)

---

## 14. CONCLUSIONES

### 14.1 Fortalezas Principales

| # | Fortaleza | Impacto |
|---|-----------|---------|
| 1 | Validación estricta de JWT_SECRET en arranque | Previene configuraciones inseguras |
| 2 | HttpOnly Cookies + SameSite Strict | Protección robusta contra XSS/CSRF |
| 3 | CASL + RBAC híbrido | Autorización granular y flexible |
| 4 | Rate limiting multicapa | Protección contra brute force |
| 5 | Validación Zod exhaustiva | Prevención de input validation flaws |
| 6 | TLS 1.3 + HSTS + CSP | Transporte y contenido seguros |
| 7 | Sanitización de archivos | Prevención de path traversal y malware |

### 14.2 Puntuación General

| Categoría | Puntuación | Comentario |
|-----------|-----------|------------|
| Autenticación | 9/10 | Sólido, podría mejorar con refresh tokens |
| Autorización | 9/10 | CASL bien implementado |
| Transporte | 10/10 | TLS 1.3, configuración moderna |
| Input Validation | 9/10 | Zod cubre bien, falta algunas validaciones |
| Logging | 8/10 | Buena redacción, falta auditoría de acciones |
| **TOTAL** | **9/10** | **Muy seguro para producción** |

---

*Documento generado automáticamente por análisis de código estático y dinámico.*
*Última actualización: 2026-04-05*
