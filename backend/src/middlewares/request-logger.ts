import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { getHttpRouteLabel } from '../utils/http-route-label';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Generate a request ID when the proxy did not provide one.
  const requestId = req.headers['x-request-id'] as string ||
                    req.headers['x-correlation-id'] as string ||
                    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add requestId to req object for later use
  (req as Request & { requestId: string }).requestId = requestId;

  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logData = {
      requestId,
      req: {
        method: req.method,
        route: getHttpRouteLabel(req),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      res: {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
      },
    };

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
