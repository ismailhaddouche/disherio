import { Types, ClientSession, PipelineStage } from 'mongoose';
import { Order, IOrder, ItemOrder, IItemOrder, Payment, IPayment } from '../models/order.model';
import { BaseRepository, validateObjectId, validateObjectIdOptional } from './base.repository';
import { QueryProfiler } from '../utils/query-profiler';

export { validateObjectId, validateObjectIdOptional };

export interface OrderWithItems extends IOrder {
  items: Array<IItemOrder & { dish?: any }>;
}

export interface PendingItemsByStation {
  _id: string;
  count: number;
  items: IItemOrder[];
}

export interface DailyMetrics {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  itemCount: number;
}

export interface SalesByDish {
  dishId: Types.ObjectId;
  dishName: string;
  quantity: number;
  revenue: number;
}

export interface KDSItem extends IItemOrder {
  order_date?: Date;
  totem_name?: string;
  waitTimeMinutes?: number;
}

export class OrderRepository extends BaseRepository<IOrder> {
  constructor() {
    super(Order);
  }

  async createOrder(
    sessionId: string,
    staffId?: string,
    customerId?: string,
    session?: ClientSession
  ): Promise<IOrder> {
    validateObjectId(sessionId, 'session_id');
    validateObjectIdOptional(staffId, 'staff_id');
    validateObjectIdOptional(customerId, 'customer_id');

    return this.create({
      session_id: new Types.ObjectId(sessionId),
      staff_id: staffId ? new Types.ObjectId(staffId) : undefined,
      customer_id: customerId ? new Types.ObjectId(customerId) : undefined,
      order_date: new Date(),
    }, session);
  }

