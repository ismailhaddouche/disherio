import { Types, ClientSession, PipelineStage } from 'mongoose';
import { Order, IOrder, ItemOrder, IItemOrder, Payment, IPayment } from '../models/order.model';
import { BaseRepository, validateObjectId, validateObjectIdOptional } from './base.repository';
import { QueryProfiler } from '../utils/query-profiler';

export { validateObjectId, validateObjectIdOptional };

export interface PendingItemsByStation {
  _id: string;
  count: number;
  items: KDSItem[];
  oldestItem?: Date;
  averageWaitTime?: number;
  station?: string;
}

export interface PaymentHistoryEntry {
  _id: Types.ObjectId;
  session_id: Types.ObjectId;
  payment_type: 'ALL' | 'BY_USER' | 'SHARED';
  payment_total: number;
  payment_date: Date;
  tickets: Array<{
    ticket_part: number;
    ticket_total_parts: number;
    ticket_amount: number;
    ticket_customer_name?: string;
    paid: boolean;
  }>;
  session: {
    _id: Types.ObjectId;
    totem_state: 'STARTED' | 'COMPLETE' | 'PAID' | 'CANCELLED';
    session_date_start: Date;
  };
  totem: {
    _id: Types.ObjectId;
    totem_name: string;
    totem_type: 'STANDARD' | 'TEMPORARY';
  };
}

export interface SalesByDish {
  dishId: Types.ObjectId;
  dishName: string;
  quantity: number;
  revenue: number;
}

