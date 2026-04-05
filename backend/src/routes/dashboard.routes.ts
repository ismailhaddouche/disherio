import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { strictLimiter } from '../middlewares/rateLimit';
import * as DashboardController from '../controllers/dashboard.controller';
import * as LogsController from '../controllers/logs.controller';

const router = Router();

router.use(authMiddleware);

// Dashboard statistics endpoints (rate-limited — aggregation queries are expensive)
router.get('/stats', strictLimiter, DashboardController.getDashboardStats);
router.get('/popular-dishes', strictLimiter, DashboardController.getPopularDishes);
router.get('/category-stats', strictLimiter, DashboardController.getCategoryStats);
router.get('/realtime', strictLimiter, DashboardController.getRealtimeMetrics);

// Logs endpoints
router.get('/logs', LogsController.getLogs);
router.get('/logs/users', LogsController.getLogUsers);

export default router;
