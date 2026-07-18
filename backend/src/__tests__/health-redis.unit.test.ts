const ping = jest.fn();
const getRedisClient = jest.fn();

jest.mock('../config/redis', () => ({ getRedisClient }));

import { checkRedis } from '../routes/health.routes';

describe('health authentication Redis check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRedisClient.mockReturnValue({ ping });
  });

  it('checks the authentication client with a live command', async () => {
    ping.mockResolvedValue('PONG');

    await expect(checkRedis()).resolves.toEqual(expect.objectContaining({ status: 'up' }));
    expect(getRedisClient).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('marks readiness dependency down when the authentication client fails', async () => {
    ping.mockRejectedValue(new Error('redis unavailable'));

    await expect(checkRedis()).resolves.toEqual(expect.objectContaining({
      status: 'down',
      message: 'redis unavailable',
    }));
  });
});
