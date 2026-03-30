import { Request, Response } from 'express';
import i18next from 'i18next';
import { ItemOrder, IItemOrder } from '../models/order.model';
import { Types } from 'mongoose';
import { logger } from '../config/logger';

interface LogEntry {
  id: string;
  type: 'KDS' | 'POS' | 'TAS';
  timestamp: Date;
  userId?: string;
  userName?: string;
  action: string;
  details: Record<string, unknown>;
  dishName?: string;
  status?: string;
}

/**
 * Get system logs from KDS, POS, and TAS
 * Supports filtering by date range, user, and system type
 */
export async function getLogs(req: Request, res: Response): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }

    // Parse filters
    const { from, to, userId, type } = req.query;
    const filters: Record<string, unknown> = {};
    
    // Date range filter
    const dateFilter: { $gte?: Date; $lte?: Date } = {};
    if (from) dateFilter.$gte = new Date(from as string);
    if (to) dateFilter.$lte = new Date(to as string);
    
    if (dateFilter.$gte || dateFilter.$lte) {
      filters.createdAt = dateFilter;
    }

    // Get dishes for this restaurant
    const { Dish } = await import('../models/dish.model');
    const dishes = await Dish.find({ 
      restaurant_id: new Types.ObjectId(restaurantId) 
    }).select('_id disher_name');
    
    const dishIds = dishes.map(d => d._id.toString());
    filters.item_dish_id = { $in: dishIds.map(id => new Types.ObjectId(id)) };

    // User filter (applied to staff_id on items)
    if (userId) {
      filters.$or = [
        { customer_id: new Types.ObjectId(userId as string) },
        { created_by: new Types.ObjectId(userId as string) }
      ];
    }

    // Fetch item orders as logs
    const items = await ItemOrder.find(filters)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Transform to log format
    const rawLogs = items.map((item: IItemOrder & { createdAt?: Date; updatedAt?: Date }) => {
      const dish = dishes.find(d => d._id.equals(item.item_dish_id));
      
      // Determine log type based on dish type
      let logType: 'KDS' | 'POS' | 'TAS' = 'POS';
      if (item.item_disher_type === 'KITCHEN') {
        logType = 'KDS';
      } else if (item.session_id) {
        // TAS items are typically ordered through totem
        logType = 'TAS';
      }

      // Filter by type if specified
      if (type && type !== 'ALL' && logType !== type) {
        return null;
      }

      // Get timestamp from mongoose timestamps
      const timestamp = item.createdAt || item.updatedAt || new Date();
      
      // Safely get dish name
      const dishName = dish?.disher_name || 
        (item.item_name_snapshot && typeof item.item_name_snapshot === 'object' && 'es' in item.item_name_snapshot) 
          ? (item.item_name_snapshot as { es: string }).es 
          : i18next.t('common:UNKNOWN');

      return {
        id: item._id.toString(),
        type: logType,
        timestamp: timestamp,
        userId: item.customer_id?.toString(),
        action: getActionFromState(item.item_state),
        details: {
          dishType: item.item_disher_type,
          basePrice: item.item_base_price,
          extras: item.item_disher_extras?.length || 0,
          variant: item.item_disher_variant?.name && typeof item.item_disher_variant.name === 'object' && 'es' in item.item_disher_variant.name
            ? (item.item_disher_variant.name as { es: string }).es 
            : null
        },
        dishName: dishName,
        status: item.item_state
      };
    });

    // Filter out null values
    const logs: LogEntry[] = rawLogs.filter((log): log is NonNullable<typeof log> => log !== null);

    // Get unique users for filter dropdown
    const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
    
    res.json({
      logs,
      filters: {
        users: userIds,
        types: ['KDS', 'POS', 'TAS']
      },
      total: logs.length
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting logs');
    res.status(500).json({ errorCode: 'LOGS_ERROR' });
  }
}

/**
 * Get unique users who have activity in the system
 */
export async function getLogUsers(req: Request, res: Response): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }

    // Get staff from this restaurant
    const { Staff } = await import('../models/staff.model');
    const staff = await Staff.find({ 
      restaurant_id: new Types.ObjectId(restaurantId) 
    }).select('staff_name').lean();

    // Get customers who have orders
    const { ItemOrder } = await import('../models/order.model');
    const { Dish } = await import('../models/dish.model');
    
    const dishes = await Dish.find({ 
      restaurant_id: new Types.ObjectId(restaurantId) 
    }).select('_id');
    
    const dishIds = dishes.map(d => d._id);
    
    const customerIds = await ItemOrder.distinct('customer_id', {
      item_dish_id: { $in: dishIds }
    });

    const { Customer } = await import('../models/customer.model');
    const customers = await Customer.find({
      _id: { $in: customerIds }
    }).select('customer_name').lean();

    const users = [
      ...staff.map(s => ({
        id: s._id.toString(),
        name: s.staff_name,
        type: 'STAFF'
      })),
      ...customers.map(c => ({
        id: c._id.toString(),
        name: c.customer_name,
        type: 'CUSTOMER'
      }))
    ];

    res.json({ users });

  } catch (error) {
    logger.error({ err: error }, 'Error getting log users');
    res.status(500).json({ errorCode: 'LOGS_USERS_ERROR' });
  }
}

function getActionFromState(state: string): string {
  // Return codes that will be translated on the frontend
  switch (state) {
    case 'ORDERED': return 'ORDERED';
    case 'ON_PREPARE': return 'ON_PREPARE';
    case 'SERVED': return 'SERVED';
    case 'CANCELED': return 'CANCELED';
    default: return 'UNKNOWN_ACTION';
  }
}
