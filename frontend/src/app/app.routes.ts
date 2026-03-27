import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },
  {
    path: 'menu/:qr',
    loadComponent: () => import('./features/totem/totem.component').then((m) => m.TotemComponent),
  },
  
  // Protected routes with layout
  {
    path: '',
    loadComponent: () => import('./shared/components/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'kds',
        loadComponent: () => import('./features/kds/kds.component').then((m) => m.KdsComponent),
        canActivate: [roleGuard],
        data: { permissions: ['KTS', 'ADMIN'] },
      },
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/pos.component').then((m) => m.PosComponent),
        canActivate: [roleGuard],
        data: { permissions: ['POS', 'ADMIN'] },
      },
      {
        path: 'tas',
        loadComponent: () => import('./features/tas/tas.component').then((m) => m.TasComponent),
        canActivate: [roleGuard],
        data: { permissions: ['TAS', 'POS', 'ADMIN'] },
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
        canActivate: [roleGuard],
        data: { permissions: ['ADMIN'] },
      },
      { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },
    ]
  },
  { path: '**', redirectTo: 'login' },
];
