import { MenuLanguageRepository } from '../repositories/menu-language.repository';
import { createError } from '../utils/async-handler';
import type { IMenuLanguage } from '../models/menu-language.model';
import { cache, CacheKeys, CACHE_TTL, fetchWithCache } from './cache.service';

const repo = new MenuLanguageRepository();

export async function getByRestaurant(restaurantId: string): Promise<IMenuLanguage[]> {
  return fetchWithCache(
    CacheKeys.languages(restaurantId),
    () => repo.findByRestaurantId(restaurantId),
    CACHE_TTL.CATEGORIES
  );
}

export async function getDefault(restaurantId: string): Promise<IMenuLanguage | null> {
  return fetchWithCache(
    CacheKeys.defaultLanguage(restaurantId),
    () => repo.findDefault(restaurantId),
    CACHE_TTL.CATEGORIES
  );
}

export async function create(data: {
  restaurant_id: string;
  name: string;
  code: string;
  is_default?: boolean;
  linked_app_lang?: string | null;
}): Promise<IMenuLanguage> {
  const order = await repo.getMaxOrder(data.restaurant_id);

  // If first language or marked as default, ensure it's default
  const existing = await repo.findByRestaurantId(data.restaurant_id);
  const isDefault = existing.length === 0 ? true : !!data.is_default;

  if (isDefault && existing.length > 0) {
    await repo.clearDefault(data.restaurant_id);
  }

  const language = await repo.createLanguage({
    ...data,
    is_default: isDefault,
    order,
  });

  // Invalidate cache after creation
  await Promise.all([
    cache.delete(CacheKeys.languages(data.restaurant_id)),
    cache.delete(CacheKeys.defaultLanguage(data.restaurant_id)),
  ]);

  return language;
}

export async function update(
  id: string,
  data: Partial<Pick<IMenuLanguage, 'name' | 'code' | 'linked_app_lang' | 'order'>>
): Promise<IMenuLanguage | null> {
  // Get the language to find restaurant_id for cache invalidation
  const existing = await repo.findById(id);
  if (!existing) return null;

  const updated = await repo.updateLanguage(id, data);

  // Invalidate related caches
  await Promise.all([
    cache.delete(CacheKeys.languages(existing.restaurant_id.toString())),
    cache.delete(CacheKeys.defaultLanguage(existing.restaurant_id.toString())),
  ]);

  return updated;
}

export async function setDefault(id: string, restaurantId: string): Promise<IMenuLanguage | null> {
  await repo.clearDefault(restaurantId);
  const updated = await repo.updateLanguage(id, { is_default: true });

  // Invalidate related caches
  await Promise.all([
    cache.delete(CacheKeys.languages(restaurantId)),
    cache.delete(CacheKeys.defaultLanguage(restaurantId)),
  ]);

  return updated;
}

export async function remove(id: string): Promise<void> {
  const lang = await repo.findById(id);
  if (!lang) throw createError.notFound('MENU_LANGUAGE_NOT_FOUND');
  if (lang.is_default) throw createError.badRequest('CANNOT_DELETE_DEFAULT_LANGUAGE');

  const restaurantId = lang.restaurant_id.toString();
  await repo.deleteLanguage(id);

  // Invalidate related caches
  await Promise.all([
    cache.delete(CacheKeys.languages(restaurantId)),
    cache.delete(CacheKeys.defaultLanguage(restaurantId)),
  ]);
}
