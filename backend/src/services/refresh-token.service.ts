import { createHash, createHmac, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { ErrorCode } from '@disherio/shared';
import { logger } from '../config/logger';
import { getRedisClient, initRedis, type DisherRedisClient } from '../config/redis';
import { getEnv } from '../config/env';
import { JwtPayload } from '../middlewares/auth';
import { parseDurationSeconds } from '../utils/duration';

const REFRESH_TOKEN_PREFIX = 'refresh:';
const REFRESH_LOOKUP_PREFIX = 'refresh_lookup:';
const BLOCKLIST_PREFIX = 'blocklist:access:';
const FAMILY_PREFIX = 'refresh_family:';
const FAMILY_REVOKED_PREFIX = 'refresh_family_revoked:';
const CONSUMED_REFRESH_PREFIX = 'refresh_consumed:';
const ROTATION_RETRY_GRACE_MS = 10_000;

// Minimum refresh token length we will accept
const MIN_REFRESH_TOKEN_BYTES = 32;

let redis: DisherRedisClient | null = null;

/**
 * Lazily resolve the main Redis client. Falls back to initRedis() if not ready.
 * Auth services require Redis to be available; degraded cache is not acceptable
 * for token lifecycle operations. If Redis is down we throw SERVER_CONFIGURATION_ERROR.
 */
async function getRedis(): Promise<DisherRedisClient> {
  if (redis?.isReady) return redis;
  try {
    redis = getRedisClient();
    if (redis?.isReady) return redis;
  } catch {
    // client not initialized yet — fall through to initRedis
  }
  redis = await initRedis();
  return redis;
}

function env() {
  return getEnv();
}

/**
 * Hash a token to a deterministic compact identifier safe for Redis keys and value lookups.
 * Uses SHA-256; adequate for internal keying (not for password storage).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate an access token with the configured short lifetime.
 */
export function generateAccessToken(payload: JwtPayload): string {
  const { JWT_SECRET, JWT_EXPIRES } = env();
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
    jwtid: randomBytes(16).toString('hex'),
  } as jwt.SignOptions);
}

/**
 * Generate a long opaque refresh token (32 random bytes = 64 hex chars).
 * This is preferred to a JWT because it can be revoked instantly.
 */
export function generateRefreshTokenValue(): string {
  return randomBytes(MIN_REFRESH_TOKEN_BYTES).toString('hex');
}

function deriveRefreshSuccessor(tokenHash: string, family: string): string {
  return createHmac('sha256', env().JWT_REFRESH_SECRET)
    .update(`${family}:${tokenHash}`)
    .digest('hex');
}

interface RefreshTokenMetadata {
  staffId: string;
  restaurantId: string;
  role: string;
  family: string;
  createdAt: string;
}

interface ConsumedRefreshTokenMetadata extends RefreshTokenMetadata {
  consumedAt: string;
  successorTokenHash: string;
}

async function resolveConsumedRefreshToken(
  redisClient: DisherRedisClient,
  tokenHash: string,
  serializedMetadata: string
): Promise<{ userId: string; family: string; refreshToken: string }> {
  let metadata: ConsumedRefreshTokenMetadata;
  try {
    metadata = JSON.parse(serializedMetadata) as ConsumedRefreshTokenMetadata;
  } catch (err) {
    logger.warn({ err, tokenHash }, 'Invalid consumed refresh-token tombstone');
    throw new Error(ErrorCode.INVALID_TOKEN);
  }

  // A revoked family must reject every token, including a successor created
  // by a rotation that raced with the revocation cleanup.
  if (await redisClient.get(`${FAMILY_REVOKED_PREFIX}${metadata.family}`)) {
    logRefreshAuditEvent(metadata.staffId, metadata.family, {
      event: 'reuse_detected',
      tokenHash,
      at: new Date().toISOString(),
    });
    throw new Error(ErrorCode.INVALID_TOKEN);
  }

  const consumedAt = Date.parse(metadata.consumedAt);
  const ageMs = Date.now() - consumedAt;
  const isRetryCandidate = Number.isFinite(consumedAt)
    && ageMs >= 0
    && ageMs <= ROTATION_RETRY_GRACE_MS;

  if (isRetryCandidate) {
    const successorToken = deriveRefreshSuccessor(tokenHash, metadata.family);
    if (hashToken(successorToken) === metadata.successorTokenHash) {
      const successorKey = `${REFRESH_TOKEN_PREFIX}${metadata.staffId}:${metadata.successorTokenHash}`;
      if (await redisClient.get(successorKey)) {
        logRefreshAuditEvent(metadata.staffId, metadata.family, {
          event: 'rotation_retry',
          tokenHash,
          at: new Date().toISOString(),
        });
        return {
          userId: metadata.staffId,
          family: metadata.family,
          refreshToken: successorToken,
        };
      }
    }
  }

  await revokeRefreshFamily(metadata.family);
  logRefreshAuditEvent(metadata.staffId, metadata.family, {
    event: 'reuse_detected',
    tokenHash,
    at: new Date().toISOString(),
  });
  logger.warn(
    { userId: metadata.staffId, family: metadata.family },
    'Refresh token reuse detected; family revoked'
  );
  throw new Error(ErrorCode.INVALID_TOKEN);
}

