import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import * as DishService from '../services/dish.service';

export const getDish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dish = await DishService.getDishById(String(req.params.id));
  if (!dish) {
    throw createError.notFound('DISH_NOT_FOUND');
  }
  res.json(dish);
});

export const listDishes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit, skip } = getPaginationParams(req);
  const { dishes, total } = await DishService.getDishesByRestaurantPaginated(
    req.user!.restaurantId, 
    req.lang,
    skip,
    limit
  );
  res.json(createPaginatedResponse(dishes, total, page, limit));
});

export const createDish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dish = await DishService.createDish({ ...req.body, restaurant_id: req.user!.restaurantId });
  res.status(201).json(dish);
});

export const updateDish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dish = await DishService.updateDish(String(req.params.id), req.body);
  if (!dish) {
    throw createError.notFound('DISH_NOT_FOUND');
  }
  res.json(dish);
});

export const deleteDish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await DishService.deleteDish(String(req.params.id));
  res.status(204).end();
});

export const toggleDishStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const dish = await DishService.toggleDishStatus(String(req.params.id));
  res.json(dish);
});

export const listCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const categories = await DishService.getCategoriesByRestaurant(req.user!.restaurantId);
  res.json(categories);
});

export const getCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = await DishService.getCategoryById(String(req.params.id));
  if (!category) {
    throw createError.notFound('CATEGORY_NOT_FOUND');
  }
  res.json(category);
});

export const createCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = await DishService.createCategory({ ...req.body, restaurant_id: req.user!.restaurantId });
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const category = await DishService.updateCategory(String(req.params.id), req.body);
  if (!category) {
    throw createError.notFound('CATEGORY_NOT_FOUND');
  }
  res.json(category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await DishService.deleteCategory(String(req.params.id));
  res.status(204).end();
});
