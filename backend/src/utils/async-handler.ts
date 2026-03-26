import { Request, Response, NextFunction } from 'express';

/**
 * AsyncHandler wrapper - elimina la necesidad de try/catch repetitivos en controllers
 * Captura errores de promesas y los pasa al middleware de error global
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
 * Error personalizado para errores HTTP operacionales
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
 * Helper para crear errores comunes
 */
export const createError = {
  badRequest: (message: string) => new AppError(message, 400),
  unauthorized: (message: string = 'Unauthorized') => new AppError(message, 401),
  forbidden: (message: string = 'Forbidden') => new AppError(message, 403),
  notFound: (message: string = 'Not found') => new AppError(message, 404),
  conflict: (message: string) => new AppError(message, 409),
  internal: (message: string = 'Internal server error') => new AppError(message, 500),
};
