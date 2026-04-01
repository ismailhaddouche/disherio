import { Router } from 'express';
import * as ImageController from '../controllers/image.controller';
import { authenticate } from '../middlewares/auth';
import { uploadLimiter } from '../middlewares/rateLimit';

const router = Router();

// Endpoint for dishes - Requires AUTH
router.post('/dishes', 
  authenticate,
  uploadLimiter,
  ImageController.uploadMiddleware.single('image'),
  ImageController.handleMulterError,
  ImageController.uploadDishImage
);

// Endpoint for categories - Requires AUTH
router.post('/categories', 
  authenticate,
  uploadLimiter,
  ImageController.uploadMiddleware.single('image'),
  ImageController.handleMulterError,
  ImageController.uploadCategoryImage
);

// Endpoint for restaurant logo - Requires AUTH
router.post('/restaurant', 
  authenticate,
  uploadLimiter,
  ImageController.uploadMiddleware.single('image'),
  ImageController.handleMulterError,
  ImageController.uploadRestaurantLogo
);

export default router;
