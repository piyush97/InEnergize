/**
 * Multi-Layer Cache Manager for InErgize
 * Implements L1 (Memory), L2 (Redis), and L3 (Database) caching strategy
 */

import { Redis } from 'ioredis';
import NodeCache from 'node-cache';
import pino from 'pino';
import { promisify } from 'util';
import zlib from 'zlib';

const logger = pino({ name: 'cache-manager' });
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CacheConfig {
  l1: {
    enabled: boolean;
    ttlSeconds: number;
    maxKeys: number;
    checkPeriod: number;
  };
  l2: {
    enabled: boolean;
    ttlSeconds: number;
    compression: boolean;
    keyPrefix: string;
  };
  l3: {
    enabled: boolean;
    ttlSeconds: number;
  };
}

export interface CacheEntry<T> {
  data: T;
  metadata: {
    createdAt: number;
    accessCount: number;
    lastAccessed: number;
    version: string;
    compressed?: boolean;
  };
}

export interface CacheStats {
  l1: {
    hits: number;
    misses: number;
    keys: number;
    memoryUsage: number;
  };
  l2: {
    hits: number;
    misses: number;
    keys: number;
    connections: number;
  };
  hitRatio: number;
  totalRequests: number;
}

export enum CacheLayer {
  L1_MEMORY = 'L1_MEMORY',
  L2_REDIS = 'L2_REDIS',
  L3_DATABASE = 'L3_DATABASE'
}

export class InErgizeCacheManager {
  private l1Cache: NodeCache;
  private redis: Redis;
  private stats: CacheStats;
  private config: CacheConfig;

  constructor(redis: Redis, config: Partial<CacheConfig> = {}) {
    this.redis = redis;
    this.config = this.mergeDefaultConfig(config);
    
    // Initialize L1 cache (in-memory)
    this.l1Cache = new NodeCache({
      stdTTL: this.config.l1.ttlSeconds,
      maxKeys: this.config.l1.maxKeys,
      checkperiod: this.config.l1.checkPeriod,
      useClones: false,
      deleteOnExpire: true
    });

    // Initialize stats
    this.stats = {
      l1: { hits: 0, misses: 0, keys: 0, memoryUsage: 0 },
      l2: { hits: 0, misses: 0, keys: 0, connections: 0 },
      hitRatio: 0,
      totalRequests: 0
    };

    this.setupEventListeners();
    this.startStatsCollection();
  }

  private mergeDefaultConfig(config: Partial<CacheConfig>): CacheConfig {
    return {
      l1: {
        enabled: true,
        ttlSeconds: 300, // 5 minutes
        maxKeys: 10000,
        checkPeriod: 120,
        ...config.l1
      },
      l2: {
        enabled: true,
        ttlSeconds: 3600, // 1 hour
        compression: true,
        keyPrefix: 'inergize:cache:',
        ...config.l2
      },
      l3: {
        enabled: true,
        ttlSeconds: 86400, // 24 hours
        ...config.l3
      }
    };
  }

  private setupEventListeners(): void {
    this.l1Cache.on('set', (key, value) => {
      logger.debug('L1 cache set', { key, size: JSON.stringify(value).length });
    });

    this.l1Cache.on('get', (key, value) => {
      this.stats.l1.hits++;
      logger.debug('L1 cache hit', { key });
    });

    this.l1Cache.on('expired', (key, value) => {
      logger.debug('L1 cache expired', { key });
    });

    this.l1Cache.on('del', (key, value) => {
      logger.debug('L1 cache deleted', { key });
    });
  }

  private startStatsCollection(): void {
    setInterval(() => {
      this.updateStats();
    }, 30000); // Update stats every 30 seconds
  }

  private updateStats(): void {
    this.stats.l1.keys = this.l1Cache.keys().length;
    this.stats.l1.memoryUsage = JSON.stringify(this.l1Cache.data).length;
    
    const totalHits = this.stats.l1.hits + this.stats.l2.hits;
    const totalMisses = this.stats.l1.misses + this.stats.l2.misses;
    this.stats.totalRequests = totalHits + totalMisses;
    this.stats.hitRatio = this.stats.totalRequests > 0 
      ? (totalHits / this.stats.totalRequests) * 100 
      : 0;
  }

  private generateKey(namespace: string, key: string): string {
    return `${this.config.l2.keyPrefix}${namespace}:${key}`;
  }

  private async compressData(data: any): Promise<Buffer> {
    const jsonString = JSON.stringify(data);
    return await gzip(jsonString);
  }

  private async decompressData(compressedData: Buffer): Promise<any> {
    const decompressed = await gunzip(compressedData);
    return JSON.parse(decompressed.toString());
  }

