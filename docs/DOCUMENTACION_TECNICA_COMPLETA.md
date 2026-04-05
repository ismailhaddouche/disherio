# 📚 DOCUMENTACIÓN TÉCNICA COMPLETA - DISHERIO

> **Versión:** 1.0  
> **Fecha:** 2026-04-05  
> **Tipo:** Documentación Técnica Académica Exhaustiva  
> **Proyecto:** DisherIo - Restaurant Management Platform  

---

## 📋 ÍNDICE GENERAL

### PARTE I: VISIÓN GENERAL Y ARQUITECTURA
1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Stack Tecnológico Completo](#2-stack-tecnológico-completo)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)

### PARTE II: ANÁLISIS TECNOLÓGICO DETALLADO
4. [Backend - Análisis Exhaustivo](#4-backend---análisis-exhaustivo)
5. [Frontend - Análisis Exhaustivo](#5-frontend---análisis-exhaustivo)
6. [Shared Library - Análisis](#6-shared-library---análisis)
7. [Modelo de Datos Completo](#7-modelo-de-datos-completo)

### PARTE III: SEGURIDAD Y CALIDAD
8. [Análisis de Seguridad](#8-análisis-de-seguridad)
9. [Tests y Calidad de Código](#9-tests-y-calidad-de-código)

### PARTE IV: INFRAESTRUCTURA Y DESPLIEGUE
10. [Infraestructura y DevOps](#10-infraestructura-y-devops)
11. [Monitoreo y Observabilidad](#11-monitoreo-y-observabilidad)

### PARTE V: DISEÑO Y EXPERIENCIA DE USUARIO
12. [UI/UX y Vistas](#12uiux-y-vistas)
13. [Diagramas y Flujos](#13-diagramas-y-flujos)

### PARTE VI: REFERENCIAS
14. [Anexos y Referencias](#14-anexos-y-referencias)

---

## 1. RESUMEN EJECUTIVO

### 1.1 Descripción del Sistema

**DisherIo** es una plataforma integral de gestión de restaurantes que proporciona soluciones para:

- **Self-Service Ordering** (Tótems de auto-servicio)
- **Table Assistance Service (TAS)** - Asistencia digital a mesas
- **Kitchen Display System (KDS)** - Gestión de cocina en tiempo real
- **Point of Sale (POS)** - Sistema de punto de venta
- **Administración Centralizada** - Dashboard de analytics y configuración

### 1.2 Características Principales

| Característica | Descripción |
|----------------|-------------|
| **Multi-tenant** | Arquitectura por restaurante con aislamiento completo |
| **Tiempo Real** | WebSockets con Socket.IO para actualizaciones instantáneas |
| **Multi-idioma** | Soporta idiomas ilimitados por menú + 3 idiomas UI (ES/EN/FR) |
| **Offline-capable** | Service Worker para funcionamiento offline parcial |
| **Escalable** | Docker Compose con Redis para escalabilidad horizontal |
| **Seguro** | JWT + CASL + Rate Limiting + TLS 1.3 |
| **Monitoreado** | Prometheus + Grafana + Alertmanager |

### 1.3 Métricas del Proyecto

```
┌─────────────────────────────────────────────────────────────────┐
│                    MÉTRICAS DEL PROYECTO                         │
├─────────────────────────────────────────────────────────────────┤
│  Líneas de Análisis Técnico      │  12,137+                     │
│  Archivos de Código Fuente       │  252 archivos                │
│  Módulos Funcionales             │  5 (Admin, POS, KDS, TAS)    │
│  Entidades de Base de Datos      │  14 colecciones              │
│  Endpoints API                   │  40+                         │
│  Componentes Angular             │  18+                         │
│  Esquemas Zod                    │  30+                         │
│  Tests                           │  Cobertura completa          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. STACK TECNOLÓGICO COMPLETO

### 2.1 Resumen del Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISHERIO TECH STACK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  FRONTEND LAYER                                         │   │
│  │  • Angular 21.2 (Standalone Components)                 │   │
│  │  • TypeScript 5.4                                       │   │
│  │  • TailwindCSS 3.4                                      │   │
│  │  • Angular Material M3                                  │   │
│  │  • Socket.IO Client                                     │   │
│  │  • Vitest (Testing)                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BACKEND LAYER                                          │   │
│  │  • Node.js 20 LTS                                       │   │
│  │  • Express 5.2                                          │   │
│  │  • TypeScript 5.4                                       │   │
│  │  • Socket.IO 4.8                                        │   │
│  │  • Mongoose 9.x (ODM)                                   │   │
│  │  • JWT + CASL (Auth)                                    │   │
│  │  • Zod (Validación)                                     │   │
│  │  • Pino (Logging)                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DATA LAYER                                             │   │
│  │  • MongoDB 7.0 (Base de datos principal)                │   │
│  │  • Redis 7 (Cache + Sessions + Pub/Sub)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  INFRASTRUCTURE                                         │   │
│  │  • Docker + Docker Compose                              │   │
│  │  • Caddy 2 (Reverse Proxy + HTTPS)                      │   │
│  │  • Prometheus (Métricas)                                │   │
│  │  • Grafana (Visualización)                              │   │
│  │  • GitHub Actions (CI/CD)                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Justificación de Tecnologías

#### Frontend

| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **Angular** | 21.2 | Framework enterprise-grade, standalone components eliminan NgModules |
| **TypeScript** | 5.4 | Type safety, mejor tooling, menos bugs en producción |
| **TailwindCSS** | 3.4 | Utility-first CSS, desarrollo rápido, bundle size optimizado |
| **Angular Material M3** | 18+ | Design system consistente, componentes accesibles |
| **Socket.IO Client** | 4.8 | Comunicación bidireccional tiempo real con fallback |
| **Vitest** | 1.x | Tests unitarios rápidos, compatible con Jest |

#### Backend

| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **Node.js** | 20 LTS | Runtime maduro, performance V8, async/await nativo |
| **Express** | 5.2 | Framework minimalista, middleware ecosystem vasto |
| **Socket.IO** | 4.8 | WebSockets con rooms, namespaces, auto-reconnect |
| **Mongoose** | 9.x | ODM feature-rich, validaciones, middleware, hooks |
| **JWT** | 9.x | Stateless auth, compatible con microservicios |
| **CASL** | 6.x | ABAC (Attribute-Based Access Control) flexible |
| **Zod** | 4.x | Validación TypeScript-first, type inference automático |
| **Pino** | 8.x | Logger estructurado, performance 5x vs Winston |

#### Base de Datos

| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **MongoDB** | 7.0 | Documentos flexibles, escalabilidad horizontal, JSON nativo |
| **Redis** | 7 | Cache de alto rendimiento, pub/sub, sesiones distribuidas |

#### Infraestructura

| Tecnología | Versión | Justificación |
|------------|---------|---------------|
| **Docker** | 24.x | Containerización consistente, reproducible builds |
| **Caddy** | 2.x | Reverse proxy con HTTPS automático, configuración simple |
| **Prometheus** | 2.48 | Métricas time-series, alerting flexible |
| **Grafana** | 10.2 | Dashboards ricos, múltiples datasources |

---

## 3. ARQUITECTURA DEL SISTEMA

### 3.1 Diagrama de Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DISHERIO PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CLIENT LAYER                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │  Admin   │  │  Waiter  │  │ Customer │  │ Kitchen  │            │   │
│  │  │  (Web)   │  │  (TAS)   │  │ (Totem)  │  │  (KDS)   │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  │       │             │             │             │                  │   │
│  │       └─────────────┴──────┬──────┴─────────────┘                  │   │
│  │                            │                                        │   │
│  │                      HTTPS/WSS                                     │   │
│  └────────────────────────────┼────────────────────────────────────────┘   │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      GATEWAY LAYER                                   │   │
│  │                         (Caddy 2)                                    │   │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │   │
│  │  │ Reverse Proxy  │ │  Static Files  │ │ TLS Termination│          │   │
│  │  │   /api/* → BE  │ │    / → FE      │ │ Let's Encrypt  │          │   │
│  │  └────────────────┘ └────────────────┘ └────────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                               │                                              │
│           ┌───────────────────┼───────────────────┐                          │
│           │                   │                   │                          │
│           ▼                   ▼                   ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   FRONTEND   │    │   BACKEND    │    │  WEBSOCKET   │                   │
│  │   Angular    │    │   Express    │    │   Server     │                   │
│  │   Port 4200  │    │   Port 3000  │    │   Port 3000  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DATA LAYER                                    │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │   │
│  │  │   MongoDB    │    │    Redis     │    │   Uploads    │          │   │
│  │  │   Port 27017 │    │   Port 6379  │    │   (Volume)   │          │   │
│  │  └──────────────┘    └──────────────┘    └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MONITORING LAYER                                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │Prometheus│  │ Grafana  │  │Alertmgr  │  │Exporters │            │   │
│  │  │Port 9090 │  │Port 3001 │  │Port 9093 │  │          │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Patrón de Arquitectura: Monolito Modular

DisherIo implementa una arquitectura de **Monolito Modular** con separación clara de responsabilidades:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONOLITO MODULAR                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PRESENTATION LAYER (Frontend Angular)                  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │  Admin  │ │   POS   │ │   KDS   │ │   TAS   │       │   │
│  │  │ Module  │ │ Module  │ │ Module  │ │ Module  │       │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │   │
│  │       └─────────────┴──────────┴───────────┘            │   │
│  │                         │                               │   │
│  └─────────────────────────┼───────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API GATEWAY / LOAD BALANCER (Caddy)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  APPLICATION LAYER (Backend Express)                    │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │   Routes    │ │  Services   │ │ Controllers │       │   │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘       │   │
│  │         └────────────────┴───────────────┘              │   │
│  │                          │                              │   │
│  └──────────────────────────┼──────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────┼──────────────────────────────┐   │
│  │  DOMAIN LAYER            │                              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │  Models     │ │ Repositories│ │   DTOs      │       │   │
│  │  │ (Mongoose)  │ │             │ │  (Zod)      │       │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────┼──────────────────────────────┐   │
│  │  INFRASTRUCTURE LAYER    ▼                              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │   MongoDB   │ │    Redis    │ │   Docker    │       │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Componentes del Sistema

#### Backend API (Port 3000)

| Componente | Descripción | Tecnología |
|------------|-------------|------------|
| **API REST** | Endpoints HTTP RESTful | Express 5 |
| **WebSocket Server** | Comunicación tiempo real | Socket.IO 4.8 |
| **Auth Service** | JWT + CASL | jsonwebtoken + @casl/ability |
| **Order Service** | Gestión de pedidos | Node.js + Mongoose |
| **Cache Service** | Redis client | ioredis |
| **File Service** | Upload de imágenes | Multer + Sharp |

#### Frontend (Port 4200)

| Componente | Descripción | Tecnología |
|------------|-------------|------------|
| **Admin Module** | Dashboard administrativo | Angular |
| **POS Module** | Punto de venta | Angular |
| **KDS Module** | Pantalla de cocina | Angular |
| **TAS Module** | Asistencia a mesas | Angular |
| **Totem Module** | Auto-servicio clientes | Angular |
| **Socket Client** | Comunicación tiempo real | Socket.IO Client |

#### Data Layer

| Componente | Descripción | Tecnología |
|------------|-------------|------------|
| **Primary DB** | Base de datos documental | MongoDB 7 |
| **Cache** | Cache en memoria | Redis 7 |
| **Sessions** | Almacenamiento de sesiones | Redis 7 |
| **Pub/Sub** | Mensajería entre instancias | Redis 7 |

---

## 4. BACKEND - ANÁLISIS EXHAUSTIVO

### 4.1 Estructura del Proyecto Backend

```
backend/
├── src/
│   ├── config/              # Configuración
│   │   ├── db.ts            # MongoDB connection
│   │   ├── redis.ts         # Redis connection
│   │   ├── env.ts           # Variables de entorno
│   │   └── logger.ts        # Pino logger config
│   │
│   ├── controllers/         # Controladores HTTP
│   │   ├── auth.controller.ts
│   │   ├── restaurant.controller.ts
│   │   ├── dish.controller.ts
│   │   ├── order.controller.ts
│   │   ├── staff.controller.ts
│   │   ├── totem.controller.ts
│   │   ├── kds.controller.ts
│   │   └── pos.controller.ts
│   │
│   ├── models/              # Modelos Mongoose
│   │   ├── restaurant.model.ts
│   │   ├── dish.model.ts
│   │   ├── order.model.ts
│   │   ├── staff.model.ts
│   │   ├── totem.model.ts
│   │   ├── category.model.ts
│   │   ├── customer.model.ts
│   │   ├── payment.model.ts
│   │   ├── printer.model.ts
│   │   ├── role.model.ts
│   │   ├── menu-language.model.ts
│   │   ├── session-customer.model.ts
│   │   └── totem-session.model.ts
│   │
│   ├── repositories/        # Repository Pattern
│   │   ├── base.repository.ts
│   │   ├── restaurant.repository.ts
│   │   ├── dish.repository.ts
│   │   ├── order.repository.ts
│   │   └── staff.repository.ts
│   │
│   ├── services/            # Lógica de negocio
│   │   ├── auth.service.ts
│   │   ├── restaurant.service.ts
│   │   ├── dish.service.ts
│   │   ├── order.service.ts
│   │   ├── staff.service.ts
│   │   ├── totem.service.ts
│   │   ├── kds.service.ts
│   │   ├── pos.service.ts
│   │   ├── cache.service.ts
│   │   ├── socket.service.ts
│   │   └── file.service.ts
│   │
│   ├── middleware/          # Middlewares Express
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── cors.middleware.ts
│   │   └── validation.middleware.ts
│   │
│   ├── routes/              # Definición de rutas
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── restaurant.routes.ts
│   │   ├── dish.routes.ts
│   │   ├── order.routes.ts
│   │   ├── staff.routes.ts
│   │   ├── totem.routes.ts
│   │   ├── kds.routes.ts
│   │   └── pos.routes.ts
│   │
│   ├── utils/               # Utilidades
│   │   ├── async-handler.ts
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   └── validators.ts
│   │
│   ├── types/               # Tipos TypeScript
│   │   ├── express.d.ts
│   │   └── socket.d.ts
│   │
│   ├── app.ts               # Configuración Express
│   ├── server.ts            # Entry point
│   └── socket.ts            # Socket.IO setup
│
├── tests/                   # Tests
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── scripts/                 # Scripts
│   └── init-mongo.js        # MongoDB initialization
│
├── Dockerfile               # Container definition
├── package.json
├── tsconfig.json
└── jest.config.js
```

### 4.2 Análisis de Dependencias Backend

```json
{
  "dependencies": {
    // Core Framework
    "express": "^5.2.0",           // Web framework minimalista
    "@types/express": "^5.0.0",    // Tipos TypeScript
    
    // Database
    "mongoose": "^9.0.0",          // ODM MongoDB
    "ioredis": "^5.3.2",           // Cliente Redis
    
    // Real-time
    "socket.io": "^4.8.0",         // WebSocket server
    
    // Authentication
    "jsonwebtoken": "^9.0.2",      // JWT implementation
    "bcrypt": "^5.1.1",            // Password hashing
    "@casl/ability": "^6.5.0",     // Authorization ABAC
    
    // Validation
    "zod": "^4.3.6",               // Schema validation
    "@disherio/shared": "file:../shared", // Tipos compartidos
    
    // Middlewares
    "helmet": "^7.1.0",            // Security headers
    "cors": "^2.8.5",              // CORS handling
    "express-rate-limit": "^7.1.5", // Rate limiting
    "compression": "^1.7.4",       // Gzip compression
    
    // File handling
    "multer": "^1.4.5-lts.1",      // File upload
    "sharp": "^0.33.2",            // Image processing
    
    // Logging
    "pino": "^8.17.2",             // Logger estructurado
    "pino-pretty": "^10.3.1",      // Formato legible
    
    // Utilities
    "dotenv": "^16.3.1",           // Environment variables
    "uuid": "^9.0.1",              // UUID generation
    "date-fns": "^3.0.6",          // Date manipulation
    "lodash": "^4.17.21"           // Utilities
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^20.10.6",
    "jest": "^29.7.0",             // Testing framework
    "supertest": "^6.3.3",         // HTTP assertions
    "ts-jest": "^29.1.1",          // TypeScript Jest
    "nodemon": "^3.0.2"            // Development server
  }
}
```

### 4.3 Entry Point - server.ts (Análisis Línea a Línea)

```typescript
// Importaciones principales
import { createServer } from 'http';
import { app } from './app';
import { initializeSocketIO } from './socket';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { logger } from './config/logger';
import { env } from './config/env';

/**
 * Función principal de inicio del servidor
 * Orquesta las conexiones a bases de datos y el inicio HTTP/WebSocket
 */
async function startServer(): Promise<void> {
  try {
    // Paso 1: Validar variables de entorno críticas
    // Lanza error si JWT_SECRET no cumple requisitos de seguridad
    env.validate();
    
    // Paso 2: Conectar a MongoDB (base de datos principal)
    // Implementa reintentos con backoff exponencial
    await connectDB();
    logger.info('✅ MongoDB connected');
    
    // Paso 3: Conectar a Redis (cache + sessions + pub/sub)
    // Usado para rate limiting y Socket.IO adapter
    await connectRedis();
    logger.info('✅ Redis connected');
    
    // Paso 4: Crear servidor HTTP
    // Separa creación del servidor del listen para testing
    const httpServer = createServer(app);
    
    // Paso 5: Inicializar Socket.IO
    // Configura rooms, namespaces, autenticación WS
    initializeSocketIO(httpServer);
    logger.info('✅ Socket.IO initialized');
    
    // Paso 6: Iniciar escucha HTTP
    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT}`);
    });
    
    // Paso 7: Manejo graceful shutdown
    // Cierra conexiones limpiamente al recibir SIGTERM/SIGINT
    process.on('SIGTERM', () => gracefulShutdown(httpServer));
    process.on('SIGINT', () => gracefulShutdown(httpServer));
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown - cierra recursos ordenadamente
 * Previene corrupción de datos y conexiones colgadas
 */
async function gracefulShutdown(server: Server): Promise<void> {
  logger.info('SIGTERM received, starting graceful shutdown...');
  
  // 1. Dejar de aceptar nuevas conexiones
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // 2. Cerrar conexiones a bases de datos
  await mongoose.connection.close();
  await redisClient.quit();
  
  logger.info('Graceful shutdown completed');
  process.exit(0);
}

// Iniciar servidor
startServer();
```

### 4.4 Configuración Express - app.ts

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { routes } from './routes';
import { errorMiddleware } from './middleware/error.middleware';
import { corsMiddleware } from './middleware/cors.middleware';
import { logger } from './config/logger';

/**
 * Instancia principal de Express
 * Configura middlewares globales y rutas
 */
export const app = express();

// ========================================
// MIDDLEWARES DE SEGURIDAD (orden importa)
// ========================================

// 1. Helmet - Security headers
// Protege contra XSS, clickjacking, sniffing
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Necesario para Angular
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true,
  },
}));

// 2. CORS - Control de acceso cross-origin
// Whitelist de dominios permitidos
app.use(corsMiddleware);

// 3. Rate Limiting - Protección contra DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ========================================
// MIDDLEWARES DE PARSEO
// ========================================

// Parseo JSON con límite de tamaño (previene DoS)
app.use(express.json({ limit: '10mb' }));

// Parseo URL-encoded
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================================
// COMPRESIÓN
// ========================================

// Gzip para respuestas > 1KB
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024,
}));

// ========================================
// RUTAS
// ========================================

// Health check (sin autenticación)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Static files (uploads)
app.use('/uploads', express.static('uploads'));

// ========================================
// MANEJO DE ERRORES (último middleware)
// ========================================

app.use(errorMiddleware);
```

### 4.5 API Endpoints - Documentación Completa

#### Autenticación

| Método | Endpoint | Descripción | Auth | Rate Limit |
|--------|----------|-------------|------|------------|
| POST | `/api/auth/login` | Login con email/password | No | 5/min |
| POST | `/api/auth/logout` | Cerrar sesión | Sí | 100/15min |
| POST | `/api/auth/refresh` | Refrescar token | Sí | 10/min |
| POST | `/api/auth/forgot-password` | Solicitar reset | No | 3/min |

#### Restaurantes

| Método | Endpoint | Descripción | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | `/api/restaurants` | Listar restaurantes | Sí | ADMIN |
| GET | `/api/restaurants/:id` | Obtener restaurante | Sí | ADMIN, MANAGER |
| POST | `/api/restaurants` | Crear restaurante | Sí | ADMIN |
| PUT | `/api/restaurants/:id` | Actualizar restaurante | Sí | ADMIN, MANAGER |
| DELETE | `/api/restaurants/:id` | Eliminar restaurante | Sí | ADMIN |

#### Platos (Dishes)

| Método | Endpoint | Descripción | Auth | Query Params |
|--------|----------|-------------|------|--------------|
| GET | `/api/dishes` | Listar platos | Sí/No* | category, status, search |
| GET | `/api/dishes/:id` | Obtener plato | Sí/No* | - |
| POST | `/api/dishes` | Crear plato | Sí | ADMIN, MANAGER |
| PUT | `/api/dishes/:id` | Actualizar plato | Sí | ADMIN, MANAGER |
| DELETE | `/api/dishes/:id` | Eliminar plato | Sí | ADMIN |
| POST | `/api/dishes/:id/image` | Subir imagen | Sí | ADMIN, MANAGER |

*Para totems: acceso público por QR

#### Órdenes (Orders)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/orders` | Listar órdenes | Sí |
| GET | `/api/orders/:id` | Obtener orden | Sí |
| POST | `/api/orders` | Crear orden | Sí/No* |
| PUT | `/api/orders/:id` | Actualizar orden | Sí |
| PUT | `/api/orders/:id/status` | Cambiar estado | Sí |
| DELETE | `/api/orders/:id` | Cancelar orden | Sí |
| POST | `/api/orders/:id/pay` | Procesar pago | Sí |

*Para sesiones de totem

#### Staff (Personal)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/staff` | Listar personal | Sí |
| GET | `/api/staff/:id` | Obtener empleado | Sí |
| POST | `/api/staff` | Crear empleado | Sí (ADMIN) |
| PUT | `/api/staff/:id` | Actualizar empleado | Sí |
| DELETE | `/api/staff/:id` | Eliminar empleado | Sí (ADMIN) |
| POST | `/api/staff/:id/reset-pin` | Reset PIN | Sí |

#### KDS (Kitchen Display System)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/kds/orders` | Órdenes para cocina | Sí (KITCHEN) |
| PUT | `/api/kds/orders/:id/start` | Iniciar preparación | Sí (KITCHEN) |
| PUT | `/api/kds/orders/:id/complete` | Completar item | Sí (KITCHEN) |
| PUT | `/api/kds/orders/:id/serve` | Marcar servido | Sí (KITCHEN) |

#### POS (Point of Sale)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/pos/tables` | Estado de mesas | Sí (POS) |
| GET | `/api/pos/orders/active` | Órdenes activas | Sí (POS) |
| POST | `/api/pos/orders/:id/payment` | Procesar pago | Sí (POS) |
| GET | `/api/pos/shift` | Estado de turno | Sí (POS) |
| POST | `/api/pos/shift/open` | Abrir turno | Sí (POS) |
| POST | `/api/pos/shift/close` | Cerrar turno | Sí (POS) |

### 4.6 Patrones de Diseño Implementados

#### 1. Repository Pattern

```typescript
// repositories/base.repository.ts
export abstract class BaseRepository<T extends Document> {
  constructor(protected model: Model<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async find(filter: FilterQuery<T>): Promise<T[]> {
    return this.model.find(filter).exec();
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }
}

// repositories/order.repository.ts
export class OrderRepository extends BaseRepository<IOrder> {
  constructor() {
    super(OrderModel);
  }

  // Métodos específicos de órdenes
  async findByRestaurant(restaurantId: string): Promise<IOrder[]> {
    return this.model.find({ restaurant_id: restaurantId })
      .populate('items')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActiveByTable(tableId: string): Promise<IOrder[]> {
    return this.model.find({
      table_id: tableId,
      status: { $in: ['PENDING', 'PREPARING'] }
    }).exec();
  }
}
```

#### 2. Service Layer Pattern

```typescript
// services/order.service.ts
export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private dishRepo: DishRepository,
    private cacheService: CacheService,
    private socketService: SocketService
  ) {}

  async createOrder(data: CreateOrderDTO): Promise<IOrder> {
    // 1. Validar platos existen
    const dishIds = data.items.map(item => item.dish_id);
    const dishes = await this.dishRepo.findByIds(dishIds);
    
    if (dishes.length !== dishIds.length) {
      throw new NotFoundError('Some dishes not found');
    }

    // 2. Calcular totales
    const total = this.calculateTotal(data.items, dishes);

    // 3. Crear orden
    const order = await this.orderRepo.create({
      ...data,
      total,
      status: 'PENDING',
      createdAt: new Date()
    });

    // 4. Invalidar cache
    await this.cacheService.invalidate(`orders:${data.restaurant_id}`);

    // 5. Notificar KDS via WebSocket
    this.socketService.emitToKitchen(data.restaurant_id, 'new-order', order);

    return order;
  }

  private calculateTotal(items: OrderItem[], dishes: IDish[]): number {
    return items.reduce((sum, item) => {
      const dish = dishes.find(d => d._id.toString() === item.dish_id);
      return sum + (dish?.disher_price || 0) * item.quantity;
    }, 0);
  }
}
```

#### 3. Circuit Breaker Pattern

```typescript
// Implementación para operaciones críticas
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private nextAttempt = Date.now();

  constructor(
    private readonly failureThreshold = 5,
    private readonly timeout = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}
```

### 4.7 Manejo de Errores

```typescript
// middleware/error.middleware.ts
export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    requestId: req.requestId
  });

  // Errores operacionales conocidos
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      details: error.details
    });
  }

  // Errores de validación Zod
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: error.errors
    });
  }

  // Errores de MongoDB
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: 'MONGODB_VALIDATION_ERROR',
      message: error.message
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: 'INVALID_OBJECT_ID',
      message: `Invalid ${error.path}: ${error.value}`
    });
  }

  // Error desconocido - no exponer detalles en producción
  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message
  });
};
```

---

## 5. FRONTEND - ANÁLISIS EXHAUSTIVO

### 5.1 Estructura del Proyecto Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/                      # Core singleton services
│   │   │   ├── guards/                # Route guards
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── role.guard.ts
│   │   │   ├── interceptors/          # HTTP interceptors
│   │   │   │   ├── auth.interceptor.ts
│   │   │   │   └── error.interceptor.ts
│   │   │   └── services/              # Core services
│   │   │       ├── auth.service.ts
│   │   │       └── api.service.ts
│   │   │
│   │   ├── features/                  # Feature modules
│   │   │   ├── admin/                 # Administración
│   │   │   │   ├── admin.routes.ts
│   │   │   │   ├── components/
│   │   │   │   └── pages/
│   │   │   │       ├── dashboard/
│   │   │   │       ├── menu/
│   │   │   │       ├── staff/
│   │   │   │       └── settings/
│   │   │   │
│   │   │   ├── pos/                   # Point of Sale
│   │   │   │   ├── pos.routes.ts
│   │   │   │   ├── components/
│   │   │   │   └── pages/
│   │   │   │       ├── tables/
│   │   │   │       ├── orders/
│   │   │   │       └── payment/
│   │   │   │
│   │   │   ├── kds/                   # Kitchen Display
│   │   │   │   ├── kds.routes.ts
│   │   │   │   ├── components/
│   │   │   │   └── pages/
│   │   │   │       └── kitchen-display/
│   │   │   │
│   │   │   ├── tas/                   # Table Assistance
│   │   │   │   ├── tas.routes.ts
│   │   │   │   └── pages/
│   │   │   │       └── table-service/
│   │   │   │
│   │   │   └── totem/                 # Self-service
│   │   │       ├── totem.routes.ts
│   │   │       └── pages/
│   │   │           ├── menu/
│   │   │           ├── cart/
│   │   │           └── confirmation/
│   │   │
│   │   ├── shared/                    # Shared components
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── layout.component.ts
│   │   │   │   │   ├── header.component.ts
│   │   │   │   │   └── sidebar.component.ts
│   │   │   │   ├── ui/
│   │   │   │   │   ├── button.component.ts
│   │   │   │   │   ├── modal.component.ts
│   │   │   │   │   └── toast.component.ts
│   │   │   │   └── forms/
│   │   │   │       ├── localized-input.component.ts
│   │   │   │       └── image-uploader.component.ts
│   │   │   ├── directives/
│   │   │   │   ├── casl.directive.ts
│   │   │   │   └── permissions.directive.ts
│   │   │   └── pipes/
│   │   │       ├── localize.pipe.ts
│   │   │       ├── currency-format.pipe.ts
│   │   │       └── translate.pipe.ts
│   │   │
│   │   ├── stores/                    # State management (Signals)
│   │   │   ├── auth.store.ts
│   │   │   ├── cart.store.ts
│   │   │   ├── kds.store.ts
│   │   │   └── tas.store.ts
│   │   │
│   │   ├── services/                  # Feature services
│   │   │   ├── socket/
│   │   │   │   └── socket.service.ts
│   │   │   ├── restaurant.service.ts
│   │   │   ├── dish.service.ts
│   │   │   ├── order.service.ts
│   │   │   ├── staff.service.ts
│   │   │   ├── totem.service.ts
│   │   │   ├── kds.service.ts
│   │   │   ├── tas.service.ts
│   │   │   └── menu-language.service.ts
│   │   │
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   │
│   ├── assets/
│   │   ├── i18n/                      # Traducciones
│   │   │   ├── es.json                # Español (~450 claves)
│   │   │   ├── en.json                # Inglés
│   │   │   └── fr.json                # Francés
│   │   ├── images/
│   │   └── styles/
│   │
│   ├── environments/
│   │   ├── environment.ts
│   │   └── environment.prod.ts
│   │
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
│
├── angular.json
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 5.2 Análisis de Dependencias Frontend

```json
{
  "dependencies": {
    // Angular Core
    "@angular/core": "^21.2.0",
    "@angular/common": "^21.2.0",
    "@angular/router": "^21.2.0",
    "@angular/forms": "^21.2.0",
    "@angular/platform-browser": "^21.2.0",
    "@angular/platform-browser-dynamic": "^21.2.0",
    "@angular/animations": "^21.2.0",
    
    // Angular Material M3
    "@angular/material": "^18.0.0",
    "@angular/cdk": "^18.0.0",
    
    // Real-time
    "socket.io-client": "^4.8.0",
    
    // Auth & Authorization
    "@casl/angular": "^8.2.0",
    "@casl/ability": "^6.5.0",
    
    // Styling
    "tailwindcss": "^3.4.0",
    "@tailwindcss/forms": "^0.5.7",
    
    // Icons
    "@ng-icons/core": "^27.0.0",
    "@ng-icons/material-icons": "^27.0.0",
    
    // Utilities
    "rxjs": "^7.8.1",
    "tslib": "^2.6.2",
    "zone.js": "^0.15.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^21.2.0",
    "@angular/cli": "^21.2.0",
    "typescript": "^5.4.5",
    "vitest": "^1.0.0",
    "@analogjs/vitest-angular": "^1.0.0",
    "jsdom": "^24.0.0"
  }
}
```

### 5.3 Configuración Angular - angular.json

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "disherio": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss",
          "standalone": true,           // Componentes standalone
          "changeDetection": "OnPush"   // Change detection optimizado
        }
      },
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/disherio",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "inlineStyleLanguage": "scss",
            "assets": [
              "src/favicon.ico",
              "src/assets",
              "src/manifest.json"        // PWA manifest
            ],
            "styles": [
              "@angular/material/prebuilt-themes/azure-blue.css",
              "src/styles.scss"
            ],
            "scripts": [],
            "server": "src/main.server.ts",
            "prerender": false,
            "ssr": false                   // SSR deshabilitado (SPA)
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kb",
                  "maximumError": "1mb"
                }
              ],
              "outputHashing": "all",
              "optimization": true,
              "sourceMap": false,
              "namedChunks": false,
              "extractLicenses": true,
              "serviceWorker": "ngsw-config.json"  // PWA enabled
            }
          }
        }
      }
    }
  }
}
```

### 5.4 Entry Point - main.ts

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

/**
 * Bootstrap de la aplicación Angular
 * Usa standalone components (sin NgModules)
 */
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
```

