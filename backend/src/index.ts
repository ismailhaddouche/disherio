import 'dotenv/config';
import http from 'http';
import express from 'express';
import pinoHttp from 'pino-http';
import { connectDB } from './config/db';
import { initSocket } from './config/socket';
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
import menuLanguageRoutes from './routes/menu-language.routes';
import healthRoutes from './routes/health.routes';
import metricsRoutes, { metricsMiddleware } from './routes/metrics.routes';

// CRITICAL: Validate all environment variables before starting
const env = validateEnv();
const PORT = env.PORT;

// CRITICAL: JWT_SECRET must not use the default value and must be at least 32 chars
validateJWTSecretOrExit(process.env.JWT_SECRET);

logger.info('✅ JWT_SECRET validation passed');

async function bootstrap() {
  await connectDB();
  await initI18n();
  
  // Connect to Redis (non-blocking - app works without cache)
  await cache.connect().catch(() => {
    logger.warn('⚠️  Redis not available - running without distributed cache');
  });

  const app = express();
  const httpServer = http.createServer(app);

  applySecurityMiddleware(app);
  app.use(requestLogger);
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '1mb' }));
  app.use(languageMiddleware);
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
  app.use('/api/menu-languages', menuLanguageRoutes);

  // Health check endpoints
  // Metrics middleware for HTTP request tracking
  app.use(metricsMiddleware());

  app.use('/health', healthRoutes);
  
  // Prometheus metrics endpoint
  app.use('/metrics', metricsRoutes);

  // 404 handler - must go after all routes
  app.use(notFoundHandler);

  // Global error handler - must go at the END of the chain
  app.use(errorHandler);

  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
