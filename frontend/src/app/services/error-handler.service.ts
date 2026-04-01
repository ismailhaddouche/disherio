import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { NotificationService } from '../core/services/notification.service';
import {
  ErrorCode,
  ErrorContext,
  ValidationError,
  AppError,
  ServerErrorResponse,
  getUserFriendlyMessage,
} from '../types/error.types';
import { authStore } from '../store/auth.store';

/**
 * Servicio para manejar errores de forma centralizada
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  /**
   * Maneja errores HTTP
   */
  handleHttpError(error: HttpErrorResponse, context?: ErrorContext): void {
    const appError = this.mapHttpErrorToAppError(error);
    
    // Log del error
    this.logError(error, context);

    // Mostrar notificación al usuario
    const userMessage = context?.userMessage || getUserFriendlyMessage(appError.code);
    this.showErrorNotification(userMessage, appError);

    // Manejar errores específicos
    this.handleSpecificErrorCases(error, appError);
  }

  /**
   * Maneja errores de validación
   */
  handleValidationError(errors: ValidationError[], context?: ErrorContext): void {
    const errorMessages = errors.map((e) => `${e.field}: ${e.message}`).join('\n');
    
    const appError: AppError = {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Error de validación',
      details: errorMessages,
      timestamp: new Date(),
    };

    this.logError(new Error(errorMessages), context);
    
    const userMessage = context?.userMessage || getUserFriendlyMessage(ErrorCode.VALIDATION_ERROR);
    this.showErrorNotification(userMessage, appError);
  }

  /**
   * Maneja errores generales
   */
  handleError(error: Error, context?: ErrorContext): void {
    const appError = this.mapErrorToAppError(error);
    
    this.logError(error, context);
    
    const userMessage = context?.userMessage || getUserFriendlyMessage(appError.code);
    this.showErrorNotification(userMessage, appError);
  }

  /**
   * Log de errores - puede extenderse para enviar a servicio de logging
   */
  logError(error: Error, context?: ErrorContext): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      component: context?.component,
      action: context?.action,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log a consola en desarrollo
    // @ts-ignore - import.meta.env is available in Vite but not in standard TypeScript
    const isDev = typeof (import.meta as any).env !== 'undefined' && 
                  // @ts-ignore
                  ((import.meta as any).env['NODE_ENV'] === 'development' || !(import.meta as any).env['PROD']);
    if (isDev) {
      console.error('[ErrorHandler]', errorLog);
    }

    // Aquí se podría enviar a un servicio de logging externo
    // this.sendToLoggingService(errorLog);
  }

  /**
   * Muestra notificación de error al usuario
   */
  private showErrorNotification(message: string, error: AppError): void {
    this.notificationService.error(message, 5000);
  }

  /**
   * Mapea un HttpErrorResponse a AppError
   */
  private mapHttpErrorToAppError(error: HttpErrorResponse): AppError {
    // Error de red (sin conexión)
    if (error.error instanceof ProgressEvent || error.status === 0) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Error de conexión',
        timestamp: new Date(),
      };
    }

    // Mapear por código de estado HTTP
    const code = this.mapStatusCodeToErrorCode(error.status);
    const serverError = error.error as ServerErrorResponse;

    return {
      code,
      message: serverError?.message || error.message || 'Error desconocido',
      details: this.extractErrorDetails(error),
      timestamp: new Date(),
    };
  }

  /**
   * Mapea un Error general a AppError
   */
  private mapErrorToAppError(error: Error): AppError {
    // Detectar errores de red
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }

    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message || 'Error desconocido',
      timestamp: new Date(),
    };
  }

  /**
   * Mapea código de estado HTTP a ErrorCode
   */
  private mapStatusCodeToErrorCode(status: number): ErrorCode {
    switch (status) {
      case 401:
        return ErrorCode.AUTH_ERROR;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 429:
        return ErrorCode.RATE_LIMIT;
      case 500:
      case 502:
      case 503:
      case 504:
        return ErrorCode.SERVER_ERROR;
      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }

  /**
   * Extrae detalles del error para debugging
   */
  private extractErrorDetails(error: HttpErrorResponse): string | undefined {
    if (typeof error.error === 'string') {
      return error.error;
    }
    
    if (error.error && typeof error.error === 'object') {
      return JSON.stringify(error.error, null, 2);
    }

    return undefined;
  }

  /**
   * Maneja casos específicos de error (redirecciones, etc.)
   */
  private handleSpecificErrorCases(httpError: HttpErrorResponse, appError: AppError): void {
    switch (appError.code) {
      case ErrorCode.AUTH_ERROR:
        authStore.clearAuth();
        this.router.navigate(['/login']);
        break;

      case ErrorCode.FORBIDDEN:
        this.router.navigate(['/unauthorized']);
        break;

      case ErrorCode.NOT_FOUND:
        // Opcional: redirigir a página 404
        // this.router.navigate(['/not-found']);
        break;

      case ErrorCode.RATE_LIMIT:
        // El usuario ya fue notificado, podría implementarse retry automático
        break;

      case ErrorCode.SERVER_ERROR:
        // Podría implementarse lógica de reintentos
        break;
    }
  }
}
