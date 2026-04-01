import { Routes } from '@angular/router';

export const TOTEM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./totem.component').then(m => m.TotemComponent),
  },
];
