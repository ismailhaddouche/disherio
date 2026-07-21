/**
 * Rate Limiter Middleware for Socket.IO
 *
 * Redis-based rate limiting for multi-node support with in-memory fallback.
 * Provides rate limiting per stable staff, customer, or public QR/address identity:
 * - join/leave events: 10 per minute
 * - order events: 30 per minute
 * - message events: 60 per minute
 * - customer/totem events: 20 per minute (more restrictive for public access)
 */

import { createHash } from 'crypto';
import { logger } from '../../config/logger';
import { getRedisClient, initRedis, type DisherRedisClient } from '../../config/redis';
import type { AuthenticatedSocket } from '../../middlewares/socketAuth';

// In-memory fallback rate limiter for when Redis is unavailable
const inMemoryCounters = new Map<string, { count: number; resetAt: number }>();
const IN_MEMORY_CLEANUP_INTERVAL = 60_000; // 1 minute

function cleanupInMemoryCounters(): void {
  const now = Date.now();
  for (const [key, entry] of inMemoryCounters.entries()) {
    if (now > entry.resetAt) {
      inMemoryCounters.delete(key);
    }
  }
}
const cleanupInterval = setInterval(cleanupInMemoryCounters, IN_MEMORY_CLEANUP_INTERVAL);
cleanupInterval.unref();

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
function getRateLimitKey(identity: string, event: string): string {
  return `ratelimit:${identity}:${event}`;
}

function publicIdentity(socket: AuthenticatedSocket): string {
  const qr = typeof socket.data?.totemQr === 'string' ? socket.data.totemQr : '';
  const address = socket.handshake.address || socket.conn.remoteAddress || 'unknown';
  return `public:${createHash('sha256').update(`${address}:${qr}`).digest('hex').slice(0, 32)}`;
}

export function getSocketRateLimitIdentity(socket: AuthenticatedSocket): string {
  if (socket.user?.staffId) return `staff:${socket.user.staffId}`;
  const customerIdentity = socket.data?.rateLimitCustomerIdentity;
  if (typeof customerIdentity === 'string') return customerIdentity;
  return publicIdentity(socket);
}

export function bindSocketRateLimitToCustomer(socket: AuthenticatedSocket, customerId: string): void {
  socket.data.rateLimitCustomerIdentity = `customer:${customerId}`;
}

/**
 * Membership check for the `as const` event lists above. Widening to
 * readonly string[] avoids casting the event name at each call site.
 */
function includesEvent(events: readonly string[], eventType: string): boolean {
  return events.includes(eventType);
}

/**
 * Get the rate limit configuration for a specific event type
 */
function getRateLimitConfig(eventType: string): { maxRequests: number; windowMs: number } {
  if (includesEvent(RATE_LIMITS.JOIN_LEAVE.events, eventType)) {
    return { maxRequests: RATE_LIMITS.JOIN_LEAVE.maxRequests, windowMs: RATE_LIMITS.JOIN_LEAVE.windowMs };
  }
  if (includesEvent(RATE_LIMITS.ORDER.events, eventType)) {
    return { maxRequests: RATE_LIMITS.ORDER.maxRequests, windowMs: RATE_LIMITS.ORDER.windowMs };
  }
  if (includesEvent(RATE_LIMITS.MESSAGE.events, eventType)) {
    return { maxRequests: RATE_LIMITS.MESSAGE.maxRequests, windowMs: RATE_LIMITS.MESSAGE.windowMs };
  }
  if (includesEvent(RATE_LIMITS.CUSTOMER.events, eventType)) {
    return { maxRequests: RATE_LIMITS.CUSTOMER.maxRequests, windowMs: RATE_LIMITS.CUSTOMER.windowMs };
  }
  return DEFAULT_RATE_LIMIT;
}

/**
 * Get Redis client with fallback
 */
async function getRedis(): Promise<DisherRedisClient | null> {
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
 * Check if a request is within rate limits for a stable identity and event type
 */
export async function checkRateLimit(
  identity: string,
  eventType: string,
  maxRequests?: number,
  windowMs?: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = await getRedis();
  const key = getRateLimitKey(identity, eventType);

  const config = maxRequests !== undefined && windowMs !== undefined
    ? { maxRequests, windowMs }
    : getRateLimitConfig(eventType);

  // If Redis is not available, use in-memory fallback
  if (!redis) {
    return checkInMemoryRateLimit(key, config.maxRequests, config.windowMs);
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
    logger.error({ err, identity, eventType }, 'Redis rate limit check failed');
    // Fallback to in-memory rate limiting when Redis errors
    return checkInMemoryRateLimit(key, config.maxRequests, config.windowMs);
  }
}

function checkInMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = inMemoryCounters.get(key);

  if (!existing || now > existing.resetAt) {
    inMemoryCounters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  existing.count++;
  const allowed = existing.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - existing.count);
  return { allowed, remaining };
}

/**
 * Record a request for rate limiting tracking
 */
export async function recordRequest(identity: string, eventType: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  const key = getRateLimitKey(identity, eventType);
  const config = getRateLimitConfig(eventType);

  try {
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    // Log warning when approaching limit
    if (count > config.maxRequests * 0.8) {
      logger.warn(
        { identity, eventType, count, max: config.maxRequests },
        'Socket rate limit warning - high event frequency'
      );
    }
  } catch (err) {
    logger.debug({ err, identity, eventType }, 'Failed to record rate limit request');
  }
}

/**
 * Higher-order function to wrap socket event handlers with rate limiting
 * Emits error event if rate limit is exceeded
 *
 * Usage: socket.on('event', rateLimitMiddleware(socket, 'event', handler))
 */
// The `any` in the handler constraint is intentional: the wrapper must accept
// any handler signature, and `unknown[]` would break Parameters<T> inference
// under strictFunctionTypes (same pattern used by socket.io's own typings).
export function rateLimitMiddleware<T extends (...args: any[]) => any>(
  socket: AuthenticatedSocket,
  eventType: string,
  handler: T
): (...args: Parameters<T>) => void {
  return async (...args: Parameters<T>) => {
    const identity = getSocketRateLimitIdentity(socket);
    const { allowed, remaining } = await checkRateLimit(identity, eventType);

    if (!allowed) {
      const config = getRateLimitConfig(eventType);

      logger.warn(
        { socketId: socket.id, identity, eventType },
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
    await recordRequest(identity, eventType);

    // Execute the handler
    return handler(...args);
  };
}
