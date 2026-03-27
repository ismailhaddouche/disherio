import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../utils/async-handler';

interface MongoServerError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

/**
 * Middleware de error global
 * Debe ser registrado AL FINAL de todas las rutas
 * Captura errores y devuelve JSON consistente
 */
export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determinar status code
  let statusCode = 500;
  let errorMessage = 'Error interno del servidor';

  if (err instanceof AppError && err.isOperational) {
    // Errores operacionales conocidos
    statusCode = err.statusCode;
    errorMessage = err.message;
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    // Errores de Mongoose
    statusCode = 400;
    errorMessage = err.message;
  } else if (err.name === 'MongoServerError' && (err as MongoServerError).code === 11000) {
    // Error de duplicado en MongoDB
    statusCode = 409;
    errorMessage = 'El recurso ya existe';
  }

  // Logging con pino
  logger.error({
    err: {
      message: err.message,
      name: err.name,
      stack: err.stack,
      statusCode,
    },
    type: 'error_handler',
  }, 'Error capturado por el manejador global');

  // Responder con JSON consistente (nunca HTML)
  res.status(statusCode).json({
    error: errorMessage,
    status: statusCode,
  });
}

/**
 * Middleware para rutas no encontradas (404)
 * Debe ser registrado DESPUÉS de todas las rutas válidas
 * y ANTES del errorHandler
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'Ruta no encontrada',
    status: 404,
  });
}
