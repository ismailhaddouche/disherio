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

El proyecto se sustenta sobre un stack moderno y escalable basado en TypeScript:

- **Frontend**: Angular 21, haciendo uso de la API de **Signals** para una gestión reactiva y eficiente del estado.
- **Backend**: Node.js 20 con Express 5 (LTS).
- **Persistencia**: MongoDB 7.
- **Comunicaciones**: Socket.io 4.x para mensajería bidireccional.
- **Proxy Inverso**: Caddy 2 para la gestión de tráfico y terminación TLS automática.
- **Infraestructura**: Docker y Docker Compose para la orquestación de microservicios.

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

---

## 5. Documentación Técnica

Para información detallada sobre aspectos específicos del sistema, consulte los siguientes documentos en la carpeta `/docs`:

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Decisiones de diseño, diagramas de flujo y capas de seguridad.
- **[API_GUIDE.md](./docs/API_GUIDE.md)**: Especificación técnica de los endpoints REST y eventos WebSocket.
- **[INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md)**: Guía de despliegue, mantenimiento, backups y configuración de red.
- **[CONTRIBUTING.md](./docs/CONTRIBUTING.md)**: Estándares de codificación, flujo de CI/CD y guía para contribuyentes.

---

## 6. Seguridad y Resiliencia

- **Gestión Global de Errores**: Implementación de un `GlobalErrorHandler` en el frontend para la captura y notificación centralizada de excepciones.
- **Sistema de Notificaciones MD3**: Basado en Material Design 3, integrado con el sistema de mensajería para alertas críticas y de éxito.
- **Auditoría de Acciones**: Registro inmutable de operaciones administrativas sensibles.
- **CI/CD Optimizado**: Pipeline en GitHub Actions que incluye validación de tipos, auditoría de seguridad de dependencias (Trivy) y construcción de imágenes multi-arquitectura.

---

## 7. Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Para más detalles, consulte el archivo `LICENSE` en la raíz del repositorio.
