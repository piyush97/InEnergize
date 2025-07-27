// LinkedIn Integration Routes

import express from 'express';
import rateLimit from 'express-rate-limit';
import { LinkedInController } from '../controllers/linkedin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();
const linkedinController = new LinkedInController();

// Rate limiting configurations
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const oauthRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Very conservative for OAuth operations
  message: {
    success: false,
    message: 'Too many OAuth attempts, please try again later.',
    code: 'OAUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // Conservative limit for LinkedIn API calls
  message: {
    success: false,
    message: 'LinkedIn API rate limit exceeded, please try again later.',
    code: 'LINKEDIN_API_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
router.use(generalRateLimit);

// Health check endpoint (no auth required)
router.get('/health', linkedinController.getHealthStatus.bind(linkedinController));

// OAuth endpoints
router.post('/auth/initiate', oauthRateLimit, authMiddleware, linkedinController.initiateAuth.bind(linkedinController));
router.get('/oauth/authorize', oauthRateLimit, authMiddleware, linkedinController.initiateAuth.bind(linkedinController));
router.post('/auth/callback', oauthRateLimit, linkedinController.handleCallback.bind(linkedinController));
router.post('/oauth/callback', oauthRateLimit, linkedinController.handleCallback.bind(linkedinController));
router.delete('/auth/disconnect', authMiddleware, linkedinController.disconnectAccount.bind(linkedinController));

// Profile management endpoints
router.get('/profile', apiRateLimit, authMiddleware, linkedinController.getProfile.bind(linkedinController));
router.post('/profile/sync', apiRateLimit, authMiddleware, linkedinController.syncProfile.bind(linkedinController));
router.get('/profile/completeness', apiRateLimit, authMiddleware, linkedinController.getCompleteness.bind(linkedinController));
router.get('/profile/benchmarks', apiRateLimit, authMiddleware, linkedinController.getBenchmarks.bind(linkedinController));

// Profile optimization endpoints
router.get('/profile/optimization-suggestions', apiRateLimit, authMiddleware, linkedinController.getOptimizationSuggestions.bind(linkedinController));
router.post('/profile/optimization-suggestions/:id/complete', apiRateLimit, authMiddleware, linkedinController.completeOptimizationSuggestion.bind(linkedinController));
router.post('/profile/ai-suggestions', apiRateLimit, authMiddleware, linkedinController.generateAISuggestions.bind(linkedinController));

// Analytics endpoints
router.get('/analytics', apiRateLimit, authMiddleware, linkedinController.getAnalytics.bind(linkedinController));

// Content creation endpoints
router.post('/posts', apiRateLimit, authMiddleware, linkedinController.createPost.bind(linkedinController));

// Networking endpoints
router.post('/connections/request', apiRateLimit, authMiddleware, linkedinController.sendConnectionRequest.bind(linkedinController));

// Rate limit monitoring
router.get('/rate-limits', authMiddleware, linkedinController.getRateLimitStatus.bind(linkedinController));

// Error handling middleware for LinkedIn routes
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  console.error('LinkedIn Route Error:', error);

  // Handle LinkedIn API specific errors
  if (error.name === 'LinkedInAPIError') {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.response
    });
    return;
  }

  // Handle rate limit errors
  if (error.name === 'RateLimitError') {
    res.status(429).json({
      success: false,
      message: error.message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: error.retryAfter
    });
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Invalid request data',
      code: 'VALIDATION_ERROR',
      details: error.details
    });
    return;
  }

  // Handle JWT authentication errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
      code: 'AUTHENTICATION_ERROR'
    });
    return;
  }

  // Generic error handler
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

export default router;