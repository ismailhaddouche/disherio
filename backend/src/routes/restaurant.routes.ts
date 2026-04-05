import { Router } from 'express';
import * as RestaurantController from '../controllers/restaurant.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';

const router = Router();

router.get('/me', authenticate, RestaurantController.getMyRestaurant);
router.patch('/me', authenticate, strictLimiter, RestaurantController.updateMyRestaurant);

// Settings endpoints (admin only)
router.get('/settings', authenticate, RestaurantController.getRestaurantSettings);
router.patch('/settings', authenticate, strictLimiter, requirePermission('manage', 'Restaurant'), RestaurantController.updateRestaurantSettings);

export default router;
