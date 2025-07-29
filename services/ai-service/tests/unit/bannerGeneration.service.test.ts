import { BannerGenerationService } from '../../src/services/bannerGeneration.service';
import { OpenAIService } from '../../src/services/openai.service';
import { AIServiceConfig, BannerGenerationRequest, OpenAIError, RateLimitError, ValidationError } from '../../src/types';
import OpenAI from 'openai';

// Mock dependencies
jest.mock('openai');
jest.mock('../../src/services/openai.service');

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const MockedOpenAIService = OpenAIService as jest.MockedClass<typeof OpenAIService>;

describe('BannerGenerationService', () => {
  let service: BannerGenerationService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let config: AIServiceConfig;

  beforeEach(() => {
    config = {
      openaiApiKey: 'sk-test-key',
      model: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
      rateLimits: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000
      }
    };

    // Create mock OpenAI instance
    mockOpenAI = {
      images: {
        generate: jest.fn()
      }
    } as any;

    MockedOpenAI.mockImplementation(() => mockOpenAI);

    // Create mock OpenAI service
    mockOpenAIService = {
      generateStructuredResponse: jest.fn()
    } as any;

    MockedOpenAIService.mockImplementation(() => mockOpenAIService);

    service = new BannerGenerationService(config, mockOpenAIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBanner', () => {
    const mockRequest: BannerGenerationRequest = {
      industry: 'technology',
      branding: {
        companyName: 'TechCorp',
        role: 'Software Engineer',
        tagline: 'Innovation through code',
        primaryColor: '#0066CC'
      },
      textElements: ['Innovation', 'Technology'],
      colorScheme: 'blue-tech',
      style: 'natural',
      additionalContext: 'Focus on modern development'
    };

    const mockDALLEResponse = {
      created: Date.now(),
      data: [{
        url: 'https://test-image-url.com/generated-banner.png',
        revised_prompt: 'Professional LinkedIn banner for technology industry'
      }]
    };

    const mockAltTexts = [
      'Professional LinkedIn banner for TechCorp',
      'Technology industry banner with innovation theme',
      'Software Engineer professional branding banner'
    ];

    beforeEach(() => {
      mockOpenAI.images.generate.mockResolvedValue(mockDALLEResponse);
      mockOpenAIService.generateStructuredResponse.mockResolvedValue({
        data: mockAltTexts,
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75, cost: 0.003 }
      });
    });

    it('should generate banner successfully', async () => {
      const result = await service.generateBanner(mockRequest);

      expect(result).toMatchObject({
        id: expect.stringMatching(/^banner_\d+_[a-z0-9]+$/),
        imageUrl: 'https://test-image-url.com/generated-banner.png',
        imageData: expect.any(String),
        dimensions: {
          width: 1584,
          height: 396
        },
        format: 'PNG',
        fileSize: expect.any(Number),
        prompt: expect.stringContaining('Create a professional LinkedIn banner'),
        altTexts: mockAltTexts,
        metadata: {
          industry: 'technology',
          style: 'natural',
          generatedAt: expect.any(Date),
          dalleModel: 'dall-e-3',
          version: '1.0'
        },
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0.120 // HD quality 1792x1024 price
        },
        isLinkedInCompliant: true,
        qualityScore: expect.any(Number)
      });

      expect(mockOpenAI.images.generate).toHaveBeenCalledWith({
        model: "dall-e-3",
        prompt: expect.stringContaining('Create a professional LinkedIn banner'),
        size: "1792x1024",
        quality: "hd",
        style: "natural",
        response_format: "url",
        n: 1
      });
    });

    it('should include industry-specific elements in prompt', async () => {
      await service.generateBanner(mockRequest);

      const generatedPrompt = (mockOpenAI.images.generate as jest.Mock).mock.calls[0][0].prompt;
      
      expect(generatedPrompt).toContain('Industry: technology');
      expect(generatedPrompt).toContain('innovation, digital transformation, cutting-edge, modern');
      expect(generatedPrompt).toContain('geometric shapes, circuit patterns, clean lines');
      expect(generatedPrompt).toContain('forward-thinking and innovative');
    });

    it('should include branding information in prompt', async () => {
      await service.generateBanner(mockRequest);

      const generatedPrompt = (mockOpenAI.images.generate as jest.Mock).mock.calls[0][0].prompt;
      
      expect(generatedPrompt).toContain('Company: TechCorp');
      expect(generatedPrompt).toContain('Professional role: Software Engineer');
      expect(generatedPrompt).toContain('Tagline/message: Innovation through code');
      expect(generatedPrompt).toContain('Primary brand color: #0066CC');
    });

    it('should include text elements in prompt', async () => {
      await service.generateBanner(mockRequest);

      const generatedPrompt = (mockOpenAI.images.generate as jest.Mock).mock.calls[0][0].prompt;
      
      expect(generatedPrompt).toContain('Text to include: Innovation, Technology');
    });

    it('should handle minimal request', async () => {
      const minimalRequest: BannerGenerationRequest = {
        industry: 'finance'
      };

      const result = await service.generateBanner(minimalRequest);

      expect(result).toBeDefined();
      expect(result.metadata.industry).toBe('finance');
      
      const generatedPrompt = (mockOpenAI.images.generate as jest.Mock).mock.calls[0][0].prompt;
      expect(generatedPrompt).toContain('Industry: finance');
      expect(generatedPrompt).toContain('authoritative and trustworthy');
    });

    it('should throw ValidationError for invalid request', async () => {
      const invalidRequest = {} as BannerGenerationRequest;

      await expect(service.generateBanner(invalidRequest))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for long text elements', async () => {
      const invalidRequest: BannerGenerationRequest = {
        industry: 'technology',
        textElements: ['This is a very long text element that exceeds the 50 character limit and should be rejected']
      };

      await expect(service.generateBanner(invalidRequest))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for long tagline', async () => {
      const invalidRequest: BannerGenerationRequest = {
        industry: 'technology',
        branding: {
          tagline: 'This is an extremely long tagline that far exceeds the 100 character limit and should be rejected during validation because it would not fit properly on a LinkedIn banner and would make the design look cluttered and unprofessional'
        }
      };

      await expect(service.generateBanner(invalidRequest))
        .rejects.toThrow(ValidationError);
    });

    it('should throw OpenAIError when no image is generated', async () => {
      mockOpenAI.images.generate.mockResolvedValue({
        created: Date.now(),
        data: []
      });

      await expect(service.generateBanner(mockRequest))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw RateLimitError on 429 status', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockOpenAI.images.generate.mockRejectedValue(rateLimitError);

      await expect(service.generateBanner(mockRequest))
        .rejects.toThrow(RateLimitError);
    });

    it('should throw ValidationError on 400 status', async () => {
      const validationError = new Error('Invalid prompt');
      (validationError as any).status = 400;

      mockOpenAI.images.generate.mockRejectedValue(validationError);

      await expect(service.generateBanner(mockRequest))
        .rejects.toThrow(ValidationError);
    });

    it('should use fallback alt text when generation fails', async () => {
      mockOpenAIService.generateStructuredResponse.mockRejectedValue(new Error('Alt text generation failed'));

      const result = await service.generateBanner(mockRequest);

      expect(result.altTexts).toEqual([
        'Professional LinkedIn banner for TechCorp in technology'
      ]);
    });

    it('should calculate quality score correctly', async () => {
      const result = await service.generateBanner(mockRequest);
      
      // Quality score should be between 0-100
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      
      // Should get high score for complete request
      expect(result.qualityScore).toBeGreaterThan(80);
    });
  });

  describe('generateBannerVariations', () => {
    const mockRequest: BannerGenerationRequest = {
      industry: 'marketing',
      branding: { companyName: 'Creative Agency' }
    };

    const mockDALLEResponse = {
      created: Date.now(),
      data: [{
        url: 'https://test-image-url.com/variation.png',
        revised_prompt: 'Marketing banner variation'
      }]
    };

    beforeEach(() => {
      mockOpenAI.images.generate.mockResolvedValue(mockDALLEResponse);
      mockOpenAIService.generateStructuredResponse.mockResolvedValue({
        data: ['Alt text for variation'],
        usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45, cost: 0.002 }
      });
    });

    it('should generate multiple variations', async () => {
      const variations = await service.generateBannerVariations(mockRequest, 2);

      expect(variations).toHaveLength(2);
      variations.forEach((variation, index) => {
        expect(variation.id).toMatch(/^banner_\d+_[a-z0-9]+$/);
        expect(variation.metadata.industry).toBe('marketing');
      });

      expect(mockOpenAI.images.generate).toHaveBeenCalledTimes(2);
    });

    it('should add variation context to prompts', async () => {
      await service.generateBannerVariations(mockRequest, 2);

      const calls = (mockOpenAI.images.generate as jest.Mock).mock.calls;
      
      expect(calls[0][0].prompt).toContain('Variation 1');
      expect(calls[1][0].prompt).toContain('Variation 2');
    });

    it('should include delays between generations', async () => {
      const startTime = Date.now();
      
      await service.generateBannerVariations(mockRequest, 2);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 2 seconds due to delay (with some tolerance for execution time)
      expect(duration).toBeGreaterThan(1800);
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return all industry templates', () => {
      const templates = service.getAvailableTemplates();

      expect(templates).toHaveLength(6); // technology, finance, healthcare, marketing, education, consulting
      
      templates.forEach(template => {
        expect(template).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          industry: expect.any(String),
          colorSchemes: expect.any(Array),
          designElements: expect.any(Array),
          keywords: expect.any(Array),
          professionalTone: expect.any(String)
        });
      });
    });

    it('should include technology template', () => {
      const templates = service.getAvailableTemplates();
      const techTemplate = templates.find(t => t.id === 'technology');

      expect(techTemplate).toMatchObject({
        id: 'technology',
        name: 'Technology',
        industry: 'technology',
        keywords: ['innovation', 'digital transformation', 'cutting-edge', 'modern'],
        colorSchemes: ['blue-tech', 'purple-innovation', 'green-growth'],
        professionalTone: 'forward-thinking and innovative'
      });
    });

    it('should include finance template', () => {
      const templates = service.getAvailableTemplates();
      const financeTemplate = templates.find(t => t.id === 'finance');

      expect(financeTemplate).toMatchObject({
        id: 'finance',
        name: 'Finance',
        industry: 'finance',
        keywords: ['trust', 'stability', 'growth', 'professional'],
        colorSchemes: ['navy-trust', 'gold-premium', 'grey-professional'],
        professionalTone: 'authoritative and trustworthy'
      });
    });
  });

  describe('getLinkedInSpecs', () => {
    it('should return LinkedIn banner specifications', () => {
      const specs = service.getLinkedInSpecs();

      expect(specs).toEqual({
        width: 1584,
        height: 396,
        aspectRatio: 4,
        maxFileSize: 8 * 1024 * 1024,
        supportedFormats: ['PNG', 'JPEG', 'JPG'],
        dpi: 72,
        colorSpace: 'RGB'
      });
    });
  });

  describe('prompt generation', () => {
    it('should handle unknown industry gracefully', async () => {
      const unknownIndustryRequest: BannerGenerationRequest = {
        industry: 'unknown-industry'
      };

      const mockDALLEResponse = {
        created: Date.now(),
        data: [{
          url: 'https://test-image-url.com/unknown.png',
          revised_prompt: 'Generic professional banner'
        }]
      };

      mockOpenAI.images.generate.mockResolvedValue(mockDALLEResponse);
      mockOpenAIService.generateStructuredResponse.mockResolvedValue({
        data: ['Professional banner'],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30, cost: 0.001 }
      });

      const result = await service.generateBanner(unknownIndustryRequest);

      expect(result.metadata.industry).toBe('unknown-industry');
      expect(result.qualityScore).toBeLessThan(100); // Should get lower score for unknown industry
    });

    it('should handle all branding fields', async () => {
      const fullBrandingRequest: BannerGenerationRequest = {
        industry: 'consulting',
        branding: {
          companyName: 'Elite Consulting',
          role: 'Senior Partner',
          tagline: 'Strategic Excellence',
          primaryColor: '#000080',
          secondaryColor: '#GOLD',
          logo: 'https://example.com/logo.png'
        },
        colorScheme: 'grey-professional',
        additionalContext: 'Premium consulting firm'
      };

      const mockDALLEResponse = {
        created: Date.now(),
        data: [{
          url: 'https://test-image-url.com/consulting.png',
          revised_prompt: 'Consulting banner with premium branding'
        }]
      };

      mockOpenAI.images.generate.mockResolvedValue(mockDALLEResponse);
      mockOpenAIService.generateStructuredResponse.mockResolvedValue({
        data: ['Elite consulting banner'],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60, cost: 0.003 }
      });

      await service.generateBanner(fullBrandingRequest);

      const generatedPrompt = (mockOpenAI.images.generate as jest.Mock).mock.calls[0][0].prompt;
      
      expect(generatedPrompt).toContain('Company: Elite Consulting');
      expect(generatedPrompt).toContain('Professional role: Senior Partner');
      expect(generatedPrompt).toContain('Tagline/message: Strategic Excellence');
      expect(generatedPrompt).toContain('Primary brand color: #000080');
      expect(generatedPrompt).toContain('Color scheme preference: grey-professional');
      expect(generatedPrompt).toContain('Premium consulting firm');
    });
  });

  describe('cost calculation', () => {
    it('should calculate DALL-E 3 HD cost correctly', async () => {
      const mockRequest: BannerGenerationRequest = {
        industry: 'technology'
      };

      const mockDALLEResponse = {
        created: Date.now(),
        data: [{
          url: 'https://test-image-url.com/banner.png',
          revised_prompt: 'Technology banner'
        }]
      };

      mockOpenAI.images.generate.mockResolvedValue(mockDALLEResponse);
      mockOpenAIService.generateStructuredResponse.mockResolvedValue({
        data: ['Tech banner alt text'],
        usage: { promptTokens: 25, completionTokens: 12, totalTokens: 37, cost: 0.002 }
      });

      const result = await service.generateBanner(mockRequest);

      // DALL-E 3 HD 1792x1024 should cost $0.120
      expect(result.usage.cost).toBe(0.120);
    });
  });

  describe('validation', () => {
    it('should validate LinkedIn compliance', async () => {
      const mockRequest: BannerGenerationRequest = {
        industry: 'healthcare'
      };

      const mockDALLEResponse = {
        created: Date.now(),
        data: [{
          url: 'https://test-image-url.com/healthcare.png',
          revised_prompt: 'Healthcare professional banner'
        }]
      };

      mockOpenAI.images.generate.mockResolvedValue(mockDALLEResponse);
      mockOpenAIService.generateStructuredResponse.mockResolvedValue({
        data: ['Healthcare banner'],
        usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45, cost: 0.002 }
      });

      const result = await service.generateBanner(mockRequest);

      expect(result.isLinkedInCompliant).toBe(true);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle empty DALL-E response gracefully', async () => {
      const mockRequest: BannerGenerationRequest = {
        industry: 'education'
      };

      mockOpenAI.images.generate.mockResolvedValue({
        created: Date.now(),
        data: [{ url: undefined }] // No URL in response
      } as any);

      await expect(service.generateBanner(mockRequest))
        .rejects.toThrow(OpenAIError);
    });

    it('should handle generic errors', async () => {
      const mockRequest: BannerGenerationRequest = {
        industry: 'technology'
      };

      const genericError = new Error('Network error');
      mockOpenAI.images.generate.mockRejectedValue(genericError);

      await expect(service.generateBanner(mockRequest))
        .rejects.toThrow(OpenAIError);
    });

    it('should handle alt text generation with empty response', async () => {
      const mockRequest: BannerGenerationRequest = {
        industry: 'technology',
        branding: { companyName: 'TestCorp' }
      };

      const mockDALLEResponse = {
        created: Date.now(),
        data: [{
          url: 'https://test-image-url.com/banner.png',
          revised_prompt: 'Test banner'
        }]
      };

      mockOpenAI.images.generate.mockResolvedValue(mockDALLEResponse);
      mockOpenAIService.generateStructuredResponse.mockResolvedValue({
        data: null, // Empty response
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30, cost: 0.001 }
      } as any);

      const result = await service.generateBanner(mockRequest);

      expect(result.altTexts).toEqual(['Professional LinkedIn banner for TestCorp']);
    });
  });
});