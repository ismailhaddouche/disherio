---
memory_type: architecture_decisions
scope: system
tags: [architecture, decisions, patterns, adr]
priority: 120
---

# 🏛️ DisherIo Architecture Decisions

> **Type:** Architecture Decision Records (ADRs)  
> **Purpose:** Documentar decisiones arquitectónicas importantes

---

## ADR-001: Monorepo con Separación Frontend/Backend

### Status
✅ **Accepted** (2024-03-01)

### Context
Necesitábamos decidir la estructura del proyecto para el sistema de gestión de restaurantes.

### Decision
Usar monorepo con directorios separados:
- `/backend` - API Node.js/Express
- `/frontend` - Angular SPA
- `/shared` - Tipos y contratos compartidos
- `/docs` - Documentación

### Consequences
✅ **Pros:**
- Un solo repo para todo el sistema
- Fácil sincronización de cambios
- CI/CD unificado
- Code reviews integrados

⚠️ **Cons:**
- Mayor tamaño de repo
- Posible acoplamiento si no se tiene cuidado

---

## ADR-002: MongoDB como Base de Datos Principal

### Status
✅ **Accepted** (2024-03-01)

### Context
Necesitábamos elegir base de datos para el sistema.

### Decision
Usar MongoDB con Mongoose ODM.

### Rationale
- Esquema flexible para menús y órdenes variables
- JSON nativo alinea con JavaScript
- Escalabilidad horizontal
- Buena integración con Node.js

### Consequences
✅ **Pros:**
- Desarrollo rápido
- Sin migraciones complejas
- Documentos anidados para órdenes

⚠️ **Cons:**
- Menos transacciones ACID fuertes
- Necesita diseño cuidadoso de índices

---

## ADR-003: CASL para Authorization

### Status
✅ **Accepted** (2024-03-15)

### Context
Requerimos sistema de permisos flexible para múltiples roles (admin, manager, waiter, kitchen).

### Decision
Usar CASL (Capability-based Authorization) en lugar de RBAC simple.

### Rationale
- Permisos granulares (acción + sujeto + condiciones)
- Define abilities en backend, verifica en frontend
- Integración con MongoDB queries
- Soporta field-level permissions

### Implementation
```typescript
// Backend: Define abilities
can('update', 'Order', ['status'], { 
  restaurantId: user.restaurantId,
  assignee: user._id 
});

// Frontend: Check permissions
*appPermission="'update'; subject: 'Order'"
```

---

## ADR-004: Angular Standalone Components

### Status
✅ **Accepted** (2024-03-20)

### Context
Angular 14+ introduce standalone components como alternativa a NgModules.

### Decision
Usar standalone components exclusivamente (sin NgModules).

### Rationale
- Menos boilerplate
- Carga diferencial más eficiente
- Mejor tree-shaking
- API más simple para lazy loading

### Migration Path
- Nuevos componentes: standalone
- Componentes existentes: migrar progresivamente

---

## ADR-005: Signals sobre RxJS para Estado Simple

### Status
✅ **Accepted** (2024-03-25)

### Context
Angular 16+ introduce signals como sistema de reactividad.

### Decision
Usar signals para estado local simple, RxJS para streams complejos.

### When to use what?
| Scenario | Solution |
|----------|----------|
| Estado local de componente | Signals |
| Form inputs | Signals |
| HTTP requests | `resource()` signal o RxJS |
| Event streams | RxJS |
| State global | RxJS + Services o NgRx |
| Real-time (WebSockets) | RxJS |

---

## ADR-006: JWT con Refresh Token Rotation

### Status
✅ **Accepted** (2024-03-10)

### Context
Autenticación para SPA con requisitos de seguridad.

### Decision
- Access Token: JWT corto (15 min), en memory
- Refresh Token: JWT largo (7 días), httpOnly cookie
- Rotación: Nuevo refresh token en cada uso

### Security Considerations
- XSS protection (access token no en localStorage)
- CSRF protection para cookies
- Token revocation list para logout

---

## ADR-007: Docker Compose para Desarrollo

### Status
✅ **Accepted** (2024-03-05)

### Decision
Usar Docker Compose para orquestar:
- MongoDB
- Backend (opcional)
- Caddy reverse proxy (producción)

### Setup Desarrollo
```bash
# Solo base de datos
docker-compose up -d mongodb

# Full stack
docker-compose up -d
```

---

## ADR-008: API Response Standard Format

### Status
✅ **Accepted** (2024-03-12)

### Decision
Todas las API responses usan formato consistente:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

### Rationale
- Consistencia frontend/backend
- Fácil manejo de errores
- Soporte para metadata de paginación

---

## ADR-009: Feature-Based Folder Structure

### Status
✅ **Accepted** (2024-03-15)

### Decision
Organizar código por features en lugar de por tipo de archivo.

### Backend Structure
```
src/
├── features/
│   ├── auth/           # Todo lo relacionado con auth
│   ├── orders/         # Todo lo relacionado con órdenes
│   └── users/          # Todo lo relacionado con usuarios
```

### Frontend Structure
```
app/
├── features/
│   ├── auth/
│   ├── orders/
│   └── users/
```

### Benefits
- Código cohesivo
- Fácil de encontrar
- Escalable
- Permite lazy loading

---

## ADR-010: Caddy como Reverse Proxy

### Status
✅ **Accepted** (2024-03-28)

### Decision
Usar Caddy en lugar de Nginx para producción.

### Rationale
- Configuración más simple (Caddyfile)
- HTTPS automático (Let's Encrypt)
- HTTP/2 y HTTP/3 nativo
- Buen soporte para SPA (Angular)

### Configuration
```caddyfile
:80 {
    handle /api/* {
        reverse_proxy backend:3000
    }
    
    handle {
        root * /srv/frontend
        try_files {path} /index.html
        file_server
    }
}
```

---

## Decisions Pending Review

### ADR-011: State Management Global
- **Status:** Under consideration
- **Options:** RxJS Services vs NgRx vs NGXS
- **Context:** Aplicación creciendo, necesitamos estado global más robusto

### ADR-012: Real-time Updates
- **Status:** Under consideration
- **Options:** WebSockets vs Server-Sent Events vs Polling
- **Context:** Notificaciones de nuevas órdenes en tiempo real

### ADR-013: Mobile Strategy
- **Status:** Under consideration
- **Options:** PWA vs Ionic vs React Native
- **Context:** Versión móvil para camareros

---

*Architecture Decision Records for DisherIo*
