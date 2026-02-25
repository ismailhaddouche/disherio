import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService, UserRole } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
        return router.parseUrl('/login');
    }

    const requiredRole = route.data['role'] as UserRole;
    if (requiredRole && !auth.hasRole(requiredRole)) {
        // If authenticated but wrong role, redirect to their default or login
        return router.parseUrl('/login');
    }

    return true;
};
