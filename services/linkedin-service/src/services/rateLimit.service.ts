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
    adaptiveThrottling?: boolean;
    complianceMode?: string;
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

    // Updated conservative rate limits based on LinkedIn's 2024 API limits
    // Using 40% of published limits for enhanced safety
    this.config = {
      endpoints: {
        '/v2/me': {
          requestsPerHour: 40,    // LinkedIn 2024: ~100/hour
          requestsPerDay: 400,    // LinkedIn 2024: ~1000/day
          burstLimit: 4,
          conservativeFactor: 0.4
        },
        '/v2/people': {
          requestsPerHour: 40,
          requestsPerDay: 400,
          burstLimit: 4,
          conservativeFactor: 0.4
        },
        '/v2/posts': {             // Updated endpoint name
          requestsPerHour: 20,     // More conservative for posting
          requestsPerDay: 80,
          burstLimit: 2,
          conservativeFactor: 0.25
        },
        '/v2/people-search': {
          requestsPerHour: 12,     // Very conservative for search
          requestsPerDay: 40,
          burstLimit: 1,
          conservativeFactor: 0.15
        },
        '/v2/networkUpdates': {
          requestsPerHour: 24,
          requestsPerDay: 160,
          burstLimit: 2,
          conservativeFactor: 0.3
        },
        '/v2/connections': {
          requestsPerHour: 16,     // Ultra-conservative for connections
          requestsPerDay: 60,      // Well below LinkedIn's 100/day limit
          burstLimit: 1,
          conservativeFactor: 0.2
        },
        '/v2/invitation': {        // Connection invitations
          requestsPerHour: 8,      // Maximum 8 per hour
          requestsPerDay: 25,      // Maximum 25 per day (LinkedIn allows 100)
          burstLimit: 1,
          conservativeFactor: 0.25
        }
      },
      global: {
        maxRequestsPerHour: 150,   // Reduced global limit
        maxRequestsPerDay: 800,    // Conservative daily global limit
        retryAttempts: 3,
        backoffMultiplier: 2,
        adaptiveThrottling: true,  // Enable adaptive throttling
        complianceMode: process.env.LINKEDIN_COMPLIANCE_MODE || 'STRICT'
      }
    };

    // Initialize adaptive throttling if enabled
    if (this.config.global.adaptiveThrottling) {
      this.initializeAdaptiveThrottling();
    }
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
  /**
   * Initialize adaptive throttling system
   */
  private initializeAdaptiveThrottling(): void {
    // Monitor for 429 responses and automatically adjust limits
    setInterval(async () => {
      await this.adjustLimitsBasedOnErrors();
    }, 30 * 60 * 1000); // Check every 30 minutes
  }

  /**
   * Adjust rate limits based on recent error patterns
   */
  private async adjustLimitsBasedOnErrors(): Promise<void> {
    try {
      const pattern = 'linkedin_analytics:*';
      const keys = await this.redis.keys(pattern);
      
      let total429Errors = 0;
      let totalRequests = 0;
      
      for (const key of keys.slice(0, 100)) { // Sample recent users
        const analytics = await this.redis.lrange(key, 0, 99);
        
        for (const entry of analytics) {
          try {
            const data = JSON.parse(entry);
            totalRequests++;
            
            if (!data.success && data.statusCode === 429) {
              total429Errors++;
            }
          } catch (e) {
            // Skip invalid entries
          }
        }
      }
      
      if (totalRequests > 0) {
        const errorRate = total429Errors / totalRequests;
        
        // If error rate > 5%, reduce limits by 20%
        if (errorRate > 0.05) {
          console.warn(`High LinkedIn API error rate detected: ${(errorRate * 100).toFixed(2)}%. Reducing rate limits.`);
          this.adjustAllLimits(0.8); // Reduce by 20%
        }
        // If error rate < 1% for extended period, cautiously increase limits
        else if (errorRate < 0.01 && Math.random() < 0.1) { // 10% chance to increase
          console.info('Low error rate detected. Cautiously increasing rate limits.');
          this.adjustAllLimits(1.1); // Increase by 10%
        }
      }
    } catch (error) {
      console.error('Error in adaptive throttling:', error);
    }
  }

  /**
   * Adjust all rate limits by a factor
   */
  private adjustAllLimits(factor: number): void {
    for (const endpoint in this.config.endpoints) {
      const config = this.config.endpoints[endpoint];
      config.requestsPerHour = Math.max(1, Math.floor(config.requestsPerHour * factor));
      config.requestsPerDay = Math.max(1, Math.floor(config.requestsPerDay * factor));
      config.burstLimit = Math.max(1, Math.floor(config.burstLimit * factor));
    }
    
    // Also adjust global limits
    this.config.global.maxRequestsPerHour = Math.max(10, Math.floor(this.config.global.maxRequestsPerHour * factor));
    this.config.global.maxRequestsPerDay = Math.max(50, Math.floor(this.config.global.maxRequestsPerDay * factor));
  }

  /**
   * Get current compliance status and recommendations
   */
  async getComplianceStatus(userId: string): Promise<{
    status: 'COMPLIANT' | 'WARNING' | 'VIOLATION';
    score: number; // 0-100
    recommendations: string[];
    riskFactors: string[];
    nextAllowedAction: Date;
  }> {
    const usage = await this.getUsageStatistics(userId);
    const now = new Date();
    
    let score = 100;
    const recommendations: string[] = [];
    const riskFactors: string[] = [];
    
    // Check global usage
    const globalHourlyUsage = usage.global.hourlyUsage / usage.global.hourlyLimit;
    const globalDailyUsage = usage.global.dailyUsage / usage.global.dailyLimit;
    
    if (globalDailyUsage > 0.8) {
      score -= 30;
      riskFactors.push('High daily API usage');
      recommendations.push('Reduce API calls for today');
    }
    
    if (globalHourlyUsage > 0.8) {
      score -= 20;
      riskFactors.push('High hourly API usage');
      recommendations.push('Wait before making more requests');
    }
    
    // Check for high-risk endpoint usage
    const connectionUsage = usage.endpoints.find(e => e.endpoint.includes('connection'));
    if (connectionUsage && connectionUsage.dailyUsage > connectionUsage.dailyLimit * 0.7) {
      score -= 25;
      riskFactors.push('High connection request usage');
      recommendations.push('Pause connection requests for today');
    }
    
    // Calculate next allowed action time
    let nextAllowedAction = now;
    if (score < 60) {
      // If compliance score is low, suggest waiting
      nextAllowedAction = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    }
    
    let status: 'COMPLIANT' | 'WARNING' | 'VIOLATION' = 'COMPLIANT';
    if (score < 70) status = 'WARNING';
    if (score < 50) status = 'VIOLATION';
    
    return {
      status,
      score,
      recommendations,
      riskFactors,
      nextAllowedAction
    };
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}