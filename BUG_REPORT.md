# Bug Report - Disherio

**Fecha del análisis:** 2026-04-06  
**Repositorio:** ismailhaddouche/disherio  
**Total de issues:** 18  

| Severidad | Cantidad |
|-----------|----------|
| Crítico   | 2        |
| Alto      | 5        |
| Medio     | 7        |
| Bajo      | 4        |

---

## CRÍTICOS

---

### BUG-001 — Content-Security-Policy con directivas inseguras

| Campo      | Detalle |
|------------|---------|
| Archivo    | `Caddyfile` (línea 28) |
| Tipo       | Configuración de seguridad |
| Severidad  | **CRÍTICO** |

**Descripción:**  
El header `Content-Security-Policy` incluye las directivas `'unsafe-inline'` y `'unsafe-eval'` en `script-src`. Esto anula completamente la protección que ofrece CSP, permitiendo la ejecución de scripts inline y la evaluación arbitraria de código. La aplicación queda expuesta a ataques XSS.

**Código afectado:**
```
Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...
```

**Impacto:**  
Un atacante que logre inyectar contenido HTML en la página puede ejecutar JavaScript arbitrario en el contexto del navegador del usuario.

**Solución recomendada:**  
- Eliminar `'unsafe-eval'` completamente.
- Eliminar `'unsafe-inline'` de `script-src`.
- Usar nonces o hashes específicos para los scripts de Angular.

---

### BUG-002 — Datos sensibles de autenticación almacenados en `localStorage`

| Campo      | Detalle |
|------------|---------|
| Archivo    | `frontend/src/app/store/auth.store.ts` (líneas 40–54, 64–68) |
| Tipo       | Seguridad — Fuga de información |
| Severidad  | **CRÍTICO** |

**Descripción:**  
El objeto de usuario completo (incluyendo `staffId`, `role`, `permissions` y `name`) se serializa y almacena en texto plano en `localStorage`. Cualquier script JavaScript ejecutado en el contexto de la página puede leer este dato, incluyendo payloads XSS o librerías de terceros comprometidas.

**Código afectado:**
```typescript
localStorage.setItem('auth_user', JSON.stringify(data));
```

**Impacto:**  
Exposición de roles y permisos del usuario. Un atacante con XSS puede exfiltrar la sesión completa.

**Solución recomendada:**  
- Eliminar datos sensibles de `localStorage`.
- Gestionar la autenticación exclusivamente mediante cookies `HttpOnly` + `Secure` (el backend ya las genera correctamente).
- Si se necesita metadata en cliente, almacenar solo datos no sensibles.

---

## ALTOS

---

### BUG-003 — Rate limiting del PIN en memoria (no distribuido)

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/services/pin-security.service.ts` (línea 21) |
| Tipo       | Error de lógica — Bypass de rate limiting |
| Severidad  | **ALTO** |

**Descripción:**  
La protección contra fuerza bruta del PIN usa un `Map` en memoria del proceso Node.js. En despliegues con múltiples instancias detrás de un load balancer, cada instancia mantiene su propio contador independiente. Un atacante puede distribuir los intentos entre instancias para evadir el límite.

**Código afectado:**
```typescript
const failedAttempts = new Map<string, FailedAttempt>();
```

**Impacto:**  
En producción multi-instancia, el rate limiting de PIN es efectivamente inoperable, permitiendo ataques de fuerza bruta ilimitados.

**Solución recomendada:**  
Migrar el tracking de intentos fallidos a Redis para compartir estado entre todas las instancias.

---

### BUG-004 — Contraseñas por defecto expuestas en `docker-compose.yml`

| Campo      | Detalle |
|------------|---------|
| Archivo    | `docker-compose.yml` (líneas 15–19, 98, 319) |
| Tipo       | Seguridad — Credenciales débiles |
| Severidad  | **ALTO** |

**Descripción:**  
El archivo `docker-compose.yml` define valores por defecto para credenciales de base de datos mediante la sintaxis `${VAR:-default}`. Si el archivo `.env` no está presente o no define estas variables, se usan contraseñas triviales hardcodeadas en el código fuente.

**Código afectado:**
```yaml
${MONGO_ROOT_USER:-admin}
${MONGO_APP_PASS:-change-this-app-password}
```

**Impacto:**  
Un despliegue descuidado expone la base de datos con credenciales conocidas públicamente.

**Solución recomendada:**  
- Eliminar los valores por defecto de las variables de credenciales.
- Validar al inicio que las variables requeridas están definidas.
- Documentar claramente en el README que el `.env` es obligatorio.

---

### BUG-005 — CORS en Socket.IO acepta conexiones sin cabecera `Origin`

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/config/socket.ts` (líneas 37–42) |
| Tipo       | Seguridad — Validación CORS insuficiente |
| Severidad  | **ALTO** |

