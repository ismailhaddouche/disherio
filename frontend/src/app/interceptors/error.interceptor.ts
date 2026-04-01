import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, Observable, timer } from 'rxjs';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ErrorCode, getUserFriendlyMessage } from '../types/error.types';
import { authStore } from '../store/auth.store';

/**
 * Número máximo de reintentos para errores de red
 */
const MAX_RETRIES = 3;

/**
 * Delay inicial entre reintentos (ms)
 */
const RETRY_DELAY = 1000;

/**
 * Interceptor de errores HTTP
 * Maneja errores específicos por código de estado y proporciona mensajes amigables
 */
export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const errorHandler = inject(ErrorHandlerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Determinar el tipo de error
      const errorCode = determineErrorCode(error);

      // Manejar según el código de estado
      switch (error.status) {
        case 0:
          handleNetworkError(error, errorHandler);
          break;

        case 401:
          handleUnauthorized(error, router, errorHandler);
          break;

        case 403:
          handleForbidden(error, router, errorHandler);
          break;

        case 404:
          handleNotFound(error, errorHandler, req);
          break;

        case 422:
          handleValidationError(error, errorHandler);
          break;

        case 429:
          handleRateLimit(error, errorHandler);
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

      // Re-lanzar el error para que los componentes puedan manejarlo si es necesario
      return throwError(() => error);
    })
  );
};

/**
 * Determina el código de error basado en la respuesta
 */
function determineErrorCode(error: HttpErrorResponse): ErrorCode {
  if (error.status === 0) return ErrorCode.NETWORK_ERROR;
  if (error.status === 401) return ErrorCode.AUTH_ERROR;
  if (error.status === 403) return ErrorCode.FORBIDDEN;
  if (error.status === 404) return ErrorCode.NOT_FOUND;
  if (error.status === 422) return ErrorCode.VALIDATION_ERROR;
  if (error.status === 429) return ErrorCode.RATE_LIMIT;
  if (error.status >= 500) return ErrorCode.SERVER_ERROR;
  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Maneja errores de red (sin conexión)
 */
function handleNetworkError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  console.error('[ErrorInterceptor] Network error:', error);
  errorHandler.handleHttpError(error, {
    action: 'network_request',
    userMessage: getUserFriendlyMessage(ErrorCode.NETWORK_ERROR),
  });
}

/**
 * Maneja errores 401 - No autorizado
 */
function handleUnauthorized(error: HttpErrorResponse, router: Router, errorHandler: ErrorHandlerService): void {
  console.error('[ErrorInterceptor] Unauthorized:', error);
  
  // Limpiar autenticación
  authStore.clearAuth();
  
  // Notificar al usuario
  errorHandler.handleHttpError(error, {
    action: 'authentication',
    userMessage: getUserFriendlyMessage(401),
  });

  // Redirigir al login solo si no estamos ya en esa página
  if (!router.url.includes('/login')) {
    router.navigate(['/login'], { 
      queryParams: { returnUrl: router.url }
    });
  }
}

/**
 * Maneja errores 403 - Prohibido
 */
function handleForbidden(error: HttpErrorResponse, router: Router, errorHandler: ErrorHandlerService): void {
  console.error('[ErrorInterceptor] Forbidden:', error);
  
  errorHandler.handleHttpError(error, {
    action: 'authorization',
    userMessage: getUserFriendlyMessage(403),
  });

  // Redirigir a página de no autorizado
  router.navigate(['/unauthorized']);
}

/**
 * Maneja errores 404 - No encontrado
 */
function handleNotFound(
  error: HttpErrorResponse, 
  errorHandler: ErrorHandlerService,
  req: HttpRequest<unknown>
): void {
  console.error('[ErrorInterceptor] Not found:', error);
  
  errorHandler.handleHttpError(error, {
    action: 'resource_lookup',
    component: req.url,
    userMessage: getUserFriendlyMessage(404),
  });
}

/**
 * Maneja errores 422 - Error de validación
 */
function handleValidationError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  console.error('[ErrorInterceptor] Validation error:', error);
  
  const validationErrors = error.error?.errors || [];
  
  if (validationErrors.length > 0) {
    errorHandler.handleValidationError(validationErrors, {
      action: 'form_validation',
    });
  } else {
    errorHandler.handleHttpError(error, {
      action: 'form_validation',
      userMessage: getUserFriendlyMessage(ErrorCode.VALIDATION_ERROR),
    });
  }
}

/**
 * Maneja errores 429 - Rate limit
 */
function handleRateLimit(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  console.error('[ErrorInterceptor] Rate limit:', error);
  
  const retryAfter = error.headers.get('Retry-After');
  const message = retryAfter 
    ? `Demasiadas solicitudes. Por favor espera ${retryAfter} segundos.`
    : getUserFriendlyMessage(429);

  errorHandler.handleHttpError(error, {
    action: 'rate_limited_request',
    userMessage: message,
  });
}

/**
 * Maneja errores del servidor (5xx)
 */
function handleServerError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  console.error('[ErrorInterceptor] Server error:', error);
  
  errorHandler.handleHttpError(error, {
    action: 'server_request',
    userMessage: getUserFriendlyMessage(error.status) || getUserFriendlyMessage(ErrorCode.SERVER_ERROR),
  });
}

/**
 * Maneja errores genéricos
 */
function handleGenericError(error: HttpErrorResponse, errorHandler: ErrorHandlerService): void {
  console.error('[ErrorInterceptor] Generic error:', error);
  
  errorHandler.handleHttpError(error, {
    action: 'http_request',
  });
}

/**
 * Función auxiliar para reintentar peticiones con backoff exponencial
 * Nota: Esta función puede usarse en componentes específicos si se necesita retry
 */
export function retryWithBackoff<T>(
  operation: () => Observable<T>,
  maxRetries = MAX_RETRIES,
  delayMs = RETRY_DELAY
): Observable<T> {
  let retries = 0;

  const tryOperation = (): Observable<T> => {
    return operation().pipe(
      catchError((error: HttpErrorResponse) => {
        // Solo reintentar errores de red o 5xx
        if (error.status === 0 || error.status >= 500) {
          retries++;
          if (retries <= maxRetries) {
            console.log(`[ErrorInterceptor] Retrying... attempt ${retries}/${maxRetries}`);
            return timer(delayMs * Math.pow(2, retries - 1)).pipe(
              // Recursivamente intentar de nuevo
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              catchError(_ => tryOperation())
            ) as Observable<T>;
          }
        }
        return throwError(() => error);
      })
    );
  };

  return tryOperation();
}
