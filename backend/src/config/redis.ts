import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

/**
 * Get Redis URL from environment
 */
function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

/**
 * Initialize main Redis client
 */
export async function initRedis(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  const url = getRedisUrl();
  
  redisClient = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    },
  });

  redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Get main Redis client (must call initRedis first)
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redisClient;
}

/**
 * Initialize Redis clients for Socket.IO adapter
 */
export async function initSocketRedisAdapter(): Promise<{ pubClient: RedisClientType; subClient: RedisClientType }> {
  if (pubClient && subClient) {
    return { pubClient, subClient };
  }

  const url = getRedisUrl();

  // Create publisher client
  pubClient = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    },
  });

  // Create subscriber client (duplicate)
  subClient = pubClient.duplicate();

  pubClient.on('error', (err) => {
    logger.error({ err }, 'Redis pub client error');
  });

  subClient.on('error', (err) => {
    logger.error({ err }, 'Redis sub client error');
  });

  await Promise.all([pubClient.connect(), subClient.connect()]);
  
  logger.info('Redis adapter clients connected');
  
  return { pubClient, subClient };
}

/**
 * Get Socket.IO Redis adapter clients
 */
export function getSocketRedisClients(): { pubClient: RedisClientType; subClient: RedisClientType } {
  if (!pubClient || !subClient) {
    throw new Error('Socket Redis clients not initialized. Call initSocketRedisAdapter() first.');
  }
  return { pubClient, subClient };
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  const promises: Promise<string>[] = [];
  
  if (redisClient) {
    promises.push(redisClient.quit());
    redisClient = null;
  }
  
  if (pubClient) {
    promises.push(pubClient.quit());
    pubClient = null;
  }
  
  if (subClient) {
    promises.push(subClient.quit());
    subClient = null;
  }

  await Promise.all(promises);
  logger.info('All Redis connections closed');
}
