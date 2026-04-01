/**
 * Redis Cache Service for DisherIO
 * Provides distributed caching with Redis for multi-instance deployments
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../config/logger';

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  MENU: 300,           // 5 minutes
  CATEGORIES: 600,     // 10 minutes
  RESTAURANT_CONFIG: 3600,  // 1 hour
  SESSION: 86400,      // 24 hours
  HTTP_RESPONSE: 60,   // 1 minute default for HTTP responses
} as const;

class CacheService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  /**
   * Connect to Redis server
   * Idempotent - can be called multiple times safely
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client?.isReady) {
      return;
    }

    // Prevent multiple concurrent connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.doConnect();
    return this.connectionPromise;
  }

  private async doConnect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      const url = redisPassword 
        ? `${redisUrl.replace('://', `://:${redisPassword}@`)}`
        : redisUrl;

      this.client = createClient({
        url,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              logger.error('Redis max reconnection attempts reached');
              return false;
            }
            return Math.min(retries * 1000, 5000);
          },
        },
      });

      this.client.on('error', (err) => {
        logger.error({ err }, 'Redis client error');
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        logger.info('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Redis - cache will be disabled');
      this.client = null;
      this.isConnected = false;
      // Don't throw - allow app to work without cache
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Get a value from cache
   * @returns The cached value or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client?.isReady) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      logger.error({ error, key }, 'Cache get error');
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = CACHE_TTL.MENU): Promise<void> {
    if (!this.isConnected || !this.client?.isReady) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
    } catch (error) {
      logger.error({ error, key }, 'Cache set error');
    }
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    if (!this.isConnected || !this.client?.isReady) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache delete error');
    }
  }

  /**
   * Delete keys matching a pattern (uses SCAN for safety)
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client?.isReady) {
      return;
    }

    try {
      let cursor = '0';
      do {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        
        cursor = result.cursor;
        
        if (result.keys.length > 0) {
          await this.client.del(result.keys);
          logger.debug({ pattern, keys: result.keys.length }, 'Cache keys deleted by pattern');
        }
      } while (cursor !== '0');
    } catch (error) {
      logger.error({ error, pattern }, 'Cache delete pattern error');
    }
  }

  /**
   * Invalidate all menu-related cache for a restaurant
   */
  async invalidateMenuCache(restaurantId: string): Promise<void> {
    await Promise.all([
      this.deletePattern(`menu:*${restaurantId}*`),
      this.deletePattern(`dishes:*${restaurantId}*`),
      this.deletePattern(`http:*menu*${restaurantId}*`),
    ]);
    logger.debug({ restaurantId }, 'Menu cache invalidated');
  }

  /**
   * Invalidate all category-related cache for a restaurant
   */
  async invalidateCategoriesCache(restaurantId: string): Promise<void> {
    await Promise.all([
      this.deletePattern(`categories:*${restaurantId}*`),
      this.deletePattern(`category:*`),
      this.deletePattern(`http:*categories*${restaurantId}*`),
    ]);
    logger.debug({ restaurantId }, 'Categories cache invalidated');
  }

  /**
   * Invalidate restaurant configuration cache
   */
  async invalidateRestaurantCache(restaurantId: string): Promise<void> {
    await Promise.all([
      this.delete(`restaurant:${restaurantId}`),
      this.deletePattern(`restaurant:*${restaurantId}*`),
      this.deletePattern(`http:*restaurant*${restaurantId}*`),
    ]);
    logger.debug({ restaurantId }, 'Restaurant cache invalidated');
  }

  /**
   * Check if cache is available/connected
   */
  isReady(): boolean {
    return this.isConnected && this.client?.isReady === true;
  }

  /**
   * Get cache statistics (if available)
   */
  async getStats(): Promise<{ keys?: number; connected: boolean }> {
    if (!this.isConnected || !this.client?.isReady) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('keyspace');
      const match = info.match(/keys=(\d+)/);
      return {
        keys: match ? parseInt(match[1], 10) : undefined,
        connected: true,
      };
    } catch {
      return { connected: true };
    }
  }

  /**
   * Get TTL (time to live) of a key in seconds
   */
  async getTTL(key: string): Promise<number> {
    if (!this.isConnected || !this.client?.isReady) {
      return -2;
    }

    try {
      const ttl = await this.client.ttl(key);
      return ttl ?? -2;
    } catch {
      return -2;
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async flushAll(): Promise<void> {
    if (!this.isConnected || !this.client?.isReady) {
      return;
    }

    try {
      await this.client.flushAll();
      logger.warn('All cache flushed');
    } catch (error) {
      logger.error({ error }, 'Cache flush error');
    }
  }
}

// Export singleton instance
export const cache = new CacheService();

// Cache key generators
export const CacheKeys = {
  // Restaurant keys
  restaurant: (id: string) => `restaurant:${id}`,
  restaurantConfig: (id: string) => `restaurant:config:${id}`,
  
  // Menu/Dish keys
  menu: (restaurantId: string, lang?: string) => 
    lang ? `menu:${restaurantId}:${lang}` : `menu:${restaurantId}`,
  dish: (id: string) => `dish:${id}`,
  dishesByRestaurant: (restaurantId: string) => `dishes:${restaurantId}`,
  
  // Category keys
  category: (id: string) => `category:${id}`,
  categoriesByRestaurant: (restaurantId: string) => `categories:${restaurantId}`,
  
  // Staff keys
  staff: (restaurantId: string) => `staff:${restaurantId}`,
  staffById: (id: string) => `staff:member:${id}`,
  
  // HTTP response cache keys
  httpResponse: (url: string) => `http:${url}`,
  
  // Session/Auth keys
  session: (token: string) => `session:${token}`,
  
  // Language keys
  languages: (restaurantId: string) => `languages:${restaurantId}`,
  defaultLanguage: (restaurantId: string) => `languages:default:${restaurantId}`,
};

// Helper for cache-aside pattern with automatic serialization
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.MENU
): Promise<T> {
  // Try to get from cache first
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch from source
  const data = await fetcher();
  
  // Store in cache (fire and forget)
  await cache.set(key, data, ttlSeconds);
  
  return data;
}
