import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import * as RestaurantService from '../services/restaurant.service';

export const getMyRestaurant = asyncHandler(async (req: Request, res: Response): Promise<void => {
  const restaurant = await RestaurantService.getRestaurantById(req.user!.restaurantId);
  if (!restaurant) {
    throw createError.notFound('Restaurant not found');
  }
  res.json(restaurant);
});

export const updateMyRestaurant = asyncHandler(async (req: Request, res: Response): Promise<void => {
  const restaurant = await RestaurantService.updateRestaurant(req.user!.restaurantId, req.body);
  res.json(restaurant);
});
