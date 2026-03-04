# Contributing to Disher.io

Thank you for your interest in contributing to Disher.io! This document covers everything you need to know to submit a bug fix, feature, or improvement.

---

## Code of Conduct

All contributors are expected to maintain a respectful, inclusive, and collaborative environment. Harassment, discrimination, or hostile behavior of any kind will not be tolerated.

---

## Ways to Contribute

- **Bug reports** — Found something broken? Open an issue.
- **Feature requests** — Have an idea? Open an issue to discuss it first.
- **Code contributions** — Bug fixes, new features, test coverage, documentation.
- **Documentation** — Improvements to docs, guides, or in-code comments.
- **Translations** — Help make Disher.io available in more languages.

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for running the full stack)
- Git

### Local Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/disherio.git
cd disherio

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Start the Development Environment

**Option A — Full Docker stack:**
```bash
docker compose up -d --build
```

**Option B — Run services individually:**
```bash
# Terminal 1 — Backend (with auto-reload)
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm start
```

The backend seeds a sample database automatically in development mode.
Default credentials: `admin` / `password`

---

## Project Structure

```
backend/src/
├── middleware/    JWT auth middleware
├── models/        Mongoose data models
├── routes/        Express route handlers
├── __tests__/     Jest tests
└── app.js         Express app setup

frontend/src/app/
├── components/    Angular components (one per module/view)
├── services/      Auth, communication, theme services
└── app.routes.ts  Route definitions and guards
```

---

## Coding Standards

### Formatting

We use [Prettier](https://prettier.io) for consistent formatting across the project. Your editor should pick up the `.prettierrc` configuration automatically.

Before submitting, format your code:
```bash
# Backend
cd backend && npx prettier --write "src/**/*.js"

# Frontend
cd frontend && npx prettier --write "src/**/*.ts"
```

### Linting

Run the linter before submitting a PR:
```bash
# Backend
cd backend && npm run lint

# Frontend
cd frontend && npm run lint
```

Fix any errors before submitting. Warnings should be addressed where practical.

### Backend Conventions

- Use `async/await` for all async operations
- Return consistent error shapes: `{ error: "message" }` with appropriate HTTP status codes
- Emit Socket.io events after successful write operations
- Do not log sensitive data (passwords, tokens)
- Prefix intentionally unused function arguments with `_` (e.g., `_next`)

### Frontend Conventions

- Use Angular standalone components (no NgModule)
- Use Angular Signals for reactive state
- Keep components focused — business logic belongs in services
- Use TypeScript strict mode — avoid `any`

---

## Testing

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Backend tests with coverage
cd backend && npm test -- --coverage
```

### Writing Tests

All new backend features should include tests in `backend/src/__tests__/`.

Use `supertest` for HTTP endpoint tests and `jest` for unit tests. A MongoDB Memory Server is available for database tests without a real MongoDB instance.

```javascript
// Example test structure
const request = require('supertest');
const app = require('../app');

describe('POST /api/auth/login', () => {
  it('returns 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
```

---

## Submitting a Pull Request

### 1. Create a Branch

Use a descriptive branch name:

```bash
git checkout -b fix/login-rate-limit
git checkout -b feature/table-categories
git checkout -b docs/update-api-reference
```

Branch naming conventions:
- `fix/` — Bug fixes
- `feature/` — New features
- `docs/` — Documentation only
- `refactor/` — Code cleanup with no behavior change
- `test/` — Adding or improving tests

### 2. Make Your Changes

- Keep commits focused and atomic
- Write meaningful commit messages
- Add or update tests where applicable
- Update documentation if your change affects behavior

### 3. Verify Locally

```bash
# Run linter
cd backend && npm run lint
cd frontend && npm run lint

# Run tests
cd backend && npm test

# Build frontend
cd frontend && npm run build -- --configuration=production
```

### 4. Submit Against `develop`

Open a PR against the `develop` branch (not `main`). `main` is reserved for stable releases.

In your PR description, include:
- What the change does
- Why it's needed
- How to test it
- Any related issues (`Closes #123`)

### 5. Wait for Review

The CI pipeline will run automatically. A maintainer will review your PR. Be responsive to feedback — PRs with no activity for 30 days may be closed.

---

## Reporting Bugs

Use the [GitHub Issue tracker](https://github.com/ismailhaddouche/disherio/issues) and include:

- **Steps to reproduce** — Exact steps to trigger the bug
- **Expected behavior** — What should have happened
- **Actual behavior** — What actually happened
- **Environment** — OS, Node.js version, Docker version, browser (if frontend)
- **Logs** — Paste relevant output from `docker compose logs backend`

---

## Proposing Features

Open an issue before writing code for a new feature. This avoids duplicated work and ensures the feature aligns with the project direction.

Describe:
- The problem you're solving
- Your proposed solution
- Alternatives you considered

---

## Questions

If you have questions that aren't bugs or features, feel free to open a GitHub Discussion or an issue tagged `question`.