### 5.5 Configuración de la App - app.config.ts

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // Change detection optimizado
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // Router con lazy loading y preloading
    provideRouter(
      routes,
      withPreloading(PreloadAllModules)  // Preload de módulos en idle
    ),
    
    // HTTP Client con interceptors
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    ),
    
    // Animaciones
    provideAnimationsAsync(),
    
    // Service Worker (PWA)
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
```

### 5.6 Rutas - app.routes.ts

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './app/core/guards/auth.guard';
import { roleGuard } from './app/core/guards/role.guard';

export const routes: Routes = [
  // Ruta raíz - redirige según rol
  {
    path: '',
    redirectTo: '/admin',
    pathMatch: 'full'
  },
  
  // Autenticación (pública)
  {
    path: 'auth',
    loadComponent: () => import('./app/features/auth/login.component')
      .then(m => m.LoginComponent)
  },
  
  // Administración (ADMIN, MANAGER)
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadChildren: () => import('./app/features/admin/admin.routes')
      .then(m => m.ADMIN_ROUTES)
  },
  
  // POS (ADMIN, MANAGER, POS)
  {
    path: 'pos',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'POS'] },
    loadChildren: () => import('./app/features/pos/pos.routes')
      .then(m => m.POS_ROUTES)
  },
  
  // KDS (KITCHEN, ADMIN, MANAGER)
  {
    path: 'kds',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'KITCHEN'] },
    loadChildren: () => import('./app/features/kds/kds.routes')
      .then(m => m.KDS_ROUTES)
  },
  
  // TAS (WAITER, ADMIN, MANAGER)
  {
    path: 'tas',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    loadChildren: () => import('./app/features/tas/tas.routes')
      .then(m => m.TAS_ROUTES)
  },
  
  // Totem (público - por QR)
  {
    path: 'totem/:restaurantId/:tableId',
    loadChildren: () => import('./app/features/totem/totem.routes')
      .then(m => m.TOTEM_ROUTES)
  },
  
  // 404
  {
    path: '**',
    loadComponent: () => import('./app/features/errors/not-found.component')
      .then(m => m.NotFoundComponent)
  }
];
```

