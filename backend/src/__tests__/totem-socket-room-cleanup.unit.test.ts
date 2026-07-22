jest.mock('../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../config/socket', () => ({ getIO: jest.fn() }));
jest.mock('../repositories', () => ({
  TotemSessionRepository: jest.fn(() => ({ findById: jest.fn(), updateStateIf: jest.fn() })),
}));
jest.mock('../repositories/order.repository', () => ({
  ItemOrderRepository: jest.fn(() => ({})),
}));
jest.mock('../services/totem.service', () => ({}));
jest.mock('../sockets/tas.handler', () => ({
  notifyTASHelpRequest: jest.fn(),
  notifyTASBillRequest: jest.fn(),
}));
jest.mock('../sockets/middleware/rate-limiter', () => ({
  bindSocketRateLimitToCustomer: jest.fn(),
  rateLimitMiddleware: (_socket: unknown, _event: string, handler: (...args: unknown[]) => unknown) => handler,
}));
jest.mock('../sockets/middleware/connection-tracker', () => ({
  trackSocketConnection: jest.fn(),
  cleanupSocketConnection: jest.fn(),
  trackSocketJoinRoom: jest.fn(),
  trackSocketLeaveRoom: jest.fn(),
  updateSocketActivity: jest.fn(),
}));

import type { AuthenticatedSocket } from '../middlewares/socketAuth';

describe('totem socket room cleanup', () => {
  it('leaves both customer and general update rooms when leaving a session', () => {
    const {
      customerSessions,
      registerTotemHandlers,
      sessionCustomers,
    } = jest.requireActual('../sockets/totem.handler') as typeof import('../sockets/totem.handler');
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const socket = {
      id: 'socket-1',
      on: jest.fn((event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler)),
      leave: jest.fn(),
      emit: jest.fn(),
    } as unknown as AuthenticatedSocket;
    const sessionId = '507f1f77bcf86cd799439011';

    registerTotemHandlers({} as never, socket);
    customerSessions.set(socket.id, sessionId);
    sessionCustomers.set(sessionId, new Set([socket.id]));

    handlers.get('totem:leave_session')?.();

    expect(socket.leave).toHaveBeenCalledWith(`customer:session:${sessionId}`);
    expect(socket.leave).toHaveBeenCalledWith(`session:${sessionId}`);
    expect(customerSessions.has(socket.id)).toBe(false);
    expect(sessionCustomers.has(sessionId)).toBe(false);
  });
});
