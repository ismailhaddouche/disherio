/**
 * Rate Limiter Middleware for Socket.IO
 * 
 * Provides rate limiting per socket ID with event-type specific limits:
 * - join/leave events: 10 per minute
 * - order events: 30 per minute
 * - message events: 60 per minute
 */

import { logger } from '../../config/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Track rate limits per socket per event type
// Structure: Map<socketId, Map<eventType, RateLimitEntry>>
const socketRateLimits = new Map<string, Map<string, RateLimitEntry>>();

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
} as const;

// Default rate limit for unspecified events
const DEFAULT_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000,
};

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
  return DEFAULT_RATE_LIMIT;
}

/**
 * Check if a request is within rate limits for a socket and event type
 * @param socketId - The socket ID
 * @param eventType - The event type being checked
 * @param maxRequests - Maximum requests allowed in the window (optional, overrides default)
 * @param windowMs - Time window in milliseconds (optional, overrides default)
 * @returns { allowed: boolean; remaining: number }
 */
export function checkRateLimit(
  socketId: string,
  eventType: string,
  maxRequests?: number,
  windowMs?: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  
  // Get or create the event type map for this socket
  if (!socketRateLimits.has(socketId)) {
    socketRateLimits.set(socketId, new Map<string, RateLimitEntry>());
  }
  
  const socketEvents = socketRateLimits.get(socketId)!;
  
  // Get rate limit configuration
  const config = maxRequests !== undefined && windowMs !== undefined 
    ? { maxRequests, windowMs }
    : getRateLimitConfig(eventType);
  
  // Get or create the entry for this event type
  let entry = socketEvents.get(eventType);
  
  if (!entry) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    socketEvents.set(eventType, entry);
  }
  
  // Reset counter if window has passed
  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + config.windowMs;
  }
  
  // Check if allowed
  const allowed = entry.count < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return { allowed, remaining };
}

/**
 * Record a request for rate limiting tracking
 * @param socketId - The socket ID
 * @param eventType - The event type
 */
export function recordRequest(socketId: string, eventType: string): void {
  const socketEvents = socketRateLimits.get(socketId);
  
  if (!socketEvents) {
    return;
  }
  
  const entry = socketEvents.get(eventType);
  
  if (entry) {
    entry.count++;
    
    // Log warning when approaching limit
    const config = getRateLimitConfig(eventType);
    if (entry.count > config.maxRequests * 0.8) {
      logger.warn(
        { socketId, eventType, count: entry.count, max: config.maxRequests },
        'Socket rate limit warning - high event frequency'
      );
    }
  }
}

/**
 * Clean up all rate limit entries for a socket when it disconnects
 * @param socketId - The socket ID to clean up
 */
export function cleanupSocketRateLimits(socketId: string): void {
  if (socketRateLimits.has(socketId)) {
    socketRateLimits.delete(socketId);
    logger.debug({ socketId }, 'Cleaned up rate limit entries for disconnected socket');
  }
}

/**
 * Clean up expired rate limit entries (for periodic maintenance)
 * Should be called periodically (e.g., every 5 minutes)
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  socketRateLimits.forEach((socketEvents, socketId) => {
    socketEvents.forEach((entry, eventType) => {
      if (now > entry.resetTime) {
        socketEvents.delete(eventType);
        cleanedCount++;
      }
    });
    
    // Remove socket entry if no events remain
    if (socketEvents.size === 0) {
      socketRateLimits.delete(socketId);
    }
  });
  
  if (cleanedCount > 0) {
    logger.debug({ cleanedCount }, 'Cleaned up expired rate limit entries');
  }
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
  return (...args: Parameters<T>) => {
    const { allowed } = checkRateLimit(socket.id, eventType);
    
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
      });
      
      return;
    }
    
    // Record the request
    recordRequest(socket.id, eventType);
    
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
export function getRateLimitStatus(
  socketId: string,
  eventType: string
): { count: number; resetTime: number; remaining: number } | null {
  const socketEvents = socketRateLimits.get(socketId);
  
  if (!socketEvents) {
    return null;
  }
  
  const entry = socketEvents.get(eventType);
  
  if (!entry) {
    return null;
  }
  
  const config = getRateLimitConfig(eventType);
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    count: entry.count,
    resetTime: entry.resetTime,
    remaining,
  };
}

// Export the rate limits map for testing/monitoring
export { socketRateLimits };
