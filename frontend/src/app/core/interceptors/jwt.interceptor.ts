import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { ErrorCode } from '@disherio/shared/errors';
import { authStore } from '../../store/auth.store';
import { environment } from '../../../environments/environment';
import { LoginResponse } from '../services/auth.service';

interface RefreshResult {
  response: LoginResponse;
  accepted: boolean;
}

let refreshRequest$: Observable<RefreshResult> | null = null;

function refreshSession(http: HttpClient): Observable<RefreshResult> {
  if (!refreshRequest$) {
    const authRevision = authStore.revision();
    refreshRequest$ = http
      .post<LoginResponse>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        map((response) => ({
          response,
          accepted: authStore.setAuthIfCurrent(
            response.user,
            Date.now() + response.expires_in_ms,
            authRevision
          ),
        })),
        finalize(() => {
          refreshRequest$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
  }
  return refreshRequest$;
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const rawHttp = new HttpClient(inject(HttpBackend));

  // Send cookies automatically with every request (HttpOnly auth_token cookie)
  req = req.clone({ withCredentials: true });

  // Single owner of 401 routing: navigate to /login preserving the current
  // URL as returnUrl so the user can resume their screen after re-auth. Skip
  // returnUrl when already on /login to avoid self-referential redirects.
  const navigateToLogin = (): void => {
    const currentUrl = router.url ?? '';
    if (currentUrl.includes('/login')) {
      void router.navigate(['/login']);
      return;
    }
    void router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorCode = error.error?.errorCode;
      const isAuthenticationError =
        error.status === 401 ||
        errorCode === ErrorCode.UNAUTHORIZED ||
        errorCode === ErrorCode.INVALID_TOKEN ||
        errorCode === ErrorCode.SESSION_EXPIRED;
      const isAuthEndpoint = req.url.includes(`${environment.apiUrl}/auth/`);
      // Public totem endpoints use an ephemeral session token, not a staff JWT.
      // Their 401s are handled inline by the totem component; never attempt a
      // staff refresh or redirect to /login for them.
      const isPublicTotem = req.url.startsWith(`${environment.apiUrl}/totems/menu/`);

      if (isAuthenticationError && !isAuthEndpoint && !isPublicTotem && authStore.isAuthenticated()) {
        return refreshSession(rawHttp).pipe(
          switchMap(({ accepted }) => {
            if (!accepted) {
              return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Session ended' }));
            }
            return next(req);
          }),
          catchError((refreshError: HttpErrorResponse) => {
            authStore.clearAuth();
            navigateToLogin();
            return throwError(() => refreshError);
          })
        );
      }

      if (isAuthenticationError && !isPublicTotem) {
        authStore.clearAuth();
        navigateToLogin();
      }
      return throwError(() => error);
    })
  );
};
