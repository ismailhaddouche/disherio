const redis = {
  isReady: true,
  get: jest.fn(),
  eval: jest.fn(),
  sMembers: jest.fn(),
  del: jest.fn(),
};

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => redis),
  initRedis: jest.fn(async () => redis),
}));

import {
  hashToken,
  rotateRefreshToken,
  verifyRefreshToken,
} from '../services/refresh-token.service';

const TOKEN = 'a'.repeat(64);
const USER_ID = '507f1f77bcf86cd799439011';
const FAMILY = 'family-1';
const METADATA = JSON.stringify({
  staffId: USER_ID,
  restaurantId: '507f1f77bcf86cd799439012',
  role: 'POS',
  family: FAMILY,
  createdAt: new Date(0).toISOString(),
});

describe('refresh-token rotation reuse detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.sMembers.mockResolvedValue([]);
    redis.del.mockResolvedValue(1);
  });

  it('atomically replaces the token and persists a consumed-token tombstone', async () => {
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key.startsWith('refresh:')) return METADATA;
      return null;
    });
    redis.eval.mockResolvedValue([1, METADATA]);

    const result = await rotateRefreshToken(TOKEN);

    expect(result).toEqual(expect.objectContaining({ userId: USER_ID, family: FAMILY }));
    expect(result?.refreshToken).toHaveLength(64);
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.eval.mock.calls[0][1].keys).toEqual(expect.arrayContaining([
      `refresh_consumed:${hashToken(TOKEN)}`,
      expect.stringMatching(new RegExp(`^refresh:${USER_ID}:`)),
      expect.stringMatching(/^refresh_lookup:/),
    ]));
  });

  it('verifies a token through its direct hash lookup without scanning Redis', async () => {
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key === `refresh:${USER_ID}:${hashToken(TOKEN)}`) return METADATA;
      return null;
    });

    await expect(verifyRefreshToken(TOKEN)).resolves.toEqual(expect.objectContaining({
      valid: true,
      family: FAMILY,
    }));
  });

  it('returns the same successor for a concurrent retry without revoking the family', async () => {
    let consumedMetadata: string | undefined;
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_consumed:${hashToken(TOKEN)}`) return consumedMetadata ?? null;
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key.startsWith(`refresh:${USER_ID}:`)) return METADATA;
      return null;
    });
    redis.eval.mockImplementation(async (_script: string, options: { arguments: string[] }) => {
      consumedMetadata = options.arguments[5];
      return [1, METADATA];
    });

    const firstRotation = await rotateRefreshToken(TOKEN);
    const retriedRotation = await rotateRefreshToken(TOKEN);

    expect(retriedRotation).toEqual(firstRotation);
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.sMembers).not.toHaveBeenCalled();
  });

  it('treats an atomic rotation race as an idempotent retry', async () => {
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key.startsWith(`refresh:${USER_ID}:`)) return METADATA;
      return null;
    });
    redis.eval.mockImplementation(async (_script: string, options: { arguments: string[] }) => [
      0,
      options.arguments[5],
    ]);

    await expect(rotateRefreshToken(TOKEN)).resolves.toEqual(expect.objectContaining({
      userId: USER_ID,
      family: FAMILY,
      refreshToken: expect.any(String),
    }));
    expect(redis.sMembers).not.toHaveBeenCalled();
  });

  it('revokes the family when a consumed token is presented again', async () => {
    redis.get.mockImplementation(async (key: string) =>
      key === `refresh_consumed:${hashToken(TOKEN)}` ? METADATA : null
    );

    await expect(rotateRefreshToken(TOKEN)).rejects.toThrow('INVALID_TOKEN');

    expect(redis.sMembers).toHaveBeenCalledWith(`refresh_family:${FAMILY}`);
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
