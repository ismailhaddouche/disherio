import { createClient } from 'redis';
import { logger } from './logger';
import { getEnv } from './env';

export type DisherRedisClient = ReturnType<typeof createClient>;

let redisClient: DisherRedisClient | null = null;
let redisConnectionPromise: Promise<DisherRedisClient> | null = null;
let pubClient: DisherRedisClient | null = null;
let subClient: DisherRedisClient | null = null;

/**
 * Get Redis URL from validated environment
 */
function getRedisUrl(): string {
  return getEnv().REDIS_URL;
}

function getRedisPassword(): string | undefined {
  return getEnv().REDIS_PASSWORD;
}

/**
 * Initialize main Redis client
 */
export async function initRedis(): Promise<DisherRedisClient> {
  if (redisClient?.isReady) {
    return redisClient;
  }
  if (redisConnectionPromise) return redisConnectionPromise;
  if (redisClient?.isOpen) {
    throw new Error('Redis is reconnecting and is not ready');
  }
  if (redisClient) {
    redisClient.destroy();
    redisClient = null;
  }

  const url = getRedisUrl();
  const client = createClient({
    url,
    password: getRedisPassword(),
    socket: {
      reconnectStrategy: (retries) => retries >= 5 ? false : Math.min(retries * 50, 500),
    },
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  redisConnectionPromise = (async () => {
    try {
      await client.connect();
      redisClient = client;
      return client;
    } catch (error) {
      if (client.isOpen) client.destroy();
      throw error;
    } finally {
      redisConnectionPromise = null;
    }
  })();
  return redisConnectionPromise;
}

/**
 * Get main Redis client (must call initRedis first)
 */
export function getRedisClient(): DisherRedisClient {
  if (!redisClient?.isReady) {
    throw new Error('Redis not initialized. Call initRedis() first.');
  }
  return redisClient;
}

/**
 * Initialize Redis clients for Socket.IO adapter
 */
export async function initSocketRedisAdapter(): Promise<{
  pubClient: DisherRedisClient;
  subClient: DisherRedisClient;
}> {
  if (pubClient?.isReady && subClient?.isReady) {
    return { pubClient, subClient };
  }

  if (pubClient) pubClient.destroy();
  if (subClient) subClient.destroy();
  pubClient = null;
  subClient = null;

  const url = getRedisUrl();

  // Create publisher client
  const publisher = createClient({
    url,
    password: getRedisPassword(),
    socket: {
      reconnectStrategy: (retries) => retries >= 5 ? false : Math.min(retries * 50, 500),
    },
  });

  // Create subscriber client (duplicate)
  const subscriber = publisher.duplicate();

  publisher.on('error', (err) => {
    logger.error({ err }, 'Redis pub client error');
  });

  subscriber.on('error', (err) => {
    logger.error({ err }, 'Redis sub client error');
  });

  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
  } catch (error) {
    if (publisher.isOpen) publisher.destroy();
    if (subscriber.isOpen) subscriber.destroy();
    throw error;
  }
  pubClient = publisher;
  subClient = subscriber;

  logger.info('Redis adapter clients connected');

  return { pubClient, subClient };
}

/**
 * Get Socket.IO Redis adapter clients
 */
export function getSocketRedisClients(): {
  pubClient: DisherRedisClient;
  subClient: DisherRedisClient;
} {
  if (!pubClient || !subClient) {
    throw new Error('Socket Redis clients not initialized. Call initSocketRedisAdapter() first.');
  }
  return { pubClient, subClient };
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  const clients = [redisClient, pubClient, subClient].filter(
    (client): client is DisherRedisClient => client !== null
  );
  redisClient = null;
  pubClient = null;
  subClient = null;
  redisConnectionPromise = null;

  await Promise.all(clients.map(async (client) => {
    if (client.isOpen) {
      await client.quit();
    } else {
      client.destroy();
    }
  }));
  logger.info('All Redis connections closed');
}
