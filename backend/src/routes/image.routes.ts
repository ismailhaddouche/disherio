import { Router } from 'express';
import * as ImageController from '../controllers/image.controller';
import { authenticate } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { uploadLimiter } from '../middlewares/rateLimit';

const router = Router();

// Endpoint for dishes - Requires AUTH, Dish update permission, and resource ownership
router.post('/dishes/:id',
  authenticate,
  requirePermission('update', 'Dish'),
  uploadLimiter,
  ImageController.uploadMiddleware.single('image'),
  ImageController.handleMulterError,
  ImageController.uploadDishImage
);

// Endpoint for categories - Requires AUTH, Category update permission, and resource ownership
router.post('/categories/:id',
  authenticate,
  requirePermission('update', 'Category'),
  uploadLimiter,
  ImageController.uploadMiddleware.single('image'),
  ImageController.handleMulterError,
  ImageController.uploadCategoryImage
);

// Endpoint for restaurant logo - Requires AUTH and Restaurant manage permission
router.post('/restaurant',
  authenticate,
  requirePermission('manage', 'Restaurant'),
  uploadLimiter,
  ImageController.uploadMiddleware.single('image'),
  ImageController.handleMulterError,
  ImageController.uploadRestaurantLogo
);

export default router;
