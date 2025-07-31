import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    subscriptionTier: string;
  };
}

class AuthMiddleware {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  /**
   * Middleware to authenticate JWT tokens
   */
  public authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);
      
      if (!token) {
        res.status(401).json({ error: 'Invalid token format' });
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Check if token is revoked/blacklisted
      const isRevoked = await this.redis.get(`revoked_token:${token}`);\n      if (isRevoked) {\n        res.status(401).json({ error: 'Token has been revoked' });\n        return;\n      }\n\n      // Get user data from Redis/database\n      const userKey = `user:${decoded.userId}`;\n      const userData = await this.redis.get(userKey);\n      \n      if (!userData) {\n        res.status(401).json({ error: 'User not found or inactive' });\n        return;\n      }\n\n      const user = JSON.parse(userData);\n      \n      // Check if user is active\n      if (user.status !== 'ACTIVE') {\n        res.status(401).json({ error: 'User account is not active' });\n        return;\n      }\n\n      // Attach user info to request\n      req.user = {\n        userId: decoded.userId,\n        email: user.email,\n        role: user.role,\n        subscriptionTier: user.subscriptionTier\n      };\n\n      next();\n    } catch (error) {\n      if (error instanceof jwt.JsonWebTokenError) {\n        res.status(401).json({ error: 'Invalid token' });\n      } else if (error instanceof jwt.TokenExpiredError) {\n        res.status(401).json({ error: 'Token expired' });\n      } else {\n        console.error('Authentication error:', error);\n        res.status(500).json({ error: 'Authentication failed' });\n      }\n    }\n  };\n\n  /**\n   * Middleware to require specific role\n   */\n  public requireRole = (requiredRole: string) => {\n    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {\n      if (!req.user) {\n        res.status(401).json({ error: 'Authentication required' });\n        return;\n      }\n\n      if (req.user.role !== requiredRole && req.user.role !== 'SUPERADMIN') {\n        res.status(403).json({ error: 'Insufficient permissions' });\n        return;\n      }\n\n      next();\n    };\n  };\n\n  /**\n   * Middleware to require minimum subscription tier\n   */\n  public requireSubscription = (minTier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE') => {\n    const tierHierarchy = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];\n    const minTierIndex = tierHierarchy.indexOf(minTier);\n\n    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {\n      if (!req.user) {\n        res.status(401).json({ error: 'Authentication required' });\n        return;\n      }\n\n      const userTierIndex = tierHierarchy.indexOf(req.user.subscriptionTier);\n      \n      if (userTierIndex < minTierIndex) {\n        res.status(403).json({ \n          error: 'Insufficient subscription tier',\n          required: minTier,\n          current: req.user.subscriptionTier\n        });\n        return;\n      }\n\n      next();\n    };\n  };\n\n  /**\n   * Middleware for admin-only endpoints\n   */\n  public requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {\n    if (!req.user) {\n      res.status(401).json({ error: 'Authentication required' });\n      return;\n    }\n\n    if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {\n      res.status(403).json({ error: 'Admin access required' });\n      return;\n    }\n\n    next();\n  };\n}\n\nexport const authMiddleware = new AuthMiddleware();\nexport default authMiddleware;