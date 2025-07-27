import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '@/config/logger';

interface JWTPayload {
  userId: string;
  email: string;
  subscriptionLevel: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    req.user = decoded;

    logger.debug('Token authenticated', { 
      userId: decoded.userId,
      subscriptionLevel: decoded.subscriptionLevel 
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      return;
    }

    logger.error('Authentication error', { error });
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    req.user = decoded;

    next();
  } catch (error) {
    // For optional auth, we don't return errors, just proceed without user
    next();
  }
};

export const requireSubscription = (requiredLevel: string = 'basic') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const subscriptionLevels = ['free', 'basic', 'premium', 'enterprise'];
    const userLevel = req.user.subscriptionLevel || 'free';
    const userLevelIndex = subscriptionLevels.indexOf(userLevel);
    const requiredLevelIndex = subscriptionLevels.indexOf(requiredLevel);

    if (userLevelIndex < requiredLevelIndex) {
      res.status(403).json({
        success: false,
        error: `Subscription level '${requiredLevel}' or higher required. Current level: '${userLevel}'`
      });
      return;
    }

    next();
  };
};

// Export default middleware for easy import
export const authMiddleware = authenticateToken;