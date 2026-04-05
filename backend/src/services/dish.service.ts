import { ErrorCode } from '@disherio/shared';
import { DishRepository, CategoryRepository } from '../repositories/dish.repository';
import { IDish, ICategory } from '../models/dish.model';
import { deleteImage } from './image.service';
import { cache, CacheKeys, CACHE_TTL, fetchWithCache } from './cache.service';
import { CreateDishData, UpdateDishData, CreateCategoryData, UpdateCategoryData } from '@disherio/shared';

// Repository instances
const dishRepo = new DishRepository();
const categoryRepo = new CategoryRepository();

// Cache invalidation helpers
async function invalidateDishCaches(dishId: string, restaurantId?: string): Promise<void> {
  await cache.delete(CacheKeys.dish(dishId));
  if (restaurantId) {
    await cache.delete(CacheKeys.dishesByRestaurant(restaurantId));
    await cache.invalidateMenuCache(restaurantId);
  }
}

async function invalidateCategoryCaches(categoryId: string, restaurantId?: string): Promise<void> {
  await cache.delete(CacheKeys.category(categoryId));
  if (restaurantId) {
    await cache.invalidateCategoriesCache(restaurantId);
  }
}

export async function getDishesByRestaurant(restaurantId: string, _lang: string = 'es'): Promise<IDish[]> {
  return fetchWithCache(
    CacheKeys.dishesByRestaurant(restaurantId),
    () => dishRepo.findActiveByRestaurantId(restaurantId),
    CACHE_TTL.MENU
  );
}

export async function getDishesByRestaurantPaginated(
  restaurantId: string,
  _lang: string = 'es',
  skip: number = 0,
  limit: number = 50
): Promise<{ dishes: IDish[]; total: number }> {
  // Note: Pagination bypasses cache for consistency
  const [dishes, total] = await Promise.all([
    dishRepo.findActiveByRestaurantIdPaginated(restaurantId, skip, limit),
    dishRepo.countActiveByRestaurantId(restaurantId),
  ]);
  return { dishes, total };
}

export async function getDishById(dishId: string): Promise<IDish | null> {
  return fetchWithCache(
    CacheKeys.dish(dishId),
    () => dishRepo.findByIdWithDetails(dishId),
    CACHE_TTL.MENU
  );
}

export async function createDish(data: CreateDishData): Promise<IDish> {
  const dish = await dishRepo.createDish(data);
  await cache.invalidateMenuCache(data.restaurant_id);
  return dish;
}

export async function updateDish(dishId: string, data: UpdateDishData): Promise<IDish | null> {
  const existing = await dishRepo.findById(dishId);
  if (!existing) return null;
  
  const updated = await dishRepo.updateDish(dishId, data);
  const restaurantId = data.restaurant_id || existing.restaurant_id.toString();
  await invalidateDishCaches(dishId, restaurantId);
  
  return updated;
}

export async function deleteDish(dishId: string): Promise<IDish | null> {
  const existing = await dishRepo.findById(dishId);
  if (!existing) return null;

  if (existing.disher_url_image) {
    await deleteImage(existing.disher_url_image);
  }

  const deleted = await dishRepo.delete(dishId);
  await invalidateDishCaches(dishId, existing.restaurant_id.toString());

  return deleted;
}

export async function toggleDishStatus(dishId: string): Promise<IDish | null> {
  const existing = await dishRepo.findById(dishId);
  if (!existing) return null;
  
  const updated = await dishRepo.toggleStatus(dishId);
  await invalidateDishCaches(dishId, existing.restaurant_id.toString());
  
  return updated;
}

export async function getCategoriesByRestaurant(restaurantId: string): Promise<ICategory[]> {
  return fetchWithCache(
    CacheKeys.categoriesByRestaurant(restaurantId),
    () => categoryRepo.findByRestaurantId(restaurantId),
    CACHE_TTL.CATEGORIES
  );
}

export async function getCategoryById(id: string): Promise<ICategory | null> {
  return fetchWithCache(
    CacheKeys.category(id),
    () => categoryRepo.findById(id),
    CACHE_TTL.CATEGORIES
  );
}

export async function createCategory(data: CreateCategoryData): Promise<ICategory> {
  const category = await categoryRepo.createCategory(data);
  await cache.invalidateCategoriesCache(data.restaurant_id);
  return category;
}

export async function updateCategory(id: string, data: UpdateCategoryData): Promise<ICategory | null> {
  const existing = await categoryRepo.findById(id);
  if (!existing) return null;
  
  const updated = await categoryRepo.updateCategory(id, data);
  const restaurantId = data.restaurant_id || existing.restaurant_id.toString();
  await invalidateCategoryCaches(id, restaurantId);
  
  return updated;
}

export async function deleteCategory(id: string): Promise<ICategory | null> {
  const existing = await categoryRepo.findById(id);
  if (!existing) return null;

  // Verify no dishes are using this category
  const dishesInCategory = await dishRepo.countByCategory(id);
  if (dishesInCategory > 0) {
    throw new Error(ErrorCode.CATEGORY_HAS_DISHES);
  }

  if (existing.category_image_url) {
    await deleteImage(existing.category_image_url);
  }

  const deleted = await categoryRepo.deleteCategory(id);
  await invalidateCategoryCaches(id, existing.restaurant_id.toString());

  return deleted;
}
