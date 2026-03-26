import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { authStore } from '../../store/auth.store';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = authStore.token();
  
  console.log('[JWT Interceptor] URL:', req.url, 'Token exists:', !!token);
  
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  } else {
    console.warn('[JWT Interceptor] No token available for request:', req.url);
  }
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('[JWT Interceptor] Error:', error.status, error.message, 'URL:', req.url);
      if (error.status === 401) {
        authStore.clearAuth();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
