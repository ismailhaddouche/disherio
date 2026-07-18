# DisherIo Complete Technical Documentation

## Document Status

| Field | Value |
|-------|-------|
| Project | DisherIo Restaurant Management Platform |
| Document type | Consolidated technical reference |
| Language | English |
| Runtime baseline | Angular 21.2 and Node.js 24 |
| License | GNU Affero General Public License v3.0 only |

This document describes the current system at a high level. Executable source,
schemas, package manifests, Docker Compose files, and environment validation are
authoritative. Detailed contracts and procedures live in the focused documents
linked in the final section.

## 1. Product Scope

DisherIo is a multi-interface restaurant management platform. It coordinates
restaurant administration, point-of-sale operations, kitchen preparation,
table assistance, and public self-service ordering through one tenant-aware
backend and a real-time Angular application.

The product provides five primary interfaces:

- Admin: restaurant configuration, staff, roles, menu content, totems, settings,
  dashboard metrics, and recent item activity.
- POS: table sessions, customers, orders, tickets, split payments, payment
  history, session closure, reopening, and archiving.
- KDS: active kitchen items, preparation queues, station workflows, item-state
  transitions, and availability updates.
- TAS: waiter workflows, temporary table access, service items, customer calls,
  bills, cancellations, and payment coordination.
- Public Totem: QR-based menu access, customer identification, self-service
  ordering, live order status, waiter calls, and bill requests.

## 2. Technology Stack

| Layer | Implementation |
|-------|----------------|
| Frontend | Angular 21.2, standalone components, Angular Material 3/CDK, Signals, RxJS 7.8, Tailwind CSS 3.4, Socket.IO Client 4.8, CASL Angular 9, Zod 4.3 |
| Backend | Node.js 24, Express 5.2, strict TypeScript, Mongoose 9.3, Socket.IO 4.8, CASL 6.8, Zod 4.3 |
| Database | MongoDB 7 with replica set `rs0` |
| Shared state | Redis 7 for caching, Socket.IO pub/sub, refresh tokens, and access-token revocation |
| Security | HttpOnly cookies, JWT access tokens, rotating opaque refresh tokens, bcryptjs, Helmet, CORS, rate limiting, and Zod validation |
| Media | Multer 2 and Sharp 0.34 with content inspection, resizing, WebP conversion, and path protection |
| Observability | Pino logs, health endpoints, and an internal Prometheus-format exposition endpoint |
| Delivery | npm workspaces, multi-stage Docker images, Docker Compose, GitHub Actions, GHCR, and Caddy |
| Localization | English, Spanish, and French application catalogs; English technical documentation |

Package manifests are the source of truth for exact dependency versions.

## 3. Repository Structure

```text
DisherIO/
|-- backend/
|   |-- src/
|   |   |-- abilities/       CASL authorization definitions
|   |   |-- config/          environment and external-service configuration
|   |   |-- controllers/     HTTP request and response handling
|   |   |-- locales/         backend translation catalogs
|   |   |-- middlewares/     authentication, validation, security, rate limits
|   |   |-- models/          Mongoose schemas
|   |   |-- repositories/    persistence and aggregation queries
|   |   |-- routes/          Express route definitions
|   |   |-- schemas/         backend request validation
|   |   |-- services/        business rules and orchestration
|   |   |-- sockets/         POS, KDS, TAS, and public totem handlers
|   |   `-- utils/           transactions, security, calculations, profiling
|   `-- scripts/             database initialization and index verification
|-- frontend/
|   |-- public/              PWA assets and manifest
|   `-- src/
|       |-- app/
|       |   |-- components/  application-level components
|       |   |-- core/        guards, interceptors, CASL, services, and translations
|       |   |-- features/    login, admin, POS, KDS, TAS, and totem views
|       |   |-- interceptors/ application-wide error interception
|       |   |-- services/    domain and Socket.IO clients
|       |   |-- shared/      reusable components, directives, and pipes
|       |   |-- store/       signal-based state
|       |   `-- types/       frontend-specific contracts
|       |-- environments/    runtime endpoint configuration
|       `-- styles/          Material 3 theme and design tokens
|-- shared/                  shared Zod schemas, TypeScript types, error codes
|-- docs/                    English technical and operational documentation
|-- infrastructure/          deployment variants and configuration tools
|-- scripts/                 installation, maintenance, backup, and resource checks
`-- docker-compose*.yml      development and production topologies
```

