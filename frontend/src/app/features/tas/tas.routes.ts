import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const TAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tas.component').then(m => m.TasComponent),
    canActivate: [roleGuard],
    data: { permissions: ['TAS', 'POS', 'ADMIN'] },
  },
];
