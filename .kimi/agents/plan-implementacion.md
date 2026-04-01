# 📋 PLAN DE IMPLEMENTACIÓN - DISHERIO

> **Fecha:** Abril 2026  
> **Estado:** NO APTO PARA PRODUCCIÓN 🔴  
> **Score General:** 7.2/10  
> **Tiempo Estimado:** 8 semanas (300 horas)

---

## 🎯 RESUMEN EJECUTIVO

Basado en el análisis de 6 informes técnicos (PM Global, Arquitectura, Backend, Frontend, DevOps, QA), el proyecto presenta **18 problemas críticos** que deben resolverse antes del despliegue a producción.

### Métricas Clave

| Área | Score | Estado |
|------|-------|--------|
| **Seguridad** | 4.5/10 | 🔴 Crítico |
| **Testing** | 2/10 | 🔴 Crítico |
| **DevOps** | 4.7/10 | 🟡 Bajo |
| **Backend** | 7.5/10 | 🟡 Aceptable |
| **Frontend** | 7/10 | 🟡 Aceptable |
| **Arquitectura** | 7.2/10 | ✅ Buena base |

### Problemas por Severidad

```
🔴 CRÍTICO:  18 issues (29%) ████████████████████████████████
🟡 ALTO:     25 issues (40%) ███████████████████████████████
🟠 MEDIO:    13 issues (21%) ███████████████
🟢 BAJO:      6 issues (10%) ██████
```

---

## 🚨 PROBLEMAS CRÍTICOS (FASE 1 - SEMANA 1)

### 🔐 Seguridad Core

| ID | Problema | Impacto | Solución | Esfuerzo |
|----|----------|---------|----------|----------|
| SEC-001 | MongoDB sin autenticación | Acceso no autorizado total | Habilitar auth + crear usuarios | 4h |
| SEC-002 | HTTPS deshabilitado en Caddy | Interceptación de datos | Forzar TLS 1.3 | 2h |
| SEC-005 | JWT_SECRET con valor por defecto | Compromiso total de auth | Validación estricta + generación segura | 2h |
| SEC-006 | Backend ejecuta como root | Escalada de privilegios | Crear usuario appuser | 2h |
| BACK-1 | bcryptjs versión beta | Bugs de seguridad | Downgrade a 2.4.3 o usar bcrypt nativo | 1h |
| FRONT-1 | Referencia circular en cartStore | Memory leaks, loops infinitos | Refactorizar signals | 4h |

### 🛡️ Bugs Críticos

| ID | Problema | Impacto | Solución | Esfuerzo |
|----|----------|---------|----------|----------|
| BUG-2 | Falta validación de precios negativos | Pérdida financiera | Validación schema + servicio | 2h |
| BUG-6 | No hay transacciones en pagos | Inconsistencia de datos | Implementar MongoDB transactions | 6h |
| BUG-7 | Memory leak en Socket.IO | Degradación de performance | Cleanup listeners + disconnect | 3h |
| QA-EC-1 | Race conditions en órdenes | Pérdida de datos | Locks optimistas + transacciones | 4h |

### 📋 Tareas Fase 1

**Objetivo:** Eliminar riesgos de seguridad que impiden despliegue seguro.

#### Día 1-2: DevOps Security
```bash
# 1. MongoDB Auth
# docker-compose.yml - Agregar:
MONGO_INITDB_ROOT_USERNAME: admin
MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}

# Crear usuario de aplicación:
db.createUser({
  user: "disherio_app",
  pwd: "${MONGO_APP_PASSWORD}",
  roles: [{ role: "readWrite", db: "disherio" }]
})

# 2. HTTPS Caddyfile
# Forzar HTTPS
http:// {
  redir https://{host}{uri} permanent
}

# 3. Backend Dockerfile - Usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs
```

#### Día 3-4: Backend Fixes
```typescript
// 1. Validación JWT_SECRET estricta
if (JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

// 2. Validación de precios
const priceSchema = z.number().positive().max(999999);

// 3. Transacciones MongoDB
const session = await mongoose.startSession();
session.startTransaction();
try {
  await order.save({ session });
  await inventory.updateOne({}, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}

// 4. Socket cleanup
socket.on('disconnect', () => {
  socket.removeAllListeners();
  // Limpiar maps de referencias
});
```

#### Día 5: Frontend Fixes
```typescript
// Fix referencia circular cartStore
const _totalGross = computed(() =>
  _items().reduce((total, item) => total + calculateItemTotal(item), 0)
);

export const cartStore: CartStore = {
  items: _items.asReadonly(),
  totalGross: _totalGross, // ✅ Usar computed interno
  taxAmount: computed(() => {
    const grossTotal = _totalGross(); // ✅ No llamar al store
    // ...
  }),
};
```

