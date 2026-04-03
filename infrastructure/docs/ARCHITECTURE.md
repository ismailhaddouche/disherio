# Arquitectura de Infraestructura Multi-Entorno

Este documento describe la arquitectura tecnica, los patrones de diseno y las decisiones tecnicas que fundamentan el sistema de despliegue multi-entorno de DisherIo.

---

## Tabla de Contenidos

1. [Vision General](#vision-general)
2. [Diagramas de Flujo](#diagramas-de-flujo)
3. [Arquitectura de Red por Modo](#arquitectura-de-red-por-modo)
4. [Componentes del Sistema](#componentes-del-sistema)
5. [Modelo de Configuracion](#modelo-de-configuracion)
6. [Seguridad por Capas](#seguridad-por-capas)
7. [Decisiones de Diseno](#decisiones-de-diseno)
8. [Escalabilidad](#escalabilidad)
9. [Referencia de API Interna](#referencia-de-api-interna)

---

## Vision General

El sistema de infraestructura de DisherIo implementa un patron de configuracion declarativa que permite desplegar la misma aplicacion en cuatro escenarios diferentes sin modificacion del codigo fuente. Esto se logra mediante:

- Templates de configuracion parametrizados
- Sistema de overrides de Docker Compose
- Generacion automatizada de archivos de configuracion
- Abstraccion del proveedor de HTTPS

### Principios Fundamentales

1. **Separacion de Concerns**: La logica de negocio permanece identica independientemente del entorno de despliegue
2. **Configuracion sobre Codigo**: El comportamiento del sistema se determina via variables de entorno
3. **Inmutabilidad**: Los contenedores son inmutables; toda configuracion se inyecta en tiempo de ejecucion
4. **Reversibilidad**: Cualquier cambio de configuracion puede revertirse regenerando los archivos

---

## Diagramas de Flujo

### Flujo de Configuracion

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USUARIO                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Ejecuta: ./infrastructure/scripts/configure.sh                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONFIGURADOR INTERACTIVO                                  │
│                                                                              │
│   1. Deteccion automatica de interfaces de red                              │
│      - Obtiene IP local mediante analisis de rutas                         │
│      - Obtiene IP publica via servicios externos (ifconfig.me, ipify)      │
│                                                                              │
│   2. Presentacion de menu de seleccion de modo                              │
│      - local: Desarrollo en localhost                                       │
│      - local-ip: Acceso desde red local                                     │
│      - public-ip: Exposicion a Internet via tunel                           │
│      - domain: Produccion con dominio propio                                │
│                                                                              │
│   3. Recoleccion de parametros especificos por modo                         │
│      - Validacion de entrada                                                │
│      - Generacion de secretos criptograficos                                │
│                                                                              │
│   4. Generacion de archivos de configuracion                                │
│      - .env: Variables de entorno                                           │
│      - Caddyfile: Configuracion de reverse proxy                           │
│      - docker-compose.override.yml: Overrides especificos del modo         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE                                       │
│                                                                              │
│   Merge de configuraciones:                                                  │
│   ┌─────────────────────┐  ┌──────────────────────────┐                     │
│   │ docker-compose.yml  │  │ docker-compose.override  │                     │
│   │ (base, modo-agnostico│  │ .yml (modo-especifico)   │                     │
│   └──────────┬──────────┘  └────────────┬─────────────┘                     │
│              │                          │                                   │
│              └────────────┬─────────────┘                                   │
│                           ▼                                                 │
│              ┌────────────────────────┐                                     │
│              │ Configuracion Final    │                                     │
│              │ (merge de ambos)       │                                     │
│              └──────────┬─────────────┘                                     │
└─────────────────────────┼───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORQUESTACION DE CONTENEDORES                         │
│                                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │  Caddy   │  │  Backend │  │ Frontend │  │  MongoDB │  │  Redis   │     │
│   │ (Proxy)  │  │  (API)   │  │   (UI)   │  │ (Datos)  │  │ (Cache)  │     │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                              │
│   Modos public-ip incluyen:                                                 │
│   ┌─────────────────┐  ┌─────────────────┐                                  │
│   │ cloudflared     │  │    ngrok        │                                  │
│   │ (Cloudflare     │  │  (Tunel ngrok)  │                                  │
│   │   Tunnel)       │  │                 │                                  │
│   └─────────────────┘  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Secuencia de Inicio

```
Usuario
   │
   │ docker compose up -d --build
   ▼
Docker Compose
   │
   ├───────────────────────────────────────────────────────────────────────┐
   │                                                                       │
   ▼                                                                       ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  MongoDB │  │  Redis   │  │  Backend │  │ Frontend │  │  Caddy   │
│  :27017  │  │  :6379   │  │  :3000   │  │  :4200   │  │  :80/443 │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │             │
     │             │             │             │             │
     └─────────────┴─────────────┴─────────────┴─────────────┘
                          │
                          ▼
                   Network Bridge
                   (disherio_net)
```

---

## Arquitectura de Red por Modo

### Modo Local

En modo local, toda la comunicacion se mantiene dentro del host. No hay exposicion de puertos a la red externa.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST LOCAL                                      │
│                                                                              │
│   Usuario (Navegador)                                                       │
│        │                                                                    │
│        │ HTTP                                                                │
│        ▼                                                                    │
│   ┌──────────────┐     ┌─────────────────────────────────────────────────┐  │
│   │   localhost  │────▶│           Docker Network Bridge                 │  │
│   │   :4200      │     │                                                 │  │
│   └──────────────┘     │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  │
│                        │  │  Caddy   │──│ Frontend │  │  Backend │      │  │
│                        │  │  :4200   │  │  :4200   │  │  :3000   │      │  │
│                        │  └──────────┘  └──────────┘  └────┬─────┘      │  │
│                        │                                   │              │  │
│                        │                              ┌────┴────┐         │  │
│                        │                              │ MongoDB │         │  │
│                        │                              │ :27017  │         │  │
│                        │                              └─────────┘         │  │
│                        └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Caracteristicas:**
- Puerto 4200 mapeado solo a localhost (127.0.0.1)
- No requiere firewall
- Ideal para desarrollo seguro

### Modo Red Local

Expone la aplicacion a toda la red local, permitiendo acceso desde multiples dispositivos.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RED LOCAL 192.168.x.x                              │
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│   │  Tablet 1    │     │  Tablet 2    │     │  Telefono    │                │
│   │  (Totem)     │     │  (Cocina)    │     │  (Admin)     │                │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│          │                    │                    │                        │
│          └────────────────────┼────────────────────┘                        │
│                               │ HTTP                                         │
│                               ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         SERVIDOR HOST                                │   │
│   │  ┌───────────────────────────────────────────────────────────────┐  │   │
│   │  │                    Docker Network                             │  │   │
│   │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  │   │
│   │  │  │  Caddy   │──│ Frontend │  │  Backend │──│ MongoDB  │      │  │   │
│   │  │  │  :80     │  │  :4200   │  │  :3000   │  │  :27017  │      │  │   │
│   │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │  │   │
│   │  └───────────────────────────────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Caracteristicas:**
- Puerto 80 mapeado a todas las interfaces (0.0.0.0)
- Requiere configuracion de firewall
- Accesible desde cualquier dispositivo en la misma subred
- Sin encriptacion (HTTP plano)

### Modo IP Publica con Cloudflare Tunnel

Utiliza Cloudflare como proxy inverso, ocultando la IP real del servidor y proporcionando HTTPS sin abrir puertos.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
│                                                                              │
│   Usuario Final                                                              │
│        │                                                                     │
│        │ HTTPS (Certificado valido)                                          │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    CLOUDFLARE EDGE NETWORK                           │   │
│   │  - Cache CDN                                                         │   │
│   │  - Proteccion DDoS                                                   │   │
│   │  - WAF (Web Application Firewall)                                    │   │
│   └───────────────────────────┬─────────────────────────────────────────┘   │
│                               │                                              │
│                               │ Tunnel Seguro (TLS 1.3)                     │
│                               │ Protocolo: QUIC/HTTP2                       │
│                               ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         TU SERVIDOR                                  │   │
│   │  ┌──────────────┐     ┌──────────────────────────────────────────┐  │   │
│   │  │ cloudflared  │────▶│           Docker Network                 │  │   │
│   │  │   tunnel     │     │                                          │  │   │
│   │  │  (outbound)  │     │  ┌──────────┐  ┌──────────┐  ┌────────┐  │  │   │
│   │  └──────────────┘     │  │  Caddy   │──│ Backend  │  │ Mongo  │  │  │   │
│   │                       │  │  :8080   │  │  :3000   │  │ :27017 │  │  │   │
│   │                       │  └──────────┘  └──────────┘  └────────┘  │  │   │
│   │                       └──────────────────────────────────────────┘  │   │
│   │                                                                     │   │
│   │  NOTA: No se requieren puertos abiertos en el firewall            │   │
│   │        La conexion es outbound desde cloudflared hacia Cloudflare │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Caracteristicas:**
- Conexion outbound unica (no requiere puertos abiertos)
- IP real del servidor oculta
- Certificado SSL valido gestionado por Cloudflare
- Proteccion contra ataques DDoS incluida

### Modo Dominio Propio

Configuracion de produccion completa con dominio propio y certificados Let's Encrypt.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
│                                                                              │
│   Usuario Final                                                              │
│        │                                                                     │
│        │ HTTPS (Let's Encrypt)                                               │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    INFRAESTRUCTURA DNS                               │   │
│   │  su-dominio.com A ──▶ IP Publica del Servidor                       │   │
│   └───────────────────────────┬─────────────────────────────────────────┘   │
│                               │                                              │
│                               ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         TU SERVIDOR                                  │   │
│   │  Firewall: Puertos 80 y 443 abiertos                                │   │
│   │                                                                     │   │
│   │  ┌───────────────────────────────────────────────────────────────┐  │   │
│   │  │                         Docker Network                        │  │   │
│   │  │  ┌──────────┐     ┌──────────┐     ┌─────────────────────┐   │  │   │
│   │  │  │  Caddy   │────▶│ Backend  │────▶│      MongoDB        │   │  │   │
│   │  │  │  :443    │     │  :3000   │     │     + Redis         │   │  │   │
│   │  │  │          │     └──────────┘     └─────────────────────┘   │  │   │
│   │  │  │  Auto HTTPS │  - Solicita certificado a Let's Encrypt    │  │   │
│   │  │  │  TLS 1.3  │  - Renueva automaticamente cada 60 dias      │  │   │
│   │  │  └──────────┘     - HTTP/3 (QUIC) soportado                │  │   │
│   │  └───────────────────────────────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Caracteristicas:**
- Certificado SSL valido emitido por Let's Encrypt
- Renovacion automatica cada 60 dias
- TLS 1.3 como minimo protocolo
- HTTP/3 (QUIC) habilitado
- Redireccion automatica HTTP a HTTPS

---

## Componentes del Sistema

### Caddy Reverse Proxy

Caddy actua como punto de entrada unico para todas las solicitudes HTTP/HTTPS.

#### Funciones Principales

| Funcion | Descripcion |
|---------|-------------|
| Enrutamiento | Distribuye solicitudes a backend o frontend segun path |
| Terminacion SSL | Gestion de certificados HTTPS (Let's Encrypt) |
| Compresion | Gzip y zstd para reducir transferencia |
| Headers de Seguridad | HSTS, CSP, X-Frame-Options, etc. |
| WebSockets | Proxy transparente para Socket.IO |

#### Tabla de Enrutamiento

| Path | Destino | Proposito |
|------|---------|-----------|
| `/uploads/*` | `/srv` (filesystem) | Archivos subidos por usuarios |
| `/api/*` | `backend:3000` | API REST |
| `/socket.io/*` | `backend:3000` | Comunicacion WebSocket |
| `/` | `frontend:4200` | Aplicacion Angular |

#### Headers de Seguridad Configurados

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Backend (Node.js/Express)

Servidor de aplicaciones que expone la API REST y gestiona WebSockets.

#### Dependencias de Infraestructura

- **MongoDB**: Persistencia de datos
- **Redis**: Cache y adaptador de Socket.IO para multi-nodo
- **Caddy**: Proxy inverso

#### Variables de Entorno Criticas

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecucion | `production` |
| `PORT` | Puerto de escucha | `3000` |
| `MONGODB_URI` | URI de conexion a MongoDB | `mongodb://mongo:27017/disherio` |
| `REDIS_URL` | URI de conexion a Redis | `redis://redis:6379` |
| `FRONTEND_URL` | URL permitida para CORS | `https://su-dominio.com` |
| `JWT_SECRET` | Clave para firmar tokens | `[string aleatorio]` |

### Frontend (Angular)

Aplicacion de una sola pagina (SPA) compilada y servida estaticamente.

#### Proceso de Build

1. **Builder Stage**: Compilacion de Angular con optimizaciones
2. **Runner Stage**: Servidor Caddy minimalista para archivos estaticos

#### Configuracion de Build por Modo

| Modo | Configuracion | Tamano Optimizado |
|------|---------------|-------------------|
| local | development | No (sourcemaps incluidos) |
| local-ip | production | Si |
| public-ip | production | Si |
| domain | production | Si |

### Base de Datos (MongoDB)

Sistema de persistencia documental.

#### Configuracion de Seguridad

- Autenticacion habilitada obligatoriamente
- Usuario root separado de usuario de aplicacion
- Red de Docker aislada (no expuesta externamente)

#### Usuarios Configurados

| Usuario | Rol | Proposito |
|---------|-----|-----------|
| root | root | Administracion de base de datos |
| disherio_app | readWrite | Operaciones de aplicacion |

### Cache y Pub/Sub (Redis)

Proporciona cache distribuido y habilita Socket.IO en multi-nodo.

#### Casos de Uso

1. **Rate Limiting Distribuido**: Contadores compartidos entre instancias
2. **Sesiones**: Almacenamiento de sesiones de Socket.IO
3. **Cache**: Cache de consultas frecuentes
4. **Pub/Sub**: Comunicacion entre instancias del backend

---

## Modelo de Configuracion

### Jerarquia de Configuracion

Los valores se resuelven en el siguiente orden de prioridad (mayor a menor):

1. Variables de entorno inyectadas en runtime
2. Archivo `.env` en el directorio del proyecto
3. Valores por defecto en `docker-compose.yml`
4. Valores por defecto en la aplicacion

### Estructura del Archivo .env

```bash
# ============================================
# SECCION 1: MODO DE DESPLIEGUE
# ============================================
DEPLOYMENT_MODE=domain  # local | local-ip | public-ip | domain

# ============================================
# SECCION 2: CONFIGURACION DE RED
# ============================================
# Modo local
PORT=3000
CADDY_PORT=4200

# Modo local-ip
LOCAL_IP=192.168.1.100
HTTP_PORT=80

# Modo public-ip
PUBLIC_IP=203.0.113.1
CADDY_INTERNAL_PORT=8080
TUNNEL_TYPE=cloudflare
CF_TUNNEL_TOKEN=eyJ...

# Modo domain
DOMAIN=disherio.ejemplo.com
HTTPS_PORT=443

# ============================================
# SECCION 3: SEGURIDAD
# ============================================
JWT_SECRET=[generado-automaticamente]
MONGO_ROOT_PASS=[cambiar-en-produccion]
MONGO_APP_PASS=[cambiar-en-produccion]
REDIS_PASSWORD=[cambiar-en-produccion]

# ============================================
# SECCION 4: CONEXIONES
# ============================================
MONGODB_URI=mongodb://mongo:27017/disherio
REDIS_URL=redis://redis:6379
```

### Sistema de Templates

Los templates utilizan interpolacion de variables que se resuelven durante la ejecucion del configurador.

#### Ejemplo: Caddyfile.domain

```caddy
# Template con variables
${DOMAIN}:443 {
    tls ${EMAIL}
    
    # ... configuracion
}
```

#### Proceso de Rendering

```
Template (Caddyfile.domain)
        │
        │ ./configure.sh
        │
        ▼
Sustitucion de variables:
  ${DOMAIN} → disherio.ejemplo.com
  ${EMAIL}  → admin@ejemplo.com
        │
        ▼
Archivo Final (Caddyfile)
```

---

## Seguridad por Capas

### Modelo de Defensa en Profundidad

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CAPA 1: PERIMETRO (Red)                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Firewall (iptables/ufw)                                                   │
│ • Solo puertos 80/443 expuestos (modo domain)                               │
│ • Proteccion DDoS (Cloudflare en modo public-ip)                            │
│ • Rate limiting en nivel de red                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ CAPA 2: PROXY INVERSO (Caddy)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Terminacion TLS (TLS 1.3 minimo)                                          │
│ • Headers de seguridad HTTP                                                 │
│ • Redireccion HTTP a HTTPS                                                  │
│ • Proteccion contra clickjacking (X-Frame-Options)                          │
│ • Content Security Policy                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ CAPA 3: APLICACION (Backend)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Autenticacion JWT con expiracion                                          │
│ • Validacion de entrada (Zod schemas)                                       │
│ • Rate limiting por IP y por usuario                                        │
│ • Sanitizacion de datos                                                     │
│ • Prevencion de inyeccion NoSQL                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ CAPA 4: DATOS (Persistencia)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ • MongoDB con autenticacion habilitada                                      │
│ • Redis con contraseña                                                      │
│ • Volúmenes de Docker con permisos restringidos                             │
│ • Encriptacion de datos en reposo (opcional, configuracion del host)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Matriz de Proteccion por Componente

| Amenaza | Caddy | Backend | MongoDB | Redis |
|---------|-------|---------|---------|-------|
| Inyeccion SQL/NoSQL | - | Zod validation | Prepared statements | - |
| XSS | CSP headers | Output encoding | - | - |
| CSRF | - | Token validation | - | - |
| Fuerza bruta | Rate limiting | Rate limiting | - | - |
| Escalacion de privilegios | - | RBAC | Role-based access | ACL |
| Sniffing de red | TLS 1.3 | HTTPS only | Auth required | Auth required |

---

## Decisiones de Diseno

### Por que Caddy en lugar de Nginx?

| Criterio | Caddy | Nginx |
|----------|-------|-------|
| Configuracion HTTPS automatica | Nativa, sin configuracion | Requiere certbot + cron |
| Sintaxis de configuracion | Caddyfile (simple) | nginx.conf (compleja) |
| HTTP/3 (QUIC) | Soporte nativo | Requiere modulo experimental |
| WebSockets | Proxy transparente | Configuracion manual |
| Certificados Let's Encrypt | Gestion automatica | Gestion manual |
| Curva de aprendizaje | Baja | Media-Alta |

**Decision**: Caddy reduce la complejidad operativa y elimina errores humanos en la gestion de certificados.

### Por que Docker Compose Override?

Alternativas consideradas:
1. **Variables de entorno unicas**: Dificultaba la logica condicional compleja
2. **Multiple archivos docker-compose completos**: Duplicacion de codigo, dificultad de mantenimiento
3. **Helm Charts (Kubernetes)**: Sobreingenieria para el alcance del proyecto

**Decision**: El patron de override permite:
- Reutilizar la configuracion base
- Modificar solo lo necesario por modo
- Facil comprension del diff entre modos

### Por que Cloudflare Tunnel para IP publica?

Alternativas evaluadas:
1. **Certificado autofirmado**: Advertencias de seguridad en navegadores
2. **Let's Encrypt para IP**: No soportado por la CA
3. **ngrok**: URLs temporales, limitaciones de plan gratuito
4. **Servidor VPN**: Complejidad adicional de configuracion

**Decision**: Cloudflare Tunnel proporciona:
- URL fija y persistente
- HTTPS valido sin dominio
- Proteccion DDoS adicional
- Sin apertura de puertos en firewall

---

## Escalabilidad

### Arquitectura de Escalado Horizontal

Para escenarios de alta carga, el sistema soporta escalado horizontal:

```
                              ┌──────────────┐
                              │   Usuarios   │
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │ Load Balancer│
                              │   (Caddy)    │
                              └──────┬───────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
     ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
     │  Backend 1   │         │  Backend 2   │         │  Backend N   │
     │  :3000       │         │  :3000       │         │  :3000       │
     └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     │
                              ┌──────┴──────┐
                              │    Redis    │
                              │  (Adapter)  │
                              └──────┬──────┘
                                     │
                              ┌──────┴──────┐
                              │   MongoDB   │
                              │ Replica Set │
                              └─────────────┘
```

**Habilitado por:**
- Redis Adapter para Socket.IO (comparticion de estado entre nodos)
- MongoDB como fuente unica de verdad
- Stateless design del backend

### Comando de Escalado

```bash
# Escalar a 3 instancias de backend
docker compose up -d --scale backend=3

# El balanceo se realiza automaticamente por Caddy
```

---

## Referencia de API Interna

### Endpoints de Health Check

| Endpoint | Metodo | Descripcion | Usado por |
|----------|--------|-------------|-----------|
| `/health` | GET | Estado completo del sistema | Monitoreo |
| `/health/simple` | GET | Estado basico (solo HTTP 200) | Docker healthcheck |

### Respuesta de Health Check Completo

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "mongodb": "connected",
    "redis": "connected"
  },
  "version": "1.2.3"
}
```

### Puertos Internos

| Servicio | Puerto | Expuesto Externamente | Descripcion |
|----------|--------|----------------------|-------------|
| Caddy | 80 | Condicional | HTTP (redirige a HTTPS) |
| Caddy | 443 | Condicional | HTTPS |
| Caddy | 8080 | No | Puerto interno para tuneles |
| Backend | 3000 | No | API REST y WebSockets |
| Frontend | 4200 | No | Servidor Angular SSR/estatico |
| MongoDB | 27017 | No | Base de datos |
| Redis | 6379 | No | Cache y pub/sub |

---

## Apendice: Glosario

| Termino | Definicion |
|---------|------------|
| **CA** | Certificate Authority. Entidad emisora de certificados SSL (ej: Let's Encrypt) |
| **CSP** | Content Security Policy. Header HTTP que define fuentes de contenido permitidas |
| **HSTS** | HTTP Strict Transport Security. Fuerza conexiones HTTPS |
| **QUIC** | Protocolo de transporte sobre UDP, base de HTTP/3 |
| **Reverse Proxy** | Servidor que redirige solicitudes a servidores backend |
| **SSL/TLS** | Protocolos de encriptacion para comunicaciones seguras |
| **WebSocket** | Protocolo de comunicacion bidireccional persistente |

---

Documentacion Tecnica - DisherIo Infrastructure v1.0
