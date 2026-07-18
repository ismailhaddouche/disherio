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

The frontend uses `/api` and `/socket.io` through `frontend/proxy.conf.json`.
For a complete local runtime, start backend dependencies first:

```bash
docker compose up -d mongo redis
```

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend:

```bash
cd frontend
npm start
```

The frontend development server runs on:

```text
http://localhost:4200
```

If the backend is not running, frontend login/API calls will show proxy `ECONNREFUSED`.
That is expected for UI-only checks, but not for end-to-end login verification.

---

## Required Verification

Run these commands from the repository root unless noted otherwise:

```bash
npm run build
npm run test --workspace=backend
npm run test --workspace=frontend
```

Expected results:

- `npm run build` completes for `shared`, `backend`, and `frontend`.
- Backend Jest tests pass. Integration suites may be skipped unless `MONGODB_URI_TEST` is configured.
- Frontend Karma tests report the current full suite count with no failures.

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

- Import services/types with paths relative to `src/app`, for example `../types` from `src/app/services`.
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
npm run test --workspace=backend
npm run test --workspace=frontend
```

Only stage files related to the change. Do not mix unrelated formatting or generated output.