/**
 * Issue a new refresh token and persist it in Redis with TTL.
 * Also stores metadata needed to re-issue access tokens during rotation.
 */
export async function issueRefreshToken(payload: JwtPayload, family?: string): Promise<string> {
  const { JWT_REFRESH_EXPIRES } = env();
  const redisClient = await getRedis();
  const token = generateRefreshTokenValue();
  const tokenHash = hashToken(token);
  const tokenFamily = family ?? randomBytes(16).toString('hex');
  const ttlSeconds = parseDurationSeconds(JWT_REFRESH_EXPIRES);

  const metadata: RefreshTokenMetadata = {
    staffId: payload.staffId,
    restaurantId: payload.restaurantId,
    role: payload.role,
    family: tokenFamily,
    createdAt: new Date().toISOString(),
  };

  // Primary storage: refresh:<userId>:<tokenHash>
  const key = `${REFRESH_TOKEN_PREFIX}${payload.staffId}:${tokenHash}`;
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(metadata));
  await redisClient.setEx(`${REFRESH_LOOKUP_PREFIX}${tokenHash}`, ttlSeconds, payload.staffId);

  // Maintain family membership for rotation audit and reuse detection
  const familyKey = `${FAMILY_PREFIX}${tokenFamily}`;
  await redisClient.sAdd(familyKey, tokenHash);
  await redisClient.expire(familyKey, ttlSeconds);

  return token;
}

interface RefreshVerificationResult {
  valid: boolean;
  payload?: JwtPayload;
  family?: string;
  error?: string;
}

/**
 * Verify an opaque refresh token by looking it up in Redis.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshVerificationResult> {
  const redisClient = await getRedis();
  const tokenHash = hashToken(token);

  const userId = await redisClient.get(`${REFRESH_LOOKUP_PREFIX}${tokenHash}`);
  if (!userId || !/^[a-f\d]{24}$/i.test(userId)) {
    return { valid: false, error: ErrorCode.INVALID_TOKEN };
  }

  const key = `${REFRESH_TOKEN_PREFIX}${userId}:${tokenHash}`;
  const raw = await redisClient.get(key);
  if (!raw) {
    return { valid: false, error: ErrorCode.INVALID_TOKEN };
  }

  let metadata: RefreshTokenMetadata;
  try {
    metadata = JSON.parse(raw) as RefreshTokenMetadata;
  } catch {
    return { valid: false, error: ErrorCode.INVALID_TOKEN };
  }
  if (metadata.staffId !== userId) return { valid: false, error: ErrorCode.INVALID_TOKEN };

  const payload: JwtPayload = {
    staffId: metadata.staffId,
    restaurantId: metadata.restaurantId,
    role: metadata.role,
    permissions: [], // re-hydrated from DB during rotation
    name: '',
  };

  return { valid: true, payload, family: metadata.family };
}

/**
 * Backfill the direct token-hash index for refresh tokens created by versions
 * that stored only refresh:<userId>:<tokenHash>. This scan runs once during
 * startup; refresh requests themselves always use constant-time lookups.
 */
export async function ensureRefreshTokenLookupIndex(): Promise<number> {
  const redisClient = await getRedis();
  let cursor = '0';
  let indexed = 0;

  do {
    const result = await redisClient.scan(cursor, {
      MATCH: `${REFRESH_TOKEN_PREFIX}*:*`,
      COUNT: 250,
    });
    cursor = result.cursor;

    for (const key of result.keys) {
      const match = /^refresh:([a-f\d]{24}):([a-f\d]{64})$/i.exec(key);
      if (!match) continue;
      const [, userId, tokenHash] = match;
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) {
        await redisClient.setEx(`${REFRESH_LOOKUP_PREFIX}${tokenHash}`, ttl, userId);
        indexed++;
      }
    }
  } while (cursor !== '0');

  return indexed;
}

