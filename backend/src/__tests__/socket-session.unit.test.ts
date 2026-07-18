const disconnectSockets = jest.fn();
const inRoom = jest.fn(() => ({ disconnectSockets }));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({ in: inRoom })),
}));

import { disconnectStaffSockets } from '../services/socket-session.service';

describe('socket session invalidation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disconnects every socket in the staff room', async () => {
    await disconnectStaffSockets('staff-123');

    expect(inRoom).toHaveBeenCalledWith('user:staff-123');
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });
});
