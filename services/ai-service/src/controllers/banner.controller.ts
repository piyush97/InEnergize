import { Request, Response } from 'express';
import { BannerGenerationService } from '../services/bannerGeneration.service';
import { OpenAIService } from '../services/openai.service';
import { 
  BannerGenerationRequest,
  ValidationError,
  OpenAIError,
  RateLimitError,
  RequestWithUser 
} from '../types';
import Joi from 'joi';

export class BannerController {
  private bannerService: BannerGenerationService;

  constructor(openaiService: OpenAIService, config: any) {
    this.bannerService = new BannerGenerationService(config, openaiService);
  }

  /**
   * Generate a single LinkedIn banner
   */
  generateBanner = async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
      // Validate request
      const validatedRequest = await this.validateBannerRequest(req.body);
      
      // Add user context
      const requestWithUser = {
        ...validatedRequest,
        userId: req.user?.id
      };

      // Generate banner
      const result = await this.bannerService.generateBanner(requestWithUser);

      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          version: '1.0'
        }
      });

    } catch (error: any) {
      this.handleError(error, res);
    }
  };

  /**
   * Generate multiple banner variations
   */
  generateBannerVariations = async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
      // Validate request
      const schema = Joi.object({
        ...this.getBannerValidationSchema().describe().keys,
        count: Joi.number().integer().min(1).max(5).default(3)
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const { count, ...bannerRequest } = value;
      
      // Add user context
      const requestWithUser = {
        ...bannerRequest,
        userId: req.user?.id
      };

      // Generate variations
      const results = await this.bannerService.generateBannerVariations(requestWithUser, count);

      res.status(200).json({
        success: true,
        data: {
          variations: results,
          count: results.length,
          totalCost: results.reduce((sum, r) => sum + (r.usage.cost || 0), 0)
        },
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          version: '1.0'
        }
      });

    } catch (error: any) {
      this.handleError(error, res);
    }
  };

  /**
   * Get available banner templates
   */
  getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const templates = this.bannerService.getAvailableTemplates();
      
      res.status(200).json({
        success: true,
        data: {
          templates,
          count: templates.length
        },
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          version: '1.0'
        }
      });

    } catch (error: any) {
      this.handleError(error, res);
    }
  };

  /**
   * Get LinkedIn banner specifications
   */
  getSpecs = async (req: Request, res: Response): Promise<void> => {
    try {
      const specs = this.bannerService.getLinkedInSpecs();
      
      res.status(200).json({
        success: true,
        data: specs,
        metadata: {
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'unknown',
          version: '1.0'
        }
      });

    } catch (error: any) {
      this.handleError(error, res);
    }
  };

  /**
   * Preview banner prompt (without generating image)
   */
  previewPrompt = async (req: RequestWithUser, res: Response): Promise<void> => {
    try {
      // Validate request
      const validatedRequest = await this.validateBannerRequest(req.body);
      
      // Generate prompt using private method (we'll need to expose this)
      // For now, return a mock prompt structure
      const promptPreview = {
        industry: validatedRequest.industry,
        branding: validatedRequest.branding,
        textElements: validatedRequest.textElements,
        estimatedPrompt: `Professional LinkedIn banner for ${validatedRequest.industry} industry...`,
        estimatedCost: 0.12, // DALL-E 3 HD cost
        qualityFactors: {\n          industryAlignment: validatedRequest.industry ? 100 : 50,\n          brandingCompleteness: this.calculateBrandingScore(validatedRequest.branding),\n          textOptimization: validatedRequest.textElements?.length || 0 > 0 ? 100 : 75\n        }\n      };\n\n      res.status(200).json({\n        success: true,\n        data: promptPreview,\n        metadata: {\n          timestamp: new Date(),\n          requestId: req.headers['x-request-id'] || 'unknown',\n          version: '1.0'\n        }\n      });\n\n    } catch (error: any) {\n      this.handleError(error, res);\n    }\n  };\n\n  /**\n   * Validate banner generation request\n   */\n  private async validateBannerRequest(body: any): Promise<BannerGenerationRequest> {\n    const schema = this.getBannerValidationSchema();\n    \n    const { error, value } = schema.validate(body);\n    if (error) {\n      throw new ValidationError(error.details[0].message);\n    }\n\n    return value;\n  }\n\n  /**\n   * Get banner validation schema\n   */\n  private getBannerValidationSchema() {\n    return Joi.object({\n      industry: Joi.string().required().valid(\n        'technology', 'finance', 'healthcare', 'marketing', \n        'education', 'consulting', 'retail', 'manufacturing',\n        'real-estate', 'legal', 'non-profit', 'other'\n      ),\n      style: Joi.string().valid('natural', 'vivid').default('natural'),\n      branding: Joi.object({\n        companyName: Joi.string().max(50),\n        role: Joi.string().max(100),\n        tagline: Joi.string().max(100),\n        primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),\n        secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),\n        logoUrl: Joi.string().uri(),\n        websiteUrl: Joi.string().uri()\n      }).optional(),\n      textElements: Joi.array().items(\n        Joi.string().max(50)\n      ).max(3).optional(),\n      colorScheme: Joi.string().max(100).optional(),\n      additionalContext: Joi.string().max(500).optional()\n    });\n  }\n\n  /**\n   * Calculate branding completeness score\n   */\n  private calculateBrandingScore(branding?: any): number {\n    if (!branding) return 0;\n    \n    let score = 0;\n    if (branding.companyName) score += 25;\n    if (branding.role) score += 25;\n    if (branding.tagline) score += 25;\n    if (branding.primaryColor) score += 15;\n    if (branding.logoUrl) score += 10;\n    \n    return Math.min(100, score);\n  }\n\n  /**\n   * Handle errors consistently\n   */\n  private handleError(error: any, res: Response): void {\n    console.error('Banner Controller Error:', error);\n\n    if (error instanceof ValidationError) {\n      res.status(400).json({\n        success: false,\n        error: {\n          message: error.message,\n          code: 'VALIDATION_ERROR',\n          details: error.details\n        }\n      });\n      return;\n    }\n\n    if (error instanceof RateLimitError) {\n      res.status(429).json({\n        success: false,\n        error: {\n          message: error.message,\n          code: 'RATE_LIMIT_EXCEEDED',\n          details: error.details\n        }\n      });\n      return;\n    }\n\n    if (error instanceof OpenAIError) {\n      res.status(502).json({\n        success: false,\n        error: {\n          message: 'AI service temporarily unavailable',\n          code: 'AI_SERVICE_ERROR',\n          details: process.env.NODE_ENV === 'development' ? error.details : undefined\n        }\n      });\n      return;\n    }\n\n    // Generic error\n    res.status(500).json({\n      success: false,\n      error: {\n        message: 'Internal server error',\n        code: 'INTERNAL_ERROR',\n        details: process.env.NODE_ENV === 'development' ? error.message : undefined\n      }\n    });\n  }\n}"