# ADR-001: Folder Structure

**Status:** Implemented

## Context

The codebase needed a consistent structure that would allow the backend and frontend to grow independently while keeping concerns separated and making navigation predictable for any developer.

## Decision

Adopt a layered backend and a feature-oriented frontend, as documented in the
architecture overview.

### Backend

Each architectural concern has its own directory. The normal HTTP dependency
flow is `routes` → `controllers` → `services`, with repositories and models
providing persistence. Socket handlers are separate entry points. Repositories
own reusable queries and aggregations; direct model access remains where the
current implementation needs an atomic filter, transaction lock, or a query for
which no repository exists.

```
backend/src/
  config/         External service connections (DB, Socket.IO, logger, i18n)
  controllers/    HTTP handlers — parse request, call service, send response
  routes/         Express routers with middleware chains
  services/       Business logic and orchestration
  repositories/   Reusable persistence and aggregation queries
  models/         Mongoose schemas
  middlewares/    Auth, RBAC, validation, rate limiting, error handling
  sockets/        Socket.IO event handlers
  abilities/      CASL permission rules
  schemas/        Zod request validation schemas
  utils/          Transactions, security, calculations, and profiling
  seeders/        Database seeding
  __tests__/      Tests
```

### Frontend

Grouped by feature under `features/`. Shared code lives in `shared/`. Global
singleton state lives in `store/`. Framework configuration and dependency
injection live in `core/`.

```
frontend/src/app/
  components/     Application-level components
  core/           Guards, interceptors, services, CASL factory
  features/       One directory per application feature
  interceptors/   Application-wide error interception
  shared/         Reusable components, directives, pipes
  store/          Signal-based global stores
  services/       API and WebSocket service wrappers
  types/          Frontend-specific contracts
```

### Shared package

The `shared/` directory at the project root contains Zod schemas and TypeScript interfaces that are consumed by both backend and frontend.

```
shared/
  errors/         Shared error codes and HTTP status mapping
  schemas/        Zod schemas for public domain contracts
  types/          Shared TypeScript model contracts
  index.ts        Package exports
```

## Consequences

- Developers can locate any piece of logic by following the layer name
- HTTP, real-time, business, and persistence concerns have predictable entry
  points
- Tests can replace repositories or external boundaries where the affected path
  uses them
- A feature changes only the layers and contracts required by its behavior
- The shared package requires a build step before either backend or frontend can consume updated types
