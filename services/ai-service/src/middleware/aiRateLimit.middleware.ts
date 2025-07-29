import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { AuthenticatedRequest } from './auth.middleware';
import { RateLimitError } from '../types';

export interface AIRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxTokensPerRequest: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class AIRateLimitService {
  private redis: Redis;
  private config: Record<string, AIRateLimitConfig>;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    // AI-specific rate limits by subscription level
    this.config = {
      FREE: {
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        maxRequests: 5,
        maxTokensPerRequest: 1000
      },
      BASIC: {
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        maxRequests: 25,
        maxTokensPerRequest: 2000
      },
      PRO: {
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        maxRequests: 100,
        maxTokensPerRequest: 4000
      },
      ENTERPRISE: {
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        maxRequests: 500,
        maxTokensPerRequest: 8000
      }
    };
  }

  /**
   * Create rate limiting middleware for AI requests
   */
  createAIRateLimit(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({
            success: false,
            error: {
              message: 'Authentication required for AI operations',
              code: 'AUTHENTICATION_REQUIRED'
            }
          });
          return;
        }

        const userId = req.user.id;
        const subscriptionLevel = req.user.subscriptionLevel;
        const config = this.config[subscriptionLevel];

        if (!config) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Invalid subscription level',
              code: 'INVALID_SUBSCRIPTION_LEVEL'
            }
          });
          return;
        }

        // Check rate limits
        const rateLimitResult = await this.checkRateLimit(userId, config);
        
        if (!rateLimitResult.allowed) {
          res.status(429).json({
            success: false,
            error: {
              message: 'AI request rate limit exceeded',
              code: 'AI_RATE_LIMIT_EXCEEDED',
              details: {
                limit: config.maxRequests,
                windowMs: config.windowMs,
                remaining: rateLimitResult.remaining,
                resetTime: rateLimitResult.resetTime
              }
            }
          });
          return;
        }

        // Add rate limit info to request
        (req as any).aiRateLimit = {
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime,
          limit: config.maxRequests,
          maxTokensPerRequest: config.maxTokensPerRequest
        };

        // Set headers for client
        res.set({
          'X-AI-RateLimit-Limit': config.maxRequests.toString(),
          'X-AI-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-AI-RateLimit-Reset': rateLimitResult.resetTime.toISOString(),
          'X-AI-Token-Limit': config.maxTokensPerRequest.toString()
        });

        next();
      } catch (error) {
        console.error('AI rate limit middleware error:', error);
        res.status(500).json({
          success: false,
          error: {
            message: 'Rate limit validation failed',
            code: 'RATE_LIMIT_ERROR'
          }
        });
      }
    };
  }

  /**
   * Increment rate limit counter after successful request
   */
  async incrementUsage(userId: string, tokensUsed: number = 0): Promise<void> {
    try {
      const key = `ai_rate_limit:${userId}`;
      const now = Date.now();
      const windowStart = now - (24 * 60 * 60 * 1000); // 24 hours ago

      // Increment request count
      await this.redis.zadd(key, now, `request:${now}:${tokensUsed}`);
      
      // Remove old entries outside the window
      await this.redis.zremrangebyscore(key, '-inf', windowStart);
      
      // Set expiry
      await this.redis.expire(key, 24 * 60 * 60 + 60); // 24 hours + 1 minute buffer
    } catch (error) {
      console.error('Failed to increment AI usage:', error);
    }
  }

  /**
   * Check if user has exceeded rate limits
   */
  private async checkRateLimit(userId: string, config: AIRateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    try {
      const key = `ai_rate_limit:${userId}`;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Remove old entries
      await this.redis.zremrangebyscore(key, '-inf', windowStart);

      // Count current requests in window
      const currentRequests = await this.redis.zcard(key);
      const remaining = Math.max(0, config.maxRequests - currentRequests);
      const allowed = currentRequests < config.maxRequests;

      // Calculate reset time (next window)
      const resetTime = new Date(now + config.windowMs);

      return {
        allowed,
        remaining,
        resetTime
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow the request but log the error
      return {
        allowed: true,
        remaining: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
  }

  /**
   * Get current usage statistics for a user
   */
  async getUsageStats(userId: string): Promise<{
    requestsInWindow: number;
    tokensUsedInWindow: number;
    windowStart: Date;
    windowEnd: Date;
  }> {
    try {
      const key = `ai_rate_limit:${userId}`;
      const now = Date.now();
      const windowStart = now - (24 * 60 * 60 * 1000);

      // Get all requests in current window
      const requests = await this.redis.zrangebyscore(key, windowStart, now);
      
      let tokensUsed = 0;
      for (const request of requests) {
        const parts = request.split(':');
        if (parts.length >= 3) {
          tokensUsed += parseInt(parts[2]) || 0;
        }
      }

      return {
        requestsInWindow: requests.length,
        tokensUsedInWindow: tokensUsed,
        windowStart: new Date(windowStart),
        windowEnd: new Date(now)
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {
        requestsInWindow: 0,
        tokensUsedInWindow: 0,
        windowStart: new Date(),
        windowEnd: new Date()
      };
    }
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  async resetUserLimits(userId: string): Promise<void> {
    try {
      const key = `ai_rate_limit:${userId}`;
      await this.redis.del(key);
    } catch (error) {
      console.error('Failed to reset user limits:', error);
      throw new Error('Failed to reset rate limits');
    }
  }

  /**
   * Get rate limit configuration for subscription level
   */
  getConfigForSubscription(subscriptionLevel: string): AIRateLimitConfig | null {
    return this.config[subscriptionLevel] || null;
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Create service instance
export const aiRateLimitService = new AIRateLimitService();

// Export middleware function
export const aiRateLimit = aiRateLimitService.createAIRateLimit();

export default aiRateLimitService;