/**
 * Simple in-memory cache to reduce DB queries
 * NOTE: In production with multiple instances, use Redis
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 2 * 60 * 1000; // 2 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start automatic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  set<T>(key: string, value: T, ttlMs: number = this.defaultTTL): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries (call periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new CacheService();

// Cache keys
export const CacheKeys = {
  staffByRestaurant: (restaurantId: string) => `staff:${restaurantId}`,
  dishByRestaurant: (restaurantId: string) => `dishes:${restaurantId}`,
  categoriesByRestaurant: (restaurantId: string) => `categories:${restaurantId}`,
  dishById: (dishId: string) => `dish:${dishId}`,
  categoryById: (categoryId: string) => `category:${categoryId}`,
};
