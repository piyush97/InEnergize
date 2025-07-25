// Authentication Middleware for LinkedIn Service

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    subscriptionLevel?: string;
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  subscriptionLevel?: string;
  iat: number;
  exp: number;
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
          message: 'Authorization header is required',
          code: 'MISSING_AUTHORIZATION_HEADER'
        });
        return;
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'Access token is required',
          code: 'MISSING_ACCESS_TOKEN'
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
            message: 'Access token has expired',
            code: 'TOKEN_EXPIRED'
          });
          return;
        } else if (jwtError.name === 'JsonWebTokenError') {
          res.status(401).json({
            success: false,
            message: 'Invalid access token',
            code: 'INVALID_TOKEN'
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
            message: 'Token validation failed',
            code: 'TOKEN_VALIDATION_FAILED'
          });
          return;
        }
      }

      // Add user information to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        subscriptionLevel: decoded.subscriptionLevel
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication validation failed',
        code: 'AUTH_VALIDATION_ERROR'
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
          message: 'User authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions for this operation',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          userRole: req.user.role
        });
        return;
      }

      next();
    };
  }

  /**
   * Check subscription level requirements
   */
  requireSubscription(minimumLevel: string): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
    const subscriptionHierarchy = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];
    
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      const userLevel = req.user.subscriptionLevel || 'FREE';
      const userLevelIndex = subscriptionHierarchy.indexOf(userLevel);
      const requiredLevelIndex = subscriptionHierarchy.indexOf(minimumLevel);

      if (userLevelIndex < requiredLevelIndex) {
        res.status(403).json({
          success: false,
          message: `This feature requires ${minimumLevel} subscription or higher`,
          code: 'SUBSCRIPTION_UPGRADE_REQUIRED',
          currentLevel: userLevel,
          requiredLevel: minimumLevel
        });
        return;
      }

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
const authMiddlewareInstance = new AuthMiddleware();

// Export middleware functions
export const authMiddleware = authMiddlewareInstance.validateToken.bind(authMiddlewareInstance);
export const requireRole = authMiddlewareInstance.requireRole.bind(authMiddlewareInstance);
export const requireSubscription = authMiddlewareInstance.requireSubscription.bind(authMiddlewareInstance);

export default authMiddleware;