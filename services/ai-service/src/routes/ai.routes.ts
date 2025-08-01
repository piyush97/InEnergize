import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { validateToken, requireSubscription, requireAIUsageLimit } from '../middleware/auth.middleware';
import { aiRateLimit } from '../middleware/aiRateLimit.middleware';
import rateLimit from 'express-rate-limit';

// Create router
const router = Router();

// Create controller instance
const aiController = new AIController();

// Basic rate limiting for all routes
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later',
      code: 'GENERAL_RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI-specific rate limiting for authenticated routes
const aiSpecificRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each user to 20 AI requests per minute
  message: {
    success: false,
    error: {
      message: 'Too many AI requests, please slow down',
      code: 'AI_RATE_LIMIT_EXCEEDED'
    }
  },
  keyGenerator: (req: any) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
router.use(generalRateLimit);

// Public routes (no authentication required)
router.get('/health', aiController.healthCheck.bind(aiController));

// Protected routes (authentication required)
router.use(validateToken);
router.use(requireAIUsageLimit());

// User capabilities and usage
router.get('/capabilities', aiController.getCapabilities.bind(aiController));
router.get('/usage', aiController.getUsageStats.bind(aiController));

// Profile optimization routes
router.post('/optimize-profile', 
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('FREE'),
  aiController.optimizeProfile.bind(aiController)
);

router.post('/generate-headlines',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('BASIC'),
  aiController.generateHeadlines.bind(aiController)
);

router.post('/generate-summaries',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.generateSummaries.bind(aiController)
);

router.post('/suggest-skills',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.suggestSkills.bind(aiController)
);

// Content generation routes
router.post('/generate-content',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('BASIC'),
  aiController.generateContent.bind(aiController)
);

// Advanced features (PRO and ENTERPRISE only)
router.post('/custom-prompt',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.customPrompt.bind(aiController)
);

// ML and AI Enhancement Routes (PRO+)
router.post('/automation-safety-score',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.generateAutomationSafetyScore.bind(aiController)
);

router.post('/predict-engagement',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.predictEngagement.bind(aiController)
);

router.post('/optimize-content-advanced',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.optimizeContentAdvanced.bind(aiController)
);

router.post('/analyze-profile-image',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.analyzeProfileImage.bind(aiController)
);

router.post('/sentiment-analysis',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('BASIC'),
  aiController.performSentimentAnalysis.bind(aiController)
);

// Advanced Recommendation Engine (PRO+)
router.post('/connection-recommendations',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.generateConnectionRecommendations.bind(aiController)
);

router.post('/content-recommendations',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.generateContentRecommendations.bind(aiController)
);

router.post('/growth-plan',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.createGrowthPlan.bind(aiController)
);

router.post('/ab-test',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('PRO'),
  aiController.runABTest.bind(aiController)
);

// Enterprise-only ML Features
router.post('/optimize-model',
  aiSpecificRateLimit,
  aiRateLimit,
  requireSubscription('ENTERPRISE'),
  aiController.optimizeModelPerformance.bind(aiController)
);

// Middleware for error handling
router.use((error: any, req: any, res: any, next: any) => {
  console.error('AI Routes Error:', error);
  
  res.status(500).json({
    success: false,
    error: {
      message: 'AI service error occurred',
      code: 'AI_SERVICE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }
  });
});

export default router;