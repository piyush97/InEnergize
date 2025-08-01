import { Request, Response } from 'express';
import { AIEnhancementEngine } from '../services/aiEnhancementEngine.service';
import { MLOptimizationService } from '../services/mlOptimization.service';
import { ComputerVisionService } from '../services/computerVision.service';
import { ContentGenerationService } from '../services/contentGeneration.service';
import { OpenAIService } from '../services/openai.service';
import { 
  ContentGenerationRequest,
  ContentType,
  AIRequestType,
  RequestWithUser,
  ServiceResponse,
  AIServiceError
} from '../types';
import { logger } from '../config/logger';
import { redis } from '../config/redis';

export class AIEnhancementController {
  private aiEnhancementEngine: AIEnhancementEngine;
  private mlOptimizationService: MLOptimizationService;
  private computerVisionService: ComputerVisionService;
  private contentGenerationService: ContentGenerationService;
  private openaiService: OpenAIService;

  constructor() {
    // Initialize services with enhanced configuration
    const enhancementConfig = {
      enablePerformanceOptimization: true,
      enablePredictiveAnalytics: true,
      enableIntelligentCaching: true,
      enableCostOptimization: true,
      enableAdvancedSafety: true,
      responseTimeTarget: 2000, // 2 seconds
      costReductionTarget: 50, // 50% cost reduction
      qualityThresholds: {
        engagement: 75,
        safety: 90,
        relevance: 80
      }
    };

    this.aiEnhancementEngine = new AIEnhancementEngine(enhancementConfig);
    this.mlOptimizationService = new MLOptimizationService();
    this.computerVisionService = new ComputerVisionService();
    
    this.openaiService = new OpenAIService({
      openaiApiKey: process.env.OPENAI_API_KEY!,
      maxTokens: 2000,
      temperature: 0.3,
      model: 'gpt-4o-mini',
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 10000
      }
    });

