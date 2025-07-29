import { Router } from 'express';
import { PredictiveAnalyticsController } from '@/controllers/predictiveAnalytics.controller';
import { authenticateToken, requireSubscription } from '@/middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();
const predictiveController = new PredictiveAnalyticsController();

// Rate limiting for predictive analytics endpoints
const predictiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs (more restrictive than basic metrics)
  message: {
    success: false,
    error: 'Too many predictive analytics requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const premiumRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // More restrictive for advanced features
  message: {
    success: false,
    error: 'Too many premium analytics requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check (no auth required)
router.get('/health', predictiveController.healthCheck);

// Apply rate limiting and authentication to all protected routes
router.use(predictiveRateLimit);
router.use(authenticateToken);

// Growth predictions (premium subscription required)
router.get('/growth', 
  requireSubscription('premium'),
  predictiveController.getGrowthPredictions
);

// Optimization recommendations (basic subscription required)
router.get('/recommendations', 
  requireSubscription('basic'),
  predictiveController.getOptimizationRecommendations
);

// Benchmark predictions (premium subscription required)
router.get('/benchmarks', 
  requireSubscription('premium'),
  predictiveController.getBenchmarkPredictions
);

// Content performance predictions (premium subscription required)
router.get('/content', 
  requireSubscription('premium'),
  predictiveController.getContentPredictions
);

// Network growth forecast (premium subscription required)
router.get('/network', 
  requireSubscription('premium'),
  predictiveController.getNetworkForecast
);

// Comprehensive predictive dashboard (enterprise subscription required)
router.get('/dashboard', 
  premiumRateLimit,
  requireSubscription('enterprise'),
  predictiveController.getPredictiveDashboard
);

export default router;