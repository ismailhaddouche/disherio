import { Router, Request, Response } from 'express';
import promClient from 'prom-client';
import { logger } from '../config/logger';
import { getHttpMethodLabel, getHttpRouteLabel } from '../utils/http-route-label';

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

/**
 * Express middleware to track HTTP metrics
 * Records request count, duration, and sizes
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: () => void) => {
    const start = Date.now();
    const requestSize = parseInt(req.get('content-length') || '0', 10);
    res.once('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const status = res.statusCode.toString();
      const route = getHttpRouteLabel(req);
      const method = getHttpMethodLabel(req.method);

      httpRequestsTotal.inc({ method, route, status });
      httpRequestDuration.observe({ method, route }, duration);
      if (requestSize > 0) {
        httpRequestSize.observe({ method, route }, requestSize);
      }

      const responseSize = Number(res.getHeader('content-length') || 0);
      if (responseSize > 0) {
        httpResponseSize.observe({ method, route }, responseSize);
      }

      if (duration > 1) {
        logger.warn({
          method: req.method,
          route,
          duration,
          status
        }, 'Slow request detected');
      }
    });

    next();
  };
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