**Descripción:**  
La función de validación de origen de Socket.IO permite explícitamente conexiones que no incluyen la cabecera `Origin`. Esto habilita conexiones WebSocket desde herramientas como Postman, scripts CLI, o aplicaciones nativas maliciosas, sin ninguna verificación de procedencia.

**Código afectado:**
```typescript
if (!origin) return callback(null, true);
```

**Impacto:**  
Cualquier cliente no-navegador puede establecer conexiones WebSocket sin restricción de origen.

**Solución recomendada:**  
Rechazar conexiones sin `Origin` o implementar autenticación adicional para clientes no-navegador.

---

### BUG-006 — Falta de verificación de autorización en eliminación de imágenes

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/routes/image.routes.ts` |
| Tipo       | Bypass de autorización |
| Severidad  | **ALTO** |

**Descripción:**  
Las rutas de imagen verifican autenticación pero no hay evidencia de controles de autorización en la lógica de eliminación. Un usuario autenticado de un restaurante podría eliminar imágenes pertenecientes a otro restaurante si conoce el identificador del archivo.

**Impacto:**  
Pérdida de datos entre tenants. Violación del aislamiento multi-tenant.

**Solución recomendada:**  
Verificar en el endpoint de eliminación que la imagen pertenece al restaurante del usuario autenticado antes de proceder con el borrado.

---

### BUG-007 — Cookie de sesión con `SameSite=Lax` en operaciones críticas

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/controllers/auth.controller.ts` (líneas 10–16) |
| Tipo       | Seguridad — CSRF |
| Severidad  | **ALTO** |

**Descripción:**  
Las cookies de autenticación usan `SameSite=Lax`. Para una aplicación de gestión interna de restaurantes con acceso exclusivo de staff, `SameSite=Strict` sería más apropiado y eliminaría completamente el vector CSRF sin impacto en la experiencia de usuario.

**Impacto:**  
Las cookies pueden ser enviadas en peticiones cross-site iniciadas por navegación de primer nivel, manteniendo un vector de ataque CSRF residual.

**Solución recomendada:**  
Cambiar `SameSite=Lax` a `SameSite=Strict` en las cookies de autenticación.

---

## MEDIOS

---

### BUG-008 — Logs exponen configuración interna de la base de datos

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/config/db.ts` (líneas 77–78, 91–96) |
| Tipo       | Divulgación de información |
| Severidad  | **MEDIO** |

**Descripción:**  
Detalles de configuración del pool de conexiones MongoDB (intentos de reconexión, `maxPoolSize`, etc.) se registran a nivel `info`. En entornos donde los logs son accesibles por múltiples equipos o se envían a sistemas externos, esta información puede ser aprovechada para reconocimiento.

**Código afectado:**
```typescript
logger.info({ 
  attempt: attempt + 1,
  maxPoolSize: options.maxPoolSize,
  ...
})
```

**Solución recomendada:**  
Degradar estos logs a nivel `debug` y asegurarse de que los sistemas de logging en producción tengan acceso restringido.

---

### BUG-009 — Filtrado multi-etapa de datos entre restaurantes propenso a errores

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/controllers/logs.controller.ts` (líneas 45–60) |
| Tipo       | Error de lógica — Potencial fuga de datos entre tenants |
| Severidad  | **MEDIO** |

