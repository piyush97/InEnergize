import { Router } from 'express';
import { MetricsController } from '@/controllers/metrics.controller';
import { authenticateToken, requireSubscription } from '@/middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();
const metricsController = new MetricsController();

// Rate limiting for metrics endpoints
const metricsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // More restrictive for write operations
  message: {
    success: false,
    error: 'Too many metric recording requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check (no auth required)
router.get('/health', metricsController.healthCheck);

// Apply rate limiting and authentication to all protected routes
router.use(metricsRateLimit);
router.use(authenticateToken);

// Dashboard metrics (basic subscription required)
router.get('/dashboard', 
  requireSubscription('basic'),
  metricsController.getDashboardMetrics
);

// Profile analytics (basic subscription required)
router.get('/analytics', 
  requireSubscription('basic'),
  metricsController.getProfileAnalytics
);

// Time range metrics (premium subscription required for advanced analytics)
router.get('/time-range', 
  requireSubscription('premium'),
  metricsController.getMetricsTimeRange
);

// Record profile metric (more restrictive rate limiting)
router.post('/profile', 
  strictRateLimit,
  requireSubscription('basic'),
  metricsController.recordProfileMetric
);

// Record engagement metric (more restrictive rate limiting)
router.post('/engagement', 
  strictRateLimit,
  requireSubscription('basic'),
  metricsController.recordEngagementMetric
);

export default router;