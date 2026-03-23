# Disher.io — Sistema Integral para la Gestión de Restaurantes

Disher.io es una plataforma de gestión para el sector de la hostelería, diseñada bajo una arquitectura de inquilino único (single-tenant) y optimizada para entornos de producción. El sistema permite la sincronización en tiempo real de pedidos entre comensales, personal de sala y cocina, operando desde un despliegue unificado y altamente eficiente.

---

## 1. Descripción del Proyecto

Disher.io moderniza la operativa de establecimientos gastronómicos mediante la digitalización completa del ciclo de pedido y cobro. La plataforma elimina la necesidad de sistemas de comunicación analógicos y puntos de venta desconectados, centralizando toda la información en una infraestructura auto-alojada que garantiza la soberanía de los datos.

### Características Principales
- **Sincronización en Tiempo Real**: Uso intensivo de WebSockets para una actualización instantánea del estado de los pedidos en todos los terminales.
- **Arquitectura Adaptativa**: Capacidad de ejecución tanto en hardware de recursos limitados (Raspberry Pi/ARM64) como en servidores de alto rendimiento (AMD64).
- **Independencia Tecnológica**: Al ser una solución auto-alojada, el establecimiento no depende de suscripciones a terceros ni de conectividad externa constante para operaciones locales.
- **Production-Ready**: El sistema incluye mecanismos de auditoría, control de concurrencia optimista y gestión de errores global.

---

## 2. Stack Tecnológico

El proyecto se sustenta sobre un stack moderno, escalable y 100% basado en TypeScript de extremo a extremo:

| Capa | Tecnología | Detalles |
|------|-----------|----------|
| **Frontend** | Angular 21 | Signals API para reactividad granular, componentes standalone, Material Design 3 |
| **Backend** | Node.js 20 + Express 5 | API REST + WebSockets, control de concurrencia optimista (OCC) |
| **Base de Datos** | MongoDB 7 | Esquemas Mongoose con versionado (`__v`) para integridad multi-usuario |
| **Tiempo Real** | Socket.io 4.x | Sincronización bidireccional instantánea entre todos los terminales |
| **Proxy Inverso** | Caddy 2 | Terminación TLS automática (Let's Encrypt), compresión y headers de seguridad |
| **Infraestructura** | Docker + Compose | Multi-arquitectura (AMD64/ARM64), health checks y límites de recursos |
| **CI/CD** | GitHub Actions | Build multi-arch, auditoría de seguridad (Trivy), despliegue automatizado |
| **i18n** | ngx-translate | Soporte completo bilingüe (Español / Inglés) |
| **Testing** | Jest + Supertest | Tests de integración con MongoDB en memoria (`mongodb-memory-server`) |

---

## 3. Arquitectura del Sistema

Disher.io sigue los principios de **Clean Architecture**, separando claramente las responsabilidades entre la capa de presentación, la lógica de negocio y la persistencia de datos.

### Estructura de Módulos (Frontend)
La aplicación Angular se organiza en módulos funcionales especializados:

- **Admin Dashboard**: Panel central de estadísticas y gestión administrativa.
- **KDS (Kitchen Display System)**: Interfaz reactiva para la coordinación de pedidos en cocina.
- **Waiter View**: Herramienta de gestión de mesas y pedidos para el personal de sala.
- **POS (Point of Sale)**: Terminal de cobro con soporte para división de cuentas y facturación.
- **Menu Editor**: Suite de edición de catálogo y existencias en tiempo real.
- **Customer View**: Interfaz de autoservicio para clientes accesible vía QR.

### Gestión de Estado y Datos
- **Angular Signals**: Implementado para una reactividad granular en los componentes.
- **Interfaces de TypeScript**: Definiciones estrictas para todas las entidades (IOrder, IMenuItem, IUser, IRestaurant).
- **Control de Concurrencia (OCC)**: Uso del campo `__v` en MongoDB para evitar sobrescrituras accidentales en entornos multi-usuario.

---

## 4. Guía de Inicio Rápido

El sistema incluye un script de instalación automatizado que gestiona el aprovisionamiento de la infraestructura.

### Requisitos Previos
- Docker Engine >= 24.0.0
- Docker Compose Plugin >= 2.20.0
- Acceso de administrador (sudo)

### Instalación
```bash
# Clonar el repositorio
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Ejecutar el instalador automatizado
chmod +x install.sh
sudo ./install.sh
```

El instalador guiará al usuario a través de la configuración de red (IP local o FQDN), la generación de claves criptográficas y el levantamiento de los contenedores.

Si se elige un **dominio público**, el instalador configurará automáticamente **Caddy con Let's Encrypt** para HTTPS y mostrará los registros DNS necesarios (A y CAA). Esta información se puede consultar en cualquier momento:

```bash
sudo ./show-dns.sh
```

---

## 5. Procedimientos de Mantenimiento y Operaciones

### 5.1 Actualización desde una Instalación Existente

El script de instalación también actúa como actualizador. Conserva los datos y reconstruye las imágenes con el nuevo código.

```bash
# 1. Obtén los últimos cambios del repositorio
git pull origin main

# 2. Ejecuta el instalador en modo actualización
sudo ./install.sh
```

### 5.2 Copia de Seguridad de la Base de Datos

Usa el script automatizado incluido en la raíz del proyecto para crear copias de seguridad consistentes y comprimidas.

```bash
chmod +x backup.sh
sudo ./backup.sh
```

El script genera `backups/disher_backup_YYYY-MM-DD_HH-MM-SS.tar.gz` y retiene las últimas 7 copias automáticamente. **Guarda este archivo en una ubicación externa y segura.**

Para restaurar un backup o configurar backups automáticos por cron, consulta la [Guía de Mantenimiento](./docs/MAINTENANCE.md).

### 5.3 Detención Estándar (Conserva los Datos)

Detiene todos los contenedores preservando intactos los volúmenes (base de datos, imágenes y configuración).

```bash
docker compose down
```

*Para reiniciar el sistema: `docker compose up -d`*

### 5.4 Eliminación Total e Infraestructura (Purge Completo de Docker)

> **Acción destructiva e irreversible.** Elimina contenedores, redes, imágenes compiladas, volúmenes y todos los datos persistidos.

```bash
cd disherio

# 1. Bajar servicios destruyendo volúmenes, imágenes compiladas y contenedores huérfanos
docker compose down -v --rmi all --remove-orphans

# 2. Purga profunda a nivel de sistema Docker (limpia cachés y datos sin uso)
docker system prune -a --volumes -f

# 3. Eliminación forzada del directorio del proyecto
cd ..
sudo rm -rf disherio
```

### 5.5 Resolución de Instalación Corrupta

En caso de corrupción del estado (apagón crítico, modificación manual de volúmenes, corrupción del demonio Docker), ejecuta la siguiente secuencia de reseteo forzado completo:

```bash
# 1. Diagnóstico preliminar
docker ps -a
docker compose logs backend

# 2. Destrucción exhaustiva de la pila y todos sus rastros
cd disherio
docker compose down -v --rmi all --remove-orphans
docker system prune -a --volumes -f

# 3. Eliminación del directorio
cd ..
sudo rm -rf disherio

# 4. Reinstalación limpia desde cero
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio
chmod +x install.sh
sudo ./install.sh
```

---

## 6. Apertura de Puertos en Servidores Cloud

Cuando Disher.io se instala en un VPS o instancia cloud, el proveedor dispone de un **firewall de red propio**, independiente del sistema operativo del servidor. Aunque la aplicación esté corriendo correctamente en el interior del servidor, el acceso externo quedará bloqueado hasta que se abran los puertos necesarios desde el panel del proveedor.

- **Puerto 80** (HTTP) — obligatorio para todas las instalaciones.
- **Puerto 443** (HTTPS) — obligatorio si usas un dominio público con Let's Encrypt.

### Google Cloud (Compute Engine)

La forma más fiable es desde la **consola web**, ya que desde la propia VM los permisos de red suelen estar restringidos.

**Opción A — Consola web:**

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Navega a **VPC Network → Firewall**
3. Haz clic en **"+ CREATE FIREWALL RULE"** y usa estos valores:

| Campo | Valor |
|-------|-------|
| Name | `allow-http-80` |
| Network | `default` |
| Direction of traffic | `Ingress` |
| Action on match | `Allow` |
| Targets | `All instances in the network` |
| Source filter | `IPv4 ranges` |
| Source IPv4 ranges | `0.0.0.0/0` |
| Protocols and ports | `TCP: 80, 443` |

4. Haz clic en **"Create"**. La regla se activa en menos de 30 segundos.

**Opción B — gcloud CLI** (requiere permisos de administrador de red en el proyecto):

```bash
gcloud compute firewall-rules create allow-disher \
  --allow tcp:80,tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --description "Disher.io HTTP + HTTPS"
```

> **Nota:** Si aparece el error `Request had insufficient authentication scopes`, la VM no tiene permisos para gestionar el firewall desde dentro. Usa la Opción A desde la consola web.

### AWS (EC2)

1. Ve a **EC2 → Instancias → selecciona tu instancia**
2. En la pestaña **Security**, haz clic en el **Security Group**
3. En **Inbound rules**, añade:
   - Type: `HTTP`, Port: `80`, Source: `0.0.0.0/0`
   - Type: `HTTPS`, Port: `443`, Source: `0.0.0.0/0`
4. Guarda los cambios.

### Azure (Virtual Machine)

1. Ve a tu VM en el portal de Azure
2. En **Networking**, añade **Inbound port rules**:
   - Port: `80`, Protocol: `TCP`, Action: `Allow`
   - Port: `443`, Protocol: `TCP`, Action: `Allow`

---

## 7. Documentación Técnica

Para información detallada sobre aspectos específicos del sistema, consulte los siguientes documentos en la carpeta `/docs`:

- **[QUICK_START.md](./docs/QUICK_START.md)**: Guía de inicio rápido, variantes de red y configuración de firewalls en proveedores cloud.
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Decisiones de diseño, diagramas de flujo y capas de seguridad.
- **[API_GUIDE.md](./docs/API_GUIDE.md)**: Especificación técnica de los endpoints REST y eventos WebSocket.
- **[API.md](./docs/API.md)**: Referencia rápida de la API.
- **[MAINTENANCE.md](./docs/MAINTENANCE.md)**: Backups, restauración, gestión de credenciales y actualizaciones.
- **[TESTING_AND_CI.md](./docs/TESTING_AND_CI.md)**: Estrategia de testing y pipeline de CI/CD.
- **[CONTRIBUTING.md](./docs/CONTRIBUTING.md)**: Guía de contribución, convenciones de código y flujo de Pull Requests.

---

## 8. Seguridad y Resiliencia

- **Gestión Global de Errores**: Implementación de un `GlobalErrorHandler` en el frontend para la captura y notificación centralizada de excepciones.
- **Sistema de Notificaciones MD3**: Basado en Material Design 3, integrado con el sistema de mensajería para alertas críticas y de éxito.
- **Auditoría de Acciones**: Registro inmutable de operaciones administrativas sensibles.
- **CI/CD Optimizado**: Pipeline en GitHub Actions que incluye validación de tipos, auditoría de seguridad de dependencias (Trivy) y construcción de imágenes multi-arquitectura.

---

## 9. Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Para más detalles, consulte el archivo `LICENSE` en la raíz del repositorio.