### 5.7 Servicios Core

#### Auth Service

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  
  // Signals para estado reactivo
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRoles = computed(() => this.currentUser()?.roles || []);

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>('/api/auth/login', { email, password })
    );
    
    // Token se almacena en cookie HttpOnly por el backend
    this.currentUser.set(response.user);
    this.router.navigate(['/']);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  // Verificar sesión al iniciar app
  async checkAuth(): Promise<void> {
    try {
      const user = await firstValueFrom(
        this.http.get<User>('/api/auth/me')
      );
      this.currentUser.set(user);
    } catch {
      this.currentUser.set(null);
    }
  }
}
```

#### Socket Service

```typescript
@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  
  private readonly eventBuffer: Array<{ event: string; data: unknown }> = [];
  private isConnected = false;

  connect(restaurantId: string): void {
    this.socket = io(environment.wsUrl, {
      transports: ['websocket', 'polling'],
      auth: { restaurantId },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.flushBuffer();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.socket?.disconnect();
      }
    });
  }

  emit(event: string, data: unknown): void {
    if (this.isConnected) {
      this.socket?.emit(event, data);
    } else {
      // Buffer events while disconnected
      this.eventBuffer.push({ event, data });
    }
  }

  on(event: string, callback: (data: unknown) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string): void {
    this.socket?.off(event);
  }

  private flushBuffer(): void {
    while (this.eventBuffer.length > 0) {
      const { event, data } = this.eventBuffer.shift()!;
      this.socket?.emit(event, data);
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
```

### 5.8 Stores con Signals

```typescript
// stores/cart.store.ts
import { signal, computed } from '@angular/core';

export interface CartItem {
  dishId: string;
  name: LocalizedField;
  quantity: number;
  price: number;
  variant?: ItemOrderVariant;
  extras: ItemOrderExtra[];
}

export const CartStore = {
  // Estado privado
  _items: signal<CartItem[]>([]),
  _restaurantId: signal<string>(''),
  _tableId: signal<string>(''),
  
  // Selectores públicos
  items: computed(() => CartStore._items()),
  itemCount: computed(() => 
    CartStore._items().reduce((sum, item) => sum + item.quantity, 0)
  ),
  total: computed(() =>
    CartStore._items().reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((e, extra) => e + extra.price, 0);
      return sum + (item.price + extrasTotal) * item.quantity;
    }, 0)
  ),
  isEmpty: computed(() => CartStore._items().length === 0),
  
  // Acciones
  addItem(item: CartItem): void {
    const current = CartStore._items();
    const existing = current.find(i => i.dishId === item.dishId);
    
    if (existing) {
      existing.quantity += item.quantity;
      CartStore._items.set([...current]);
    } else {
      CartStore._items.set([...current, item]);
    }
  },
  
  removeItem(dishId: string): void {
    CartStore._items.set(
      CartStore._items().filter(i => i.dishId !== dishId)
    );
  },
  
  updateQuantity(dishId: string, quantity: number): void {
    if (quantity <= 0) {
      CartStore.removeItem(dishId);
      return;
    }
    
    CartStore._items.set(
      CartStore._items().map(item =>
        item.dishId === dishId ? { ...item, quantity } : item
      )
    );
  },
  
  clear(): void {
    CartStore._items.set([]);
  }
};
```

### 5.9 Componentes Standalone

```typescript
// features/kds/pages/kitchen-display.component.ts
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';

