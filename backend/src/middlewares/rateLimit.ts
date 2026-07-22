import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger';
import { getRateLimitConfig, generateRateLimitKey } from './rateLimit.config';
import { AppError } from '../utils/async-handler';
import { getHttpRouteLabel } from '../utils/http-route-label';
import { RedisRateLimitStore } from './redis-rate-limit-store';

const productionStore = (prefix: string) => process.env.NODE_ENV === 'production'
  ? { store: new RedisRateLimitStore(prefix), passOnStoreError: false }
  : {};

// ============================================
// AUTH RATE LIMITERS
// ============================================

/**
 * Auth limiter: 5 failed attempts per 15 minutes
 * Used for: /api/auth/login
 */
export const authLimiter = rateLimit({
  ...getRateLimitConfig('AUTH', 'AUTH_RATE_LIMIT_EXCEEDED'),
  keyGenerator: generateRateLimitKey,
  skipSuccessfulRequests: true,
  ...productionStore('auth'),
});

// ============================================
// GENERAL API RATE LIMITER
// ============================================

/**
 * API limiter: 100 requests per 15 minutes
 * Used for: general /api/* routes
 */
export const apiLimiter = rateLimit({
  ...getRateLimitConfig('API', 'API_RATE_LIMIT_EXCEEDED'),
  keyGenerator: generateRateLimitKey,
  ...productionStore('api'),
});

// ============================================
// STRICT OPERATIONS RATE LIMITER
// ============================================

/**
 * Strict limiter: 20 requests per 15 minutes
 * Used for: critical operations like create/update orders, payments
 */
export const strictLimiter = rateLimit({
  ...getRateLimitConfig('STRICT', 'STRICT_RATE_LIMIT_EXCEEDED'),
  keyGenerator: generateRateLimitKey,
  ...productionStore('strict'),
});

// ============================================
// UPLOAD RATE LIMITER
// ============================================

/**
 * Upload limiter: 10 uploads per hour
 * Used for: /api/images/* endpoints
 */
export const uploadLimiter = rateLimit({
  ...getRateLimitConfig('UPLOAD', 'UPLOAD_RATE_LIMIT_EXCEEDED'),
  keyGenerator: generateRateLimitKey,
  ...productionStore('upload'),
});

// ============================================
// QR ENDPOINTS RATE LIMITERS
// ============================================

/**
 * QR limiter: 30 requests per minute
 * Used for: public QR endpoints
 */
export const qrLimiter = rateLimit({
  ...getRateLimitConfig('QR', 'QR_RATE_LIMIT_EXCEEDED'),
  keyGenerator: generateRateLimitKey,
  ...productionStore('qr'),
});

/**
 * QR brute force limiter: 10 attempts per 15 minutes
 * Used for: QR token validation to prevent brute force
 */
export const qrBruteForceLimiter = rateLimit({
  ...getRateLimitConfig('QR_BRUTE_FORCE', 'QR_BRUTE_FORCE_DETECTED'),
  keyGenerator: generateRateLimitKey,
  ...productionStore('qr-brute-force'),
  handler: (req, res, next) => {
    // Log suspicious attempts
    logger.warn({
      ip: req.ip,
      route: getHttpRouteLabel(req),
      userAgent: req.get('user-agent'),
    }, 'QR brute force attempt detected');

    const retryAfter = Math.ceil(15 * 60);
    res.setHeader('Retry-After', retryAfter);
    next(new AppError('QR_BRUTE_FORCE_DETECTED', 429, { retryAfter }));
  },
});
