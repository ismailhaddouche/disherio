import { Request, Response, NextFunction } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = {
  badRequest: (message: string) => new AppError(message, 400),
  unauthorized: (message: string = 'UNAUTHORIZED') => new AppError(message, 401),
  forbidden: (message: string = 'FORBIDDEN') => new AppError(message, 403),
  notFound: (message: string = 'NOT_FOUND') => new AppError(message, 404),
  conflict: (message: string, details?: unknown) => new AppError(message, 409, details),
  internal: (message: string = 'SERVER_ERROR') => new AppError(message, 500),
};
