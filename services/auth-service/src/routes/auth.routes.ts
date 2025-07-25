// Authentication Routes

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { 
  AuthController,
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  mfaSetupValidation,
  mfaVerifyValidation
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// Rate limiting configurations
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many attempts, please try again later',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const moderateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all auth routes
router.use(generalRateLimit);

// Apply security headers and CORS
router.use(authMiddleware.corsHandler);
router.use(authMiddleware.securityHeaders);
router.use(authMiddleware.requestLogger);

/**
 * @route POST /auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', 
  strictRateLimit,
  registerValidation,
  authController.register.bind(authController)
);

/**
 * @route POST /auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login',
  strictRateLimit,
  loginValidation,
  authController.login.bind(authController)
);

/**
 * @route POST /auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh',
  moderateRateLimit,
  refreshTokenValidation,
  authController.refreshToken.bind(authController)
);

/**
 * @route POST /auth/logout
 * @desc Logout user (invalidate current session)
 * @access Private
 */
router.post('/logout',
  authMiddleware.authenticate,
  authController.logout.bind(authController)
);

/**
 * @route POST /auth/logout-all
 * @desc Logout from all devices (invalidate all sessions)
 * @access Private
 */
router.post('/logout-all',
  authMiddleware.authenticate,
  authController.logoutAll.bind(authController)
);

/**
 * @route GET /auth/sessions
 * @desc Get all active sessions for the user
 * @access Private
 */
router.get('/sessions',
  authMiddleware.authenticate,
  authController.getSessions.bind(authController)
);

/**
 * @route POST /auth/mfa/setup
 * @desc Setup MFA for user account
 * @access Private
 */
router.post('/mfa/setup',
  authMiddleware.authenticate,
  moderateRateLimit,
  mfaSetupValidation,
  authController.setupMFA.bind(authController)
);

/**
 * @route POST /auth/mfa/verify
 * @desc Verify MFA setup with TOTP token
 * @access Private
 */
router.post('/mfa/verify',
  authMiddleware.authenticate,
  moderateRateLimit,
  mfaVerifyValidation,
  authController.verifyMFASetup.bind(authController)
);

/**
 * @route GET /auth/me
 * @desc Get current user info
 * @access Private
 */
router.get('/me',
  authMiddleware.authenticate,
  (req, res) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    res.json({
      success: true,
      user: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        subscriptionLevel: req.user.subscriptionLevel,
        sessionId: req.user.sessionId,
      }
    });
  }
);

/**
 * @route POST /auth/validate
 * @desc Validate token (for other services)
 * @access Private
 */
router.post('/validate',
  authMiddleware.authenticate,
  (req, res) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      user: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        subscriptionLevel: req.user.subscriptionLevel,
      }
    });
  }
);

/**
 * @route GET /auth/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * @route GET /auth/status
 * @desc Service status with detailed information
 * @access Private (Admin only)
 */
router.get('/status',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      // This would typically include:
      // - Database connection status
      // - Redis connection status
      // - Rate limiting status
      // - Active sessions count
      // - System metrics

      res.json({
        success: true,
        status: 'operational',
        services: {
          database: 'connected',
          redis: 'connected',
          rateLimiting: 'active',
        },
        metrics: {
          activeSessions: 0, // Would get from JWT service
          requestsPerMinute: 0,
          errorRate: 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get service status',
        code: 'STATUS_ERROR'
      });
    }
  }
);

// Handle 404 for undefined routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Auth endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
  });
});

// Error handling middleware (should be last)
router.use(authMiddleware.errorHandler);

export default router;