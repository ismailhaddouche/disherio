import { Request, Response } from 'express';
import { ErrorCode } from '@disherio/shared';
import { asyncHandler, createError } from '../utils/async-handler';
import * as DashboardService from '../services/dashboard.service';
import {
  DashboardDateRangeQuerySchema,
  PopularDishesQuerySchema,
} from '../schemas/dashboard.schema';

export const getDashboardStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = DashboardDateRangeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
  }
  const stats = await DashboardService.getDashboardStats(req.user!.restaurantId, parsed.data);
  res.json({ ...stats, dateRange: { from: parsed.data.from, to: parsed.data.to } });
});

export const getPopularDishes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = PopularDishesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw createError.badRequest(ErrorCode.VALIDATION_ERROR);
  }
  const { from, to, limit, type } = parsed.data;
  const dateRange = { from, to };

  const dishes = await DashboardService.getPopularDishes(req.user!.restaurantId, {
    limit,
    dateRange,
    type,
  });
  res.json({ dishes, dateRange });
});

export const getCategoryStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const categories = await DashboardService.getCategoryStats(req.user!.restaurantId);
  res.json({ categories });
});

export const getRealtimeMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const metrics = await DashboardService.getRealtimeMetrics(req.user!.restaurantId);
  res.json(metrics);
});
