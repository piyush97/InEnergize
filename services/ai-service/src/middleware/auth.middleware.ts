import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { RequestWithUser } from '../types';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  subscriptionLevel: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    subscriptionLevel: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  };
}

export class AuthMiddleware {
  private jwtSecret: string;
  private authServiceUrl: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not provided, using fallback key (not secure for production)');
    }
  }

  /**
   * Validate JWT token and add user info to request
   */
  async validateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authorization header is required',
            code: 'MISSING_AUTHORIZATION_HEADER'
          }
        });
        return;
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Access token is required',
            code: 'MISSING_ACCESS_TOKEN'
          }
        });
        return;
      }

      // Verify JWT token
      let decoded: JWTPayload;
      try {
        decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          res.status(401).json({
            success: false,
            error: {
              message: 'Access token has expired',
              code: 'TOKEN_EXPIRED'
            }
          });
          return;
        } else if (jwtError.name === 'JsonWebTokenError') {
          res.status(401).json({
            success: false,
            error: {
              message: 'Invalid access token',
              code: 'INVALID_TOKEN'
            }
          });
          return;
        } else {
          throw jwtError;
        }
      }

      // Validate token with auth service (optional, for extra security)
      if (process.env.VALIDATE_TOKENS_WITH_AUTH_SERVICE === 'true') {
        const isValid = await this.validateWithAuthService(token);
        if (!isValid) {
          res.status(401).json({
            success: false,
            error: {
              message: 'Token validation failed',
              code: 'TOKEN_VALIDATION_FAILED'
            }
          });
          return;
        }
      }

      // Add user information to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        subscriptionLevel: decoded.subscriptionLevel as 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Authentication validation failed',
          code: 'AUTH_VALIDATION_ERROR'
        }
      });
    }
  }

  /**
   * Check user role authorization
   */
  requireRole(allowedRoles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'User authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient permissions for this operation',
            code: 'INSUFFICIENT_PERMISSIONS',
            details: {
              requiredRoles: allowedRoles,
              userRole: req.user.role
            }
          }
        });
        return;
      }

      next();
    };
  }

  /**
   * Check subscription level requirements with AI-specific limits
   */
  requireSubscription(minimumLevel: string): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
    const subscriptionHierarchy = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];
    
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'User authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
        return;
      }

      const userLevel = req.user.subscriptionLevel || 'FREE';
      const userLevelIndex = subscriptionHierarchy.indexOf(userLevel);
      const requiredLevelIndex = subscriptionHierarchy.indexOf(minimumLevel);

      if (userLevelIndex < requiredLevelIndex) {
        res.status(403).json({
          success: false,
          error: {
            message: `This AI feature requires ${minimumLevel} subscription or higher`,
            code: 'AI_SUBSCRIPTION_UPGRADE_REQUIRED',
            details: {
              currentLevel: userLevel,
              requiredLevel: minimumLevel,
              upgradeRequired: true
            }
          }
        });
        return;
      }

      next();
    };
  }

  /**
   * Check AI-specific usage limits based on subscription
   */
  requireAIUsageLimit(): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'User authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
        return;
      }

      // AI usage limits by subscription level
      const aiLimits = {
        FREE: { dailyRequests: 5, maxTokensPerRequest: 1000 },
        BASIC: { dailyRequests: 25, maxTokensPerRequest: 2000 },
        PRO: { dailyRequests: 100, maxTokensPerRequest: 4000 },
        ENTERPRISE: { dailyRequests: 500, maxTokensPerRequest: 8000 }
      };

      const userLevel = req.user.subscriptionLevel;
      const limits = aiLimits[userLevel];

      // Add usage limits to request for rate limiting
      (req as any).aiLimits = limits;

      next();
    };
  }

  /**
   * Validate token with auth service
   */
  private async validateWithAuthService(token: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.authServiceUrl}/validate`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      return response.data.success === true;
    } catch (error) {
      console.error('Token validation with auth service failed:', error);
      return false;
    }
  }
}

// Create middleware instance
export const authMiddleware = new AuthMiddleware();

// Export commonly used middleware functions
export const validateToken = authMiddleware.validateToken.bind(authMiddleware);
export const requireRole = (roles: string[]) => authMiddleware.requireRole(roles);
export const requireSubscription = (level: string) => authMiddleware.requireSubscription(level);
export const requireAIUsageLimit = () => authMiddleware.requireAIUsageLimit();

export default authMiddleware;