# Frontend

Angular 21 application for DisherIo. Serves the POS, KDS, TAS, totem ordering, and admin interfaces.

## Development server

```bash
npm install --legacy-peer-deps
npm start
```

The app runs at `http://localhost:4200`. It expects the backend API at `http://localhost:3000` (configured in `src/environments/environment.ts`).

## Build

```bash
npm run build
```

Output goes to `dist/frontend/browser/`. In production this directory is served by Caddy inside the Docker container.

## Tests

```bash
npm test
```

Uses Vitest. Test files follow the `*.spec.ts` naming convention.

## Key files

| File | Purpose |
|------|---------|
| `src/app/app.routes.ts` | Route definitions with lazy loading and permission guards |
| `src/app/app.config.ts` | Angular providers: router, HttpClient with JWT interceptor, animations |
| `src/app/store/auth.store.ts` | Authentication state (Angular Signals) |
| `src/app/store/kds.store.ts` | Kitchen item state |
| `src/app/store/cart.store.ts` | Shopping cart state |
| `src/app/core/interceptors/jwt.interceptor.ts` | Adds `withCredentials: true` to every HTTP request and handles 401 redirects |
| `src/app/core/guards/auth.guard.ts` | Redirects unauthenticated users to `/login` |
| `src/app/core/guards/role.guard.ts` | Redirects users without the required permission to `/unauthorized` |
| `src/app/services/socket/socket.service.ts` | Socket.IO client wrapper |
| `src/environments/environment.ts` | API and WebSocket URLs for development |
| `src/environments/environment.prod.ts` | API and WebSocket URLs for production |

## Permissions and routing

Each route that requires a specific role uses `roleGuard` with a `permissions` data field:

```typescript
{
  path: 'kds',
  loadComponent: () => import('./features/kds/kds.component'),
  canActivate: [authGuard, roleGuard],
  data: { permissions: ['KTS'] }
}
```

The `authStore.hasPermission(perm)` helper returns a computed signal that updates reactively when the user logs in or out.

## Authentication flow

1. User submits credentials on `/login`
2. Backend sets an `auth_token` HttpOnly cookie and returns the user object in the response body
3. Frontend stores user info (not the token) in `localStorage` with an expiry timestamp
4. Every HTTP request includes the cookie automatically (`withCredentials: true`)
5. On logout, frontend calls `POST /api/auth/logout` (cookie cleared by server) and clears `localStorage`
6. On 401 response, the interceptor clears local user state and redirects to `/login`
