---
memory_type: project_guidelines
scope: typescript, angular, nodejs
tags: [disherio, restaurant-management, angular, express, casl]
priority: 100
created: 2026-04-01
updated: 2026-04-01
includes:
  - ./.kimi/agents/stack-backend.md
  - ./.kimi/agents/stack-frontend.md
  - ./.kimi/agents/architecture.md
---

# 🍽️ DisherIo - Project Guidelines

> **Project:** DisherIo - Restaurant Management System  
> **Type:** Full-stack web application  
> **Stack:** Angular 21 + Node.js/Express + TypeScript + CASL  
> **Created:** 2026-04-01  
> **Maintainer:** Ismail Haddouche Rhali

---

## 🏗️ Architecture Overview

```
disherio/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── config/         # Configuration (DB, env)
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── models/         # Database models
│   │   ├── routes/         # API route definitions
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utilities
│   │   └── permissions/    # CASL ability definitions
│   └── tests/
├── frontend/               # Angular 21 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/       # Singleton services, guards, interceptors
│   │   │   ├── shared/     # Shared components, pipes, directives
│   │   │   ├── features/   # Feature modules (lazy loaded)
│   │   │   └── layouts/    # Layout components
│   │   └── environments/
│   └── e2e/
├── shared/                 # Shared types/contracts
├── docs/                   # Documentation
├── scripts/                # Build/deployment scripts
└── docker-compose.yml      # Docker orchestration
```

---

## 🎯 Development Guidelines

### Code Quality Standards

#### Backend (Node.js/TypeScript)
- ✅ **Always use strict TypeScript** (`strict: true` in tsconfig)
- ✅ **Use CASL for authorization** - Define abilities in `permissions/`
- ✅ **Service layer pattern** - Controllers thin, services fat
- ✅ **Async/await** - No callbacks, proper error handling
- ✅ **Environment validation** - Use `dotenv` + validation schema
- ✅ **Consistent error responses** - `{ success: boolean, data?: T, error?: string }`

#### Frontend (Angular)
- ✅ **Standalone components** - No NgModules (Angular 14+)
- ✅ **Signals for state** - Prefer signals over RxJS for simple state
- ✅ **Lazy loading** - Feature modules loaded on demand
- ✅ **OnPush change detection** - For performance
- ✅ **Strict null checks** - Enabled in tsconfig

### Testing Strategy
- **Unit tests:** Jest (backend), Jasmine/Karma (frontend)
- **Minimum coverage:** 70% for critical paths
- **E2E:** Cypress or Playwright for critical flows
- **API testing:** Jest + supertest

### Git Workflow
```bash
# Feature branch workflow
main
  └── feature/user-authentication
  └── fix/login-validation
  └── docs/api-documentation
```

- Branch naming: `feature/`, `fix/`, `docs/`, `refactor/`
- Commit message format: `type(scope): description`
- Squash merge to main

---

## 🔐 Security Guidelines

### Authentication & Authorization
- JWT tokens with refresh token rotation
- CASL for fine-grained permissions
- Role-based access control (RBAC)
- Password hashing with bcrypt (cost factor 12+)

### API Security
- Rate limiting on auth endpoints
- Helmet.js for security headers
- CORS properly configured
- Input validation with Zod or class-validator
- SQL injection prevention (parameterized queries)

### Frontend Security
- XSS prevention (Angular built-in + careful binding)
- CSRF protection
- Secure storage for tokens (httpOnly cookies preferred)
- Content Security Policy

---

## 🛠️ Common Commands

### Backend
```bash
cd backend
npm run dev          # Development server (ts-node-dev)
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Watch mode
npm run seed         # Seed database
```

### Frontend
```bash
cd frontend
npm start            # Development server (ng serve)
npm run build        # Production build
npm run test         # Unit tests
npm run test:watch   # Watch mode
npm run lint         # ESLint
```

### Docker
```bash
docker-compose up -d              # Start all services
docker-compose -f docker-compose.prod.yml up -d  # Production
docker-compose logs -f backend    # View backend logs
```

### Database
```bash
# MongoDB (assumed from mongoose patterns)
# Access via MongoDB Compass or:
mongosh "mongodb://localhost:27017/disherio"
```

---

## 📚 Domain Knowledge

### Core Entities
- **Restaurant:** Main business unit
- **User:** Staff members with roles
- **Menu:** Categories and items
- **Order:** Customer orders with items
- **Table:** Physical tables in restaurant
- **Reservation:** Table bookings

### User Roles & Permissions
| Role | Permissions |
|------|-------------|
| Super Admin | Full system access |
| Restaurant Admin | Manage single restaurant |
| Manager | Orders, reservations, reports |
| Waiter | Create orders, view menu |
| Kitchen | View orders, update status |

### CASL Ability Examples
```typescript
// can(Action.Manage, 'Order', { restaurantId: user.restaurantId })
// can(Action.Read, 'Menu', { isActive: true })
// can(Action.Update, 'Order', ['status'], { assignee: user.id })
```

---

## 🔄 API Conventions

### Response Format
```typescript
// Success
{
  "success": true,
  "data": { /* payload */ },
  "meta": { /* pagination, etc */ }
}

// Error
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* validation errors */ }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation)
- `401` - Unauthorized
- `403` - Forbidden (CASL check failed)
- `404` - Not Found
- `409` - Conflict (duplicate, etc)
- `500` - Internal Server Error

---

## 📝 Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/disherio
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
BCRYPT_ROUNDS=12
```

### Frontend (environment.ts)
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  wsUrl: 'ws://localhost:3000'
};
```

---

## 🚫 Project Rules

1. **NEVER** commit `.env` files with real credentials
2. **NEVER** disable auth checks in production
3. **ALWAYS** validate user input (backend and frontend)
4. **ALWAYS** add tests for new features
5. **ALWAYS** update documentation when changing architecture
6. **NEVER** expose stack traces in production errors
7. **ALWAYS** use parameterized queries (prevent SQL/NoSQL injection)
8. **NEVER** use `any` type in TypeScript without justification

---

## 🔗 Related Resources

- Repository: https://github.com/ismailhaddouche/disherio
- Backend API Docs: `./docs/api/`
- Frontend Architecture: `./docs/frontend/`
- Docker Setup: `./docs/deployment/`
- CASL Documentation: https://casl.js.org/
- Angular Style Guide: https://angular.io/guide/styleguide

---

## 📅 Recent Changes

### 2026-04-01
- Created comprehensive AGENTS.md with project guidelines
- Documented CASL authorization patterns
- Added Angular standalone components approach
- Defined API conventions and response formats

---

*Part of DisherIo Restaurant Management System*  
*Generated with kimi-init-agents v1.0*