#### Día 6-7: Testing & Validación
- [ ] Tests de seguridad pasando
- [ ] Validación de JWT_SECRET
- [ ] MongoDB auth funcionando
- [ ] Transacciones testeadas

**Total Fase 1:** ~35 horas

---

## 🛠️ FASE 2: ESTABILIDAD + ARQUITECTURA (SEMANAS 2-3)

### Arquitectura & Backend

| ID | Tarea | Esfuerzo | Prioridad |
|----|-------|----------|-----------|
| ARCH-1 | Configurar opciones MongoDB (pool, timeouts) | 4h | P1 |
| ARCH-2 | Implementar transacciones en operaciones críticas | 8h | P2 |
| ARCH-3 | Rate limiting granular por endpoint | 6h | P3 |
| BACK-3 | Rate limiting en WebSockets | 4h | P5 |
| BACK-4 | Retry con backoff en conexión DB | 4h | - |
| BACK-5 | Mejorar seguridad PIN (rate limiting + lockout) | 4h | P6 |
| BACK-6 | Agregar índices MongoDB faltantes | 3h | P9 |
| BACK-7 | Fix path traversal en uploads | 3h | P13 |

### Frontend

| ID | Tarea | Esfuerzo | Prioridad |
|----|-------|----------|-----------|
| FRONT-3 | Eliminar uso de `any` en TypeScript | 12h | P7 |
| FRONT-4 | Fix race condition socket service | 4h | P9 |
| FRONT-5 | Sanitizar outputs contra XSS | 4h | P10 |
| FRONT-6 | Implementar manejo de errores global en UI | 6h | P2 |
| FRONT-7 | Agregar validación de formularios completa | 8h | - |

### DevOps

| ID | Tarea | Esfuerzo | Prioridad |
|----|-------|----------|-----------|
| DEV-1 | Agregar límites de recursos en Docker Compose | 3h | P4 |
| DEV-2 | Rate limiting en Caddy | 3h | P15 |
| DEV-3 | Health checks completos | 4h | - |
| DEV-4 | Configurar logs estructurados | 4h | - |

**Total Fase 2:** ~81 horas

---

## 🧪 FASE 3: TESTING Y COBERTURA (SEMANAS 4-6)

### Backend Testing

| Módulo | Tests a Crear | Esfuerzo |
|--------|--------------|----------|
| Controllers (9) | 50+ tests | 24h |
| Services (8) | 40+ tests | 20h |
| Models (7) | Validaciones + hooks | 12h |
| Sockets (5) | Mock + integración | 16h |
| Middlewares | Auth, rate limit, error | 12h |
| Repositories | CRUD + queries | 16h |

### Frontend Testing

| Módulo | Tests a Crear | Esfuerzo |
|--------|--------------|----------|
| Servicios API | 20+ tests | 16h |
| Stores (Signals) | 15+ tests | 12h |
| Componentes Core | 30+ tests | 24h |
| Guards + Interceptors | 10+ tests | 8h |

### Testing E2E

| Flujo | Tests | Esfuerzo |
|-------|-------|----------|
| Totem → KDS → POS | 5 tests | 12h |
| Gestión de personal | 3 tests | 8h |
| Recuperación de error | 3 tests | 8h |

### Configuración Coverage

```json
// jest.config.js
{
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

**Total Fase 3:** ~176 horas (6 semanas)

---

## 🚀 FASE 4: DEVOPS Y OPTIMIZACIÓN (SEMANAS 7-8)

### Pipeline CI/CD

| Tarea | Esfuerzo |
|-------|----------|
| Integrar SAST (SonarQube) | 8h |
| Escaneo de vulnerabilidades Docker (Trivy) | 6h |
| npm audit en pipeline | 4h |
| Deploy real (no mock) | 12h |
| Hardening de Caddyfile | 4h |

### Monitoreo

| Componente | Esfuerzo |
|------------|----------|
| Setup Prometheus + Grafana | 8h |
| Métricas de aplicación | 6h |
| Alertas críticas | 4h |
| Dashboard de negocio | 6h |

### Optimizaciones

| Tarea | Esfuerzo |
|-------|----------|
| Índices MongoDB optimizados | 6h |
| Caché Redis para menú | 8h |
| Optimización de queries | 8h |
| Bundle size frontend | 6h |

**Total Fase 4:** ~78 horas

---

## 📅 TIMELINE VISUAL

```
SEMANA:  1      2      3      4      5      6      7      8
         │      │      │      │      │      │      │      │