**Descripción:**  
El controlador filtra datos en cadena: `restaurantId → dishIds → items`. Esta lógica multi-etapa es compleja y cualquier error en un paso intermedio podría resultar en que datos de un restaurante sean visibles para otro.

**Código afectado:**
```typescript
const dishes = await Dish.find({ 
  restaurant_id: new Types.ObjectId(restaurantId) 
}).select('_id disher_name');
```

**Impacto:**  
Potencial fuga de datos entre tenants en la vista de logs.

**Solución recomendada:**  
Agregar aserciones explícitas de aislamiento en cada etapa del filtrado y añadir tests de integración que verifiquen que un tenant no puede ver datos de otro.

---

### BUG-010 — Credenciales de Grafana con valor por defecto `admin`

| Campo      | Detalle |
|------------|---------|
| Archivo    | `docker-compose.yml` (líneas 257–258) |
| Tipo       | Configuración de seguridad |
| Severidad  | **MEDIO** |

**Descripción:**  
La contraseña del administrador de Grafana tiene `admin` como valor por defecto si la variable de entorno no está definida. Grafana expone dashboards de monitoreo con métricas internas de la aplicación.

**Código afectado:**
```yaml
GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
```

**Solución recomendada:**  
Eliminar el valor por defecto y validar que la variable esté definida antes del arranque.

---

### BUG-011 — Caddyfile del frontend sin headers de seguridad

| Campo      | Detalle |
|------------|---------|
| Archivo    | `frontend/Caddyfile.frontend` |
| Tipo       | Configuración de seguridad |
| Severidad  | **MEDIO** |

**Descripción:**  
El `Caddyfile` del frontend no incluye los headers de seguridad HTTP definidos en el `Caddyfile` principal (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, etc.). Las respuestas del frontend se entregan sin estas protecciones.

**Solución recomendada:**  
Replicar el bloque de headers de seguridad del `Caddyfile` principal en el `Caddyfile.frontend`.

---

### BUG-012 — Sin mecanismo de rotación del secreto JWT

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/config/env.ts` (líneas 14–20) |
| Tipo       | Gestión de configuración |
| Severidad  | **MEDIO** |

**Descripción:**  
`JWT_SECRET` se valida una sola vez al inicio de la aplicación. Si el secreto es comprometido y se necesita rotar, todos los usuarios deben reiniciar el servidor manualmente. No existe soporte para rotación de secretos en caliente ni invalidación de tokens anteriores.

**Solución recomendada:**  
Implementar soporte para rotación de secretos JWT o documentar el procedimiento de emergencia para invalidar todos los tokens activos.

---

### BUG-013 — Tokens de sesión con vida de 8 horas sin refresh tokens

| Campo      | Detalle |
|------------|---------|
| Archivo    | `frontend/src/app/features/login/login.component.ts` (líneas 94–100) |
| Tipo       | Seguridad — Gestión de sesiones |
| Severidad  | **MEDIO** |

**Descripción:**  
Los tokens JWT tienen una vida útil de 8 horas sin mecanismo de renovación. Un token interceptado permanece válido durante toda esa ventana de tiempo sin posibilidad de revocación granular.

**Impacto:**  
Ventana de exposición prolongada ante robo de token.

**Solución recomendada:**  
- Reducir la vida del access token a 15–60 minutos.
- Implementar refresh tokens con rotación automática.
- Agregar soporte de revocación mediante lista negra en Redis.

---

### BUG-014 — Sin restricción de autorización verificable en el Dashboard Controller

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/controllers/dashboard.controller.ts` |
| Tipo       | Posible gap de autorización |
| Severidad  | **MEDIO** |

**Descripción:**  
No se encontró evidencia clara de que el controlador del dashboard verifique en todos los endpoints que el usuario solo accede a datos de su propio restaurante. En una aplicación multi-tenant esto es un requisito crítico.

**Solución recomendada:**  
Auditar todos los endpoints del dashboard para confirmar que aplican el filtro `restaurant_id` del usuario autenticado.

---

## BAJOS

---

