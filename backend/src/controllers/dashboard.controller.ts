import { Request, Response } from 'express';
import { ItemOrder, Payment } from '../models/order.model';
import { Dish } from '../models/dish.model';
import { Types } from 'mongoose';
import { logger } from '../config/logger';

/**
 * Get dashboard statistics for the authenticated restaurant
 * Supports date range filtering
 */
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // Parse date filters
    const { from, to } = req.query;
    const dateFilter: { $gte?: Date; $lte?: Date } = {};
    
    if (from) {
      dateFilter.$gte = new Date(from as string);
    }
    if (to) {
      dateFilter.$lte = new Date(to as string);
    }

    // Build match stages
    const itemMatch: Record<string, unknown> = {};
    const paymentMatch: Record<string, unknown> = {};
    
    if (dateFilter.$gte || dateFilter.$lte) {
      itemMatch.createdAt = dateFilter;
      paymentMatch.payment_date = dateFilter;
    }

    // Get dishes for this restaurant to filter items
    const dishes = await Dish.find({ 
      restaurant_id: new Types.ObjectId(restaurantId) 
    }).select('_id category_id');
    
    const dishIds = dishes.map(d => d._id.toString());
    itemMatch.item_dish_id = { $in: dishIds.map(id => new Types.ObjectId(id)) };

    // Aggregate sales by dish
    const salesByDish = await ItemOrder.aggregate([
      { $match: itemMatch },
      {
        $group: {
          _id: '$item_dish_id',
          totalQuantity: { $sum: 1 },
          totalRevenue: { 
            $sum: { 
              $add: [
                '$item_base_price',
                { $ifNull: ['$item_disher_variant.price', 0] },
                { $sum: '$item_disher_extras.price' }
              ]
            }
          }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Populate dish names
    const dishDetails = await Dish.find({ 
      _id: { $in: salesByDish.map(s => s._id) } 
    }).select('disher_name category_id');

    const salesByDishWithNames = salesByDish.map(sale => {
      const dish = dishDetails.find(d => d._id.equals(sale._id));
      return {
        dishId: sale._id,
        dishName: dish?.disher_name || 'Desconocido',
        quantity: sale.totalQuantity,
        revenue: sale.totalRevenue
      };
    });

    // Aggregate sales by category
    const categoryMap = new Map();
    for (const sale of salesByDishWithNames) {
      const dish = dishDetails.find(d => d._id.equals(sale.dishId));
      const categoryId = dish?.category_id?.toString() || 'uncategorized';
      
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { revenue: 0, quantity: 0 });
      }
      
      const current = categoryMap.get(categoryId);
      current.revenue += sale.revenue;
      current.quantity += sale.quantity;
    }

    // Get category names
    const categoryIds = Array.from(categoryMap.keys()).filter(id => id !== 'uncategorized');
    const categories = await (await import('../models/dish.model')).Category.find({
      _id: { $in: categoryIds.map(id => new Types.ObjectId(id)) }
    }).select('category_name');

    const salesByCategory = Array.from(categoryMap.entries()).map(([catId, data]) => {
      const category = categories.find(c => c._id.equals(catId));
      return {
        categoryId: catId,
        categoryName: category?.category_name?.es || 'Sin categoría',
        revenue: data.revenue,
        quantity: data.quantity
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Get total revenue from payments
    const paymentStats = await Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$payment_total' },
          totalTransactions: { $sum: 1 },
          averageTicket: { $avg: '$payment_total' }
        }
      }
    ]);

    // Get order status counts
    const orderStatusCounts = await ItemOrder.aggregate([
      { $match: itemMatch },
      {
        $group: {
          _id: '$item_state',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      ordered: 0,
      onPrepare: 0,
      served: 0,
      canceled: 0
    };

    orderStatusCounts.forEach(status => {
      switch (status._id) {
        case 'ORDERED': statusCounts.ordered = status.count; break;
        case 'ON_PREPARE': statusCounts.onPrepare = status.count; break;
        case 'SERVED': statusCounts.served = status.count; break;
        case 'CANCELED': statusCounts.canceled = status.count; break;
      }
    });

    res.json({
      salesByDish: salesByDishWithNames,
      salesByCategory,
      paymentStats: paymentStats[0] || { totalRevenue: 0, totalTransactions: 0, averageTicket: 0 },
      orderStatus: statusCounts,
      dateRange: { from, to }
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting dashboard stats');
    res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
  }
}