/**
 * Rotate refresh tokens: consume the old one and return the metadata + family.
 * The caller is responsible for re-hydrating the full payload from the DB and
 * issuing a new access/refresh token pair.
 * Concurrent retries within a short grace window receive the same successor.
 * Reuse outside that window revokes the whole family.
 */
export async function rotateRefreshToken(
  token: string
): Promise<{ userId: string; family: string; refreshToken: string } | null> {
  const redisClient = await getRedis();
  const tokenHash = hashToken(token);
  const consumedKey = `${CONSUMED_REFRESH_PREFIX}${tokenHash}`;

  // A consumed-token tombstone preserves the family association after the
  // active refresh key has been removed. Without it, a replay cannot be
  // distinguished from a random invalid token and family revocation is
  // impossible.
  const consumedMetadata = await redisClient.get(consumedKey);
  if (consumedMetadata) {
    return resolveConsumedRefreshToken(redisClient, tokenHash, consumedMetadata);
  }

  const verification = await verifyRefreshToken(token);
  if (!verification.valid || !verification.payload) {
    return null;
  }

  const userId = verification.payload.staffId;
  const family = verification.family ?? randomBytes(16).toString('hex');
  const familyKey = `${FAMILY_PREFIX}${family}`;
  const currentKey = `${REFRESH_TOKEN_PREFIX}${userId}:${tokenHash}`;
  const newRefreshToken = deriveRefreshSuccessor(tokenHash, family);
  const newTokenHash = hashToken(newRefreshToken);
  const newKey = `${REFRESH_TOKEN_PREFIX}${userId}:${newTokenHash}`;
  const currentLookupKey = `${REFRESH_LOOKUP_PREFIX}${tokenHash}`;
  const newLookupKey = `${REFRESH_LOOKUP_PREFIX}${newTokenHash}`;
  const ttlSeconds = parseDurationSeconds(env().JWT_REFRESH_EXPIRES);
  const newMetadata: RefreshTokenMetadata = {
    staffId: userId,
    restaurantId: verification.payload.restaurantId,
    role: verification.payload.role,
    family,
    createdAt: new Date().toISOString(),
  };
  const consumedTokenMetadata: ConsumedRefreshTokenMetadata = {
    ...newMetadata,
    consumedAt: new Date().toISOString(),
    successorTokenHash: newTokenHash,
  };

  // Consume the old token, persist its tombstone and create its deterministic
  // replacement in one Redis operation. A concurrent replay can derive the
  // same replacement without persisting the bearer token itself.
  // The revoked-family flag is checked first: revokeRefreshFamily sets it
  // before reading the family members, so a rotation that races a revocation
  // either committed before the flag (and its successor is deleted by the
  // revocation cleanup) or observes the flag here and creates nothing.
  const rotationScript = `
    if redis.call('GET', KEYS[7]) then return {0, ''} end
    local tombstone = redis.call('GET', KEYS[3])
    if tombstone then return {0, tombstone} end
    local current = redis.call('GET', KEYS[1])
    if not current then return {0, ''} end
    redis.call('DEL', KEYS[1])
    redis.call('DEL', KEYS[5])
    redis.call('SREM', KEYS[2], ARGV[1])
    redis.call('SETEX', KEYS[3], ARGV[4], ARGV[6])
    redis.call('SETEX', KEYS[4], ARGV[4], ARGV[3])
    redis.call('SETEX', KEYS[6], ARGV[4], ARGV[5])
    redis.call('SADD', KEYS[2], ARGV[2])
    redis.call('EXPIRE', KEYS[2], ARGV[4])
    return {1, current}
  `;
  const rotationResult = await redisClient.eval(rotationScript, {
    keys: [currentKey, familyKey, consumedKey, newKey, currentLookupKey, newLookupKey, `${FAMILY_REVOKED_PREFIX}${family}`],
    arguments: [
      tokenHash,
      newTokenHash,
      JSON.stringify(newMetadata),
      String(ttlSeconds),
      userId,
      JSON.stringify(consumedTokenMetadata),
    ],
  }) as unknown as [number, string];

  if (Number(rotationResult[0]) !== 1) {
    const serializedTombstone = String(rotationResult[1] ?? '');
    if (serializedTombstone) {
      return resolveConsumedRefreshToken(redisClient, tokenHash, serializedTombstone);
    }
    await revokeRefreshFamily(family);
    throw new Error(ErrorCode.INVALID_TOKEN);
  }

  logRefreshAuditEvent(userId, family, {
    event: 'rotate',
    tokenHash,
    newTokenHash,
    at: new Date().toISOString(),
  });

  return { userId, family, refreshToken: newRefreshToken };
}

