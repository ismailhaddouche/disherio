# Architecture

DisherIo uses a layered architecture with clear separation between HTTP handling, business logic, and data access.

---

## Layers

```
Controllers / Routes
      |
   Services          (business logic, orchestration)
      |
  Repositories       (MongoDB queries only)
      |
    Models           (Mongoose schemas)
```

**Rule:** each layer only talks to the one directly below it. Controllers never touch models directly; services never import Mongoose directly.

---

## Backend structure

```
backend/src/
  config/           Database, Socket.IO, logger, i18n
  controllers/      HTTP request handlers (thin — delegate to services)
  routes/           Route definitions and middleware chains
  services/         Business logic and orchestration
  repositories/     MongoDB query implementations
  models/           Mongoose schemas and interfaces
  middlewares/      Auth, RBAC, validation, rate limiting, error handling
  sockets/          Socket.IO event handlers (KDS, POS)
  abilities/        CASL permission definitions
  schemas/          Zod validation schemas
  utils/            Tax calculator, async handler wrapper
  seeders/          Database seeder (admin user, restaurant, role)
  __tests__/        Unit and integration tests
```

---

## Frontend structure

```
frontend/src/app/
  core/
    casl/           Ability factory
    guards/         Auth guard, role guard
    interceptors/   HTTP interceptor (withCredentials)
  features/
    admin/          Administrative dashboard
    kds/            Kitchen Display System
    login/          Login page
    pos/            Point of Sale
    tas/            Table Assistance Service
    totem/          Self-service QR ordering
    unauthorized/   403 page
  shared/
    components/     Image uploader
    directives/     CASL permission directive
    pipes/          Localize, currency format
  services/
    socket/         Socket.IO client wrapper
    staff/          Staff API calls
    totem/          Totem API calls
  store/
    auth.store.ts   Authentication state (Angular Signals)
    cart.store.ts   Shopping cart state
    kds.store.ts    Kitchen items state
    theme.store.ts  Theme preference
  app.routes.ts     Route definitions with lazy loading and guards
  app.config.ts     Application configuration and providers
```

---

## Key decisions

### Authentication: HttpOnly cookies

JWTs are stored in HttpOnly cookies set by the server on login. JavaScript never has access to the raw token, eliminating XSS-based token theft. CORS is configured with `credentials: true` and a strict `origin` list. Socket.IO connections receive the cookie automatically when `withCredentials: true` is set.

The frontend stores user information (role, permissions, name) in `localStorage` for persistence across page reloads, but the token itself stays in the cookie.

### State management: Angular Signals

Global state is managed with Angular Signals and computed values. No external state library is used. The `authStore`, `kdsStore`, and `cartStore` are module-level singleton objects exported directly, avoiding the overhead of an Angular service while remaining testable.

### Repository pattern

Every model has a corresponding repository class that encapsulates all queries. Services import repositories, not models. This makes unit-testing services straightforward (swap the repository with a mock) and isolates any future database migration to the repository layer.

### Validation: Zod

All incoming HTTP request bodies are validated with Zod schemas in a `validate` middleware before reaching the controller. The `shared/` package contains Zod schemas that are reused between backend and frontend where applicable.

### RBAC: CASL

Route-level authorization uses `requirePermission(action, subject)` middleware backed by CASL. Permission definitions live in `abilities/`. The permission strings embedded in the JWT (`ADMIN`, `POS`, `TAS`, `KTS`) map directly to CASL abilities.

---

## Architecture Decision Records

- [ADR-001](ADR-001-folder-structure.md) — Folder structure
- [ADR-002](ADR-002-repository-pattern.md) — Repository pattern
- [ADR-003](ADR-003-state-management.md) — Frontend state management
- [ADR-004](ADR-004-validation-types.md) — Shared validation and types
