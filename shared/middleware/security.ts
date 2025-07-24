import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Environment variables with defaults
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security Headers Middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.linkedin.com", "https://api.openai.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Rate Limiting Configurations
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: 'Too many requests',
      message: options.message || 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000),
    },
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
};

// Pre-configured rate limiters
export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
});

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: 'Too many login attempts, please try again later.',
});

export const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'API rate limit exceeded.',
  skipSuccessfulRequests: true,
});

// JWT Authentication Middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
    iat?: number;
    exp?: number;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Access denied',
        message: 'Authentication token is required',
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid',
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        message: 'Authentication token has expired',
      });
    } else {
      res.status(500).json({
        error: 'Authentication error',
        message: 'An error occurred during authentication',
      });
    }
  }
};

// Authorization Middleware (subscription tiers)
export const requireSubscription = (requiredTier: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE') => {
  const tierLevels = {
    FREE: 0,
    BASIC: 1,
    PROFESSIONAL: 2,
    ENTERPRISE: 3,
  };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    const userTierLevel = tierLevels[req.user.subscriptionTier as keyof typeof tierLevels];
    const requiredTierLevel = tierLevels[requiredTier];

    if (userTierLevel < requiredTierLevel) {
      res.status(403).json({
        error: 'Insufficient subscription',
        message: `This feature requires a ${requiredTier} subscription or higher`,
        required: requiredTier,
        current: req.user.subscriptionTier,
      });
      return;
    }

    next();
  };
};

// Input Validation Middleware
export const validateInput = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'Please check your input and try again',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? error.path : undefined,
          message: error.msg,
          value: error.type === 'field' ? error.value : undefined,
        })),
      });
      return;
    }

    next();
  };
};

// Common validation rules
export const emailValidation = body('email')
  .isEmail()
  .withMessage('Please provide a valid email address')
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Email address is too long');

export const passwordValidation = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');

export const nameValidation = (fieldName: string) =>
  body(fieldName)
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage(`${fieldName} must be between 1 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);

// Content validation
export const contentValidation = body('content')
  .trim()
  .isLength({ min: 1, max: 3000 })
  .withMessage('Content must be between 1 and 3000 characters');

export const titleValidation = body('title')
  .trim()
  .isLength({ min: 1, max: 100 })
  .withMessage('Title must be between 1 and 100 characters');

// LinkedIn URL validation
export const linkedinUrlValidation = body('linkedinUrl')
  .isURL({ protocols: ['https'], host_whitelist: ['www.linkedin.com', 'linkedin.com'] })
  .withMessage('Please provide a valid LinkedIn URL');

// Password Hashing Utilities
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// JWT Utilities
export const generateToken = (payload: object, expiresIn: string = '24h'): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export const generateRefreshToken = (payload: object): string => {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
  return jwt.sign(payload, refreshSecret, { expiresIn: '7d' });
};

// CORS Configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
    ];

    if (NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-CSRF-Token',
  ],
  exposedHeaders: ['X-Auth-Token'],
};

// Security Headers for API responses
export const apiSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// Error handling middleware
export const securityErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log security-related errors (but don't expose details to client)
  if (NODE_ENV !== 'production') {
    console.error('Security Error:', error);
  }

  // Generic error response for security issues
  if (error.message?.includes('CORS') || error.name === 'UnauthorizedError') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied',
    });
    return;
  }

  next(error);
};