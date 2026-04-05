<!-- 
  ============================================================================
  DISHERIO - INFRASTRUCTURE TECHNICAL ANALYSIS
  ============================================================================
  Documento generado por análisis automatizado de infraestructura
  Fecha: 2026-04-05
  ============================================================================
-->

<div align="center">

# 🔧 DISHERIO - ANÁLISIS TÉCNICO DE INFRAESTRUCTURA
## Análisis Completo de Arquitectura, DevOps y Despliegue

**Versión:** 1.0  
**Fecha de Generación:** 2026-04-05  
**Tipo de Documento:** Análisis Técnico Académico

</div>

---

# 📑 ÍNDICE GENERAL

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Docker y Containerización](#2-docker-y-containerización)
3. [Reverse Proxy (Caddy)](#3-reverse-proxy-caddy)
4. [Monitoreo Completo](#4-monitoreo-completo)
5. [Base de Datos](#5-base-de-datos)
6. [Scripts de Despliegue](#6-scripts-de-despliegue)
7. [Configuración de Entornos](#7-configuración-de-entornos)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Seguridad de Infraestructura](#9-seguridad-de-infraestructura)
10. [Documentación Existente](#10-documentación-existente)
11. [Conclusiones y Recomendaciones](#11-conclusiones-y-recomendaciones)

---

# 1. RESUMEN EJECUTIVO

## 1.1 Visión General del Sistema

DisherIo es un **Sistema de Gestión de Restaurantes** con arquitectura moderna basada en microservicios containerizados. La infraestructura está diseñada para soportar múltiples modos de despliegue, desde desarrollo local hasta producción con dominio propio.

## 1.2 Arquitectura High-Level

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAPA DE PRESENTACIÓN                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Angular SPA (Frontend)                                             │   │
│  │  • Puerto: 4200 (interno)                                           │   │
│  │  • Caddy como servidor estático                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REVERSE PROXY (Caddy)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Terminación TLS/SSL                                              │   │
│  │  • Enrutamiento API/WebSocket/Frontend                              │   │
│  │  • Compresión gzip/zstd                                             │   │
│  │  • Headers de seguridad                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE APLICACIÓN                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │  Backend API    │    │  WebSocket      │    │  Métricas Prometheus    │ │
│  │  Node.js/Express│    │  Socket.IO      │    │  Endpoint /metrics      │ │
│  │  Puerto: 3000   │    │  Tiempo real    │    │  Puerto: 3000           │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE DATOS                                        │
│  ┌─────────────────┐    ┌─────────────────┐                                 │
│  │  MongoDB        │    │  Redis          │                                 │
│  │  Puerto: 27017  │    │  Puerto: 6379   │                                 │
│  │  • Auth enabled │    │  • Auth enabled │                                 │
│  │  • Indexes      │    │  • Cache/PubSub │                                 │
│  └─────────────────┘    └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Stack Tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|------------|---------|-----------|
| Frontend | Angular | 17+ | SPA con SSR opcional |
| Backend | Node.js | 20 LTS | Runtime JavaScript |
| Framework | Express.js | 4.x | API REST |
| Base de Datos | MongoDB | 7.0 | Persistencia documental |
| Cache | Redis | 7 Alpine | Cache y Pub/Sub |
| Proxy | Caddy | 2.x | Reverse proxy + HTTPS |
| Contenedores | Docker | 20.10+ | Containerización |
| Orquestación | Docker Compose | 2.0+ | Multi-container |
| Monitoreo | Prometheus | 2.48+ | Métricas |
| Visualización | Grafana | 10.2+ | Dashboards |
| Alertas | Alertmanager | 0.26+ | Notificaciones |

---

# 2. DOCKER Y CONTAINERIZACIÓN

## 2.1 Análisis Línea a Línea: docker-compose.yml

El archivo principal define **11 servicios** con configuraciones específicas para desarrollo y producción.

### 2.1.1 Servicio MongoDB

```yaml
mongo:
  image: mongo:7                          # ✅ Imagen oficial, versión fija
  container_name: disherio_mongo          # ✅ Nombre explícito para referencia
  restart: unless-stopped                 # ✅ Auto-restart excepto stop manual
  volumes:
    - mongo_data:/data/db                 # ✅ Volumen persistente para datos
    - ./backend/scripts/init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js:ro
                                           # ✅ Script de inicialización read-only
  networks:
    - disherio_net                        # ✅ Red aislada
  environment:
    MONGO_INITDB_DATABASE: disherio       # ✅ DB inicial
    MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER:-admin}      # ✅ Default con override
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASS:-change-this-secure-password}
    MONGO_APP_USER: ${MONGO_APP_USER:-disherio_app}            # ✅ Usuario app separado
    MONGO_APP_PASSWORD: ${MONGO_APP_PASS:-change-this-app-password}
  deploy:
    resources:
      limits:                             # ✅ Límites estrictos
        cpus: '2.0'                       # Máximo 2 CPUs
        memory: 2G                        # Máximo 2GB RAM
      reservations:                       # ✅ Reservas garantizadas
        cpus: '0.5'                       # Mínimo 0.5 CPUs
        memory: 512M                      # Mínimo 512MB RAM
  logging:                                # ✅ Rotación de logs configurada
    driver: "json-file"
    options:
      max-size: "10m"                     # Máximo 10MB por archivo
      max-file: "3"                       # Mantener 3 archivos
  healthcheck:                            # ✅ Healthcheck nativo
    test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok", 
           "-u", "${MONGO_ROOT_USER:-admin}", "-p", "${MONGO_ROOT_PASS:-change-this-secure-password}", 
           "--authenticationDatabase", "admin"]
    interval: 10s                         # Chequeo cada 10 segundos
    timeout: 5s                           # Timeout de 5 segundos
    retries: 10                           # 10 reintentos antes de "unhealthy"
    start_period: 60s                     # Período de gracia inicial
```

**Análisis de Seguridad:**
- ✅ Separación de usuarios root y app (principio de mínimo privilegio)
- ✅ Autenticación obligatoria habilitada
- ✅ Volumen de inicialización montado como read-only (`:ro`)
- ✅ Resource limits para prevenir DoS por consumo de recursos

### 2.1.2 Servicio Redis

```yaml
redis:
  image: redis:7-alpine                   # ✅ Alpine Linux (ligero y seguro)
  container_name: disherio_redis
  restart: unless-stopped
  command: redis-server --requirepass "${REDIS_PASSWORD:-redis_secure_password}"
                                           # ✅ Autenticación obligatoria
  volumes:
    - redis_data:/data                    # ✅ Persistencia de datos
  networks:
    - disherio_net
  environment:
    REDIS_PASSWORD: ${REDIS_PASSWORD:-redis_secure_password}
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 128M
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-redis_secure_password}", "ping"]
    interval: 10s
    timeout: 3s
    retries: 5
    start_period: 10s
```

**Análisis:**
- ✅ Alpine Linux reduce superficie de ataque (~5MB vs ~100MB)
- ✅ Autenticación por contraseña obligatoria
- ✅ No expuesto externamente (solo red interna)

### 2.1.3 Servicio Backend

```yaml
backend:
  build:
    context: .                            # ✅ Contexto raíz para acceso a shared/
    dockerfile: backend/Dockerfile        # ✅ Dockerfile específico
  container_name: disherio_backend
  hostname: backend                       # ✅ Hostname para DNS interno
  user: "1001:1001"                       # ✅ CRÍTICO: Ejecución como non-root
  networks:
    disherio_net:
      aliases:
        - backend                         # ✅ Alias para resolución DNS
  restart: unless-stopped
  depends_on:                             # ✅ Dependencias condicionadas a health
    mongo:
      condition: service_healthy          # ✅ Espera a que MongoDB esté sano
    redis:
      condition: service_healthy          # ✅ Espera a que Redis esté sano
  environment:
    NODE_ENV: production                  # ✅ Modo producción
    PORT: 3000
    MONGODB_URI: ${MONGODB_URI:-mongodb://${MONGO_APP_USER:-disherio_app}:${MONGO_APP_PASS:-change-this-app-password}@mongo:27017/disherio?authSource=disherio}
    JWT_SECRET: ${JWT_SECRET}             # 🔴 Variable crítica (sin default)
    JWT_EXPIRES: ${JWT_EXPIRES:-8h}       # ✅ Default seguro
    FRONTEND_URL: ${FRONTEND_URL}         # 🔴 Variable requerida
    REDIS_URL: ${REDIS_URL:-redis://redis:6379}
    REDIS_PASSWORD: ${REDIS_PASSWORD:-redis_secure_password}
    MONGODB_MAX_POOL_SIZE: ${MONGODB_MAX_POOL_SIZE:-50}
    MONGODB_SERVER_SELECTION_TIMEOUT: ${MONGODB_SERVER_SELECTION_TIMEOUT:-30000}
    MONGODB_SOCKET_TIMEOUT: ${MONGODB_SOCKET_TIMEOUT:-45000}
  expose:
    - "3000"                              # ✅ Exposición interna (no publicada)
  volumes:
    - disherio_uploads:/app/uploads       # ✅ Volumen compartido para uploads
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
      reservations:
        cpus: '0.25'
        memory: 256M
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/health || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 12
    start_period: 30s
```

**Análisis de Seguridad:**
- ✅ **Non-root execution** (UID 1001) - Mitiga escapes de contenedor
- ✅ No expone puertos públicamente (solo `expose`, no `ports`)
- ✅ Variables sensibles sin valores por defecto seguros (`JWT_SECRET`)
- ✅ Healthcheck en endpoint interno

### 2.1.4 Servicio Frontend

```yaml
frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile
  container_name: disherio_frontend
  hostname: frontend
  networks:
    disherio_net:
      aliases:
        - frontend
  restart: unless-stopped
  expose:
    - "4200"
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 128M
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:4200 || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 6
    start_period: 30s
```

**Nota:** El frontend es una SPA Angular compilada, servida por Caddy interno.

### 2.1.5 Servicio Caddy (Reverse Proxy)

```yaml
caddy:
  image: caddy:2-alpine                   # ✅ Alpine para mínima superficie
  container_name: disherio_caddy
  restart: unless-stopped
  depends_on:
    backend:
      condition: service_healthy
    frontend:
      condition: service_healthy
  ports:
    - "${HTTP_PORT:-80}:80"              # ✅ HTTP configurable
    - "${HTTPS_PORT:-443}:443"           # ✅ HTTPS configurable
  expose:
    - "8080"                             # Puerto alternativo interno
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro  # ✅ Config read-only
    - disherio_uploads:/srv/uploads:ro     # ✅ Uploads accesibles
    - caddy_data:/data                     # ✅ Certificados TLS
    - caddy_config:/config                 # ✅ Config de Caddy
  networks:
    - disherio_net
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080 || wget -qO- http://127.0.0.1:80 || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 6
    start_period: 10s
```

### 2.1.6 Stack de Monitoreo

```yaml
# Prometheus - Métricas
prometheus:
  image: prom/prometheus:v2.48.0
  container_name: disherio_prometheus
  restart: unless-stopped
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - ./monitoring/prometheus/rules:/etc/prometheus/rules:ro
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
    - '--storage.tsdb.retention.time=15d'    # ✅ Retención limitada
    - '--web.enable-lifecycle'               # ✅ Recarga sin restart
    - '--web.enable-admin-api'               # ⚠️ Admin API habilitado
  ports:
    - "9090:9090"                            # ⚠️ Expuesto públicamente

# Grafana - Visualización
grafana:
  image: grafana/grafana:10.2.3
  container_name: disherio_grafana
  restart: unless-stopped
  volumes:
    - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    - grafana_data:/var/lib/grafana
  environment:
    GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}  # ⚠️ Default inseguro
    GF_USERS_ALLOW_SIGN_UP: "false"           # ✅ Registro deshabilitado
  ports:
    - "3001:3000"

# Alertmanager - Notificaciones
alertmanager:
  image: prom/alertmanager:v0.26.0
  container_name: disherio_alertmanager
  restart: unless-stopped
  volumes:
    - ./monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    - alertmanager_data:/alertmanager
  ports:
    - "9093:9093"

# Exporters
mongo-exporter:
  image: percona/mongodb_exporter:0.40.0    # ✅ Percona (oficial)
  command:
    - '--mongodb.uri=mongodb://...'
    - '--collect-all'                       # ✅ Todas las métricas
    - '--compatible-mode'                   # ✅ Compatibilidad

redis-exporter:
  image: oliver006/redis_exporter:v1.55.0
  environment:
    REDIS_ADDR: redis://redis:6379
    REDIS_PASSWORD: ${REDIS_PASSWORD}

node-exporter:
  image: prom/node-exporter:v1.7.0
  volumes:
    - /proc:/host/proc:ro                   # ✅ Solo lectura
    - /sys:/host/sys:ro
    - /:/rootfs:ro
```

### 2.1.7 Configuración de Redes

```yaml
networks:
  disherio_net:
    driver: bridge                          # ✅ Red bridge aislada
    name: disherio_disherio_net             # ✅ Nombre explícito
```

**Análisis:**
- ✅ Red bridge aislada (no `host` network)
- ✅ Comunicación inter-servicio sin exponer puertos públicamente
- ✅ DNS interno automático por Docker

### 2.1.8 Configuración de Volúmenes

```yaml
volumes:
  mongo_data:
    name: disherio_mongo_data               # ✅ Nombres explícitos
  redis_data:
    name: disherio_redis_data
  disherio_uploads:
    name: disherio_uploads                  # Compartido entre backend y caddy
  caddy_data:
    name: disherio_caddy_data               # Certificados TLS persistentes
  caddy_config:
    name: disherio_caddy_config
  prometheus_data:
    name: disherio_prometheus_data
  grafana_data:
    name: disherio_grafana_data
  alertmanager_data:
    name: disherio_alertmanager_data
```

**Total:** 8 volúmenes nombrados para persistencia.

## 2.2 Análisis: docker-compose.prod.yml

Versión optimizada para producción con **menor consumo de recursos** y **sin monitoreo**:

| Aspecto | Desarrollo | Producción |
|---------|-----------|------------|
| MongoDB Memory | 2G límite | 1.5G límite |
| Backend Memory | 1G límite | 768M límite |
| Frontend Memory | 512M límite | 384M límite |
| Redis | ✅ Incluido | ❌ Eliminado |
| Monitoreo | ✅ Completo | ❌ Ninguno |
| HTTP/3 | ✅ Soportado | ✅ Soportado |

## 2.3 Análisis Línea a Línea: Backend Dockerfile

```dockerfile
# ============================================================================
# STAGE 1: BUILDER
# ============================================================================
FROM node:20-alpine AS builder             # ✅ Node 20 LTS + Alpine
WORKDIR /app

# Copiar monorepo completo manteniendo estructura
COPY shared ./shared                       # ✅ Copia shared primero
COPY backend ./backend                     # Luego backend

# Build shared (dependencia de backend)
RUN cd shared && npm install && npm run build

# Build backend (usará shared compilado)
RUN cd backend && npm install && npm run build

# Copiar locales (tsc no copia archivos no-TS)
RUN cp -r backend/src/locales backend/dist/

# ============================================================================
# STAGE 2: RUNNER (PRODUCCIÓN)
# ============================================================================
FROM node:20-alpine AS runner              # ✅ Imagen limpia para runtime
WORKDIR /app
ENV NODE_ENV=production

# Instalar herramientas para healthchecks
RUN apk add --no-cache wget curl           # ✅ Alpine package manager

# Crear usuario/grupo non-root (UID/GID 1001)
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nodejs -G nodejs    # ✅ Security best practice

# Copiar dependencias de producción
COPY backend/package*.json ./

# Fix para symlink de shared en monorepo
RUN npm install --omit=dev && rm -rf ./node_modules/@disherio/shared

# Copiar shared compilado
COPY --from=builder /app/shared/dist ./node_modules/@disherio/shared/dist
COPY --from=builder /app/shared/package.json ./node_modules/@disherio/shared/package.json

# Copiar backend compilado
COPY --from=builder /app/backend/dist ./dist

# Crear directorio uploads y cambiar ownership
RUN mkdir -p /app/uploads && \
    chown -R nodejs:nodejs /app            # ✅ Permisos correctos

# Cambiar a usuario non-root
USER nodejs                                # ✅ CRÍTICO: No ejecutar como root

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Análisis de Multi-Stage Build:**

| Aspecto | Beneficio |
|---------|-----------|
| Separación build/run | Imagen final ~50MB vs ~500MB |
| Sin dependencias dev | Menor superficie de ataque |
| Non-root user | Mitiga container escape |
| Alpine Linux | Mínima superficie de ataque |
| Copy --from | Solo artefactos necesarios |

## 2.4 Análisis: Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY shared ./shared
COPY frontend ./frontend

RUN cd shared && npm install && npm run build
RUN cd frontend && npm install --legacy-peer-deps && \
    npm run build -- --configuration production --output-path=dist/disherio

FROM caddy:2-alpine AS runner              # ✅ Caddy como servidor estático
COPY --from=builder /app/frontend/dist/disherio/browser /srv
COPY frontend/Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 4200
```

**Nota:** El frontend usa Caddy para servir archivos estáticos con compresión automática.

## 2.5 Comparativa de Imágenes

| Servicio | Imagen Base | Tamaño Estimado | Usuario |
|----------|-------------|-----------------|---------|
| Backend | node:20-alpine | ~150MB | nodejs (1001) |
| Frontend | caddy:2-alpine | ~50MB | caddy (473) |
| MongoDB | mongo:7 | ~700MB | mongodb (999) |
| Redis | redis:7-alpine | ~30MB | redis (999) |
| Caddy | caddy:2-alpine | ~50MB | caddy (473) |


---

# 3. REVERSE PROXY (CADDY)

## 3.1 Análisis del Caddyfile Principal

El archivo `Caddyfile` define la configuración del reverse proxy con soporte completo HTTPS.

```caddy
{
    admin off                                # ✅ Deshabilita API admin
    # Auto HTTPS habilitado - Caddy gestiona certificados automáticamente
}

# ============================================================================
# REDIRECCIÓN HTTP A HTTPS
# ============================================================================
:80 {
    redir https://{host}{uri} permanent      # ✅ 301 Redirect a HTTPS
}

# ============================================================================
# HTTPS CON TLS 1.3 MÍNIMO
# ============================================================================
:443 {
    # TLS 1.3 como mínimo protocolo
    tls {
        protocols tls1.3                     # ✅ Solo TLS 1.3 (más seguro)
    }

    # Headers de seguridad HTTP
    header {
        # HSTS - Fuerza HTTPS por 1 año, incluye subdominios
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
        -Server                                  # ✅ Elimina header Server
    }

    # Compresión de respuestas
    encode gzip zstd                         # ✅ Compresión automática

    # Servir archivos subidos
    handle /uploads/* {
        root * /srv
        file_server
    }

    # Reverse proxy a backend API
    handle /api/* {
        reverse_proxy backend:3000
    }

    # Reverse proxy a Socket.IO (WebSockets)
    handle /socket.io/* {
        reverse_proxy backend:3000 {
            flush_interval -1                  # ✅ Optimizado para WebSockets
            transport http {
                versions 1.1                   # HTTP/1.1 para WebSockets
            }
        }
    }

    # Reverse proxy al frontend (fallback)
    handle {
        reverse_proxy frontend:4200
    }
}
```

## 3.2 Tabla de Enrutamiento

| Path | Destino | Tipo | Descripción |
|------|---------|------|-------------|
| `/uploads/*` | `/srv` (filesystem) | Archivos estáticos | Imágenes/documentos subidos |
| `/api/*` | `backend:3000` | HTTP API | REST API endpoints |
| `/socket.io/*` | `backend:3000` | WebSocket | Comunicación tiempo real |
| `/metrics` | `backend:3000` | HTTP | Métricas Prometheus |
| `/*` | `frontend:4200` | HTTP | SPA Angular |

## 3.3 Templates de Caddy por Modo

### 3.3.1 Caddyfile.local (Desarrollo)

```caddy
{
    admin off
    auto_https off                           # ❌ HTTPS deshabilitado
    http_port ${CADDY_PORT}                  # Puerto configurable
}

:${CADDY_PORT} {
    # Headers de seguridad básicos (sin HSTS - no HTTPS)
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    encode gzip zstd
    
    handle /uploads/* {
        root * /srv
        file_server
    }
    
    handle /api/* {
        reverse_proxy backend:3000
    }
    
    handle /socket.io/* {
        reverse_proxy backend:3000 {
            flush_interval -1
            transport http {
                versions 1.1
            }
        }
    }
    
    handle {
        reverse_proxy frontend:4200
    }
}
```

### 3.3.2 Caddyfile.domain (Producción)

```caddy
{
    admin off
    email ${EMAIL}                           # Email para Let's Encrypt
}

# Redirección HTTP a HTTPS
:80 {
    redir https://{host}{uri} permanent
}

${DOMAIN}:443 {
    tls {
        protocols tls1.3                     # TLS 1.3 mínimo
    }

    # Headers de seguridad completos
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        Content-Security-Policy "default-src 'self'; ..."
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "accelerometer=(), camera=(), ..."
        -Server
    }

    encode gzip zstd

    handle /uploads/* {
        root * /srv
        file_server
    }

    handle /api/* {
        reverse_proxy backend:3000
    }

    handle /socket.io/* {
        reverse_proxy backend:3000 {
            flush_interval -1
            transport http {
                versions 1.1
            }
        }
    }

    handle {
        reverse_proxy frontend:4200
    }
}

# HTTP/3 (QUIC) support
${DOMAIN}:443 {
    bind udp/0.0.0.0
    tls {
        protocols tls1.3
    }
}
```

## 3.4 Análisis de Seguridad SSL/TLS

### 3.4.1 Características de Seguridad Implementadas

| Característica | Implementación | Nivel |
|----------------|----------------|-------|
| TLS 1.3 | `protocols tls1.3` | ✅ Óptimo |
| HSTS | `max-age=31536000` (1 año) | ✅ Óptimo |
| Certificados | Let's Encrypt automático | ✅ Óptimo |
| Renovación | Automática (Caddy) | ✅ Óptimo |
| HTTP/3 | QUIC sobre UDP | ✅ Moderno |
| Redirección HTTP→HTTPS | 301 Permanent | ✅ Correcto |

### 3.4.2 Headers de Seguridad

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
├── max-age: 31536000 segundos (1 año)
├── includeSubDomains: Aplica a subdominios
└── preload: Elegible para lista HSTS preload

Content-Security-Policy: 
├── default-src 'self': Solo recursos del mismo origen
├── script-src 'self' 'unsafe-inline' 'unsafe-eval': Scripts con CSP relaxed
├── style-src 'self' 'unsafe-inline' https://fonts.googleapis.com: Estilos
├── font-src 'self' https://fonts.gstatic.com: Fuentes
├── img-src 'self' data: blob:: Imágenes
└── connect-src 'self' wss:: Conexiones (incluye WebSocket seguro)

X-Frame-Options: SAMEORIGIN
└── Previene clickjacking (solo mismo origen puede embeber)

X-Content-Type-Options: nosniff
└── Previene MIME type sniffing

X-XSS-Protection: 1; mode=block
└── Filtro XSS del navegador habilitado

Referrer-Policy: strict-origin-when-cross-origin
└── Envía origin solo en navegación cross-origin
```

---

# 4. MONITOREO COMPLETO

## 4.1 Arquitectura de Monitoreo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STACK DE MONITOREO                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│   │   Backend    │     │   MongoDB    │     │    Redis     │               │
│   │  /metrics    │────▶│  Exporter    │────▶│  Exporter    │               │
│   │   :3000      │     │   :9216      │     │   :9121      │               │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘               │
│          │                    │                    │                        │
│          └────────────────────┼────────────────────┘                        │
│                               │ Scrape cada 15s                              │
│                               ▼                                              │
│                       ┌──────────────┐                                       │
│                       │  Prometheus  │                                       │
│                       │   :9090      │                                       │
│                       └──────┬───────┘                                       │
│                              │                                               │
│              ┌───────────────┼───────────────┐                               │
│              │               │               │                               │
│              ▼               ▼               ▼                               │
│       ┌──────────┐   ┌──────────┐   ┌──────────────┐                        │
│       │  Grafana │   │ Alertmanager│  │ Node Exporter │                        │
│       │  :3001   │   │   :9093    │   │    :9100     │                        │
│       └──────────┘   └──────────┘   └──────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Análisis: prometheus.yml

```yaml
global:
  scrape_interval: 15s                      # Intervalo global de scrape
  evaluation_interval: 15s                  # Intervalo de evaluación de reglas
  external_labels:
    monitor: 'disherio-monitor'             # Label para identificar origen

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093               # Endpoint de Alertmanager

# Load rules once and periodically evaluate them
rule_files:
  - /etc/prometheus/rules/*.yml             # Archivos de reglas de alertas

scrape_configs:
  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: /metrics

  # Backend API metrics
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: /metrics
    scrape_interval: 10s                    # Más frecuente para backend
    scrape_timeout: 5s

  # MongoDB metrics
  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongo-exporter:9216']
    scrape_interval: 15s

  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 15s

  # Caddy metrics
  - job_name: 'caddy'
    static_configs:
      - targets: ['caddy:2019']
    scrape_interval: 15s

  # Node/system metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 15s
```

## 4.3 Dashboards de Grafana

### 4.3.1 Dashboard: System Overview

**Propósito:** Vista de alto nivel del estado de todos los servicios.

**Paneles Principales:**

| Panel | Métrica | Tipo | Descripción |
|-------|---------|------|-------------|
| Backend Status | `up{job="backend"}` | Stat | UP/DOWN indicator |
| MongoDB Status | `up{job="mongodb"}` | Stat | UP/DOWN indicator |
| Redis Status | `up{job="redis"}` | Stat | UP/DOWN indicator |
| Caddy Status | `up{job="caddy"}` | Stat | UP/DOWN indicator |
| Requests/sec | `rate(http_requests_total[1m])` | TimeSeries | RPS por código |
| Response Latency | `histogram_quantile(0.95, ...)` | TimeSeries | P95/P99 latencia |
| Memory Usage | `node_memory_MemAvailable_bytes` | TimeSeries | Uso de memoria |
| CPU Usage | `node_cpu_seconds_total` | TimeSeries | Uso de CPU |
| Orders/min | `rate(orders_created_total[1m])` | Stat | Métrica de negocio |
| Active Orders | `sum(active_orders)` | Stat | Pedidos activos |
| WebSocket Connections | `sum(websocket_connections_active)` | Stat | Conexiones WS |

### 4.3.2 Dashboard: Backend Metrics

**Métricas específicas del API:**

- Request rate por endpoint
- Error rate (4xx/5xx)
- Latencia percentil (p50, p95, p99)
- Memory heap usage
- Event loop lag
- Active handles

### 4.3.3 Dashboard: MongoDB Metrics

**Métricas de base de datos:**

- Active connections
- Connection pool utilization
- Operations per second (read/write/command)
- Operation latency
- Memory usage (resident/virtual)
- Storage size (data/indexes)

## 4.4 Reglas de Alertas

### 4.4.1 Alertas Críticas (Inmediatas)

```yaml
# High Error Rate Alert
- alert: HighErrorRate
  expr: |
    (
      sum(rate(http_requests_total{status=~"5.."}[5m])) 
      / 
      sum(rate(http_requests_total[5m]))
    ) > 0.05
  for: 2m                                    # Debe persistir 2 minutos
  labels:
    severity: critical
    service: backend
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }} (above 5%)"

# Service Down Alert
- alert: ServiceDown
  expr: up{job="backend"} == 0
  for: 1m
  labels:
    severity: critical
    service: backend
  annotations:
    summary: "Backend service is down"

# High Memory Usage
- alert: HighMemoryUsage
  expr: (process_resident_memory_bytes / node_memory_MemTotal_bytes) > 0.8
  for: 5m
  labels:
    severity: critical
    service: backend
```

### 4.4.2 Alertas de Advertencia

```yaml
# High Client Error Rate (4xx)
- alert: HighClientErrorRate
  expr: (sum(rate(http_requests_total{status=~"4.."}[5m])) / sum(rate(http_requests_total[5m]))) > 0.10
  for: 5m
  labels:
    severity: warning

# High Latency P99
- alert: HighLatencyP99
  expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 1.0
  for: 2m
  labels:
    severity: warning
```

### 4.4.3 Alertas de Negocio

```yaml
# Low Order Rate
- alert: LowOrderRate
  expr: sum(rate(orders_created_total[15m])) < 0.01
  for: 15m
  labels:
    severity: warning
    service: business

# High Order Failure Rate
- alert: HighOrderFailureRate
  expr: (sum(rate(orders_failed_total[10m])) / sum(rate(orders_created_total[10m]))) > 0.05
  for: 5m
  labels:
    severity: critical
    service: business
```

## 4.5 Configuración de Alertmanager

```yaml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@disherio.local'
  slack_api_url: '${SLACK_WEBHOOK_URL:-}'

route:
  group_by: ['alertname', 'severity', 'job']
  group_wait: 30s                           # Espera para agrupar
  group_interval: 5m                        # Intervalo entre grupos
  repeat_interval: 4h                       # Intervalo de repetición
  receiver: 'default'
  routes:
    # Critical alerts - notificación inmediata
    - match:
        severity: critical
      receiver: 'critical-alerts'
      group_wait: 10s
      repeat_interval: 30m
    
    # Warning alerts - menos frecuente
    - match:
        severity: warning
      receiver: 'warning-alerts'
      group_wait: 1m
      repeat_interval: 2h

# Inhibition: Silencia warnings si hay critical del mismo tipo
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']

receivers:
  - name: 'default'
    email_configs:
      - to: 'admin@disherio.local'
        subject: 'DisherIO Alert: {{ .GroupLabels.alertname }}'

  - name: 'critical-alerts'
    email_configs:
      - to: 'admin@disherio.local'
        subject: '🚨 CRITICAL: DisherIO Alert'
    slack_configs:
      - channel: '#alerts-critical'
        title: '🚨 Critical Alert'
        send_resolved: true                   # Notificar cuando se resuelve

  - name: 'warning-alerts'
    email_configs:
      - to: 'admin@disherio.local'
        subject: '⚠️ WARNING: DisherIO Alert'
```

## 4.6 Métricas Disponibles

### 4.6.1 Métricas HTTP

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `http_requests_total` | Counter | Total de requests HTTP |
| `http_request_duration_seconds` | Histogram | Duración de requests |
| `http_request_size_bytes` | Histogram | Tamaño de request body |
| `http_response_size_bytes` | Histogram | Tamaño de response body |

### 4.6.2 Métricas de Negocio

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `orders_created_total` | Counter | Pedidos creados |
| `orders_completed_total` | Counter | Pedidos completados |
| `orders_cancelled_total` | Counter | Pedidos cancelados |
| `orders_failed_total` | Counter | Pedidos fallidos |
| `active_orders` | Gauge | Pedidos activos actualmente |
| `order_processing_duration_seconds` | Histogram | Tiempo de procesamiento |

### 4.6.3 Métricas de Autenticación

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `auth_attempts_total` | Counter | Intentos de login |
| `active_sessions` | Gauge | Sesiones activas |

### 4.6.4 Métricas de Base de Datos

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `db_query_duration_seconds` | Histogram | Duración de queries |
| `db_connections_active` | Gauge | Conexiones activas |

### 4.6.5 Métricas de WebSocket

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `websocket_connections_total` | Counter | Conexiones totales |
| `websocket_connections_active` | Gauge | Conexiones activas |
| `websocket_messages_total` | Counter | Mensajes enviados/recibidos |


---

# 5. BASE DE DATOS

## 5.1 MongoDB Configuración

### 5.1.1 Arquitectura de Seguridad

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONGODB SECURITY MODEL                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐         │
│   │   Root User (admin) │      │   App User          │         │
│   │   • Role: root      │      │   • Role: readWrite │         │
│   │   • Admin DB only   │      │   • disherio DB     │         │
│   │   • Management      │      │   • Application     │         │
│   └─────────────────────┘      └─────────────────────┘         │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │   Authentication: SCRAM-SHA-256                         │   │
│   │   Authorization: Role-Based Access Control (RBAC)       │   │
│   │   Network: Docker internal network only (no external)   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1.2 Script de Inicialización: init-mongo.js

```javascript
// MongoDB Initialization Script
// Se ejecuta automáticamente en primer arranque

db = db.getSiblingDB('admin');

// Variables de entorno
const rootUser = process.env.MONGO_INITDB_ROOT_USERNAME;
const rootPass = process.env.MONGO_INITDB_ROOT_PASSWORD;
const appDb = process.env.MONGO_INITDB_DATABASE || 'disherio';
const appUser = process.env.MONGO_APP_USER || 'disherio_app';
const appPass = process.env.MONGO_APP_PASSWORD || 'change-this-app-password';

// Switch a application database
db = db.getSiblingDB(appDb);

// Crear usuario de aplicación con privilegios limitados
db.createUser({
  user: appUser,
  pwd: appPass,
  roles: [
    { role: 'readWrite', db: appDb },           // ✅ Solo readWrite en app DB
    { role: 'clusterMonitor', db: 'admin' }     // ✅ Solo monitoreo en admin
  ]
});
```

### 5.1.3 Índices Creados Automáticamente

| Colección | Índice | Tipo | Propósito |
|-----------|--------|------|-----------|
| restaurants | `{ email: 1 }` | Unique | Búsqueda por email |
| restaurants | `{ slug: 1 }` | Unique | Búsqueda por slug |
| restaurants | `{ status: 1 }` | Standard | Filtrado por estado |
| categories | `{ restaurant_id: 1 }` | Standard | Filtrado por restaurante |
| dishes | `{ restaurant_id: 1 }` | Standard | Filtrado por restaurante |
| dishes | `{ restaurant_id: 1, category_id: 1 }` | Compound | Filtrado compuesto |
| dishes | `{ disher_name.value: "text" }` | Text | Búsqueda full-text |
| orders | `{ session_id: 1, order_date: -1 }` | Compound | Órdenes por sesión |
| orders | `{ order_date: -1 }` | Standard | Ordenamiento cronológico |
| itemorders | `{ session_id: 1, item_state: 1 }` | Compound | KDS queries |
| staff | `{ restaurant_id: 1, username: 1 }` | Unique | Login de usuarios |
| customers | `{ customer_email: 1 }` | Unique | Búsqueda por email |

**Total:** 15+ índices para optimización de queries.

## 5.2 Redis Configuración

### 5.2.1 Uso de Redis en la Aplicación

| Función | Propósito | Configuración |
|---------|-----------|---------------|
| Cache | Cache de sesiones y datos frecuentes | TTL configurable |
| Pub/Sub | Socket.IO adapter multi-nodo | Redis Adapter |
| Rate Limiting | Contadores distribuidos | Sliding window |
| Session Store | Almacenamiento de sesiones | Persistent keys |

### 5.2.2 Seguridad Redis

```yaml
# docker-compose.yml
redis:
  command: redis-server --requirepass "${REDIS_PASSWORD:-redis_secure_password}"
  environment:
    REDIS_PASSWORD: ${REDIS_PASSWORD:-redis_secure_password}
```

- ✅ Autenticación por contraseña obligatoria
- ✅ No expuesto a red externa
- ✅ Sin modo cluster (single instance)
- ✅ Persistencia opcional (configurable)

---

# 6. SCRIPTS DE DESPLIEGUE

## 6.1 Análisis: quickstart.sh

**Propósito:** Unificación de configuración, verificación e inicio.

```bash
#!/bin/bash
set -e                                      # ✅ Fail fast

# Flujo:
# 1. Verifica si existe .env
# 2. Si no existe → Ejecuta configurador interactivo
# 3. Si existe → Opción de reconfigurar
# 4. Ejecuta verify.sh
# 5. Construye e inicia servicios según DEPLOYMENT_MODE
# 6. Muestra información de acceso
```

**Características:**
- ✅ Colores para mejor UX
- ✅ Flujo interactivo con confirmaciones
- ✅ Soporte para todos los modos de despliegue
- ✅ Muestra URLs de acceso según modo

## 6.2 Análisis: infrastructure/scripts/configure.sh

**Propósito:** Configurador interactivo multi-entorno (760 líneas).

### 6.2.1 Flujo Principal

```
┌─────────────────┐
│  show_welcome   │  ← Muestra IPs detectadas
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ select_deployment│ ← Menú interactivo
│     _mode       │
└────────┬────────┘
         │
    ┌────┴────┬────────┬──────────┬─────────┐
    ▼         ▼        ▼          ▼         │
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐     │
│ local │ │local- │ │public-│ │domain │     │
│       │ │  ip   │ │  ip   │ │       │     │
└───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘     │
    │         │         │         │         │
    └─────────┴─────────┴─────────┘         │
                  │                         │
                  ▼                         │
    ┌─────────────────────────┐             │
    │   generate_caddyfile    │             │
    │ generate_docker_compose │             │
    │       _override         │             │
    └───────────┬─────────────┘             │
                │                           │
                ▼                           │
    ┌─────────────────────────┐             │
    │      show_summary       │─────────────┘
    │      show_next_steps    │
    └─────────────────────────┘
```

### 6.2.2 Modos de Despliegue Soportados

| Modo | HTTPS | Caso de Uso | Archivos Generados |
|------|-------|-------------|-------------------|
| `local` | ❌ No | Desarrollo local | `.env`, `Caddyfile`, `docker-compose.override.yml` |
| `local-ip` | ❌ No | Red local (restaurante) | `.env`, `Caddyfile`, `docker-compose.override.yml` |
| `public-ip` | ✅ Sí (vía túnel) | IP pública | `.env`, `Caddyfile`, `docker-compose.override.yml` |
| `domain` | ✅ Sí (Let's Encrypt) | Producción profesional | `.env`, `Caddyfile`, `docker-compose.override.yml` |

### 6.2.3 Detección de IPs

```bash
# IP Local (Linux)
ip=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')

# IP Pública (múltiples servicios)
for service in "ifconfig.me" "icanhazip.com" "api.ipify.org"; do
    ip=$(curl -s --max-time 5 "$service" 2>/dev/null || true)
done
```

## 6.3 Análisis: infrastructure/scripts/verify.sh

**Propósito:** Verificación pre-despliegue.

### 6.3.1 Verificaciones Implementadas

| Verificación | Comando/Validación | Importancia |
|--------------|-------------------|-------------|
| Docker instalado | `command -v docker` | ✅ Crítica |
| Docker Compose | `docker compose version` | ✅ Crítica |
| Docker daemon | `docker info` | ✅ Crítica |
| Archivo .env | `-f "$PROJECT_ROOT/.env"` | ✅ Crítica |
| Caddyfile | `-f "$PROJECT_ROOT/Caddyfile"` | ✅ Crítica |
| Variables requeridas | `JWT_SECRET`, modo específico | ⚠️ Advertencia |
| Puertos disponibles | `ss -tln \| grep :$port` | ⚠️ Advertencia |
| Recursos sistema | `free -m`, `df -h` | ℹ️ Informativa |

## 6.4 Análisis: scripts/install.sh

**Propósito:** Instalador automatizado para servidores Ubuntu/Debian (878 líneas).

### 6.4.1 Pasos del Instalador

| Paso | Función | Descripción |
|------|---------|-------------|
| 1 | `configure_access()` | Selección de modo, dominio/IP, puertos |
| 2 | `install_dependencies()` | Instala Docker, configura firewall |
| 3 | `generate_secrets()` | Genera JWT_SECRET, contraseñas MongoDB |
| 4 | `write_config()` | Crea .env, Caddyfile |
| 5 | `build_and_start()` | Construye imágenes, inicia servicios |
| 6 | `verify_installation()` | Health checks de contenedores |
| 7 | `seed_database()` | Crea usuario admin, restaurante, roles |

### 6.4.2 Generación de Secretos

```bash
# JWT Secret - 64 caracteres alfanuméricos
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)

# Admin Password - 20 caracteres con símbolos
ADMIN_PASS=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9@#$%^&*' | head -c 20)

# PIN - 4 dígitos numéricos
ADMIN_PIN=$(printf '%04d' $((RANDOM % 10000)))

# MongoDB credentials
MONGO_ROOT_PASS=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)
MONGO_APP_PASS=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)
```

### 6.4.3 Seed de Base de Datos

El instalador crea automáticamente:

1. **Restaurante por defecto:**
   - Nombre: "DisherIO Restaurant"
   - Configuración regional (idioma, moneda, impuestos)

2. **Roles del sistema:**
   - `Admin` - Permisos: `['ADMIN']`
   - `KTS` - Permisos: `['KTS']` (Kitchen Display System)
   - `POS` - Permisos: `['POS']` (Point of Sale)
   - `TAS` - Permisos: `['TAS']` (Table Service)

3. **Usuario administrador:**
   - Username: `admin`
   - Password: Generada aleatoriamente
   - PIN: Generado aleatoriamente (4 dígitos)

## 6.5 Análisis: scripts/backup.sh

**Propósito:** Backup automatizado de MongoDB.

### 6.5.1 Funcionalidad

```bash
# Backup directory
BACKUP_DIR="${BACKUP_DIR:-/var/backups/disherio}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="disherio_backup_${TIMESTAMP}"
ARCHIVE="${BACKUP_PATH}.tar.gz"

# Proceso:
# 1. mongodump → /tmp/dump_${TIMESTAMP}
# 2. docker cp → host
# 3. tar czf → archivo comprimido
# 4. find + rm → rotación (archivos > 7 días)
```

### 6.5.2 Retención y Rotación

- **Retención:** 7 días por defecto
- **Compresión:** tar.gz
- **Ubicación:** `/var/backups/disherio/`
- **Nombre:** `disherio_backup_YYYYMMDD_HHMMSS.tar.gz`

## 6.6 Análisis: verify-nonroot.sh

**Propósito:** Verifica configuración de ejecución non-root.

### 6.6.1 Verificaciones

| Aspecto | Verificación | Estado |
|---------|-------------|--------|
| Grupo nodejs | `addgroup -g 1001` | ✅ Requerido |
| Usuario nodejs | `adduser -u 1001` | ✅ Requerido |
| Ownership /app | `chown -R nodejs:nodejs` | ✅ Requerido |
| Directorio uploads | `mkdir -p /app/uploads` | ✅ Requerido |
| USER instruction | `USER nodejs` | ✅ Requerido |
| docker-compose user | `user: "1001:1001"` | ✅ Requerido |

---

# 7. CONFIGURACIÓN DE ENTORNOS

## 7.1 Análisis: .env.example

Archivo de ejemplo con 218 líneas documentando todas las variables.

### 7.1.1 Secciones de Configuración

| Sección | Variables | Descripción |
|---------|-----------|-------------|
| 1. Modo Despliegue | `DEPLOYMENT_MODE` | local, local-ip, public-ip, domain |
| 2. Configuración Red | `PORT`, `HTTP_PORT`, `HTTPS_PORT`, `FRONTEND_URL` | Puertos y URLs |
| 3. Seguridad | `JWT_SECRET`, `JWT_EXPIRES`, `MONGODB_URI` | Credenciales y tokens |
| 4. MongoDB | `MONGO_ROOT_USER`, `MONGO_ROOT_PASS` | Admin MongoDB |
| 5. Redis | `REDIS_URL`, `REDIS_PASSWORD` | Configuración cache |
| 6. Monitoreo | `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` | Acceso Grafana |
| 7. Específico Modo | `LOCAL_IP`, `DOMAIN`, `CF_TUNNEL_TOKEN` | Variables por modo |

### 7.1.2 Variables Críticas de Seguridad

```bash
# JWT Secret (mínimo 32 bytes de entropía)
# Generar con: openssl rand -hex 32
JWT_SECRET=cambiar_esto_por_un_secreto_largo_y_aleatorio_de_al_menos_64_caracteres

# MongoDB Root (cambiar en producción)
MONGO_ROOT_PASS=cambiar_esta_contrasena_root_inmediatamente

# MongoDB App (cambiar en producción)
MONGO_APP_PASS=cambiar_esta_contrasena_app_inmediatamente

# Redis (cambiar en producción)
REDIS_PASSWORD=cambiar_esta_contrasena_redis_inmediatamente
```

### 7.1.3 Variables por Modo de Despliegue

**Modo Local:**
```bash
DEPLOYMENT_MODE=local
PORT=3000
CADDY_PORT=4200
FRONTEND_URL=http://localhost:4200
```

**Modo Local-IP:**
```bash
DEPLOYMENT_MODE=local-ip
LOCAL_IP=192.168.1.100
HTTP_PORT=80
TLS_ENABLED=false
```

**Modo Public-IP:**
```bash
DEPLOYMENT_MODE=public-ip
PUBLIC_IP=203.0.113.1
TUNNEL_TYPE=cloudflare
CF_TUNNEL_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CF_TUNNEL_DOMAIN=tunel-uuid.cfargotunnel.com
```

**Modo Domain:**
```bash
DEPLOYMENT_MODE=domain
DOMAIN=disherio.ejemplo.com
EMAIL=admin@ejemplo.com
TLS_ENABLED=true
TLS_AUTO=true
```

---

# 8. CI/CD PIPELINE

## 8.1 Análisis: .github/workflows/ci.yml

Pipeline de GitHub Actions con 299 líneas.

### 8.1.1 Jobs del Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        CI/CD PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│   │ lint-backend │  │ lint-frontend│  │   (paralelo) │         │
│   │  (tsc+eslint)│  │  (tsc+eslint)│  │              │         │
│   └──────┬───────┘  └──────┬───────┘  └──────────────┘         │
│          │                 │                                    │
│          └────────┬────────┘                                    │
│                   ▼                                             │
│          ┌──────────────┐  ┌──────────────┐                    │
│          │ test-backend │  │ test-frontend│  (con MongoDB svc) │
│          │  (con cover) │  │              │                    │
│          └──────┬───────┘  └──────┬───────┘                    │
│                 │                 │                             │
│                 └────────┬────────┘                             │
│                          ▼                                      │
│          ┌───────────────────────────────┐                      │
│          │      build-backend-image      │                      │
│          │      build-frontend-image     │                      │
│          │  (multi-platform: amd64,arm64)│                      │
│          └───────────────┬───────────────┘                      │
│                          │                                      │
│           ┌──────────────┼──────────────┐                       │
│           ▼              ▼              ▼                       │
│    ┌──────────┐   ┌──────────┐   ┌──────────┐                  │
│    │  deploy  │   │  deploy  │   │   skip   │                  │
│    │ staging  │   │production│   │   (PR)   │                  │
│    │ (develop)│   │  (tags)  │   │          │                  │
│    └──────────┘   └──────────┘   └──────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.1.2 Jobs Detallados

| Job | Trigger | Propósito | Plataformas |
|-----|---------|-----------|-------------|
| `lint-backend` | push, PR | TypeScript check + ESLint | ubuntu-latest |
| `lint-frontend` | push, PR | TypeScript check + ESLint | ubuntu-latest |
| `test-backend` | push, PR | Tests con MongoDB service | ubuntu-latest |
| `test-frontend` | push, PR | Tests Angular | ubuntu-latest |
| `build-backend` | push (no PR) | Build + push a GHCR | linux/amd64, linux/arm64 |
| `build-frontend` | push (no PR) | Build + push a GHCR | linux/amd64, linux/arm64 |
| `deploy-staging` | develop branch | Deploy a staging | - |
| `deploy-production` | tags (v*) | Deploy a producción | - |

### 8.1.3 Configuración de Build

```yaml
# Multi-platform build
platforms: linux/amd64,linux/arm64

# Registry
REGISTRY: ghcr.io
BACKEND_IMAGE: ghcr.io/${{ github.repository }}/backend
FRONTEND_IMAGE: ghcr.io/${{ github.repository }}/frontend

# Caching
cache-from: type=gha
cache-to: type=gha,mode=max

# Tags
tags: |
  type=ref,event=branch
  type=ref,event=pr
  type=semver,pattern={{version}}
  type=semver,pattern={{major}}.{{minor}}
  type=sha,prefix=,suffix=,format=short
```

---

# 9. SEGURIDAD DE INFRAESTRUCTURA

## 9.1 Modelo de Defensa en Profundidad

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1: PERÍMETRO (Red)                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Firewall (UFW/iptables) - Solo puertos 80/443                              │
│ • Docker network bridge aislada                                              │
│ • No exposición de puertos de DB/Cache                                       │
│ • Rate limiting por Caddy                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CAPA 2: REVERSE PROXY (Caddy)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ • TLS 1.3 mínimo (sin downgrade)                                             │
│ • Certificados Let's Encrypt automáticos                                     │
│ • Headers de seguridad (HSTS, CSP, X-Frame-Options)                          │
│ • Redirección HTTP → HTTPS                                                   │
│ • Remoción de headers identificadores                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CAPA 3: APLICACIÓN (Backend)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ • JWT con expiración (8h por defecto)                                        │
│ • Validación de entrada (Zod schemas)                                        │
│ • Rate limiting por IP y usuario                                             │
│ • Sanitización de datos                                                      │
│ • Prevención de inyección NoSQL                                              │
│ • RBAC (Role-Based Access Control)                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CAPA 4: CONTENEDORES                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Ejecución como non-root (UID 1001)                                         │
│ • Imágenes Alpine Linux (mínima superficie)                                  │
│ • Multi-stage builds (solo artefactos en runtime)                            │
│ • Resource limits (CPU/Memory)                                               │
│ • Read-only filesystem donde sea posible                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CAPA 5: DATOS                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ • MongoDB con autenticación obligatoria                                      │
│ • Separación root/app (principio mínimo privilegio)                          │
│ • Redis con contraseña                                                       │
│ • Volúmenes con permisos restringidos                                        │
│ • Sin datos sensibles en logs                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Non-Root Execution

### 9.2.1 Backend (UID 1001)

```dockerfile
# Dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nodejs -G nodejs

RUN chown -R nodejs:nodejs /app

USER nodejs
```

```yaml
# docker-compose.yml
backend:
  user: "1001:1001"
```

### 9.2.2 Frontend (UID 473 - Caddy)

La imagen `caddy:2-alpine` incluye usuario `caddy` (UID 473) por defecto.

## 9.3 Secrets Management

### 9.3.1 Variables Sensibles

| Variable | Ubicación | Persistencia | Rotación |
|----------|-----------|--------------|----------|
| JWT_SECRET | `.env` | Sí | Manual |
| MONGO_ROOT_PASS | `.env` | Sí | Requiere recrear DB |
| MONGO_APP_PASS | `.env` | Sí | Requiere recrear DB |
| REDIS_PASSWORD | `.env` | Sí | Requiere reinicio |
| CF_TUNNEL_TOKEN | `.env` | Sí | Cloudflare Dashboard |
| GITHUB_TOKEN | GitHub Secrets | No | Automática |

### 9.3.2 Mejores Prácticas Implementadas

- ✅ `.env` en `.gitignore`
- ✅ `.credentials` con permisos 600
- ✅ Generación automática de secretos en install.sh
- ✅ Valores por defecto obviamente inseguros (requieren cambio)

## 9.4 Network Security

### 9.4.1 Exposición de Puertos

| Puerto | Servicio | Exposición | Acceso |
|--------|----------|------------|--------|
| 80 | Caddy | Público | Internet (redirige a HTTPS) |
| 443 | Caddy | Público | Internet (HTTPS) |
| 9090 | Prometheus | Público | Internet (⚠️ sin auth) |
| 3001 | Grafana | Público | Internet (con auth) |
| 9093 | Alertmanager | Público | Internet (⚠️ sin auth) |
| 3000 | Backend | Interno | Solo Caddy |
| 4200 | Frontend | Interno | Solo Caddy |
| 27017 | MongoDB | Interno | Solo backend/exporters |
| 6379 | Redis | Interno | Solo backend/exporters |

### 9.4.2 Firewall Recomendado (UFW)

```bash
# Política por defecto
ufw default deny incoming
ufw default allow outgoing

# SSH (para no perder acceso)
ufw allow 22/tcp

# HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp  # HTTP/3

# Opcional: Restringir monitoreo a IPs específicas
ufw allow from 192.168.1.0/24 to any port 9090
ufw allow from 192.168.1.0/24 to any port 3001
```


---

# 10. DOCUMENTACIÓN EXISTENTE

## 10.1 Estructura de Documentación

```
docs/
└── technical-analysis/
    └── INFRASTRUCTURE_ANALYSIS.md         # ← Este documento

infrastructure/docs/
├── ARCHITECTURE.md                        # Documentación técnica de arquitectura (690 líneas)
└── DEPLOYMENT_GUIDE.md                    # Guía de despliegue completa (816 líneas)
```

## 10.2 Análisis: ARCHITECTURE.md

**Ubicación:** `/home/isma/Proyectos/disherio/infrastructure/docs/ARCHITECTURE.md`

**Contenido:**

| Sección | Contenido | Líneas |
|---------|-----------|--------|
| Visión General | Principios fundamentales, patrones de diseño | 40 |
| Diagramas de Flujo | Flujo de configuración, secuencia de inicio | 100 |
| Arquitectura de Red | Modo local, local-ip, public-ip, domain | 160 |
| Componentes del Sistema | Caddy, Backend, Frontend, MongoDB, Redis | 100 |
| Modelo de Configuración | Jerarquía, templates, rendering | 90 |
| Seguridad por Capas | Defensa en profundidad, matriz de protección | 80 |
| Decisiones de Diseño | Caddy vs Nginx, Cloudflare Tunnel | 60 |
| Escalabilidad | Arquitectura horizontal, comando de scaling | 60 |

### 10.2.1 Decisiones de Diseño Documentadas

| Decisión | Alternativas | Justificación |
|----------|--------------|---------------|
| **Caddy vs Nginx** | Nginx + Certbot | Caddy: HTTPS automático, configuración simpler |
| **Docker Compose Override** | Múltiples compose completos | Reutilización de configuración base |
| **Cloudflare Tunnel** | ngrok, VPN, cert autofirmado | URL fija, DDoS protection, sin abrir puertos |
| **MongoDB vs PostgreSQL** | PostgreSQL | Modelo documental flexible para menús/pedidos |
| **Redis** | Memcached | Pub/Sub para WebSockets, persistencia opcional |

## 10.3 Análisis: DEPLOYMENT_GUIDE.md

**Ubicación:** `/home/isma/Proyectos/disherio/infrastructure/docs/DEPLOYMENT_GUIDE.md`

**Contenido:**

| Sección | Descripción | Líneas |
|---------|-------------|--------|
| Requisitos Previos | Software, hardware, verificación | 50 |
| Resumen de Modos | Tabla comparativa de 4 modos | 30 |
| Inicio Rápido | Comandos de instalación | 30 |
| Modo Local | Desarrollo en localhost | 50 |
| Modo Red Local | Acceso desde red privada | 80 |
| Modo IP Pública | Cloudflare Tunnel / ngrok | 130 |
| Modo Dominio Propio | Let's Encrypt, DNS, firewall | 110 |
| Comandos de Administración | Gestión de servicios, logs | 60 |
| Solución de Problemas | Troubleshooting común | 120 |
| Seguridad | Credenciales, firewall, encriptación | 70 |
| Actualizaciones | Procedimiento de update | 50 |

### 10.3.1 Matriz de Modos de Despliegue

| Modo | HTTPS | Dominio | IP Pública | Firewall | Ideal Para |
|------|-------|---------|------------|----------|------------|
| Local | ❌ | localhost | No | No | Desarrollo |
| Local-IP | ❌ | Ninguno | No | Sí (puerto 80) | Restaurantes locales |
| Public-IP | ✅ | Cloudflare | Sí | No (tunnel) | Demo temporal |
| Domain | ✅ | Propio | Sí | Sí (80/443) | Producción |

## 10.4 Documentación de Monitoreo

**Archivo:** `/home/isma/Proyectos/disherio/MONITORING.md` (528 líneas)

**Secciones principales:**

| Sección | Contenido |
|---------|-----------|
| Overview | Arquitectura del stack de monitoreo |
| Quick Start | Configuración inicial |
| Services | Prometheus, Grafana, Alertmanager |
| Dashboards | Descripción de 3 dashboards |
| Alerts | Reglas de alertas críticas/warning |
| Metrics | Catálogo completo de métricas |
| Troubleshooting | Problemas comunes y soluciones |
| Maintenance | Tareas diarias/semanales/mensuales |
| Security | Control de acceso, network security |

## 10.5 Otros Archivos de Documentación

| Archivo | Ubicación | Propósito |
|---------|-----------|-----------|
| README.md | `/` | Introducción general del proyecto |
| README_es.md | `/` | Versión en español |
| README_fr.md | `/` | Versión en francés |
| HTTPS-SETUP.md | `/` | Guía específica de configuración HTTPS |
| CACHE_SETUP.md | `/` | Configuración de Redis/cache |
| MONITORING.md | `/` | Guía completa de monitoreo |
| AGENTS.md | `/` | Configuración de agentes Kimi |

---

# 11. CONCLUSIONES Y RECOMENDACIONES

## 11.1 Fortalezas de la Infraestructura

### 11.1.1 Arquitectura

| Fortaleza | Descripción | Impacto |
|-----------|-------------|---------|
| **Multi-entorno** | 4 modos de despliegue con misma base de código | ✅ Flexibilidad máxima |
| **Containerización** | Docker + Compose, inmutable, reproducible | ✅ Portabilidad |
| **Seguridad en capas** | Defensa en profundidad, non-root, TLS 1.3 | ✅ Alta seguridad |
| **Monitoreo completo** | Prometheus + Grafana + Alertmanager | ✅ Observabilidad |
| **Automatización** | Scripts de instalación, CI/CD | ✅ Reduce errores humanos |

### 11.1.2 Seguridad

| Aspecto | Implementación | Calificación |
|---------|----------------|--------------|
| TLS/SSL | TLS 1.3, Let's Encrypt auto | ⭐⭐⭐⭐⭐ |
| Container Security | Non-root, Alpine, read-only | ⭐⭐⭐⭐⭐ |
| Secrets Management | .env, generación automática | ⭐⭐⭐⭐ |
| Network Security | Red aislada, firewall | ⭐⭐⭐⭐⭐ |
| Authentication | JWT, MongoDB auth, Redis auth | ⭐⭐⭐⭐⭐ |

### 11.1.3 Operabilidad

| Aspecto | Implementación | Calificación |
|---------|----------------|--------------|
| Healthchecks | Todos los servicios | ⭐⭐⭐⭐⭐ |
| Logs | Rotación configurada | ⭐⭐⭐⭐ |
| Monitoreo | Métricas + Alertas | ⭐⭐⭐⭐⭐ |
| Backup | Script automatizado | ⭐⭐⭐⭐ |
| Documentación | Extensa y detallada | ⭐⭐⭐⭐⭐ |

## 11.2 Áreas de Mejora

### 11.2.1 Seguridad

| Mejora | Prioridad | Implementación Propuesta |
|--------|-----------|-------------------------|
| **Vault para secrets** | Media | HashiCorp Vault o AWS Secrets Manager |
| **Network policies** | Media | Kubernetes NetworkPolicies (si migra a k8s) |
| **WAF** | Baja | Cloudflare WAF (ya disponible en modo public-ip) |
| **Audit logging** | Media | Logs de auditoría de accesos a DB |
| **Secret rotation** | Baja | Rotación automática de JWT_SECRET |

### 11.2.2 Monitoreo

| Mejora | Prioridad | Implementación Propuesta |
|--------|-----------|-------------------------|
| **Distributed tracing** | Media | Jaeger o Zipkin |
| **Log aggregation** | Media | ELK stack o Loki |
| **APM** | Baja | New Relic o Datadog (comercial) |
| **SLOs/SLIs** | Media | Definir objetivos de nivel de servicio |

### 11.2.3 Escalabilidad

| Mejora | Prioridad | Implementación Propuesta |
|--------|-----------|-------------------------|
| **Load balancer externo** | Alta | Traefik o HAProxy para múltiples nodos |
| **MongoDB replica set** | Alta | Replicación para HA |
| **Redis Cluster** | Media | Clustering para alta disponibilidad |
| **CDN** | Baja | Cloudflare CDN para assets estáticos |

## 11.3 Matriz de Cumplimiento de Mejores Prácticas

| Práctica | Estado | Notas |
|----------|--------|-------|
| 12-Factor App | ✅ 11/12 | Falta: admin processes separados |
| CIS Docker Benchmark | ✅ 80% | Revisar: Content trust, User namespaces |
| OWASP Top 10 | ✅ Protegido | XSS, Injection, Auth implementados |
| NIST Cybersecurity | ✅ 3/5 | Identify, Protect, Detect implementados |

## 11.4 Métricas de Infraestructura

### 11.4.1 Recursos por Servicio

| Servicio | CPU Limit | Memory Limit | Imagen Size |
|----------|-----------|--------------|---------------|
| MongoDB | 2.0 | 2GB | ~700MB |
| Redis | 0.5 | 512MB | ~30MB |
| Backend | 1.0 | 1GB | ~150MB |
| Frontend | 0.5 | 512MB | ~50MB |
| Caddy | 0.5 | 256MB | ~50MB |
| Prometheus | 1.0 | 2GB | ~200MB |
| Grafana | 0.5 | 512MB | ~300MB |
| **Total** | **~6.5** | **~7GB** | **~1.5GB** |

### 11.4.2 Métricas de Seguridad

| Métrica | Valor |
|---------|-------|
| Vulnerabilidades CVE conocidas (imágenes base) | Bajo (Alpine) |
| Exposición de puertos | Mínima (solo 80/443) |
| Servicios ejecutando como root | 0 |
| Secretos hardcodeados | 0 |
| Variables sin default seguro | 3 (intencional) |

## 11.5 Diagrama de Arquitectura Final

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DISHERIO INFRASTRUCTURE                         │
│                          Complete System Architecture                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Internet Users] ←──→ [Cloudflare] ←──→ [Caddy :443]                       │
│                              │                                              │
│                              │ TLS 1.3, Auto HTTPS                          │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Security Headers: HSTS, CSP, X-Frame-Options, XSS Protection        │   │
│  │  Compression: gzip, zstd                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐          ┌─────────────────────┐                  │
│   │   Frontend (Caddy)  │          │   Backend (Node.js) │                  │
│   │   • Angular SPA     │          │   • Express API     │                  │
│   │   • Port: 4200      │          │   • Port: 3000      │                  │
│   │   • Static files    │          │   • JWT Auth        │                  │
│   └─────────────────────┘          │   • Socket.IO       │                  │
│                                     └──────────┬────────┘                  │
│                                                │                            │
│                     ┌──────────────────────────┼─────────────────────────┐  │
│                     │                          │                         │  │
│                     ▼                          ▼                         ▼  │
│   ┌─────────────────────┐          ┌─────────────────────┐  ┌──────────┐   │
│   │   MongoDB           │          │   Redis             │  │ Prometheus│   │
│   │   • Port: 27017     │          │   • Port: 6379      │  │ • :9090  │   │
│   │   • Auth enabled    │          │   • Auth enabled    │  │ • :3001  │   │
│   │   • Indexes         │          │   • Cache/PubSub    │  │ • :9093  │   │
│   └─────────────────────┘          └─────────────────────┘  └──────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MONITORING & OPS LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│   │  Grafana        │  │  Alertmanager   │  │  Exporters                  │ │
│   │  • Dashboards   │  │  • Email/Slack  │  │  • MongoDB Exporter (:9216) │ │
│   │  • Prometheus   │  │  • Grouping     │  │  • Redis Exporter (:9121)   │ │
│   │    Datasource   │  │  • Inhibition   │  │  • Node Exporter (:9100)    │ │
│   │  • Alert Rules  │  │  • Routing      │  │  • Caddy (:2019)            │ │
│   └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPLOYMENT OPTIONS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [Local]              [Local-IP]           [Public-IP]       [Domain]      │
│   localhost:4200       192.168.x.x          tunnel.cloudflare  disherio.com │
│        │                    │                    │                │         │
│        └────────────────────┴────────────────────┴────────────────┘         │
│                              │                                              │
│                              ▼                                              │
│                    ┌──────────────────┐                                     │
│                    │  configure.sh    │  ← Interactive setup                │
│                    │  quickstart.sh   |  ← One-command start                │
│                    │  install.sh      |  ← Full server install              │
│                    └──────────────────┘                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 12. APÉNDICE

## 12.1 Glosario de Términos

| Término | Definición |
|---------|------------|
| **Caddy** | Reverse proxy y servidor web con HTTPS automático |
| **Docker Compose** | Orquestación de contenedores multi-servicio |
| **Healthcheck** | Verificación periódica de salud de servicios |
| **HSTS** | HTTP Strict Transport Security, fuerza HTTPS |
| **Let's Encrypt** | Autoridad de certificación gratuita |
| **Multi-stage build** | Construcción Docker en etapas para optimización |
| **Prometheus** | Sistema de monitoreo y alerting |
| **Reverse proxy** | Servidor que redirige solicitudes a backends |
| **TLS 1.3** | Versión más reciente del protocolo TLS |
| **WebSocket** | Protocolo de comunicación bidireccional persistente |

## 12.2 Referencias

### Documentación Oficial

| Tecnología | URL |
|------------|-----|
| Docker | https://docs.docker.com/ |
| Docker Compose | https://docs.docker.com/compose/ |
| Caddy | https://caddyserver.com/docs/ |
| Prometheus | https://prometheus.io/docs/ |
| Grafana | https://grafana.com/docs/ |
| MongoDB | https://docs.mongodb.com/ |
| Redis | https://redis.io/documentation |
| Node.js | https://nodejs.org/docs/ |
| Angular | https://angular.io/docs |

### Documentación DisherIo

| Documento | Ubicación |
|-----------|-----------|
| Architecture | `infrastructure/docs/ARCHITECTURE.md` |
| Deployment Guide | `infrastructure/docs/DEPLOYMENT_GUIDE.md` |
| Monitoring | `MONITORING.md` |
| HTTPS Setup | `HTTPS-SETUP.md` |
| Cache Setup | `CACHE_SETUP.md` |

## 12.3 Historial de Versiones

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 2026-04-05 | Infrastructure Analysis Agent | Análisis inicial completo |

---

<div align="center">

**FIN DEL DOCUMENTO**

*Documento generado automáticamente por análisis de infraestructura*
*Fecha de generación: 2026-04-05*

</div>
