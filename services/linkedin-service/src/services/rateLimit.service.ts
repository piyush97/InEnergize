// LinkedIn Rate Limiting Service - Conservative compliance with LinkedIn API limits

import Redis from 'ioredis';
import { RateLimitInfo, RateLimitError } from '../types/linkedin';

interface RateLimitConfig {
  endpoints: {
    [endpoint: string]: {
      requestsPerHour: number;
      requestsPerDay: number;
      burstLimit: number;
      conservativeFactor: number; // Use 50% of LinkedIn's actual limits
    };
  };
  global: {
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
    retryAttempts: number;
    backoffMultiplier: number;
  };
}

export class LinkedInRateLimitService {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Conservative rate limits (50% of LinkedIn's published limits)
    this.config = {
      endpoints: {
        '/v2/me': {
          requestsPerHour: 50, // LinkedIn allows ~100
          requestsPerDay: 500, // LinkedIn allows ~1000
          burstLimit: 5,
          conservativeFactor: 0.5
        },
        '/v2/people': {
          requestsPerHour: 50,
          requestsPerDay: 500,
          burstLimit: 5,
          conservativeFactor: 0.5
        },
        '/v2/shares': {
          requestsPerHour: 25, // More conservative for posting
          requestsPerDay: 100,
          burstLimit: 2,
          conservativeFactor: 0.3
        },
        '/v2/people-search': {
          requestsPerHour: 15, // Very conservative for search
          requestsPerDay: 50,
          burstLimit: 1,
          conservativeFactor: 0.2
        },
        '/v2/networkUpdates': {
          requestsPerHour: 30,
          requestsPerDay: 200,
          burstLimit: 3,
          conservativeFactor: 0.4
        },
        '/v2/connections': {
          requestsPerHour: 20, // Conservative for connections
          requestsPerDay: 100,
          burstLimit: 2,
          conservativeFactor: 0.3
        }
      },
      global: {
        maxRequestsPerHour: 200, // Global limit across all endpoints
        maxRequestsPerDay: 1000,
        retryAttempts: 3,
        backoffMultiplier: 2
      }
    };
  }

  /**
   * Check if request is allowed under rate limits
   */
  async checkRateLimit(
    userId: string,
    endpoint: string,
    operation: string = 'GET'
  ): Promise<RateLimitInfo> {
    const endpointConfig = this.getEndpointConfig(endpoint);
    const now = new Date();
    
    // Keys for tracking usage
    const hourlyKey = `linkedin_rate_limit:${userId}:${endpoint}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const dailyKey = `linkedin_rate_limit:${userId}:${endpoint}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const globalHourlyKey = `linkedin_rate_limit:${userId}:global:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const globalDailyKey = `linkedin_rate_limit:${userId}:global:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const burstKey = `linkedin_rate_limit:${userId}:${endpoint}:burst`;

    // Get current usage
    const [hourlyUsage, dailyUsage, globalHourlyUsage, globalDailyUsage, burstUsage] = await Promise.all([
      this.redis.get(hourlyKey).then(val => parseInt(val || '0')),
      this.redis.get(dailyKey).then(val => parseInt(val || '0')),
      this.redis.get(globalHourlyKey).then(val => parseInt(val || '0')),
      this.redis.get(globalDailyKey).then(val => parseInt(val || '0')),
      this.redis.get(burstKey).then(val => parseInt(val || '0'))
    ]);

    // Check against limits
    const hourlyRemaining = Math.max(0, endpointConfig.requestsPerHour - hourlyUsage);
    const dailyRemaining = Math.max(0, endpointConfig.requestsPerDay - dailyUsage);
    const globalHourlyRemaining = Math.max(0, this.config.global.maxRequestsPerHour - globalHourlyUsage);
    const globalDailyRemaining = Math.max(0, this.config.global.maxRequestsPerDay - globalDailyUsage);
    const burstRemaining = Math.max(0, endpointConfig.burstLimit - burstUsage);

    const remaining = Math.min(hourlyRemaining, dailyRemaining, globalHourlyRemaining, globalDailyRemaining, burstRemaining);
    
    // Calculate reset times
    const hourlyResetTime = new Date(now.getTime() + (60 - now.getMinutes()) * 60 * 1000);
    const dailyResetTime = new Date(now.getTime() + (24 * 60 * 60 * 1000 - (now.getHours() * 60 + now.getMinutes()) * 60 * 1000));

    return {
      endpoint,
      limit: endpointConfig.requestsPerHour,
      remaining,
      resetTime: hourlyResetTime,
      retryAfter: remaining <= 0 ? Math.ceil((hourlyResetTime.getTime() - now.getTime()) / 1000) : undefined
    };
  }

