let lockIfStateIn: jest.Mock;
let updateStateIf: jest.Mock;
let findActiveItemsBySessionId: jest.Mock;

const dbSession = { id: 'session' };

jest.mock('../utils/transactions', () => ({
  withTransaction: jest.fn(async (operation: (session: unknown) => Promise<unknown>) => operation(dbSession)),
}));

jest.mock('../repositories/totem.repository', () => ({
  TotemRepository: jest.fn().mockImplementation(() => ({})),
  TotemSessionRepository: jest.fn().mockImplementation(() => {
    lockIfStateIn = jest.fn();
    updateStateIf = jest.fn();
    return { lockIfStateIn, updateStateIf };
  }),
  CustomerRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../repositories/order.repository', () => ({
  ItemOrderRepository: jest.fn().mockImplementation(() => {
    findActiveItemsBySessionId = jest.fn();
    return { findActiveBySessionId: findActiveItemsBySessionId };
  }),
  PaymentRepository: jest.fn().mockImplementation(() => ({})),
}));

import { cancelSession } from '../services/totem.service';

const SESSION_ID = '507f1f77bcf86cd799439013';

describe('TotemService.cancelSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lockIfStateIn.mockResolvedValue({ _id: SESSION_ID, totem_state: 'STARTED' });
  });

  it('checks for inserted items under the session lock before cancellation', async () => {
    findActiveItemsBySessionId.mockResolvedValue([{ _id: 'item' }]);

    await expect(cancelSession(SESSION_ID)).rejects.toMatchObject({ message: 'SESSION_HAS_ITEMS' });

    expect(lockIfStateIn).toHaveBeenCalledWith(SESSION_ID, ['STARTED'], dbSession);
    expect(findActiveItemsBySessionId).toHaveBeenCalledWith(SESSION_ID, dbSession);
    expect(updateStateIf).not.toHaveBeenCalled();
  });

  it('cancels an empty session in the same transaction', async () => {
    const cancelled = { _id: SESSION_ID, totem_state: 'CANCELLED' };
    findActiveItemsBySessionId.mockResolvedValue([]);
    updateStateIf.mockResolvedValue(cancelled);

    await expect(cancelSession(SESSION_ID)).resolves.toBe(cancelled);
    expect(updateStateIf).toHaveBeenCalledWith(
      SESSION_ID,
      ['STARTED'],
      'CANCELLED',
      dbSession
    );
  });
});
