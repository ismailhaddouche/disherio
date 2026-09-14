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
  revision: number;
}

let refreshRequest$: Observable<RefreshResult> | null = null;

function isAuthenticationError(error: HttpErrorResponse): boolean {
  const errorCode = error.error?.errorCode;
  return error.status === 401
    || errorCode === ErrorCode.UNAUTHORIZED
    || errorCode === ErrorCode.INVALID_TOKEN
    || errorCode === ErrorCode.SESSION_EXPIRED;
}

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
          revision: authStore.revision(),
        })),
        finalize(() => {
          refreshRequest$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true })
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
    // Already on /login: stay put so an existing returnUrl query param survives.
    if (currentUrl.includes('/login')) {
      return;
    }
    void router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
  };

  const clearRejectedSession = (error: HttpErrorResponse, revision: number): void => {
    if (isAuthenticationError(error) && authStore.revision() === revision) {
      authStore.clearAuth();
      navigateToLogin();
    }
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes(`${environment.apiUrl}/auth/`);
      // Public totem endpoints use an ephemeral session token, not a staff JWT.
      // Their 401s are handled inline by the totem component; never attempt a
      // staff refresh or redirect to /login for them.
      const isPublicTotem = req.url.startsWith(`${environment.apiUrl}/totems/menu/`);

      // An expired access token is precisely when the refresh cookie is needed.
      // The presence of UI context permits an attempt; the server validates it.
      if (isAuthenticationError(error) && !isAuthEndpoint && !isPublicTotem && authStore.user()) {
        const authRevision = authStore.revision();
        return refreshSession(rawHttp).pipe(
          catchError((refreshError: HttpErrorResponse) => {
            clearRejectedSession(refreshError, authRevision);
            return throwError(() => refreshError);
          }),
          switchMap(({ accepted, revision }) => {
            if (!accepted || authStore.revision() !== revision) {
              return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Session ended' }));
            }
            // A business or transport failure of the retry does not invalidate
            // the refreshed session. A late rejection must not clear a new login.
            return next(req).pipe(
              catchError((retryError: HttpErrorResponse) => {
                clearRejectedSession(retryError, revision);
                return throwError(() => retryError);
              })
            );
          })
        );
      }

      // Auth endpoints (login/refresh) surface their 401 to the caller so the
      // login page can show the error; redirecting here would drop returnUrl.
      if (isAuthenticationError(error) && !isAuthEndpoint && !isPublicTotem) {
        authStore.clearAuth();
        navigateToLogin();
      }
      return throwError(() => error);
    })
  );
};
