# Backend Debug Report - DisherIO

**Fecha:** 2026-03-26  
**Revisor:** Backend Developer Agent  
**Ubicación:** `/root/.openclaw/workspace/projects/disherio-refactor/backend/src`

---

## 📊 Resumen Ejecutivo

| Categoría | Críticos | Medios | Bajos | Total |
|-----------|----------|--------|-------|-------|
| Bugs | 3 | 4 | 2 | 9 |
| Problemas de Manejo de Errores | 2 | 3 | 1 | 6 |
| Mejoras de Seguridad | 1 | 2 | 1 | 4 |

---

## 🐛 Bugs Encontrados

### CRÍTICOS

#### BUG-01: Error Handler Global Ausente
**Archivo:** `index.ts` (línea 1-50)  
**Severidad:** 🔴 Crítico

**Problema:** No existe un middleware de manejo de errores global. Cuando ocurre un error no controlado, Express responde con HTML por defecto en lugar de JSON, exponiendo información sensible y rompiendo el contrato de API.

**Código problemático:**
```typescript
// index.ts - NO hay error handler global
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

initSocket(httpServer);
// Falta: app.use(errorHandler);
```

**Fix propuesto:**
```typescript
// Crear middlewares/errorHandler.ts
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error({ err, path: req.path }, 'Unhandled error');
  
  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message });
    return;
  }
  
  if (err.name === 'CastError') {
    res.status(400).json({ error: 'Invalid ID format' });
    return;
  }
  
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
}

// En index.ts, AGREGAR al final:
app.use(errorHandler);
```

---

#### BUG-02: Escape de Errores de Validación en Base Repository
**Archivo:** `repositories/base.repository.ts` (líneas 13-26)  
**Severidad:** 🔴 Crítico

**Problema:** `ValidationError` es lanzada pero no hay try/catch en los métodos que la usan, causando que el servidor crashee o devuelva stack traces.

**Código problemático:**
```typescript
export function validateObjectId(id: string, fieldName: string = 'id'): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`INVALID_${fieldName.toUpperCase().replace(/\s/g, '_')}`);
  }
}
```

**Fix propuesto:** Los controllers deben envolver llamadas con try/catch o usar asyncHandler wrapper.

---

#### BUG-03: Login con PIN Ineficiente y Potencial DoS
**Archivo:** `services/auth.service.ts` (líneas 52-74)  
**Severidad:** 🔴 Crítico

**Problema:** `loginWithPin` trae TODOS los empleados del restaurante y compara bcrypt uno por uno. Esto es O(n) con bcrypt (operación costosa). Un restaurante con 100+ empleados puede causar timeout.

**Código problemático:**
```typescript
export async function loginWithPin(pin: string, restaurantId: string) {
  const staffMembers = await userRepo.findByRestaurantId(restaurantId); // Trae todos
  
  for (const staff of staffMembers) {
    const pinMatch = await bcrypt.compare(pin, staff.pin_code_hash); // bcrypt O(n)
    // ...
  }
}
```

**Fix propuesto:**
```typescript
// Opción 1: Hash determinístico para lookup
export async function loginWithPin(pin: string, restaurantId: string) {
  // Usar HMAC-SHA256 para generar un "lookup hash"
  const lookupHash = crypto
    .createHmac('sha256', process.env.PIN_LOOKUP_SECRET!)
    .update(`${restaurantId}:${pin}`)
    .digest('hex');
  
  const staff = await userRepo.findByPinLookupHash(lookupHash);
  if (!staff) throw new Error('INVALID_PIN');
  
  // Verificar bcrypt solo del match
  const pinMatch = await bcrypt.compare(pin, staff.pin_code_hash);
  // ...
}

// Opción 2: Indexar por restaurant_id + pin_hash_prefix (primeros 8 chars)
```

---

### MEDIOS

#### BUG-04: Modelo Staff sin Índice Compuesto para Email
**Archivo:** `models/staff.model.ts` (líneas 32-44)  
**Severidad:** 🟠 Medio

**Problema:** `email` tiene `unique: true` pero no hay índice explícito en `restaurant_id + email`, permitiendo que un email exista en múltiples restaurantes (¿feature o bug?) pero causando queries lentas.

**Código problemático:**
```typescript
const StaffSchema = new Schema<IStaff>({
  restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  staff_name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true }, // ⚠️ Unique global
  // ...
});

// Solo hay: StaffSchema.index({ restaurant_id: 1 });
```

