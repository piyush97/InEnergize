import { Request, Response } from 'express';
import { OpenAIService } from '../services/openai.service';
import { ProfileOptimizationService } from '../services/profileOptimization.service';
import { ContentGenerationService } from '../services/contentGeneration.service';
import { MLOptimizationService } from '../services/mlOptimization.service';
import { ComputerVisionService } from '../services/computerVision.service';
import { NLPOptimizationService } from '../services/nlpOptimization.service';
import { AdvancedRecommendationEngineService } from '../services/advancedRecommendationEngine.service';
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
  private mlOptimizationService: MLOptimizationService;
  private computerVisionService: ComputerVisionService;
  private nlpOptimizationService: NLPOptimizationService;
  private recommendationEngineService: AdvancedRecommendationEngineService;

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
    this.mlOptimizationService = new MLOptimizationService();
    this.computerVisionService = new ComputerVisionService();
    this.nlpOptimizationService = new NLPOptimizationService();
    this.recommendationEngineService = new AdvancedRecommendationEngineService();
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
   * AI-Powered Automation Safety Scoring
   */
  async generateAutomationSafetyScore(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const safetyScore = await this.mlOptimizationService.generateAutomationSafetyScore(userId);
      
      await aiRateLimitService.incrementUsage(userId, 800);
      
      res.json({
        success: true,
        data: safetyScore,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Safety score generation failed');
    }
  }

  /**
   * Predictive Analytics for LinkedIn Engagement
   */
  async predictEngagement(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        content: Joi.string().required(),
        contentType: Joi.string().valid('post', 'article', 'carousel', 'video').required(),
        includeOptimalTiming: Joi.boolean().optional(),
        includeAudienceInsights: Joi.boolean().optional(),
        targetAudience: Joi.string().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const { content, contentType, includeOptimalTiming, includeAudienceInsights, targetAudience } = value;
      const userId = req.user!.id;
      
      const prediction = await this.mlOptimizationService.predictEngagement(
        userId, 
        content, 
        contentType,
        { includeOptimalTiming, includeAudienceInsights, targetAudience }
      );
      
      await aiRateLimitService.incrementUsage(userId, 1200);
      
      res.json({
        success: true,
        data: prediction,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Engagement prediction failed');
    }
  }

  /**
   * Advanced Content Optimization using NLP
   */
  async optimizeContentAdvanced(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        content: Joi.string().required(),
        targetAudience: Joi.string().optional(),
        industry: Joi.string().optional(),
        contentType: Joi.string().valid('post', 'article', 'comment', 'message').optional(),
        focusKeywords: Joi.array().items(Joi.string()).optional(),
        tone: Joi.string().valid('professional', 'casual', 'authoritative', 'friendly').optional(),
        maxLength: Joi.number().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const optimizationResult = await this.nlpOptimizationService.optimizeContent(
        value.content,
        {
          targetAudience: value.targetAudience,
          industry: value.industry,
          contentType: value.contentType,
          focusKeywords: value.focusKeywords,
          tone: value.tone,
          maxLength: value.maxLength
        }
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 1500);
      
      res.json({
        success: true,
        data: optimizationResult,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Advanced content optimization failed');
    }
  }

  /**
   * Profile Image Analysis using Computer Vision
   */
  async analyzeProfileImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        imageUrl: Joi.string().uri().required(),
        userIndustry: Joi.string().optional(),
        includeCompetitorAnalysis: Joi.boolean().optional(),
        targetRole: Joi.string().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const analysis = await this.computerVisionService.analyzeProfileImage(
        value.imageUrl,
        value.userIndustry,
        {
          includeCompetitorAnalysis: value.includeCompetitorAnalysis,
          targetRole: value.targetRole
        }
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 1000);
      
      res.json({
        success: true,
        data: analysis,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Profile image analysis failed');
    }
  }

  /**
   * Advanced Sentiment Analysis
   */
  async performSentimentAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        content: Joi.string().required(),
        includeEmotions: Joi.boolean().optional(),
        industryContext: Joi.string().optional(),
        targetAudience: Joi.string().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const sentimentAnalysis = await this.nlpOptimizationService.performAdvancedSentimentAnalysis(
        value.content,
        {
          includeEmotions: value.includeEmotions,
          industryContext: value.industryContext,
          targetAudience: value.targetAudience
        }
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 600);
      
      res.json({
        success: true,
        data: sentimentAnalysis,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Sentiment analysis failed');
    }
  }

  /**
   * Generate Intelligent Connection Recommendations
   */
  async generateConnectionRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        maxRecommendations: Joi.number().min(1).max(20).optional(),
        industryFocus: Joi.array().items(Joi.string()).optional(),
        geographicPreference: Joi.array().items(Joi.string()).optional(),
        connectionGoals: Joi.array().items(Joi.string()).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const recommendations = await this.recommendationEngineService.generateConnectionRecommendations(
        req.user!.id,
        value
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 1800);
      
      res.json({
        success: true,
        data: recommendations,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Connection recommendations failed');
    }
  }

  /**
   * Generate Strategic Content Recommendations
   */
  async generateContentRecommendations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        contentTypes: Joi.array().items(Joi.string()).optional(),
        industryFocus: Joi.string().optional(),
        targetAudience: Joi.string().optional(),
        contentGoals: Joi.array().items(Joi.string()).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const recommendations = await this.recommendationEngineService.generateContentRecommendations(
        req.user!.id,
        value
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 1600);
      
      res.json({
        success: true,
        data: recommendations,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Content recommendations failed');
    }
  }

  /**
   * Create Personalized Growth Plan
   */
  async createGrowthPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        timeframe: Joi.string().valid('30d', '90d', '180d', '365d').optional(),
        goals: Joi.object({
          networkGrowth: Joi.number().optional(),
          profileViews: Joi.number().optional(),
          engagementRate: Joi.number().optional(),
          thoughtLeadership: Joi.number().optional()
        }).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const growthPlan = await this.recommendationEngineService.createPersonalizedGrowthPlan(
        req.user!.id,
        value.timeframe || '90d',
        value.goals
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 2000);
      
      res.json({
        success: true,
        data: growthPlan,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Growth plan creation failed');
    }
  }

  /**
   * Run A/B Tests for Content Optimization
   */
  async runABTest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = Joi.object({
        testId: Joi.string().required(),
        variants: Joi.array().items(
          Joi.object({
            id: Joi.string().required(),
            content: Joi.string().required()
          })
        ).min(2).required(),
        testDuration: Joi.number().min(1).max(168).optional(), // 1 hour to 1 week
        targetMetric: Joi.string().valid('engagement', 'clicks', 'conversions', 'reach').optional(),
        minimumSampleSize: Joi.number().optional(),
        confidenceLevel: Joi.number().min(0.8).max(0.99).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const abTestResult = await this.mlOptimizationService.runABTest(
        value.testId,
        value.variants,
        value.testDuration,
        {
          targetMetric: value.targetMetric,
          minimumSampleSize: value.minimumSampleSize,
          confidenceLevel: value.confidenceLevel
        }
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 1000);
      
      res.json({
        success: true,
        data: abTestResult,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'A/B test creation failed');
    }
  }

  /**
   * ML Model Performance Optimization
   */
  async optimizeModelPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Only available for ENTERPRISE users
      if (req.user!.subscriptionLevel !== 'ENTERPRISE') {
        throw new ValidationError('Model optimization requires ENTERPRISE subscription');
      }

      const schema = Joi.object({
        modelId: Joi.string().required(),
        trainingData: Joi.array().required(),
        targetMetric: Joi.string().valid('accuracy', 'speed', 'cost', 'balanced').optional(),
        optimizationBudget: Joi.number().optional(),
        useAdvancedTechniques: Joi.boolean().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const optimizationResult = await this.mlOptimizationService.optimizeModelPerformance(
        value.modelId,
        value.trainingData,
        {
          targetMetric: value.targetMetric,
          optimizationBudget: value.optimizationBudget,
          useAdvancedTechniques: value.useAdvancedTechniques
        }
      );
      
      await aiRateLimitService.incrementUsage(req.user!.id, 3000);
      
      res.json({
        success: true,
        data: optimizationResult,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          version: '1.0'
        }
      });
    } catch (error: any) {
      this.handleError(res, error, 'Model optimization failed');
    }
  }

  /**
   * Get available features for subscription level
   */
  private getAvailableFeatures(subscriptionLevel: string): string[] {
    const features = {
      FREE: ['profile_optimization', 'basic_content_generation', 'sentiment_analysis'],
      BASIC: ['profile_optimization', 'content_generation', 'headline_generation', 'sentiment_analysis', 'basic_recommendations'],
      PRO: [
        'profile_optimization', 'content_generation', 'headline_generation', 'summary_generation', 
        'skill_suggestions', 'custom_prompts', 'advanced_sentiment_analysis', 'content_optimization',
        'engagement_prediction', 'connection_recommendations', 'content_recommendations', 
        'profile_image_analysis', 'growth_planning', 'ab_testing'
      ],
      ENTERPRISE: [
        'profile_optimization', 'content_generation', 'headline_generation', 'summary_generation',
        'skill_suggestions', 'custom_prompts', 'banner_generation', 'advanced_analytics',
        'automation_safety_scoring', 'ml_model_optimization', 'computer_vision_analysis',
        'advanced_nlp', 'predictive_analytics', 'advanced_recommendations', 'industry_insights',
        'competitive_analysis', 'personalized_growth_plans', 'advanced_ab_testing'
      ]
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