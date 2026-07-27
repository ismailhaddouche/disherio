# AGENTS.md

## Project Context

- Project name: DisherIo
- Main technologies: Node.js 24, Express 5.2, MongoDB 7 + Mongoose 9.3 (replica set `rs0`), Redis 7, Socket.IO 4.8 (Redis adapter), Angular 21.2 (standalone, OnPush, strict templates), TailwindCSS 3.4, Zod 4.3 (shared schemas), CASL 6.8 (ABAC), TypeScript 5.9, Caddy 2, Docker Compose v2.
- Purpose: Integrated restaurant management platform with self-service ordering totem, kitchen display system (KDS), point-of-sale (POS), table assistance service (TAS), and an admin dashboard. Monorepo with `backend`, `frontend`, and `shared` workspaces.

## Conventions

- Response language: English
- Code style: ESLint flat config (typescript-eslint recommended) — backend via `backend/eslint.config.js`, frontend via `angular-eslint`. `--max-warnings=0` gate in CI. `@typescript-eslint/no-explicit-any` is `error` in production code (test/spec mocks excepted). Strict TypeScript everywhere; Angular strict templates, OnPush change detection, standalone components, lazy feature routes.
- Commit format: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `build`, `test`, `refactor`, `ci`, `perf`, `style`, `revert`) with a scope, e.g. `feat(backend): add redis-backed store for express-rate-limit`. Imperative mood, lowercase scope. Keep `README.md` and `docs/` in English.

## Rules for the Agent

1. Always read this file before making significant changes.
2. Do not modify files outside the scope of the task.
3. Run tests or checks when available.
4. Keep `README.md` and `docs/` up to date in English.
5. Never create `.kimi` files or `.kimi-code` directories; use this `AGENTS.md` for project configuration.

## Common Commands

Run from the repository root unless noted.

- Build (all workspaces): `npm run build` (runs `shared` → `backend` → `frontend`)
- Build shared only (after schema/type changes): `npm run build --workspace=shared`
- Lint (gate, `--max-warnings=0`): `npm run lint` (`lint:backend`, `lint:frontend`)
- Docs check (links, API paths, stale security claims): `npm run docs:check`
- Test backend (Jest, `--runInBand`): `npm run test --workspace=backend`
- Test frontend (Karma + ChromeNoSandbox, single run): `npm run test --workspace=frontend`
- Dev backend: `npm run dev --workspace=backend`
- Dev frontend: `npm run start --workspace=frontend` (serves at `http://localhost:4200` via `proxy.conf.json`)
- Full local stack: `./infrastructure/scripts/configure.sh` (select `local`) → `./infrastructure/scripts/verify.sh` → `docker compose up -d --build --wait`
- Operations: `bash scripts/install.sh {start|stop|restart|status|logs|backup|restore|update|uninstall|help}`

## Additional Notes

- Workspace layout: `shared` (types + Zod schemas + error codes, built before backend/frontend), `backend` (Express API + Socket.IO), `frontend` (Angular SPA). `@disherio/shared` is consumed via `file:../shared` and must stay in `allowedCommonJsDependencies` until published as ESM.
- Frontend wrappers (`DishService`, `CategoryService`, `TotemService`, `SessionActionsService`, ...) are the supported way to call HTTP; do not inject `HttpClient` directly in feature components.
- Shared package excludes `__tests__` from the build; Zod schema unit tests live in `shared/__tests__/`.
- Keep `README.md` and `docs/` up to date in English when changing contracts, endpoints, or security-relevant behavior.