**Fix propuesto:**
```typescript
// Si el email debe ser único por restaurante:
StaffSchema.index({ restaurant_id: 1, email: 1 }, { unique: true });

// Si el email es globalmente único (actual), agregar índice para queries:
StaffSchema.index({ email: 1 });
```

---

#### BUG-05: Inconsistencia en Respuestas de Error
**Archivo:** `controllers/auth.controller.ts` (líneas 6-28)  
**Severidad:** 🟠 Medio

**Problema:** Los errores no usan el sistema de internacionalización (i18n) configurado. Mensajes hardcodeados en inglés.

**Código problemático:**
```typescript
if (err.message === 'INVALID_CREDENTIALS') {
  res.status(401).json({ error: 'Invalid credentials' }); // Hardcoded
} else {
  res.status(500).json({ error: 'Server error' }); // Hardcoded
}
```

**Fix propuesto:**
```typescript
import { t } from '../config/i18n';

if (err.message === 'INVALID_CREDENTIALS') {
  res.status(401).json({ error: t(req, 'auth.invalid_credentials') });
}
```

---

#### BUG-06: Race Condition en Toggle Dish Status
**Archivo:** `repositories/dish.repository.ts` (líneas 69-77)  
**Severidad:** 🟠 Medio

**Problema:** Read-modify-write sin atomicidad. Dos requests concurrentes pueden causar estado inconsistente.

**Código problemático:**
```typescript
async toggleStatus(id: string): Promise<IDish | null> {
  const dish = await this.model.findById(id).exec(); // Read
  if (!dish) return null;

  dish.disher_status = dish.disher_status === 'ACTIVATED' ? 'DESACTIVATED' : 'ACTIVATED';
  return dish.save(); // Write (no atomic)
}
```

**Fix propuesto:**
```typescript
async toggleStatus(id: string): Promise<IDish | null> {
  const dish = await this.model.findById(id).exec();
  if (!dish) return null;
  
  // Atomic update
  return this.model.findByIdAndUpdate(
    id,
    { 
      $set: { 
        disher_status: dish.disher_status === 'ACTIVATED' ? 'DESACTIVATED' : 'ACTIVATED' 
      } 
    },
    { new: true }
  ).exec();
}
```

---

#### BUG-07: Validación de Schema Zod sin Coerción de Tipos
**Archivo:** `middlewares/validate.ts` (líneas 5-13)  
**Severidad:** 🟠 Medio

**Problema:** `safeParse` no transforma tipos. Si un campo numérico viene como string en JSON, fallará la validación aunque sea convertible.

**Código problemático:**
```typescript
const result = schema.safeParse(req.body);
if (!result.success) {
  res.status(400).json({ errors: result.error.flatten().fieldErrors });
  return;
}
```

**Fix propuesto:**
```typescript
// Usar parse en lugar de safeParse con coerce en schemas
// O en el middleware:
const result = schema.safeParse(req.body);
if (!result.success) {
  const formattedErrors = result.error.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message
  }));
  res.status(400).json({ errors: formattedErrors });
  return;
}
```

---

### BAJOS

#### BUG-08: JWT Payload Expuesto sin Campos Esenciales
**Archivo:** `services/auth.service.ts` (líneas 24-31, 60-67)  
**Severidad:** 🟡 Bajo

**Problema:** El JWT no incluye `iat` (issued at) ni `jti` (JWT ID) para invalidación por logout.

**Código actual:**
```typescript
const payload = {
  staffId: staff._id.toString(),
  restaurantId: staff.restaurant_id.toString(),
  role: role?.role_name || '',
  permissions,
  name: staff.staff_name,
};
```

**Fix propuesto:**
```typescript
const payload = {
  staffId: staff._id.toString(),
  restaurantId: staff.restaurant_id.toString(),
  role: role?.role_name || '',
  permissions,
  name: staff.staff_name,
  jti: crypto.randomUUID(), // Para invalidación
};

// Implementar blacklist de JWT en Redis para logout
```

---

#### BUG-09: Logger sin Contexto de Request
**Archivo:** `config/logger.ts` (asumido)  
**Severidad:** 🟡 Bajo

**Problema:** Los logs no incluyen correlation ID ni request ID, dificultando trazabilidad en producción.

**Fix propuesto:**
```typescript
// Agregar en middleware de request
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  logger.child({ requestId: req.id });
  next();
});
```

---

## ⚠️ Problemas de Manejo de Errores

### CRÍTICOS

#### ERR-01: Controllers sin Try/Catch o Manejo Incompleto
**Archivos:** Varios controllers  
**Impacto:** Crashes del servidor

