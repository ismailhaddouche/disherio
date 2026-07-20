import { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { logger } from '../config/logger';
import { getEnv } from '../config/env';

export function applySecurityMiddleware(app: Express): void {
  const env = getEnv();
  const isProduction = env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        // Only allow encrypted WebSocket in production; permit plaintext ws in dev.
        connectSrc: isProduction ? ["'self'", 'wss:'] : ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Build allowed origins list
  const allowedOrigins: string[] = [];

  if (env.FRONTEND_URL) {
    const frontendUrl = env.FRONTEND_URL;
    allowedOrigins.push(frontendUrl);

    try {
      const parsed = new URL(frontendUrl);
      const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
      const hostWithoutPort = parsed.hostname;
      if (!parsed.port || parsed.port === defaultPort) {
        allowedOrigins.push(`${parsed.protocol}//${hostWithoutPort}:${defaultPort}`);
        if (parsed.port === defaultPort) {
          allowedOrigins.push(`${parsed.protocol}//${hostWithoutPort}`);
        }
      }
    } catch {
      // If FRONTEND_URL is not a valid URL, just use it as-is
    }
  }

  // Development origins
  if (env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:4200', 'http://localhost:3000');
  }

  if (env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    logger.error('ERROR: FRONTEND_URL must be set in production');
    process.exit(1);
  }

  logger.info({ allowedOrigins }, 'CORS allowed origins configured');

  app.use(
    cors({
      origin: (origin, callback) => {
        // Reject absent origin when credentials are allowed, so non-browser
        // clients cannot bypass the allowlist and send HttpOnly cookies
        // automatically. In development, keep the historical behavior for
        // local non-browser tooling (Postman, mobile emulators).
        if (!origin) {
          if (isProduction) {
            logger.warn('CORS rejected absent origin');
            return callback(null, false);
          }
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        logger.warn({ origin }, 'CORS rejected origin');
        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
    })
  );
  app.use(compression());
}
