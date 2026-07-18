import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { connectDB, disconnectDB } from './config/db';
import { initSocket, cleanupSocketServer } from './config/socket';
import { initI18n } from './config/i18n';
import { applySecurityMiddleware } from './middlewares/security';
import { apiLimiter } from './middlewares/rateLimit';
import { languageMiddleware } from './middlewares/language';
import { logger } from './config/logger';
import requestLogger from './middlewares/request-logger';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { validateJWTSecretOrExit } from './utils/jwt-validation';
import { validateEnv } from './config/env';
import { cache } from './services/cache.service';
import authRoutes from './routes/auth.routes';
import dishRoutes from './routes/dish.routes';
import orderRoutes from './routes/order.routes';
import totemRoutes from './routes/totem.routes';
import uploadRoutes from './routes/image.routes';
import restaurantRoutes from './routes/restaurant.routes';
import dashboardRoutes from './routes/dashboard.routes';
import staffRoutes from './routes/staff.routes';
import customerRoutes from './routes/customer.routes';
import healthRoutes from './routes/health.routes';
import metricsRoutes, { metricsMiddleware } from './routes/metrics.routes';
import { ensureRefreshTokenLookupIndex } from './services/refresh-token.service';
import { closeRedisConnections } from './config/redis';
import { ensureUniqueStaffPinIndex } from './services/staff-security-index.service';

// CRITICAL: Validate all environment variables before starting
const env = validateEnv();
const PORT = env.PORT;
const SHUTDOWN_TIMEOUT_MS = 10_000;

// CRITICAL: JWT_SECRET must not use the default value and must be at least 32 chars
validateJWTSecretOrExit(env.JWT_SECRET);

logger.info('[OK] JWT_SECRET validation passed');

async function bootstrap() {
  await connectDB();
  await ensureUniqueStaffPinIndex();
  // i18n is non-blocking: a missing locale file shouldn't prevent startup
  await initI18n().catch((err) => {
    logger.warn({ err }, '[WARN]  i18n initialization failed - running without translations');
  });

  // Connect to Redis (non-blocking - app works without cache)
  await cache.connect().catch(() => {
    logger.warn('[WARN]  Redis not available - running without distributed cache');
  });
  await ensureRefreshTokenLookupIndex()
    .then((indexed) => {
      if (indexed > 0) logger.info({ indexed }, 'Refresh-token lookup index synchronized');
    })
    .catch((err) => {
      logger.warn({ err }, 'Refresh-token lookup index could not be synchronized');
    });

  const app = express();
  const httpServer = http.createServer(app);

  if (env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
    logger.info('Trust proxy enabled');
  }

  applySecurityMiddleware(app);
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(pinoHttp({ logger, autoLogging: false }));
  app.use(express.json({ limit: '500kb' }));
  app.use(languageMiddleware);

  // Metrics middleware must be BEFORE routes so it can track all HTTP requests
  app.use(metricsMiddleware());

  // Serve uploaded files statically (in dev/local; Caddy handles this in prod).
  // Deny dotfiles and restrict to image extensions as defense in depth, even
  // though the upload pipeline already validates content and converts to WebP.
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  app.use(
    '/uploads',
    (req, res, next) => {
      // Reject paths that do not end in an allowed image extension.
      const allowed = /\.(jpg|jpeg|png|webp)$/i;
      if (!allowed.test(req.path)) {
        res.status(404).end();
        return;
      }
      next();
    },
    express.static(uploadsDir, { dotfiles: 'deny', maxAge: '1d', etag: true })
  );

  app.use('/api', apiLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/dishes', dishRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/totems', totemRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/restaurant', restaurantRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/customers', customerRoutes);

  // Health check endpoints
  app.use('/health', healthRoutes);

  // Optional metrics endpoint. Caddy does not route it publicly, so operators
  // must attach any external collector to the internal Docker network.
  app.use('/metrics', metricsRoutes);

  // 404 handler - must go after all routes
  app.use(notFoundHandler);

  // Global error handler - must go at the END of the chain
  app.use(errorHandler);

  await initSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown started');

    const forcedExit = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Graceful shutdown timed out');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forcedExit.unref();

    const socketOutcomes = await Promise.allSettled([cleanupSocketServer()]);
    const dependencyOutcomes = await Promise.allSettled([
      cache.disconnect(),
      closeRedisConnections(),
      disconnectDB(),
    ]);
    const failures = [...socketOutcomes, ...dependencyOutcomes]
      .filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
      .map((outcome) => outcome.reason);

    clearTimeout(forcedExit);
    if (failures.length > 0) {
      logger.error({ failures }, 'Graceful shutdown completed with errors');
      process.exit(1);
    }
    logger.info('Graceful shutdown completed');
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
