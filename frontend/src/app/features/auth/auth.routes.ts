import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  // Redirect root to login for unauthenticated users
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('../login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('../unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent),
  },
];
