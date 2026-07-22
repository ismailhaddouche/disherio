import { PipelineStage, Types } from 'mongoose';
import { Dish } from '../models/dish.model';
import { ItemOrder, Order } from '../models/order.model';
import { Staff } from '../models/staff.model';
import { SessionCustomer, TotemSession } from '../models/totem.model';
import { validateObjectId } from './base.repository';

export type ActivityLogType = 'KDS' | 'POS' | 'TAS' | 'CUSTOMER';

export interface ActivityLogQuery {
  restaurantId: string;
  from?: Date;
  to?: Date;
  userId?: string;
  type?: ActivityLogType;
  limit: number;
}

export interface ActivityLogRecord {
  _id: Types.ObjectId;
  type: ActivityLogType;
  timestamp: Date;
  userId?: Types.ObjectId;
  userName?: string;
  itemState: string;
  dishType: string;
  basePrice: number;
  extrasCount: number;
  variantName?: string;
  dishName?: string;
}

export interface ActivityLogUser {
  id: string;
  name: string;
  type: 'STAFF' | 'CUSTOMER';
}

export class ActivityLogRepository {
  async find(query: ActivityLogQuery): Promise<ActivityLogRecord[]> {
    validateObjectId(query.restaurantId, 'restaurant_id');
    if (query.userId) validateObjectId(query.userId, 'user_id');

    const restaurantId = new Types.ObjectId(query.restaurantId);
    const pipeline: PipelineStage[] = [];
    if (query.from || query.to) {
      pipeline.push({
        $match: {
          updatedAt: {
            ...(query.from ? { $gte: query.from } : {}),
            ...(query.to ? { $lte: query.to } : {}),
          },
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: Dish.collection.name,
          localField: 'item_dish_id',
          foreignField: '_id',
          as: 'dish',
        },
      },
      // Left outer join: the dish may have been deleted. Historical items
      // carry their own snapshots, so they must survive the missing dish.
      { $unwind: { path: '$dish', preserveNullAndEmptyArrays: true } },
      // Session snapshots preserve tenant ownership after a temporary totem
      // or a catalog dish has been deleted.
      {
        $lookup: {
          from: TotemSession.collection.name,
          localField: 'session_id',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      { $match: { 'session.restaurant_id': restaurantId } },
      {
        $lookup: {
          from: Order.collection.name,
          localField: 'order_id',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $set: {
          type: {
            $ifNull: [
              '$last_activity_source',
              {
                $cond: [
                  { $ne: [{ $ifNull: ['$customer_id', null] }, null] },
                  'CUSTOMER',
                  'POS',
                ],
              },
            ],
          },
          activityUserId: {
            $ifNull: ['$last_activity_user_id', { $ifNull: ['$customer_id', '$order.staff_id'] }],
          },
        },
      },
    );

    const itemMatch: Record<string, unknown> = {};
    if (query.type) itemMatch.type = query.type;
    if (query.userId) itemMatch.activityUserId = new Types.ObjectId(query.userId);
    if (Object.keys(itemMatch).length > 0) pipeline.push({ $match: itemMatch });

    pipeline.push(
      { $sort: { updatedAt: -1 } },
      { $limit: query.limit },
      {
        $lookup: {
          from: Staff.collection.name,
          let: { userId: '$activityUserId' },
          pipeline: [{
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$userId'] },
                  { $eq: ['$restaurant_id', restaurantId] },
                ],
              },
            },
          }],
          as: 'staff',
        },
      },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: SessionCustomer.collection.name,
          let: { userId: '$activityUserId', sessionId: '$session_id' },
          pipeline: [{
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$userId'] },
                  { $eq: ['$session_id', '$$sessionId'] },
                ],
              },
            },
          }],
          as: 'sessionCustomer',
        },
      },
      { $unwind: { path: '$sessionCustomer', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          type: 1,
          timestamp: { $ifNull: ['$updatedAt', '$createdAt'] },
          userId: '$activityUserId',
          userName: {
            $ifNull: ['$customer_name', { $ifNull: ['$sessionCustomer.customer_name', '$staff.staff_name'] }],
          },
          itemState: '$item_state',
          dishType: '$item_disher_type',
          basePrice: '$item_base_price',
          extrasCount: { $size: { $ifNull: ['$item_disher_extras', []] } },
          variantName: { $arrayElemAt: ['$item_disher_variant.name.value', 0] },
          dishName: {
            $ifNull: [
              { $arrayElemAt: ['$item_name_snapshot.value', 0] },
              { $arrayElemAt: ['$dish.disher_name.value', 0] },
            ],
          },
        },
      }
    );

    return ItemOrder.aggregate<ActivityLogRecord>(pipeline).exec();
  }

  async findUsers(restaurantIdValue: string): Promise<ActivityLogUser[]> {
    validateObjectId(restaurantIdValue, 'restaurant_id');
    const restaurantId = new Types.ObjectId(restaurantIdValue);
    const [staff, customerIds] = await Promise.all([
      Staff.find({ restaurant_id: restaurantId }).select('staff_name').lean().exec(),
      ItemOrder.aggregate<{ _id: Types.ObjectId }>([
        {
          $lookup: {
            from: TotemSession.collection.name,
            localField: 'session_id',
            foreignField: '_id',
            as: 'session',
          },
        },
        { $unwind: '$session' },
        {
          $match: {
            'session.restaurant_id': restaurantId,
            customer_id: { $type: 'objectId' },
          },
        },
        { $group: { _id: '$customer_id' } },
      ]).exec(),
    ]);
    const customers = await SessionCustomer.find({
      _id: { $in: customerIds.map((entry) => entry._id) },
    }).select('customer_name').lean().exec();

    return [
      ...staff.map((entry) => ({
        id: entry._id.toString(),
        name: entry.staff_name,
        type: 'STAFF' as const,
      })),
      ...customers.map((entry) => ({
        id: entry._id.toString(),
        name: entry.customer_name,
        type: 'CUSTOMER' as const,
      })),
    ];
  }
}
