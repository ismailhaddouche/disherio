import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';
import * as DishController from '../controllers/dish.controller';
import { CreateDishSchema, UpdateDishSchema, CategorySchema } from '@disherio/shared';

const router = Router();

router.use(authMiddleware);

// Categories
router.get('/categories', DishController.listCategories);
router.get('/categories/:id', DishController.getCategory);
router.post('/categories', strictLimiter, requirePermission('create', 'Category'), validate(CategorySchema.omit({ restaurant_id: true }).strict()), DishController.createCategory);
router.patch('/categories/:id', strictLimiter, requirePermission('update', 'Category'), validate(CategorySchema.omit({ restaurant_id: true }).partial().strict()), DishController.updateCategory);
router.delete('/categories/:id', strictLimiter, requirePermission('delete', 'Category'), DishController.deleteCategory);

// Dishes
router.get('/', DishController.listDishes);
router.get('/manage/all', requirePermission('updateAvailability', 'Dish'), DishController.listManageDishes);
router.get('/:id', DishController.getDish);
router.post('/', strictLimiter, requirePermission('create', 'Dish'), validate(CreateDishSchema.omit({ restaurant_id: true }).strict()), DishController.createDish);
router.patch('/:id', strictLimiter, requirePermission('update', 'Dish'), validate(UpdateDishSchema.omit({ restaurant_id: true }).strict()), DishController.updateDish);
router.delete('/:id', strictLimiter, requirePermission('delete', 'Dish'), DishController.deleteDish);
router.patch('/:id/toggle', strictLimiter, requirePermission('updateAvailability', 'Dish'), DishController.toggleDishStatus);

export default router;
