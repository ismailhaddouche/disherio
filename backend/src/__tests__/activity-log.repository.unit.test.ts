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
});
