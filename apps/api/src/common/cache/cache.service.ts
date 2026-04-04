import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

/**
 * Cache service providing a typed interface for caching operations.
 * Supports TTL-based caching with Redis or in-memory fallback.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await this.cache.get<T>(key);
    } catch (error) {
      this.logger.warn(`Cache get error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set a value in cache with optional TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional, defaults to cache config)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl);
    } catch (error) {
      this.logger.warn(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a value from cache
   * @param key - Cache key
   */
  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.logger.warn(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern - Key pattern (e.g., 'user:*')
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      // Note: This requires Redis. For in-memory cache, this is a no-op
      const store = this.cache.store as any;
      if (store.keys && store.del) {
        const keys = await store.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map((key: string) => this.cache.del(key)));
        }
      }
    } catch (error) {
      this.logger.warn(`Cache delete by pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Get or set a cached value
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param ttl - Time to live in milliseconds
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  /**
   * Clear all cache entries
   */
  async reset(): Promise<void> {
    try {
      await this.cache.reset();
    } catch (error) {
      this.logger.warn('Cache reset error:', error);
    }
  }

  // JWT-specific cache methods

  /**
   * Cache JWT validation result
   * @param userId - User ID
   * @param tenantId - Tenant ID (optional)
   * @param valid - Whether the JWT is valid
   * @param ttl - TTL in milliseconds (default 5 minutes)
   */
  async cacheJwtValidation(
    userId: string,
    tenantId: string | undefined,
    valid: boolean,
    ttl = 5 * 60 * 1000,
  ): Promise<void> {
    const key = this.getJwtCacheKey(userId, tenantId);
    await this.set(key, valid, ttl);
  }

  /**
   * Get cached JWT validation result
   * @param userId - User ID
   * @param tenantId - Tenant ID (optional)
   */
  async getJwtValidation(
    userId: string,
    tenantId: string | undefined,
  ): Promise<boolean | undefined> {
    const key = this.getJwtCacheKey(userId, tenantId);
    return this.get<boolean>(key);
  }

  /**
   * Invalidate JWT cache for a user
   * @param userId - User ID
   */
  async invalidateUserJwt(userId: string): Promise<void> {
    await this.delByPattern(`jwt_valid:${userId}:*`);
  }

  /**
   * Invalidate JWT cache for a user in a specific tenant
   * @param userId - User ID
   * @param tenantId - Tenant ID
   */
  async invalidateTenantMemberJwt(
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const key = this.getJwtCacheKey(userId, tenantId);
    await this.del(key);
  }

  private getJwtCacheKey(userId: string, tenantId: string | undefined): string {
    return `jwt_valid:${userId}:${tenantId ?? 'global'}`;
  }
}
