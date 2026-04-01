import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const KDS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./kds.component').then(m => m.KdsComponent),
    canActivate: [roleGuard],
    data: { permissions: ['KTS', 'ADMIN'] },
  },
];