    this.contentGenerationService = new ContentGenerationService(this.openaiService);
  }

  /**
   * Enhanced content generation with ML optimization
   * POST /ai/enhanced/content/generate
   */
  async generateEnhancedContent(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { 
        type, 
        topic, 
        industry, 
        tone, 
        targetAudience, 
        keywords,
        enablePredictiveAnalytics = true,
        enableTemplateOptimization = true,
        targetPerformanceMetrics
      } = req.body;

      // Validate required fields
      if (!type || !topic) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Missing required fields: type and topic',
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      // Get user profile for optimization
      const userProfile = await this.getUserProfile(req.user!.id);
      
      // Create content generation request
      const contentRequest: ContentGenerationRequest = {
        type: type as ContentType,
        topic,
        industry: industry || userProfile.industry,
        tone,
        targetAudience,
        keywords,
        linkedinProfile: userProfile
      };

      // Generate enhanced content
      const result = await this.aiEnhancementEngine.generateEnhancedContent(
        contentRequest,
        userProfile,
        {
          enablePredictiveAnalytics,
          enableTemplateOptimization,
          targetPerformanceMetrics
        }
      );

      const response: ServiceResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);
      
      logger.info('Enhanced content generated successfully', {
        userId: req.user!.id,
        type,
        optimizations: result.optimizations,
        processingTime: result.metadata.processingTime
      });

    } catch (error: any) {
      logger.error('Enhanced content generation failed', { error, userId: req.user?.id });
      
      res.status(error instanceof AIServiceError ? 400 : 500).json({
        success: false,
        error: {
          message: error.message || 'Enhanced content generation failed',
          code: error.code || 'ENHANCEMENT_ERROR'
        }
      });
    }
  }

  /**
   * Advanced safety prediction and prevention
   * POST /ai/enhanced/safety/predict
   */
  async predictSafetyRisks(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { content, automationContext } = req.body;

      if (!content) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Content is required for safety analysis',
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      const userProfile = await this.getUserProfile(req.user!.id);
      
      const safetyAnalysis = await this.aiEnhancementEngine.performPredictiveSafetyAnalysis(
        content,
        userProfile,
        automationContext
      );

      const response: ServiceResponse = {
        success: true,
        data: safetyAnalysis,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);
      
      logger.info('Safety analysis completed', {
        userId: req.user!.id,
        riskScore: safetyAnalysis.overallRiskScore,
        riskFactors: safetyAnalysis.riskFactors.length
      });

    } catch (error: any) {
      logger.error('Safety prediction failed', { error, userId: req.user?.id });
      
      res.status(error instanceof AIServiceError ? 400 : 500).json({
        success: false,
        error: {
          message: error.message || 'Safety prediction failed',
          code: error.code || 'SAFETY_PREDICTION_ERROR'
        }
      });
    }
  }

  /**
   * ML-powered engagement prediction
   * POST /ai/enhanced/predict/engagement
   */
  async predictEngagement(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { content, contentType, targetAudience, includeOptimalTiming = true } = req.body;

      if (!content || !contentType) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Content and contentType are required',
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      const prediction = await this.mlOptimizationService.predictEngagement(
        req.user!.id,
        content,
        contentType,
        {
          includeOptimalTiming,
          includeAudienceInsights: true,
          targetAudience
        }
      );

      const response: ServiceResponse = {
        success: true,
        data: prediction,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Engagement prediction failed', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Engagement prediction failed',
          code: 'ENGAGEMENT_PREDICTION_ERROR'
        }
      });
    }
  }

  /**
   * Advanced computer vision analysis
   * POST /ai/enhanced/vision/analyze
   */
  async analyzeImage(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { imageUrl, analysisType, industry, options = {} } = req.body;

      if (!imageUrl || !analysisType) {
        res.status(400).json({
          success: false,
          error: {
            message: 'ImageUrl and analysisType are required',
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      let result;

      switch (analysisType) {
        case 'profile':
          result = await this.computerVisionService.analyzeProfileImage(
            imageUrl,
            industry,
            options
          );
          break;
        
        case 'banner':
          result = await this.computerVisionService.analyzeBannerImage(
            imageUrl,
            industry,
            options.brandColors,
            options
          );
          break;
        
        case 'engagement':
          result = await this.computerVisionService.predictImageEngagement(
            imageUrl,
            options.contentType || 'post',
            industry,
            options.targetAudience
          );
          break;
        
        case 'facial':
          result = await this.computerVisionService.analyzeFacialFeatures(
            imageUrl,
            options
          );
          break;
        
        case 'enhancement':
          result = await this.computerVisionService.generateImageEnhancements(
            imageUrl,
            options.targetQuality || 'professional'
          );
          break;
        
        default:
          res.status(400).json({
            success: false,
            error: {
              message: 'Invalid analysis type. Supported: profile, banner, engagement, facial, enhancement',
              code: 'INVALID_ANALYSIS_TYPE'
            }
          });
          return;
      }

      const response: ServiceResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Image analysis failed', { error, userId: req.user?.id });
      
      res.status(error instanceof AIServiceError ? 400 : 500).json({
        success: false,
        error: {
          message: error.message || 'Image analysis failed',
          code: error.code || 'IMAGE_ANALYSIS_ERROR'
        }
      });
    }
  }

  /**
   * A/B testing for content optimization
   * POST /ai/enhanced/ab-test/run
   */
  async runABTest(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { testType, variants, testDuration = 24, targetMetrics = ['engagement'] } = req.body;

      if (!testType || !variants || variants.length < 2) {
        res.status(400).json({
          success: false,
          error: {
            message: 'TestType and at least 2 variants are required',
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      let result;

      if (testType === 'content') {
        // Content A/B testing using ML optimization
        result = await this.mlOptimizationService.runABTest(
          `test_${Date.now()}`,
          variants,
          testDuration,
          { targetMetric: targetMetrics[0] }
        );
      } else if (testType === 'image') {
        // Image A/B testing using computer vision
        result = await this.computerVisionService.performImageABTest(
          variants,
          testDuration,
          targetMetrics
        );
      } else {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid test type. Supported: content, image',
            code: 'INVALID_TEST_TYPE'
          }
        });
        return;
      }

      const response: ServiceResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('A/B test failed', { error, userId: req.user?.id });
      
      res.status(error instanceof AIServiceError ? 400 : 500).json({
        success: false,
        error: {
          message: error.message || 'A/B test failed',
          code: error.code || 'AB_TEST_ERROR'
        }
      });
    }
  }

  /**
   * Cost optimization analysis and recommendations
   * GET /ai/enhanced/cost-optimization/:timeframe
   */
  async getCostOptimization(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { timeframe = 'month' } = req.params;

      if (!['week', 'month', 'quarter'].includes(timeframe)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid timeframe. Supported: week, month, quarter',
            code: 'INVALID_TIMEFRAME'
          }
        });
        return;
      }

      const report = await this.aiEnhancementEngine.generateCostOptimizationReport(
        req.user!.id,
        timeframe as 'week' | 'month' | 'quarter'
      );

      const response: ServiceResponse = {
        success: true,
        data: report,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Cost optimization report failed', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Cost optimization analysis failed',
          code: 'COST_OPTIMIZATION_ERROR'
        }
      });
    }
  }

  /**
   * Create intelligent templates for content optimization
   * POST /ai/enhanced/templates/create
   */
  async createIntelligentTemplate(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { 
        category,
        baseTemplate,
        industry,
        targetAudience = [],
        enableAIOptimization = true,
        performanceBenchmarks
      } = req.body;

      if (!category || !baseTemplate || !industry) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Category, baseTemplate, and industry are required',
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      const template = await this.aiEnhancementEngine.createIntelligentTemplate(
        category as ContentType,
        baseTemplate,
        industry,
        targetAudience,
        {
          enableAIOptimization,
          performanceBenchmarks
        }
      );

      const response: ServiceResponse = {
        success: true,
        data: template,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(201).json(response);

    } catch (error: any) {
      logger.error('Template creation failed', { error, userId: req.user?.id });
      
      res.status(error instanceof AIServiceError ? 400 : 500).json({
        success: false,
        error: {
          message: error.message || 'Template creation failed',
          code: error.code || 'TEMPLATE_CREATION_ERROR'
        }
      });
    }
  }

  /**
   * Get comprehensive performance analytics
   * GET /ai/enhanced/analytics/performance
   */
  async getPerformanceAnalytics(req: RequestWithUser, res: Response): Promise<void> {
    try {
      // Collect analytics from all AI services
      const enhancementAnalytics = this.aiEnhancementEngine.getPerformanceAnalytics();
      const mlAnalytics = this.mlOptimizationService.getPerformanceStats();
      const visionAnalytics = this.computerVisionService.getComputerVisionAnalytics();

      const aggregatedAnalytics = {
        enhancement: enhancementAnalytics,
        mlOptimization: mlAnalytics,
        computerVision: visionAnalytics,
        summary: {
          totalOperations: enhancementAnalytics.overallMetrics.totalRequests + 
                           visionAnalytics.totalAnalyses,
          avgResponseTime: (enhancementAnalytics.overallMetrics.avgResponseTime + 
                           visionAnalytics.avgProcessingTime) / 2,
          overallSuccessRate: (enhancementAnalytics.overallMetrics.successRate + 
                              visionAnalytics.successRate) / 2,
          costSavingsTotal: enhancementAnalytics.costSavings.totalSavings,
          qualityImprovementAvg: (enhancementAnalytics.qualityImprovements.engagementGains + 
                                 visionAnalytics.qualityImprovements) / 2,
          recommendations: [
            ...enhancementAnalytics.recommendations,
            ...visionAnalytics.recommendations
          ]
        }
      };

      const response: ServiceResponse = {
        success: true,
        data: aggregatedAnalytics,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Performance analytics failed', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Performance analytics failed',
          code: 'ANALYTICS_ERROR'
        }
      });
    }
  }

  /**
   * Generate personalized recommendations
   * POST /ai/enhanced/recommendations/generate
   */
  async generateRecommendations(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { 
        maxRecommendations = 10,
        focusAreas = [],
        timeframe = 'mixed'
      } = req.body;

      const recommendations = await this.mlOptimizationService.generateRecommendations(
        req.user!.id,
        {
          maxRecommendations,
          focusAreas,
          timeframe
        }
      );

      const response: ServiceResponse = {
        success: true,
        data: recommendations,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Recommendations generation failed', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Recommendations generation failed',
          code: 'RECOMMENDATIONS_ERROR'
        }
      });
    }
  }

  /**
   * Advanced sentiment analysis
   * POST /ai/enhanced/sentiment/analyze
   */
  async analyzeSentiment(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { 
        content,
        includeEmotions = true,
        includeThemes = true,
        targetAudience
      } = req.body;

      if (!content) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Content is required for sentiment analysis',
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      const analysis = await this.mlOptimizationService.analyzeSentiment(
        content,
        {
          includeEmotions,
          includeThemes,
          targetAudience
        }
      );

      const response: ServiceResponse = {
        success: true,
        data: analysis,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string || 'unknown',
          version: '1.0.0'
        }
      };

      res.status(200).json(response);

    } catch (error: any) {
      logger.error('Sentiment analysis failed', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Sentiment analysis failed',
          code: 'SENTIMENT_ANALYSIS_ERROR'
        }
      });
    }
  }

  // Private helper methods
  private async getUserProfile(userId: string): Promise<any> {
    try {
      // Try to get from cache first
      const cached = await redis.get(`user_profile:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Mock user profile - in production, this would fetch from database
      const mockProfile = {
        id: userId,
        industry: 'Technology',
        subscriptionLevel: 'PRO',
        positions: [{
          title: 'Software Engineer',
          companyName: 'Tech Corp',
          current: true
        }],
        skills: [
          { name: 'JavaScript' },
          { name: 'TypeScript' },
          { name: 'React' },
          { name: 'Node.js' },
          { name: 'Machine Learning' }
        ],
        firstName: { localized: { 'en_US': 'John' } },
        lastName: { localized: { 'en_US': 'Doe' } }
      };

      // Cache for 1 hour
      await redis.setex(`user_profile:${userId}`, 3600, JSON.stringify(mockProfile));
      
      return mockProfile;
    } catch (error) {
      logger.error('Failed to fetch user profile', { error, userId });
      
      // Return minimal profile as fallback
      return {
        id: userId,
        industry: 'General',
        subscriptionLevel: 'FREE',
        positions: [],
        skills: [],
        firstName: { localized: { 'en_US': 'User' } },
        lastName: { localized: { 'en_US': 'Profile' } }
      };
    }
  }
}