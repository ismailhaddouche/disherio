import { DishRepository, CategoryRepository } from '../repositories/dish.repository';
import { IDish, ICategory } from '../models/dish.model';
import { cache, CacheKeys } from './cache.service';
import { Types } from 'mongoose';

// Local types (previously from @disherio/shared)
interface LocalizedString {
  es: string;
  en: string;
  fr?: string;
  ar?: string;
}

interface VariantInput {
  variant_name: LocalizedString;
  variant_price: number;
  variant_description?: LocalizedString;
  variant_url_image?: string;
}

interface ExtraInput {
  extra_name: LocalizedString;
  extra_price: number;
  extra_description?: LocalizedString;
  extra_url_image?: string;
}

export interface CreateDishData {
  restaurant_id: string;
  category_id: string;
  disher_name: LocalizedString;
  disher_description?: LocalizedString;
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
  disher_url_image?: string;
  variants?: VariantInput[];
  extras?: ExtraInput[];
}

export interface UpdateDishData {
  restaurant_id?: string;
  category_id?: string;
  disher_name?: LocalizedString;
  disher_description?: LocalizedString;
  disher_price?: number;
  disher_type?: 'KITCHEN' | 'SERVICE';
  disher_url_image?: string;
  variants?: VariantInput[];
  extras?: ExtraInput[];
}

export interface CreateCategoryData {
  restaurant_id: string;
  category_name: LocalizedString;
  category_description?: LocalizedString;
  category_order?: number;
  category_image_url?: string;
}

export interface UpdateCategoryData {
  restaurant_id?: string;
  category_name?: LocalizedString;
  category_description?: LocalizedString;
  category_order?: number;
  category_image_url?: string;
}

// Repository instances
const dishRepo = new DishRepository();
const categoryRepo = new CategoryRepository();

// Cache TTL en ms
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

// Cache invalidation helpers
function invalidateDishCaches(dishId: string, restaurantId?: string): void {
  cache.delete(CacheKeys.dishById(dishId));
  if (restaurantId) {
    cache.delete(CacheKeys.dishByRestaurant(restaurantId));
  }
}

function invalidateCategoryCaches(categoryId: string, restaurantId?: string): void {
  cache.delete(CacheKeys.categoryById(categoryId));
  if (restaurantId) {
    cache.delete(CacheKeys.categoriesByRestaurant(restaurantId));
  }
}

// Generic cached fetch helper
async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached) return cached;
  
  const data = await fetcher();
  cache.set(key, data, ttl);
  return data;
}

export async function getDishesByRestaurant(restaurantId: string, _lang: string = 'es'): Promise<IDish[]> {
  return fetchWithCache(
    CacheKeys.dishByRestaurant(restaurantId),
    () => dishRepo.findActiveByRestaurantId(restaurantId)
  );
}

export async function getDishById(dishId: string): Promise<IDish | null> {
  const dish = await fetchWithCache(
    CacheKeys.dishById(dishId),
    () => dishRepo.findByIdWithDetails(dishId)
  );
  return dish;
}

export async function createDish(data: CreateDishData): Promise<IDish> {
  const dish = await dishRepo.createDish(data as unknown as Parameters<typeof dishRepo.createDish>[0]);
  cache.delete(CacheKeys.dishByRestaurant(data.restaurant_id));
  return dish;
}

export async function updateDish(dishId: string, data: UpdateDishData): Promise<IDish | null> {
  const existing = await dishRepo.findById(dishId);
  if (!existing) return null;
  
  const updated = await dishRepo.updateDish(dishId, data as unknown as Parameters<typeof dishRepo.updateDish>[1]);
  const restaurantId = data.restaurant_id || existing.restaurant_id.toString();
  invalidateDishCaches(dishId, restaurantId);
  
  return updated;
}

export async function deleteDish(dishId: string): Promise<IDish | null> {
  const existing = await dishRepo.findById(dishId);
  if (!existing) return null;
  
  const deleted = await dishRepo.delete(dishId);
  invalidateDishCaches(dishId, existing.restaurant_id.toString());
  
  return deleted;
}

export async function toggleDishStatus(dishId: string): Promise<IDish | null> {
  const existing = await dishRepo.findById(dishId);
  if (!existing) return null;
  
  const updated = await dishRepo.toggleStatus(dishId);
  invalidateDishCaches(dishId, existing.restaurant_id.toString());
  
  return updated;
}

export async function getCategoriesByRestaurant(restaurantId: string): Promise<ICategory[]> {
  return fetchWithCache(
    CacheKeys.categoriesByRestaurant(restaurantId),
    () => categoryRepo.findByRestaurantId(restaurantId)
  );
}

export async function getCategoryById(id: string): Promise<ICategory | null> {
  return fetchWithCache(
    CacheKeys.categoryById(id),
    () => categoryRepo.findById(id)
  );
}

export async function createCategory(data: CreateCategoryData): Promise<ICategory> {
  const category = await categoryRepo.createCategory(data as unknown as Parameters<typeof categoryRepo.createCategory>[0]);
  cache.delete(CacheKeys.categoriesByRestaurant(data.restaurant_id));
  return category;
}

export async function updateCategory(id: string, data: UpdateCategoryData): Promise<ICategory | null> {
  const existing = await categoryRepo.findById(id);
  if (!existing) return null;
  
  const updated = await categoryRepo.updateCategory(id, data as unknown as Parameters<typeof categoryRepo.updateCategory>[1]);
  const restaurantId = data.restaurant_id || existing.restaurant_id.toString();
  invalidateCategoryCaches(id, restaurantId);
  
  return updated;
}

export async function deleteCategory(id: string): Promise<ICategory | null> {
  const existing = await categoryRepo.findById(id);
  if (!existing) return null;
  
  // Verificar que no haya platos usando esta categoria
  const dishesInCategory = await dishRepo.countByCategory(id);
  if (dishesInCategory > 0) {
    throw new Error('CATEGORY_HAS_DISHES');
  }
  
  const deleted = await categoryRepo.deleteCategory(id);
  invalidateCategoryCaches(id, existing.restaurant_id.toString());
  
  return deleted;
}
