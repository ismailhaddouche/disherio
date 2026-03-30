import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorCode: 'RATE_LIMIT_EXCEEDED' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorCode: 'AUTH_RATE_LIMIT_EXCEEDED' },
});

// Rate limiter for QR endpoints (public access)
export const qrLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorCode: 'QR_RATE_LIMIT_EXCEEDED' },
  skip: (_req) => {
    // Optional: skip rate limiting for internal/development IPs
    return process.env.NODE_ENV === 'development';
  },
});

// Stricter rate limiter to prevent QR token brute force
export const qrBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorCode: 'QR_BRUTE_FORCE_DETECTED' },
  handler: (req, res, _next, options) => {
    // Log suspicious attempts
    logger.warn({ ip: req.ip }, 'QR brute force attempt detected');
    res.status(429).json(options.message);
  },
});
