import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number | ((req: Request) => number);
  message: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiting middleware with custom options
 */
export const rateLimitMiddleware = (options: RateLimitOptions) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: {
        message: options.message,
        code: 'RATE_LIMIT_EXCEEDED'
      }
    },
    keyGenerator: options.keyGenerator || ((req: any) => req.user?.id || req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          message: options.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.round(options.windowMs / 1000)
        }
      });
    }
  });
};

/**
 * Banner-specific rate limiting
 */
export const bannerRateLimit = rateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req: any) => {
    const subscription = req.user?.subscriptionLevel || 'FREE';
    const limits = {
      FREE: 0,
      BASIC: 10,
      PRO: 50,
      ENTERPRISE: 200
    };
    return limits[subscription as keyof typeof limits];
  },
  message: 'Banner generation rate limit exceeded for your subscription level'
});

/**
 * Subscription-based rate limiting
 */
export const subscriptionBasedRateLimit = (baseLimit: number) => {
  return rateLimitMiddleware({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req: any) => {
      const subscription = req.user?.subscriptionLevel || 'FREE';
      const multipliers = {
        FREE: 0.2,
        BASIC: 0.5,
        PRO: 1,
        ENTERPRISE: 3
      };
      return Math.ceil(baseLimit * (multipliers[subscription as keyof typeof multipliers] || 0.2));
    },
    message: 'Rate limit exceeded for your subscription level'
  });
};