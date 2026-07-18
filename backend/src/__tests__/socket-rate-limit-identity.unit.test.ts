jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => { throw new Error('not initialized'); }),
  initRedis: jest.fn(async () => { throw new Error('unavailable'); }),
}));

import {
  bindSocketRateLimitToCustomer,
  getSocketRateLimitIdentity,
} from '../sockets/middleware/rate-limiter';

function publicSocket(id: string) {
  return {
    id,
    data: { totemQr: 'table-qr' },
    handshake: { address: '192.0.2.10' },
    conn: { remoteAddress: '192.0.2.10' },
  } as never;
}

describe('Socket rate-limit identity', () => {
  it('survives reconnects and can bind to a stable customer', () => {
    const first = publicSocket('socket-a');
    const second = publicSocket('socket-b');

    expect(getSocketRateLimitIdentity(first)).toBe(getSocketRateLimitIdentity(second));

    bindSocketRateLimitToCustomer(first, '507f1f77bcf86cd799439011');
    bindSocketRateLimitToCustomer(second, '507f1f77bcf86cd799439011');
    expect(getSocketRateLimitIdentity(first)).toBe(getSocketRateLimitIdentity(second));
  });
});
