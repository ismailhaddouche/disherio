# 🔧 INFRA_DEBUG.md - Análisis de Infraestructura DisherIO

> **Fecha de análisis:** 2026-03-26  
> **Analista:** DevOps/Infra Developer  
> **Ubicación:** `/root/.openclaw/workspace/projects/disherio-refactor/`

---

## 📋 Resumen Ejecutivo

Se realizó un análisis exhaustivo de la infraestructura de DisherIO. Se encontraron **7 problemas de configuración**, **4 bugs de infraestructura** y se proponen **9 fixes** para mejorar la robustez del sistema.

| Categoría | Crítico | Alto | Medio | Bajo |
|-----------|:-------:|:----:|:-----:|:----:|
| Configuración | 1 | 2 | 3 | 1 |
| Bugs | 1 | 2 | 1 | 0 |

---

## 1. 🚨 Problemas de Configuración

### 1.1 Inconsistencia de Healthchecks entre Entornos

**Archivos afectados:** `docker-compose.yml` vs `docker-compose.prod.yml`

| Aspecto | Dev | Producción |
|---------|-----|------------|
| `interval` mongo | 10s | 10s ✅ |
| `retries` mongo | 10 | 6 ⚠️ |
| `start_period` mongo | 60s | 20s ⚠️ |
| `interval` backend | 10s | 30s ⚠️ |
| `interval` frontend | 10s | 30s ⚠️ |

**Problema:** El entorno de producción tiene `start_period` más corto para MongoDB (20s vs 60s), lo que puede causar fallos de salud prematuros en sistemas lentos.

**Severidad:** 🔴 **Alto**

---

### 1.2 Falta de `version` en docker-compose.yml

**Archivo:** `docker-compose.yml`

```yaml
# ACTUAL (falta declaración de versión)
services:
  mongo:
    ...
```

```yaml
# CORRECTO
docker-compose.yml debería incluir:
version: '3.8'
```

**Problema:** Aunque Docker Compose moderno infiere la versión, la ausencia explícita puede causar comportamientos inconsistentes entre versiones de Docker Compose.

**Severidad:** 🟡 **Medio**

---

### 1.3 Backend Dockerfile - Falta de `tsconfig.json` en COPY

**Archivo:** `backend/Dockerfile`

```dockerfile
# ACTUAL
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
```

**Problema:** Si hay archivos de configuración adicionales (`.eslintrc`, `jest.config.js`, etc.) no se copian, lo que puede causar fallos de build.

**Severidad:** 🟡 **Medio**

---

### 1.4 Frontend Dockerfile - COPY Ineficiente

**Archivo:** `frontend/Dockerfile`

```dockerfile
# ACTUAL (copia TODO incluyendo node_modules si existiera localmente)
COPY . .
RUN npm run build -- --output-path=dist/disherio
```

**Problema:** El `COPY . .` copia archivos innecesarios (`.git`, `node_modules` local, archivos de IDE) al contexto de build, aumentando el tiempo y tamaño de la imagen.

**Severidad:** 🟡 **Medio**

---

### 1.5 Inconsistencia de Networks entre Compose Files

**Archivo:** `docker-compose.prod.yml`

```yaml
# Producción tiene subnet definida
networks:
  disherio_net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

**Archivo:** `docker-compose.yml`

```yaml
# Desarrollo NO tiene subnet
networks:
  disherio_net:
    driver: bridge
    name: disherio_disherio_net