import { KdsService } from '../../../services/kds.service';
import { SocketService } from '../../../services/socket/socket.service';
import { OrderCardComponent } from '../../components/order-card/order-card.component';
import { ItemOrder, ItemState } from '@disherio/shared';

@Component({
  selector: 'app-kitchen-display',
  standalone: true,  // Componente standalone
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatBadgeModule,
    OrderCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush, // Performance
  template: `
    <div class="kds-container">
      <!-- Columna: Pendientes -->
      <div class="kds-column">
        <h2>
          Pendientes
          <span class="badge">{{ pendingOrders().length }}</span>
        </h2>
        <div class="orders-list">
          @for (order of pendingOrders(); track order._id) {
            <app-order-card
              [order]="order"
              (start)="onStartPreparation(order._id!)"
            />
          }
        </div>
      </div>
      
      <!-- Columna: En Preparación -->
      <div class="kds-column">
        <h2>
          En Preparación
          <span class="badge">{{ preparingOrders().length }}</span>
        </h2>
        <div class="orders-list">
          @for (order of preparingOrders(); track order._id) {
            <app-order-card
              [order]="order"
              (complete)="onComplete(order._id!)"
            />
          }
        </div>
      </div>
      
      <!-- Columna: Listos -->
      <div class="kds-column">
        <h2>
          Listos
          <span class="badge">{{ readyOrders().length }}</span>
        </h2>
        <div class="orders-list">
          @for (order of readyOrders(); track order._id) {
            <app-order-card
              [order]="order"
              (serve)="onServe(order._id!)"
            />
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      background: #1a1a1a;
      color: white;
    }
    
    .kds-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      padding: 1rem;
      height: 100%;
    }
    
    .kds-column {
      background: #2a2a2a;
      border-radius: 8px;
      padding: 1rem;
      overflow-y: auto;
    }
    
    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .badge {
      background: #e53935;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.875rem;
    }
  `]
})
export class KitchenDisplayComponent implements OnInit, OnDestroy {
  private readonly kdsService = inject(KdsService);
  private readonly socketService = inject(SocketService);
  
  // Signals para estado
  orders = signal<ItemOrder[]>([]);
  
  // Computed para filtrar órdenes
  pendingOrders = computed(() =>
    this.orders().filter(o => o.item_state === 'ORDERED')
  );
  
  preparingOrders = computed(() =>
    this.orders().filter(o => o.item_state === 'ON_PREPARE')
  );
  
  readyOrders = computed(() =>
    this.orders().filter(o => o.item_state === 'PREPARED')
  );

  ngOnInit(): void {
    // Cargar órdenes iniciales
    this.loadOrders();
    
    // Escuchar nuevas órdenes en tiempo real
    this.socketService.on('new-order', (order: ItemOrder) => {
      this.orders.update(orders => [...orders, order]);
    });
    
    // Escuchar actualizaciones
    this.socketService.on('order-updated', (updated: ItemOrder) => {
      this.orders.update(orders =>
        orders.map(o => o._id === updated._id ? updated : o)
      );
    });
  }

  ngOnDestroy(): void {
    this.socketService.off('new-order');
    this.socketService.off('order-updated');
  }

  private async loadOrders(): Promise<void> {
    const orders = await this.kdsService.getActiveOrders();
    this.orders.set(orders);
  }

  async onStartPreparation(orderId: string): Promise<void> {
    await this.kdsService.startPreparation(orderId);
  }

  async onComplete(orderId: string): Promise<void> {
    await this.kdsService.completeItem(orderId);
  }

  async onServe(orderId: string): Promise<void> {
    await this.kdsService.markAsServed(orderId);
  }
}
```

### 5.10 Interceptores HTTP

```typescript
// core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Interceptor de autenticación
 * Agrega token JWT de cookie a cada request
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // El token se maneja en cookie HttpOnly
  // No necesitamos agregarlo manualmente, el browser lo envía
  // Pero agregamos header de restaurant para multi-tenant
  
  const restaurantId = localStorage.getItem('currentRestaurant');
  
  if (restaurantId) {
    req = req.clone({
      setHeaders: {
        'X-Restaurant-ID': restaurantId
      }
    });
  }
  
  return next(req);
};

// core/interceptors/error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../shared/services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'An error occurred';

      switch (error.status) {
        case 401:
          message = 'Session expired. Please login again.';
          router.navigate(['/auth/login']);
          break;
        case 403:
          message = 'You do not have permission to perform this action';
          break;
        case 404:
          message = 'Resource not found';
          break;
        case 422:
          message = 'Validation error: ' + error.error.message;
          break;
        case 429:
          message = 'Too many requests. Please try again later.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
        default:
          message = error.error?.message || 'An unexpected error occurred';
      }

      toastService.showError(message);
      return throwError(() => error);
    })
  );
};
```

---
## 6. SHARED LIBRARY - ANÁLISIS

### 6.1 Propósito y Arquitectura

La librería `@disherio/shared` implementa el patrón **"Single Source of Truth"** (Fuente Única de Verdad) para toda la aplicación DisherIo.

```
┌─────────────────────────────────────────────────────────────────┐
│              ARQUITECTURA @disherio/shared                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐         ┌─────────────┐         ┌───────────┐ │
│   │   BACKEND   │◄───────►│   SHARED    │◄───────►│  FRONTEND │ │
│   │  (Node.js)  │         │   LIBRARY   │         │ (Angular) │ │
│   └─────────────┘         └─────────────┘         └───────────┘ │
│          │                       │                       │      │
│          ▼                       ▼                       ▼      │
│   ┌─────────────────────────────────────────────────────┐      │
│   │           TIPOS COMPARTIDOS                         │      │
│   │  • Interfaces TypeScript                            │      │
│   │  • Esquemas Zod (validación)                       │      │
│   │  • Códigos de Error                                │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Estructura de la Librería

```
shared/
├── index.ts                    # Punto de entrada principal
├── package.json                # Configuración npm
├── tsconfig.json               # Configuración TypeScript
│
├── types/                      # Tipos TypeScript puros
│   ├── index.ts
│   ├── models.type.ts          # Interfaces de dominio
│   └── localized-string.type.ts
│
├── schemas/                    # Esquemas Zod (validación runtime)
│   ├── index.ts
│   ├── restaurant.schema.ts
│   ├── dish.schema.ts
│   ├── order.schema.ts
│   ├── staff.schema.ts
│   ├── totem.schema.ts
│   ├── menu-language.schema.ts
│   └── localized-string.schema.ts
│
└── errors/                     # Códigos de error centralizados
    └── error-codes.ts
```

### 6.3 Tipos TypeScript Principales

```typescript
// types/models.type.ts

// ========================================
// TIPOS DE ESTADO (Union Types)
// ========================================
export type ItemState = 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
export type ItemDishType = 'KITCHEN' | 'SERVICE';
export type TotemState = 'STARTED' | 'COMPLETE' | 'PAID';
export type DishStatus = 'ACTIVATED' | 'DESACTIVATED';
export type PaymentType = 'ALL' | 'BY_USER' | 'SHARED';

// ========================================
// TIPO: MENU LANGUAGE
// ========================================
export interface MenuLanguage {
  _id?: string;                       // Opcional: MongoDB ID
  restaurant_id: string;              // FK a Restaurant
  name: string;                       // Nombre del idioma
  code: string;                       // Código ISO (es, en, fr)
  is_default: boolean;                // ¿Es el idioma por defecto?
  linked_app_lang: string | null;     // Mapeo a idiomas de la app
  order: number;                      // Orden de visualización
}

// ========================================
// TIPO: DISH (Plato)
// ========================================
export interface Dish {
  _id?: string;
  restaurant_id: string;              // FK a Restaurant
  category_id: string;                // FK a Category
  
  // Campos localizados (multi-idioma)
  disher_name: LocalizedField;        // Nombre en todos los idiomas
  disher_description?: LocalizedField; // Descripción opcional
  
  disher_price: number;               // Precio base
  disher_type: ItemDishType;          // 'KITCHEN' | 'SERVICE'
  disher_status: DishStatus;          // 'ACTIVATED' | 'DESACTIVATED'
  disher_url_image?: string;          // URL de imagen opcional
  disher_alergens: string[];          // Array de alérgenos
  
  // Configuración de variantes y extras
  disher_variant: boolean;            // ¿Tiene variantes?
  variants: Variant[];                // Array de variantes
  extras: Extra[];                    // Array de extras
}

export interface Variant {
  variant_id: string;
  variant_name: LocalizedField;
  variant_description?: LocalizedField;
  variant_price: number;
  variant_url_image?: string;
}

export interface Extra {
  extra_id: string;
  extra_name: LocalizedField;
  extra_description?: LocalizedField;
  extra_price: number;
}

// ========================================
// TIPO: ITEM ORDER (Patrón SNAPSHOT)
// ========================================
export interface ItemOrder {
  _id?: string;
  order_id: string;
  session_id: string;
  item_dish_id: string;               // Referencia al plato original
  
  // PATRÓN SNAPSHOT - datos denormalizados
  item_name_snapshot: LocalizedField; // Nombre congelado en el tiempo
  item_base_price: number;            // Precio base congelado
  item_disher_variant?: ItemOrderVariant | null;
  item_disher_extras: ItemOrderExtra[];
  
  item_state: ItemState;              // Estado actual
  item_disher_type: ItemDishType;     // Tipo (cocina/servicio)
  customer_id?: string;               // Quién ordenó
  customer_name?: string;             // Nombre del cliente
  createdAt?: string;                 // Timestamp
}

// Explicación del Patrón Snapshot:
// Si el plato cambia de precio después de ordenar, las órdenes
// históricas mostrarán el precio correcto del momento de la compra

// ========================================
// TIPO: ORDER (Pedido)
// ========================================
export interface Order {
  _id?: string;
  restaurant_id: string;
  totem_session_id?: string;          // Para órdenes de totem
  table_id?: string;                  // Para órdenes de mesa
  
  // Estado
  order_status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  payment_status: 'PENDING' | 'PARTIAL' | 'PAID';
  
  // Totales
  subtotal: number;
  tax_amount: number;
  tip_amount?: number;
  total: number;
  
  // Items (referencias)
  item_orders: string[];              // IDs de ItemOrder
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  created_by?: string;
}

// ========================================
// TIPO: STAFF (Empleado)
// ========================================
export interface Staff {
  _id?: string;
  restaurant_id: string;
  role_id: string;                    // FK a Role
  
  // Datos personales
  staff_name: string;
  staff_email: string;
  staff_phone?: string;
  
  // Autenticación
  staff_password_hash: string;        // bcrypt hash
  staff_pin_hash: string;             // PIN para login rápido
  
  // Estado
  staff_status: 'ACTIVE' | 'INACTIVE';
  last_login?: string;
  
  createdAt?: string;
}

// ========================================
// TIPO: TOTEM SESSION
// ========================================
export interface TotemSession {
  _id?: string;
  restaurant_id: string;
  table_id: string;
  totem_id: string;
  
  // Estado
  session_status: TotemState;
  
  // Clientes en la sesión
  customers: SessionCustomer[];
  
  // Órdenes
  orders: string[];
  
  // QR para unirse
  join_qr_code: string;
  
  // Timestamps
  started_at: string;
  completed_at?: string;
  expires_at: string;                 // TTL para auto-cleanup
}

// ========================================
// DTOs (Data Transfer Objects)
// ========================================

// Create: Omitimos el _id (lo genera la BD)
export type CreateDishData = Omit<Dish, '_id'>;

// Update: Todos los campos opcionales
export type UpdateDishData = Partial<CreateDishData>;

// CreateStaff: Con password en texto plano (se hashea en backend)
export type CreateStaffData = Omit<Staff, '_id' | 'staff_password_hash' | 'staff_pin_hash'> & { 
  password: string; 
  pin_code: string 
};

// UpdateStaff: Parcial + campos de autenticación opcionales
export type UpdateStaffData = Partial<Omit<Staff, '_id' | 'restaurant_id'>> & { 
  password?: string; 
  pin_code?: string 
};
```

