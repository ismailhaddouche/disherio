import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import * as RestaurantService from '../services/restaurant.service';

export const getMyRestaurant = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantService.getRestaurantById(req.user!.restaurantId);
  if (!restaurant) {
    throw createError.notFound('Restaurant not found');
  }
  res.json(restaurant);
});

export const updateMyRestaurant = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantService.updateRestaurant(req.user!.restaurantId, req.body);
  res.json(restaurant);
});

// Get restaurant settings (for admin configuration)
export const getRestaurantSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurant = await RestaurantService.getRestaurantById(req.user!.restaurantId);
  if (!restaurant) {
    throw createError.notFound('Restaurant not found');
  }
  
  // Return only relevant settings fields
  res.json({
    _id: restaurant._id,
    restaurant_name: restaurant.restaurant_name,
    tax_rate: restaurant.tax_rate,
    currency: restaurant.currency,
    default_language: restaurant.default_language,
    default_theme: restaurant.default_theme,
    tips_state: restaurant.tips_state,
    tips_type: restaurant.tips_type
  });
});

// Update restaurant settings (admin only)
export const updateRestaurantSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const allowedFields = [
    'restaurant_name',
    'tax_rate', 
    'currency',
    'default_language',
    'default_theme',
    'tips_state',
    'tips_type'
  ];
  
  // Filter only allowed fields
  const updates: any = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  const restaurant = await RestaurantService.updateRestaurant(req.user!.restaurantId, updates);
  if (!restaurant) {
    res.status(404).json({ message: 'Restaurant not found' });
    return;
  }
  res.json({
    message: 'Settings updated successfully',
    settings: {
      restaurant_name: restaurant.restaurant_name,
      tax_rate: restaurant.tax_rate,
      currency: restaurant.currency,
      default_language: restaurant.default_language,
      default_theme: restaurant.default_theme,
      tips_state: restaurant.tips_state,
      tips_type: restaurant.tips_type
    }
  });
});
