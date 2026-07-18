import { ErrorCode as SharedErrorCode, ERROR_HTTP_STATUS_MAP, isErrorCode } from '@disherio/shared/errors';

export const ErrorCode = {
  ...SharedErrorCode,
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  RATE_LIMIT: SharedErrorCode.RATE_LIMIT_EXCEEDED,
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Base application error shape.
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: string;
  timestamp: Date;
}

/**
 * Field validation error.
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Additional error-handling context.
 */
export interface ErrorContext {
  component?: string;
  action?: string;
  userMessage?: string;
}

/**
 * Server error response.
 */
export interface ServerErrorResponse {
  status: number;
  /** Localized error message from the backend (sent as `error` in the JSON body). */
  error?: string;
  message?: string;
  errorCode?: string;
  details?: unknown;
  errors?: ValidationError[];
  path?: string;
  timestamp?: string;
}

/**
 * Translation key for the user-facing fallback message of an error code.
 * Shared backend codes are grouped by their mapped HTTP status; business
 * errors always carry a backend-localized message, so their fallback is the
 * generic unknown-error key.
 */
export function getErrorFallbackKey(code: ErrorCode): string {
  if (code === ErrorCode.NETWORK_ERROR) return 'errors.network';
  if (code === ErrorCode.AUTH_ERROR) return 'errors.http_401';
  if (code === ErrorCode.VALIDATION_ERROR) return 'errors.validation';

  const status = isErrorCode(code) ? ERROR_HTTP_STATUS_MAP[code] : undefined;
  switch (status) {
    case 401:
      return 'errors.http_401';
    case 403:
      return 'errors.forbidden';
    case 404:
      return 'errors.not_found';
    case 429:
      return 'errors.rate_limited';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'errors.server';
    default:
      return 'errors.unknown';
  }
}