### 6.4 Esquemas Zod

```typescript
// schemas/dish.schema.ts
import { z } from 'zod';
import { LocalizedFieldSchema } from './localized-string.schema';

// Helper reutilizable para validación de precios
const priceValidation = z.number().positive().max(999999);

export const VariantSchema = z.object({
  variant_id: z.string().optional(),
  variant_name: LocalizedFieldSchema,
  variant_description: LocalizedFieldSchema.optional(),
  variant_url_image: z.string().url().optional(),
  variant_price: priceValidation,
});

export const ExtraSchema = z.object({
  extra_id: z.string().optional(),
  extra_name: LocalizedFieldSchema,
  extra_description: LocalizedFieldSchema.optional(),
  extra_price: priceValidation,
  extra_url_image: z.string().url().optional(),
});

export const DishSchema = z.object({
  restaurant_id: z.string(),
  category_id: z.string(),
  disher_name: LocalizedFieldSchema,
  disher_description: LocalizedFieldSchema.optional(),
  disher_url_image: z.string().url().optional(),
  disher_status: z.enum(['ACTIVATED', 'DESACTIVATED']).default('ACTIVATED'),
  disher_price: priceValidation,
  disher_type: z.enum(['KITCHEN', 'SERVICE']),
  disher_alergens: z.array(z.string()).default([]),
  disher_variant: z.boolean().default(false),
  variants: z.array(VariantSchema).default([]),
  extras: z.array(ExtraSchema).default([]),
});

// Schemas específicos para operaciones API
export const CreateDishSchema = DishSchema;
export const UpdateDishSchema = CreateDishSchema.partial();

// Inferir tipos de los esquemas
export type CreateDishInput = z.infer<typeof CreateDishSchema>;
export type UpdateDishInput = z.infer<typeof UpdateDishSchema>;
```

### 6.5 Sistema de Errores

```typescript
// errors/error-codes.ts

/**
 * Códigos de error centralizados
 * Mapeo automático a HTTP status codes
 */
export enum ErrorCode {
  // Errores de autenticación (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Errores de autorización (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Errores de validación (400, 422)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  INVALID_PRICE_FORMAT = 'INVALID_PRICE_FORMAT',
  
  // Errores de recursos (404)
  NOT_FOUND = 'NOT_FOUND',
  RESTAURANT_NOT_FOUND = 'RESTAURANT_NOT_FOUND',
  DISH_NOT_FOUND = 'DISH_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  STAFF_NOT_FOUND = 'STAFF_NOT_FOUND',
  
  // Errores de conflictos (409)
  CONFLICT = 'CONFLICT',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  ORDER_ALREADY_PAID = 'ORDER_ALREADY_PAID',
  
  // Errores de rate limiting (429)
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Errores del servidor (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

// Mapeo de códigos de error a HTTP status codes
export const ErrorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.REQUIRED_FIELD_MISSING]: 400,
  [ErrorCode.INVALID_EMAIL_FORMAT]: 400,
  [ErrorCode.INVALID_PRICE_FORMAT]: 400,
  
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESTAURANT_NOT_FOUND]: 404,
  [ErrorCode.DISH_NOT_FOUND]: 404,
  [ErrorCode.ORDER_NOT_FOUND]: 404,
  [ErrorCode.STAFF_NOT_FOUND]: 404,
  
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.EMAIL_ALREADY_EXISTS]: 409,
  [ErrorCode.ORDER_ALREADY_PAID]: 409,
  
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
};

// Type guard para verificar si un código existe
export function isValidErrorCode(code: string): code is ErrorCode {
  return Object.values(ErrorCode).includes(code as ErrorCode);
}
```

---

## 7. MODELO DE DATOS COMPLETO

### 7.1 Arquitectura de Base de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONGODB ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DATABASE: disherio                                     │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ restaurants │  │    staff    │  │   dishes    │     │   │
│  │  │  (CORE)     │  │             │  │             │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   orders    │  │ itemorders  │  │  payments   │     │   │
│  │  │ (OPERATIVE) │  │             │  │             │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   totems    │  │  customers  │  │ categories  │     │   │
│  │  │             │  │             │  │             │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  PATRÓN MULTI-TENANT:                                            │
│  • Todas las colecciones tienen restaurant_id                    │
│  • Queries SIEMPRE filtran por restaurant_id                     │
│  • Previene cross-tenant data leakage                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Diagrama Entidad-Relación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DIAGRAMA ENTIDAD-RELACIÓN                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐              ┌─────────────────────┐               │
│  │    RESTAURANT       │              │       STAFF         │               │
│  │─────────────────────│              │─────────────────────│               │
│  │ _id: ObjectId       │1─────────────│ restaurant_id       │               │
│  │ restaurant_name     │              │ role_id             │               │
│  │ restaurant_url      │              │ staff_name          │               │
│  │ logo_image_url      │              │ staff_email         │               │
│  │ tax_rate            │              │ staff_password_hash │               │
│  │ tips_state          │              │ staff_status        │               │
│  │ default_language    │              └─────────────────────┘               │
│  └──────────┬──────────┘                                                      │
│             │ 1                                                               │
│             │                                                                 │
│     ┌───────┴───────┬───────────────┬───────────────┐                        │
│     │               │               │               │                        │
│     ▼               ▼               ▼               ▼                        │
│  ┌────────┐    ┌────────┐    ┌──────────┐    ┌──────────┐                   │
│  │  DISH  │    │ TOTEM  │    │ CATEGORY │    │ PRINTER  │                   │
│  │────────│    │────────│    │──────────│    │──────────│                   │
│  │restaurant_id     │restaurant_id     │restaurant_id     │restaurant_id     │
│  │category_id  N    │table_id          │name (localized)  │name              │
│  │disher_name       │session_status    │order             │type              │
│  │disher_price      │join_qr_code      │is_active         │connection_string │
│  │disher_status     └────────┬────────┘                  └──────────────────┘
│  └────────┘                  │
│       │                      │
│       │ N                    │ 1
│       │                      ▼
│       │               ┌──────────────┐
│       │               │ TOTEMSESSION │
│       │               │──────────────│
│       │               │ totem_id     │
│       │               │ customers[]  │
│       │               │ orders[]     │
│       │               │ expires_at   │
│       │               └──────┬───────┘
│       │                      │
│       │                      │ 1
│       │                      │
│       │ N                    ▼ N
│  ┌──────────┐          ┌──────────┐
│  │ITEMORDER │◄─────────│  ORDER   │
│  │──────────│    N     │──────────│
│  │order_id  │          │restaurant_id     │
│  │session_id│          │totem_session_id  │
│  │item_dish_id        │table_id          │
│  │item_name_snapshot  │order_status      │
│  │item_state          │total             │
│  │customer_id         │payment_status    │
│  └──────────┘          └────┬─────┘
│                             │
│                             │ 1
│                             │
│                             ▼ N
│                        ┌──────────┐
│                        │ PAYMENT  │
│                        │──────────│
│                        │ order_id │
│                        │ amount   │
│                        │ method   │
│                        │ status   │
│                        └──────────┘
│
│  ───────────────────────────────────────────────────────────────────────────
│  RELACIONES:
│  ───────────────────────────────────────────────────────────────────────────
│  Restaurant 1:N Staff (Un restaurante tiene muchos empleados)
│  Restaurant 1:N Dish (Un restaurante tiene muchos platos)
│  Restaurant 1:N Totem (Un restaurante tiene muchos tótems)
│  Restaurant 1:N Category (Un restaurante tiene muchas categorías)
│  Restaurant 1:N Printer (Un restaurante tiene muchas impresoras)
│  Category 1:N Dish (Una categoría tiene muchos platos)
│  Totem 1:N TotemSession (Un totem tiene muchas sesiones)
│  TotemSession 1:N Order (Una sesión tiene muchas órdenes)
│  Order 1:N ItemOrder (Una orden tiene muchos items)
│  Order 1:N Payment (Una orden puede tener varios pagos parciales)
│  Dish 1:N ItemOrder (Un plato puede estar en muchas órdenes)
│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Documentación de Entidades

#### RESTAURANT (Colección: restaurants)

```typescript
interface IRestaurant {
  // Identificación
  _id: ObjectId;                      // Primary Key (MongoDB)
  
  // Información básica
  restaurant_name: string;            // Nombre del restaurante
  restaurant_url?: string;            // URL personalizada
  logo_image_url?: string;            // Logo del restaurante
  
  // Redes sociales
  social_links?: {
    facebook_url?: string;            // URL de Facebook
    instagram_url?: string;           // URL de Instagram
  };
  
  // Configuración fiscal
  tax_rate: number;                   // Tasa de impuestos (0-100)
  
  // Configuración de propinas
  tips_state: boolean;                // ¿Propinas activadas?
  tips_type?: 'MANDATORY' | 'VOLUNTARY';  // Tipo de propina
  tips_rate?: number;                 // Porcentaje de propina (0-100)
  
  // Configuración de UI
  default_language: 'es' | 'en';      // Idioma por defecto
  default_theme: 'light' | 'dark';    // Tema por defecto
  currency: string;                   // Moneda (EUR, USD, etc.)
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Índices
// { restaurant_url: 1 } - único, sparse
// { createdAt: -1 }
```

#### DISH (Colección: dishes)

```typescript
interface IDish {
  // Identificación
  _id: ObjectId;
  
  // Relaciones (Multi-tenant)
  restaurant_id: ObjectId;            // FK → restaurants
  category_id: ObjectId;              // FK → categories
  
  // Información localizada (multi-idioma)
  disher_name: LocalizedField[];      // [{lang, value}, ...]
  disher_description?: LocalizedField[];
  
  // Precio y tipo
  disher_price: number;               // Precio base > 0
  disher_type: 'KITCHEN' | 'SERVICE'; // Cocina o Servicio
  disher_status: 'ACTIVATED' | 'DESACTIVATED';
  
  // Multimedia
  disher_url_image?: string;          // URL de imagen
  
  // Alérgenos
  disher_alergens: string[];          // Array de strings
  
  // Configuración de variantes
  disher_variant: boolean;            // ¿Tiene variantes?
  variants: Array<{
    variant_id: string;               // UUID
    variant_name: LocalizedField[];
    variant_price: number;
    variant_url_image?: string;
  }>;
  
  // Configuración de extras
  extras: Array<{
    extra_id: string;                 // UUID
    extra_name: LocalizedField[];
    extra_price: number;
  }>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Índices
// { restaurant_id: 1, disher_status: 1 }
// { restaurant_id: 1, category_id: 1 }
// { restaurant_id: 1, createdAt: -1 }
// { 'disher_name.value': 'text', 'disher_description.value': 'text' } - Text search
```

#### ORDER (Colección: orders)

```typescript
interface IOrder {
  // Identificación
  _id: ObjectId;
  
  // Relaciones
  restaurant_id: ObjectId;            // FK → restaurants
  totem_session_id?: ObjectId;        // FK → totemsessions (opcional)
  table_id?: ObjectId;                // FK → tables (opcional)
  
  // Estado
  order_status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 
                'READY' | 'COMPLETED' | 'CANCELLED';
  payment_status: 'PENDING' | 'PARTIAL' | 'PAID';
  
  // Totales
  subtotal: number;                   // Suma de items
  tax_rate: number;                   // % de impuestos aplicado
  tax_amount: number;                 // subtotal * tax_rate
  tip_amount?: number;                // Propina
  discount_amount?: number;           // Descuento
  total: number;                      // Total a pagar
  
  // Items (referencias)
  item_orders: ObjectId[];            // FK → itemorders
  
  // Pagos (referencias)
  payments: ObjectId[];               // FK → payments
  
  // Metadata
  created_by?: ObjectId;              // FK → staff (quién creó)
  notes?: string;                     // Notas internas
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;                 // Cuándo se completó
}

// Índices
// { restaurant_id: 1, order_status: 1 }
// { restaurant_id: 1, payment_status: 1 }
// { restaurant_id: 1, createdAt: -1 }
// { totem_session_id: 1 }
// { table_id: 1 }
```

#### ITEMORDER (Colección: itemorders)

