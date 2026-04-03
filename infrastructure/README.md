# Infraestructura DisherIo

Sistema de configuracion de infraestructura multi-entorno para DisherIo Restaurant Management System.

---

## Descripcion General

Este modulo proporciona herramientas automatizadas para desplegar DisherIo en cuatro configuraciones diferentes, desde desarrollo local hasta produccion con dominio propio, manteniendo la misma base de codigo sin modificaciones.

---

## Estructura del Directorio

```
infrastructure/
├── scripts/
│   ├── configure.sh              # Configurador interactivo principal
│   └── verify.sh                 # Verificador de pre-requisitos
├── caddy-templates/
│   ├── Caddyfile.local           # Configuracion localhost
│   ├── Caddyfile.local-ip        # Configuracion red local
│   ├── Caddyfile.public-ip       # Configuracion con tunel
│   └── Caddyfile.domain          # Configuracion dominio propio
├── docker-compose.*.yml          # Overrides por modo de despliegue
└── docs/
    ├── DEPLOYMENT_GUIDE.md       # Guia de despliegue completa
    └── ARCHITECTURE.md           # Documentacion tecnica
```

---

## Uso Rapido

### Instalacion Nueva

```bash
# Ejecutar configurador interactivo
./infrastructure/scripts/configure.sh

# Iniciar servicios
docker compose up -d --build
```

### Inicio Rapido (Todo en Uno)

```bash
./quickstart.sh
```

Este comando ejecuta: configuracion, verificacion e inicio de servicios en secuencia.

---

## Modos de Despliegue

| Modo | Caso de Uso | HTTPS | Documentacion |
|------|-------------|-------|---------------|
| `local` | Desarrollo en maquina local | No | [Guia Local](#modo-local) |
| `local-ip` | Red local (restaurante, oficina) | No | [Guia Red Local](#modo-red-local) |
| `public-ip` | IP publica con tunel | Si (via tunel) | [Guia IP Publica](#modo-ip-publica) |
| `domain` | Dominio propio | Si (Let's Encrypt) | [Guia Dominio](#modo-dominio) |

---

## Referencia de Scripts

### configure.sh

Script interactivo que guia al usuario a traves de la configuracion del entorno.

**Funcionalidades:**
- Deteccion automatica de IP local y publica
- Menu interactivo de seleccion de modo
- Generacion automatica de secretos criptograficos
- Creacion de archivos `.env`, `Caddyfile`, y `docker-compose.override.yml`

**Ejecucion:**
```bash
./infrastructure/scripts/configure.sh
```

**Salida:**
- `.env` - Variables de entorno
- `Caddyfile` - Configuracion de reverse proxy
- `docker-compose.override.yml` - Override especifico del modo

### verify.sh

Verifica que todos los requisitos previos esten satisfechos antes del despliegue.

**Verificaciones realizadas:**
- Instalacion de Docker y Docker Compose
- Estado del daemon Docker
- Existencia de archivos de configuracion
- Variables de entorno requeridas
- Disponibilidad de puertos
- Recursos del sistema (memoria, disco)

**Ejecucion:**
```bash
./infrastructure/scripts/verify.sh
```

**Codigos de salida:**
- `0` - Todas las verificaciones pasaron
- `1` - Se encontraron errores bloqueantes

---

## Referencia de Templates

### Caddyfile Templates

Los templates de Caddy se encuentran en `caddy-templates/` y se seleccionan segun el modo de despliegue:

| Template | Puerto(s) | HTTPS | Caracteristicas |
|----------|-----------|-------|-----------------|
| `Caddyfile.local` | 4200 | No | Auto HTTPS deshabilitado |
| `Caddyfile.local-ip` | 80 | No | Bind en todas las interfaces |
| `Caddyfile.public-ip` | 8080 (interno) | No | Sin exposicion externa |
| `Caddyfile.domain` | 80, 443 | Si (Auto) | Let's Encrypt, TLS 1.3, HTTP/3 |

### Docker Compose Overrides

Los archivos `docker-compose.{modo}.yml` extienden la configuracion base:

| Archivo | Modifica | Agrega |
|---------|----------|--------|
| `docker-compose.local.yml` | Puertos mapeados | Volumenes de desarrollo |
| `docker-compose.local-ip.yml` | Binding de red | Configuracion de firewall |
| `docker-compose.public-ip.yml` | Exposicion de puertos | Servicio cloudflared/ngrok |
| `docker-compose.domain.yml` | Puertos HTTPS | Configuracion TLS |

---

## Flujo de Trabajo

### Cambio de Modo de Despliegue

Para cambiar de un modo a otro:

```bash
# 1. Detener servicios actuales
docker compose down

# 2. Reconfigurar
./infrastructure/scripts/configure.sh

# 3. Seleccionar nuevo modo y seguir instrucciones

# 4. Iniciar con nueva configuracion
docker compose up -d --build
```

### Actualizacion de Configuracion

Para modificar parametros manteniendo el mismo modo:

```bash
# Editar directamente el archivo .env
nano .env

# O regenerar toda la configuracion
./infrastructure/scripts/configure.sh

# Aplicar cambios
docker compose up -d
```

---

## Solucion de Problemas

### Problema: configure.sh falla

**Verificar permisos:**
```bash
chmod +x infrastructure/scripts/configure.sh
```

**Verificar dependencias:**
```bash
which bash
bash --version
```

### Problema: Archivos no generados

**Verificar espacio en disco:**
```bash
df -h .
```

**Verificar permisos de escritura:**
```bash
touch test_write && rm test_write
```

### Problema: Variables no sustituidas

Los templates usan sintaxis `${VARIABLE}`. Si el configurador no sustituye correctamente:

1. Verificar que se ejecuto `./configure.sh` completamente
2. Verificar que el archivo `.env` existe: `cat .env`
3. Regenerar: `./infrastructure/scripts/configure.sh`

---

## Desarrollo y Extension

### Agregar un Nuevo Modo

Para agregar un nuevo modo de despliegue:

1. **Crear template de Caddy**:
   ```bash
   touch infrastructure/caddy-templates/Caddyfile.nuevo-modo
   ```

2. **Crear override de Docker Compose**:
   ```bash
   touch infrastructure/docker-compose.nuevo-modo.yml
   ```

3. **Modificar configure.sh**:
   - Agregar opcion al menu de seleccion
   - Crear funcion `configure_nuevo_modo()`
   - Agregar case al selector principal

4. **Documentar**:
   - Actualizar DEPLOYMENT_GUIDE.md
   - Actualizar este README

### Modificar Templates Existentes

Los templates pueden editarse directamente. Los cambios se aplicaran la proxima vez que se ejecute `configure.sh`.

**Nota importante**: Si modifica un template manualmente, ejecute `./configure.sh` para regenerar los archivos finales.

---

## Referencias

- [Guia de Despliegue Completa](./docs/DEPLOYMENT_GUIDE.md)
- [Documentacion de Arquitectura](./docs/ARCHITECTURE.md)
- [Docker Documentation](https://docs.docker.com/)
- [Caddy Documentation](https://caddyserver.com/docs/)

---

## Licencia

Este software es propietario. Todos los derechos reservados.

---

Documentacion de Infraestructura - DisherIo v1.0
