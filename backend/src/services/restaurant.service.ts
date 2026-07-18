import { RestaurantRepository } from '../repositories/restaurant.repository';
import { IRestaurant } from '../models/restaurant.model';
import { cache, CacheKeys, CACHE_TTL, fetchWithCache } from './cache.service';
import { createError } from '../utils/async-handler';
import { ErrorCode } from '@disherio/shared';

// Repository instance
const restaurantRepo = new RestaurantRepository();

const ALL_LANGUAGES: ReadonlyArray<'es' | 'en' | 'fr'> = ['es', 'en', 'fr'];

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
  | 'enabled_languages'
  | 'currency'
  | 'order_interval_minutes'
  | 'max_orders_per_session'
>>;

export async function getRestaurantById(id: string): Promise<IRestaurant | null> {
  return fetchWithCache(
    CacheKeys.restaurant(id),
    () => restaurantRepo.findByIdLean(id),
    CACHE_TTL.RESTAURANT_CONFIG
  );
}

export async function updateRestaurant(
  id: string,
  data: UpdateRestaurantData
): Promise<IRestaurant | null> {
  // Validate enabled_languages: each must be a known language, at least one
  // must remain enabled, and default_language must be in the set.
  if (data.enabled_languages !== undefined) {
    const langs = data.enabled_languages;
    if (!Array.isArray(langs) || langs.length === 0) {
      throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
    }
    const invalid = langs.filter((l) => !ALL_LANGUAGES.includes(l as 'es' | 'en' | 'fr'));
    if (invalid.length > 0) {
      throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
    }
  }

  const updated = await restaurantRepo.updateRestaurant(id, data);

  // If default_language is not in enabled_languages, auto-adjust it.
  if (updated && data.enabled_languages !== undefined) {
    const enabled = updated.enabled_languages ?? ['es', 'en', 'fr'];
    if (!enabled.includes(updated.default_language)) {
      const adjusted = await restaurantRepo.updateRestaurant(id, {
        default_language: enabled[0] as 'es' | 'en' | 'fr',
      });
      if (adjusted) return adjusted;
    }
  }

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
