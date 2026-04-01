import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Estrategia de Lazy Loading:
 * 
 * 1. Cada feature tiene su propio archivo de rutas (*.routes.ts)
 * 2. Los módulos se cargan bajo demanda (loadChildren/loadComponent)
 * 3. Los guards se aplican a nivel de feature para proteger rutas
 * 4. Preloading: Los módulos marcados con data: { preload: true } se cargan
 *    después de la carga inicial de la aplicación
 */

export const routes: Routes = [
  // Public routes - Auth Module (lazy loaded)
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  
  // Public route: Menu totem (acceso por QR)
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
      
      // TAS Module (lazy loaded con preloading)
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