export interface KDSItem extends IItemOrder {
  order_date?: Date;
  order_number?: number;
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
    session?: ClientSession,
    idempotency?: { requestId: string; requestHash: string }
  ): Promise<IOrder> {
    validateObjectId(sessionId, 'session_id');
    validateObjectIdOptional(staffId, 'staff_id');
    validateObjectIdOptional(customerId, 'customer_id');

    const sessionObjectId = new Types.ObjectId(sessionId);
    const latestOrder = await this.model
      .findOne({ session_id: sessionObjectId, order_number: { $exists: true } })
      .sort({ order_number: -1, order_date: -1 })
      .select('order_number')
      .session(session ?? null)
      .lean()
      .exec();

    return this.create({
      session_id: sessionObjectId,
      staff_id: staffId ? new Types.ObjectId(staffId) : undefined,
      customer_id: customerId ? new Types.ObjectId(customerId) : undefined,
      order_number: (latestOrder?.order_number ?? 0) + 1,
      order_date: new Date(),
      request_id: idempotency?.requestId,
      request_hash: idempotency?.requestHash,
    }, session);
  }

  async findByRequestId(
    sessionId: string,
    requestId: string,
    session: ClientSession
  ): Promise<IOrder | null> {
    validateObjectId(sessionId, 'session_id');
    return this.model.findOne({
      session_id: new Types.ObjectId(sessionId),
      request_id: requestId,
    }).select('+request_hash').session(session).exec();
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
      last_activity_source?: 'KDS' | 'POS' | 'TAS' | 'CUSTOMER';
      last_activity_user_id?: string;
      order_number?: number;
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
    validateObjectIdOptional(data.last_activity_user_id, 'last_activity_user_id');

    return this.create(
      {
        ...data,
        order_id: new Types.ObjectId(data.order_id),
        session_id: new Types.ObjectId(data.session_id),
        item_dish_id: new Types.ObjectId(data.item_dish_id),
        customer_id: data.customer_id ? new Types.ObjectId(data.customer_id) : undefined,
        last_activity_user_id: data.last_activity_user_id
          ? new Types.ObjectId(data.last_activity_user_id)
          : undefined,
        item_state: 'ORDERED',
      },
      session
    );
  }

  async findByOrderId(orderId: string, session: ClientSession): Promise<IItemOrder[]> {
    validateObjectId(orderId, 'order_id');
    return this.model.find({ order_id: new Types.ObjectId(orderId) })
      .sort({ createdAt: 1 })
      .session(session)
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

  async updateState(
    itemId: string,
    expectedState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED',
    newState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED',
    activity: { source: 'KDS' | 'POS' | 'TAS'; userId: string },
    session?: ClientSession
  ): Promise<IItemOrder | null> {
    validateObjectId(itemId, 'item_id');
    validateObjectId(activity.userId, 'last_activity_user_id');
    return this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(itemId), item_state: expectedState },
      {
        item_state: newState,
        last_activity_source: activity.source,
        last_activity_user_id: new Types.ObjectId(activity.userId),
      },
      { returnDocument: 'after', session }
    ).exec();
  }

  async findActiveBySessionId(sessionId: string, session?: ClientSession): Promise<IItemOrder[]> {
    validateObjectId(sessionId, 'session_id');
    const query = this.model
      .find({
        session_id: new Types.ObjectId(sessionId),
        item_state: { $ne: 'CANCELED' },
      })
      .lean();
    if (session) query.session(session);
    return query.exec();
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

  async findByCustomerAndSessionId(customerId: string, sessionId: string): Promise<IItemOrder[]> {
    validateObjectId(customerId, 'customer_id');
    validateObjectId(sessionId, 'session_id');
    return this.model
      .find({
        customer_id: new Types.ObjectId(customerId),
        session_id: new Types.ObjectId(sessionId),
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
      { returnDocument: 'after', session }
    ).exec();
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
        ? [{ $match: { waitTimeMinutes: { $lte: maxWaitTimeMinutes } } }]
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
          order_number: '$order.order_number',
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
          order_number: '$order.order_number',
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
   * Get counts of item orders grouped by state, scoped to a set of sessions.
   */
  async getOrderStatusCounts(
    sessionIds: string[],
    dateRange?: { from?: Date; to?: Date }
  ): Promise<{ _id: string; count: number }[]> {
    if (sessionIds.length === 0) return [];

    const validSessionIds = sessionIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const matchStage: Record<string, unknown> = {
      session_id: { $in: validSessionIds },
    };
    if (dateRange?.from || dateRange?.to) {
      matchStage.createdAt = {};
      if (dateRange.from) (matchStage.createdAt as Record<string, Date>).$gte = dateRange.from;
      if (dateRange.to) (matchStage.createdAt as Record<string, Date>).$lte = dateRange.to;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      { $group: { _id: '$item_state', count: { $sum: 1 } } },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'ItemOrderRepository.getOrderStatusCounts',
      { explain: false }
    );
  }

  /**
   * Batch insert multiple items in a single operation.
   * More efficient than creating items one by one in a loop.
   */
  async addItemsBatch(
    items: Array<{
      order_id: string;
      session_id: string;
      item_dish_id: string;
      customer_id?: string;
      customer_name?: string;
      last_activity_source?: 'KDS' | 'POS' | 'TAS' | 'CUSTOMER';
      last_activity_user_id?: string;
      order_number?: number;
      item_state?: string;
      item_disher_type: 'KITCHEN' | 'SERVICE';
      item_name_snapshot: { lang: string; value: string }[];
      item_base_price: number;
      item_disher_variant?: { variant_id: string; name: { lang: string; value: string }[]; price: number } | null;
      item_disher_extras: { extra_id: string; name: { lang: string; value: string }[]; price: number }[];
      unlimited_order_item?: boolean;
      batch_id?: string;
    }>,
    session?: ClientSession
  ): Promise<IItemOrder[]> {
    if (items.length === 0) return [];

    // Validate all ObjectIds before insert
    for (const item of items) {
      validateObjectId(item.order_id, 'order_id');
      validateObjectId(item.session_id, 'session_id');
      validateObjectId(item.item_dish_id, 'item_dish_id');
      validateObjectIdOptional(item.customer_id, 'customer_id');
      validateObjectIdOptional(item.last_activity_user_id, 'last_activity_user_id');
    }

    const docs = items.map(item => ({
      ...item,
      order_id: new Types.ObjectId(item.order_id),
      session_id: new Types.ObjectId(item.session_id),
      item_dish_id: new Types.ObjectId(item.item_dish_id),
      customer_id: item.customer_id ? new Types.ObjectId(item.customer_id) : undefined,
      last_activity_user_id: item.last_activity_user_id
        ? new Types.ObjectId(item.last_activity_user_id)
        : undefined,
      item_state: item.item_state ?? 'ORDERED',
      unlimited_order_item: item.unlimited_order_item ?? false,
    }));

    return this.model.insertMany(docs, {
      session,
      ordered: false, // Continue if one fails
    });
  }

  async getLimitedOrderStats(
    sessionId: string,
    session?: ClientSession
  ): Promise<{ count: number; lastOrderDate: Date | null }> {
    validateObjectId(sessionId, 'session_id');
    const sessionObjectId = new Types.ObjectId(sessionId);
    const distinctQuery = this.model.distinct('order_id', {
      session_id: sessionObjectId,
      unlimited_order_item: { $ne: true },
      item_state: { $ne: 'CANCELED' },
    });
    if (session) distinctQuery.session(session);
    const limitedOrderIds = await distinctQuery.exec();

    if (limitedOrderIds.length === 0) {
      return { count: 0, lastOrderDate: null };
    }

    const latestOrderQuery = Order.findOne({ _id: { $in: limitedOrderIds } })
      .sort({ order_date: -1 })
      .select('order_date')
      .lean();
    if (session) latestOrderQuery.session(session);
    const latestOrder = await latestOrderQuery.exec();

    return {
      count: limitedOrderIds.length,
      lastOrderDate: latestOrder?.order_date ?? null,
    };
  }

  async getLimitedOrderStatsBySessionIds(
    sessionIds: string[]
  ): Promise<Map<string, { count: number; lastOrderDate: Date | null }>> {
    const validSessionIds = [...new Set(sessionIds)]
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));
    if (validSessionIds.length === 0) return new Map();

    const rows = await this.model.aggregate<{
      _id: Types.ObjectId;
      count: number;
      lastOrderDate: Date | null;
    }>([
      {
        $match: {
          session_id: { $in: validSessionIds },
          unlimited_order_item: { $ne: true },
          item_state: { $ne: 'CANCELED' },
        },
      },
      { $group: { _id: { sessionId: '$session_id', orderId: '$order_id' } } },
      {
        $lookup: {
          from: 'orders',
          localField: '_id.orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $group: {
          _id: '$_id.sessionId',
          count: { $sum: 1 },
          lastOrderDate: { $max: '$order.order_date' },
        },
      },
    ]).exec();

    return new Map(rows.map(row => [
      row._id.toString(),
      { count: row.count, lastOrderDate: row.lastOrderDate ?? null },
    ]));
  }

  async getActiveItemCountsBySessionIds(sessionIds: string[]): Promise<Map<string, number>> {
    const validSessionIds = [...new Set(sessionIds)]
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));
    if (validSessionIds.length === 0) return new Map();

    const rows = await this.model.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          session_id: { $in: validSessionIds },
          item_state: { $ne: 'CANCELED' },
        },
      },
      { $group: { _id: '$session_id', count: { $sum: 1 } } },
    ]).exec();

    return new Map(rows.map(row => [row._id.toString(), row.count]));
  }
}

