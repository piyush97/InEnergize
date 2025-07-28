import { Request, Response, NextFunction } from 'express';
import { RequestWithUser } from '../types';

type SubscriptionLevel = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';

/**
 * Middleware to check if user has required subscription level
 */
export const subscriptionMiddleware = (requiredLevels: SubscriptionLevel[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const userSubscription = req.user?.subscriptionLevel;
      
      if (!userSubscription) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User subscription information not found',
            code: 'SUBSCRIPTION_REQUIRED'
          }
        });
      }

      if (!requiredLevels.includes(userSubscription)) {
        return res.status(403).json({
          success: false,
          error: {
            message: `This feature requires ${requiredLevels.join(' or ')} subscription`,
            code: 'INSUFFICIENT_SUBSCRIPTION',
            details: {
              required: requiredLevels,
              current: userSubscription
            }
          }
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Subscription verification failed',
          code: 'SUBSCRIPTION_CHECK_ERROR'
        }
      });
    }
  };
};

/**
 * Get subscription limits for different features
 */
export const getSubscriptionLimits = (subscription: SubscriptionLevel) => {
  const limits = {
    FREE: {
      bannerGeneration: 0,
      bannerVariations: 0,
      aiRequestsPerDay: 5,
      maxTokensPerRequest: 500
    },
    BASIC: {
      bannerGeneration: 10,
      bannerVariations: 2,
      aiRequestsPerDay: 50,
      maxTokensPerRequest: 1000
    },
    PRO: {
      bannerGeneration: 50,
      bannerVariations: 10,
      aiRequestsPerDay: 200,
      maxTokensPerRequest: 2000
    },
    ENTERPRISE: {
      bannerGeneration: 500,
      bannerVariations: 100,
      aiRequestsPerDay: 1000,
      maxTokensPerRequest: 4000
    }
  };

  return limits[subscription] || limits.FREE;
};

/**
 * Check if user can perform specific action based on subscription
 */
export const canPerformAction = (
  subscription: SubscriptionLevel, 
  action: string, 
  currentUsage: number = 0
): { allowed: boolean; limit: number; remaining: number } => {
  const limits = getSubscriptionLimits(subscription);
  const actionLimits: Record<string, keyof typeof limits> = {
    'banner-generation': 'bannerGeneration',
    'banner-variations': 'bannerVariations',
    'ai-requests': 'aiRequestsPerDay'
  };

  const limitKey = actionLimits[action];
  if (!limitKey) {
    return { allowed: false, limit: 0, remaining: 0 };
  }

  const limit = limits[limitKey];
  const remaining = Math.max(0, limit - currentUsage);
  
  return {
    allowed: remaining > 0,
    limit,
    remaining
  };
};