### BUG-015 — Uso extensivo de tipo `any` en TypeScript

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/controllers/image.controller.ts` (líneas 16, 45, 78, 123) |
| Tipo       | Calidad de código — Seguridad de tipos |
| Severidad  | **BAJO** |

**Descripción:**  
Múltiples usos de `any` como tipo en TypeScript anulan el sistema de verificación estática. Esto puede ocultar bugs en tiempo de compilación que solo se manifiestan en producción.

**Código afectado:**
```typescript
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => { ... }
(error as any).details = validation.errors;
```

**Solución recomendada:**  
Reemplazar `any` con tipos específicos o `unknown` acompañado de type guards. Extender la clase `AppError` para incluir la propiedad `details`.

---

### BUG-016 — Lógica de detección de path traversal confusa

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/utils/file-security.ts` (líneas 343–348) |
| Tipo       | Calidad de código — Lógica poco clara |
| Severidad  | **BAJO** |

**Descripción:**  
La condición de detección de path traversal incluye una verificación `!safeFilename.includes('-')` cuyo propósito como medida de seguridad no es evidente. Una lógica de seguridad poco clara es difícil de auditar y puede contener falsos negativos.

**Código afectado:**
```typescript
if (filename.includes('..') || (filename.includes('/') && !safeFilename.includes('-'))) {
```

**Solución recomendada:**  
Simplificar la lógica a verificaciones explícitas y documentar con comentarios el propósito de cada condición.

---

### BUG-017 — Limpieza de listeners de Socket no garantizada

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/sockets/middleware/connection-tracker.ts` (línea 172) |
| Tipo       | Potencial memory leak |
| Severidad  | **BAJO** |

**Descripción:**  
El código utiliza `socket.removeAllListeners()` como solución genérica de limpieza en lugar de deregistrar individualmente cada listener en los handlers de `disconnect`. Este enfoque es un parche que puede ocultar listeners que no se limpian correctamente en flujos normales.

**Solución recomendada:**  
Cada handler debe almacenar referencias a sus listeners y eliminarlos explícitamente en el evento `disconnect` correspondiente.

---

### BUG-018 — `AppError` sin soporte para propiedad `details`

| Campo      | Detalle |
|------------|---------|
| Archivo    | `backend/src/controllers/image.controller.ts` (línea 78) |
| Tipo       | Calidad de código |
| Severidad  | **BAJO** |

**Descripción:**  
Para adjuntar información de validación al error, se usa un cast a `any` en lugar de extender la clase base `AppError`. Esto genera acoplamiento implícito y dificulta el manejo tipado de errores en capas superiores.

**Código afectado:**
```typescript
(error as any).details = validation.errors;
```

**Solución recomendada:**  
```typescript
class AppError extends Error {
  details?: unknown;
  // ...
}
```

---

## Plan de Acción Priorizado

| Prioridad | ID       | Acción |
|-----------|----------|--------|
| Inmediata | BUG-001  | Eliminar `unsafe-inline` y `unsafe-eval` del CSP |
| Inmediata | BUG-002  | Mover autenticación de `localStorage` a cookies HttpOnly |
| Alta      | BUG-003  | Migrar rate limiting del PIN a Redis |
| Alta      | BUG-004  | Eliminar contraseñas por defecto del docker-compose |
| Alta      | BUG-005  | Rechazar conexiones Socket.IO sin cabecera `Origin` |
| Alta      | BUG-006  | Agregar verificación de propiedad en eliminación de imágenes |
| Alta      | BUG-007  | Cambiar `SameSite=Lax` a `SameSite=Strict` |
| Media     | BUG-009  | Agregar tests de aislamiento entre tenants en logs |
| Media     | BUG-010  | Eliminar default `admin` en Grafana |
| Media     | BUG-011  | Agregar headers de seguridad al Caddyfile del frontend |
| Media     | BUG-013  | Implementar refresh tokens con vida corta |
| Baja      | BUG-015  | Eliminar usos de `any` en TypeScript |
| Baja      | BUG-016  | Simplificar lógica de detección de path traversal |
| Baja      | BUG-017  | Deregistrar listeners de Socket individualmente |
| Baja      | BUG-018  | Extender clase `AppError` con propiedad `details` |

---

*Generado automáticamente mediante análisis estático del código fuente.*
