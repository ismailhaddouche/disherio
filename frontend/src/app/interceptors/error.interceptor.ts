import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, Observable, retry, timer } from 'rxjs';
import { ErrorHandlerService } from '../services/error-handler.service';
import { I18nService } from '../core/services/i18n.service';
import { ErrorCode } from '../types/error.types';
import { environment } from '../../environments/environment';

/**
 * Maximum retry count for transient failures.
 */
const MAX_RETRIES = 3;

/**
 * Initial retry delay in milliseconds.
 */
const RETRY_DELAY = 1000;

/**
 * Public totem endpoints use an ephemeral session token, not a staff JWT.
 * Their 401s must never trigger a staff logout / redirect to /login — the
 * totem component handles those errors inline.
 */
function isPublicTotemRequest(req: HttpRequest<unknown>): boolean {
  return req.url.startsWith(`${environment.apiUrl}/totems/menu/`);
}

/**
 * HTTP error interceptor with status-specific user feedback.
 */
export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const errorHandler = inject(ErrorHandlerService);
  const i18n = inject(I18nService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Public totem requests carry an ephemeral session token, not a staff
      // session. Their errors are handled inline by the totem component, so
      // skip the global staff-auth handling entirely and just propagate.
      if (isPublicTotemRequest(req)) {
        return throwError(() => error);
      }

      // 401 handling is owned exclusively by jwtInterceptor (refresh attempt,
      // clearAuth, and navigation to /login). Surfacing it here too would
      // duplicate the clear/navigate side effects and race the two redirects.
      if (error.status === 401) {
        return throwError(() => error);
      }

      // Handle based on status code
      switch (error.status) {
        case 0:
          handleNetworkError(error, errorHandler);
          break;

        case 403:
          handleForbidden(error, errorHandler);
          break;

        case 404:
          handleNotFound(error, errorHandler, req);
          break;

        case 422:
          handleValidationError(error, errorHandler);
          break;

        case 429:
          handleRateLimit(error, errorHandler, i18n);
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          handleServerError(error, errorHandler);
          break;

        default:
          handleGenericError(error, errorHandler);
      }

      // Preserve the error for feature-level handlers.
      return throwError(() => error);
    })
  );
};

/**
 * Handle network failures.
 */
function handleNetworkError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  errorHandler.handleHttpError(error, {
    action: 'network_request',
    userMessage: errorHandler.getFallbackMessage(ErrorCode.NETWORK_ERROR),
  });
}

/**
 * Handle 403 Forbidden.
 */
function handleForbidden(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  errorHandler.handleHttpError(error, {
    action: 'authorization',
    userMessage: errorHandler.getFallbackMessage(ErrorCode.FORBIDDEN),
  });
}

/**
 * Handle 404 Not Found.
 */
function handleNotFound(
  error: HttpErrorResponse,
  errorHandler: ErrorHandlerService,
  req: HttpRequest<unknown>
): void {
  // Don't pass a generic userMessage: let the ErrorHandlerService use the
  // server-provided localized message (e.g. "No payment record found").
  errorHandler.handleHttpError(error, {
    action: 'resource_lookup',
    component: req.url,
  });
}

/**
 * Handle 422 validation errors. The backend contract reports validation
 * failures as 400 VALIDATION_ERROR, so no field-level extraction happens
 * here: let any server-provided message surface before the generic
 * validation fallback.
 */
function handleValidationError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  errorHandler.handleHttpError(error, {
    action: 'form_validation',
  });
}

/**
 * Handle 429 rate limiting.
 */
function handleRateLimit(
  error: HttpErrorResponse,
  errorHandler: ErrorHandlerService,
  i18n: I18nService
): void {
  const retryAfter = error.headers.get('Retry-After');
  const message = retryAfter
    ? i18n.translate('errors.rate_limited_retry').replace('{{seconds}}', retryAfter)
    : undefined;

  errorHandler.handleHttpError(error, {
    action: 'rate_limited_request',
    userMessage: message,
  });
}

/**
 * Handle server errors.
 */
function handleServerError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  // Don't pass a generic userMessage: let the server message surface first.
  errorHandler.handleHttpError(error, {
    action: 'server_request',
  });
}

/**
 * Handle all other errors (includes 400 business-logic errors like
 * ORDER_ALREADY_PAID, SESSION_NOT_ACTIVE, etc.).
 */
function handleGenericError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  // Don't pass a generic userMessage: let the ErrorHandlerService use the
  // server-provided localized message so specific errors are shown.
  errorHandler.handleHttpError(error, {
    action: 'http_request',
  });
}

/**
 * Retry transient requests with exponential backoff.
 */
export function retryWithBackoff<T>(
  operation: () => Observable<T>,
  maxRetries = MAX_RETRIES,
  delayMs = RETRY_DELAY
): Observable<T> {
  return operation().pipe(
    retry({
      count: maxRetries,
      delay: (error: HttpErrorResponse, retryCount: number) => {
        if (error.status !== 0 && error.status < 500) {
          return throwError(() => error);
        }
        return timer(delayMs * Math.pow(2, retryCount - 1));
      },
    })
  );
}
