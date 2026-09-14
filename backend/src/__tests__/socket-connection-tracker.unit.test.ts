import type { AuthenticatedSocket } from '../middlewares/socketAuth';
import {
  cleanupSocketConnection,
  getConnectionTrackerStats,
  trackSocketConnection,
  trackSocketJoinRoom,
} from '../sockets/middleware/connection-tracker';

describe('Socket connection tracker', () => {
  it('keeps every handler registration on one multi-profile connection and fully cleans it', () => {
    const socket = {
      id: 'multi-profile-socket',
      user: {
        staffId: 'staff-1', restaurantId: 'restaurant-1', name: 'Alex',
        permissions: ['KTS', 'POS', 'TAS'],
      },
      handshake: { address: '127.0.0.1', headers: { 'user-agent': 'test' } },
    } as unknown as AuthenticatedSocket;

    for (const type of ['KDS', 'POS', 'TAS', 'TOTEM']) {
      trackSocketConnection(socket, type);
      trackSocketJoinRoom(socket.id, `${type.toLowerCase()}:room`);
    }

    expect(getConnectionTrackerStats()).toEqual({
      active: 1,
      byType: { KDS: 1, POS: 1, TAS: 1, TOTEM: 1 },
    });

    cleanupSocketConnection(socket.id);

    expect(getConnectionTrackerStats()).toEqual({ active: 0, byType: {} });
  });
});
