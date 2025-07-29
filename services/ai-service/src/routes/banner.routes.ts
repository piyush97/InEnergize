import { Router } from 'express';
import { BannerController } from '../controllers/banner.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rateLimit.middleware';
import { subscriptionMiddleware } from '../middleware/subscription.middleware';
import { OpenAIService } from '../services/openai.service';
import { AIServiceConfig } from '../types';

export function createBannerRoutes(openaiService: OpenAIService, config: AIServiceConfig): Router {
  const router = Router();
  const bannerController = new BannerController(openaiService, config);

  // Apply authentication to all routes
  router.use(authMiddleware);

  /**
   * @route POST /api/v1/banner/generate
   * @desc Generate a single LinkedIn banner
   * @access Private (requires authentication)
   * @rateLimit 10 requests per hour for FREE, 50 for PRO
   */
  router.post('/generate',
    rateLimitMiddleware({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: (req: any) => {
        const subscription = req.user?.subscriptionLevel || 'FREE';
        const limits = {
          FREE: 5,
          BASIC: 15,
          PRO: 50,
          ENTERPRISE: 200
        };
        return limits[subscription as keyof typeof limits];
      },
      message: 'Banner generation rate limit exceeded'
    }),
    subscriptionMiddleware(['BASIC', 'PRO', 'ENTERPRISE']),
    bannerController.generateBanner
  );

  /**
   * @route POST /api/v1/banner/variations
   * @desc Generate multiple banner variations
   * @access Private (PRO+ subscription required)
   * @rateLimit 5 requests per hour
   */
  router.post('/variations',
    rateLimitMiddleware({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: (req: any) => {
        const subscription = req.user?.subscriptionLevel || 'FREE';
        const limits = {
          FREE: 0, // Not allowed
          BASIC: 2,
          PRO: 10,
          ENTERPRISE: 50
        };
        return limits[subscription as keyof typeof limits];
      },
      message: 'Banner variations rate limit exceeded'
    }),
    subscriptionMiddleware(['BASIC', 'PRO', 'ENTERPRISE']),
    bannerController.generateBannerVariations
  );

  /**
   * @route GET /api/v1/banner/templates
   * @desc Get available banner templates
   * @access Private
   * @rateLimit Standard API limits
   */
  router.get('/templates',
    rateLimitMiddleware({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Templates API rate limit exceeded'
    }),
    bannerController.getTemplates
  );

  /**
   * @route GET /api/v1/banner/specs
   * @desc Get LinkedIn banner specifications
   * @access Private
   * @rateLimit Standard API limits
   */
  router.get('/specs',
    rateLimitMiddleware({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Specs API rate limit exceeded'
    }),
    bannerController.getSpecs
  );

  /**
   * @route POST /api/v1/banner/preview
   * @desc Preview banner prompt and settings (no image generation)
   * @access Private
   * @rateLimit Higher limits since no AI cost
   */
  router.post('/preview',
    rateLimitMiddleware({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50,
      message: 'Preview API rate limit exceeded'
    }),
    bannerController.previewPrompt
  );

  return router;
}

/**\n * Banner routes configuration\n * \n * Rate limiting strategy:\n * - Generate: High cost operation, subscription-based limits\n * - Variations: Premium feature, lower limits\n * - Templates/Specs: Low cost, higher limits\n * - Preview: No AI cost, moderate limits\n * \n * Subscription requirements:\n * - FREE: No banner generation\n * - BASIC: Basic banner generation\n * - PRO: Banner generation + variations\n * - ENTERPRISE: High limits on all features\n */"