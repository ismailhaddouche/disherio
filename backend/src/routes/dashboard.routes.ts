import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import * as DashboardController from '../controllers/dashboard.controller';
import * as LogsController from '../controllers/logs.controller';

const router = Router();

router.use(authMiddleware);

// Dashboard statistics endpoints (admin only — aggregation queries are expensive)
router.get('/stats', requirePermission('manage', 'Restaurant'), DashboardController.getDashboardStats);
router.get('/popular-dishes', requirePermission('manage', 'Restaurant'), DashboardController.getPopularDishes);
router.get('/category-stats', requirePermission('manage', 'Restaurant'), DashboardController.getCategoryStats);
router.get('/realtime', requirePermission('manage', 'Restaurant'), DashboardController.getRealtimeMetrics);

// Logs endpoints (admin only)
router.get('/logs', requirePermission('manage', 'Restaurant'), LogsController.getLogs);
router.get('/logs/users', requirePermission('manage', 'Restaurant'), LogsController.getLogUsers);

export default router;
