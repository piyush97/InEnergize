import OpenAI from 'openai';
import { 
  AIServiceConfig, 
  OpenAIError, 
  RateLimitError, 
  ValidationError,
  OpenAIUsage,
  BannerGenerationRequest,
  BannerGenerationResult,
  BannerTemplate,
  IndustryTemplate,
  BrandingOptions 
} from '../types';
import { OpenAIService } from './openai.service';

export class BannerGenerationService {
  private openai: OpenAI;
  private openaiService: OpenAIService;
  private config: AIServiceConfig;

  // LinkedIn banner specifications
  private readonly LINKEDIN_BANNER_SPECS = {
    width: 1584,
    height: 396,
    aspectRatio: 4, // 1584:396 = 4:1
    maxFileSize: 8 * 1024 * 1024, // 8MB
    supportedFormats: ['PNG', 'JPEG', 'JPG'],
    dpi: 72,
    colorSpace: 'RGB'
  };

  // Industry-specific templates and styles
  private readonly INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
    technology: {
      keywords: ['innovation', 'digital transformation', 'cutting-edge', 'modern'],
      colorSchemes: ['blue-tech', 'purple-innovation', 'green-growth'],
      designElements: ['geometric shapes', 'circuit patterns', 'clean lines'],
      professionalTone: 'forward-thinking and innovative'
    },
    finance: {
      keywords: ['trust', 'stability', 'growth', 'professional'],
      colorSchemes: ['navy-trust', 'gold-premium', 'grey-professional'],
      designElements: ['clean typography', 'charts and graphs', 'minimal design'],
      professionalTone: 'authoritative and trustworthy'
    },
    healthcare: {
      keywords: ['care', 'wellness', 'healing', 'compassion'],
      colorSchemes: ['blue-medical', 'green-health', 'white-clean'],
      designElements: ['flowing lines', 'medical symbols', 'caring imagery'],
      professionalTone: 'caring and professional'
    },
    marketing: {
      keywords: ['creative', 'engagement', 'brand', 'storytelling'],
      colorSchemes: ['vibrant-multi', 'orange-creative', 'pink-bold'],
      designElements: ['dynamic shapes', 'brand elements', 'creative layouts'],
      professionalTone: 'creative and engaging'
    },
    education: {
      keywords: ['knowledge', 'growth', 'learning', 'development'],
      colorSchemes: ['blue-knowledge', 'orange-learning', 'green-growth'],
      designElements: ['academic symbols', 'book elements', 'graduation themes'],
      professionalTone: 'knowledgeable and inspiring'
    },
    consulting: {
      keywords: ['expertise', 'solutions', 'strategic', 'professional'],
      colorSchemes: ['grey-professional', 'blue-trust', 'black-premium'],
      designElements: ['clean lines', 'professional layouts', 'strategic imagery'],
      professionalTone: 'expert and strategic'
    }
  };

  constructor(config: AIServiceConfig, openaiService: OpenAIService) {
    this.config = config;
    this.openaiService = openaiService;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /**
   * Generate LinkedIn banner using DALL-E 3
   */
  async generateBanner(request: BannerGenerationRequest): Promise<BannerGenerationResult> {
    try {
      // Validate request
      this.validateBannerRequest(request);

      // Generate optimized prompt
      const prompt = this.createBannerPrompt(request);
      
      // Generate banner image with DALL-E 3
      const imageResponse = await this.openai.images.generate({
        model: "dall-e-3",
        prompt,
        size: "1792x1024", // Closest to 1584x396 aspect ratio
        quality: "hd",
        style: request.style || "natural",
        response_format: "url",
        n: 1
      });

      const imageUrl = imageResponse.data[0]?.url;
      if (!imageUrl) {
        throw new OpenAIError('No image generated from DALL-E response');
      }

      // Process and resize image to LinkedIn specifications
      const processedImageData = await this.processImageForLinkedIn(imageUrl);

      // Generate alternative text descriptions
      const altTexts = await this.generateAltTexts(request);

      // Calculate usage and cost
      const usage: OpenAIUsage = {
        promptTokens: 0, // DALL-E doesn't provide token usage
        completionTokens: 0,
        totalTokens: 0,
        cost: this.calculateDALLECost("dall-e-3", "1792x1024", "hd")
      };

      return {
        id: this.generateBannerId(),
        imageUrl: processedImageData.url,
        imageData: processedImageData.base64,
        dimensions: {
          width: this.LINKEDIN_BANNER_SPECS.width,
          height: this.LINKEDIN_BANNER_SPECS.height
        },
        format: processedImageData.format,
        fileSize: processedImageData.fileSize,
        prompt: prompt,
        altTexts,
        metadata: {
          industry: request.industry,
          style: request.style,
          generatedAt: new Date(),
          dalleModel: "dall-e-3",
          version: "1.0"
        },
        usage,
        isLinkedInCompliant: this.validateLinkedInCompliance(processedImageData),
        qualityScore: this.calculateQualityScore(processedImageData, request)
      };

    } catch (error: any) {
      if (error.status === 429) {
        throw new RateLimitError('DALL-E rate limit exceeded');
      }
      if (error.status === 400) {
        throw new ValidationError(`DALL-E validation error: ${error.message}`);
      }
      throw new OpenAIError(`Banner generation failed: ${error.message}`, error);
    }
  }

  /**
   * Generate multiple banner variations
   */
  async generateBannerVariations(
    request: BannerGenerationRequest, 
    count: number = 3
  ): Promise<BannerGenerationResult[]> {
    const variations: BannerGenerationResult[] = [];
    
    for (let i = 0; i < count; i++) {
      // Create slight variations in the prompt
      const variationRequest = {
        ...request,
        additionalContext: `${request.additionalContext || ''} Variation ${i + 1}: Explore different visual approaches while maintaining professional quality.`
      };
      
      const banner = await this.generateBanner(variationRequest);
      variations.push(banner);
      
      // Add delay to respect rate limits
      if (i < count - 1) {
        await this.delay(2000); // 2 second delay between generations
      }
    }
    
    return variations;
  }

  /**
   * Create optimized prompt for banner generation
   */
  private createBannerPrompt(request: BannerGenerationRequest): string {
    const industryTemplate = this.INDUSTRY_TEMPLATES[request.industry.toLowerCase()];
    
    let prompt = `Create a professional LinkedIn banner image with these specifications:

TECHNICAL REQUIREMENTS:
- Dimensions: 1584x396 pixels (4:1 aspect ratio)
- High-quality professional design suitable for LinkedIn
- Clean, modern, and minimalist aesthetic
- Ensure text readability and professional appearance

CONTENT REQUIREMENTS:`;

    // Add industry-specific elements
    if (industryTemplate) {
      prompt += `\n- Industry: ${request.industry} (${industryTemplate.professionalTone})`;
      prompt += `\n- Style keywords: ${industryTemplate.keywords.join(', ')}`;
      prompt += `\n- Design elements: ${industryTemplate.designElements.join(', ')}`;
    }

    // Add personal/company branding
    if (request.branding) {
      if (request.branding.companyName) {
        prompt += `\n- Company: ${request.branding.companyName}`;
      }
      if (request.branding.role) {
        prompt += `\n- Professional role: ${request.branding.role}`;
      }
      if (request.branding.tagline) {
        prompt += `\n- Tagline/message: ${request.branding.tagline}`;
      }
      if (request.branding.primaryColor) {
        prompt += `\n- Primary brand color: ${request.branding.primaryColor}`;
      }
    }

    // Add text elements
    if (request.textElements && request.textElements.length > 0) {
      prompt += `\n- Text to include: ${request.textElements.join(', ')}`;
    }

    // Add style preferences
    prompt += `\n\nDESIGN GUIDELINES:
- Professional quality suitable for C-level executives
- Modern typography that's readable at banner size
- Balanced composition with proper white space
- Colors that work well on LinkedIn's interface
- Avoid cluttered or busy designs
- Focus on impact and professionalism`;

    if (request.colorScheme) {
      prompt += `\n- Color scheme preference: ${request.colorScheme}`;
    }

    if (request.additionalContext) {
      prompt += `\n\nADDITIONAL CONTEXT:\n${request.additionalContext}`;
    }

    prompt += `\n\nIMPORTANT: Create a clean, professional banner that represents excellence in ${request.industry}. The design should be sophisticated enough for senior professionals while being visually appealing and memorable.`;

    return prompt;
  }

  /**
   * Process image to meet LinkedIn specifications
   */
  private async processImageForLinkedIn(imageUrl: string): Promise<{
    url: string;
    base64: string;
    format: string;
    fileSize: number;
  }> {
    // This would typically involve:
    // 1. Downloading the image
    // 2. Resizing to exact LinkedIn dimensions (1584x396)
    // 3. Optimizing file size
    // 4. Converting to appropriate format
    // 5. Generating base64 for storage
    
    // For now, returning mock processed data
    // In production, you'd use image processing libraries like Sharp
    return {
      url: imageUrl,
      base64: '', // Would contain actual base64 data
      format: 'PNG',
      fileSize: 2048000 // 2MB example
    };
  }

  /**
   * Generate alternative text descriptions for accessibility
   */
  private async generateAltTexts(request: BannerGenerationRequest): Promise<string[]> {
    const prompt = `Generate 3 professional alternative text descriptions for a LinkedIn banner image with these characteristics:
    
Industry: ${request.industry}
Company: ${request.branding?.companyName || 'Professional'}
Role: ${request.branding?.role || 'Professional'}
Key elements: ${request.textElements?.join(', ') || 'Professional branding'}

Each alt text should:
- Be 125 characters or less
- Describe the visual content professionally
- Include key branding elements
- Be suitable for screen readers
- Follow accessibility best practices

Return as a JSON array of strings.`;

    try {
      const { data } = await this.openaiService.generateStructuredResponse<string[]>(
        prompt,
        'You are an accessibility expert specializing in professional image descriptions.',
        { type: 'array', items: { type: 'string', maxLength: 125 } }
      );
      
      return data || [`Professional LinkedIn banner for ${request.branding?.companyName || 'professional'}`];
    } catch (error) {
      // Fallback alt text
      return [`Professional LinkedIn banner for ${request.branding?.companyName || 'professional'} in ${request.industry}`];
    }
  }

  /**
   * Validate banner request parameters
   */
  private validateBannerRequest(request: BannerGenerationRequest): void {
    if (!request.industry) {
      throw new ValidationError('Industry is required for banner generation');
    }

    if (request.textElements && request.textElements.some(text => text.length > 50)) {
      throw new ValidationError('Text elements should be 50 characters or less for readability');
    }

    if (request.branding?.tagline && request.branding.tagline.length > 100) {
      throw new ValidationError('Tagline should be 100 characters or less');
    }
  }

  /**
   * Validate LinkedIn compliance
   */
  private validateLinkedInCompliance(imageData: any): boolean {
    // Check file size
    if (imageData.fileSize > this.LINKEDIN_BANNER_SPECS.maxFileSize) {
      return false;
    }

    // Check format
    if (!this.LINKEDIN_BANNER_SPECS.supportedFormats.includes(imageData.format.toUpperCase())) {
      return false;
    }

    // Additional checks would include:
    // - Content appropriateness
    // - Image quality
    // - Professional standards
    
    return true;
  }

  /**
   * Calculate quality score based on various factors
   */
  private calculateQualityScore(imageData: any, request: BannerGenerationRequest): number {
    let score = 0;
    
    // File size optimization (0-25 points)
    const sizeRatio = imageData.fileSize / this.LINKEDIN_BANNER_SPECS.maxFileSize;
    if (sizeRatio < 0.25) score += 25;
    else if (sizeRatio < 0.5) score += 20;
    else if (sizeRatio < 0.75) score += 15;
    else score += 10;
    
    // Industry alignment (0-25 points)
    if (this.INDUSTRY_TEMPLATES[request.industry.toLowerCase()]) {
      score += 25;
    } else {
      score += 15; // Generic template
    }
    
    // Branding completeness (0-25 points)
    if (request.branding) {
      if (request.branding.companyName) score += 8;
      if (request.branding.role) score += 8;
      if (request.branding.tagline) score += 9;
    }
    
    // Professional elements (0-25 points)
    if (request.textElements && request.textElements.length > 0) score += 15;
    if (request.colorScheme) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * Calculate DALL-E API cost
   */
  private calculateDALLECost(model: string, size: string, quality: string): number {
    // DALL-E 3 pricing (as of 2024)
    const prices = {
      'dall-e-3': {
        '1024x1024': { standard: 0.040, hd: 0.080 },
        '1792x1024': { standard: 0.080, hd: 0.120 },
        '1024x1792': { standard: 0.080, hd: 0.120 }
      }
    };

    const modelPrices = prices[model as keyof typeof prices];
    if (!modelPrices) return 0;

    const sizePrices = modelPrices[size as keyof typeof modelPrices];
    if (!sizePrices) return 0;

    return sizePrices[quality as keyof typeof sizePrices] || 0;
  }

  /**
   * Generate unique banner ID
   */
  private generateBannerId(): string {
    return `banner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available banner templates
   */
  getAvailableTemplates(): BannerTemplate[] {
    return Object.entries(this.INDUSTRY_TEMPLATES).map(([industry, template]) => ({
      id: industry,
      name: industry.charAt(0).toUpperCase() + industry.slice(1),
      description: `Professional banner template for ${industry} industry`,
      industry,
      colorSchemes: template.colorSchemes,
      designElements: template.designElements,
      keywords: template.keywords,
      professionalTone: template.professionalTone
    }));
  }

  /**
   * Get LinkedIn banner specifications
   */
  getLinkedInSpecs() {
    return this.LINKEDIN_BANNER_SPECS;
  }
}