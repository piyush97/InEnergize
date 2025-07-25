// Authentication Middleware for User Service

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        subscriptionLevel: string;
        sessionId: string;
      };
    }
  }
}

export class AuthMiddleware {
  private authServiceUrl: string;

  constructor() {
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
  }

  /**
   * Authenticate user by validating token with auth service
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'No token provided',
          code: 'NO_TOKEN',
        });
        return;
      }

      const token = authHeader.substring(7);

      // Validate token with auth service
      const response = await axios.post(
        `${this.authServiceUrl}/auth/validate`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      if (!response.data.success || !response.data.user) {
        res.status(401).json({
          success: false,
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
        return;
      }

      // Attach user data to request
      req.user = response.data.user;
      next();

    } catch (error) {
      console.error('Authentication error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          res.status(503).json({
            success: false,
            message: 'Authentication service unavailable',
            code: 'AUTH_SERVICE_UNAVAILABLE',
          });
          return;
        }

        if (error.response?.status === 401) {
          res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
            code: 'INVALID_TOKEN',
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
      });
    }
  };

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
      }

      const token = authHeader.substring(7);

      // Validate token with auth service
      const response = await axios.post(
        `${this.authServiceUrl}/auth/validate`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      if (response.data.success && response.data.user) {
        req.user = response.data.user;
      }

      next();

    } catch (error) {
      // Don't fail on optional authentication errors
      next();
    }
  };

  /**
   * Require specific role
   */
  requireRole = (roles: string | string[]) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      if (!requiredRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRole: requiredRoles,
          userRole: req.user.role,
        });
        return;
      }

      next();
    };
  };

  /**
   * Require admin role
   */
  requireAdmin = this.requireRole(['admin', 'superadmin']);

  /**
   * Require superadmin role
   */
  requireSuperAdmin = this.requireRole('superadmin');

  /**
   * Check if user owns resource or is admin
   */
  requireOwnership = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
      
      // Allow if user owns the resource or is admin
      if (req.user.userId !== resourceUserId && 
          req.user.role !== 'admin' && 
          req.user.role !== 'superadmin') {
        res.status(403).json({
          success: false,
          message: 'Access denied - resource ownership required',
          code: 'OWNERSHIP_REQUIRED',
        });
        return;
      }

      next();
    };
  };

  /**
   * Validate subscription level
   */
  requireSubscription = (minLevel: string) => {
    const subscriptionHierarchy = {
      free: 0,
      basic: 1,
      pro: 2,
      enterprise: 3,
    };

    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const minLevelValue = subscriptionHierarchy[minLevel.toLowerCase() as keyof typeof subscriptionHierarchy];
      const userLevelValue = subscriptionHierarchy[req.user.subscriptionLevel.toLowerCase() as keyof typeof subscriptionHierarchy];

      if (userLevelValue < minLevelValue) {
        res.status(403).json({
          success: false,
          message: 'Subscription upgrade required',
          code: 'SUBSCRIPTION_REQUIRED',
          requiredLevel: minLevel,
          userLevel: req.user.subscriptionLevel,
        });
        return;
      }

      next();
    };
  };

  /**
   * CORS preflight handler
   */
  corsHandler = (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.get('Origin');
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };

  /**
   * Security headers middleware
   */
  securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Prevent XSS attacks
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // HSTS (only in production)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy (basic)
    res.setHeader('Content-Security-Policy', "default-src 'self'");

    next();
  };

  /**
   * Request logging middleware
   */
  requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.get('User-Agent') || 'unknown';
    const userId = req.user?.userId || 'anonymous';

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'user-service',
        method,
        url,
        statusCode,
        duration,
        ip,
        userId,
        userAgent: userAgent.substring(0, 100), // Truncate long user agents
      }));
    });

    next();
  };

  /**
   * Error handling middleware
   */
  errorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
    console.error('Unhandled error:', error);

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const message = isDevelopment ? error.message : 'Internal server error';
    const stack = isDevelopment ? error.stack : undefined;

    res.status(error.status || 500).json({
      success: false,
      message,
      stack,
      code: error.code || 'INTERNAL_ERROR',
    });
  };
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();