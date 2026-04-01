import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Generar request ID si no existe
  const requestId = req.headers['x-request-id'] as string || 
                    req.headers['x-correlation-id'] as string || 
                    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Añadir requestId al objeto req para uso posterior
  (req as Request & { requestId: string }).requestId = requestId;
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logData = {
      requestId,
      req: {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      res: {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
      },
    };
    
    // Log level basado en status code
    if (res.statusCode >= 500) {
      logger.error(logData, 'Request failed with server error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request failed with client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });
  
  next();
};

export default requestLogger;
