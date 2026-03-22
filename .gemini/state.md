# Contexto del Proyecto Disherio

## Arquitectura General
Sistema de gestión de restaurantes y Punto de Venta (POS) alojado de forma independiente (Self-Hosted) mediante Docker. Arquitectura Cliente-Servidor.

## Componentes

### 1. Frontend
- **Framework**: Angular 21 (Stand-alone components).
- **Diseño**: Arquitectura basada en el patrón ViewModel (ej. `pos.ts` + `pos.viewmodel.ts`).
- **Librerías Clave**:
  - `socket.io-client`: Actualizaciones en tiempo real (KDS, mesas, pedidos).
  - `ngx-translate`: Internacionalización (i18n).
  - `lucide-angular`: Iconografía.
- **Despliegue**: Optimizado mediante `build-stage` (Node.js) y empaquetado final servido desde un contenedor Nginx ultraligero (`nginx:stable-alpine`).

### 2. Backend
- **Framework**: Node.js 20, usando Express 5 y ES Modules (`type: "module"`).
- **Base de Datos**: MongoDB 7.0 a través de Mongoose.
  - Colecciones principales: `Orders`, `MenuItems`, `Users`, `Restaurants`, `Tickets`, `ActivityLogs`.
- **Autenticación**: JWT (`jsonwebtoken`) junto con `bcrypt` para seguridad de contraseñas.
- **Tiempo Real**: WebSockets usando `socket.io` (crucial para sincronización POS, Kitchen Display System - KDS y Waiter View).
- **Validación y Pruebas**: Validación con Joi, Tests con Jest y supertest.
- **Otros**: API RESTful con módulos de auditoría y servicios separados por lógica de negocio.

### 3. Infraestructura y Redes
- **Orquestación**: Docker Compose (`docker-compose.yml`, con variantes `.prod` y `.rpi`).
- **Servicios Docker**:
  1. `database`: Contenedor Mongo 7 con volúmenes persistentes.
  2. `backend`: Imagen Node slim en el puerto interno 3000.
  3. `frontend`: Imagen Nginx en el puerto interno 80.
  4. `caddy`: Reverse proxy Caddy v2 gestionando los dominios locales/externos, sirviendo tráfico de la API (`/api/*`), WebSockets (`/socket.io/*`) al backend, y todo lo demás al frontend. Gestiona HTTPS de forma transparente (`local_certs` o auto-emisión).

### 4. Scripts y Utilidades
- **Gestión**: Herramientas en la raíz del proyecto para simplificar instalación y operación.
- `install.sh` y `configure.sh`: Setup inicial y configuración de entorno (`.env`).
- `backup.sh`: Sistema de respaldos para la base de datos.
- `check-ip.sh`: Verificador de direcciones IP de red para accesibilidad.
- `build-installer.sh / .ps1`: Herramientas de empaquetado/instalación multi-plataforma.

## Reglas del PM/Tech Lead
- Todo código nuevo debe estar validado por QA.
- Interacciones con GitHub usando `gh pr create` y `gh pr merge`.
- Intercepción de dudas automática y esquema de revisión estricta.