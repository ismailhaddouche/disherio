import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger';
import { getRateLimitConfig, generateRateLimitKey } from './rateLimit.config';

// ============================================
// AUTH RATE LIMITERS
// ============================================

/**
 * Auth limiter: 5 attempts per 15 minutes
 * Used for: /api/auth/login, /api/auth/pin
 */
export const authLimiter = rateLimit({
  ...getRateLimitConfig('AUTH', 'AUTH_RATE_LIMIT_EXCEEDED'),
  keyGenerator: generateRateLimitKey,
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
  skip: () => {
    // Skip rate limiting for internal/development IPs
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  },
});

/**
 * QR brute force limiter: 10 attempts per 15 minutes
 * Used for: QR token validation to prevent brute force
 */
export const qrBruteForceLimiter = rateLimit({
  ...getRateLimitConfig('QR_BRUTE_FORCE', 'QR_BRUTE_FORCE_DETECTED'),
  keyGenerator: generateRateLimitKey,
  handler: (req, res, _next, options) => {
    // Log suspicious attempts
    logger.warn({
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    }, 'QR brute force attempt detected');
    
    const retryAfter = Math.ceil(15 * 60);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      ...options.message,
      retryAfter,
    });
  },
});

// ============================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================

export default {
  authLimiter,
  apiLimiter,
  strictLimiter,
  uploadLimiter,
  qrLimiter,
  qrBruteForceLimiter,
};
