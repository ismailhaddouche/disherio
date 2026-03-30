import { Request, Response, NextFunction } from 'express';
import i18next from 'i18next';
import { logger } from '../config/logger';
import { AppError } from '../utils/async-handler';
import { ErrorCode, ERROR_HTTP_STATUS_MAP, isErrorCode } from '@disherio/shared';

interface MongoServerError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

// Use centralized error status map from shared package
// This ensures consistency between backend and frontend
const ERROR_STATUS_MAP = ERROR_HTTP_STATUS_MAP;

/**
 * Global error middleware
 * Must be registered AFTER all routes
 * Catches errors and returns consistent JSON with translations
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine status code
  let statusCode = 500;
  let errorCode = 'SERVER_ERROR';
  let errorMessage: string;

  if (err instanceof AppError && err.isOperational) {
    // Operational errors with explicit error codes
    statusCode = err.statusCode;
    // Check if the error message is a valid ErrorCode
    if (isErrorCode(err.message)) {
      errorCode = err.message;
      errorMessage = i18next.t(`errors:${err.message}`, { lng: req.lang });
    } else {
      // Fallback to generic server error
      errorCode = ErrorCode.SERVER_ERROR;
      errorMessage = i18next.t(`errors:${ErrorCode.SERVER_ERROR}`, { lng: req.lang });
    }
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    // Mongoose validation errors
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    errorMessage = i18next.t(`errors:${ErrorCode.VALIDATION_ERROR}`, { lng: req.lang });
  } else if (err.name === 'MongoServerError' && (err as MongoServerError).code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    errorCode = ErrorCode.DUPLICATE_RESOURCE;
    errorMessage = i18next.t(`errors:${ErrorCode.DUPLICATE_RESOURCE}`, {
      lng: req.lang,
      defaultValue: 'Resource already exists'
    });
  } else {
    // Check if the error message is a known error code
    if (isErrorCode(err.message)) {
      statusCode = ERROR_STATUS_MAP[err.message];
      errorCode = err.message;
      errorMessage = i18next.t(`errors:${err.message}`, { lng: req.lang });
    } else {
      // Unknown error
      statusCode = 500;
      errorCode = ErrorCode.SERVER_ERROR;
      errorMessage = i18next.t(`errors:${ErrorCode.SERVER_ERROR}`, { lng: req.lang });
    }
  }

  // Log with pino
  logger.error({
    err: {
      message: err.message,
      name: err.name,
      stack: err.stack,
      statusCode,
      errorCode,
    },
    type: 'error_handler',
  }, 'Error caught by global handler');

  // Respond with consistent JSON (never HTML)
  res.status(statusCode).json({
    error: errorMessage,
    errorCode: errorCode,
    status: statusCode,
  });
}

/**
 * Middleware for not found routes (404)
 * Must be registered AFTER all valid routes
 * and BEFORE the errorHandler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const message = i18next.t(`errors:${ErrorCode.NOT_FOUND}`, { lng: req.lang });
  res.status(404).json({
    error: message,
    errorCode: ErrorCode.NOT_FOUND,
    status: 404,
  });
}