  async findBySessionId(sessionId: string): Promise<IOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model.find({ session_id: new Types.ObjectId(sessionId) }).exec();
  }

  /**
   * Get orders with items populated efficiently using aggregation pipeline.
   * Replaces multiple queries with a single optimized aggregation.
   */
  async getOrdersWithItems(sessionId: string, options?: {
    includeCancelled?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<OrderWithItems[]> {
    validateObjectId(sessionId, 'session_id');

    const { includeCancelled = false, limit = 100, skip = 0 } = options ?? {};

    const pipeline: PipelineStage[] = [
      { $match: { session_id: new Types.ObjectId(sessionId) } },
      { $sort: { order_date: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'itemorders',
          localField: '_id',
          foreignField: 'order_id',
          as: 'items',
          pipeline: [
            ...(includeCancelled ? [] : [{ $match: { item_state: { $ne: 'CANCELED' } } }]),
            { $sort: { createdAt: 1 } },
            {
              $lookup: {
                from: 'dishes',
                localField: 'item_dish_id',
                foreignField: '_id',
                as: 'dish',
              },
            },
            { $unwind: { path: '$dish', preserveNullAndEmptyArrays: true } },
          ],
        },
      },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'OrderRepository.getOrdersWithItems',
      { explain: false }
    );
  }

  /**
   * Get daily metrics for a restaurant using aggregation.
   * Single query to get revenue, order count, and average order value.
   */
  async getDailyMetrics(
    sessionIds: string[],
    date: Date
  ): Promise<DailyMetrics> {
    if (sessionIds.length === 0) {
      return { totalRevenue: 0, orderCount: 0, averageOrderValue: 0, itemCount: 0 };
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const validSessionIds = sessionIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const pipeline: PipelineStage[] = [
      {
        $match: {
          session_id: { $in: validSessionIds },
          order_date: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $lookup: {
          from: 'itemorders',
          localField: '_id',
          foreignField: 'order_id',
          as: 'items',
        },
      },
      {
        $addFields: {
          orderTotal: {
            $sum: {
              $map: {
                input: '$items',
                as: 'item',
                in: {
                  $add: [
                    '$$item.item_base_price',
                    { $ifNull: ['$$item.item_disher_variant.price', 0] },
                    { $sum: '$$item.item_disher_extras.price' },
                  ],
                },
              },
            },
          },
          itemCount: { $size: '$items' },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$orderTotal' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$orderTotal' },
          itemCount: { $sum: '$itemCount' },
        },
      },
    ];

    const result = await QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'OrderRepository.getDailyMetrics',
      { explain: false }
    );

    if (result.length === 0) {
      return { totalRevenue: 0, orderCount: 0, averageOrderValue: 0, itemCount: 0 };
    }

    return {
      totalRevenue: Math.round(result[0].totalRevenue * 100) / 100,
      orderCount: result[0].orderCount,
      averageOrderValue: Math.round(result[0].averageOrderValue * 100) / 100,
      itemCount: result[0].itemCount,
    };
  }

  /**
   * Get order metrics for a date range using aggregation.
   */
  async getOrderMetrics(
    sessionIds: string[],
    fromDate: Date,
    toDate: Date
  ): Promise<{
    totalRevenue: number;
    orderCount: number;
    averageOrderValue: number;
    totalItems: number;
    itemsByState: Record<string, number>;
  }> {
    if (sessionIds.length === 0) {
      return {
        totalRevenue: 0,
        orderCount: 0,
        averageOrderValue: 0,
        totalItems: 0,
        itemsByState: {},
      };
    }

    const validSessionIds = sessionIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const pipeline: PipelineStage[] = [
      {
        $match: {
          session_id: { $in: validSessionIds },
          order_date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $lookup: {
          from: 'itemorders',
          localField: '_id',
          foreignField: 'order_id',
          as: 'items',
        },
      },
      {
        $addFields: {
          orderTotal: {
            $sum: {
              $map: {
                input: '$items',
                as: 'item',
                in: {
                  $add: [
                    '$$item.item_base_price',
                    { $ifNull: ['$$item.item_disher_variant.price', 0] },
                    { $sum: '$$item.item_disher_extras.price' },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$orderTotal' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$orderTotal' },
          allItems: { $push: '$items' },
        },
      },
      {
        $addFields: {
          flattenedItems: {
            $reduce: {
              input: '$allItems',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
        },
      },
      {
        $project: {
          totalRevenue: 1,
          orderCount: 1,
          averageOrderValue: 1,
          totalItems: { $size: '$flattenedItems' },
          itemsByState: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: '$flattenedItems.item_state' },
                as: 'state',
                in: {
                  k: '$$state',
                  v: {
                    $size: {
                      $filter: {
                        input: '$flattenedItems',
                        as: 'item',
                        cond: { $eq: ['$$item.item_state', '$$state'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const result = await QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'OrderRepository.getOrderMetrics',
      { explain: false }
    );

    if (result.length === 0) {
      return {
        totalRevenue: 0,
        orderCount: 0,
        averageOrderValue: 0,
        totalItems: 0,
        itemsByState: {},
      };
    }

    return {
      totalRevenue: Math.round(result[0].totalRevenue * 100) / 100,
      orderCount: result[0].orderCount,
      averageOrderValue: Math.round(result[0].averageOrderValue * 100) / 100,
      totalItems: result[0].totalItems,
      itemsByState: result[0].itemsByState,
    };
  }
}

export class ItemOrderRepository extends BaseRepository<IItemOrder> {
  constructor() {
    super(ItemOrder);
  }

  async createItem(
    data: {
      order_id: string;
      session_id: string;
      item_dish_id: string;
      customer_id?: string;
      customer_name?: string;
      item_disher_type: 'KITCHEN' | 'SERVICE';
      item_name_snapshot: { lang: string; value: string }[];
      item_base_price: number;
      item_disher_variant?: { variant_id: string; name: { lang: string; value: string }[]; price: number } | null;
      item_disher_extras: { extra_id: string; name: { lang: string; value: string }[]; price: number }[];
    },
    session?: ClientSession
  ): Promise<IItemOrder> {
    validateObjectId(data.order_id, 'order_id');
    validateObjectId(data.session_id, 'session_id');
    validateObjectId(data.item_dish_id, 'item_dish_id');
    validateObjectIdOptional(data.customer_id, 'customer_id');

    return this.create(
      {
        ...data,
        order_id: new Types.ObjectId(data.order_id),
        session_id: new Types.ObjectId(data.session_id),
        item_dish_id: new Types.ObjectId(data.item_dish_id),
        customer_id: data.customer_id ? new Types.ObjectId(data.customer_id) : undefined,
        item_state: 'ORDERED',
      },
      session
    );
  }

  async findBySessionId(sessionId: string): Promise<IItemOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({ session_id: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async findBySessionIdLean(sessionId: string): Promise<IItemOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({ session_id: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async findKitchenItemsBySessionIds(sessionIds: string[]): Promise<IItemOrder[]> {
    const validIds = sessionIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    return this.model
      .find({
        session_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        item_disher_type: 'KITCHEN',
        item_state: { $in: ['ORDERED', 'ON_PREPARE'] },
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async updateState(
    itemId: string,
    newState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED',
    session?: ClientSession
  ): Promise<IItemOrder | null> {
    validateObjectId(itemId, 'item_id');
    return this.model.findByIdAndUpdate(
      itemId,
      { item_state: newState },
      { new: true, session }
    ).exec();
  }

  async findActiveBySessionId(sessionId: string): Promise<IItemOrder[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({
        session_id: new Types.ObjectId(sessionId),
        item_state: { $ne: 'CANCELED' },
      })
      .lean()
      .exec();
  }

  async findByCustomerId(customerId: string): Promise<IItemOrder[]> {
    validateObjectId(customerId, 'customer_id');
    return this.model
      .find({
        customer_id: new Types.ObjectId(customerId),
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async deleteItem(itemId: string, session?: ClientSession): Promise<IItemOrder | null> {
    validateObjectId(itemId, 'item_id');
    const options = session ? { session } : {};
    return this.model.findOneAndDelete(
      {
        _id: new Types.ObjectId(itemId),
        item_state: 'ORDERED',
      },
      options
    ).exec();
  }

  async assignItemToCustomer(
    itemId: string,
    customerId: string | null,
    customerName?: string | null,
    session?: ClientSession
  ): Promise<IItemOrder | null> {
    validateObjectId(itemId, 'item_id');
    validateObjectIdOptional(customerId, 'customer_id');

    const update: Record<string, unknown> = {
      customer_id: customerId ? new Types.ObjectId(customerId) : null,
    };

    if (customerName !== undefined) {
      update.customer_name = customerName;
    }

    return this.model.findByIdAndUpdate(
      itemId,
      update,
      { new: true, session }
    ).exec();
  }

  async findServiceItemsBySessionIds(sessionIds: string[]): Promise<IItemOrder[]> {
    const validIds = sessionIds.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    return this.model
      .find({
        session_id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
        item_disher_type: 'SERVICE',
        item_state: { $in: ['ORDERED'] },
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  /**
   * Get pending items grouped by station for KDS display.
   * Uses aggregation to efficiently group items.
   */
  async getPendingItemsByStation(
    sessionIds: string[],
    options?: { 
      includeService?: boolean;
      maxWaitTimeMinutes?: number;
    }
  ): Promise<PendingItemsByStation[]> {
    if (sessionIds.length === 0) return [];

    const { includeService = false, maxWaitTimeMinutes } = options ?? {};
    const validSessionIds = sessionIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const matchStage: Record<string, unknown> = {
      session_id: { $in: validSessionIds },
      item_state: { $in: ['ORDERED', 'ON_PREPARE'] },
    };

    if (!includeService) {
      matchStage.item_disher_type = 'KITCHEN';
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'orders',
          localField: 'order_id',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          waitTimeMinutes: {
            $divide: [
              { $subtract: [new Date(), '$createdAt'] },
              1000 * 60, // Convert ms to minutes
            ],
          },
        },
      },
      ...(maxWaitTimeMinutes
        ? [{ $match: { waitTimeMinutes: { $gte: maxWaitTimeMinutes } } }]
        : []),
      {
        $group: {
          _id: '$item_disher_type',
          count: { $sum: 1 },
          items: {
            $push: {
              $mergeObjects: [
                '$$ROOT',
                {
                  order_date: '$order.order_date',
                  waitTimeMinutes: { $round: ['$waitTimeMinutes', 0] },
                },
              ],
            },
          },
          oldestItem: { $min: '$createdAt' },
          averageWaitTime: { $avg: '$waitTimeMinutes' },
        },
      },
      {
        $addFields: {
          station: '$_id',
          averageWaitTime: { $round: ['$averageWaitTime', 1] },
        },
      },
      { $sort: { oldestItem: 1 } },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'ItemOrderRepository.getPendingItemsByStation',
      { explain: false }
    );
  }

  /**
   * Get KDS items with rich information including order and totem details.
   * Optimized aggregation that replaces multiple queries.
   */
  async getKDSItemsWithDetails(
    sessionIds: string[],
    options?: {
      states?: string[];
      types?: ('KITCHEN' | 'SERVICE')[];
      sortBy?: 'createdAt' | 'waitTime';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<KDSItem[]> {
    if (sessionIds.length === 0) return [];

    const {
      states = ['ORDERED', 'ON_PREPARE'],
      types = ['KITCHEN'],
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = options ?? {};

    const validSessionIds = sessionIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const sortField = sortBy === 'waitTime' ? 'waitTimeMinutes' : 'createdAt';
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const pipeline: PipelineStage[] = [
      {
        $match: {
          session_id: { $in: validSessionIds },
          item_state: { $in: states },
          item_disher_type: { $in: types },
        },
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'order_id',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'totemsessions',
          localField: 'session_id',
          foreignField: '_id',
          as: 'totemSession',
        },
      },
      { $unwind: { path: '$totemSession', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'totems',
          localField: 'totemSession.totem_id',
          foreignField: '_id',
          as: 'totem',
        },
      },
      { $unwind: { path: '$totem', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          waitTimeMinutes: {
            $round: [
              {
                $divide: [
                  { $subtract: [new Date(), '$createdAt'] },
                  1000 * 60,
                ],
              },
              0,
            ],
          },
          totem_name: '$totem.totem_name',
          order_date: '$order.order_date',
        },
      },
      {
        $sort: { [sortField]: sortDirection },
      },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'ItemOrderRepository.getKDSItemsWithDetails',
      { explain: false }
    );
  }

  /**
   * Get sales by dish with aggregation pipeline.
   * Efficiently calculates revenue and quantity per dish.
   */
  async getSalesByDish(
    dishIds: string[],
    dateRange?: { from?: Date; to?: Date }
  ): Promise<SalesByDish[]> {
    if (dishIds.length === 0) return [];

    const validDishIds = dishIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const matchStage: Record<string, unknown> = {
      item_dish_id: { $in: validDishIds },
      item_state: { $ne: 'CANCELED' },
    };

    if (dateRange?.from || dateRange?.to) {
      matchStage.createdAt = {};
      if (dateRange.from) (matchStage.createdAt as Record<string, Date>).$gte = dateRange.from;
      if (dateRange.to) (matchStage.createdAt as Record<string, Date>).$lte = dateRange.to;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$item_dish_id',
          quantity: { $sum: 1 },
          revenue: {
            $sum: {
              $add: [
                '$item_base_price',
                { $ifNull: ['$item_disher_variant.price', 0] },
                { $sum: '$item_disher_extras.price' },
              ],
            },
          },
          nameSnapshot: { $first: '$item_name_snapshot' },
        },
      },
      {
        $project: {
          dishId: '$_id',
          dishName: {
            $arrayElemAt: [
              '$nameSnapshot.value',
              0,
            ],
          },
          quantity: 1,
          revenue: { $round: ['$revenue', 2] },
        },
      },
      { $sort: { revenue: -1 } },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'ItemOrderRepository.getSalesByDish',
      { explain: false }
    );
  }

  /**
   * Bulk update item states with optimized query.
   */
  async bulkUpdateState(
    itemIds: string[],
    newState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED'
  ): Promise<{ modifiedCount: number }> {
    const validIds = itemIds.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return { modifiedCount: 0 };

    const result = await this.model.updateMany(
      { _id: { $in: validIds.map(id => new Types.ObjectId(id)) } },
      { $set: { item_state: newState } }
    );

    return { modifiedCount: result.modifiedCount };
  }
}

export class PaymentRepository extends BaseRepository<IPayment> {
  constructor() {
    super(Payment);
  }

  async createPayment(
    data: {
      session_id: string;
      payment_type: 'ALL' | 'BY_USER' | 'SHARED';
      payment_total: number;
      tickets: {
        ticket_part: number;
        ticket_total_parts: number;
        ticket_amount: number;
        ticket_customer_name?: string;
        paid: boolean;
      }[];
    },
    session?: ClientSession
  ): Promise<IPayment> {
    validateObjectId(data.session_id, 'session_id');
    return this.create(
      {
        ...data,
        session_id: new Types.ObjectId(data.session_id),
        payment_date: new Date(),
      },
      session
    );
  }

  async findBySessionId(sessionId: string): Promise<IPayment[]> {
    validateObjectId(sessionId, 'session_id');
    return this.model.find({ session_id: new Types.ObjectId(sessionId) }).exec();
  }

  async markTicketPaid(
    paymentId: string,
    ticketPart: number,
    session?: ClientSession
  ): Promise<IPayment | null> {
    validateObjectId(paymentId, 'payment_id');
    return this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(paymentId), 'tickets.ticket_part': ticketPart },
      { $set: { 'tickets.$.paid': true } },
      { new: true, session }
    ).exec();
  }

  /**
   * Get payment statistics using aggregation.
   */
  async getPaymentStats(
    sessionIds: string[],
    dateRange?: { from?: Date; to?: Date }
  ): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    averageTicket: number;
    paidTickets: number;
    pendingTickets: number;
  }> {
    if (sessionIds.length === 0) {
      return {
        totalRevenue: 0,
        totalTransactions: 0,
        averageTicket: 0,
        paidTickets: 0,
        pendingTickets: 0,
      };
    }

    const validSessionIds = sessionIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const matchStage: Record<string, unknown> = {
      session_id: { $in: validSessionIds },
    };

    if (dateRange?.from || dateRange?.to) {
      matchStage.payment_date = {};
      if (dateRange.from) (matchStage.payment_date as Record<string, Date>).$gte = dateRange.from;
      if (dateRange.to) (matchStage.payment_date as Record<string, Date>).$lte = dateRange.to;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$payment_total' },
          totalTransactions: { $sum: 1 },
          averageTicket: { $avg: '$payment_total' },
          allTickets: { $push: '$tickets' },
        },
      },
      {
        $addFields: {
          flattenedTickets: {
            $reduce: {
              input: '$allTickets',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
        },
      },
      {
        $addFields: {
          paidTickets: {
            $size: {
              $filter: {
                input: '$flattenedTickets',
                as: 'ticket',
                cond: '$$ticket.paid',
              },
            },
          },
          pendingTickets: {
            $size: {
              $filter: {
                input: '$flattenedTickets',
                as: 'ticket',
                cond: { $eq: ['$$ticket.paid', false] },
              },
            },
          },
        },
      },
      {
        $project: {
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalTransactions: 1,
          averageTicket: { $round: ['$averageTicket', 2] },
          paidTickets: 1,
          pendingTickets: 1,
        },
      },
    ];

    const result = await QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'PaymentRepository.getPaymentStats',
      { explain: false }
    );

    if (result.length === 0) {
      return {
        totalRevenue: 0,
        totalTransactions: 0,
        averageTicket: 0,
        paidTickets: 0,
        pendingTickets: 0,
      };
    }

    return result[0];
  }
}
