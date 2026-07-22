# Development Guide

This guide defines the local development and verification workflow for DisherIo.
Use it before opening a PR, pushing to `main`, or changing frontend/backend contracts.

---

## Prerequisites

- Node.js 24
- npm 11+
- Docker with Compose v2
- Google Chrome or Chromium for Angular/Karma tests

Install workspace dependencies from the repository root:

```bash
npm install
```

If workspace links are stale after changing shared types, rebuild the shared package:

```bash
npm run build --workspace=shared
```

---

## Local Services

The hardened base Compose file does not publish MongoDB, Redis, or the backend
to host ports. It also requires generated secret files and the MongoDB keyfile.
For a complete runnable local stack, generate those assets first:

```bash
./infrastructure/scripts/configure.sh
# Select: local
./infrastructure/scripts/verify.sh
docker compose up -d --build --wait
```

This serves the built application through Caddy at the configured `CADDY_PORT`
(4200 by default). It is the supported way to exercise the complete topology.
Running `docker compose up mongo redis` alone does not make those services
reachable by a backend process running directly on the host.

For live source development, the Angular server uses `/api` and `/socket.io`
through `frontend/proxy.conf.json` and normally listens at
`http://localhost:4200`. A host-run backend (`npm run dev --workspace=backend`)
requires a separately provisioned loopback-only MongoDB replica set and Redis
that match the non-production environment variables. Do not publish an
unauthenticated development database on a non-loopback interface.

If the backend is not reachable, frontend login/API calls show proxy
`ECONNREFUSED`. That is acceptable for isolated UI work, but not for an
end-to-end login check.

---

## Required Verification

Run these commands from the repository root unless noted otherwise:

```bash
npm run build
npm run lint
npm run docs:check
npm run test --workspace=backend
npm run test --workspace=frontend
```

Expected results:

- `npm run build` completes for `shared`, `backend`, and `frontend`.
- Backend Jest tests pass. Integration suites may be skipped unless `MONGODB_URI_TEST` is configured.
- Frontend Karma tests report the current full suite count with no failures.
- ESLint rejects explicit `any` in production TypeScript; only test/spec mocks
  have the documented exception.
- Documentation checks validate local links, every Express method/path in the
  API reference, empty sensitive examples, and known stale security claims.

The frontend test script returns a non-zero status for assertion failures,
browser disconnects, and launcher errors; CI must not suppress that status.

---

## Frontend Build Standards

Angular is configured with:

- Standalone components
- Strict templates
- OnPush change detection
- Lazy feature routes
- `@angular/build:application`

Keep these rules:

- Import services/types with paths relative to `src/app`, for example `../types` from `src/app/core/services`.
- Use existing service wrappers (`DishService`, `CategoryService`, etc.) instead of injecting `HttpClient` directly inside feature components.
- Remove unused standalone imports. Angular reports them as `NG8113`.
- Do not use optional chaining on non-nullable template values. Angular reports this as `NG8107`.
- Keep `@disherio/shared` in `allowedCommonJsDependencies` until the shared package is published as ESM.

---

## Frontend Test Notes

Karma runs with `ChromeNoSandbox` from `frontend/karma.conf.js`.

Tests may intentionally simulate HTTP and service worker failures, so console output can include messages such as:

- `Http failure response for /api/dishes`
- `Error loading restaurant`
- `Failed to check for updates`
- `Failed to apply update`

These are not blockers if Karma exits successfully with `TOTAL: ... SUCCESS`.

Do not let tests perform real page reloads. If code calls `window.location.reload()`, wrap it behind a method that can be spied on in specs.

---

## Login Validation

The login form is template-driven and must block empty submissions locally:

- Inputs must remain `required`.
- Submit button must be disabled while the form is invalid or loading.
- `login(form: NgForm)` must return before API calls when `form.invalid`.

This prevents empty submissions from hitting `/api/auth/login` and creating noisy proxy/backend errors.

---

## Commit Checklist

Before committing:

```bash
git status --short
npm run build
npm run lint
npm run docs:check
npm run test --workspace=backend
npm run test --workspace=frontend
```

Only stage files related to the change. Do not mix unrelated formatting or generated output.
