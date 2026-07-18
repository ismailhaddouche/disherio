import { Types } from 'mongoose';

const itemAggregateExec = jest.fn();
const itemAggregate = jest.fn((_pipeline: unknown[]) => ({ exec: itemAggregateExec }));

jest.mock('../models/order.model', () => ({
  Order: { collection: { name: 'orders' } },
  ItemOrder: { collection: { name: 'itemorders' }, aggregate: itemAggregate },
  Payment: { collection: { name: 'payments' } },
}));

import { ItemOrderRepository } from '../repositories/order.repository';

describe('order metric repository policies', () => {
  beforeEach(() => {
    itemAggregate.mockClear();
    itemAggregateExec.mockReset().mockResolvedValue([]);
  });

  it('loads limited-order counts for all sessions with one aggregation', async () => {
    const firstSessionId = new Types.ObjectId();
    const secondSessionId = new Types.ObjectId();
    const lastOrderDate = new Date('2026-01-01T12:00:00.000Z');
    itemAggregateExec.mockResolvedValue([
      { _id: firstSessionId, count: 2, lastOrderDate },
      { _id: secondSessionId, count: 1, lastOrderDate: null },
    ]);

    const result = await new ItemOrderRepository().getLimitedOrderStatsBySessionIds([
      firstSessionId.toString(),
      secondSessionId.toString(),
    ]);

    expect(itemAggregate).toHaveBeenCalledTimes(1);
    expect(result.get(firstSessionId.toString())).toEqual({ count: 2, lastOrderDate });
    expect(result.get(secondSessionId.toString())).toEqual({ count: 1, lastOrderDate: null });
  });

  it('loads non-cancelled item counts for all sessions with one aggregation', async () => {
    const firstSessionId = new Types.ObjectId();
    const secondSessionId = new Types.ObjectId();
    itemAggregateExec.mockResolvedValue([
      { _id: firstSessionId, count: 3 },
      { _id: secondSessionId, count: 1 },
    ]);

    const result = await new ItemOrderRepository().getActiveItemCountsBySessionIds([
      firstSessionId.toString(),
      secondSessionId.toString(),
    ]);

    expect(itemAggregate).toHaveBeenCalledTimes(1);
    expect(itemAggregate.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        $match: expect.objectContaining({ item_state: { $ne: 'CANCELED' } }),
      }),
    ]));
    expect(result.get(firstSessionId.toString())).toBe(3);
    expect(result.get(secondSessionId.toString())).toBe(1);
  });
});
