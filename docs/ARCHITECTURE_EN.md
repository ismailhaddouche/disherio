# Disher.io System Architecture

This document details the design principles, component structure, data flow, and security layers implemented in Disher.io.

---

## 1. Architecture Overview

Disher.io employs a **single-tenant** model, where each system instance serves exclusively one restaurant. This strategic decision simplifies data management, minimizes attack vectors, and enables execution on resource-limited hardware.

The system is organized under **Clean Architecture** principles, ensuring effective decoupling between business logic, user interfaces, and data persistence.

### Service Diagram

```text
Traffic Entry (Public/LAN)
           │
           ▼
┌───────────────────────────────────────────────┐
│               Reverse Proxy: Caddy            │
│  - TLS Termination (Automated)                │
│  - Traffic Routing (/api, /socket.io)         │
│  - Static Asset Compression and Caching       │
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
                                │ Persistence: MongoDB 7  │
                                │ - Concurrency Control    │
                                │ - Performance Indexes   │
                                └──────────────────────────┘
```

---

## 2. Frontend Layer (Angular 21)

The presentation layer has been redesigned to leverage the latest innovations in the Angular ecosystem.

### Reactive State Management (Signals)
We've replaced the traditional change detection model with **Angular Signals**. This allows:
- **Granular Reactivity**: Exclusive updates of DOM nodes that depend on a specific signal.
- **Optimized Performance**: Drastic reduction in overhead in UI logic execution.
- **Predictable Interfaces**: Data flow is unidirectional and easily traceable.

### MD3 Notification System
Implementation of a centralized notification system based on **Material Design 3**.
- **Injectable Service (`NotifyService`)**: Allows triggering alerts from anywhere in the application (components, services, or interceptors).
- **Alert Typology**: Support for success, error, information, and warning states.
- **Internationalization**: Native integration with `ngx-translate` for multi-language notifications.

### Global Error Management
The system implements a fault tolerance policy through a custom `GlobalErrorHandler`.
- **Centralized Capture**: All unhandled exceptions are intercepted.
- **User Feedback**: Immediate visual notification is generated through the MD3 system.
- **Traceability**: Errors are logged to the development console with context information to facilitate debugging.

---

## 3. Backend Layer (Node.js)

The API server acts as the central orchestrator of business logic and real-time communication.

### Bidirectional Communication
The integration of **Socket.io** enables an event-driven architecture:
- **Critical Events**: `order-update`, `menu-update`, `config-updated`.
- **Low Latency**: Instant synchronization between the customer placing the order and the kitchen terminal (KDS).

### Data Validation and Integrity
- **Joi Validation**: All incoming payloads are validated against strict schemas before being processed.
- **Optimistic Concurrency Control (OCC)**: Implementation of the version field (`__v`) in Mongoose models. This ensures that, in high-concurrency operations, data is not lost due to conflicting simultaneous updates.

---

## 4. Persistence (MongoDB 7)

MongoDB was selected for its flexibility in handling nested data structures, such as menus and restaurant configuration.

- **Mandatory Authentication**: Database access requires robust credentials auto-generated during installation.
- **Persistent Volumes**: Data is stored outside Docker containers to ensure permanence across restarts or updates.

---

## 5. Implemented Security Layers

| Layer | Security Mechanism |
|-------|-------------------|
| **Transport** | Caddy with automated TLS and HSTS. |
| **Identity** | JWT stored in `HttpOnly` and `Secure` Cookies (SameSite=Strict). |
| **Authorization** | Role-Based Access Control (RBAC) with validation middleware. |
| **Infrastructure** | Process execution under non-privileged users (non-root) in Docker. |
| **Network** | Isolation of microservices in internal virtual networks (Bridge). |
| **Audit** | `AuditService` for immutable logging of administrative changes. |
