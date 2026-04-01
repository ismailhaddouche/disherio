import { Router } from 'express';
import * as RestaurantController from '../controllers/restaurant.controller';
import { authenticate } from '../middlewares/auth';
import { strictLimiter } from '../middlewares/rateLimit';

const router = Router();

router.get('/me', authenticate, RestaurantController.getMyRestaurant);
router.patch('/me', authenticate, strictLimiter, RestaurantController.updateMyRestaurant);

// Settings endpoints
router.get('/settings', authenticate, RestaurantController.getRestaurantSettings);
router.patch('/settings', authenticate, strictLimiter, RestaurantController.updateRestaurantSettings);

export default router;
