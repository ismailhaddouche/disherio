import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { authStore } from '../../store/auth.store';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const required: string[] = route.data['permissions'] || [];
  const user = authStore.user();
  if (!user) return router.createUrlTree(['/login']);
  const hasRole = required.some((p) => user.permissions.includes(p));
  if (hasRole) return true;
  return router.createUrlTree(['/unauthorized']);
};