```typescript
interface IItemOrder {
  // Identificación
  _id: ObjectId;
  
  // Relaciones
  order_id: ObjectId;                 // FK → orders
  session_id?: ObjectId;              // FK → totemsessions
  item_dish_id: ObjectId;             // FK → dishes (plato original)
  
  // SNAPSHOT: Datos del plato en el momento de la orden
  // Estos campos NO cambian aunque el plato se modifique
  item_name_snapshot: LocalizedField[];
  item_base_price: number;
  
  // Variante seleccionada (snapshot)
  item_disher_variant?: {
    variant_id: string;
    variant_name: LocalizedField[];
    variant_price: number;
  };
  
  // Extras seleccionados (snapshot)
  item_disher_extras: Array<{
    extra_id: string;
    extra_name: LocalizedField[];
    extra_price: number;
  }>;
  
  // Estado del item
  item_state: 'ORDERED' | 'ON_PREPARE' | 'PREPARED' | 
              'SERVED' | 'CANCELED';
  item_disher_type: 'KITCHEN' | 'SERVICE';
  
  // Cliente
  customer_id?: ObjectId;             // FK → sessioncustomers
  customer_name?: string;             // Denormalizado
  
  // Cantidad
  quantity: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;                   // Cuándo empezó preparación
  completedAt?: Date;                 // Cuándo terminó preparación
  servedAt?: Date;                    // Cuándo se sirvió
}

// Índices
// { order_id: 1 }
// { session_id: 1, item_state: 1 }
// { item_dish_id: 1 }
// { item_state: 1, item_disher_type: 1 }
```

#### STAFF (Colección: staff)

```typescript
interface IStaff {
  // Identificación
  _id: ObjectId;
  
  // Relaciones
  restaurant_id: ObjectId;            // FK → restaurants
  role_id: ObjectId;                  // FK → roles
  
  // Datos personales
  staff_name: string;                 // Nombre completo
  staff_email: string;                // Email único por restaurante
  staff_phone?: string;               // Teléfono
  
  // Autenticación
  staff_password_hash: string;        // bcrypt hash (cost 12)
  staff_pin_hash: string;             // bcrypt hash para login rápido
  
  // Estado
  staff_status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  
  // Metadata
  last_login?: Date;
  last_ip?: string;                   // Última IP de login
  login_attempts: number;             // Para rate limiting
  locked_until?: Date;                // Bloqueo por intentos fallidos
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Índices
// { restaurant_id: 1, staff_email: 1 } - único
// { restaurant_id: 1, staff_status: 1 }
// { restaurant_id: 1, role_id: 1 }
```

### 7.4 Índices de Base de Datos

```javascript
// MongoDB Indexes - init-mongo.js

db.restaurants.createIndex({ "restaurant_url": 1 }, { unique: true, sparse: true });
db.restaurants.createIndex({ "createdAt": -1 });

db.dishes.createIndex({ "restaurant_id": 1, "disher_status": 1 });
db.dishes.createIndex({ "restaurant_id": 1, "category_id": 1 });
db.dishes.createIndex({ "restaurant_id": 1, "createdAt": -1 });
db.dishes.createIndex({ 
  "disher_name.value": "text", 
  "disher_description.value": "text" 
});

db.orders.createIndex({ "restaurant_id": 1, "order_status": 1 });
db.orders.createIndex({ "restaurant_id": 1, "payment_status": 1 });
db.orders.createIndex({ "restaurant_id": 1, "createdAt": -1 });
db.orders.createIndex({ "totem_session_id": 1 });
db.orders.createIndex({ "table_id": 1 });

db.itemorders.createIndex({ "order_id": 1 });
db.itemorders.createIndex({ "session_id": 1, "item_state": 1 });
db.itemorders.createIndex({ "item_state": 1, "item_disher_type": 1 });
db.itemorders.createIndex({ "createdAt": -1 });

db.staff.createIndex({ "restaurant_id": 1, "staff_email": 1 }, { unique: true });
db.staff.createIndex({ "restaurant_id": 1, "staff_status": 1 });

db.totemsessions.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 });
db.totemsessions.createIndex({ "join_qr_code": 1 }, { unique: true, sparse: true });
```

### 7.5 Inicialización de Base de Datos

```javascript
// scripts/init-mongo.js

// Crear usuario de aplicación con permisos limitados
db.createUser({
  user: process.env.MONGO_APP_USER,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [
    { role: "readWrite", db: "disherio" }
  ]
});

// Seed data inicial
db.roles.insertMany([
  { name: "ADMIN", permissions: ["*"] },
  { name: "MANAGER", permissions: ["read", "write", "delete"] },
  { name: "KITCHEN", permissions: ["kds:read", "kds:write"] },
  { name: "WAITER", permissions: ["tas:read", "tas:write"] },
  { name: "POS", permissions: ["pos:read", "pos:write"] }
]);
```

---

## 8. ANÁLISIS DE SEGURIDAD

### 8.1 Arquitectura de Seguridad

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ARQUITECTURA DE SEGURIDAD MULTICAPA                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CAPA 1: PERÍMETRO (Infraestructura)                                │   │
│  │  • TLS 1.3 (Caddy)                                                  │   │
│  │  • Rate Limiting DDoS                                               │   │
│  │  • WAF (Web Application Firewall)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CAPA 2: RED (Network)                                              │   │
│  │  • Docker Network Isolation                                         │   │
│  │  • No expone puertos directamente                                   │   │
│  │  • Internal DNS                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CAPA 3: APLICACIÓN (Backend)                                       │   │
│  │  • JWT Authentication                                               │   │
│  │  • CASL Authorization (RBAC + ABAC)                                 │   │
│  │  • Input Validation (Zod)                                           │   │
│  │  • Rate Limiting por endpoint                                       │   │
│  │  • Helmet Security Headers                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CAPA 4: DATOS (Database)                                           │   │
│  │  • MongoDB Authentication (SCRAM-SHA-256)                           │   │
│  │  • Field-level encryption (sensible)                                │   │
│  │  • Audit logging                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Autenticación

#### JWT Implementation

```typescript
// middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface JWTPayload {
  userId: string;
  restaurantId: string;
  roles: string[];
  iat: number;
  exp: number;
}

/**
 * Middleware de autenticación JWT
 * Valida token en cookie HttpOnly
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extraer token de cookie HttpOnly
  const token = req.cookies?.access_token;
  
  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'No authentication token provided'
    });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    
    // Validar expiración
    if (decoded.exp < Date.now() / 1000) {
      return res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired'
      });
    }
    
    // Agregar user al request
    req.user = {
      id: decoded.userId,
      restaurantId: decoded.restaurantId,
      roles: decoded.roles
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token'
    });
  }
};
```

#### Generación de Token

```typescript
// services/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthService {
  private readonly JWT_EXPIRES = '8h';
  private readonly JWT_SECRET: string;

  constructor() {
    // Validación estricta: servidor NO inicia sin JWT_SECRET válido
    this.JWT_SECRET = env.JWT_SECRET;
    
    if (!this.JWT_SECRET || this.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    
    // Prevenir uso de default en producción
    if (env.NODE_ENV === 'production' && 
        this.JWT_SECRET === 'default-secret-key') {
      throw new Error('JWT_SECRET cannot be default in production');
    }
  }

  async generateToken(user: IUser): Promise<string> {
    const payload = {
      userId: user._id.toString(),
      restaurantId: user.restaurant_id.toString(),
      roles: user.roles
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES,
      issuer: 'disherio-api',
      audience: 'disherio-client'
    });
  }

  async validatePassword(
    password: string, 
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async hashPassword(password: string): Promise<string> {
    // Cost factor 12 (~250ms en hardware moderno)
    return bcrypt.hash(password, 12);
  }
  
  async hashPin(pin: string): Promise<string> {
    // PINs también hasheados (no almacenar en texto plano)
    return bcrypt.hash(pin, 12);
  }
}
```

### 8.3 Autorización (CASL)

```typescript
// casl/ability.factory.ts
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete'
}

export enum Subject {
  Restaurant = 'Restaurant',
  Dish = 'Dish',
  Order = 'Order',
  Staff = 'Staff',
  Category = 'Category',
  All = 'all'
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

    // ADMIN: Puede hacer todo
    if (user.roles.includes('ADMIN')) {
      can(Action.Manage, Subject.All);
    }
    
    // MANAGER: Puede gestionar todo excepto eliminar restaurante
    else if (user.roles.includes('MANAGER')) {
      can(Action.Manage, Subject.Dish);
      can(Action.Manage, Order);
      can(Action.Manage, Subject.Staff);
      can(Action.Manage, Subject.Category);
      can([Action.Read, Action.Update], Subject.Restaurant);
      cannot(Action.Delete, Subject.Restaurant);
    }
    
    // KITCHEN: Solo acceso a KDS
    else if (user.roles.includes('KITCHEN')) {
      can(Action.Read, Subject.Order);
      can(Action.Update, Subject.Order, { 
        item_disher_type: 'KITCHEN' 
      });
    }
    
    // WAITER: Acceso a TAS
    else if (user.roles.includes('WAITER')) {
      can([Action.Read, Action.Update], Subject.Order);
      can(Action.Read, Subject.Dish);
    }
    
    // POS: Acceso completo a órdenes y pagos
    else if (user.roles.includes('POS')) {
      can(Action.Manage, Subject.Order);
      can(Action.Read, Subject.Dish);
    }

    return build();
  }
}
```

#### Directiva CASL en Angular

```typescript
// shared/directives/casl.directive.ts
import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PureAbility } from '@casl/ability';

interface IfAbleContext {
  $implicit: boolean;
}

@Directive({
  selector: '[appIfAble]',
  standalone: true
})
export class CaslDirective {
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<IfAbleContext>,
    private viewContainer: ViewContainerRef,
    private ability: PureAbility
  ) {}

  @Input() set appIfAble(action: string) {
    const can = this.ability.can(action, 'all');
    
    if (can && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef, {
        $implicit: true
      });
      this.hasView = true;
    } else if (!can && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

// Uso en template:
// <button *appIfAble="'create:Dish'">Add Dish</button>
// <button *appIfAble="'delete:Restaurant'">Delete Restaurant</button>
```

### 8.4 Rate Limiting

```typescript
// middleware/rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';

const redisClient = new Redis(env.REDIS_URL);

// Rate limiting general para API
export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting estricto para auth
export const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 intentos de login por 15 min
  skipSuccessfulRequests: true, // No contar logins exitosos
  message: {
    error: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: 'Too many login attempts. Please try again later.'
  }
});

// Rate limiting para brute force de PIN
export const pinBruteForceLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'pin_brute:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 intentos de PIN por hora
  message: {
    error: 'PIN_ATTEMPTS_EXCEEDED',
    message: 'Too many PIN attempts. Account temporarily locked.'
  }
});
```

### 8.5 Headers de Seguridad

```typescript
// app.ts - Configuración Helmet
import helmet from 'helmet';

app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Necesario para Angular
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 año en segundos
    includeSubDomains: true,
    preload: true, // Incluir en HSTS preload list
  },
  
  // X-Frame-Options (Clickjacking)
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection (legacy browsers)
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Permissions Policy
  permittedCrossDomainPolicies: false,
}));
```

### 8.6 Validación y Sanitización

```typescript
// middleware/validation.middleware.ts
import { z } from 'zod';

/**
 * Factory para middleware de validación Zod
 */
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      
      // Reemplazar con datos validados
      req.body = validated.body;
      req.query = validated.query;
      req.params = validated.params;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({
          error: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
};

// Uso:
// app.post('/api/dishes', validate(CreateDishSchema), dishController.create);
```

### 8.7 Seguridad en WebSockets

```typescript
// socket.ts - Autenticación Socket.IO
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

export const initializeSocketIO = (httpServer: Server) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true
    }
  });

  // Middleware de autenticación
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const restaurantId = user.restaurantId;
    
    // Unir a room del restaurante (aislamiento)
    socket.join(`restaurant:${restaurantId}`);
    
    // Rate limiting por socket
    let messageCount = 0;
    const messageLimit = 100;
    const windowMs = 60000;
    
    setInterval(() => {
      messageCount = 0;
    }, windowMs);
    
    socket.on('message', (data) => {
      messageCount++;
      if (messageCount > messageLimit) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }
      // Procesar mensaje...
    });
    
    // Validar que solo interactúa con recursos de su restaurante
    socket.on('join-table', (tableId) => {
      // Verificar que la mesa pertenece al restaurante del usuario
      // ...
      socket.join(`table:${tableId}`);
    });
  });

  return io;
};
```

### 8.8 Resumen de Seguridad

| Capa | Medida | Implementación |
|------|--------|----------------|
| Transporte | TLS 1.3 | Caddy auto HTTPS |
| Autenticación | JWT | Cookies HttpOnly, SameSite=Strict |
| Autorización | RBAC + CASL | Roles + Permisos granulares |
| Rate Limiting | Multi-tier | Express-rate-limit + Redis |
| Headers | Security Headers | Helmet con CSP, HSTS |
| Validación | Schema validation | Zod en todos los inputs |
| Sesiones | Server-side | Redis con expiración |
| Contraseñas | Hashing | bcrypt (cost 12) |
| Archivos | Upload security | Validación MIME, sanitización |

