const redis = {
  isReady: true,
  get: jest.fn(),
  eval: jest.fn(),
  sMembers: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
};

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => redis),
  initRedis: jest.fn(async () => redis),
}));

import {
  hashToken,
  revokeRefreshFamily,
  rotateRefreshToken,
  verifyRefreshToken,
} from '../services/refresh-token.service';

const TOKEN = 'a'.repeat(64);
const SUCCESSOR_TOKEN = 'b'.repeat(64);
const USER_ID = '507f1f77bcf86cd799439011';
const FAMILY = 'family-1';
const METADATA = JSON.stringify({
  staffId: USER_ID,
  restaurantId: '507f1f77bcf86cd799439012',
  role: 'POS',
  family: FAMILY,
  createdAt: new Date(0).toISOString(),
});
const REVOKED_FAMILY_KEY = `refresh_family_revoked:${FAMILY}`;

describe('refresh-token rotation reuse detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.sMembers.mockResolvedValue([]);
    redis.setEx.mockResolvedValue('OK');
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

  it('passes the revoked-family flag key to the atomic rotation script', async () => {
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key.startsWith('refresh:')) return METADATA;
      return null;
    });
    redis.eval.mockResolvedValue([1, METADATA]);

    await rotateRefreshToken(TOKEN);

    const script = redis.eval.mock.calls[0][0] as string;
    const keys = redis.eval.mock.calls[0][1].keys as string[];
    expect(keys[7]).toBe(REVOKED_FAMILY_KEY);
    expect(script).toContain("redis.call('GET', KEYS[8])");
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
    let successorToken: string | undefined;
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_consumed:${hashToken(TOKEN)}`) return consumedMetadata ?? null;
      if (key === `refresh_retry:${hashToken(TOKEN)}`) return successorToken ?? null;
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key.startsWith(`refresh:${USER_ID}:`)) return METADATA;
      return null;
    });
    redis.eval.mockImplementation(async (_script: string, options: { arguments: string[] }) => {
      consumedMetadata = options.arguments[5];
      successorToken = options.arguments[7];
      return [1, METADATA];
    });

    const firstRotation = await rotateRefreshToken(TOKEN);
    const retriedRotation = await rotateRefreshToken(TOKEN);

    expect(retriedRotation).toEqual(firstRotation);
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.sMembers).not.toHaveBeenCalled();
  });

  it('treats an atomic rotation race as an idempotent retry', async () => {
    let successorToken: string | undefined;
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_retry:${hashToken(TOKEN)}`) return successorToken ?? null;
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key.startsWith(`refresh:${USER_ID}:`)) return METADATA;
      return null;
    });
    redis.eval.mockImplementation(async (_script: string, options: { arguments: string[] }) => {
      successorToken = options.arguments[7];
      return [0, options.arguments[5]];
    });

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

describe('refresh-token family revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.sMembers.mockResolvedValue([]);
    redis.setEx.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
  });

  it('marks the family as revoked before deleting its tokens', async () => {
    const callOrder: string[] = [];
    redis.setEx.mockImplementation(async () => {
      callOrder.push('setEx');
      return 'OK';
    });
    redis.sMembers.mockImplementation(async () => {
      callOrder.push('sMembers');
      return [];
    });

    await revokeRefreshFamily(FAMILY);

    expect(redis.setEx).toHaveBeenCalledWith(
      REVOKED_FAMILY_KEY,
      expect.any(Number),
      'revoked'
    );
    const ttl = redis.setEx.mock.calls[0][1] as number;
    expect(ttl).toBeGreaterThan(0);
    expect(callOrder).toEqual(['setEx', 'sMembers']);
  });

  it('rejects a rotation once the family revoked flag is set (revocation/rotation race)', async () => {
    // Simulate the Lua contract: the script observes the revoked-family flag
    // and refuses to create a successor.
    redis.get.mockImplementation(async (key: string) => {
      if (key === REVOKED_FAMILY_KEY) return 'revoked';
      if (key === `refresh_lookup:${hashToken(TOKEN)}`) return USER_ID;
      if (key === `refresh:${USER_ID}:${hashToken(TOKEN)}`) return METADATA;
      return null;
    });
    redis.eval.mockImplementation(async (_script: string, options: { keys: string[] }) => {
      const revoked = await redis.get(options.keys[7]);
      if (revoked) return [0, ''];
      return [1, METADATA];
    });

    await expect(rotateRefreshToken(TOKEN)).rejects.toThrow('INVALID_TOKEN');

    expect(redis.eval).toHaveBeenCalledTimes(1);
    // Fail-closed: the family is revoked again, never rotated.
    expect(redis.setEx).toHaveBeenCalledWith(REVOKED_FAMILY_KEY, expect.any(Number), 'revoked');
  });

  it('rejects a grace-window retry once the family has been revoked', async () => {
    const tombstone = JSON.stringify({
      ...JSON.parse(METADATA),
      consumedAt: new Date().toISOString(),
      successorTokenHash: hashToken(SUCCESSOR_TOKEN),
    });
    redis.get.mockImplementation(async (key: string) => {
      if (key === `refresh_consumed:${hashToken(TOKEN)}`) return tombstone;
      if (key === REVOKED_FAMILY_KEY) return 'revoked';
      if (key === `refresh_retry:${hashToken(TOKEN)}`) return SUCCESSOR_TOKEN;
      if (key === `refresh:${USER_ID}:${hashToken(SUCCESSOR_TOKEN)}`) return METADATA;
      return null;
    });

    await expect(rotateRefreshToken(TOKEN)).rejects.toThrow('INVALID_TOKEN');

    expect(redis.eval).not.toHaveBeenCalled();
  });
});
