# Configuración de Caché Redis en DisherIO

Este documento describe el sistema de caché implementado con Redis para DisherIO.

## Tabla de Contenidos

1. [Resumen](#resumen)
2. [Servicios con Caché](#servicios-con-caché)
3. [TTLs Configurados](#ttls-configurados)
4. [Invalidación de Caché](#invalidación-de-caché)
5. [Middleware HTTP Caching](#middleware-http-caching)
6. [Variables de Entorno](#variables-de-entorno)
7. [Uso del CacheService](#uso-del-cacheservice)

## Resumen

El sistema de caché está implementado con **Redis** para soportar múltiples instancias del backend. Si Redis no está disponible, la aplicación funciona normalmente sin caché (graceful degradation).

### Componentes Principales

- **CacheService** (`backend/src/services/cache.service.ts`): Servicio de caché con Redis
- **Cache Middleware** (`backend/src/middlewares/cache.middleware.ts`): Middleware para caché de respuestas HTTP
- **Integración en servicios**: DishService, CategoryService, MenuLanguageService, RestaurantService

## Servicios con Caché

### DishService
- `getDishesByRestaurant()` - Caché de platos activos
- `getDishById()` - Caché individual de platos
- Invalidación automática al crear/actualizar/eliminar platos

### CategoryService  
- `getCategoriesByRestaurant()` - Caché de categorías
- `getCategoryById()` - Caché individual de categorías
- Invalidación automática al crear/actualizar/eliminar categorías

### MenuLanguageService
- `getByRestaurant()` - Caché de idiomas del menú
- `getDefault()` - Caché del idioma por defecto
- Invalidación automática al modificar idiomas

### RestaurantService
- `getRestaurantById()` - Caché de configuración de restaurante
- `getRestaurantConfig()` - Caché extendida de configuración
- Invalidación automática al actualizar restaurante

## TTLs Configurados

| Tipo de Datos | TTL | Descripción |
|--------------|-----|-------------|
| **MENU** | 300s (5 min) | Platos del menú |
| **CATEGORIES** | 600s (10 min) | Categorías |
| **RESTAURANT_CONFIG** | 3600s (1 hora) | Configuración del restaurante |
| **SESSION** | 86400s (24 horas) | Datos de sesión |
| **HTTP_RESPONSE** | 60s (1 min) | Respuestas HTTP cacheadas |

## Invalidación de Caché

### Reglas de Invalidación

| Operación | Caché Invalidado |
|-----------|-----------------|
| Crear/Modificar/Eliminar Plato | `menu:*`, `dishes:*` |
| Crear/Modificar/Eliminar Categoría | `categories:*`, `category:*` |
| Modificar Restaurante | `restaurant:*` |
| Modificar Idiomas | `languages:*` |

### Métodos de Invalidación Disponibles

```typescript
// Invalidar caché de menú para un restaurante
await cache.invalidateMenuCache(restaurantId);

// Invalidar caché de categorías
await cache.invalidateCategoriesCache(restaurantId);

// Invalidar caché de restaurante
await cache.invalidateRestaurantCache(restaurantId);

// Invalidar por patrón (uso avanzado)
await cache.deletePattern('custom:pattern:*');

// Limpiar todo el caché (¡cuidado!)
await cache.flushAll();
```

## Middleware HTTP Caching

### Uso Básico

```typescript
import { cacheMiddleware, CacheConfig } from '../middlewares/cache.middleware';

// Caché con TTL por defecto (60s)
router.get('/dishes', cacheMiddleware(), getDishes);

// Caché personalizada (5 minutos)
router.get('/menu', cacheMiddleware(300), getMenu);

// Usar configuraciones predefinidas
router.get('/categories', CacheConfig.categories(), getCategories);
router.get('/config', CacheConfig.config(), getConfig);
```

### Headers de Respuesta

El middleware añade headers para debugging:
- `X-Cache: HIT` - Respuesta servida desde caché
- `X-Cache: MISS` - Respuesta generada, no en caché
- `X-Cache-Key: http:/api/dishes` - Clave de caché usada

### Caché con Usuario

Para rutas autenticadas donde el caché debe ser por usuario:

```typescript
import { cacheMiddlewareWithUser } from '../middlewares/cache.middleware';

router.get('/my-orders', 
  authenticate, 
  cacheMiddlewareWithUser(300, true), 
  getMyOrders
);
```

## Variables de Entorno

### Requeridas

```env
# Contraseña de Redis (cambiar en producción)
REDIS_PASSWORD=change-this-redis-password
```

### Opcionales

```env
# URL de conexión (default: redis://localhost:6379)
REDIS_URL=redis://redis:6379

# TTLs personalizados (opcional)
CACHE_TTL_MENU=300
CACHE_TTL_CATEGORIES=600
CACHE_TTL_RESTAURANT=3600
CACHE_TTL_SESSION=86400
```

## Uso del CacheService

### Cache-Aside Pattern

```typescript
import { cache, CacheKeys, CACHE_TTL, fetchWithCache } from '../services/cache.service';

// Método recomendado: fetchWithCache
async function getData(id: string) {
  return fetchWithCache(
    CacheKeys.restaurant(id),
    () => repository.findById(id),
    CACHE_TTL.RESTAURANT_CONFIG
  );
}

// Método manual (para casos especiales)
async function getDataManual(id: string) {
  const key = CacheKeys.restaurant(id);
  
  // Intentar obtener de caché
  let data = await cache.get(key);
  if (data) return data;
  
  // Si no está en caché, obtener de la fuente
  data = await repository.findById(id);
  
  // Guardar en caché
  await cache.set(key, data, CACHE_TTL.RESTAURANT_CONFIG);
  
  return data;
}
```

### Guardar en Caché

```typescript
// Con TTL por defecto (5 minutos)
await cache.set('key', data);

// Con TTL específico (1 hora)
await cache.set('key', data, 3600);

// Sin expiración (no recomendado)
await cache.set('key', data, 0);
```

### Eliminar del Caché

```typescript
// Eliminar una clave específica
await cache.delete('key');

// Eliminar por patrón (usando SCAN)
await cache.deletePattern('menu:*');
```

### Verificar Estado

```typescript
// Verificar si el caché está disponible
if (cache.isReady()) {
  // Usar caché
}

// Obtener estadísticas
const stats = await cache.getStats();
console.log(stats); // { keys: 150, connected: true }
```

## Health Check

El endpoint `/health` incluye información del estado de Redis:

```json
{
  "status": "healthy",
  "checks": {
    "redis": {
      "status": "up",
      "responseTime": 2,
      "message": "Redis is connected"
    }
  }
}
```

## Docker Compose

El servicio Redis está configurado en `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: disherio_redis
  restart: unless-stopped
  command: redis-server --requirepass $${REDIS_PASSWORD}
  volumes:
    - redis_data:/data
  networks:
    - disherio_net
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 10s
    timeout: 3s
    retries: 5
```

## Monitoreo

Los logs incluyen información sobre el estado de Redis:

```
✅ Redis client connected
✅ Redis client ready
⚠️  Redis client error: Connection refused
⚠️  Redis not available - running without distributed cache
```

## Notas de Implementación

1. **Graceful Degradation**: Si Redis no está disponible, la aplicación funciona sin caché
2. **Reconexión Automática**: El cliente Redis intenta reconectarse automáticamente
3. **JSON Serialization**: Todos los valores se serializan como JSON
4. **Patrón SCAN**: La eliminación por patrón usa SCAN para evitar bloqueos
5. **Async/Await**: Todas las operaciones son asíncronas

## Troubleshooting

### Redis no se conecta

Verifica las variables de entorno:
```bash
# En el contenedor del backend
docker exec disherio_backend env | grep REDIS
```

### Limpiar caché manualmente

```bash
# Conectar a Redis
docker exec -it disherio_redis redis-cli -a <password>

# Listar claves
KEYS *

# Eliminar todas las claves
FLUSHALL

# Eliminar por patrón
EVAL "local keys = redis.call('keys', ARGV[1]) for i=1,#keys,5000 do redis.call('del', unpack(keys, i, math.min(i+4999, #keys))) end return #keys" 0 menu:*
```
