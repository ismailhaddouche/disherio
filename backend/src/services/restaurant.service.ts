import { RestaurantRepository } from '../repositories/restaurant.repository';
import { IRestaurant } from '../models/restaurant.model';
import { cache, CacheKeys, CACHE_TTL, fetchWithCache } from './cache.service';

// Repository instance
const restaurantRepo = new RestaurantRepository();

// Type for restaurant update data (all fields optional)
export type UpdateRestaurantData = Partial<Pick<IRestaurant, 
  | 'restaurant_name'
  | 'restaurant_url'
  | 'logo_image_url'
  | 'social_links'
  | 'tax_rate'
  | 'tips_state'
  | 'tips_type'
  | 'tips_rate'
  | 'default_language'
  | 'default_theme'
  | 'currency'
>>;

export async function getRestaurantById(id: string): Promise<IRestaurant | null> {
  return fetchWithCache(
    CacheKeys.restaurant(id),
    () => restaurantRepo.findByIdLean(id),
    CACHE_TTL.RESTAURANT_CONFIG
  );
}

export async function getRestaurantConfig(id: string): Promise<IRestaurant | null> {
  return fetchWithCache(
    CacheKeys.restaurantConfig(id),
    () => restaurantRepo.findByIdLean(id),
    CACHE_TTL.RESTAURANT_CONFIG
  );
}

export async function updateRestaurant(
  id: string, 
  data: UpdateRestaurantData
): Promise<IRestaurant | null> {
  const updated = await restaurantRepo.updateRestaurant(id, data);
  
  // Invalidate all restaurant-related caches
  await cache.invalidateRestaurantCache(id);
  
  return updated;
}

/**
 * Get restaurant by URL with caching
 */
export async function getRestaurantByUrl(url: string): Promise<IRestaurant | null> {
  // Use a special key for URL lookups
  const cacheKey = `restaurant:url:${url}`;
  
  return fetchWithCache(
    cacheKey,
    () => restaurantRepo.findByUrl(url),
    CACHE_TTL.RESTAURANT_CONFIG
  );
}

/**
 * Invalidate restaurant cache by ID
 * Useful for external cache invalidation
 */
export async function invalidateRestaurantCache(id: string): Promise<void> {
  await cache.invalidateRestaurantCache(id);
}
