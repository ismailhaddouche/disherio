import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { logger } from '../config/logger';
import { DishRepository, ItemOrderRepository, PaymentRepository } from '../repositories';
import { TotemRepository, TotemSessionRepository } from '../repositories/totem.repository';
import { Category } from '../models/dish.model';

const dishRepo = new DishRepository();
const itemOrderRepo = new ItemOrderRepository();
const paymentRepo = new PaymentRepository();
const totemRepo = new TotemRepository();
const totemSessionRepo = new TotemSessionRepository();

/**
 * Get dashboard statistics for the authenticated restaurant
 * Supports date range filtering
 */
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }

    // Parse and validate date filters
    const { from, to } = req.query;
    const dateRange: { from?: Date; to?: Date } = {};

    if (from) {
      const fromDate = new Date(from as string);
      if (isNaN(fromDate.getTime())) {
        res.status(400).json({ errorCode: 'INVALID_DATE_RANGE' });
        return;
      }
      dateRange.from = fromDate;
    }
    if (to) {
      const toDate = new Date(to as string);
      if (isNaN(toDate.getTime())) {
        res.status(400).json({ errorCode: 'INVALID_DATE_RANGE' });
        return;
      }
      dateRange.to = toDate;
    }

    // Get sessions for this restaurant (all states for historical queries)
    const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
    const totemIds = totems.map(t => t._id.toString());
    const allSessions = await totemSessionRepo.findByTotemIds(totemIds, dateRange);
    const allSessionIds = allSessions.map(s => s._id.toString());

    // Active sessions only (for realtime payment stats)
    const sessionIds = allSessions
      .filter(s => s.totem_state === 'STARTED')
      .map(s => s._id.toString());

    // Get all dishes for this restaurant
    const dishes = await dishRepo.findByRestaurantId(restaurantId);
    const dishIds = dishes.map(d => d._id.toString());

    // Use optimized aggregation for sales by dish
    const salesByDish = await itemOrderRepo.getSalesByDish(dishIds, dateRange);

    // Map dish names
    const salesByDishWithNames = salesByDish.map(sale => {
      const dish = dishes.find(d => d._id.equals(sale.dishId));
      return {
        ...sale,
        dishName: dish?.disher_name?.[0]?.value ?? sale.dishName ?? 'Unknown',
      };
    });

    // Aggregate sales by category
    const categoryMap = new Map();
    for (const sale of salesByDishWithNames) {
      const dish = dishes.find(d => d._id.equals(sale.dishId));
      const categoryId = dish?.category_id?.toString() || 'uncategorized';
      
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { revenue: 0, quantity: 0 });
      }
      
      const current = categoryMap.get(categoryId);
      current.revenue += sale.revenue;
      current.quantity += sale.quantity;
    }

    // Get category names (scoped to this restaurant for defense-in-depth)
    const categoryIds = Array.from(categoryMap.keys()).filter(id => id !== 'uncategorized');
    const categories = categoryIds.length > 0
      ? await Category.find({
          restaurant_id: new Types.ObjectId(restaurantId),
          _id: { $in: categoryIds.map(id => new Types.ObjectId(id)) }
        }).select('category_name').lean().exec()
      : [];

    const salesByCategory = Array.from(categoryMap.entries()).map(([catId, data]) => {
      const category = categories.find((c: any) => c._id.equals(catId));
      return {
        categoryId: catId,
        categoryName: category?.category_name?.[0]?.value || 'UNCATEGORIZED',
        revenue: Math.round(data.revenue * 100) / 100,
        quantity: data.quantity,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Get payment statistics using optimized aggregation
    const paymentStats = await paymentRepo.getPaymentStats(sessionIds, dateRange);

    // Get order status counts using aggregation (scoped to this restaurant's sessions)
    const statusMatchFilter: Record<string, unknown> = {
      session_id: { $in: allSessionIds.map(id => new Types.ObjectId(id)) },
      ...(dateRange.from && { createdAt: { $gte: dateRange.from } }),
      ...(dateRange.to && { createdAt: { $lte: dateRange.to } }),
    };
    const statusAggregation = allSessionIds.length > 0
      ? await itemOrderRepo.getModel().aggregate([
          { $match: statusMatchFilter },
          { $group: { _id: '$item_state', count: { $sum: 1 } } },
        ])
      : [];

    const statusCounts = {
      ordered: 0,
      onPrepare: 0,
      served: 0,
      canceled: 0,
    };

    statusAggregation.forEach((status: any) => {
      switch (status._id) {
        case 'ORDERED': statusCounts.ordered = status.count; break;
        case 'ON_PREPARE': statusCounts.onPrepare = status.count; break;
        case 'SERVED': statusCounts.served = status.count; break;
        case 'CANCELED': statusCounts.canceled = status.count; break;
      }
    });

    res.json({
      salesByDish: salesByDishWithNames.slice(0, 10),
      salesByCategory,
      paymentStats,
      orderStatus: statusCounts,
      dateRange: { from, to },
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting dashboard stats');
    res.status(500).json({ errorCode: 'DASHBOARD_ERROR' });
  }
}

/**
 * Get popular dishes for the dashboard
 */
export async function getPopularDishes(req: Request, res: Response): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }

    const { from, to, limit, type } = req.query;
    const dateRange: { from?: Date; to?: Date } = {};
    
    if (from) dateRange.from = new Date(from as string);
    if (to) dateRange.to = new Date(to as string);

    const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
    const parsedType = type === 'KITCHEN' || type === 'SERVICE' ? type : undefined;

    const popularDishes = await dishRepo.getPopularDishes(restaurantId, {
      limit: parsedLimit,
      dateRange,
      type: parsedType,
    });

    res.json({
      dishes: popularDishes,
      dateRange,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting popular dishes');
    res.status(500).json({ errorCode: 'POPULAR_DISHES_ERROR' });
  }
}

/**
 * Get category statistics
 */
export async function getCategoryStats(req: Request, res: Response): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }

    const categoriesWithCounts = await dishRepo.getCategoryStats(restaurantId);

    res.json({
      categories: categoriesWithCounts,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting category stats');
    res.status(500).json({ errorCode: 'CATEGORY_STATS_ERROR' });
  }
}

/**
 * Get real-time metrics for active sessions
 */
export async function getRealtimeMetrics(req: Request, res: Response): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }

    // Get active sessions
    const totems = await totemRepo.findByRestaurantIdSelectId(restaurantId);
    const totemIds = totems.map(t => t._id.toString());
    const sessions = await totemSessionRepo.findByTotemIdsAndState(totemIds, 'STARTED');
    const sessionIds = sessions.map(s => s._id.toString());

    if (sessionIds.length === 0) {
      res.json({
        activeSessions: 0,
        pendingKitchenItems: 0,
        pendingServiceItems: 0,
        averageWaitTime: 0,
        itemsByStation: [],
      });
      return;
    }

    // Get pending items by station
    const itemsByStation = await itemOrderRepo.getPendingItemsByStation(sessionIds, {
      includeService: true,
    });

    // Calculate totals
    const kitchenItems = itemsByStation.find(s => s._id === 'KITCHEN');
    const serviceItems = itemsByStation.find(s => s._id === 'SERVICE');

    const pendingKitchenItems = kitchenItems?.count ?? 0;
    const pendingServiceItems = serviceItems?.count ?? 0;

    // Calculate average wait time
    const allItems = itemsByStation.flatMap(s => s.items);
    const averageWaitTime = allItems.length > 0
      ? Math.round(allItems.reduce((sum, item: any) => sum + (item.waitTimeMinutes ?? 0), 0) / allItems.length)
      : 0;

    res.json({
      activeSessions: sessions.length,
      pendingKitchenItems,
      pendingServiceItems,
      averageWaitTime,
      itemsByStation: itemsByStation.map(station => ({
        station: station._id,
        count: station.count,
        averageWaitTime: (station as any).averageWaitTime,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting realtime metrics');
    res.status(500).json({ errorCode: 'REALTIME_METRICS_ERROR' });
  }
}
