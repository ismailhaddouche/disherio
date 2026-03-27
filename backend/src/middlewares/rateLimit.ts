import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Rate limiter especifico para endpoints de QR (acceso publico)
export const qrLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 requests por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many QR scans, please try again later.' },
  skip: (_req) => {
    // Opcional: skip rate limiting para IPs internas/development
    return process.env.NODE_ENV === 'development';
  },
});

// Rate limiter mas estricto para prevenir fuerza bruta de tokens QR
export const qrBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, QR code may be invalid.' },
  handler: (req, res, _next, options) => {
    // Loggear intentos sospechosos
    logger.warn({ ip: req.ip }, 'QR brute force attempt detected');
    res.status(429).json(options.message);
  },
});
