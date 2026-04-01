import { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { logger } from '../config/logger';

export function applySecurityMiddleware(app: Express): void {
  app.use(helmet());

  // Build allowed origins list
  const allowedOrigins: string[] = [];
  
  if (process.env.FRONTEND_URL) {
    const frontendUrl = process.env.FRONTEND_URL;
    allowedOrigins.push(frontendUrl);

    // Also add the variant without an explicit :80 port (browsers may omit it)
    if (frontendUrl.includes(':80')) {
      allowedOrigins.push(frontendUrl.replace(':80', ''));
    }
  }
  
  // Development origins
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:4200', 'http://localhost:3000');
  }

  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    logger.error('ERROR: FRONTEND_URL must be set in production');
    process.exit(1);
  }

  logger.info({ allowedOrigins }, 'CORS allowed origins configured');

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        logger.warn({ origin }, 'CORS rejected origin');
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(compression());
}
