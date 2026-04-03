/**
 * @deprecated This file is deprecated. Use sockets/middleware/rate-limiter.ts instead.
 * This module is kept for reference but should not be used in new code.
 * TODO: Remove this file after verifying all imports are updated.
 */

import { AuthenticatedSocket } from './socketAuth';
import { logger } from '../config/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface SocketRateLimiter {
  canProceed(socket: AuthenticatedSocket, eventName: string): boolean;
  recordRequest(socket: AuthenticatedSocket, eventName: string): void;
  getRemainingRequests(socket: AuthenticatedSocket, eventName: string): number;
  reset(socket: AuthenticatedSocket, eventName?: string): void;
}

// Track requests per socket per event
// Structure: Map<socketId, Map<eventName, { count: number, resetTime: number }>>
const requestTracker = new Map<string, Map<string, { count: number; resetTime: number }>>();

// Default rate limit: 30 requests per 10 seconds
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 10 * 1000, // 10 seconds
  maxRequests: 30,
};

// Event-specific limits (override defaults)
const EVENT_LIMITS: Record<string, RateLimitConfig> = {
  // High-frequency operations: 50 per 10 seconds
  'kds:item_prepare': { windowMs: 10 * 1000, maxRequests: 50 },
  'kds:item_serve': { windowMs: 10 * 1000, maxRequests: 50 },
  
  // Room operations: 20 per 10 seconds
  'kds:join': { windowMs: 10 * 1000, maxRequests: 20 },
  'pos:join': { windowMs: 10 * 1000, maxRequests: 20 },
  'pos:leave': { windowMs: 10 * 1000, maxRequests: 20 },
};

/**
 * Creates a rate limiter for Socket.IO events
 * Tracks requests per socket connection per event type
 */
export function createSocketRateLimiter(): SocketRateLimiter {
  function getConfig(eventName: string): RateLimitConfig {
    return EVENT_LIMITS[eventName] || DEFAULT_CONFIG;
  }

  function getTracker(socketId: string, eventName: string) {
    if (!requestTracker.has(socketId)) {
      requestTracker.set(socketId, new Map());
    }
    
    const socketTracker = requestTracker.get(socketId)!;
    
    if (!socketTracker.has(eventName)) {
      const config = getConfig(eventName);
      socketTracker.set(eventName, {
        count: 0,
        resetTime: Date.now() + config.windowMs,
      });
    }
    
    return socketTracker.get(eventName)!;
  }

  function cleanupExpired(socketId: string) {
    const now = Date.now();
    const socketTracker = requestTracker.get(socketId);
    
    if (socketTracker) {
      for (const [eventName, tracker] of socketTracker.entries()) {
        if (now > tracker.resetTime) {
          socketTracker.delete(eventName);
        }
      }
      
      if (socketTracker.size === 0) {
        requestTracker.delete(socketId);
      }
    }
  }

  return {
    canProceed(socket: AuthenticatedSocket, eventName: string): boolean {
      const tracker = getTracker(socket.id, eventName);
      const config = getConfig(eventName);
      const now = Date.now();
      
      // Reset if window has passed
      if (now > tracker.resetTime) {
        tracker.count = 0;
        tracker.resetTime = now + config.windowMs;
      }
      
      return tracker.count < config.maxRequests;
    },

    recordRequest(socket: AuthenticatedSocket, eventName: string): void {
      const tracker = getTracker(socket.id, eventName);
      const now = Date.now();
      
      // Reset if window has passed
      if (now > tracker.resetTime) {
        tracker.count = 0;
        tracker.resetTime = now + getConfig(eventName).windowMs;
      }
      
      tracker.count++;
      
      // Log warnings for high usage
      const config = getConfig(eventName);
      if (tracker.count > config.maxRequests * 0.8) {
        logger.warn(
          { 
            socketId: socket.id, 
            userId: socket.user?.staffId,
            event: eventName,
            count: tracker.count,
            max: config.maxRequests 
          },
          'Socket rate limit warning - high event frequency'
        );
      }
    },

    getRemainingRequests(socket: AuthenticatedSocket, eventName: string): number {
      const tracker = getTracker(socket.id, eventName);
      const config = getConfig(eventName);
      const now = Date.now();
      
      // Reset if window has passed
      if (now > tracker.resetTime) {
        return config.maxRequests;
      }
      
      return Math.max(0, config.maxRequests - tracker.count);
    },

    reset(socket: AuthenticatedSocket, eventName?: string): void {
      if (eventName) {
        const socketTracker = requestTracker.get(socket.id);
        if (socketTracker) {
          socketTracker.delete(eventName);
        }
      } else {
        requestTracker.delete(socket.id);
      }
      
      // Cleanup any expired entries
      cleanupExpired(socket.id);
    },
  };
}

/**
 * Higher-order function to wrap socket event handlers with rate limiting
 * Usage: socket.on('event', rateLimitWrapper(rateLimiter, socket, 'event', handler))
 */
export function rateLimitWrapper<T extends (...args: any[]) => any>(
  rateLimiter: ReturnType<typeof createSocketRateLimiter>,
  socket: AuthenticatedSocket,
  eventName: string,
  handler: T
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    if (!rateLimiter.canProceed(socket, eventName)) {
      const config = EVENT_LIMITS[eventName] || DEFAULT_CONFIG;
      
      logger.warn(
        { 
          socketId: socket.id, 
          userId: socket.user?.staffId,
          event: eventName 
        },
        'Socket rate limit exceeded'
      );
      
      socket.emit('error', {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many ${eventName} requests. Please slow down.`,
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
      
      return;
    }
    
    rateLimiter.recordRequest(socket, eventName);
    return handler(...args);
  };
}

/**
 * Cleanup function to remove expired rate limit entries
 * Should be called periodically (e.g., every 5 minutes)
 */
export function cleanupRateLimiters(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [socketId, socketTracker] of requestTracker.entries()) {
    for (const [eventName, tracker] of socketTracker.entries()) {
      if (now > tracker.resetTime) {
        socketTracker.delete(eventName);
        cleanedCount++;
      }
    }
    
    if (socketTracker.size === 0) {
      requestTracker.delete(socketId);
    }
  }
  
  if (cleanedCount > 0) {
    logger.debug({ cleanedCount }, 'Cleaned up expired rate limit entries');
  }
}
