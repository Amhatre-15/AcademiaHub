import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';

interface InMemoryEntry {
  value: string;
  expiresAt: number | null;
}

interface SortedSetEntry {
  member: string;
  score: number;
}

class CacheService {
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private memoryCache = new Map<string, InMemoryEntry>();
  private memorySortedSets = new Map<string, Map<string, number>>();

  constructor() {
    this.initRedis();
  }

  private initRedis() {
    // Avoid socket connection hang in test environments unless explicit REDIS_URL provided
    if (process.env.NODE_ENV === 'test' && !process.env.REDIS_URL) {
      this.isRedisConnected = false;
      return;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    try {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 500,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't spam reconnection if Redis is not running
        enableOfflineQueue: false,
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
        console.log('[Cache] Connected to Redis cluster successfully.');
      });

      this.redis.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn('[Cache] Redis connection lost, switching to in-memory fallback cache:', err.message);
        }
        this.isRedisConnected = false;
      });

      // Probe connection once on startup
      this.redis.connect().catch(() => {
        this.isRedisConnected = false;
      });
    } catch {
      this.isRedisConnected = false;
    }
  }

  public async close(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
    }
  }

  /**
   * Check whether Redis connection is live.
   */
  public isConnected(): boolean {
    return this.isRedisConnected;
  }

  /**
   * Retrieve a cached object by key.
   */
  public async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch {
        // Fall back to memory cache on Redis read failure
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Store a value in cache with optional TTL in seconds.
   */
  public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isRedisConnected && this.redis) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await this.redis.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.redis.set(key, serialized);
        }
        return;
      } catch {
        // Fall back to memory cache
      }
    }

    const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryCache.set(key, { value: serialized, expiresAt });
  }

  /**
   * Delete a key from cache.
   */
  public async del(key: string): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        // Fall back
      }
    }
    this.memoryCache.delete(key);
    this.memorySortedSets.delete(key);
  }

  /**
   * Delete all keys matching a prefix or wildcard pattern (e.g. "academic:*").
   */
  public async delPattern(pattern: string): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch {
        // Fall back
      }
    }

    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
    for (const key of this.memorySortedSets.keys()) {
      if (regex.test(key)) {
        this.memorySortedSets.delete(key);
      }
    }
  }

  /**
   * Add a member with score to a Sorted Set (for live quiz leaderboards).
   */
  public async zadd(key: string, score: number, member: string): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.zadd(key, score, member);
        return;
      } catch {
        // Fall back
      }
    }

    if (!this.memorySortedSets.has(key)) {
      this.memorySortedSets.set(key, new Map<string, number>());
    }
    this.memorySortedSets.get(key)!.set(member, score);
  }

  /**
   * Get members with highest scores (descending) from a sorted set.
   */
  public async zrevrangeWithScores(
    key: string,
    start = 0,
    stop = -1
  ): Promise<SortedSetEntry[]> {
    if (this.isRedisConnected && this.redis) {
      try {
        const results = await this.redis.zrevrange(key, start, stop, 'WITHSCORES');
        const list: SortedSetEntry[] = [];
        for (let i = 0; i < results.length; i += 2) {
          list.push({
            member: results[i],
            score: parseFloat(results[i + 1]),
          });
        }
        return list;
      } catch {
        // Fall back
      }
    }

    const setMap = this.memorySortedSets.get(key);
    if (!setMap) return [];

    const sorted = Array.from(setMap.entries())
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score);

    if (stop === -1) {
      return sorted.slice(start);
    }
    return sorted.slice(start, stop + 1);
  }

  /**
   * Express middleware to cache GET route responses with TTL.
   */
  public cacheMiddleware(
    ttlSeconds = 60,
    keyGenerator?: (req: Request) => string
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only cache idempotent GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : `http_cache:${req.baseUrl || ''}${req.path}:${JSON.stringify(req.query)}`;

      try {
        const cached = await this.get<{ body: any; status: number }>(cacheKey);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          return res.status(cached.status).json(cached.body);
        }

        res.setHeader('X-Cache', 'MISS');

        // Intercept res.json to capture response body
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            void this.set(cacheKey, { body, status: res.statusCode }, ttlSeconds);
          }
          return originalJson(body);
        };

        next();
      } catch (err) {
        next();
      }
    };
  }

  /**
   * Helper to clear cached tags upon mutations.
   */
  public async invalidateTags(tags: string[]): Promise<void> {
    await Promise.all(tags.map(t => this.delPattern(`*${t}*`)));
  }
}

export const cacheService = new CacheService();
