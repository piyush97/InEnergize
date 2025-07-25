// User Management Routes

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { 
  UserController,
  updateUserValidation,
  updatePreferencesValidation,
  searchUsersValidation,
  updateSubscriptionValidation
} from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

// Rate limiting configurations
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

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: {
    success: false,
    message: 'Too many upload attempts, please try again later',
    code: 'UPLOAD_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window for admin operations
  message: {
    success: false,
    message: 'Too many admin requests, please try again later',
    code: 'ADMIN_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all user routes
router.use(generalRateLimit);

// Apply security headers and CORS
router.use(authMiddleware.corsHandler);
router.use(authMiddleware.securityHeaders);
router.use(authMiddleware.requestLogger);

// Public/User Routes (require authentication)

/**
 * @route GET /users/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', 
  authMiddleware.authenticate,
  userController.getCurrentUser.bind(userController)
);

/**
 * @route PUT /users/me
 * @desc Update current user profile
 * @access Private
 */
router.put('/me',
  authMiddleware.authenticate,
  updateUserValidation,
  userController.updateCurrentUser.bind(userController)
);

/**
 * @route POST /users/me/avatar
 * @desc Upload profile image
 * @access Private
 */
router.post('/me/avatar',
  uploadRateLimit,
  authMiddleware.authenticate,
  userController.uploadProfileImage,
  userController.handleProfileImageUpload.bind(userController)
);

/**
 * @route GET /users/me/preferences
 * @desc Get user preferences and profile settings
 * @access Private
 */
router.get('/me/preferences',
  authMiddleware.authenticate,
  userController.getUserPreferences.bind(userController)
);

/**
 * @route PUT /users/me/preferences
 * @desc Update user preferences and profile settings
 * @access Private
 */
router.put('/me/preferences',
  authMiddleware.authenticate,
  updatePreferencesValidation,
  userController.updateUserPreferences.bind(userController)
);

/**
 * @route GET /users/me/usage
 * @desc Get subscription usage and limits
 * @access Private
 */
router.get('/me/usage',
  authMiddleware.authenticate,
  userController.getSubscriptionUsage.bind(userController)
);

/**
 * @route GET /users/me/activity
 * @desc Get user activity log
 * @access Private
 */
router.get('/me/activity',
  authMiddleware.authenticate,
  userController.getUserActivity.bind(userController)
);

/**
 * @route DELETE /users/me
 * @desc Delete user account
 * @access Private
 */
router.delete('/me',
  authMiddleware.authenticate,
  userController.deleteAccount.bind(userController)
);

// Admin Routes (require admin privileges)

/**
 * @route GET /users/search
 * @desc Search users with filters (Admin only)
 * @access Admin
 */
router.get('/search',
  adminRateLimit,
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  searchUsersValidation,
  userController.searchUsers.bind(userController)
);

/**
 * @route GET /users/stats
 * @desc Get user statistics (Admin only)
 * @access Admin
 */
router.get('/stats',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  userController.getUserStats.bind(userController)
);

/**
 * @route GET /users/:userId
 * @desc Get user by ID (Admin only)
 * @access Admin
 */
router.get('/:userId',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  userController.getUserById.bind(userController)
);

/**
 * @route PUT /users/:userId/subscription
 * @desc Update user subscription level (Admin only)
 * @access Admin
 */
router.put('/:userId/subscription',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  updateSubscriptionValidation,
  userController.updateUserSubscription.bind(userController)
);

/**
 * @route GET /users/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Handle 404 for undefined routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'User endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
  });
});

// Error handling middleware (should be last)
router.use(authMiddleware.errorHandler);

export default router;