```

**Problema:** La falta de subnet en desarrollo puede causar conflictos de IP si hay otras redes Docker en el host.

**Severidad:** 🟢 **Bajo**

---

### 1.6 Caddyfile - Falta Headers de Seguridad

**Archivo:** `Caddyfile`

```caddy
# ACTUAL - Sin headers de seguridad
:80 {
    handle /api/* {
        reverse_proxy backend:3000
    }
    ...
}
```

**Problema:** Faltan headers esenciales de seguridad:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (para HTTPS)

**Severidad:** 🔴 **Alto**

---

### 1.7 Variables de Entorno - Valores por Defecto Inseguros

**Archivo:** `docker-compose.prod.yml`

```yaml
environment:
  JWT_SECRET: ${JWT_SECRET:-changeme_in_production}
```

**Problema:** El valor por defecto `changeme_in_production` es inseguro. Si alguien olvida configurar `JWT_SECRET`, el sistema usará una clave predecible.

**Severidad:** 🔴 **Crítico**

---

## 2. 🐛 Bugs de Infraestructura

### 2.1 Script install.sh - Manejo de Errores Insuficiente

**Archivo:** `scripts/install.sh`

```bash
# LÍNEA PROBLEMÁTICA
docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Step|#|ERROR|error)" || true
```

**Bug:** El uso de `|| true` al final hace que el build siempre "suceda" exitosamente, incluso si falla. El script continúa como si todo estuviera bien.

**Severidad:** 🔴 **Crítico**

---

### 2.2 Backend Healthcheck - URL Incorrecta

**Archivo:** `docker-compose.yml`

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/health || exit 1"]
```

**Bug:** El script `restart.sh` verifica `/api/health` pero el healthcheck del compose verifica `/health`. Si la aplicación expone `/api/health`, el healthcheck del compose nunca funcionará.

**Severidad:** 🟠 **Alto**

---

### 2.3 Caddyfile - Configuración WebSocket Incompleta

**Archivo:** `Caddyfile`

```caddy
@socketio {
    path /socket.io/*
}
handle @socketio {
    reverse_proxy backend:3000
}
```

**Bug:** Falta configuración de upgrade para WebSockets. Caddy necesita headers específicos para WebSockets.

**Debería ser:**
```caddy
@socketio {
    path /socket.io/*
}
handle @socketio {
    reverse_proxy backend:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up Upgrade {http.request.header.Upgrade}
        header_up Connection {http.request.header.Connection}
    }
}
```

**Severidad:** 🟠 **Alto**

---

### 2.4 Falta de Retry en Dependencias

**Archivo:** `docker-compose.yml`

```yaml
depends_on:
  mongo:
    condition: service_healthy
```

**Bug:** Aunque usa `condition: service_healthy`, no hay mecanismo de retry si el backend falla al iniciar antes de que MongoDB esté realmente listo para aceptar conexiones.

**Severidad:** 🟡 **Medio**

---

## 3. ✅ Fixes Propuestos

### Fix 1: Unificar Healthchecks

**Aplicar a:** `docker-compose.yml` y `docker-compose.prod.yml`

```yaml
# Estándar para AMBOS entornos
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 60s
```

**Justificación:** Unificar la ruta `/api/health` y dar tiempo suficiente para el inicio.

---

### Fix 2: Agregar Headers de Seguridad al Caddyfile

**Aplicar a:** `Caddyfile`

```caddy
{
    admin off
    auto_https off
}

:80 {
    # Headers de seguridad globales
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
    }

    # WebSocket upgrade para Socket.io
    @socketio {
        path /socket.io/*
    }
    handle @socketio {
        reverse_proxy backend:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
            header_up Upgrade {http.request.header.Upgrade}
            header_up Connection {http.request.header.Connection}
        }
    }

    # API routes
    handle /api/* {
        reverse_proxy backend:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
        }
    }

    # Static uploads
    handle /uploads/* {
        root * /srv/uploads
        file_server
    }

    # Frontend
    handle {
        reverse_proxy frontend:4200 {
            header_up Host {host}
            header_up X-Real-IP {remote}
        }
    }

    log {
        output stdout
        format json
    }
}
```

**Justificación:** Headers de seguridad esenciales y soporte completo para WebSockets.

---

### Fix 3: Corregir Manejo de Errores en install.sh

**Aplicar a:** `scripts/install.sh`

```bash
# REEMPLAZAR (línea ~253)
docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Step|#|ERROR|error)" || true

# POR:
if ! docker compose build --no-cache 2>&1 | tee -a "$LOG_FILE" | grep -E "^(Step|#|ERROR|error)"; then
    echo -e "${RED}ERROR: Falló el build de imágenes${NC}"
    echo -e "${RED}Revisa el log: $LOG_FILE${NC}"
    exit 1
fi
```

**Justificación:** El build debe fallar si hay errores reales.

---

### Fix 4: Optimizar Dockerfiles con .dockerignore

**Crear:** `backend/.dockerignore`
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
.idea
dist
```

**Crear:** `frontend/.dockerignore`
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
.idea
dist
.angular
```

**Justificación:** Reduce el contexto de build y evita copiar archivos innecesarios.

---

### Fix 5: Agregar Versión a docker-compose.yml

**Aplicar a:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  mongo:
    ...
```

---

### Fix 6: Validación de JWT_SECRET Obligatoria

**Aplicar a:** `scripts/install.sh` (agregar validación)

```bash
# Después de cargar/generar JWT_SECRET
if [[ -z "$JWT_SECRET" ]] || [[ "$JWT_SECRET" == "changeme_in_production" ]]; then
    echo -e "${RED}ERROR: JWT_SECRET no configurado o usa valor por defecto inseguro${NC}"
    exit 1
fi
```

**Aplicar a:** `docker-compose.prod.yml`

```yaml
# ELIMINAR valor por defecto inseguro
environment:
  JWT_SECRET: ${JWT_SECRET}  # Sin valor por defecto
```

---

### Fix 7: Agregar Subnet a docker-compose.yml

**Aplicar a:** `docker-compose.yml`

```yaml
networks:
  disherio_net:
    driver: bridge
    name: disherio_disherio_net
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

### Fix 8: Mejorar Frontend Dockerfile

**Aplicar a:** `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar solo lo necesario para install
COPY package*.json ./
RUN npm install --legacy-peer-deps --prefer-offline --no-audit

# Copiar configuraciones y fuentes
COPY angular.json tsconfig*.json ./
COPY src ./src

# Build con configuración de producción
RUN npm run build -- --configuration=production --output-path=dist/disherio

FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist/disherio/browser /srv
COPY Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 4200
```

---

### Fix 9: Agregar Retry al Backend en Startup

**Aplicar a:** `backend/Dockerfile` (o entrypoint)

```dockerfile
# Agregar script de entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
```

**Crear:** `backend/docker-entrypoint.sh`
```bash
#!/bin/sh
set -e

# Esperar a que MongoDB esté disponible
echo "Esperando MongoDB..."
until wget -qO- mongodb://mongo:27017/ --timeout=5 >/dev/null 2>&1; do
    echo "MongoDB no disponible, esperando..."
    sleep 2
done
echo "MongoDB listo!"

exec "$@"
```

---

## 4. 📊 Métricas de Calidad

### Antes del Fix

| Métrica | Valor |
|---------|-------|
| Security Headers | 0/5 |
| Error Handling | 2/5 |
| Consistencia Entornos | 3/5 |
| Docker Best Practices | 2/5 |

### Después del Fix (proyectado)

| Métrica | Valor |
|---------|-------|
| Security Headers | 5/5 ✅ |
| Error Handling | 4/5 ✅ |
| Consistencia Entornos | 5/5 ✅ |
| Docker Best Practices | 4/5 ✅ |

---

## 5. 🎯 Prioridad de Implementación

### Sprint 1 (Inmediato)
1. ✅ Fix 3 - Manejo de errores en install.sh (Crítico)
2. ✅ Fix 6 - Validación de JWT_SECRET (Crítico)
3. ✅ Fix 2 - Unificar healthchecks (Alto)

### Sprint 2 (Corto plazo)
4. ✅ Fix 1 - Headers de seguridad en Caddyfile (Alto)
5. ✅ Fix 4 - .dockerignore files (Medio)
6. ✅ Fix 5 - Agregar versión a compose (Medio)

### Sprint 3 (Mediano plazo)
7. ✅ Fix 7 - Subnet en docker-compose.yml (Bajo)
8. ✅ Fix 8 - Optimizar frontend Dockerfile (Medio)
9. ✅ Fix 9 - Entrypoint con retry (Medio)

---

## 6. 🔍 Comandos de Verificación

```bash
# Verificar headers de seguridad
curl -I http://localhost

# Verificar healthchecks
docker compose ps

# Verificar logs de errores
docker compose logs --tail=50 backend

# Verificar configuración de red
docker network inspect disherio_disherio_net

# Verificar tamaño de imágenes
docker images | grep disherio

# Test de WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost" \
  http://localhost/socket.io/
```

---

## 7. 📝 Notas Finales

### Puntos Positivos Identificados ✅

1. **Scripts bien estructurados:** Los scripts en `/scripts` están bien organizados y documentados
2. **Healthchecks presentes:** Todos los servicios tienen healthchecks definidos
3. **Multi-stage builds:** Los Dockerfiles usan multi-stage builds correctamente
4. **Logs centralizados:** Configuración de logging en producción
5. **Backup automatizado:** Script de backup con rotación incluido

### Áreas de Mejora 🔄

1. Tests de infraestructura automatizados
2. Pipeline de CI/CD
3. Monitoreo con Prometheus/Grafana
4. Centralización de logs con ELK/Loki

---

*Reporte generado por el equipo DevOps de DisherIO*
