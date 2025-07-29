import { Request, Response } from 'express';
import { OpenAIService } from '../services/openai.service';
import { ProfileOptimizationService } from '../services/profileOptimization.service';
import { ContentGenerationService } from '../services/contentGeneration.service';
import { aiRateLimitService } from '../middleware/aiRateLimit.middleware';
import {
  AIServiceConfig,
  AIRequestType,
  ProfileOptimizationRequest,
  HeadlineGenerationRequest,
  SummaryGenerationRequest,
  SkillSuggestionRequest,
  ContentGenerationRequest,
  ServiceResponse,
  AIServiceError,
  ValidationError,
  RateLimitError
} from '../types';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import Joi from 'joi';

export class AIController {
  private openaiService: OpenAIService;
  private profileOptimizationService: ProfileOptimizationService;
  private contentGenerationService: ContentGenerationService;

  constructor() {
    const config: AIServiceConfig = {
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      model: process.env.OPENAI_MODEL || 'gpt-4',
      rateLimits: {
        requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '10'),
        requestsPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR || '100'),
        requestsPerDay: parseInt(process.env.RATE_LIMIT_PER_DAY || '500')
      }
    };

    this.openaiService = new OpenAIService(config);
    this.profileOptimizationService = new ProfileOptimizationService(this.openaiService);
    this.contentGenerationService = new ContentGenerationService(this.openaiService);
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const openaiHealthy = await this.openaiService.validateConnection();
      const redisHealthy = await aiRateLimitService.healthCheck();

      res.json({
        success: true,
        data: {
          service: 'AI Service',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          checks: {
            openai: openaiHealthy ? 'healthy' : 'unhealthy',
            redis: redisHealthy ? 'healthy' : 'unhealthy'
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Health check failed',
          code: 'HEALTH_CHECK_FAILED',
          details: error.message
        }
      });
    }
  }

  /**
   * Get AI service capabilities and limits
   */
  async getCapabilities(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const config = aiRateLimitService.getConfigForSubscription(user.subscriptionLevel);
      const usageStats = await aiRateLimitService.getUsageStats(user.id);

      res.json({
        success: true,
        data: {
          subscriptionLevel: user.subscriptionLevel,
          limits: config,
          usage: usageStats,
          availableFeatures: this.getAvailableFeatures(user.subscriptionLevel),
          models: await this.openaiService.getAvailableModels()
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Failed to get AI capabilities');
    }
  }

  /**
   * Optimize LinkedIn profile
   */
  async optimizeProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request
      const schema = Joi.object({
        linkedinProfile: Joi.object().required(),
        completenessData: Joi.object().required(),
        targetRole: Joi.string().optional(),
        industry: Joi.string().optional(),
        careerLevel: Joi.string().valid('entry', 'mid', 'senior', 'executive').optional(),
        goals: Joi.array().items(Joi.string()).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const request: ProfileOptimizationRequest = value;
      const response = await this.profileOptimizationService.optimizeProfile(request);

      // Track usage
      await aiRateLimitService.incrementUsage(req.user!.id, 2000); // Estimate token usage

      res.json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Profile optimization failed');
    }
  }

  /**
   * Generate LinkedIn headlines
   */
  async generateHeadlines(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        linkedinProfile: Joi.object().required(),
        targetRole: Joi.string().optional(),
        industry: Joi.string().optional(),
        keywords: Joi.array().items(Joi.string()).optional(),
        tone: Joi.string().valid('professional', 'creative', 'results-focused').optional(),
        includeMetrics: Joi.boolean().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const request: HeadlineGenerationRequest = value;
      const response = await this.profileOptimizationService.generateHeadlines(request);

      await aiRateLimitService.incrementUsage(req.user!.id, 1000);

      res.json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Headline generation failed');
    }
  }

  /**
   * Generate LinkedIn summaries
   */
  async generateSummaries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        linkedinProfile: Joi.object().required(),
        targetRole: Joi.string().optional(),
        achievements: Joi.array().items(Joi.string()).optional(),
        careerGoals: Joi.array().items(Joi.string()).optional(),
        personalBrand: Joi.string().optional(),
        tone: Joi.string().valid('narrative', 'bullet-points', 'achievement-focused').optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const request: SummaryGenerationRequest = value;
      const response = await this.profileOptimizationService.generateSummaries(request);

      await aiRateLimitService.incrementUsage(req.user!.id, 1500);

      res.json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Summary generation failed');
    }
  }

  /**
   * Suggest relevant skills
   */
  async suggestSkills(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        linkedinProfile: Joi.object().required(),
        targetRole: Joi.string().optional(),
        industry: Joi.string().optional(),
        includeEmerging: Joi.boolean().optional(),
        maxSuggestions: Joi.number().min(1).max(20).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const request: SkillSuggestionRequest = value;
      const response = await this.profileOptimizationService.suggestSkills(request);

      await aiRateLimitService.incrementUsage(req.user!.id, 1200);

      res.json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Skill suggestion failed');
    }
  }

  /**
   * Generate content (posts, articles, etc.)
   */
  async generateContent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        type: Joi.string().valid(
          'linkedin_post',
          'article',
          'carousel_slide',
          'comment',
          'connection_message',
          'thank_you_message'
        ).required(),
        topic: Joi.string().optional(),
        industry: Joi.string().optional(),
        tone: Joi.string().optional(),
        targetAudience: Joi.string().optional(),
        keywords: Joi.array().items(Joi.string()).optional(),
        linkedinProfile: Joi.object().optional(),
        customPrompt: Joi.string().max(2000).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const request: ContentGenerationRequest = value;
      const response = await this.contentGenerationService.generateContent(request);

      await aiRateLimitService.incrementUsage(req.user!.id, 1800);

      res.json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Content generation failed');
    }
  }

  /**
   * Get user's AI usage statistics
   */
  async getUsageStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const stats = await aiRateLimitService.getUsageStats(userId);
      const config = aiRateLimitService.getConfigForSubscription(req.user!.subscriptionLevel);

      res.json({
        success: true,
        data: {
          usage: stats,
          limits: config,
          subscriptionLevel: req.user!.subscriptionLevel,
          upgradeRecommended: stats.requestsInWindow > (config?.maxRequests || 0) * 0.8
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Failed to get usage statistics');
    }
  }

  /**
   * Custom AI prompt (for advanced users)
   */
  async customPrompt(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only available for PRO and ENTERPRISE users
      if (!['PRO', 'ENTERPRISE'].includes(req.user!.subscriptionLevel)) {
        throw new ValidationError('Custom prompts require PRO or ENTERPRISE subscription');
      }

      const schema = Joi.object({
        prompt: Joi.string().min(10).max(2000).required(),
        systemMessage: Joi.string().max(1000).optional(),
        maxTokens: Joi.number().min(100).max(4000).optional(),
        temperature: Joi.number().min(0).max(2).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const { prompt, systemMessage, maxTokens, temperature } = value;

      const response = await this.openaiService.generateCompletion(
        prompt,
        systemMessage,
        {
          maxTokens,
          temperature,
          userId: req.user!.id
        }
      );

      await aiRateLimitService.incrementUsage(req.user!.id, response.usage.totalTokens);

      res.json({
        success: true,
        data: {
          content: response.content,
          usage: response.usage
        },
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Custom prompt failed');
    }
  }

  /**
   * Get available features for subscription level
   */
  private getAvailableFeatures(subscriptionLevel: string): string[] {
    const features = {
      FREE: ['profile_optimization', 'basic_content_generation'],
      BASIC: ['profile_optimization', 'content_generation', 'headline_generation'],
      PRO: ['profile_optimization', 'content_generation', 'headline_generation', 'summary_generation', 'skill_suggestions', 'custom_prompts'],
      ENTERPRISE: ['profile_optimization', 'content_generation', 'headline_generation', 'summary_generation', 'skill_suggestions', 'custom_prompts', 'banner_generation', 'advanced_analytics']
    };

    return features[subscriptionLevel as keyof typeof features] || features.FREE;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle errors consistently
   */
  private handleError(res: Response, error: any, defaultMessage: string): void {
    console.error('AI Controller Error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      });
    } else if (error instanceof RateLimitError) {
      res.status(429).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      });
    } else if (error instanceof AIServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: defaultMessage,
          code: 'INTERNAL_SERVER_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
}