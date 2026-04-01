/**
 * HTTP Response Cache Middleware
 * Caches JSON responses in Redis to reduce database load
 */

import { Request, Response, NextFunction } from 'express';
import { cache, CacheKeys, CACHE_TTL } from '../services/cache.service';

/**
 * Creates a cache middleware for HTTP responses
 * @param ttlSeconds - Time to live in seconds (defaults to 1 minute)
 * @param keyGenerator - Optional custom key generator function
 * @returns Express middleware function
 */
export const cacheMiddleware = (
  ttlSeconds: number = CACHE_TTL.HTTP_RESPONSE,
  keyGenerator?: (req: Request) => string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if cache is not available
    if (!cache.isReady()) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? CacheKeys.httpResponse(keyGenerator(req))
      : CacheKeys.httpResponse(req.originalUrl);

    try {
      // Try to get cached response
      const cached = await cache.get<{ body: any; statusCode: number }>(cacheKey);
      
      if (cached) {
        // Add cache headers to indicate cache hit
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.status(cached.statusCode).json(cached.body);
      }

      // No cache hit - intercept the response
      res.setHeader('X-Cache', 'MISS');
      
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response before sending
      res.json = function(body: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Store in cache asynchronously (don't wait)
          cache.set(cacheKey, { body, statusCode: res.statusCode }, ttlSeconds)
            .catch(() => {
              // Silently fail - cache is best effort
            });
        }
        
        return originalJson(body);
      };

      next();
    } catch {
      // On any error, proceed without caching
      next();
    }
  };
};

/**
 * Creates a cache middleware with custom key based on multiple factors
 * Useful for authenticated routes where cache should be per-user
 */
export const cacheMiddlewareWithUser = (
  ttlSeconds: number = CACHE_TTL.HTTP_RESPONSE,
  includeUserId: boolean = true
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Avoid unused parameter warning when includeUserId is false
    void includeUserId;
    if (req.method !== 'GET' || !cache.isReady()) {
      return next();
    }

    // Build cache key including user ID if authenticated
    const userId = includeUserId && (req as any).user?.id 
      ? `user:${(req as any).user.id}:` 
      : '';
    const cacheKey = CacheKeys.httpResponse(`${userId}${req.originalUrl}`);

    try {
      const cached = await cache.get<{ body: any; statusCode: number }>(cacheKey);
      
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(cached.statusCode).json(cached.body);
      }

      res.setHeader('X-Cache', 'MISS');
      
      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(cacheKey, { body, statusCode: res.statusCode }, ttlSeconds)
            .catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch {
      next();
    }
  };
};

/**
 * Invalidate cache middleware - adds a method to invalidate cache after successful mutations
 * Usage: Call res.invalidateCache(pattern) before res.json()
 */
export const cacheInvalidationMiddleware = () => {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Add helper method to response
    (res as any).invalidateCache = async (pattern: string) => {
      if (cache.isReady()) {
        await cache.deletePattern(pattern);
      }
    };
    
    next();
  };
};

/**
 * Predefined cache configurations for common use cases
 */
export const CacheConfig = {
  // Short cache (1 minute) - for frequently changing data
  short: (keyGenerator?: (req: Request) => string) => 
    cacheMiddleware(60, keyGenerator),
  
  // Medium cache (5 minutes) - for menu data
  menu: (keyGenerator?: (req: Request) => string) => 
    cacheMiddleware(CACHE_TTL.MENU, keyGenerator),
  
  // Long cache (10 minutes) - for category data
  categories: (keyGenerator?: (req: Request) => string) => 
    cacheMiddleware(CACHE_TTL.CATEGORIES, keyGenerator),
  
  // Extended cache (1 hour) - for restaurant configuration
  config: (keyGenerator?: (req: Request) => string) => 
    cacheMiddleware(CACHE_TTL.RESTAURANT_CONFIG, keyGenerator),
  
  // Session cache (24 hours) - for session data
  session: (keyGenerator?: (req: Request) => string) => 
    cacheMiddleware(CACHE_TTL.SESSION, keyGenerator),
};

export default cacheMiddleware;
