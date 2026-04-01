/**
 * Middleware exports for easier imports
 */

// Auth & Security
export { authenticate } from './auth';
export { errorHandler, notFoundHandler } from './error-handler';
export { applySecurityMiddleware } from './security';
export { apiLimiter } from './rateLimit';
export { languageMiddleware } from './language';
export { validate } from './validate';
export { default as requestLogger } from './request-logger';

// RBAC
export { requirePermission } from './rbac';

// Socket middleware
export { socketAuthMiddleware } from './socketAuth';

// Cache middleware
export {
  cacheMiddleware,
  cacheMiddlewareWithUser,
  cacheInvalidationMiddleware,
  CacheConfig,
} from './cache.middleware';
