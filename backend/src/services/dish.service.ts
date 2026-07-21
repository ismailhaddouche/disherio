import { ErrorCode } from '@disherio/shared';
import { DishRepository, CategoryRepository } from '../repositories/dish.repository';
import { IDish, ICategory } from '../models/dish.model';
import { deleteImage } from './image.service';
import { cache, CacheKeys, CACHE_TTL, fetchWithCache } from './cache.service';
import { CreateDishData, UpdateDishData, CreateCategoryData, UpdateCategoryData } from '@disherio/shared';
import { createError } from '../utils/async-handler';
import { withLock } from '../utils/locks';

/**
 * Lock key scoping dish/category writes per restaurant. Category deletion
 * checks "no dishes use it" and then deletes; dish creation/re-categorization
 * checks "category exists" and then writes. Neither check-then-act pair is
 * safe under concurrent execution (a transaction alone would still allow both
 * to read the pre-state), so both sides serialize on this lock.
 */
function categoryWriteLockKey(restaurantId: string): string {
  return `menu-category:${restaurantId}`;
}

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
  return withLock(categoryWriteLockKey(data.restaurant_id), async () => {
    const category = await categoryRepo.findByIdAndRestaurant(data.category_id, data.restaurant_id);
    if (!category) {
      throw createError.notFound(ErrorCode.CATEGORY_NOT_FOUND);
    }
    const dish = await dishRepo.createDish(data);
    await cache.invalidateMenuCache(data.restaurant_id);
    return dish;
  });
}

export async function updateDish(
  dishId: string,
  restaurantId: string,
  data: UpdateDishData
): Promise<IDish | null> {
  const update = async (): Promise<IDish | null> => {
    const existing = await dishRepo.findByIdAndRestaurant(dishId, restaurantId);
    if (!existing) return null;

    if (data.category_id) {
      const category = await categoryRepo.findByIdAndRestaurant(data.category_id, restaurantId);
      if (!category) {
        throw createError.notFound(ErrorCode.CATEGORY_NOT_FOUND);
      }
    }

    // Defense in depth: never allow restaurant_id reassignment from the request body
    delete (data as Partial<UpdateDishData>).restaurant_id;

    const updated = await dishRepo.updateDish(dishId, restaurantId, data);
    await invalidateDishCaches(dishId, restaurantId);

    return updated;
  };

  // Only a category change can race with deleteCategory; other field updates
  // do not need the lock.
  if (data.category_id) {
    return withLock(categoryWriteLockKey(restaurantId), update);
  }
  return update();
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

export async function getCategoryByIdForRestaurant(
  id: string,
  restaurantId: string
): Promise<ICategory | null> {
  return categoryRepo.findByIdAndRestaurant(id, restaurantId);
}

export async function createCategory(data: CreateCategoryData): Promise<ICategory> {
  const category = await categoryRepo.createCategory(data);
  await cache.invalidateCategoriesCache(data.restaurant_id);
  return category;
}

export async function updateCategory(id: string, restaurantId: string, data: UpdateCategoryData): Promise<ICategory | null> {
  const existing = await categoryRepo.findByIdAndRestaurant(id, restaurantId);
  if (!existing) return null;

  const updated = await categoryRepo.updateCategory(id, restaurantId, data);
  await invalidateCategoryCaches(id, restaurantId);

  return updated;
}

export async function deleteCategory(id: string, restaurantId: string): Promise<ICategory | null> {
  return withLock(categoryWriteLockKey(restaurantId), async () => {
    const existing = await categoryRepo.findByIdAndRestaurant(id, restaurantId);
    if (!existing) return null;

    // Verify no dishes are using this category. Holding the per-restaurant
    // lock guarantees no dish can be created into (or moved into) this
    // category between the count and the delete.
    const dishesInCategory = await dishRepo.countByCategory(id, restaurantId);
    if (dishesInCategory > 0) {
      throw new Error(ErrorCode.CATEGORY_HAS_DISHES);
    }

    if (existing.category_image_url) {
      await deleteImage(existing.category_image_url);
    }

    const deleted = await categoryRepo.deleteCategory(id, restaurantId);
    await invalidateCategoryCaches(id, restaurantId);

    return deleted;
  });
}
