import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import * as RestaurantService from '../services/restaurant.service';
import type { UpdateRestaurantData } from '../services/restaurant.service';

const RESTAURANT_UPDATE_FIELDS = [
  'restaurant_name',
  'restaurant_url',
  'logo_image_url',
  'social_links',
  'tax_rate',
  'tips_state',
  'tips_type',
  'tips_rate',
  'default_language',
  'default_theme',
  'enabled_languages',
  'currency',
  'order_interval_minutes',
  'max_orders_per_session',
] as const;

function serializeRestaurantSettings(restaurant: Awaited<ReturnType<typeof RestaurantService.getRestaurantById>>) {
  if (!restaurant) return null;
  return {
    _id: restaurant._id,
    restaurant_name: restaurant.restaurant_name,
    restaurant_url: restaurant.restaurant_url,
    logo_image_url: restaurant.logo_image_url,
    social_links: restaurant.social_links,
    tax_rate: restaurant.tax_rate,
    currency: restaurant.currency,
    default_language: restaurant.default_language,
    default_theme: restaurant.default_theme,
    enabled_languages: restaurant.enabled_languages ?? ['es', 'en', 'fr'],
    tips_state: restaurant.tips_state,
    tips_type: restaurant.tips_type,
    tips_rate: restaurant.tips_rate,
    order_interval_minutes: restaurant.order_interval_minutes ?? 0,
    max_orders_per_session: restaurant.max_orders_per_session ?? 0,
  };
}

function pickRestaurantUpdate(body: Record<string, unknown>): UpdateRestaurantData {
  const update: Record<string, unknown> = {};
  for (const field of RESTAURANT_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      update[field] = body[field];
    }
  }
  return update as UpdateRestaurantData;
}

export const getMyRestaurant = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantService.getRestaurantById(req.user!.restaurantId);
  if (!restaurant) {
    throw createError.notFound('RESTAURANT_NOT_FOUND');
  }
  res.json(restaurant);
});

export const updateMyRestaurant = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantService.updateRestaurant(
    req.user!.restaurantId,
    pickRestaurantUpdate(req.body)
  );
  if (!restaurant) {
    throw createError.notFound('RESTAURANT_NOT_FOUND');
  }
  res.json(restaurant);
});

// Get restaurant settings (for admin configuration)
export const getRestaurantSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantService.getRestaurantById(req.user!.restaurantId);
  if (!restaurant) {
    throw createError.notFound('RESTAURANT_NOT_FOUND');
  }

  res.json(serializeRestaurantSettings(restaurant));
});

// Update restaurant settings (admin only)
export const updateRestaurantSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Keep an explicit allowlist here as defense in depth even though the route
  // also applies RestaurantSchema.partial().strict().
  const restaurant = await RestaurantService.updateRestaurant(
    req.user!.restaurantId,
    pickRestaurantUpdate(req.body)
  );
  if (!restaurant) {
    throw createError.notFound('RESTAURANT_NOT_FOUND');
  }
  res.json({
    message: 'SETTINGS_UPDATED',
    settings: serializeRestaurantSettings(restaurant),
  });
});
