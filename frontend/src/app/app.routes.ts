import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Lazy-loading strategy:
 *
 * 1. Each feature owns its route file (*.routes.ts).
 * 2. Features load on demand through loadChildren/loadComponent.
 * 3. Guards protect routes at feature level.
 * 4. Routes marked with data: { preload: true } load after startup.
 */

export const routes: Routes = [
  // Public routes - Auth Module (lazy loaded)
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  // Public totem menu route accessed through a QR code.
  {
    path: 'menu/:qr',
    loadComponent: () => import('./features/totem/totem.component').then(m => m.TotemComponent),
  },

  // Protected routes with layout
  {
    path: '',
    loadComponent: () => import('./shared/components/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      // Admin Module (lazy loaded with preloading)
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
        canActivate: [roleGuard],
        data: { preload: true, permissions: ['ADMIN'] },
      },

      // POS Module (lazy loaded with preloading)
      {
        path: 'pos',
        loadChildren: () => import('./features/pos/pos.routes').then(m => m.POS_ROUTES),
        data: { preload: true, permissions: ['POS', 'ADMIN'] },
      },

      // KDS Module (lazy loaded with preloading)
      {
        path: 'kds',
        loadChildren: () => import('./features/kds/kds.routes').then(m => m.KDS_ROUTES),
        data: { preload: true, permissions: ['KTS', 'ADMIN'] },
      },

      // TAS feature (lazy loaded with preloading).
      {
        path: 'tas',
        loadChildren: () => import('./features/tas/tas.routes').then(m => m.TAS_ROUTES),
        data: { preload: true, permissions: ['TAS', 'POS', 'ADMIN'] },
      },

      // Default redirect
      { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },
    ]
  },

  // Wildcard redirect
  { path: '**', redirectTo: 'login' },
];
