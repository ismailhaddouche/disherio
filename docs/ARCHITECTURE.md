# Arquitectura del Sistema Disher.io

> **English version:** [ARCHITECTURE_EN.md](./ARCHITECTURE_EN.md)

Este documento detalla los principios de diseño, la estructura de componentes, el flujo de datos y las capas de seguridad implementadas en Disher.io.

---

## 1. Visión General de la Arquitectura

Disher.io emplea un modelo de **inquilino único (single-tenant)**, donde cada instancia del sistema sirve exclusivamente a un restaurante. Esta decisión estratégica simplifica la gestión de datos, minimiza los vectores de ataque y permite la ejecución en hardware con recursos limitados.

El sistema se organiza bajo los principios de **Clean Architecture**, asegurando un desacoplamiento efectivo entre la lógica de negocio, las interfaces de usuario y la persistencia de datos.

### Diagrama de Servicios

```text
Entrada de Tráfico (Público/LAN)
           │
           ▼
┌───────────────────────────────────────────────┐
│               Proxy Inverso: Caddy            │
│  - Terminación TLS (Automatizada)             │
│  - Enrutamiento de Tráfico (/api, /socket.io) │
│  - Compresión y Cacheo de Activos Estáticos   │
└──────────────┬─────────────────────────┬──────┘
               │                         │
               ▼                         ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│   Frontend (SPA Angular)  │   │   Backend (Node.js API)  │
│ - Angular 21 (Signals)    │   │ - Express 5 (LTS)        │
│ - Material Design 3       │   │ - Socket.io (WS)         │
│ - Global Error Handling   │   │ - Joi Validation         │
└───────────────────────────┘   └──────────────┬───────────┘
                                               │
                                               ▼
                                ┌──────────────────────────┐
                                │ Persistencia: MongoDB 7  │
                                │ - Control Concurrencia    │
                                │ - Índices de Rendimiento │
                                └──────────────────────────┘
```

---

## 2. Capa Frontend (Angular 21)

La capa de presentación ha sido rediseñada para aprovechar las últimas innovaciones en el ecosistema Angular.

### Gestión de Estado Reactiva (Signals)
Se ha sustituido el modelo tradicional de detección de cambios por **Angular Signals**. Esto permite:
- **Reactividad Granular**: Actualización exclusiva de los nodos del DOM que dependen de una señal específica.
- **Rendimiento Optimizado**: Reducción drástica del overhead en la ejecución de la lógica de UI.
- **Interfaces Predictibles**: El flujo de datos es unidireccional y fácilmente trazable.

### Sistema de Notificaciones MD3
Implementación de un sistema de notificaciones centralizado basado en **Material Design 3**.
- **Servicio Inyectable (`NotifyService`)**: Permite disparar alertas desde cualquier punto de la aplicación (componentes, servicios o interceptores).
- **Tipología de Alertas**: Soporte para estados de éxito, error, información y advertencia.
- **Internacionalización**: Integración nativa con `ngx-translate` para notificaciones multi-idioma.

### Gestión Global de Errores
El sistema implementa una política de tolerancia a fallos mediante un `GlobalErrorHandler` personalizado.
- **Captura Centralizada**: Todas las excepciones no manejadas son interceptadas.
- **Feedback al Usuario**: Se genera una notificación visual inmediata a través del sistema MD3.
- **Trazabilidad**: Los errores se registran en la consola de desarrollo con información de contexto para facilitar el depurado.

---

## 3. Capa Backend (Node.js)

El servidor API actúa como el orquestador central de la lógica de negocio y la comunicación en tiempo real.

### Comunicación Bidireccional
La integración de **Socket.io** permite una arquitectura dirigida por eventos:
- **Eventos Críticos**: `order-update`, `menu-update`, `config-updated`.
- **Baja Latencia**: Sincronización instantánea entre el cliente que realiza el pedido y el terminal de cocina (KDS).

### Validación e Integridad de Datos
- **Joi Validation**: Todos los payloads entrantes son validados contra esquemas estrictos antes de ser procesados.
- **Optimistic Concurrency Control (OCC)**: Implementación del campo de versión (`__v`) en los modelos de Mongoose. Esto garantiza que, en operaciones de alta concurrencia, no se pierdan datos por actualizaciones simultáneas conflictivas.

---

## 4. Persistencia (MongoDB 7)

Se ha seleccionado MongoDB por su flexibilidad en el manejo de estructuras de datos anidadas, como los menús y la configuración del restaurante.

- **Autenticación Mandataria**: El acceso a la base de datos requiere credenciales robustas autogeneradas durante la instalación.
- **Volúmenes Persistentes**: Los datos se almacenan fuera de los contenedores Docker para garantizar la permanencia tras reinicios o actualizaciones.

---

## 5. Capas de Seguridad Implementadas

| Capa | Mecanismo de Seguridad |
| :--- | :--- |
| **Transporte** | Caddy con TLS automatizado y HSTS. |
| **Identidad** | JWT almacenado en Cookies `HttpOnly` y `Secure` (SameSite=Strict). |
| **Autorización** | Role-Based Access Control (RBAC) con middleware de validación. |
| **Infraestructura** | Ejecución de procesos bajo usuarios no-privilegiados (non-root) en Docker. |
| **Red** | Aislamiento de microservicios en redes virtuales internas (Bridge). |
| **Auditoría** | `AuditService` para el registro inmutable de cambios administrativos. |
