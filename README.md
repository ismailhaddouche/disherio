# Disher.io v1.0 — Plataforma Open-Source para Gestión de Restaurantes

Disher.io es una plataforma de gestión de restaurantes autoalojada y lista para producción, diseñada para pequeños y medianos establecimientos. Ofrece sincronización de pedidos en tiempo real entre clientes, personal de cocina y cajeros, todo desde un único despliegue.

[![CI/CD](https://github.com/ismailhaddouche/disherio/actions/workflows/docker-build.yml/badge.svg)](https://github.com/ismailhaddouche/disherio/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-21-red)](https://angular.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-brightgreen)](https://mongodb.com)

---

## ¿Qué es Disher.io?

Disher.io sustituye los tickets de papel, los walkie-talkies y los sistemas POS desconectados por una plataforma unificada que se ejecuta en tu propio hardware. Los clientes escanean un código QR en su mesa, hacen su pedido y la cocina lo ve al instante. El cajero cierra la cuenta con un clic, permitiendo también dividir en varios pagos.

Se puede ejecutar en cualquier dispositivo, desde una Raspberry Pi hasta un servidor en la nube, sin cuotas de suscripción.

---

## Arquitectura del Sistema

```
                        ┌────────────────────────────────────────────────────────────────────────┐
                        │                  Caddy (Proxy Inverso)                 │
                        │           TLS/SSL · Compresión · Enrutamiento          │
                        └──────────────────────────────┬─────────────────────────┬───────────────┘
                                       │                  │
                          /api/*  ─────┘                  └─── /* (frontend)
                                       │
              ┌────────────────────────▼────────────────────────────────────────┐
              │              Backend (Node.js 20 + Express)      │
              │                                                  │
              │   REST API · JWT Auth · RBAC · Socket.io         │
              │   Rate Limiting · Helmet · Logs de Actividad     │
              └──────────────┬───────────────────────────────────┬──────────────┘
                           │                    │
               ┌───────────▼──────────┐   ┌─────▼──────────────────┐
               │  MongoDB 7       │   │  Socket.io (WS)      │
               │  Pedidos · Menú  │   │  Eventos en tiempo   │
               │  Usuarios · TPV  │   │  real a clientes     │
               └──────────────────┘   └──────────────────────────┘

              ┌────────────────────────────────────────────────────────────────────────┐
              │              Frontend (Angular 21)               │
              │                                                  │
              │  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
              │  │  Admin     │  │  KDS     │  │  Cliente     │  │
              │  │  Dashboard │  │  Cocina  │  │  Menú + QR   │  │
              │  └────────────┘  └──────────┘  └──────────────┘  │
              │  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
              │  │  TPV /     │  │  Editor  │  │  Pago /      │  │
              │  │  Cajero    │  │  de Menú │  │  Checkout    │  │
              │  └────────────┘  └──────────┘  └──────────────┘  │
              └────────────────────────────────────────────────────────────────────────┘
```

---

## Características

### Para Clientes
- Escaneo de código QR en la mesa (sin descargar aplicaciones).
- Menú interactivo con categorías, variantes y alérgenos.
- Realización de pedidos directamente desde el teléfono.
- Autopago (Checkout) con propina opcional.

### Para Personal de Cocina (KDS)
- Pantalla de pedidos en tiempo real en cualquier tablet.
- Marcar platos individualmente como "en preparación" o "listos".
- Alertas visuales para pedidos nuevos y pendientes.

### Para Cajeros (TPV / POS)
- Vista general interactiva de todas las mesas y el estado de los pedidos.
- Cierre de cuenta y cálculo de IVA en un solo clic.
- División de pagos entre varias personas a partes iguales o personalizadas.
- Opciones de pago en efectivo y tarjeta.

### Para Administradores
- Gestión completa del menú (categorías, variantes, extras, alérgenos).
- Gestión de personal de cocina y cajeros con acceso basado en roles.
- Personalización de marca del restaurante (logo, colores, nombre).
- Generador de PDF de tótems QR gestionando las mesas dinámicamente.
- Logs de actividad y auditoría.

---

## Inicio Rápido (Instalador Automatizado)

El instalador automatizado es la forma recomendada y más segura de desplegar Disher.io. Se encarga de la configuración, la generación de secretos y el despliegue de los servicios.

```bash
# 1. Clona el repositorio
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# 2. Ejecuta el instalador como root
chmod +x install.sh
sudo ./install.sh
```

El instalador te guiará en la selección del modo de acceso. Una vez finalizado, podrás gestionar tu restaurante ejecutando `sudo ./configure.sh`.

> **Credenciales Iniciales:**
> Durante la instalación se generan contraseñas aleatorias y seguras para los usuarios `admin` y `waiter`.
> **Estas credenciales se muestran al final de la instalación. Guárdalas en un lugar seguro.**

---

## Accesos a la Plataforma

| Módulo | URL de Acceso | Rol Requerido |
|--------|-----|------|
| Panel de Administración | `/admin/dashboard` | Admin |
| Pantalla de Cocina (KDS) | `/admin/kds` | Cocina, Admin |
| Terminal de Venta (TPV) | `/admin/pos` | Cajero (POS), Admin |
| Editor de Menú | `/admin/menu` | Admin |
| Gestión de Usuarios | `/admin/users` | Admin |
| Configuración de Restaurante | `/admin/config` | Admin |
| Menú Digital Público (Cliente) | `/:numeroDeMesa` | Público |
| Checkout Pago (Cliente) | `/:numeroDeMesa/checkout` | Público |

---

## Modos de Despliegue

### Modo Local (LAN)
Diseñado para instalarse en una red local sin conexión a internet o para uso interno. Ideal para una única tablet como TPV o configurar la aplicación detrás de la barra en una Raspberry Pi en intranet.

### Modo Producción
Conecta con un dominio público e instala certificados TLS autogestionados mediante Let's Encrypt usando Caddy. Ideal para restaurantes que desean alojarlo en un servidor cloud o acceder desde internet.

### Modo Raspberry Pi
Equivalente al modo local pero ajustado y optimizado según los límites de los recursos (ARM, límite en uso de RAM y procesador). Validado para entornos de Raspberry Pi.

---

## Documentación del Proyecto

| Documento | Descripción |
|----------|-------------|
| [Quick Start](./docs/QUICK_START.md) | Instalación, primeros pasos y configuración inicial. |
| [Architecture](./docs/ARCHITECTURE.md) | Diseño del sistema y diagramas base. |
| [API Reference](./docs/API.md) | Documentación técnica de todos los endpoints. |
| [Maintenance](./docs/MAINTENANCE.md) | Guía de mantenimiento, restauraciones, backups y actualización. |
| [Contributing](./CONTRIBUTING.md) | Reglas y guía para contribuir al ecosistema Disher. |
| [Security](./SECURITY.md) | Notas de seguridad y reporte de vulnerabilidades. |
| [Changelog](./CHANGELOG.md) | Historial de versiones y cambios del repositorio. |

---

## Tecnologías Utilizadas

| Capa | Tecnología | Versión |
|-------|-----------|---------|
| Backend | Node.js + Express | 20 / 5.x |
| Frontend | Angular + Signals API | 21 |
| Base de Datos | MongoDB | 7 |
| Servidor Web proxy | Caddy | 2 |
| Websockets (Tiempo real)| Socket.io | 4.x |
| Seguridad & Autologin | JWT | 9.x |

---

## Contribuciones y Seguridad

Cualquier contribución es bienvenida. Asegúrate de leer y entender nuestro [CONTRIBUTING.md](./CONTRIBUTING.md) antes de publicar un PR.

Si descubres una vulnerabilidad, no publiques la incidencia explícita. Por favor, revisa la sección de divulgación responsable ubicada en nuestro archivo [SECURITY.md](./SECURITY.md).

## Desarrollo Asistido por IA

Este proyecto ha sido desarrollado con el apoyo de herramientas de inteligencia artificial de Google:

- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** — Interfaz de línea de comandos para interacción con modelos Gemini, utilizada como asistente de desarrollo durante la codificación, depuración y generación de documentación.
- **[Gemini 3.0](https://deepmind.google/technologies/gemini/)** — Modelo de lenguaje de última generación de Google DeepMind, empleado para asistencia en la escritura de código, revisión de arquitectura y resolución de problemas técnicos.

> **Nota:** La dirección del proyecto, la arquitectura del sistema y todas las decisiones de diseño han sido responsabilidad del equipo humano. Las herramientas de IA se han utilizado como apoyo para acelerar el desarrollo y mejorar la calidad del código.

---

## Licencia

Disher.io está distribuido bajo la [Licencia MIT](./LICENSE). Puede usarse, modificarse y distribuirse para cualquier propósito que se desee.