**Controllers afectados:**
- `dish.controller.ts` - Todos los métodos usan `catch { res.status(500)... }` sin logging
- `order.controller.ts` - Similar patrón
- `auth.controller.ts` - Manejo específico pero sin logger

**Ejemplo problemático:**
```typescript
export async function createDish(req: Request, res: Response): Promise<void> {
  try {
    const dish = await DishService.createDish({ ...req.body, restaurant_id: req.user!.restaurantId });
    res.status(201).json(dish);
  } catch {  // ⚠️ Error sin capturar ni loguear
    res.status(500).json({ error: 'Server error' });
  }
}
```

**Fix propuesto - Wrapper:**
```typescript
// utils/asyncHandler.ts
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Uso:
router.post('/', asyncHandler(createDish));
```

---

#### ERR-02: Repositorios Propagan Errores sin Contexto
**Archivo:** `repositories/*.ts`  
**Impacto:** Mensajes de error crípticos para debugging

**Ejemplo:**
```typescript
async findById(id: string): Promise<T | null> {
  this.validateId(id); // Puede lanzar ValidationError
  return this.model.findById(id).exec(); // Puede lanzar MongoError
}
```

**Fix propuesto:**
```typescript
async findById(id: string): Promise<T | null> {
  try {
    this.validateId(id);
    return await this.model.findById(id).exec();
  } catch (err) {
    logger.error({ err, id, operation: 'findById' }, 'Repository error');
    throw err;
  }
}
```

---

### MEDIOS

#### ERR-03: Servicios Capturan y Relanzan Errores Genéricos
**Archivo:** `services/order.service.ts` (línea 30-33)  
**Severidad:** 🟠 Medio

**Problema:** Los errores específicos se pierden al relanzar genéricos.

**Código problemático:**
```typescript
try {
  const session = await totemSessionRepo.findById(sessionId);
  if (!session || session.totem_state !== 'STARTED') throw new Error('SESSION_NOT_ACTIVE');
  return orderRepo.createOrder(sessionId, staffId, customerId);
} catch (err) {
  if (err instanceof ValidationError) throw err;
  throw new Error('SESSION_NOT_ACTIVE'); // ⚠️ Pérdida de información real
}
```

**Fix propuesto:**
```typescript
} catch (err) {
  if (err instanceof ValidationError) throw err;
  if (err instanceof mongoose.Error.CastError) {
    throw new Error('INVALID_SESSION_ID');
  }
  logger.error({ err }, 'Unexpected error in createOrder');
  throw new Error('SESSION_OPERATION_FAILED');
}
```

---

#### ERR-04: Middleware Auth sin Diferenciación de Errores JWT
**Archivo:** `middlewares/auth.ts` (líneas 31-32)  
**Severidad:** 🟠 Medio

**Problema:** Todos los errores JWT devuelven el mismo mensaje, dificultando debugging.

**Código:**
```typescript
try {
  // ...
} catch {
  res.status(401).json({ error: 'Invalid or expired token' });
}
```

**Fix propuesto:**
```typescript
} catch (err: any) {
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'TOKEN_EXPIRED', expiredAt: err.expiredAt });
  } else if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'TOKEN_INVALID' });
  } else {
    res.status(401).json({ error: 'TOKEN_VERIFICATION_FAILED' });
  }
}
```

---

#### ERR-05: Socket Auth con Mensajes de Error Genéricos
**Archivo:** `middlewares/socketAuth.ts` (líneas 12-26)  
**Severidad:** 🟠 Medio

**Problema:** Similar al auth HTTP, sin granularidad en errores.

---

### BAJOS

#### ERR-06: Funciones sin Tipado de Retorno de Error
**Varios archivos**  
**Severidad:** 🟡 Bajo

**Problema:** Muchas funciones async no tipan qué errores pueden lanzar.

---

## 🔒 Problemas de Seguridad

### CRÍTICOS

#### SEC-01: JWT_SECRET sin Validación Estricta en Runtime
**Archivo:** `services/auth.service.ts` (líneas 9-13)  
**Severidad:** 🔴 Crítico

**Problema:** Aunque hay validación, el proceso crashea en startup sin logging adecuado.

