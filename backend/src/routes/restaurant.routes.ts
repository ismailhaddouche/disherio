import { Router } from 'express';
import * as RestaurantController from '../controllers/restaurant.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';
import { RestaurantSchema } from '@disherio/shared';

const router = Router();

router.get('/me', authenticate, RestaurantController.getMyRestaurant);
router.patch('/me', authenticate, strictLimiter, requirePermission('manage', 'Restaurant'), validate(RestaurantSchema.partial().strict()), RestaurantController.updateMyRestaurant);

// Settings endpoints (admin only)
router.get('/settings', authenticate, requirePermission('manage', 'Restaurant'), RestaurantController.getRestaurantSettings);
router.patch('/settings', authenticate, strictLimiter, requirePermission('manage', 'Restaurant'), validate(RestaurantSchema.partial().strict()), RestaurantController.updateRestaurantSettings);

export default router;