  /**
   * Record API request usage
   */
  async recordRequest(
    userId: string,
    endpoint: string,
    success: boolean = true
  ): Promise<void> {
    const now = new Date();
    
    // Keys for tracking usage
    const hourlyKey = `linkedin_rate_limit:${userId}:${endpoint}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const dailyKey = `linkedin_rate_limit:${userId}:${endpoint}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const globalHourlyKey = `linkedin_rate_limit:${userId}:global:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const globalDailyKey = `linkedin_rate_limit:${userId}:global:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const burstKey = `linkedin_rate_limit:${userId}:${endpoint}:burst`;

    // Increment counters
    const pipeline = this.redis.pipeline();
    
    pipeline.incr(hourlyKey);
    pipeline.expire(hourlyKey, 3600); // 1 hour
    
    pipeline.incr(dailyKey);
    pipeline.expire(dailyKey, 86400); // 24 hours
    
    pipeline.incr(globalHourlyKey);
    pipeline.expire(globalHourlyKey, 3600);
    
    pipeline.incr(globalDailyKey);
    pipeline.expire(globalDailyKey, 86400);
    
    pipeline.incr(burstKey);
    pipeline.expire(burstKey, 60); // 1 minute burst window
    
    await pipeline.exec();

    // Record for analytics
    await this.recordAnalytics(userId, endpoint, success);
  }

