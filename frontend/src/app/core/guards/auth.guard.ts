import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authStore } from '../../store/auth.store';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (authStore.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