FASE 1   ████████                                            🔴 Críticos
         Seguridad

FASE 2          ██████████████                               🟡 Estabilidad
                Backend + Frontend

FASE 3                          ████████████████████         🧪 Testing
                                Backend + Frontend + E2E

FASE 4                                              ████████ 🚀 DevOps
                                                    Optimización
```

---

## 📊 ESTIMACIÓN DE RECURSOS

### Equipo Recomendado

| Rol | Dedicación | Semanas |
|-----|------------|---------|
| Tech Lead / Arquitecto | 20% | 1-8 |
| Backend Developer (Senior) | 100% | 1-8 |
| Backend Developer (Mid) | 100% | 4-6 |
| Frontend Developer | 100% | 1-8 |
| DevOps Engineer | 100% | 1-2, 50% 3-8 |
| QA Engineer | 100% | 4-6 |

### Esfuerzo Total

| Fase | Horas |
|------|-------|
| Fase 1 - Críticos | 35h |
| Fase 2 - Estabilidad | 81h |
| Fase 3 - Testing | 176h |
| Fase 4 - DevOps | 78h |
| **TOTAL** | **~370h** |

---

## ✅ CHECKLIST PRE-PRODUCCIÓN

### Seguridad
- [ ] MongoDB con autenticación habilitada
- [ ] HTTPS obligatorio con certificados válidos
- [ ] JWT_SECRET seguro (32+ caracteres aleatorios)
- [ ] Backend ejecuta como usuario no-root
- [ ] No hay secrets hardcodeados en código
- [ ] Escaneo SAST sin vulnerabilidades críticas
- [ ] Escaneo de contenedores sin CVEs críticos
- [ ] Rate limiting funcional en API y WebSockets
- [ ] Validación de precios (no negativos)
- [ ] Transacciones implementadas en operaciones críticas

### Estabilidad
- [ ] Memory leaks identificados y corregidos
- [ ] Retry logic en conexiones a base de datos
- [ ] Health checks funcionales
- [ ] Manejo de errores global implementado
- [ ] Race conditions resueltas

### Testing
- [ ] Cobertura de código >60%
- [ ] Tests E2E críticos pasando
- [ ] Tests de integración pasando
- [ ] Casos edge documentados y cubiertos
- [ ] Tests de seguridad pasando

### DevOps
- [ ] Pipeline CI/CD con deploy automatizado
- [ ] Monitoreo y alerting configurado
- [ ] Límites de recursos en contenedores
- [ ] Healthchecks funcionales
- [ ] Rollback automatizado configurado

---

## 🎯 KPIs DE ÉXITO

| KPI | Actual | Objetivo 8 semanas |
|-----|--------|-------------------|
| Cobertura de tests | ~15% | >60% |
| Vulnerabilidades críticas | 18 | 0 |
| Vulnerabilidades altas | 25 | <5 |
| Tiempo de respuesta API (p95) | ? | <200ms |
| Uptime objetivo | ? | 99.9% |
| Bugs en producción/mes | ? | <2 |
| Madurez DevOps | 47% | >75% |

---

## 📚 REFERENCIAS CRUZADAS

### Problemas Multi-Informe

| Problema | Informes | Solución |
|----------|----------|----------|
| Transacciones MongoDB | Arquitectura, Backend, QA | Implementar sessions |
| Rate Limiting | Arquitectura, Backend, DevOps | Múltiples capas |
| Memory Leaks Sockets | Backend, Frontend, QA | Cleanup + disconnect |
| JWT_SECRET | Arquitectura, DevOps | Validación estricta |
| Validación Precios | Backend, QA | Schema + servicio |

---

## 🔄 PRÓXIMOS PASOS INMEDIATOS

### Esta Semana (Días 1-3):
1. [ ] Crear tickets para SEC-001 a SEC-006 con prioridad P0
2. [ ] Configurar MongoDB con autenticación en desarrollo
3. [ ] Generar JWT_SECRET seguro para staging
4. [ ] Revisar y planificar implementación de transacciones
5. [ ] Identificar y documentar referencias circulares en stores

### Esta Semana (Días 4-7):
1. [ ] Implementar autenticación MongoDB y JWT_SECRET seguro
2. [ ] Implementar validación de precios y transacciones
3. [ ] Fix referencia circular en cartStore
4. [ ] Comenzar preparación de entorno de testing
5. [ ] Daily standup para seguimiento de críticos

---

*Plan generado a partir del análisis integral de 6 informes técnicos*  
*Fecha de generación: Abril 2026*  
*Versión: 1.0*
