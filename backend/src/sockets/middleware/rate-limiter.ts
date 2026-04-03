/**
 * Rate Limiter Middleware for Socket.IO
 * 
 * Redis-based rate limiting for multi-node support.
 * Provides rate limiting per socket ID with event-type specific limits:
 * - join/leave events: 10 per minute
 * - order events: 30 per minute
 * - message events: 60 per minute
 * - customer/totem events: 20 per minute (more restrictive for public access)
 */

import { logger } from '../../config/logger';
import { getRedisClient, initRedis } from '../../config/redis';
import { RedisClientType } from 'redis';

// Rate limit configurations by event category
const RATE_LIMITS = {
  // Join/leave events: 10 per minute
  JOIN_LEAVE: {
    events: ['kds:join', 'kds:leave', 'pos:join', 'pos:leave', 'tas:join', 'tas:leave'],
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // Order events: 30 per minute
  ORDER: {
    events: ['kds:new_item', 'kds:item_prepare', 'kds:item_serve', 'kds:item_cancel', 
             'tas:add_item', 'tas:serve_service_item', 'tas:cancel_item'],
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  // Message events: 60 per minute
  MESSAGE: {
    events: ['tas:notify_customers', 'tas:call_waiter_response', 'pos:process_payment'],
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
  // Customer/Totem events: 20 per minute (more restrictive for public access)
  CUSTOMER: {
    events: [
      'totem:join_session', 
      'totem:leave_session',
      'totem:place_order', 
      'totem:add_item',
      'totem:call_waiter', 
      'totem:request_bill',
      'totem:subscribe_items',
      'totem:get_table_info',
      'totem:get_my_orders',
    ],
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

// Default rate limit for unspecified events
const DEFAULT_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000,
};

/**
 * Get Redis key for rate limiting
 */
function getRateLimitKey(socketId: string, event: string): string {
  return `ratelimit:${socketId}:${event}`;
}

/**
 * Get the rate limit configuration for a specific event type
 */
function getRateLimitConfig(eventType: string): { maxRequests: number; windowMs: number } {
  if (RATE_LIMITS.JOIN_LEAVE.events.includes(eventType as any)) {
    return { maxRequests: RATE_LIMITS.JOIN_LEAVE.maxRequests, windowMs: RATE_LIMITS.JOIN_LEAVE.windowMs };
  }
  if (RATE_LIMITS.ORDER.events.includes(eventType as any)) {
    return { maxRequests: RATE_LIMITS.ORDER.maxRequests, windowMs: RATE_LIMITS.ORDER.windowMs };
  }
  if (RATE_LIMITS.MESSAGE.events.includes(eventType as any)) {
    return { maxRequests: RATE_LIMITS.MESSAGE.maxRequests, windowMs: RATE_LIMITS.MESSAGE.windowMs };
  }
  if (RATE_LIMITS.CUSTOMER.events.includes(eventType as any)) {
    return { maxRequests: RATE_LIMITS.CUSTOMER.maxRequests, windowMs: RATE_LIMITS.CUSTOMER.windowMs };
  }
  return DEFAULT_RATE_LIMIT;
}

/**
 * Get Redis client with fallback
 */
async function getRedis(): Promise<RedisClientType | null> {
  try {
    return getRedisClient();
  } catch {
    // Try to initialize if not already done
    try {
      return await initRedis();
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Redis for rate limiting');
      return null;
    }
  }
}

/**
 * Check if a request is within rate limits for a socket and event type
 * @param socketId - The socket ID
 * @param eventType - The event type being checked
 * @param maxRequests - Maximum requests allowed in the window (optional, overrides default)
 * @param windowMs - Time window in milliseconds (optional, overrides default)
 * @returns { allowed: boolean; remaining: number }
 */
export async function checkRateLimit(
  socketId: string,
  eventType: string,
  maxRequests?: number,
  windowMs?: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = await getRedis();
  const key = getRateLimitKey(socketId, eventType);
  
  const config = maxRequests !== undefined && windowMs !== undefined 
    ? { maxRequests, windowMs }
    : getRateLimitConfig(eventType);

  // If Redis is not available, allow the request (fail open for availability)
  if (!redis) {
    return { allowed: true, remaining: config.maxRequests };
  }

  try {
    // Increment the counter
    const current = await redis.incr(key);
    
    // Set expiry on first request
    if (current === 1) {
      await redis.expire(key, Math.ceil(config.windowMs / 1000));
    }
    
    const allowed = current <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - current);
    
    return { allowed, remaining };
  } catch (err) {
    logger.error({ err, socketId, eventType }, 'Redis rate limit check failed');
    // Fail open if Redis errors
    return { allowed: true, remaining: config.maxRequests };
  }
}

/**
 * Record a request for rate limiting tracking
 * @param socketId - The socket ID
 * @param eventType - The event type
 */
export async function recordRequest(socketId: string, eventType: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const key = getRateLimitKey(socketId, eventType);
  const config = getRateLimitConfig(eventType);

  try {
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;
    
    // Log warning when approaching limit
    if (count > config.maxRequests * 0.8) {
      logger.warn(
        { socketId, eventType, count, max: config.maxRequests },
        'Socket rate limit warning - high event frequency'
      );
    }
  } catch (err) {
    logger.debug({ err, socketId, eventType }, 'Failed to record rate limit request');
  }
}

/**
 * Clean up all rate limit entries for a socket when it disconnects
 * @param socketId - The socket ID to clean up
 */
export async function cleanupSocketRateLimits(socketId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    // Get all keys matching this socket's rate limits
    const pattern = getRateLimitKey(socketId, '*');
    
    // Use keys command to find matching keys (safe for small datasets per socket)
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      // Delete keys individually to maintain compatibility with Redis v5 types
      for (const key of keys) {
        await redis.del(key);
      }
      logger.debug({ socketId, keysCleaned: keys.length }, 'Cleaned up rate limit entries for disconnected socket');
    }
  } catch (err) {
    logger.debug({ err, socketId }, 'Failed to cleanup socket rate limits');
  }
}

/**
 * Clean up expired rate limit entries (for periodic maintenance)
 * Note: Redis automatically expires keys, so this is mostly a no-op
 * but can be used to verify Redis connectivity
 */
export async function cleanupExpiredRateLimits(): Promise<void> {
  // Redis handles expiration automatically via TTL
  // This function is kept for API compatibility with the old implementation
  logger.debug('Rate limit cleanup called (Redis handles expiration automatically)');
}

/**
 * Higher-order function to wrap socket event handlers with rate limiting
 * Emits error event if rate limit is exceeded
 * 
 * Usage: socket.on('event', rateLimitMiddleware(socket, 'event', handler))
 */
export function rateLimitMiddleware<T extends (...args: any[]) => any>(
  socket: { id: string; emit: (event: string, data: any) => void },
  eventType: string,
  handler: T
): (...args: Parameters<T>) => void {
  return async (...args: Parameters<T>) => {
    const { allowed, remaining } = await checkRateLimit(socket.id, eventType);
    
    if (!allowed) {
      const config = getRateLimitConfig(eventType);
      
      logger.warn(
        { socketId: socket.id, eventType },
        'Socket rate limit exceeded'
      );
      
      socket.emit('error', {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        event: eventType,
        retryAfter: Math.ceil(config.windowMs / 1000),
        remaining,
      });
      
      return;
    }
    
    // Record the request
    await recordRequest(socket.id, eventType);
    
    // Execute the handler
    return handler(...args);
  };
}

/**
 * Get current rate limit status for a socket and event type
 * @param socketId - The socket ID
 * @param eventType - The event type
 * @returns Current count and reset time
 */
export async function getRateLimitStatus(
  socketId: string,
  eventType: string
): Promise<{ count: number; resetTime: number; remaining: number } | null> {
  const redis = await getRedis();
  if (!redis) return null;

  const key = getRateLimitKey(socketId, eventType);
  
  try {
    const [countStr, ttl] = await Promise.all([
      redis.get(key),
      redis.ttl(key),
    ]);
    
    if (!countStr) {
      return null;
    }
    
    const count = parseInt(countStr, 10);
    const config = getRateLimitConfig(eventType);
    const remaining = Math.max(0, config.maxRequests - count);
    const resetTime = ttl > 0 ? Date.now() + (ttl * 1000) : Date.now() + config.windowMs;
    
    return { count, resetTime, remaining };
  } catch (err) {
    logger.debug({ err, socketId, eventType }, 'Failed to get rate limit status');
    return null;
  }
}

// Legacy exports for backward compatibility (deprecated)
export const socketRateLimits = new Map();
