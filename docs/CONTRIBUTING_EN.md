# Contribution Guide — Disher.io

Thank you for your interest in contributing to Disher.io! This document establishes guidelines for collaborating effectively on the project.

---

## Code of Conduct

When participating in this project, you commit to maintaining a respectful and constructive environment. No form of harassment, discrimination, or toxic behavior will be tolerated.

---

## How to Contribute

### 1. Report a Bug

Open an **Issue** on GitHub with the `bug` label and include:

- Clear description of the problem.
- Steps to reproduce.
- Expected behavior vs. actual behavior.
- Screenshots or relevant logs.
- Environment: operating system, architecture (AMD64/ARM64), Docker version.

### 2. Propose an Enhancement

Open an **Issue** with the `enhancement` label describing:

- The current problem or limitation.
- Your proposed solution.
- Alternatives you've considered.

### 3. Submit a Pull Request

1. **Fork** the repository.
2. **Create a branch** from `main` with a descriptive name:
   ```bash
   git checkout -b feat/feature-name
   git checkout -b fix/bug-description
   ```
3. Make your changes following the project conventions (see below).
4. **Ensure tests pass** before submitting.
5. Open a **Pull Request** against `main` with a clear description of the changes.

---

## Development Environment Setup

### Requirements

- **Node.js** >= 20
- **Docker** >= 24.0.0 and **Docker Compose** >= 2.20.0
- **Git**

### Local Installation

```bash
# Clone the repository
git clone https://github.com/ismailhaddouche/disherio.git
cd disherio

# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npx ng serve
```

### Run Tests

```bash
# Backend tests (Jest + mongodb-memory-server)
cd backend
npm test
```

---

## Code Conventions

### General Style

- **Language**: TypeScript throughout the project (frontend and backend).
- **Indentation**: 4 spaces.
- **Quotes**: single (`'`) in TypeScript/JavaScript.
- **Semicolons**: mandatory.
- **Maximum line width**: 100 characters (Prettier).

### Frontend (Angular 21)

- Use **Signals** for reactive state management (not RxJS for local state).
- **Standalone components** — no `NgModule` usage.
- Separate logic into **ViewModels** (`*.viewmodel.ts`) and keep components lightweight.
- All user-visible strings must use **ngx-translate** (`| translate` in templates, `translate.instant()` in code).
- Add translation keys in **both** files: `es.json` and `en.json`.
- Follow **Material Design 3** design system with the project's CSS classes (`md-*`, `btn-primary`, `text-*`).

### Backend (Node.js + Express 5)

- **ESModules** (`import/export`), not CommonJS.
- Linting with **ESLint**: run `npm run lint` before submitting changes.
- Use **optimistic concurrency control** (`__v`) for write operations in MongoDB.
- All routes must handle errors and return consistent HTTP responses.

### Commits

We follow **Conventional Commits**:

```
type(scope): brief description

Examples:
feat(pos): add split payment by equal parts
fix(kds): prevent duplicate order updates
docs(readme): update firewall section with port 443
refactor(auth): simplify JWT validation middleware
style(store-config): align form grid spacing
test(api): add integration tests for order endpoints
```

**Allowed types**: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`, `perf`, `ci`.

---

## Project Structure

```
disherio/
├── frontend/          # Angular 21 (Signals, standalone components)
│   └── src/
│       ├── app/
│       │   ├── components/   # Functional modules (dashboard, pos, kds...)
│       │   ├── services/     # Shared services
│       │   └── core/         # Constants, guards, interceptors
│       └── assets/i18n/      # Translations (es.json, en.json)
├── backend/           # Node.js 20 + Express 5 + MongoDB
│   └── src/
│       ├── routes/           # REST endpoints
│       ├── models/           # Mongoose schemas
│       └── middleware/       # Auth, error handling
├── docs/              # Technical documentation
├── install.sh         # Automated installer
├── show-dns.sh        # DNS configuration viewer
├── backup.sh          # Backup script
├── docker-compose.prod.yml
├── Caddyfile          # Reverse proxy configuration
└── .env.example       # Environment variable reference
```

---

## Internationalization (i18n)

Disher.io supports **Spanish** and **English**. If you add user-visible text:

1. Add the key in `frontend/src/assets/i18n/es.json`.
2. Add the equivalent translation in `frontend/src/assets/i18n/en.json`.
3. Use `{{ 'SECTION.KEY' | translate }}` in templates or `this.translate.instant('SECTION.KEY')` in code.

**Do not leave hardcoded strings** in templates.

---

## Pull Request Checklist

Before submitting your PR, verify:

- [ ] Code compiles without errors: `npx ng build --configuration=production`
- [ ] Backend tests pass: `cd backend && npm test`
- [ ] No linting warnings: `cd backend && npm run lint`
- [ ] Translations exist in both languages (es/en).
- [ ] Commits follow Conventional Commits convention.
- [ ] PR description clearly explains what changes and why.

---

## License

By contributing to Disher.io, you agree that your contributions will be distributed under the same **MIT** license as the project.
