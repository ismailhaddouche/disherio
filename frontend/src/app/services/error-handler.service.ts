import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from '../core/services/notification.service';
import { I18nService } from '../core/services/i18n.service';
import {
  ErrorCode,
  ErrorContext,
  AppError,
  ServerErrorResponse,
  getErrorFallbackKey,
} from '../types/error.types';

const ERROR_NOTIFICATION_DURATION = 5000;

/**
 * Centralized application error handling.
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  private readonly notificationService = inject(NotificationService);
  private readonly i18n = inject(I18nService);

  /**
   * Handle HTTP errors: prefer an explicit context message, then the
   * server-provided localized message, then a translated fallback by code.
   * 401 handling (refresh, logout, redirect) is owned by jwtInterceptor.
   */
  handleHttpError(error: HttpErrorResponse, context?: ErrorContext): void {
    const appError = this.mapHttpErrorToAppError(error);
    const userMessage = context?.userMessage
      || appError.message
      || this.getFallbackMessage(appError.code);
    this.notificationService.error(userMessage, ERROR_NOTIFICATION_DURATION);
  }

  /**
   * Handle general errors. Exception messages are diagnostics, not localized
   * user-facing text, so the notification always uses the translated fallback.
   */
  handleError(error: Error, context?: ErrorContext): void {
    const appError = this.mapErrorToAppError(error);
    const userMessage = context?.userMessage || this.getFallbackMessage(appError.code);
    this.notificationService.error(userMessage, ERROR_NOTIFICATION_DURATION);
  }

  /**
   * Translated fallback message for an error code.
   */
  getFallbackMessage(code: ErrorCode): string {
    return this.i18n.translate(getErrorFallbackKey(code));
  }

  /**
   * Map an HttpErrorResponse to AppError.
   */
  private mapHttpErrorToAppError(error: HttpErrorResponse): AppError {
    // Transport failure: no server message exists, so leave the message empty
    // and let the caller fall back to the translated network-error message.
    if (error.error instanceof ProgressEvent || error.status === 0) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: '',
        timestamp: new Date(),
      };
    }

    const serverError = error.error && typeof error.error === 'object'
      ? error.error as ServerErrorResponse
      : undefined;

    // Prefer the server-provided errorCode when it maps to a known ErrorCode,
    // so specific errors like ORDER_ALREADY_PAID or PAYMENT_NOT_FOUND surface
    // instead of falling through to a generic "server error" by HTTP status.
    let code: ErrorCode;
    if (serverError?.errorCode && this.isKnownErrorCode(serverError.errorCode)) {
      code = serverError.errorCode as ErrorCode;
    } else {
      code = this.mapStatusCodeToErrorCode(error.status);
    }

    return {
      code,
      // The backend sends the localized message under `error`, not `message`.
      // Angular's own `error.message` is a diagnostic, not user-facing text.
      message: serverError?.error || serverError?.message || '',
      timestamp: new Date(),
    };
  }

  /** Check whether a string is a valid ErrorCode enum value. */
  private isKnownErrorCode(value: string): boolean {
    return Object.values(ErrorCode).includes(value as ErrorCode);
  }

  /**
   * Map a general Error to AppError.
   */
  private mapErrorToAppError(error: Error): AppError {
    // Detect common network failures.
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: error.message,
        timestamp: new Date(),
      };
    }

    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message || '',
      timestamp: new Date(),
    };
  }

  /**
   * Map an HTTP status to ErrorCode.
   */
  private mapStatusCodeToErrorCode(status: number): ErrorCode {
    switch (status) {
      case 401:
        return ErrorCode.AUTH_ERROR;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 422:
        return ErrorCode.VALIDATION_ERROR;
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
}
