import Redis from 'ioredis';
import { logger } from './logger';

class RedisManager {
  private client: Redis | null = null;
  private config: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };

  constructor() {
    const password = process.env.REDIS_PASSWORD;
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ...(password && { password }),
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'analytics:',
    };
  }

  public async connect(): Promise<void> {
    try {
      this.client = new Redis({
        ...this.config,
        lazyConnect: true
      });

      // Event listeners
      this.client.on('connect', () => {
        logger.info('Connected to Redis successfully', {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db
        });
      });

      this.client.on('error', (error) => {
        logger.error('Redis connection error', { 
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : error
        });
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
      });

      // Test connection
      await this.client.connect();
      await this.client.ping();
      
    } catch (error) {
      logger.error('Failed to connect to Redis', { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        config: {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db
        }
      });
      throw error;
    }
  }

  public getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  public async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  }

  public async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return client.get(key);
  }

  public async del(key: string): Promise<number> {
    const client = this.getClient();
    return client.del(key);
  }

  public async exists(key: string): Promise<number> {
    const client = this.getClient();
    return client.exists(key);
  }

  public async incr(key: string): Promise<number> {
    const client = this.getClient();
    return client.incr(key);
  }

  public async expire(key: string, ttlSeconds: number): Promise<number> {
    const client = this.getClient();
    return client.expire(key, ttlSeconds);
  }

  public async hset(key: string, field: string, value: string | number): Promise<number> {
    const client = this.getClient();
    return client.hset(key, field, value);
  }

  public async hget(key: string, field: string): Promise<string | null> {
    const client = this.getClient();
    return client.hget(key, field);
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    const client = this.getClient();
    return client.hgetall(key);
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }

  public isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }
}

export const redis = new RedisManager();
export default redis;