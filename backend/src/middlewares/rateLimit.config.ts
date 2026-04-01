import { Options } from 'express-rate-limit';
import { logger } from '../config/logger';

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
  // General API: 100 requests per 15 minutes
  API: {
    windowMs: 15 * TIME.MINUTE,
    max: 100,
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

// Error messages by error code
export const RATE_LIMIT_MESSAGES: Record<string, { error: string; errorCode: string; retryAfter?: number }> = {
  AUTH_RATE_LIMIT_EXCEEDED: {
    error: 'Too many login attempts. Please try again later.',
    errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  API_RATE_LIMIT_EXCEEDED: {
    error: 'Too many requests. Please slow down.',
    errorCode: 'API_RATE_LIMIT_EXCEEDED',
  },
  STRICT_RATE_LIMIT_EXCEEDED: {
    error: 'Too many operations. Please wait before trying again.',
    errorCode: 'STRICT_RATE_LIMIT_EXCEEDED',
  },
  UPLOAD_RATE_LIMIT_EXCEEDED: {
    error: 'Upload limit reached. Maximum 10 uploads per hour.',
    errorCode: 'UPLOAD_RATE_LIMIT_EXCEEDED',
  },
  QR_RATE_LIMIT_EXCEEDED: {
    error: 'Too many QR requests. Please slow down.',
    errorCode: 'QR_RATE_LIMIT_EXCEEDED',
  },
  QR_BRUTE_FORCE_DETECTED: {
    error: 'Suspicious activity detected. Access temporarily blocked.',
    errorCode: 'QR_BRUTE_FORCE_DETECTED',
  },
};

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
    message: RATE_LIMIT_MESSAGES[errorCode],
    handler: (req, res, _next, options) => {
      const retryAfter = Math.ceil(config.windowMs / 1000);
      
      logger.warn({
        ip: req.ip,
        path: req.path,
        type,
        errorCode,
      }, `Rate limit exceeded: ${errorCode}`);
      
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        ...options.message,
        retryAfter,
      });
    },
    skip: (_req) => {
      // Skip rate limiting in development (optional)
      return process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true';
    },
  };
};

// Custom key generator for rate limiting (can be extended for per-user limits)
export const generateRateLimitKey = (req: any): string => {
  // Use user ID if authenticated, otherwise use IP
  const userId = req.user?.id;
  const identifier = userId || req.ip;
  return `${req.path}:${identifier}`;
};
