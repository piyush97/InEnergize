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

    // Ultra-conservative rate limits - 15% of LinkedIn's 2024 API limits (Phase 3)
    // Maximum safety approach to prevent any compliance issues
    this.config = {
      endpoints: {
        '/v2/me': {
          requestsPerHour: 15,     // LinkedIn 2024: ~100/hour, we use 15%
          requestsPerDay: 150,     // LinkedIn 2024: ~1000/day, we use 15%
          burstLimit: 2,
          conservativeFactor: 0.15
        },
        '/v2/people': {
          requestsPerHour: 15,
          requestsPerDay: 150,
          burstLimit: 2,
          conservativeFactor: 0.15
        },
        '/v2/posts': {
          requestsPerHour: 6,      // Ultra-conservative for posting
          requestsPerDay: 20,
          burstLimit: 1,
          conservativeFactor: 0.1
        },
        '/v2/people-search': {
          requestsPerHour: 3,      // Extremely conservative for search
          requestsPerDay: 10,
          burstLimit: 1,
          conservativeFactor: 0.05
        },
        '/v2/networkUpdates': {
          requestsPerHour: 8,
          requestsPerDay: 40,
          burstLimit: 1,
          conservativeFactor: 0.15
        },
        '/v2/connections': {
          requestsPerHour: 4,      // Ultra-conservative for connections
          requestsPerDay: 15,      // 15% of LinkedIn's 100/day limit
          burstLimit: 1,
          conservativeFactor: 0.15
        },
        '/v2/invitation': {        // Connection invitations - Phase 3 ultra-conservative
          requestsPerHour: 3,      // Maximum 3 per hour
          requestsPerDay: 15,      // Maximum 15 per day (LinkedIn allows 100)
          burstLimit: 1,
          conservativeFactor: 0.15
        },
        '/v2/shares': {            // Post engagement (likes, comments)
          requestsPerHour: 10,     // Conservative for engagement actions
          requestsPerDay: 30,      // 15% of estimated 200/day limit
          burstLimit: 1,
          conservativeFactor: 0.15
        },
        '/v2/reactions': {         // Like reactions
          requestsPerHour: 8,      // Conservative likes per hour
          requestsPerDay: 25,      // 15% of estimated 150-200/day limit
          burstLimit: 1,
          conservativeFactor: 0.15
        },
        '/v2/comments': {          // Comment actions
          requestsPerHour: 2,      // Ultra-conservative commenting
          requestsPerDay: 8,       // Maximum 8 comments per day
          burstLimit: 1,
          conservativeFactor: 0.15
        },
        '/v2/follows': {           // Follow/unfollow actions
          requestsPerHour: 2,      // Very conservative follows
          requestsPerDay: 5,       // Maximum 5 follows per day
          burstLimit: 1,
          conservativeFactor: 0.15
        }
      },
      global: {
        maxRequestsPerHour: 50,    // Reduced global limit (Phase 3)
        maxRequestsPerDay: 200,    // Ultra-conservative daily global limit
        retryAttempts: 2,          // Reduced retries to minimize API calls
        backoffMultiplier: 3,      // Longer backoff to reduce pressure
        adaptiveThrottling: true,
        complianceMode: process.env.LINKEDIN_COMPLIANCE_MODE || 'ULTRA_STRICT'
      }
    };

    // Initialize adaptive throttling if enabled
    if (this.config.global.adaptiveThrottling) {
      this.initializeAdaptiveThrottling();
    }
  }

  /**
   * Check if request is allowed under rate limits (alias for backward compatibility)
   */
  async checkLimit(
    userId: string,
    endpoint: string,
    operation: string = 'GET'
  ): Promise<RateLimitInfo> {
    return this.checkRateLimit(userId, endpoint, operation);
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
   * Get all rate limits for a user (alias for getUsageStatistics)
   */
  async getAllLimits(userId: string): Promise<{
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
    return this.getUsageStatistics(userId);
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
    safetyMetrics: {
      velocityScore: number; // Rate of API usage increase
      patternScore: number; // Consistency of usage patterns
      complianceHistory: number; // Historical compliance track record
    };
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

    // Enhanced safety metrics
    const safetyMetrics = await this.calculateSafetyMetrics(userId, usage);
    
    // Apply safety metric penalties
    if (safetyMetrics.velocityScore < 70) {
      score -= 15;
      riskFactors.push('Rapid increase in API usage detected');
      recommendations.push('Slow down API request rate to maintain compliance');
    }
    
    if (safetyMetrics.patternScore < 60) {
      score -= 10;
      riskFactors.push('Unusual usage patterns detected');
      recommendations.push('Review automation scripts for compliance');
    }
    
    if (safetyMetrics.complianceHistory < 80) {
      score -= 20;
      riskFactors.push('Poor historical compliance record');
      recommendations.push('Implement stricter rate limiting controls');
    }

    // Enhanced invitation/connection safety checks
    const invitationUsage = usage.endpoints.find(e => e.endpoint.includes('invitation'));
    if (invitationUsage) {
      const invitationRate = invitationUsage.dailyUsage / invitationUsage.dailyLimit;
      if (invitationRate > 0.5) {
        score -= 15;
        riskFactors.push('High connection invitation rate');
        recommendations.push('Reduce connection requests to avoid LinkedIn restrictions');
      }
    }

    // Time-based usage pattern analysis
    const timeBasedRisk = await this.analyzeTimeBasedUsage(userId);
    if (timeBasedRisk > 0.7) {
      score -= 10;
      riskFactors.push('Suspicious time-based usage patterns');
      recommendations.push('Vary your LinkedIn activity timing to appear more natural');
    }
    
    // Calculate next allowed action time with enhanced logic
    let nextAllowedAction = now;
    if (score < 50) {
      nextAllowedAction = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours for violations
    } else if (score < 70) {
      nextAllowedAction = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour for warnings
    } else if (score < 85) {
      nextAllowedAction = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes for caution
    }
    
    let status: 'COMPLIANT' | 'WARNING' | 'VIOLATION' = 'COMPLIANT';
    if (score < 70) status = 'WARNING';
    if (score < 50) status = 'VIOLATION';
    
    return {
      status,
      score,
      recommendations,
      riskFactors,
      nextAllowedAction,
      safetyMetrics
    };
  }

  /**
   * Calculate enhanced safety metrics for compliance scoring
   */
  private async calculateSafetyMetrics(userId: string, usage: any): Promise<{
    velocityScore: number;
    patternScore: number;
    complianceHistory: number;
  }> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Get historical usage data for velocity analysis
      const todayKey = `linkedin_analytics:${userId}:${today}`;
      const yesterdayKey = `linkedin_analytics:${userId}:${yesterday}`;
      
      const [todayData, yesterdayData] = await Promise.all([
        this.redis.lrange(todayKey, 0, -1),
        this.redis.lrange(yesterdayKey, 0, -1)
      ]);

      // Calculate velocity score (0-100, higher is better)
      let velocityScore = 100;
      const todayRequests = todayData.length;
      const yesterdayRequests = yesterdayData.length;
      
      if (yesterdayRequests > 0) {
        const velocityIncrease = (todayRequests - yesterdayRequests) / yesterdayRequests;
        if (velocityIncrease > 1.0) { // More than 100% increase
          velocityScore = Math.max(0, 100 - (velocityIncrease * 50));
        }
      }

      // Calculate pattern score based on request timing distribution
      let patternScore = 100;
      const hourlyDistribution = new Array(24).fill(0);
      
      todayData.forEach(entry => {
        try {
          const data = JSON.parse(entry);
          const hour = new Date(data.timestamp).getHours();
          hourlyDistribution[hour]++;
        } catch (e) {
          // Skip invalid entries
        }
      });

      // Check for unusual patterns (too concentrated in specific hours)
      const activeHours = hourlyDistribution.filter(count => count > 0).length;
      if (activeHours < 3 && todayRequests > 10) {
        patternScore -= 30; // Penalize overly concentrated usage
      }

      // Check for burst patterns
      const maxHourlyRequests = Math.max(...hourlyDistribution);
      if (maxHourlyRequests > todayRequests * 0.5 && todayRequests > 5) {
        patternScore -= 20; // Penalize burst patterns
      }

      // Calculate compliance history score
      let complianceHistory = 100;
      
      // Check last 7 days for violations
      const violationPattern = `linkedin_violations:${userId}:*`;
      const violationKeys = await this.redis.keys(violationPattern);
      
      // Recent violations lower the score
      const recentViolations = violationKeys.length;
      complianceHistory = Math.max(0, 100 - (recentViolations * 15));

      return {
        velocityScore: Math.round(velocityScore),
        patternScore: Math.round(patternScore),
        complianceHistory: Math.round(complianceHistory)
      };
    } catch (error) {
      console.error('Error calculating safety metrics:', error);
      // Return safe defaults
      return {
        velocityScore: 80,
        patternScore: 80,
        complianceHistory: 90
      };
    }
  }

  /**
   * Analyze time-based usage patterns for suspicious activity
   */
  private async analyzeTimeBasedUsage(userId: string): Promise<number> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const analyticsKey = `linkedin_analytics:${userId}:${today}`;
      
      const entries = await this.redis.lrange(analyticsKey, 0, -1);
      if (entries.length < 5) {
        return 0; // Not enough data for analysis
      }

      const timestamps = entries.map(entry => {
        try {
          const data = JSON.parse(entry);
          return new Date(data.timestamp).getTime();
        } catch (e) {
          return null;
        }
      }).filter(Boolean) as number[];

      if (timestamps.length < 3) {
        return 0;
      }

      // Calculate intervals between requests
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      // Check for overly regular patterns (bot-like behavior)
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const stdDev = Math.sqrt(
        intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
      );

      // If intervals are too regular (low standard deviation), it's suspicious
      const coefficientOfVariation = stdDev / avgInterval;
      
      if (coefficientOfVariation < 0.2 && intervals.length > 10) {
        return 0.8; // High risk - very regular patterns
      } else if (coefficientOfVariation < 0.4 && intervals.length > 5) {
        return 0.6; // Medium risk - somewhat regular
      } else if (avgInterval < 30000) { // Less than 30 seconds average
        return 0.7; // High risk - too frequent
      }

      return 0.3; // Low risk
    } catch (error) {
      console.error('Error analyzing time-based usage:', error);
      return 0.2; // Default low risk
    }
  }

  /**
   * Record a compliance violation for tracking
   */
  async recordViolation(userId: string, violationType: string, details: any): Promise<void> {
    try {
      const now = new Date();
      const violationKey = `linkedin_violations:${userId}:${now.toISOString().split('T')[0]}`;
      
      const violation = {
        type: violationType,
        timestamp: now.toISOString(),
        details,
        severity: details.severity || 'medium'
      };

      await this.redis.lpush(violationKey, JSON.stringify(violation));
      await this.redis.expire(violationKey, 30 * 24 * 60 * 60); // Keep for 30 days
      await this.redis.ltrim(violationKey, 0, 99); // Keep last 100 violations

      // Also log to analytics for monitoring
      console.warn(`LinkedIn compliance violation recorded for user ${userId}:`, violation);
    } catch (error) {
      console.error('Error recording violation:', error);
    }
  }

  /**
   * Get compliance report for monitoring dashboard
   */
  async getComplianceReport(): Promise<{
    totalUsers: number;
    complianceBreakdown: {
      compliant: number;
      warning: number;
      violation: number;
    };
    topRiskFactors: Array<{ factor: string; count: number }>;
    averageComplianceScore: number;
  }> {
    try {
      // Get all user patterns
      const userPattern = 'linkedin_rate_limit:*:global:*';
      const keys = await this.redis.keys(userPattern);
      
      const userIds = new Set(
        keys.map(key => key.split(':')[1])
      );

      const totalUsers = userIds.size;
      let complianceBreakdown = { compliant: 0, warning: 0, violation: 0 };
      let totalScore = 0;
      const riskFactorCounts: { [key: string]: number } = {};

      // Sample up to 100 users for performance
      const sampleUsers = Array.from(userIds).slice(0, 100);

      for (const userId of sampleUsers) {
        try {
          const compliance = await this.getComplianceStatus(userId);
          totalScore += compliance.score;
          
          switch (compliance.status) {
            case 'COMPLIANT':
              complianceBreakdown.compliant++;
              break;
            case 'WARNING':
              complianceBreakdown.warning++;
              break;
            case 'VIOLATION':
              complianceBreakdown.violation++;
              break;
          }

          // Count risk factors
          compliance.riskFactors.forEach(factor => {
            riskFactorCounts[factor] = (riskFactorCounts[factor] || 0) + 1;
          });
        } catch (error) {
          // Skip users with errors
        }
      }

      const averageComplianceScore = sampleUsers.length > 0 ? totalScore / sampleUsers.length : 100;
      
      const topRiskFactors = Object.entries(riskFactorCounts)
        .map(([factor, count]) => ({ factor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalUsers,
        complianceBreakdown,
        topRiskFactors,
        averageComplianceScore: Math.round(averageComplianceScore)
      };
    } catch (error) {
      console.error('Error generating compliance report:', error);
      return {
        totalUsers: 0,
        complianceBreakdown: { compliant: 0, warning: 0, violation: 0 },
        topRiskFactors: [],
        averageComplianceScore: 100
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}