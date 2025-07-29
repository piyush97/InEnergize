// ===================================================================
// AUTOMATION ROUTES - LinkedIn Automation API Routes
// ===================================================================

import { Router } from 'express';
import { LinkedInAutomationController } from '../controllers/automation.controller';
import { authMiddleware, requireRole, requireSubscription } from '../middleware/auth.middleware';
import { linkedinCompliance } from '../middleware/linkedinCompliance.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();
const automationController = new LinkedInAutomationController();

// Rate limiting for automation endpoints
const automationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user to 30 requests per windowMs
  message: 'Too many automation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAutomationLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each user to 5 requests per minute for scheduling operations
  message: 'Too many scheduling requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Higher limit for admin operations
  message: 'Too many admin requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// ===================================================================
// PUBLIC ENDPOINTS (no authentication required)
// ===================================================================

/**
 * @route GET /automation/health
 * @desc Health check for automation services
 * @access Public (for monitoring)
 */
router.get('/health', automationController.healthCheck);

// ===================================================================
// PROTECTED ENDPOINTS (authentication required)
// ===================================================================

// Apply middleware to all protected routes
router.use(authMiddleware);
router.use(automationRateLimit);
router.use(linkedinCompliance);

// ===================================================================
// CONNECTION AUTOMATION ROUTES
// ===================================================================

/**
 * @route POST /api/automation/connections/schedule
 * @desc Schedule a LinkedIn connection request
 * @access Private (BASIC+ subscription required)
 */
router.post('/connections/schedule',
  strictAutomationLimit,
  requireSubscription('BASIC'),
  automationController.scheduleConnection
);

/**
 * @route DELETE /api/automation/connections/:requestId
 * @desc Cancel a pending connection request
 * @access Private
 */
router.delete('/connections/:requestId',
  automationController.cancelConnection
);

/**
 * @route GET /api/automation/connections/stats
 * @desc Get connection automation statistics
 * @access Private
 */
router.get('/connections/stats',
  automationController.getConnectionStats
);

// ===================================================================
// ENGAGEMENT AUTOMATION ROUTES
// ===================================================================

/**
 * @route POST /api/automation/engagement/schedule
 * @desc Schedule an engagement action (like, comment, view, follow)
 * @access Private (PRO+ subscription required for comments/follows)
 */
router.post('/engagement/schedule',
  strictAutomationLimit,
  (req, res, next) => {
    // Different subscription requirements based on engagement type
    const { type } = req.body;
    if (type === 'comment' || type === 'follow') {
      return requireSubscription('PRO')(req, res, next);
    } else {
      return requireSubscription('BASIC')(req, res, next);
    }
  },
  automationController.scheduleEngagement
);

/**
 * @route GET /api/automation/engagement/stats
 * @desc Get engagement automation statistics
 * @access Private
 */
router.get('/engagement/stats',
  automationController.getEngagementStats
);

// ===================================================================
// SAFETY MONITORING ROUTES
// ===================================================================

/**
 * @route POST /api/automation/safety/start
 * @desc Start safety monitoring for the current user
 * @access Private
 */
router.post('/safety/start',
  automationController.startSafetyMonitoring
);

/**
 * @route POST /api/automation/safety/stop
 * @desc Stop safety monitoring for the current user
 * @access Private
 */
router.post('/safety/stop',
  automationController.stopSafetyMonitoring
);

/**
 * @route GET /api/automation/safety/status
 * @desc Get current safety status for the user
 * @access Private
 */
router.get('/safety/status',
  automationController.getSafetyStatus
);

/**
 * @route GET /api/automation/status
 * @desc Check if automation is enabled/suspended for the user
 * @access Private
 */
router.get('/status',
  automationController.getAutomationStatus
);

// ===================================================================
// GENERAL AUTOMATION ROUTES
// ===================================================================

/**
 * @route GET /api/automation/overview
 * @desc Get comprehensive automation overview
 * @access Private
 */
router.get('/overview',
  automationController.getAutomationOverview
);


// ===================================================================
// ADMIN ROUTES
// ===================================================================

/**
 * @route GET /api/automation/admin/dashboard
 * @desc Get safety dashboard for all users
 * @access Admin only
 */
router.get('/admin/dashboard',
  adminRateLimit,
  requireRole('ADMIN'),
  automationController.getSafetyDashboard
);

/**
 * @route POST /api/automation/admin/users/:userId/resume
 * @desc Resume automation for a specific user
 * @access Admin only
 */
router.post('/admin/users/:userId/resume',
  adminRateLimit,
  requireRole('ADMIN'),
  automationController.resumeUserAutomation
);

// ===================================================================
// ERROR HANDLING
// ===================================================================

// Global error handler for automation routes
router.use((error: any, req: any, res: any, next: any) => {
  console.error('Automation route error:', error);
  
  // LinkedIn API specific errors
  if (error.response?.status === 429) {
    return res.status(429).json({
      error: 'LinkedIn API rate limit exceeded',
      message: 'Please reduce automation frequency',
      retryAfter: error.response.headers['retry-after'] || 3600
    });
  }
  
  if (error.response?.status === 403) {
    return res.status(403).json({
      error: 'LinkedIn API access denied',
      message: 'Possible account restriction or permission issue'
    });
  }
  
  // Compliance errors
  if (error.name === 'ComplianceError') {
    return res.status(400).json({
      error: 'Compliance violation',
      message: error.message,
      retryAfter: error.retryAfter
    });
  }
  
  // Rate limit errors
  if (error.name === 'RateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: error.message,
      retryAfter: error.retryAfter
    });
  }
  
  // Default error response
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

export default router;