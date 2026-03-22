# Changelog

Todas las modificaciones notables de este proyecto serán documentadas en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.0] - 2024-05-24

Esta es una versión mayor que introduce mejoras significativas en la seguridad, robustez y compatibilidad de la plataforma, preparándola para despliegues en producción a gran escala.

### Añadido

-   **Autenticación en Base de Datos:** Se ha implementado autenticación obligatoria en MongoDB. Las credenciales se generan y gestionan automáticamente a través del script de instalación.
-   **Soporte Multi-Arquitectura:** Las imágenes de Docker ahora se construyen para `amd64` y `arm64`, permitiendo el despliegue nativo en servidores estándar y dispositivos ARM como Raspberry Pi.
-   **Detección de Cloud Mejorada:** El script `install.sh` ahora detecta la IP pública en AWS, GCP y Azure consultando sus servicios de metadatos, con fallback a un servicio externo.
-   **Backups y Exportación de Logs:** El script `configure.sh` ahora incluye opciones para crear backups de la base de datos de forma segura y exportar logs de diagnóstico de todos los servicios.
-   **Rotación de Logs Automática:** Todos los servicios están configurados con una política de rotación de logs para evitar el consumo excesivo de disco.
-   **Usuarios No-Root:** Todos los contenedores ahora se ejecutan con usuarios sin privilegios para mejorar la seguridad.

### Cambiado

-   **Instalador (`install.sh`):**
    -   Ahora es idempotente: detecta instalaciones existentes y ofrece una opción de "Actualizar".
    -   Verifica la compatibilidad con Docker Compose v2 y los requisitos mínimos de RAM.
    -   Reutiliza los secretos (`JWT_SECRET`, credenciales de DB) en las actualizaciones para no invalidar configuraciones.
-   **Configurador (`configure.sh`):**
    -   El comando de backup ahora incluye autenticación con la base de datos.
    -   Se ha añadido validación de entrada para el "Slug URL" del restaurante.
-   **Docker (`docker-compose.yml`):**
    -   Se ha unificado la configuración en un solo archivo `docker-compose.yml`, eliminando los archivos específicos de entorno (`.prod`, `.rpi`).
    -   Se ha añadido la configuración de logging con rotación para todos los servicios.
-   **Documentación:**
    -   `README.md`: Actualizado para reflejar las nuevas características y el flujo de instalación simplificado.
    -   `docs/QUICK_START.md`: Centrado en el instalador automatizado y el nuevo script `configure.sh`.
    -   `docs/MAINTENANCE.md`: Actualizado con los nuevos procedimientos de backup, logging y actualización.
    -   `docs/ARCHITECTURE.md`: Refleja la nueva capa de seguridad en la base de datos y la configuración de contenedores.

---

## [1.3.0] - 2026-02-23

### Security
- **JWT now stored in `httpOnly` cookie** instead of `localStorage` — token is inaccessible to JavaScript, eliminating XSS token theft risk.
- **Login brute-force protection** — dedicated rate limiter on `POST /api/auth/login`: max 10 attempts per 15 minutes per IP.
- **Input validation on all routes** — `express-validator` added to every backend route handler. Required fields, enum values, and MongoDB IDs are validated before any database query. Invalid input returns a structured `400` error.
- **`POST /api/auth/logout`** endpoint added — clears the auth cookie server-side on logout.
- **`npm audit --omit=dev`** added to CI pipeline — fails the build if HIGH or CRITICAL vulnerabilities are found in production dependencies.
- **Production dependencies audited and patched** — fixed 1 production vulnerability (`qs` ReDoS). All production deps are now clean.

### Changed
- `backend/src/middleware/auth.middleware.js` — reads token from `disher_token` cookie first, falls back to `Authorization: Bearer` header for API clients.
- `backend/src/routes/auth.routes.js` — login sets `Set-Cookie` header, response no longer returns the token in the body.
- `backend/src/app.js` — added `cookie-parser` middleware; added `CORS_ORIGIN` env var support for multi-origin dev setups; login-specific rate limiter registered before global limiter.
- `frontend/src/app/services/auth.service.ts` — `UserSession` no longer includes `token`; localStorage key renamed `disher_session`; all `fetch()` calls use `credentials: 'include'`; logout calls the server logout endpoint.
- `frontend/src/app/services/auth.interceptor.ts` — simplified: adds `withCredentials: true` to all `HttpClient` requests instead of injecting `Authorization` header.
- `frontend/src/app/services/communication.service.ts` — Socket.io connection uses `withCredentials: true`.
- `backend/src/index.js` — logger outputs structured JSON in production, human-readable format in development.
- `.env.example` — added `CORS_ORIGIN` variable documentation.

### Added
- `cookie-parser` and `express-validator` added to backend dependencies.

---

## [1.2.0] - 2026-02-23

### Added
- `SECURITY.md` — vulnerability disclosure policy, security architecture, operator best practices checklist.
- `docs/ARCHITECTURE.md` — full system design document with ASCII diagrams, data model tables, auth flow, and design decisions.
- `.github/ISSUE_TEMPLATE/bug_report.md` — structured bug report template.
- `.github/ISSUE_TEMPLATE/feature_request.md` — structured feature request template.
- `.github/PULL_REQUEST_TEMPLATE.md` — PR checklist template.
- Trivy security scanner in CI now fails on HIGH and CRITICAL severity vulnerabilities.

### Changed
- `README.md` — complete rewrite: ASCII architecture diagram, role-based feature breakdown, tech stack table, deployment modes, full project structure, documentation index.
- `CONTRIBUTING.md` — expanded with setup instructions, coding standards, testing guide, branch naming, PR process, and bug reporting format.
- `docs/API.md` — full endpoint reference with request/response examples for all routes including orders, checkout, QR, logs, history, and tickets.
- `docs/QUICK_START.md` — reorganized with prerequisite check, all installation options (automated, manual, development), first-setup workflow, module reference table, and extended troubleshooting table.
- `docs/MAINTENANCE.md` — expanded with backup rotation, disaster recovery steps, MongoDB performance section, disk usage monitoring, and emergency password reset procedure.

### Fixed
- ESLint `no-unused-vars` rule now correctly ignores arguments prefixed with `_` (fixes `_next` warning in `app.js` error handler).
- Security scan workflow no longer fails when GitHub Code Scanning is not enabled on the repository.

---

## [1.1.0] - 2026-02-23

### Added
- Created `.prettierrc` for project-wide formatting consistency.
- Added `CONTRIBUTING.md` and `CHANGELOG.md` for professional standards.
- Improved `README.md` with modern structure and badges.
- Added specialized `.dockerignore` files for backend and frontend.

### Changed
- Protected administrative and operational routes in `orders.routes.js` with `verifyToken`.
- Updated backend error handling middleware for cleaner signatures.
- Enhanced CI/CD `docker-build.yml` with lowercasing for GHCR and security permissions.

### Fixed
- Fixed critical `User` model pre-save hook causing seed failures.
- Fixed `KDSComponent` compilation errors in the frontend.
- Resolved backend linting errors (quotes, unused variables).

---

## [1.0.0] - 2024-01-01

- Initial public release of Disher.io.
- Single-tenant architecture migration complete.
- Real-time KDS and POS modules.
- QR Totem generation.
