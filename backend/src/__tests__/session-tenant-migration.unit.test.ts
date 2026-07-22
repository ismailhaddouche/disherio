const sessionFind = jest.fn();
const sessionUpdateOne = jest.fn();
const totemFindById = jest.fn();
const paymentFindOne = jest.fn();

jest.mock('../models/totem.model', () => ({
  TotemSession: {
    find: (...args: unknown[]) => sessionFind(...args),
    updateOne: (...args: unknown[]) => sessionUpdateOne(...args),
  },
  Totem: {
    findById: (...args: unknown[]) => totemFindById(...args),
  },
}));

jest.mock('../models/order.model', () => ({
  Payment: {
    findOne: (...args: unknown[]) => paymentFindOne(...args),
  },
}));

jest.mock('../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));

import { migration0004 } from '../migrations/0004-session-tenant-snapshot';

function queryResult<T>(value: T) {
  return { lean: () => ({ exec: async () => value }) };
}

function sessionCursor(sessions: Array<{ _id: { toString(): string }; totem_id: string }>) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* sessions;
    },
  };
}

describe('session tenant snapshot migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it('fails instead of permanently accepting an unrecoverable legacy session', async () => {
    sessionFind.mockReturnValue({
      cursor: () => sessionCursor([{ _id: { toString: () => 'session-1' }, totem_id: 'totem-1' }]),
    });
    totemFindById.mockReturnValue(queryResult(null));
    paymentFindOne.mockReturnValue(queryResult(null));

    await expect(migration0004.up()).rejects.toThrow(
      'MIGRATION_0004_UNRECOVERABLE_SESSIONS: 1 session(s): session-1'
    );
    expect(sessionUpdateOne).not.toHaveBeenCalled();
  });

  it('recovers tenant ownership from a historical payment when the totem was deleted', async () => {
    const sessionId = { toString: () => 'session-2' };
    const snapshot = {
      totem_id: 'totem-2',
      totem_name: 'Terrace 2',
      totem_type: 'TEMPORARY',
    };
    sessionFind.mockReturnValue({
      cursor: () => sessionCursor([{ _id: sessionId, totem_id: 'totem-2' }]),
    });
    totemFindById.mockReturnValue(queryResult(null));
    paymentFindOne.mockReturnValue(queryResult({ restaurant_id: 'restaurant-2', totem_snapshot: snapshot }));

    await expect(migration0004.up()).resolves.toBeUndefined();
    expect(sessionUpdateOne).toHaveBeenCalledWith(
      { _id: sessionId },
      { $set: { restaurant_id: 'restaurant-2', totem_snapshot: snapshot } }
    );
  });
});
