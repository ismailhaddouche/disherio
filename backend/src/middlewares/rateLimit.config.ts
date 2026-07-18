import { Request } from 'express';
import { Options } from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../config/logger';
import { AppError } from '../utils/async-handler';
import { getHttpRouteLabel } from '../utils/http-route-label';

// Time constants (in milliseconds)
export const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

// Rate limit configuration
export const RATE_LIMITS = {
  // Auth endpoints: 5 attempts per 15 minutes
  AUTH: {
    windowMs: 15 * TIME.MINUTE,
    max: 5,
  },
  // General API: 1000 requests per 15 minutes (restaurant POS usage is request-heavy)
  API: {
    windowMs: 15 * TIME.MINUTE,
    max: 1000,
  },
  // Strict operations (create/update critical data): 20 requests per 15 minutes
  STRICT: {
    windowMs: 15 * TIME.MINUTE,
    max: 20,
  },
  // Upload operations: 10 uploads per hour
  UPLOAD: {
    windowMs: TIME.HOUR,
    max: 10,
  },
  // QR endpoints: 30 requests per minute
  QR: {
    windowMs: TIME.MINUTE,
    max: 30,
  },
  // QR brute force protection: 10 attempts per 15 minutes
  QR_BRUTE_FORCE: {
    windowMs: 15 * TIME.MINUTE,
    max: 10,
  },
} as const;

// Common rate limit options
export const getRateLimitConfig = (
  type: keyof typeof RATE_LIMITS,
  errorCode: string
): Partial<Options> => {
  const config = RATE_LIMITS[type];

  return {
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      const retryAfter = Math.ceil(config.windowMs / 1000);

      logger.warn({
        ip: req.ip,
        route: getHttpRouteLabel(req),
        type,
        errorCode,
      }, `Rate limit exceeded: ${errorCode}`);

      res.setHeader('Retry-After', retryAfter);
      next(new AppError(errorCode, 429, { retryAfter }));
    },
    skip: (_req) => {
      // Skip rate limiting in development (optional)
      return process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true';
    },
  };
};

// Limiter instances already separate authentication, QR, API, upload, and
// strict-mutation traffic. Keeping the path out of the key prevents callers
// from resetting a limiter by changing a route parameter such as a QR or ID.
export const generateRateLimitKey = (req: Request): string => {
  const userId = req.user?.staffId;
  return userId || ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown');
};