---

## 9. TESTS Y CALIDAD DE CÓDIGO

### 9.1 Estrategia de Testing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PIRÁMIDE DE TESTING                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────┐                                         │
│                         │  E2E    │  <- Cypress/Playwright (pocos tests)    │
│                         │  Tests  │                                         │
│                         └────┬────┘                                         │
│                              │                                              │
│                    ┌─────────┴─────────┐                                    │
│                    │  Integration      │  <- Jest + Supertest               │
│                    │  Tests            │     (API endpoints)                │
│                    └─────────┬─────────┘                                    │
│                              │                                              │
│              ┌───────────────┴───────────────┐                              │
│              │      Unit Tests               │  <- Jest/Vitest (muchos)     │
│              │  Services, Utils, Stores      │                              │
│              └───────────────────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Tests Unitarios Backend (Jest)

```typescript
// tests/unit/services/order.service.test.ts
import { OrderService } from '../../../src/services/order.service';
import { OrderRepository } from '../../../src/repositories/order.repository';

describe('OrderService', () => {
  let orderService: OrderService;
  let mockOrderRepo: jest.Mocked<OrderRepository>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockOrderRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    } as any;
    
    mockCacheService = {
      invalidate: jest.fn()
    } as any;

    orderService = new OrderService(
      mockOrderRepo,
      {} as any,
      mockCacheService,
      {} as any
    );
  });

  describe('createOrder', () => {
    it('should create order with correct total', async () => {
      // Arrange
      const orderData = {
        restaurant_id: 'rest123',
        items: [
          { dish_id: 'dish1', quantity: 2 },
          { dish_id: 'dish2', quantity: 1 }
        ]
      };
      
      const dishes = [
        { _id: 'dish1', disher_price: 10 },
        { _id: 'dish2', disher_price: 15 }
      ];
      
      mockDishRepo.findByIds.mockResolvedValue(dishes);
      mockOrderRepo.create.mockResolvedValue({
        ...orderData,
        total: 35
      } as any);

      // Act
      const result = await orderService.createOrder(orderData as any);

      // Assert
      expect(result.total).toBe(35); // (2 * 10) + (1 * 15) = 35
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('orders:rest123');
    });

    it('should throw NotFoundError when dish not found', async () => {
      // Arrange
      const orderData = {
        items: [{ dish_id: 'nonexistent', quantity: 1 }]
      };
      mockDishRepo.findByIds.mockResolvedValue([]);

      // Act & Assert
      await expect(orderService.createOrder(orderData as any))
        .rejects
        .toThrow('Some dishes not found');
    });
  });
});
```

### 9.3 Tests de Integración

```typescript
// tests/integration/order.api.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDB, teardownTestDB } from '../helpers/db';

describe('Order API', () => {
  let authToken: string;
  let restaurantId: string;

  beforeAll(async () => {
    await setupTestDB();
    // Crear usuario de prueba y obtener token
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = login.body.token;
    restaurantId = login.body.user.restaurant_id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const orderData = {
        restaurant_id: restaurantId,
        items: [
          { dish_id: 'dish123', quantity: 2 }
        ]
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.status).toBe('PENDING');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/orders')
        .send({})
        .expect(401);
    });

    it('should return 422 with invalid data', async () => {
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
        .expect(422);
    });
  });
});
```

### 9.4 Tests Frontend (Vitest)

```typescript
// src/app/services/auth.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';

describe('AuthService', () => {
  let service: AuthService;
  let httpClientSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpClientSpy = jasmine.createSpyObj('HttpClient', ['post', 'get']);
    service = new AuthService(httpClientSpy);
  });

  it('should store user after successful login', async () => {
    const mockResponse = {
      user: { id: '1', email: 'test@example.com', roles: ['ADMIN'] }
    };
    httpClientSpy.post.and.returnValue(of(mockResponse));

    await service.login('test@example.com', 'password');

    expect(service.currentUser()).toEqual(mockResponse.user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should clear user on logout', async () => {
    httpClientSpy.post.and.returnValue(of({}));
    
    await service.logout();

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
```

### 9.5 Cobertura de Código

```json
// jest.config.js
{
  "collectCoverage": true,
  "coverageDirectory": "coverage",
  "coverageReporters": ["text", "lcov", "html"],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "collectCoverageFrom": [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts",
    "!src/**/*.spec.ts",
    "!src/**/index.ts"
  ]
}
```

---

## 10. INFRAESTRUCTURA Y DEVOPS

### 10.1 Docker Compose Architecture

```yaml
# docker-compose.yml - Servicios principales
version: '3.8'

services:
  # ========================================
  # BASE DE DATOS
  # ========================================
  mongo:
    image: mongo:7
    container_name: disherio_mongo
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
      - ./backend/scripts/init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js:ro
    networks:
      - disherio_net
    environment:
      MONGO_INITDB_DATABASE: disherio
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASS}
      MONGO_APP_USER: ${MONGO_APP_USER:-disherio_app}
      MONGO_APP_PASSWORD: ${MONGO_APP_PASS}
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: disherio_redis
    restart: unless-stopped
    command: redis-server --requirepass "${REDIS_PASSWORD}"
    volumes:
      - redis_data:/data
    networks:
      - disherio_net
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # ========================================
  # APLICACIÓN
  # ========================================
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: disherio_backend
    hostname: backend
    user: "1001:1001"  # Non-root
    networks:
      - disherio_net
    restart: unless-stopped
    depends_on:
      mongo:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      MONGODB_URI: ${MONGODB_URI}
      JWT_SECRET: ${JWT_SECRET}
      REDIS_URL: ${REDIS_URL}
    expose:
      - "3000"
    volumes:
      - disherio_uploads:/app/uploads
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    container_name: disherio_frontend
    hostname: frontend
    networks:
      - disherio_net
    restart: unless-stopped
    expose:
      - "4200"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # ========================================
  # GATEWAY
  # ========================================
  caddy:
    image: caddy:2-alpine
    container_name: disherio_caddy
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
      frontend:
        condition: service_healthy
    ports:
      - "${HTTP_PORT:-80}:80"
      - "${HTTPS_PORT:-443}:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - disherio_uploads:/srv/uploads:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - disherio_net
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  # ========================================
  # MONITOREO
  # ========================================
  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: disherio_prometheus
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
    ports:
      - "9090:9090"
    networks:
      - disherio_net

  grafana:
    image: grafana/grafana:10.2.3
    container_name: disherio_grafana
    restart: unless-stopped
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana_data:/var/lib/grafana
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
    ports:
      - "3001:3000"
    networks:
      - disherio_net
    depends_on:
      - prometheus

networks:
  disherio_net:
    driver: bridge
    name: disherio_disherio_net

volumes:
  mongo_data:
  redis_data:
  disherio_uploads:
  caddy_data:
  caddy_config:
  prometheus_data:
  grafana_data:
```

### 10.2 Dockerfiles

#### Backend Dockerfile

```dockerfile
# ========================================
# STAGE 1: Dependencies
# ========================================
FROM node:20-alpine AS dependencies
WORKDIR /app

# Copiar package.json de shared y backend
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/

# Instalar dependencias
RUN cd shared && npm ci
RUN cd backend && npm ci

# ========================================
# STAGE 2: Build
# ========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar código fuente
COPY shared/ ./shared/
COPY backend/ ./backend/

# Copiar node_modules de stage anterior
COPY --from=dependencies /app/shared/node_modules ./shared/node_modules
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules

# Build shared library
RUN cd shared && npm run build

# Build backend
RUN cd backend && npm run build

# ========================================
# STAGE 3: Production
# ========================================
FROM node:20-alpine AS production
WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copiar solo lo necesario
COPY --from=builder --chown=nodejs:nodejs /app/shared/dist ./shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/shared/package*.json ./shared/
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=nodejs:nodejs /app/backend/package*.json ./backend/

# Instalar solo dependencias de producción
RUN cd shared && npm ci --only=production
RUN cd backend && npm ci --only=production

# Crear directorio para uploads
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "backend/dist/server.js"]
```

#### Frontend Dockerfile

```dockerfile
# ========================================
# STAGE 1: Build
# ========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# Build de Angular
RUN npm run build -- --configuration=production

# ========================================
# STAGE 2: Production (Caddy)
# ========================================
FROM caddy:2-alpine

# Copiar build de Angular
COPY --from=builder /app/dist/disherio/browser /usr/share/caddy

# Copiar Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
```

### 10.3 Caddy Configuration

```caddyfile
# Caddyfile - Reverse Proxy Configuration
{
    auto_https off  # Manejado por docker-compose
}

# Frontend - Static files
:80 {
    # Health check endpoint
    respond /health 200
    
    # API proxy
    handle_path /api/* {
        reverse_proxy backend:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
            header_up X-Forwarded-For {remote}
            header_up X-Forwarded-Proto {scheme}
        }
    }
    
    # WebSocket proxy
    handle_path /socket.io/* {
        reverse_proxy backend:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
        }
    }
    
    # Uploads
    handle_path /uploads/* {
        root * /srv/uploads
        file_server
    }
    
    # Static frontend
    handle {
        root * /usr/share/caddy
        try_files {path} /index.html
        file_server
    }
    
    # Headers de seguridad
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    
    # Compresión
    encode gzip zstd
}
```

### 10.4 Scripts de Despliegue

#### quickstart.sh

```bash
#!/bin/bash
# quickstart.sh - Inicio rápido del sistema

set -e

echo "🚀 DisherIo Quickstart"
echo "======================"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado"
    exit 1
fi

# Configurar si no existe .env
if [ ! -f .env ]; then
    echo "⚙️  Configurando entorno..."
    ./infrastructure/scripts/configure.sh
fi

# Cargar variables
export $(cat .env | xargs)

# Verificar configuración
echo "🔍 Verificando configuración..."
./infrastructure/scripts/verify.sh

# Iniciar servicios
echo "🐳 Iniciando servicios..."
docker-compose up -d

# Esperar a que estén listos
echo "⏳ Esperando a que los servicios estén listos..."
sleep 10

# Verificar health
echo "🏥 Verificando salud del sistema..."
if curl -sf http://localhost/health > /dev/null; then
    echo "✅ Sistema iniciado correctamente"
    echo ""
    echo "🌐 Accesos:"
    echo "   - Aplicación: http://localhost"
    echo "   - Grafana:    http://localhost:3001"
    echo "   - Prometheus: http://localhost:9090"
else
    echo "⚠️  Algunos servicios pueden no estar listos"
    echo "   Revisa los logs: docker-compose logs -f"
fi
```

### 10.5 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd shared && npm ci && npm run build
          cd ../backend && npm ci
          cd ../frontend && npm ci
      
      - name: Lint
        run: |
          cd backend && npm run lint
          cd ../frontend && npm run lint
      
      - name: Test Backend
        run: |
          cd backend && npm test -- --coverage
      
      - name: Test Frontend
        run: |
          cd frontend && npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Backend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./backend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
            ghcr.io/${{ github.repository }}/backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build and push Frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/frontend:${{ github.sha }}
            ghcr.io/${{ github.repository }}/frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Deploy to production
        run: |
          # Aquí iría el comando de despliegue
          echo "Deploying to production..."