  /**
   * Get data from cache with automatic fallback through cache layers
   */
  public async get<T>(
    namespace: string,
    key: string,
    fallbackFn?: () => Promise<T>,
    options?: {
      skipL1?: boolean;
      skipL2?: boolean;
      ttl?: number;
      version?: string;
    }
  ): Promise<T | null> {
    const cacheKey = this.generateKey(namespace, key);
    const startTime = Date.now();

    try {
      // L1 Cache (Memory)
      if (this.config.l1.enabled && !options?.skipL1) {
        const l1Data = this.l1Cache.get<CacheEntry<T>>(cacheKey);
        if (l1Data) {
          l1Data.metadata.accessCount++;
          l1Data.metadata.lastAccessed = Date.now();
          
          logger.debug('Cache hit L1', { 
            namespace, 
            key, 
            responseTime: Date.now() - startTime 
          });
          
          return l1Data.data;
        }
        this.stats.l1.misses++;
      }

      // L2 Cache (Redis)
      if (this.config.l2.enabled && !options?.skipL2) {
        const l2DataRaw = await this.redis.get(cacheKey);
        if (l2DataRaw) {
          let l2Data: CacheEntry<T>;
          
          try {
            const parsed = JSON.parse(l2DataRaw);
            if (parsed.metadata?.compressed && this.config.l2.compression) {
              l2Data = {
                ...parsed,
                data: await this.decompressData(Buffer.from(parsed.data, 'base64'))
              };
            } else {
              l2Data = parsed;
            }

            // Validate version if specified
            if (options?.version && l2Data.metadata.version !== options.version) {
              await this.delete(namespace, key);
              this.stats.l2.misses++;
            } else {
              // Promote to L1
              if (this.config.l1.enabled) {
                this.l1Cache.set(cacheKey, l2Data, this.config.l1.ttlSeconds);
              }

              this.stats.l2.hits++;
              
              logger.debug('Cache hit L2', { 
                namespace, 
                key, 
                responseTime: Date.now() - startTime,
                promoted: this.config.l1.enabled
              });
              
              return l2Data.data;
            }
          } catch (error) {
            logger.error('Failed to parse L2 cache data', { 
              namespace, 
              key, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            await this.redis.del(cacheKey);
          }
        }
        this.stats.l2.misses++;
      }

      // Fallback to data source
      if (fallbackFn) {
        logger.debug('Cache miss, executing fallback', { 
          namespace, 
          key, 
          responseTime: Date.now() - startTime 
        });
        
        const data = await fallbackFn();
        if (data !== null && data !== undefined) {
          await this.set(namespace, key, data, options?.ttl, options?.version);
        }
        return data;
      }

      return null;
    } catch (error) {
      logger.error('Cache get error', { 
        namespace, 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      if (fallbackFn) {
        return await fallbackFn();
      }
      return null;
    }
  }

  /**
   * Set data in cache across multiple layers
   */
  public async set<T>(
    namespace: string,
    key: string,
    data: T,
    ttl?: number,
    version: string = '1.0'
  ): Promise<void> {
    const cacheKey = this.generateKey(namespace, key);
    const cacheEntry: CacheEntry<T> = {
      data,
      metadata: {
        createdAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        version
      }
    };

    try {
      // Set in L1 Cache
      if (this.config.l1.enabled) {
        this.l1Cache.set(
          cacheKey, 
          cacheEntry, 
          ttl || this.config.l1.ttlSeconds
        );
      }

      // Set in L2 Cache (Redis)
      if (this.config.l2.enabled) {
        let dataToStore = cacheEntry;
        
        if (this.config.l2.compression) {
          const compressedData = await this.compressData(data);
          dataToStore = {
            ...cacheEntry,
            data: compressedData.toString('base64') as any,
            metadata: {
              ...cacheEntry.metadata,
              compressed: true
            }
          };
        }

        await this.redis.setex(
          cacheKey,
          ttl || this.config.l2.ttlSeconds,
          JSON.stringify(dataToStore)
        );
      }

      logger.debug('Cache set', { namespace, key, version, ttl });
    } catch (error) {
      logger.error('Cache set error', { 
        namespace, 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Delete from all cache layers
   */
  public async delete(namespace: string, key: string): Promise<void> {
    const cacheKey = this.generateKey(namespace, key);

    try {
      // Delete from L1
      if (this.config.l1.enabled) {
        this.l1Cache.del(cacheKey);
      }

      // Delete from L2
      if (this.config.l2.enabled) {
        await this.redis.del(cacheKey);
      }

      logger.debug('Cache deleted', { namespace, key });
    } catch (error) {
      logger.error('Cache delete error', { 
        namespace, 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Clear cache by namespace pattern
   */
  public async clear(namespace: string): Promise<void> {
    const pattern = this.generateKey(namespace, '*');

    try {
      // Clear L1 - get all keys and filter
      const l1Keys = this.l1Cache.keys();
      const namespacePrefix = this.generateKey(namespace, '');
      l1Keys.forEach(key => {
        if (key.startsWith(namespacePrefix)) {
          this.l1Cache.del(key);
        }
      });

      // Clear L2 - use Redis SCAN for pattern matching
      if (this.config.l2.enabled) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      logger.info('Cache cleared', { namespace, keysCleared: l1Keys.length });
    } catch (error) {
      logger.error('Cache clear error', { 
        namespace, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get cache health status
   */
  public async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    l1: { status: string; details: any };
    l2: { status: string; details: any };
  }> {
    const l1Status = {
      status: this.config.l1.enabled ? 'healthy' : 'disabled',
      details: {
        keys: this.l1Cache.keys().length,
        memoryUsage: JSON.stringify(this.l1Cache.data).length
      }
    };

    let l2Status;
    try {
      const redisInfo = await this.redis.ping();
      l2Status = {
        status: this.config.l2.enabled && redisInfo === 'PONG' ? 'healthy' : 'unhealthy',
        details: {
          ping: redisInfo,
          connections: this.redis.status
        }
      };
    } catch (error) {
      l2Status = {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }

    const overallStatus = 
      l1Status.status === 'healthy' && l2Status.status === 'healthy' 
        ? 'healthy' 
        : l2Status.status === 'unhealthy' 
        ? 'degraded' 
        : 'unhealthy';

    return {
      status: overallStatus,
      l1: l1Status,
      l2: l2Status
    };
  }

  /**
   * Warm up cache with preloaded data
   */
  public async warmUp(
    namespace: string,
    dataLoader: () => Promise<Array<{key: string, data: any}>>
  ): Promise<number> {
    logger.info('Starting cache warm-up', { namespace });
    
    try {
      const items = await dataLoader();
      let warmedCount = 0;

      for (const item of items) {
        await this.set(namespace, item.key, item.data);
        warmedCount++;
      }

      logger.info('Cache warm-up completed', { namespace, itemsWarmed: warmedCount });
      return warmedCount;
    } catch (error) {
      logger.error('Cache warm-up failed', { 
        namespace, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return 0;
    }
  }

  /**
   * Cleanup expired entries and optimize memory
   */
  public async cleanup(): Promise<void> {
    try {
      // L1 cleanup is automatic via node-cache
      this.l1Cache.flushStats();

      logger.info('Cache cleanup completed');
    } catch (error) {
      logger.error('Cache cleanup error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Destroy cache manager and cleanup resources
   */
  public async destroy(): Promise<void> {
    try {
      this.l1Cache.flushAll();
      this.l1Cache.close();
      
      logger.info('Cache manager destroyed');
    } catch (error) {
      logger.error('Cache manager destroy error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

// Predefined cache configurations for different data types
export const CACHE_CONFIGS: Record<string, Partial<CacheConfig>> = {
  // User profiles - frequently accessed, slow to change
  USER_PROFILES: {
    l1: { ttlSeconds: 600, maxKeys: 5000 }, // 10 minutes
    l2: { ttlSeconds: 3600 }, // 1 hour
    l3: { ttlSeconds: 86400 } // 24 hours
  },

  // LinkedIn data - external API, expensive to fetch
  LINKEDIN_DATA: {
    l1: { ttlSeconds: 300, maxKeys: 2000 }, // 5 minutes
    l2: { ttlSeconds: 1800, compression: true }, // 30 minutes
    l3: { ttlSeconds: 7200 } // 2 hours
  },

  // Analytics data - computation intensive
  ANALYTICS: {
    l1: { ttlSeconds: 180, maxKeys: 3000 }, // 3 minutes
    l2: { ttlSeconds: 900, compression: true }, // 15 minutes
    l3: { ttlSeconds: 3600 } // 1 hour
  },

  // AI content - expensive to generate
  AI_CONTENT: {
    l1: { ttlSeconds: 1800, maxKeys: 1000 }, // 30 minutes
    l2: { ttlSeconds: 7200, compression: true }, // 2 hours
    l3: { ttlSeconds: 86400 } // 24 hours
  },

  // Session data - critical for auth
  SESSIONS: {
    l1: { ttlSeconds: 900, maxKeys: 10000 }, // 15 minutes
    l2: { ttlSeconds: 3600 }, // 1 hour
    l3: { enabled: false }
  }
};

export default InErgizeCacheManager;