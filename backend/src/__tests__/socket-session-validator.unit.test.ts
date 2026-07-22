const sessionFindById = jest.fn();
const totemRepositoryConstructor = jest.fn();

jest.mock('../repositories', () => ({
  TotemSessionRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => sessionFindById(...args),
  })),
  TotemRepository: totemRepositoryConstructor,
}));

jest.mock('../config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

import { validateSessionAccess } from '../sockets/middleware/session-validator';
import type { AuthenticatedSocket } from '../middlewares/socketAuth';

function socketForRestaurant(restaurantId?: string): AuthenticatedSocket {
  return {
    id: 'socket-1',
    user: restaurantId ? { staffId: 'staff-1', restaurantId } : undefined,
  } as unknown as AuthenticatedSocket;
}

describe('socket session tenant validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the immutable session tenant without loading a deleted temporary totem', async () => {
    sessionFindById.mockResolvedValue({
      restaurant_id: { toString: () => 'restaurant-1' },
    });

    await expect(validateSessionAccess(socketForRestaurant('restaurant-1'), 'session-1'))
      .resolves.toEqual({ allowed: true });
    expect(totemRepositoryConstructor).not.toHaveBeenCalled();
  });

  it('rejects a staff socket from another restaurant', async () => {
    sessionFindById.mockResolvedValue({
      restaurant_id: { toString: () => 'restaurant-2' },
    });

    await expect(validateSessionAccess(socketForRestaurant('restaurant-1'), 'session-1'))
      .resolves.toEqual({ allowed: false, reason: 'UNAUTHORIZED_SESSION' });
  });

  it('rejects public sockets from staff-only session rooms', async () => {
    await expect(validateSessionAccess(socketForRestaurant(), 'session-1'))
      .resolves.toEqual({ allowed: false, reason: 'AUTHENTICATION_REQUIRED' });
    expect(sessionFindById).not.toHaveBeenCalled();
  });
});