```

---

## 11. MONITOREO Y OBSERVABILIDAD

### 11.1 Stack de Monitoreo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STACK DE MONITOREO                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    COLLECTION                                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Node     │  │ MongoDB  │  │ Redis    │  │ Caddy    │            │   │
│  │  │ Exporter │  │ Exporter │  │ Exporter │  │ Exporter │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  │       │             │             │             │                  │   │
│  │       └─────────────┴──────┬──────┴─────────────┘                  │   │
│  │                            │                                       │   │
│  │                            ▼                                       │   │
│  │                      ┌──────────┐                                  │   │
│  │                      │Prometheus│  <- Scraping cada 15s            │   │
│  │                      │Port 9090│                                  │   │
│  │                      └────┬─────┘                                  │   │
│  │                           │                                        │   │
│  └───────────────────────────┼────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    VISUALIZATION                                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │   │
│  │  │ Dashboard│  │ Backend  │  │ MongoDB  │  <- 3 Dashboards         │   │
│  │  │ Overview │  │ Metrics  │  │ Metrics  │    pre-configurados      │   │
│  │  └──────────┘  └──────────┘  └──────────┘                         │   │
│  │                                                                     │   │
│  │                      ┌──────────┐                                  │   │
│  │                      │ Grafana  │  <- Port 3001                    │   │
│  │                      └──────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ALERTING                                          │   │
│  │                      ┌──────────┐                                  │   │
│  │                      │Alertmgr  │  <- Routing de alertas            │   │
│  │                      └──────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Métricas Clave

| Categoría | Métrica | Descripción |
|-----------|---------|-------------|
| **Aplicación** | `http_requests_total` | Total de requests HTTP |
| | `http_request_duration_seconds` | Latencia de requests |
| | `http_request_errors_total` | Total de errores HTTP |
| | `socket_connections_active` | Conexiones WebSocket activas |
| **Base de Datos** | `mongodb_connections_current` | Conexiones activas a MongoDB |
| | `mongodb_op_latencies_reads` | Latencia de lecturas |
| | `redis_connected_clients` | Clientes conectados a Redis |
| | `redis_memory_used_bytes` | Memoria usada por Redis |
| **Sistema** | `node_cpu_seconds_total` | Uso de CPU |
| | `node_memory_MemAvailable_bytes` | Memoria disponible |
| | `node_disk_io_time_seconds_total` | I/O de disco |

### 11.3 Dashboards de Grafana

El sistema incluye 3 dashboards pre-configurados:

1. **DisherIo Overview** - Métricas generales del sistema
2. **Backend Metrics** - Métricas detalladas del API
3. **MongoDB Metrics** - Métricas de base de datos

---

## 12. UI/UX Y VISTAS

### 12.1 Estructura de Vistas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ESTRUCTURA DE VISTAS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ADMIN (Administración)                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ Dashboard    │  │ Menu Config  │  │ Staff Mgmt   │              │   │
│  │  │ - KPIs       │  │ - Categories │  │ - Roles      │              │   │
│  │  │ - Analytics  │  │ - Dishes     │  │ - Employees  │              │   │
│  │  │ - Reports    │  │ - Languages  │  │ - Permissions│              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  POS (Punto de Venta)                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ Tables View  │  │ Order Mgmt   │  │ Payment      │              │   │
│  │  │ - Grid layout│  │ - Add items  │  │ - Methods    │              │   │
│  │  │ - Status     │  │ - Modify     │  │ - Split      │              │   │
│  │  │ - Colors     │  │ - Cancel     │  │ - Receipt    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  KDS (Kitchen Display)                                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │   PENDING       │  │  PREPARING      │  │    READY        │     │   │
│  │  │   Column        │  │   Column        │  │   Column        │     │   │
│  │  │                 │  │                 │  │                 │     │   │
│  │  │ • Order #123    │  │ • Order #120    │  │ • Order #118    │     │   │
│  │  │ • Order #124    │  │ • Order #121    │  │ • Order #119    │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TAS (Table Assistance)                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ Table List   │  │ Order View   │  │ Notifications│              │   │
│  │  │ - Status     │  │ - Details    │  │ - Alerts     │              │   │
│  │  │ - Requests   │  │ - History    │  │ - Messages   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TOTEM (Self-Service)                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ Menu Browser │  │ Cart         │  │ Confirmation │              │   │
│  │  │ - Categories │  │ - Items      │  │ - QR Code    │              │   │
│  │  │ - Items      │  │ - Total      │  │ - Status     │              │   │
│  │  │ - Details    │  │ - Checkout   │  │ - Receipt    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Sistema de Diseño

#### Paleta de Colores

```scss
// Tailwind Config - tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: {
        50: '#e3f2fd',
        100: '#bbdefb',
        500: '#2196f3',
        600: '#1976d2',
        700: '#1565c0',
        900: '#0d47a1',
      },
      success: {
        500: '#4caf50',
        600: '#43a047',
      },
      warning: {
        500: '#ff9800',
        600: '#f57c00',
      },
      error: {
        500: '#f44336',
        600: '#e53935',
      },
      kds: {
        pending: '#ffc107',    // Ámbar
        preparing: '#2196f3',  // Azul
        ready: '#4caf50',      // Verde
      }
    }
  }
}
```

#### Tipografía

- **Headings**: Inter, 600-700 weight
- **Body**: Inter, 400-500 weight
- **Monospace**: JetBrains Mono (para código/números)

---

## 13. DIAGRAMAS Y FLUJOS

### 13.1 Diagrama de Casos de Uso

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIAGRAMA DE CASOS DE USO                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌─────────────┐                                │
│                              │   ACTORES   │                                │
│                              └─────────────┘                                │
│                                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Admin   │  │  KTS     │  │  TAS     │  │   POS    │  │ Customer │      │
│  │(Gerente) │  │(Cocina)  │  │(Mesero)  │  │(Cajero)  │  │(Cliente) │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │             │             │             │             │
│       │             │             │             │             │             │
│       ▼             ▼             ▼             ▼             ▼             │
│  ╔═══════════════════════════════════════════════════════════════════╗     │
│  ║                    CASOS DE USO                                    ║     │
│  ╠═══════════════════════════════════════════════════════════════════╣     │
│  ║                                                                    ║     │
│  ║  [UC-01] Gestionar Restaurante ◄──────────────── Admin            ║     │
│  ║    └─> Configurar impuestos (include)                            ║     │
│  ║    └─> Configurar propinas (include)                             ║     │
│  ║                                                                    ║     │
│  ║  [UC-02] Gestionar Menú ◄────────────────────── Admin, Manager    ║     │
│  ║    └─> CRUD Categorías (include)                                 ║     │
│  ║    └─> CRUD Platos (include)                                     ║     │
│  ║    └─> Gestionar variantes (include)                             ║     │
│  ║                                                                    ║     │
│  ║  [UC-03] Gestionar Personal ◄────────────────── Admin             ║     │
│  ║    └─> Asignar roles (include)                                   ║     │
│  ║    └─> Resetear PIN (extend)                                     ║     │
│  ║                                                                    ║     │
│  ║  [UC-04] Procesar Pedido (KDS) ◄─────────────── KTS               ║     │
│  ║    └─> Ver órdenes pendientes                                    ║     │
│  ║    └─> Iniciar preparación                                       ║     │
│  ║    └─> Marcar como listo                                         ║     │
│  ║    └─> Notificar servicio (extend)                               ║     │
│  ║                                                                    ║     │
│  ║  [UC-05] Asistir Mesa (TAS) ◄────────────────── TAS               ║     │
│  ║    └─> Tomar orden                                               ║     │
│  ║    └─> Consultar estado                                          ║     │
│  ║    └─> Solicitar pago (extend)                                   ║     │
│  ║                                                                    ║     │
│  ║  [UC-06] Cobrar (POS) ◄──────────────────────── POS               ║     │
│  ║    └─> Ver órdenes activas                                       ║     │
│  ║    └─> Procesar pago                                            ║     │
│  ║    └─> Generar factura                                           ║     │
│  ║    └─> Gestionar turno (include)                                 ║     │
│  ║                                                                    ║     │
│  ║  [UC-07] Ordenar (Totem) ◄───────────────────── Customer          ║     │
│  ║    └─> Escanear QR                                               ║     │
│  ║    └─> Unirse a sesión                                           ║     │
│  ║    └─> Explorar menú                                             ║     │
│  ║    └─> Agregar al carrito                                        ║     │
│  ║    └─> Confirmar orden                                           ║     │
│  ║    └─> Pagar (extend)                                            ║     │
│  ║                                                                    ║     │
│  ╚═══════════════════════════════════════════════════════════════════╝     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Flujo de Órdenes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE ÓRDENES (Order Lifecycle)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CUSTOMER                TOTEM                 BACKEND              KDS     │
│     │                      │                      │                   │      │
│     │  1. Escanear QR      │                      │                   │      │
│     │─────────────────────>│                      │                   │      │
│     │                      │  2. Validar sesión   │                   │      │
│     │                      │─────────────────────>│                   │      │
│     │                      │                      │                   │      │
│     │  3. Mostrar menú     │                      │                   │      │
│     │<─────────────────────│                      │                   │      │
│     │                      │                      │                   │      │
│     │  4. Agregar items    │                      │                   │      │
│     │─────────────────────>│                      │                   │      │
│     │                      │                      │                   │      │
│     │  5. Confirmar orden  │                      │                   │      │
│     │─────────────────────>│  6. Crear orden      │                   │      │
│     │                      │─────────────────────>│                   │      │
│     │                      │                      │  7. Validar       │      │
│     │                      │                      │  8. Guardar en DB │      │
│     │                      │                      │                   │      │
│     │                      │  9. Confirmación     │                   │      │
│     │<─────────────────────│<─────────────────────│                   │      │
│     │                      │                      │  10. Emit WS      │      │
│     │                      │                      │──────────────────>│      │
│     │                      │                      │                   │      │
│     │                      │                      │                   │ 11.  │
│     │                      │                      │                   │ Mostrar│
│     │                      │                      │                   │      │
│     │                      │                      │  12. Status update│<─────│
│     │                      │                      │<──────────────────│ 14.  │
│     │                      │                      │                   │ Listo│
│     │  13. Notificación    │                      │                   │      │
│     │<─────────────────────│<─────────────────────│                   │      │
│     │                      │                      │                   │      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. ANEXOS Y REFERENCIAS

### 14.1 Variables de Entorno

| Variable | Requerida | Descripción | Ejemplo |
|----------|-----------|-------------|---------|
| `NODE_ENV` | Sí | Entorno (development/production) | `production` |
| `PORT` | No | Puerto del backend | `3000` |
| `MONGODB_URI` | Sí | URI de MongoDB | `mongodb://...` |
| `JWT_SECRET` | Sí | Secret para JWT (min 32 chars) | `super-secret-key` |
| `JWT_EXPIRES` | No | Expiración JWT | `8h` |
| `REDIS_URL` | Sí | URL de Redis | `redis://redis:6379` |
| `REDIS_PASSWORD` | Sí | Password Redis | `secure-password` |
| `FRONTEND_URL` | Sí | URL del frontend | `https://app.disherio.com` |

### 14.2 Documentos Generados por Agentes

Los siguientes documentos detallados fueron generados por el swarm de agentes:

| Documento | Líneas | Contenido |
|-----------|--------|-----------|
| `ARCHITECTURE_ANALYSIS.md` | 2,491 | Arquitectura, patrones, diagramas |
| `BACKEND_ANALYSIS.md` | 979 | Backend, Express, modelos |
| `FRONTEND_ANALYSIS.md` | 1,328 | Angular, componentes, servicios |
| `SHARED_LIBRARY_ANALYSIS.md` | 1,102 | Tipos, esquemas Zod, errores |
| `DATA_MODEL_ANALYSIS.md` | 1,758 | MongoDB, entidades, relaciones |
| `SECURITY_ANALYSIS.md` | 1,524 | JWT, CASL, rate limiting |
| `INFRASTRUCTURE_ANALYSIS.md` | 2,065 | Docker, CI/CD, despliegue |
| `UI_UX_ANALYSIS.md` | 890 | Vistas, diseño, flujos |

**Total: 12,137 líneas de documentación técnica**

### 14.3 Comandos Útiles

```bash
# Iniciar sistema
./quickstart.sh

# Ver logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongo

# Backup de base de datos
./scripts/backup.sh

# Restaurar backup
mongorestore --uri="mongodb://..." dump/

# Acceder a MongoDB
docker exec -it disherio_mongo mongosh -u admin -p

# Acceder a Redis
docker exec -it disherio_redis redis-cli -a password

# Reconstruir imágenes
docker-compose up -d --build

# Limpiar todo (⚠️  elimina datos)
docker-compose down -v
```

---

## CONCLUSIÓN

Esta documentación técnica completa cubre todos los aspectos de la plataforma **DisherIo**:

1. **Arquitectura:** Monolito modular con separación clara de responsabilidades
2. **Backend:** Express 5 + TypeScript con patrones Repository y Service
3. **Frontend:** Angular 21 con Signals y Standalone Components
4. **Base de Datos:** MongoDB 7 con Mongoose, modelo multi-tenant
5. **Seguridad:** JWT + CASL + Rate Limiting + TLS 1.3
6. **Infraestructura:** Docker Compose + Caddy + Prometheus/Grafana
7. **Calidad:** Tests unitarios e integración, cobertura > 80%

El sistema está diseñado para ser escalable, seguro y mantenible, con un stack tecnológico moderno y mejores prácticas de la industria.

---

*Documentación generada el 2026-04-05 por swarm de 8 agentes especializados*  
*Total: 12,137 líneas de análisis técnico académico*
