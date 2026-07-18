/**
 * TotemService.reopenSession — payment guard (unit test).
 *
 * A session that already has a Payment record cannot be reopened. Reopening
 * it would flip COMPLETE back to STARTED and leave an orphan Payment that
 * markTicketPaid could mutate, breaking the paid state machine.
 *
 * Repositories are mocked at the module boundary so the service under test
 * runs against stubs without touching MongoDB or Redis.
 */

// Stubs captured when the service instantiates its repositories.
let paymentFindBySessionId: jest.Mock;
let sessionReopenWithToken: jest.Mock;

const dbSession = { id: 'session' };

jest.mock('../utils/transactions', () => ({
  withTransaction: jest.fn(async (operation: (session: unknown) => Promise<unknown>) => operation(dbSession)),
}));

jest.mock('../repositories/totem.repository', () => {
  return {
    TotemRepository: jest.fn().mockImplementation(() => ({ findById: jest.fn() })),
    TotemSessionRepository: jest.fn().mockImplementation(() => {
      sessionReopenWithToken = jest.fn();
      return { reopenWithToken: sessionReopenWithToken };
    }),
    CustomerRepository: jest.fn().mockImplementation(() => ({ findById: jest.fn() })),
  };
});

jest.mock('../repositories/order.repository', () => {
  return {
    ItemOrderRepository: jest.fn().mockImplementation(() => ({ findActiveBySessionId: jest.fn() })),
    PaymentRepository: jest.fn().mockImplementation(() => {
      paymentFindBySessionId = jest.fn();
      return { findBySessionId: paymentFindBySessionId };
    }),
  };
});

// Import after mocks are registered.
import { reopenSession } from '../services/totem.service';

const SESSION_ID = '507f1f77bcf86cd799439021';

describe('TotemService.reopenSession — payment guard', () => {
  beforeEach(() => {
    paymentFindBySessionId.mockReset();
    paymentFindBySessionId.mockResolvedValue([]);
    sessionReopenWithToken.mockReset();
  });

  it('throws SESSION_ALREADY_PAID when a payment exists for the session', async () => {
    sessionReopenWithToken.mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'STARTED',
      totem_id: '507f1f77bcf86cd799439099',
      session_token: 'rotated',
    });
    paymentFindBySessionId.mockResolvedValue([{ _id: 'pay1', session_id: SESSION_ID }]);

    await expect(reopenSession(SESSION_ID)).rejects.toMatchObject({
      message: 'SESSION_ALREADY_PAID',
      statusCode: 409,
    });
    expect(sessionReopenWithToken).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String),
      dbSession
    );
    expect(paymentFindBySessionId).toHaveBeenCalledWith(SESSION_ID, dbSession);
  });

  it('proceeds to reopen when no payment exists', async () => {
    paymentFindBySessionId.mockResolvedValue([]);
    sessionReopenWithToken.mockResolvedValue({
      _id: SESSION_ID,
      totem_state: 'STARTED',
      totem_id: '507f1f77bcf86cd799439099',
      session_token: null,
    });
    const result = await reopenSession(SESSION_ID);
    expect(result).not.toBeNull();
    expect(sessionReopenWithToken).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String),
      dbSession
    );
  });

  it('returns null when the session is not in COMPLETE state', async () => {
    paymentFindBySessionId.mockResolvedValue([]);
    sessionReopenWithToken.mockResolvedValue(null);

    await expect(reopenSession(SESSION_ID)).resolves.toBeNull();
    expect(paymentFindBySessionId).not.toHaveBeenCalled();
  });
});
