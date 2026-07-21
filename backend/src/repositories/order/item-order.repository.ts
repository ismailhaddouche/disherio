import { Types, ClientSession, PipelineStage } from 'mongoose';
import { Order, ItemOrder, IItemOrder } from '../../models/order.model';
import { BaseRepository, validateObjectId, validateObjectIdOptional } from '../base.repository';
import { QueryProfiler } from '../../utils/query-profiler';

export interface PendingItemsByStation {
  _id: string;
  count: number;
  items: KDSItem[];
  oldestItem?: Date;
  averageWaitTime?: number;
  station?: string;
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
   * Get sales by dish with aggregation pipeline, scoped to a set of sessions.
   * Efficiently calculates revenue and quantity per dish.
   * Scoped by session (not by live dish ids) so historical items whose dish
   * was deleted still contribute, using their stored name/price snapshots.
   */
  async getSalesByDish(
    sessionIds: string[],
    dateRange?: { from?: Date; to?: Date }
  ): Promise<SalesByDish[]> {
    if (sessionIds.length === 0) return [];

    const validSessionIds = sessionIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const matchStage: Record<string, unknown> = {
      session_id: { $in: validSessionIds },
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
        $lookup: {
          from: 'totemsessions',
          localField: 'session_id',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      // Only count items from paid sessions, so this revenue figure stays
      // consistent with paymentStats (which sums real payments). A session
      // only reaches PAID once its payment is fully settled (see
      // payment.service markTicketPaid/archiveSession).
      { $match: { 'session.totem_state': 'PAID' } },
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