## 4. Runtime Topology

```text
Browser or restaurant device
             |
             v
        Caddy :80/:443
         |      |       |
         |      |       `-- /uploads/* -> persistent upload volume
         |      `---------- /api/* and /socket.io/* -> backend:3000
         `----------------- Angular frontend
                                      |
                         +------------+------------+
                         |                         |
                     MongoDB                    Redis
                  persistence/rs0       cache, pub/sub, token state
```

Caddy is the only public entry point in production. MongoDB and Redis remain on
the internal Docker network. The backend exposes health and metrics endpoints
for orchestration and monitoring.

## 5. Domain Model

| Entity | Responsibility |
|--------|----------------|
| Restaurant | Tenant boundary and operational configuration |
| Staff | Authenticated employee, role, language, and theme preferences |
| Role | Named permission set used to build CASL abilities |
| Category | Localized menu grouping |
| Dish | Localized sellable item, price, variants, extras, allergens, image, availability, and production type |
| Totem | Permanent or temporary QR access point |
| TotemSession | Table lifecycle, order limits, totals, and archive state |
| Customer | Participant associated with a totem session |
| Order | Order container linked to a session and customer |
| ItemOrder | Immutable priced item snapshot and kitchen/service state |
| Payment | Full-payment or split-ticket data with restaurant and table history snapshots |

The normal item lifecycle is:

```text
ORDERED -> ON_PREPARE -> SERVED
```

Cancellation is a terminal transition and is permitted only from states
accepted by the shared state rules.

Table sessions use `STARTED -> COMPLETE -> PAID`. Closing moves a session to
`COMPLETE` and keeps it visible for payment. Reopening returns it to `STARTED`
only while no payment exists. Archiving settles every ticket, moves the session
to `PAID`, removes it from active POS/TAS views, and retains the payment in
history. If a completed session has no payment yet, archive creates one full
ticket in the same transaction. Temporary totems are removed after the terminal
transition, while the payment's table snapshot keeps the historical entry
queryable.

## 6. Backend Architecture

The backend uses a layered request flow:

```text
Route -> middleware -> controller -> service -> repository -> model
```

- Routes define the endpoint, authentication, permission, validation, and rate
  limit chain.
- Middleware rejects invalid or unauthorized input before business logic runs.
- Controllers translate HTTP input into service calls and return HTTP responses.
- Services implement business rules, tenant checks, transaction boundaries, and
  cross-repository orchestration.
- Repositories own MongoDB queries and aggregation pipelines.
- Models define persistence structure, validation, and indexes.

Controllers must not contain persistence queries or substantial business logic.
Services do not import Mongoose models directly when a repository exists.

### Request Validation

External input is validated with Zod before reaching services. Shared public
schemas belong in `shared/`; backend-only schemas remain in `backend/src/schemas`.
Validation failures use stable error codes and localized messages.

### Transactions

MongoDB runs with replica set `rs0` because multi-document operations use
transactions. Order creation, payment, session closure, and other coordinated
state changes must either complete atomically or roll back.

### Query Strategy

Repositories use aggregation pipelines for joins, grouped metrics, and kitchen
queues. Compound indexes support common tenant, session, state, and time-range
filters.
Read-only operations use lean results where document methods are unnecessary.
Query loops and `populate()` inside loops are prohibited.

## 7. Frontend Architecture

The frontend is an Angular standalone application. Feature routes are loaded
lazily, application components use `ChangeDetectionStrategy.OnPush`, and state
is modeled with Signals where synchronous state is sufficient.

RxJS remains appropriate for:

- HTTP request composition and cancellation.
- Socket.IO event streams.
- Time-dependent workflows.
- Interoperation with Angular APIs that expose observables.

Feature components use existing domain clients instead of injecting
`HttpClient` directly. Authentication state is derived from the current user and
server session; raw tokens are never stored in browser storage.

### Material Design System

Angular Material 3 and the CDK are the component foundation. The theme is
generated in `frontend/src/styles.scss`, with application tokens under
`frontend/src/styles/tokens/`.

The visual contract is:

- Compact, restrained, task-focused layouts.
- Material system colors and DisherIo tokens instead of isolated values.
- Low elevation, subtle borders, and limited decorative surfaces.
- Responsive tables and forms without unreadably small controls.
- WCAG 2.2 AA keyboard, focus, labeling, contrast, and target-size behavior.
- Equivalent light and dark themes.
- User-visible text sourced from translation catalogs.

## 8. Authentication and Authorization

### Authentication

- Access tokens are signed JWTs with a default lifetime of 15 minutes.
- Refresh tokens are 32-byte opaque random values with a default lifetime of
  seven days.
- Access and refresh tokens are stored in HttpOnly cookies.
- HTTPS cookies use `Secure` and `SameSite=Strict`.
- Refresh-token identifiers are hashed before storage in Redis, keyed by
  `refresh:<staffId>:<sha256(token)>`.
- Refresh tokens rotate on use; reuse detection revokes the entire family.
- Logout revokes the current refresh-token family and blocklists the active access
  token for its remaining lifetime. Access-token revocation is fail-closed:
  if Redis is unreachable, authenticated requests are rejected because
  revocation cannot be verified.
- Access tokens carry a staff authorization version that is checked against
  MongoDB on each authenticated HTTP request and Socket.IO handshake. Security-
  relevant staff changes invalidate existing access tokens immediately.
- Four-digit staff PIN lookup keys are unique per restaurant. Staff create and
  update operations also check legacy records before accepting a PIN.
- Refresh-token lifecycle events are emitted as structured Pino logs and
  consumed from the log stream.
- Concurrent frontend refresh attempts are coalesced into one request.

### Authorization

CASL abilities are built from authenticated staff permissions. Protected HTTP
and Socket.IO operations must enforce both the required action/subject pair and
restaurant ownership.

| Permission group | Primary access |
|------------------|----------------|
| ADMIN | Full management access |
| POS | Orders, payments, sessions, customers, and totems |
| TAS | Table service, customers, service items, and payment coordination |
| KTS | Kitchen orders, item states, availability, and KDS access |

Authorization checks are server-side requirements. Hiding a frontend control is
not an authorization boundary.

## 9. API and Error Contracts

The HTTP API is mounted at `/api`. Main route groups cover authentication,
dishes, categories, orders, payments, totems, sessions, restaurants, staff,
roles, customers, dashboard data, and uploads.

Successful endpoints return their domain payload. Errors routed through the
global error handler follow this shape:

```json
{
  "error": "Localized error message",
  "errorCode": "VALIDATION_ERROR",
  "status": 400,
  "details": {}
}
```

`details` is optional. Production responses never expose stack traces, database
errors, secrets, or internal exception messages.

Body-validation middleware returns field errors under `errors`. Rate-limit
responses add `retryAfter`, and authentication can return an `errorCode`-only
`401` for an invalid or missing refresh credential.

The complete route and event inventory is maintained in `api-contracts.md`.

## 10. Real-Time Communication

Socket.IO uses the same origin and cookies as HTTP. Event families are grouped
by interface:

- `pos:*` for point-of-sale workflows.
- `kds:*` for kitchen workflows.
- `tas:*` for table-assistance workflows.
- `totem:*` for public customer workflows.

Authenticated sockets inherit staff identity and abilities from the server-side
handshake. Public totem connections present the totem QR token in the handshake
`auth` payload (`{ publicTotem: true, qr: '<token>' }`); the server validates the
QR against the database before accepting the connection, then the per-session
`session_token` is re-validated on every `totem:*` event. Public totem sockets
never receive staff permissions.

Every scan joins the active session for its table. If no active session exists,
the permanent QR creates a fresh session even when the table has historical
closed sessions. Later socket events use the customer identity bound during
the verified join and cannot replace it in their payload.

The QR is a bearer credential, not proof of physical presence. A deployment
whose entry point is restricted to the trusted restaurant LAN blocks reuse from
outside that network, provided no public tunnel or port forwarding exists. An
Internet-facing deployment, including a public cloud server, cannot distinguish
a table scan from a photographed QR used remotely. `session_token`, TLS, and
rate limits do not change that property. Proximity-sensitive public deployments
require an additional session-specific code, staff approval, or trusted local
network assertion; DisherIo does not currently implement such a presence gate.

Redis pub/sub distributes Socket.IO events when multiple backend instances are
running. Event handlers validate payloads, tenant scope, and state transitions
before persisting or broadcasting changes.

POS and TAS connections also join restaurant-scoped rooms. Close, cancel,
reopen, and archive events update all connected clients for that restaurant,
including clients that have not selected the affected session. Close/cancel
events include the persisted target state. Archive is the single terminal
paid-session event; duplicate paid/bill-paid aliases are not emitted.

## 11. Security Controls

The production security baseline includes:

- Helmet security headers.
- Explicit CORS origins with credential support.
- Strict environment validation and no production secret fallbacks.
- Authentication, API, mutation, upload, QR, and QR-probing rate limits.
- Zod validation for untrusted input.
- CASL authorization and tenant ownership checks.
- Password hashing with configurable bcrypt rounds.
- HttpOnly authentication cookies and refresh-token rotation.
- Upload MIME, signature, size, path, and image-content validation.
- Pino redaction for credentials and authentication data.
- Non-root backend containers.
- Internal-only database and Redis networks.

Secrets, tokens, passwords, PINs, cookies, connection strings, and private keys
must never appear in logs, source control, metrics labels, or error responses.
Request logs and HTTP metrics use bounded Express route templates rather than
raw URLs or query values.

## 12. Rate Limits

| Scope | Current limit |
|-------|---------------|
| Failed authentication | 5 attempts per 15 minutes |
| General API | 1000 requests per 15 minutes |
| Strict mutations | 20 requests per 15 minutes |
| Uploads | 10 uploads per hour |
| Public QR | 30 requests per minute |
| QR token probing | 10 attempts per 15 minutes |

Executable values in `backend/src/middlewares/rateLimit.config.ts` are
authoritative.

## 13. Localization

The application supports English, Spanish, and French user interfaces. The
frontend selects a saved preference, the browser language, or English for an
unauthenticated initial session. Restaurant and staff preferences determine the
authenticated interface language, while backend localization falls back to
Spanish. English remains the required language for source code, comments, logs,
tests, identifiers, and technical documentation.

Frontend text is stored in
`frontend/src/app/core/services/i18n.service.ts`. Backend response text is
stored under `backend/src/locales/`. Components and services must not embed
user-visible text directly when a translation key can be used.

## 14. Media Pipeline

Uploads pass through a controlled processing pipeline:

1. Multer enforces request and file-size limits.
2. File signatures and supported media types are validated.
3. Paths and generated names prevent traversal and collisions.
4. Sharp decodes the image, applies size constraints, and converts the result
   to WebP.
5. Only the processed output is exposed through the upload volume.

Original untrusted filenames are never used as persistent server paths.

## 15. Observability

Pino produces structured application logs. Docker health checks and the backend
health routes provide the operational signals required by the bundled deployment.
The backend keeps a Prometheus-format endpoint for optional external tooling,
but the project does not bundle Grafana, a Prometheus server, Alertmanager, or
exporter containers. The default Caddy configuration does not publish
`/metrics`; an operator-provided collector must reach it through a separately
secured internal path.

The backend provides:

- `/health` for general health information.
- `/health/live` for process liveness.
- `/health/ready` for dependency readiness.
- `/health/simple` for lightweight checks.
- `/metrics` for optional internal scraping by operator-provided tooling.

Health endpoints must avoid exposing credentials or sensitive topology details.

## 16. Deployment

Production uses multi-stage Docker images and Docker Compose. Caddy terminates
TLS, serves the Angular application and uploads, and proxies API and Socket.IO
traffic to the backend.

Persistent volumes store:

- MongoDB data.
- Redis data where persistence is enabled.
- Processed uploads.
- Caddy certificates and state.

The primary operational entry point is `scripts/install.sh`. It supports guided
installation, status inspection, logs, backups, restarts, and maintenance.

GHCR uses two stable package names:

- `ghcr.io/ismailhaddouche/disherio/backend`
- `ghcr.io/ismailhaddouche/disherio/frontend`

Successful `main` builds publish multi-platform images and retain only the five
records required by the latest image group.

## 17. Backup and Recovery

Database backups use authenticated `mongodump`. A backup is not considered
valid until its archive can be inspected and restored into an isolated test
environment.

Recovery procedures must verify:

- MongoDB authentication and replica-set initialization.
- Application-user credentials.
- Redis availability.
- Upload-volume consistency.
- Backend readiness before accepting traffic.

## 18. Testing and Quality Gates

Backend tests use Jest and Supertest. Frontend tests use Jasmine/Karma with
headless Chrome. CI performs strict TypeScript checks and tests in separate
backend and frontend jobs. ESLint runs only when a workspace provides an ESLint
configuration. Non-pull-request runs build and publish the container images.
The staging and production jobs currently report deployment intent but do not
perform a deployment or a real readiness request.

Standard verification from the repository root:

```bash
npm ci
npm run build
npm run test --workspace=backend
npm run test --workspace=frontend
```

Production deployment validation also includes:

```bash
docker compose --env-file .env -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.prod.yml up -d --wait
curl --fail "${FRONTEND_URL}/health/ready"
```

Every behavior change requires proportionate tests. API, Socket.IO, environment,
security, and deployment changes also require documentation updates.

## 19. Environment Contract

`.env.example` is the environment-variable catalog. Production requires, at
minimum:

- `NODE_ENV=production`
- `MONGODB_URI` with `replicaSet=rs0`
- MongoDB root and application credentials
- `REDIS_URL` and `REDIS_PASSWORD`
- `JWT_SECRET` and `JWT_REFRESH_SECRET`
- `JWT_EXPIRES` and `JWT_REFRESH_EXPIRES`
- `FRONTEND_URL`
- `TRUST_PROXY=true` behind Caddy or another trusted proxy
- `BCRYPT_ROUNDS` between 10 and 15

Production Compose configuration must fail when required secrets are absent.

## 20. Documentation Map

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE.md` | Detailed runtime topology, stack, security, and design patterns |
| `api-contracts.md` | HTTP routes and Socket.IO event contracts |
| `DEVELOPMENT.md` | Local development and verification workflow |
| `DEPLOYMENT.md` | Deployment modes, infrastructure topology, and operations |
| `INSTALL.md` | Installation requirements and procedures |
| `CONFIGURE.md` | Runtime configuration and maintenance |
| `ERRORS.md` | Troubleshooting and operational diagnostics |
| `ERROR_CODES.md` | Shared application error-code reference |
| `UNINSTALL.md` | Safe decommissioning procedure |
| `architecture/ADR-001-folder-structure.md` | Folder-structure decision |
| `architecture/ADR-002-repository-pattern.md` | Repository-pattern decision |
| `architecture/ADR-003-state-management.md` | Frontend state-management decision |
| `architecture/ADR-004-validation-types.md` | Shared validation and type decision |

All files under `docs/` use English. Application localization is maintained in
runtime translation catalogs rather than duplicated technical documents.

## 21. License and Attribution

DisherIo is licensed under the GNU Affero General Public License v3.0 only
(`AGPL-3.0-only`). Copies and modified versions must preserve the license and
copyright notices and provide the corresponding source code under the same
license, including when a modified version is offered to users over a network.

Copyright (C) Ismail Haddouche Rhali.
