import { Router, Request, Response } from 'express';
import promClient from 'prom-client';
import { logger } from '../config/logger';

const router = Router();

// Create a custom registry for DisherIO metrics
const register = new promClient.Registry();

// Collect default Node.js metrics
promClient.collectDefaultMetrics({ 
  register,
  prefix: 'disherio_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// ============================================
// Custom HTTP Metrics
// ============================================

export const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register]
});

export const httpRequestSize = new promClient.Histogram({
  name: 'http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register]
});

export const httpResponseSize = new promClient.Histogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register]
});

// ============================================
// Business Metrics
// ============================================

export const ordersCreatedTotal = new promClient.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['restaurant_id', 'channel'], // channel: pos, totem, online
  registers: [register]
});

export const ordersCompletedTotal = new promClient.Counter({
  name: 'orders_completed_total',
  help: 'Total number of orders completed',
  labelNames: ['restaurant_id'],
  registers: [register]
});

export const ordersCancelledTotal = new promClient.Counter({
  name: 'orders_cancelled_total',
  help: 'Total number of orders cancelled',
  labelNames: ['restaurant_id', 'reason'],
  registers: [register]
});

export const ordersFailedTotal = new promClient.Counter({
  name: 'orders_failed_total',
  help: 'Total number of orders that failed',
  labelNames: ['restaurant_id', 'error_type'],
  registers: [register]
});

export const orderProcessingDuration = new promClient.Histogram({
  name: 'order_processing_duration_seconds',
  help: 'Time taken to process orders',
  labelNames: ['restaurant_id', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register]
});

export const activeOrders = new promClient.Gauge({
  name: 'active_orders',
  help: 'Number of currently active orders',
  labelNames: ['restaurant_id', 'status'],
  registers: [register]
});

// ============================================
// Authentication Metrics
// ============================================

export const authAttemptsTotal = new promClient.Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'status'], // type: login, refresh, logout; status: success, failure
  registers: [register]
});

export const activeSessions = new promClient.Gauge({
  name: 'active_sessions',
  help: 'Number of active user sessions',
  labelNames: ['user_type'], // admin, staff, customer
  registers: [register]
});

// ============================================
// Cache Metrics
// ============================================

export const cacheOperationsTotal = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'], // operation: get, set, del; result: hit, miss, error
  registers: [register]
});

export const cacheOperationDuration = new promClient.Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Cache operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register]
});

// ============================================
// Database Metrics
// ============================================

export const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['collection', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

export const dbConnectionsActive = new promClient.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register]
});

// ============================================
// WebSocket Metrics
// ============================================

export const websocketConnectionsTotal = new promClient.Counter({
  name: 'websocket_connections_total',
  help: 'Total number of WebSocket connections',
  labelNames: ['handler'], // kds, pos, totem
  registers: [register]
});

export const websocketConnectionsActive = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['handler'],
  registers: [register]
});

export const websocketMessagesTotal = new promClient.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['handler', 'direction'], // direction: sent, received
  registers: [register]
});

// ============================================
// Export middleware and utilities
// ============================================

/**
 * Express middleware to track HTTP metrics
 * Records request count, duration, and sizes
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: () => void) => {
    const start = Date.now();
    const route = req.route?.path || req.path || 'unknown';
    
    // Track request size if available
    const requestSize = parseInt(req.get('content-length') || '0', 10);
    if (requestSize > 0) {
      httpRequestSize.observe({ method: req.method, route }, requestSize);
    }

    // Override res.end to capture response metrics
    const originalEnd = res.end.bind(res);
    res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
      const duration = (Date.now() - start) / 1000;
      const status = res.statusCode.toString();
      
      // Record metrics
      httpRequestsTotal.inc({ method: req.method, route, status });
      httpRequestDuration.observe({ method: req.method, route }, duration);
      
      // Track response size
      const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;
      if (responseSize > 0) {
        httpResponseSize.observe({ method: req.method, route }, responseSize);
      }
      
      // Log slow requests
      if (duration > 1) {
        logger.warn({ 
          method: req.method, 
          route, 
          duration, 
          status 
        }, 'Slow request detected');
      }
      
      return originalEnd(chunk, encoding, cb);
    };

    next();
  };
}

/**
 * Track order creation
 */
export function recordOrderCreated(restaurantId: string, channel: string = 'pos') {
  ordersCreatedTotal.inc({ restaurant_id: restaurantId, channel });
}

/**
 * Track order completion
 */
export function recordOrderCompleted(restaurantId: string, durationSeconds: number) {
  ordersCompletedTotal.inc({ restaurant_id: restaurantId });
  orderProcessingDuration.observe({ restaurant_id: restaurantId, status: 'completed' }, durationSeconds);
}

/**
 * Track order cancellation
 */
export function recordOrderCancelled(restaurantId: string, reason: string) {
  ordersCancelledTotal.inc({ restaurant_id: restaurantId, reason });
}

/**
 * Track order failure
 */
export function recordOrderFailed(restaurantId: string, errorType: string) {
  ordersFailedTotal.inc({ restaurant_id: restaurantId, error_type: errorType });
}

/**
 * Update active orders count
 */
export function setActiveOrders(restaurantId: string, status: string, count: number) {
  activeOrders.set({ restaurant_id: restaurantId, status }, count);
}

/**
 * Track authentication attempt
 */
export function recordAuthAttempt(type: string, success: boolean) {
  authAttemptsTotal.inc({ type, status: success ? 'success' : 'failure' });
}

/**
 * Track cache operation
 */
export function recordCacheOperation(operation: string, result: 'hit' | 'miss' | 'error', durationSeconds: number) {
  cacheOperationsTotal.inc({ operation, result });
  cacheOperationDuration.observe({ operation }, durationSeconds);
}

/**
 * Track database query
 */
export function recordDbQuery(collection: string, operation: string, durationSeconds: number) {
  dbQueryDuration.observe({ collection, operation }, durationSeconds);
}

/**
 * Track WebSocket connection
 */
export function recordWebSocketConnection(handler: string, connected: boolean) {
  if (connected) {
    websocketConnectionsTotal.inc({ handler });
    websocketConnectionsActive.inc({ handler });
  } else {
    websocketConnectionsActive.dec({ handler });
  }
}

/**
 * Track WebSocket message
 */
export function recordWebSocketMessage(handler: string, direction: 'sent' | 'received') {
  websocketMessagesTotal.inc({ handler, direction });
}

// ============================================
// Prometheus Metrics Endpoint
// ============================================

/**
 * @route   GET /metrics
 * @desc    Prometheus metrics endpoint
 * @access  Public (protected by network in production)
 * 
 * Returns all collected metrics in Prometheus exposition format
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error({ error }, 'Failed to generate metrics');
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

export default router;
