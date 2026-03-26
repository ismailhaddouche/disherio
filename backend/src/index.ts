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
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import authRoutes from './routes/auth.routes';
import dishRoutes from './routes/dish.routes';
import orderRoutes from './routes/order.routes';
import totemRoutes from './routes/totem.routes';
import uploadRoutes from './routes/image.routes';
import restaurantRoutes from './routes/restaurant.routes';

const PORT = process.env.PORT || 3000;

// VALIDACIÓN CRÍTICA: JWT_SECRET no puede ser el valor por defecto
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'changeme_in_production') {
  logger.error('❌ JWT_SECRET is not set or uses default value. Please set a secure JWT_SECRET in .env');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  logger.warn('⚠️  JWT_SECRET is less than 32 characters. Consider using a longer secret for better security.');
}

async function bootstrap() {
  await connectDB();
  await initI18n();

  const app = express();
  const httpServer = http.createServer(app);

  applySecurityMiddleware(app);
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

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // 404 handler - debe ir después de todas las rutas
  app.use(notFoundHandler);

  // Global error handler - debe ir al FINAL de la cadena
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
