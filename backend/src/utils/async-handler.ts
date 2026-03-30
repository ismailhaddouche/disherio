import { Request, Response, NextFunction } from 'express';

/**
 * AsyncHandler wrapper - removes the need for repetitive try/catch in controllers
 * Catches promise errors and passes them to the global error middleware
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Custom error for operational HTTP errors
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Helper to create common errors
 */
export const createError = {
  badRequest: (message: string) => new AppError(message, 400),
  unauthorized: (message: string = 'UNAUTHORIZED') => new AppError(message, 401),
  forbidden: (message: string = 'FORBIDDEN') => new AppError(message, 403),
  notFound: (message: string = 'NOT_FOUND') => new AppError(message, 404),
  conflict: (message: string) => new AppError(message, 409),
  internal: (message: string = 'SERVER_ERROR') => new AppError(message, 500),
};