/**
 * Revoke all refresh tokens in a family.
 * Sets a revoked-family flag (TTL = refresh token lifetime) before reading the
 * family members. The rotation script checks that flag atomically, so a
 * concurrent rotation either committed before the flag was set — in which case
 * its successor is already a family member and is deleted by the cleanup
 * below — or observes the flag and refuses to create a successor. Either way
 * no token of the family survives the revocation.
 */
export async function revokeRefreshFamily(family: string): Promise<void> {
  const redisClient = await getRedis();
  const familyKey = `${FAMILY_PREFIX}${family}`;
  const ttlSeconds = parseDurationSeconds(env().JWT_REFRESH_EXPIRES);

  await redisClient.setEx(`${FAMILY_REVOKED_PREFIX}${family}`, ttlSeconds, 'revoked');

  const tokenHashes = await redisClient.sMembers(familyKey);

  for (const tokenHash of tokenHashes) {
    const lookupKey = `${REFRESH_LOOKUP_PREFIX}${tokenHash}`;
    const userId = await redisClient.get(lookupKey);
    if (userId && /^[a-f\d]{24}$/i.test(userId)) {
      await redisClient.del([`${REFRESH_TOKEN_PREFIX}${userId}:${tokenHash}`, lookupKey]);
    } else {
      await redisClient.del(lookupKey);
    }
  }

  await redisClient.del(familyKey);
}

/**
 * Revoke all refresh tokens for a user.
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  const redisClient = await getRedis();
  let cursor = '0';
  let familyIds: string[] = [];
  do {
    const result = await redisClient.scan(cursor, {
      MATCH: `${REFRESH_TOKEN_PREFIX}${userId}:*`,
      COUNT: 100,
    });
    cursor = result.cursor;
    for (const key of result.keys) {
      const tokenHash = key.slice(key.lastIndexOf(':') + 1);
      const raw = await redisClient.get(key);
      if (raw) {
        try {
          const metadata = JSON.parse(raw) as RefreshTokenMetadata;
          familyIds.push(metadata.family);
        } catch {
          // ignore
        }
      }
      await redisClient.del([key, `${REFRESH_LOOKUP_PREFIX}${tokenHash}`]);
    }
  } while (cursor !== '0');

  familyIds = [...new Set(familyIds)];
  if (familyIds.length > 0) {
    await Promise.all(familyIds.map((family) => revokeRefreshFamily(family)));
  }
}

/**
 * Add an access token to the Redis blocklist. Used at logout.
 * TTL is the remaining lifetime of the token so we don't store stale entries forever.
 */
export async function blocklistAccessToken(token: string): Promise<JwtPayload | null> {
  let payload: JwtPayload & jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env().JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload & jwt.JwtPayload;
  } catch {
    return null;
  }

  if (!payload.exp) return null;

  const redisClient = await getRedis();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxTtl = parseDurationSeconds(env().JWT_EXPIRES);
  const ttl = Math.min(payload.exp - nowSeconds, maxTtl);
  if (ttl <= 0) return null;

  const key = `${BLOCKLIST_PREFIX}${hashToken(token)}`;
  await redisClient.setEx(key, ttl, 'revoked');
  return payload;
}

/**
 * Check whether an access token has been revoked.
 */
export async function isAccessTokenRevoked(token: string): Promise<boolean> {
  try {
    const redisClient = await getRedis();
    const key = `${BLOCKLIST_PREFIX}${hashToken(token)}`;
    const value = await redisClient.get(key);
    return value === 'revoked';
  } catch (err) {
    logger.error({ err }, 'Unable to query access token blocklist; rejecting authentication');
    throw err;
  }
}

interface RefreshAuditEvent {
  event: 'issue' | 'rotate' | 'rotation_retry' | 'revoke' | 'reuse_detected' | 'logout';
  tokenHash?: string;
  newTokenHash?: string;
  at: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Emit a structured refresh-token audit event to the log stream. Audit history
 * is consumed from log aggregation (Pino -> stdout), not retained in process
 * memory, so it survives restarts and is consistent across replicas.
 */
function logRefreshAuditEvent(
  userId: string,
  family: string,
  event: RefreshAuditEvent
): void {
  logger.info({ userId, family, event }, 'Refresh token audit event');
}
