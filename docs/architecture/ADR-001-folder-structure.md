# ADR-001: Folder Structure

**Status:** Implemented

## Context

The codebase needed a consistent structure that would allow the backend and frontend to grow independently while keeping concerns separated and making navigation predictable for any developer.

## Decision

Adopt a feature-oriented layered structure for the backend and a feature-module structure for the frontend, as documented in the architecture overview.

### Backend

Each architectural layer has its own directory. The dependency direction is strict: `routes` → `controllers` → `services` → `repositories` → `models`. No layer imports from a layer above it.

```
backend/src/
  config/         External service connections (DB, Socket.IO, logger, i18n)
  controllers/    HTTP handlers — parse request, call service, send response
  routes/         Express routers with middleware chains
  services/       Business logic and orchestration
  repositories/   All database queries
  models/         Mongoose schemas
  middlewares/    Auth, RBAC, validation, rate limiting, error handling
  sockets/        Socket.IO event handlers
  abilities/      CASL permission rules
  schemas/        Zod request validation schemas
  utils/          Pure utility functions (tax, async wrapper)
  seeders/        Database seeding
  __tests__/      Tests
```

### Frontend

Grouped by feature under `features/`. Shared code lives in `shared/`. Global singleton state lives in `store/`. Framework configuration and DI lives in `core/`.

```
frontend/src/app/
  core/           Guards, interceptors, CASL factory
  features/       One directory per application feature
  shared/         Reusable components, directives, pipes
  store/          Signal-based global stores
  services/       API and WebSocket service wrappers
```

### Shared package

The `shared/` directory at the project root contains Zod schemas and TypeScript interfaces that are consumed by both backend and frontend.

```
shared/
  src/
    schemas/      Zod schemas for request/response validation
    index.ts      Barrel export
```

## Consequences

- Developers can locate any piece of logic by following the layer name
- Each layer is testable in isolation by substituting the layer below
- Adding a new feature requires touching predictable files (route, controller, service, repository, model)
- The shared package requires a build step before either backend or frontend can consume updated types
