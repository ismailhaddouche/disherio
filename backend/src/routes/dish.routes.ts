import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import * as DishController from '../controllers/dish.controller';

const router = Router();

router.use(authMiddleware);

// Categories
router.get('/categories', DishController.listCategories);
router.get('/categories/:id', DishController.getCategory);
router.post('/categories', strictLimiter, requirePermission('create', 'Category'), DishController.createCategory);
router.patch('/categories/:id', strictLimiter, requirePermission('update', 'Category'), DishController.updateCategory);
router.delete('/categories/:id', strictLimiter, requirePermission('delete', 'Category'), DishController.deleteCategory);

// Dishes
router.get('/', DishController.listDishes);
router.get('/:id', DishController.getDish);
router.post('/', strictLimiter, requirePermission('create', 'Dish'), DishController.createDish);
router.patch('/:id', strictLimiter, requirePermission('update', 'Dish'), DishController.updateDish);
router.delete('/:id', strictLimiter, requirePermission('delete', 'Dish'), DishController.deleteDish);
router.patch('/:id/toggle', strictLimiter, requirePermission('update', 'Dish'), DishController.toggleDishStatus);

export default router;
