jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => { throw new Error('not initialized'); }),
  initRedis: jest.fn(async () => { throw new Error('unavailable'); }),
}));

import {
  bindSocketRateLimitToCustomer,
  getSocketClientAddress,
  getSocketRateLimitIdentity,
} from '../sockets/middleware/rate-limiter';

function publicSocket(id: string, address = '192.0.2.10', forwardedFor?: string) {
  return {
    id,
    data: { totemQr: 'table-qr' },
    handshake: { address, headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {} },
    conn: { remoteAddress: address },
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

  it('uses the client address forwarded by the trusted reverse proxy', () => {
    const first = publicSocket('socket-a', '172.20.0.5', '198.51.100.10');
    const second = publicSocket('socket-b', '172.20.0.5', '198.51.100.11');

    expect(getSocketClientAddress(first)).toBe('198.51.100.10');
    expect(getSocketRateLimitIdentity(first)).not.toBe(getSocketRateLimitIdentity(second));
  });

  it('ignores spoofed forwarding headers from an untrusted peer', () => {
    const socket = publicSocket('socket-a', '198.51.100.20', '203.0.113.99');
    expect(getSocketClientAddress(socket)).toBe('198.51.100.20');
  });
});
