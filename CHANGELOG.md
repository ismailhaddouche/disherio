# Changelog

All notable changes to this project will be documented in this file.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
