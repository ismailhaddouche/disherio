import { Types } from 'mongoose';

const aggregateExec = jest.fn();
const aggregate = jest.fn((_pipeline: unknown[]) => ({ exec: aggregateExec }));

jest.mock('../models/order.model', () => ({
  ItemOrder: { aggregate },
  Order: { collection: { name: 'orders' } },
}));
jest.mock('../models/dish.model', () => ({
  Dish: { collection: { name: 'dishes' } },
}));
jest.mock('../models/staff.model', () => ({
  Staff: { collection: { name: 'staff' }, find: jest.fn() },
}));
jest.mock('../models/totem.model', () => ({
  SessionCustomer: { collection: { name: 'sessioncustomers' }, find: jest.fn() },
  TotemSession: { collection: { name: 'totemsessions' } },
  Totem: { collection: { name: 'totems' } },
}));

import { ActivityLogRepository } from '../repositories/activity-log.repository';

describe('ActivityLogRepository', () => {
  beforeEach(() => {
    aggregate.mockClear();
    aggregateExec.mockReset().mockResolvedValue([]);
  });

  it('applies type and user filters before sorting and limiting', async () => {
    const repository = new ActivityLogRepository();
    const restaurantId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();

    await repository.find({
      restaurantId,
      userId,
      type: 'CUSTOMER',
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-31T23:59:59.999Z'),
      limit: 100,
    });

    const pipeline = aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
    const filteredMatchIndex = pipeline.findIndex((stage) => {
      const match = stage['$match'] as Record<string, unknown> | undefined;
      return match?.['type'] === 'CUSTOMER';
    });
    const limitIndex = pipeline.findIndex((stage) => stage['$limit'] === 100);
    const sortIndex = pipeline.findIndex((stage) => stage['$sort'] !== undefined);
    const filteredMatch = pipeline[filteredMatchIndex]['$match'] as Record<string, unknown>;

    expect(filteredMatchIndex).toBeGreaterThan(-1);
    expect(pipeline[sortIndex]['$sort']).toEqual({ updatedAt: -1 });
    expect(filteredMatchIndex).toBeLessThan(limitIndex);
    expect(filteredMatch['activityUserId']?.toString()).toBe(userId);
    const dateMatch = pipeline.find((stage) => {
      const match = stage['$match'] as Record<string, unknown> | undefined;
      return match?.['updatedAt'] !== undefined;
    })?.['$match'] as Record<string, unknown>;
    expect(dateMatch['updatedAt']).toEqual({
      $gte: new Date('2026-01-01T00:00:00.000Z'),
      $lte: new Date('2026-01-31T23:59:59.999Z'),
    });
  });

  it('rejects an invalid user id before querying MongoDB', async () => {
    const repository = new ActivityLogRepository();

    await expect(repository.find({
      restaurantId: new Types.ObjectId().toString(),
      userId: 'invalid',
      limit: 100,
    })).rejects.toThrow('INVALID_USER_ID');

    expect(aggregate).not.toHaveBeenCalled();
  });

  it('keeps items whose dish was deleted: left-joins dishes and scopes through the session totem', async () => {
    const repository = new ActivityLogRepository();
    const restaurantId = new Types.ObjectId().toString();

    aggregateExec.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        type: 'CUSTOMER',
        timestamp: new Date('2026-01-02T00:00:00.000Z'),
        itemState: 'SERVED',
        dishType: 'KITCHEN',
        basePrice: 12.5,
        extrasCount: 1,
        dishName: 'Paella (snapshot)',
      },
    ]);

    const records = await repository.find({ restaurantId, limit: 100 });

    const pipeline = aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;

    // The dish join must be a left outer join so a deleted dish does not
    // drop the historical item.
    const dishUnwinds = pipeline.filter((stage) => {
      const unwind = stage['$unwind'] as unknown;
      if (typeof unwind === 'string') return unwind === '$dish';
      return (unwind as { path?: string } | undefined)?.path === '$dish';
    });
    expect(dishUnwinds.length).toBeGreaterThan(0);
    for (const stage of dishUnwinds) {
      expect(stage['$unwind']).toEqual({ path: '$dish', preserveNullAndEmptyArrays: true });
    }

    // Restaurant scoping must go through the session's totem, never through
    // the live dish document.
    const matchStages = pipeline
      .map((stage) => stage['$match'] as Record<string, unknown> | undefined)
      .filter((match): match is Record<string, unknown> => match !== undefined);
    expect(matchStages.some((match) => match['totem.restaurant_id'] !== undefined)).toBe(true);
    expect(matchStages.some((match) => match['dish.restaurant_id'] !== undefined)).toBe(false);

    // The projected dish name falls back to the item name snapshot.
    const project = pipeline.find((stage) => stage['$project'] !== undefined)?.['$project'] as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(project['dishName'])).toContain('item_name_snapshot');

    // The orphan item (resolved from its snapshot) is returned as-is.
    expect(records).toHaveLength(1);
    expect(records[0].dishName).toBe('Paella (snapshot)');
  });
});