**Código:**
```typescript
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

**Fix propuesto:**
```typescript
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  logger.fatal('JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

// Validar que no sea un default conocido
const weakSecrets = ['secret', 'jwt_secret', 'your-secret', 'test'];
if (weakSecrets.includes(JWT_SECRET.toLowerCase())) {
  logger.fatal('JWT_SECRET appears to be a weak/default value');
  process.exit(1);
}
```

---

### MEDIOS

#### SEC-02: Rate Limiting no Aplicado Globalmente
**Archivo:** `index.ts` (línea 28)  
**Severidad:** 🟠 Medio

**Problema:** El rate limiter solo aplica a `/api/*`, dejando `/health` y WebSockets sin protección.

**Fix propuesto:**
```typescript
// Agregar rate limiting por IP global
app.use(limiter);

// Rate limiting específico para auth más estricto
app.use('/api/auth', authLimiter);
```

---

#### SEC-03: CORS Permite Credentials sin Origen Estricto
**Archivo:** `middlewares/security.ts` (líneas 12-26)  
**Severidad:** 🟠 Medio

**Problema:** `credentials: true` con origen dinámico en desarrollo puede ser explotado.

**Fix propuesto:**
```typescript
const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  // ...
};
```

---

### BAJOS

#### SEC-04: Información de Versión Expuesta
**Archivo:** `index.ts` (implícito)  
**Severidad:** 🟡 Bajo

**Problema:** Helmet no configura `hidePoweredBy` explícitamente.

**Fix:**
```typescript
app.use(helmet({ hidePoweredBy: true }));
```

---

## 🔧 Fixes Recomendados Prioritarios

### Inmediatos (Alta Prioridad)

1. **Implementar Error Handler Global** - Evita leaks de información y crashes
2. **Agregar Async Handler** - Elimina try/catch repetitivos en controllers
3. **Optimizar Login PIN** - Implementar lookup hash para evitar DoS
4. **Agregar Índices Faltantes** - Mejorar performance de queries frecuentes

### Corto Plazo (Media Prioridad)

5. **Unificar Sistema de Errores** - Usar clases de error personalizadas
6. **Implementar i18n en Errores** - Usar el sistema ya configurado
7. **Agregar Request ID** - Mejorar trazabilidad
8. **Mejorar Validación de JWT** - Diferenciar tipos de error

### Largo Plazo (Baja Prioridad)

9. **Implementar JWT Blacklist** - Permitir logout efectivo
10. **Agregar Métricas** - Prometheus/Grafana para monitoreo
11. **Rate Limiting por Usuario** - Más granular que por IP

---

## 📝 Código de Fixes Aplicables

### Fix 1: Async Handler Wrapper
```typescript
// utils/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Fix 2: Error Handler Global
```typescript
// middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ValidationError } from '../repositories/base.repository';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ 
    err, 
    path: req.path, 
    method: req.method,
    requestId: (req as any).id 
  }, 'Error handling request');

  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({ error: 'INVALID_ID_FORMAT' });
    return;
  }

  if (err.name === 'MongoServerError' && err.code === 11000) {
    res.status(409).json({ error: 'DUPLICATE_ENTRY' });
    return;
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'INTERNAL_ERROR' 
      : err.message,
    requestId: (req as any).id
  });
}
```

### Fix 3: Índices para Staff Model
```typescript
// models/staff.model.ts
// Agregar después de definir el schema:

// Para búsquedas por email (único global o por restaurante)
StaffSchema.index({ email: 1 }, { unique: true });

// Para queries por restaurante
StaffSchema.index({ restaurant_id: 1 });

// Para lookups de PIN (si se implementa lookup hash)
// StaffSchema.index({ restaurant_id: 1, pin_lookup_hash: 1 });
```

### Fix 4: Clases de Error Personalizadas
```typescript
// errors/AppError.ts
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}_NOT_FOUND`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'UNAUTHORIZED') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'FORBIDDEN') {
    super(message, 403);
  }
}
```

---

## ✅ Checklist de Implementación

- [ ] Crear `middlewares/errorHandler.ts`
- [ ] Crear `utils/asyncHandler.ts`
- [ ] Crear `errors/AppError.ts`
- [ ] Actualizar `index.ts` para usar error handler global
- [ ] Actualizar todos los controllers para usar asyncHandler
- [ ] Agregar índices faltantes en modelos
- [ ] Optimizar `loginWithPin` con lookup hash
- [ ] Implementar request ID middleware
- [ ] Unificar mensajes de error con i18n
- [ ] Agregar validación de JWT_SECRET más estricta

---

## 📊 Métricas de Código

| Métrica | Valor |
|---------|-------|
| Total de archivos revisados | 28 |
| Total de líneas de código | ~2500 |
| Controllers | 3 |
| Services | 5 |
| Repositories | 6 |
| Models | 5 |
| Middlewares | 7 |
| Tests unitarios encontrados | 4 |

---

*Reporte generado automáticamente por Backend Developer Agent*  
*Sistema de Agentes Dev - Kimi Claw Team*
