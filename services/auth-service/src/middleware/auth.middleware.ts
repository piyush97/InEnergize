// Authentication Middleware

import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt.service';
import { JWTPayload, UserRole } from '../types/auth';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export class AuthMiddleware {
  private jwtService: JWTService;

  constructor() {
    this.jwtService = new JWTService();
  }

  /**
   * Verify JWT token and attach user data to request
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.get('Authorization');
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'No token provided',
          code: 'NO_TOKEN',
        });
        return;
      }

      const decoded = await this.jwtService.verifyAccessToken(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        });
        return;
      }

      // Attach user data to request
      req.user = decoded;
      next();

    } catch (error) {
      console.error('Authentication error:', error);
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
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (token) {
        const decoded = await this.jwtService.verifyAccessToken(token);
        if (decoded) {
          req.user = decoded;
        }
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
  requireRole = (roles: UserRole | UserRole[]) => {
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
  requireAdmin = this.requireRole([UserRole.ADMIN, UserRole.SUPERADMIN]);

  /**
   * Require superadmin role
   */
  requireSuperAdmin = this.requireRole(UserRole.SUPERADMIN);

  /**
   * Check if user owns resource
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
          req.user.role !== UserRole.ADMIN && 
          req.user.role !== UserRole.SUPERADMIN) {
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
   * Rate limiting middleware
   */
  rateLimit = (options: {
    maxRequests: number;
    windowMinutes: number;
    keyGenerator?: (req: Request) => string;
  }) => {
    const { maxRequests, windowMinutes, keyGenerator } = options;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Default key generator uses IP + user ID if available
        const defaultKey = req.user ? 
          `${req.ip}-${req.user.userId}` : 
          req.ip || 'unknown';
        
        const key = keyGenerator ? keyGenerator(req) : defaultKey;
        
        // This would typically use a rate limiting service
        // For now, we'll pass through and implement later
        next();

      } catch (error) {
        console.error('Rate limiting error:', error);
        next();
      }
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
   * Validate API key (for webhook/API access)
   */
  validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.get('X-API-Key') || req.query.apiKey as string;
    const expectedApiKey = process.env.API_KEY;

    if (!expectedApiKey) {
      res.status(500).json({
        success: false,
        message: 'API key validation not configured',
        code: 'API_KEY_NOT_CONFIGURED',
      });
      return;
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      res.status(401).json({
        success: false,
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
      return;
    }

    next();
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