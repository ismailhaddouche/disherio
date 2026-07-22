import { Types } from 'mongoose';

let totemFindByQR: jest.Mock;
let totemFindById: jest.Mock;
let sessionCreate: jest.Mock;
let sessionFindByTotemId: jest.Mock;

jest.mock('../repositories/totem.repository', () => ({
  TotemRepository: jest.fn().mockImplementation(() => {
    totemFindByQR = jest.fn();
    totemFindById = jest.fn();
    return { findByQR: totemFindByQR, findById: totemFindById };
  }),
  TotemSessionRepository: jest.fn().mockImplementation(() => {
    sessionCreate = jest.fn();
    sessionFindByTotemId = jest.fn();
    return {
      createSession: sessionCreate,
      findByTotemId: sessionFindByTotemId,
      setSessionToken: jest.fn(),
    };
  }),
  CustomerRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../repositories/order.repository', () => ({
  ItemOrderRepository: jest.fn().mockImplementation(() => ({})),
  PaymentRepository: jest.fn().mockImplementation(() => ({})),
}));

// Unit tests run without Redis: execute the locked section directly.
jest.mock('../utils/locks', () => ({
  withLock: (_key: string, fn: () => Promise<unknown>) => fn(),
}));

import { TotemSession } from '../models/totem.model';
import { getOrCreateSessionByQR } from '../services/totem.service';

describe('public QR session lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a fresh session whenever the table has no active session', async () => {
    const totemId = new Types.ObjectId();
    const createdSession = {
      _id: new Types.ObjectId(),
      totem_id: totemId,
      totem_state: 'STARTED',
      session_token: 'new-session-token',
    };
    const totem = { _id: totemId, totem_qr: 'permanent-table-qr' };
    totemFindByQR.mockResolvedValue(totem);
    totemFindById.mockResolvedValue(totem);
    sessionCreate.mockResolvedValue(createdSession);
    jest.spyOn(TotemSession, 'findOne').mockReturnValue({
      sort: () => ({ exec: async () => null }),
    } as never);

    await expect(getOrCreateSessionByQR('permanent-table-qr')).resolves.toMatchObject({
      session: createdSession,
    });
    expect(sessionCreate).toHaveBeenCalledWith(totem, expect.any(String));
    expect(sessionFindByTotemId).not.toHaveBeenCalled();
  });
});
