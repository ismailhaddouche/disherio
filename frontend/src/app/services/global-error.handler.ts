import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';
import { ErrorCode } from '../types/error.types';

/**
 * Manejador global de errores para Angular
 * Captura errores no manejados en la aplicación
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorHandler = inject(ErrorHandlerService);

  handleError(error: Error | unknown): void {
    // Prevenir loops de error
    try {
      console.error('[GlobalErrorHandler] Unhandled error:', error);

      // Convertir a Error si es necesario
      const normalizedError = this.normalizeError(error);

      // Log y manejo del error
      this.errorHandler.handleError(normalizedError, {
        component: 'Global',
        action: 'unhandled_error',
      });

      // En desarrollo, mostrar error en consola detallado
      if (this.isDevelopment()) {
        console.group('🔴 Error Details');
        console.error('Message:', normalizedError.message);
        console.error('Stack:', normalizedError.stack);
        console.groupEnd();
      }
    } catch (handlerError) {
      // Si el manejador de errores falla, al menos loguear en consola
      console.error('[GlobalErrorHandler] Failed to handle error:', handlerError);
      console.error('[GlobalErrorHandler] Original error:', error);
    }
  }

  /**
   * Normaliza cualquier valor de error a una instancia de Error
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error && typeof error === 'object') {
      // Intentar extraer mensaje de objetos de error comunes
      const errorObj = error as Record<string, unknown>;
      const message = 
        (typeof errorObj['message'] === 'string' && errorObj['message']) ||
        (typeof errorObj['error'] === 'string' && errorObj['error']) ||
        JSON.stringify(error);
      
      const normalizedError = new Error(message);
      
      // Preservar stack si existe
      if (typeof errorObj['stack'] === 'string') {
        normalizedError.stack = errorObj['stack'];
      }

      return normalizedError;
    }

    return new Error('Unknown error occurred');
  }

  /**
   * Verifica si estamos en modo desarrollo
   */
  private isDevelopment(): boolean {
    return typeof window !== 'undefined' && 
           (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1');
  }
}