export class PaymentRepository extends BaseRepository<IPayment> {
  constructor() {
    super(Payment);
  }

  async createPayment(
    data: {
      session_id: string;
      restaurant_id: string;
      totem_snapshot: {
        totem_id: string;
        totem_name: string;
        totem_type: 'STANDARD' | 'TEMPORARY';
      };
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
    validateObjectId(data.restaurant_id, 'restaurant_id');
    validateObjectId(data.totem_snapshot.totem_id, 'totem_id');
    return this.create(
      {
        ...data,
        session_id: new Types.ObjectId(data.session_id),
        restaurant_id: new Types.ObjectId(data.restaurant_id),
        totem_snapshot: {
          ...data.totem_snapshot,
          totem_id: new Types.ObjectId(data.totem_snapshot.totem_id),
        },
        payment_date: new Date(),
      },
      session
    );
  }

  async findBySessionId(sessionId: string, session?: ClientSession): Promise<IPayment[]> {
    validateObjectId(sessionId, 'session_id');
    const query = this.model.find({ session_id: new Types.ObjectId(sessionId) });
    if (session) query.session(session);
    return query.exec();
  }

  async markTicketPaid(
    paymentId: string,
    ticketPart: number,
    session?: ClientSession
  ): Promise<IPayment | null> {
    validateObjectId(paymentId, 'payment_id');
    return this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(paymentId), tickets: { $elemMatch: { ticket_part: ticketPart, paid: false } } },
      { $set: { 'tickets.$.paid': true } },
      { returnDocument: 'after', session }
    ).exec();
  }

  async markAllTicketsPaidForSession(
    sessionId: string,
    session?: ClientSession
  ): Promise<IPayment | null> {
    validateObjectId(sessionId, 'session_id');
    return this.model.findOneAndUpdate(
      { session_id: new Types.ObjectId(sessionId) },
      { $set: { 'tickets.$[].paid': true } },
      { returnDocument: 'after', session }
    ).exec();
  }

  async getPaymentHistory(
    restaurantId: string,
    filters: { from?: Date; to?: Date; search?: string; limit?: number } = {}
  ): Promise<PaymentHistoryEntry[]> {
    validateObjectId(restaurantId, 'restaurant_id');

    const matchStage: Record<string, unknown> = {};
    if (filters.from || filters.to) {
      matchStage.payment_date = {};
      if (filters.from) (matchStage.payment_date as Record<string, Date>).$gte = filters.from;
      if (filters.to) (matchStage.payment_date as Record<string, Date>).$lte = filters.to;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'totemsessions',
          localField: 'session_id',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      {
        $lookup: {
          from: 'totems',
          localField: 'session.totem_id',
          foreignField: '_id',
          as: 'totem',
        },
      },
      { $unwind: { path: '$totem', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { restaurant_id: new Types.ObjectId(restaurantId) },
            {
              restaurant_id: { $exists: false },
              'totem.restaurant_id': new Types.ObjectId(restaurantId),
            },
          ],
        },
      },
    ];

    const search = filters.search?.trim();
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { 'totem.totem_name': { $regex: escapedSearch, $options: 'i' } },
            { 'totem_snapshot.totem_name': { $regex: escapedSearch, $options: 'i' } },
            { 'tickets.ticket_customer_name': { $regex: escapedSearch, $options: 'i' } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { payment_date: -1 } },
      { $limit: Math.min(Math.max(filters.limit ?? 100, 1), 300) },
      {
        $project: {
          _id: 1,
          session_id: 1,
          payment_type: 1,
          payment_total: 1,
          payment_date: 1,
          tickets: 1,
          session: {
            _id: '$session._id',
            totem_state: '$session.totem_state',
            session_date_start: '$session.session_date_start',
          },
          totem: {
            _id: { $ifNull: ['$totem._id', '$totem_snapshot.totem_id'] },
            totem_name: { $ifNull: ['$totem.totem_name', '$totem_snapshot.totem_name'] },
            totem_type: { $ifNull: ['$totem.totem_type', '$totem_snapshot.totem_type'] },
          },
        },
      }
    );

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'PaymentRepository.getPaymentHistory',
      { explain: false }
    );
  }

  /**
   * Get payment statistics using aggregation.
   */
  async getPaymentStats(
    restaurantId: string,
    dateRange?: { from?: Date; to?: Date }
  ): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    averageTicket: number;
    paidTickets: number;
    pendingTickets: number;
  }> {
    validateObjectId(restaurantId, 'restaurant_id');

    const matchStage: Record<string, unknown> = {
      restaurant_id: new Types.ObjectId(restaurantId),
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
