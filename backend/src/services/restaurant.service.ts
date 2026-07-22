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
  const current = await restaurantRepo.findByIdLean(id);
  if (!current) return null;

  const enabledLanguages = data.enabled_languages ?? current.enabled_languages ?? [...ALL_LANGUAGES];
  const invalidLanguages = enabledLanguages.filter((language) => !ALL_LANGUAGES.includes(language));
  if (enabledLanguages.length === 0 || invalidLanguages.length > 0) {
    throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
  }

  const requestedDefault = data.default_language ?? current.default_language;
  if (!enabledLanguages.includes(requestedDefault)) {
    if (data.default_language !== undefined) {
      throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
    }
    data = { ...data, default_language: enabledLanguages[0] };
  }

  const tipsState = data.tips_state ?? current.tips_state;
  const tipsType = data.tips_type ?? current.tips_type;
  const tipsRate = data.tips_rate ?? current.tips_rate;
  if (tipsState && tipsType === 'MANDATORY' && (tipsRate === undefined || tipsRate <= 0)) {
    throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
  }

  // Capture the current URL before updating so its cache key can also be
  // invalidated when the URL itself changes (getRestaurantByUrl caches under
  // `restaurant:url:<url>`).
  const previousUrl = data.restaurant_url !== undefined ? current.restaurant_url : undefined;

  const updated = await restaurantRepo.updateRestaurant(id, data);

  const result = updated;

  const urlsToInvalidate = [...new Set(
    [previousUrl, result?.restaurant_url].filter((url): url is string => Boolean(url))
  )];
  await cache.invalidateRestaurantCache(id, urlsToInvalidate);

  return result;
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
