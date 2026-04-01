import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const POS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pos.component').then(m => m.PosComponent),
    canActivate: [roleGuard],
    data: { permissions: ['POS', 'ADMIN'] },
  },
];
