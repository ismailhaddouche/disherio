/**
 * Tests for the totem handler behaviour on top of the shared (Redis-backed)
 * session state: multi-node closing marks, cluster-wide customer counts and
 * the scheduled force-disconnect.
 */

import { createFakeRedis } from './helpers/fake-redis';

let sessionUpdateStateIf: jest.Mock;
let roomEmit: jest.Mock;
let socketsLeave: jest.Mock;
let inRoom: jest.Mock;

jest.unmock('../sockets/totem.handler');

const fakeRedis = createFakeRedis();

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => fakeRedis.client),
  initRedis: jest.fn(async () => fakeRedis.client),
}));

jest.mock('../repositories', () => ({
  TotemSessionRepository: jest.fn().mockImplementation(() => {
    sessionUpdateStateIf = jest.fn();
    return { updateStateIf: sessionUpdateStateIf };
  }),
}));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({ emit: roomEmit })),
    in: inRoom,
    sockets: { sockets: new Map() },
  })),
}));

jest.mock('../services/totem.service', () => ({}));
jest.mock('../sockets/tas.handler', () => ({
  notifyTASHelpRequest: jest.fn(),
  notifyTASBillRequest: jest.fn(),
}));

describe('totem handler with shared session state', () => {
  beforeEach(() => {
    jest.resetModules();
    fakeRedis.reset();
    roomEmit = jest.fn();
    socketsLeave = jest.fn();
    inRoom = jest.fn(() => ({ socketsLeave }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('force-disconnects the whole room through the adapter and clears shared state', async () => {
    jest.useFakeTimers();
    const { closeSessionForCustomers, isSessionClosing } = await import('../sockets/totem.handler');
    const state = await import('../sockets/totem-session-state');

    // A customer that may be connected to ANOTHER node (written straight to Redis)
    await state.addSessionCustomer('s1', { customerName: 'Remote', socketId: 'sock-remote', joinedAt: 't' });
    sessionUpdateStateIf.mockResolvedValue({ _id: 's1' });

    const result = await closeSessionForCustomers('s1', { closedBy: 'waiter' });

    expect(result).toBe(true);
    expect(await isSessionClosing('s1')).toBe(true);

    await jest.advanceTimersByTimeAsync(5000);

    // The whole room is notified and detached via the Redis adapter,
    // not by iterating node-local sockets.
    expect(roomEmit).toHaveBeenCalledWith(
      'totem:force_disconnect',
      expect.objectContaining({ reason: 'SESSION_CLOSED' })
    );
    expect(inRoom).toHaveBeenCalledWith('customer:session:s1');
    expect(socketsLeave).toHaveBeenCalledWith('customer:session:s1');

    // Shared state is fully cleaned up
    expect(await isSessionClosing('s1')).toBe(false);
    expect(await state.getSessionCustomerCount('s1')).toBe(0);
  });

  it('aborts the scheduled force-disconnect when the close was cancelled (session reopened)', async () => {
    jest.useFakeTimers();
    const { closeSessionForCustomers, cancelPendingSessionClose, isSessionClosing } = await import('../sockets/totem.handler');
    sessionUpdateStateIf.mockResolvedValue({ _id: 's1' });

    await closeSessionForCustomers('s1', { closedBy: 'waiter' });
    await cancelPendingSessionClose('s1');

    expect(await isSessionClosing('s1')).toBe(false);

    await jest.advanceTimersByTimeAsync(5000);

    expect(roomEmit).not.toHaveBeenCalledWith('totem:force_disconnect', expect.anything());
    expect(socketsLeave).not.toHaveBeenCalled();
  });

  it('rolls back the closing mark when the session was already closed', async () => {
    const { closeSessionForCustomers, isSessionClosing } = await import('../sockets/totem.handler');
    sessionUpdateStateIf.mockResolvedValue(null); // already transitioned elsewhere

    const result = await closeSessionForCustomers('s1', { closedBy: 'customer' });

    expect(result).toBe(false);
    expect(await isSessionClosing('s1')).toBe(false);
    expect(roomEmit).not.toHaveBeenCalled();
  });

  it('reports the cluster-wide active customer count', async () => {
    const { getActiveCustomerCount } = await import('../sockets/totem.handler');
    const state = await import('../sockets/totem-session-state');

    await state.addSessionCustomer('s1', { customerName: 'A', socketId: 'sock-a', joinedAt: 't' });
    await state.addSessionCustomer('s1', { customerName: 'B', socketId: 'sock-b', joinedAt: 't' });

    expect(await getActiveCustomerCount('s1')).toBe(2);
    expect(await getActiveCustomerCount('unknown')).toBe(0);
  });
});
