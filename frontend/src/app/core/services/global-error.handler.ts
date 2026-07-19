import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';

/**
 * Angular handler for uncaught application errors.
 */
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorHandler = inject(ErrorHandlerService);

  handleError(error: Error | unknown): void {
    try {
      const normalizedError = this.normalizeError(error);
      this.errorHandler.handleError(normalizedError, {
        component: 'Global',
        action: 'unhandled_error',
      });
    } catch {
      // Error handlers must never throw recursively.
    }
  }

  /**
   * Normalize any thrown value to an Error instance.
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error && typeof error === 'object') {
      // Extract a message from common error-like objects.
      const errorObj = error as Record<string, unknown>;
      const message =
        (typeof errorObj['message'] === 'string' && errorObj['message']) ||
        (typeof errorObj['error'] === 'string' && errorObj['error']) ||
        JSON.stringify(error);

      const normalizedError = new Error(message);

      // Preserve an existing stack trace.
      if (typeof errorObj['stack'] === 'string') {
        normalizedError.stack = errorObj['stack'];
      }

      return normalizedError;
    }

    return new Error('Unknown error occurred');
  }
}