  /**
   * Wait with exponential backoff if rate limited
   */
  async waitIfRateLimited(rateLimitInfo: RateLimitInfo): Promise<void> {
    if (rateLimitInfo.remaining <= 0 && rateLimitInfo.retryAfter) {
      const waitTime = Math.min(rateLimitInfo.retryAfter * 1000, 60000); // Max 1 minute wait
      
      console.log(`Rate limited on ${rateLimitInfo.endpoint}. Waiting ${waitTime}ms`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Execute request with rate limiting and retry logic
   */
  async executeWithRateLimit<T>(
    userId: string,
    endpoint: string,
    operation: () => Promise<T>,
    retryAttempts: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        // Check rate limits
        const rateLimitInfo = await this.checkRateLimit(userId, endpoint);
        
        if (rateLimitInfo.remaining <= 0) {
          if (rateLimitInfo.retryAfter) {
            if (attempt === retryAttempts) {
              throw new RateLimitError(
                `Rate limit exceeded for ${endpoint}`,
                rateLimitInfo.retryAfter,
                endpoint
              );
            }
            
            // Wait and retry
            await this.waitIfRateLimited(rateLimitInfo);
            continue;
          } else {
            throw new RateLimitError(
              `Daily rate limit exceeded for ${endpoint}`,
              86400, // 24 hours
              endpoint
            );
          }
        }

        // Execute the operation
        const result = await operation();
        
        // Record successful request
        await this.recordRequest(userId, endpoint, true);
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Record failed request
        await this.recordRequest(userId, endpoint, false);
        
        // If it's a rate limit error, wait and retry
        if (error instanceof RateLimitError) {
          if (attempt < retryAttempts) {
            const backoffTime = Math.pow(this.config.global.backoffMultiplier, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
        }
        
        // For other errors, don't retry
        throw error;
      }
    }

    throw lastError || new Error('Max retry attempts exceeded');
  }

  /**
   * Get current usage statistics for a user
   */
  async getUsageStatistics(userId: string): Promise<{
    endpoints: Array<{
      endpoint: string;
      hourlyUsage: number;
      dailyUsage: number;
      hourlyLimit: number;
      dailyLimit: number;
      remainingHourly: number;
      remainingDaily: number;
    }>;
    global: {
      hourlyUsage: number;
      dailyUsage: number;
      hourlyLimit: number;
      dailyLimit: number;
    };
  }> {
    const now = new Date();
    const endpoints = Object.keys(this.config.endpoints);
    
    const endpointStats = await Promise.all(
      endpoints.map(async (endpoint) => {
        const hourlyKey = `linkedin_rate_limit:${userId}:${endpoint}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
        const dailyKey = `linkedin_rate_limit:${userId}:${endpoint}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
        
        const [hourlyUsage, dailyUsage] = await Promise.all([
          this.redis.get(hourlyKey).then(val => parseInt(val || '0')),
          this.redis.get(dailyKey).then(val => parseInt(val || '0'))
        ]);
        
        const config = this.config.endpoints[endpoint];
        
        return {
          endpoint,
          hourlyUsage,
          dailyUsage,
          hourlyLimit: config.requestsPerHour,
          dailyLimit: config.requestsPerDay,
          remainingHourly: Math.max(0, config.requestsPerHour - hourlyUsage),
          remainingDaily: Math.max(0, config.requestsPerDay - dailyUsage)
        };
      })
    );

    // Global stats
    const globalHourlyKey = `linkedin_rate_limit:${userId}:global:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const globalDailyKey = `linkedin_rate_limit:${userId}:global:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    
    const [globalHourlyUsage, globalDailyUsage] = await Promise.all([
      this.redis.get(globalHourlyKey).then(val => parseInt(val || '0')),
      this.redis.get(globalDailyKey).then(val => parseInt(val || '0'))
    ]);

    return {
      endpoints: endpointStats,
      global: {
        hourlyUsage: globalHourlyUsage,
        dailyUsage: globalDailyUsage,
        hourlyLimit: this.config.global.maxRequestsPerHour,
        dailyLimit: this.config.global.maxRequestsPerDay
      }
    };
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  async resetUserRateLimits(userId: string): Promise<void> {
    const pattern = `linkedin_rate_limit:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Get endpoint configuration
   */
  private getEndpointConfig(endpoint: string) {
    // Match endpoint to configuration (handle parameterized endpoints)
    for (const [configEndpoint, config] of Object.entries(this.config.endpoints)) {
      if (endpoint.includes(configEndpoint) || endpoint.match(new RegExp(configEndpoint.replace(/\//g, '\\/').replace(/\{[^}]+\}/g, '[^/]+')))) {
        return config;
      }
    }
    
    // Default configuration for unknown endpoints (very conservative)
    return {
      requestsPerHour: 10,
      requestsPerDay: 50,
      burstLimit: 1,
      conservativeFactor: 0.1
    };
  }

  /**
   * Record analytics for monitoring
   */
  private async recordAnalytics(userId: string, endpoint: string, success: boolean): Promise<void> {
    const analyticsKey = `linkedin_analytics:${userId}:${new Date().toISOString().split('T')[0]}`;
    
    const analytics = {
      endpoint,
      success,
      timestamp: new Date().toISOString()
    };
    
    await this.redis.lpush(analyticsKey, JSON.stringify(analytics));
    await this.redis.expire(analyticsKey, 30 * 24 * 60 * 60); // Keep for 30 days
    await this.redis.ltrim(analyticsKey, 0, 999); // Keep last 1000 entries
  }

  /**
   * Get rate limiting health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      redisConnected: boolean;
      totalActiveUsers: number;
      averageUsageRate: number;
    };
  }> {
    try {
      // Test Redis connection
      await this.redis.ping();
      
      // Get some basic stats
      const pattern = 'linkedin_rate_limit:*:global:*';
      const keys = await this.redis.keys(pattern);
      
      const totalUsers = new Set(
        keys.map(key => key.split(':')[1])
      ).size;

      return {
        status: 'healthy',
        details: {
          redisConnected: true,
          totalActiveUsers: totalUsers,
          averageUsageRate: 0 // Would calculate based on recent usage
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          redisConnected: false,
          totalActiveUsers: 0,
          averageUsageRate: 0
        }
      };
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}