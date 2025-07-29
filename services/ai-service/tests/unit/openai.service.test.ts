import { OpenAIService } from '../../src/services/openai.service';
import { AIServiceConfig, OpenAIError, RateLimitError, ValidationError } from '../../src/types';
import OpenAI from 'openai';

// Mock the OpenAI module
jest.mock('openai');

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockOpenAI: jest.Mocked<OpenAI>;
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

    // Create a mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      models: {
        list: jest.fn()
      }
    } as any;

    MockedOpenAI.mockImplementation(() => mockOpenAI);
    service = new OpenAIService(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCompletion', () => {
    const mockCompletion = {
      id: 'chatcmpl-test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: 'This is a test response from GPT-4'
        },
        finish_reason: 'stop' as const
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      },
      created: Date.now(),
      model: 'gpt-4',
      object: 'chat.completion' as const
    };

    it('should generate completion successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await service.generateCompletion(
        'Test prompt',
        'Test system message',
        { userId: 'user-123' }
      );

      expect(result).toEqual({
        content: 'This is a test response from GPT-4',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.00675 // 150 * 0.045 / 1000
        }
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Test system message' },
          { role: 'user', content: 'Test prompt' }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: "text" }
      });
    });

    it('should generate completion without system message', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      await service.generateCompletion('Test prompt');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Test prompt' }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: "text" }
      });
    });

    it('should use custom options when provided', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      await service.generateCompletion(
        'Test prompt',
        'System message',
        {
          maxTokens: 500,
          temperature: 0.9,
          model: 'gpt-3.5-turbo',
          userId: 'user-456'
        }
      );

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'System message' },
          { role: 'user', content: 'Test prompt' }
        ],
        max_tokens: 500,
        temperature: 0.9,
        response_format: { type: "text" }
      });
    });

    it('should throw OpenAIError when no content is generated', async () => {
      const emptyCompletion = {
        ...mockCompletion,
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: null
          },
          finish_reason: 'stop' as const
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(emptyCompletion as any);

      await expect(service.generateCompletion('Test prompt'))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw RateLimitError on 429 status', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      await expect(service.generateCompletion('Test prompt'))
        .rejects.toThrow(RateLimitError);
    });

    it('should throw ValidationError on 400 status', async () => {
      const validationError = new Error('Invalid request');
      (validationError as any).status = 400;

      mockOpenAI.chat.completions.create.mockRejectedValue(validationError);

      await expect(service.generateCompletion('Test prompt'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw OpenAIError on other errors', async () => {
      const genericError = new Error('Generic API error');
      (genericError as any).status = 500;

      mockOpenAI.chat.completions.create.mockRejectedValue(genericError);

      await expect(service.generateCompletion('Test prompt'))
        .rejects.toThrow(OpenAIError);
    });
  });

  describe('generateVariations', () => {
    const mockCompletion = {
      id: 'chatcmpl-test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: 'Variation content'
        },
        finish_reason: 'stop' as const
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      },
      created: Date.now(),
      model: 'gpt-4',
      object: 'chat.completion' as const
    };

    it('should generate multiple variations successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await service.generateVariations(
        'Test prompt',
        'System message',
        3,
        { userId: 'user-123' }
      );

      expect(result.variations).toHaveLength(3);
      expect(result.variations).toEqual([
        'Variation content',
        'Variation content',
        'Variation content'
      ]);

      expect(result.totalUsage).toEqual({
        promptTokens: 300, // 100 * 3
        completionTokens: 150, // 50 * 3
        totalTokens: 450, // 150 * 3
        cost: 0.02025 // (150 * 0.045 / 1000) * 3
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it('should use different temperatures for variations', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      await service.generateVariations(
        'Test prompt',
        'System message',
        2,
        { temperature: 0.5 }
      );

      expect(mockOpenAI.chat.completions.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ temperature: 0.5 })
      );
      expect(mockOpenAI.chat.completions.create).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ temperature: 0.6 })
      );
    });

    it('should handle errors in one variation gracefully', async () => {
      const error = new Error('API error');
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(mockCompletion)
        .mockRejectedValueOnce(error);

      await expect(service.generateVariations('Test prompt', 'System message', 2))
        .rejects.toThrow('API error');
    });
  });

  describe('generateStructuredResponse', () => {
    const mockCompletion = {
      id: 'chatcmpl-test',
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: '{"name": "John Doe", "age": 30}'
        },
        finish_reason: 'stop' as const
      }],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 75,
        total_tokens: 225
      },
      created: Date.now(),
      model: 'gpt-4',
      object: 'chat.completion' as const
    };

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      }
    };

    it('should generate structured JSON response successfully', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await service.generateStructuredResponse<{name: string, age: number}>(
        'Generate person data',
        'System message',
        schema
      );

      expect(result.data).toEqual({ name: 'John Doe', age: 30 });
      expect(result.usage.totalTokens).toBe(225);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'System message' },
            { 
              role: 'user', 
              content: expect.stringContaining('Generate person data') && 
                      expect.stringContaining(JSON.stringify(schema, null, 2))
            }
          ]
        })
      );
    });

    it('should extract JSON from mixed content response', async () => {
      const mixedContentCompletion = {
        ...mockCompletion,
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Here is the requested data: {"name": "Jane Doe", "age": 25} as you can see.'
          },
          finish_reason: 'stop' as const
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mixedContentCompletion);

      const result = await service.generateStructuredResponse<{name: string, age: number}>(
        'Generate person data',
        'System message',
        schema
      );

      expect(result.data).toEqual({ name: 'Jane Doe', age: 25 });
    });

    it('should throw ValidationError for invalid JSON', async () => {
      const invalidJsonCompletion = {
        ...mockCompletion,
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'This is not valid JSON content'
          },
          finish_reason: 'stop' as const
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(invalidJsonCompletion);

      await expect(service.generateStructuredResponse('Generate data', 'System', schema))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('rate limiting', () => {
    it('should track rate limits per user', async () => {
      const mockCompletion = {
        id: 'chatcmpl-test',
        choices: [{ index: 0, message: { role: 'assistant' as const, content: 'Response' }, finish_reason: 'stop' as const }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        created: Date.now(),
        model: 'gpt-4',
        object: 'chat.completion' as const
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await service.generateCompletion('Test', undefined, { userId: 'user-123' });
      }

      // Next request should trigger rate limit
      await expect(service.generateCompletion('Test', undefined, { userId: 'user-123' }))
        .rejects.toThrow(RateLimitError);
    });

    it('should reset rate limits after time window', async () => {
      const mockCompletion = {
        id: 'chatcmpl-test',
        choices: [{ index: 0, message: { role: 'assistant' as const, content: 'Response' }, finish_reason: 'stop' as const }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        created: Date.now(),
        model: 'gpt-4',
        object: 'chat.completion' as const
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      // Make maximum requests
      for (let i = 0; i < 10; i++) {
        await service.generateCompletion('Test', undefined, { userId: 'user-123' });
      }

      // Fast forward time by 2 minutes to reset the rate limit
      jest.advanceTimersByTime(2 * 60 * 1000);

      // Should be able to make request again
      await expect(service.generateCompletion('Test', undefined, { userId: 'user-123' }))
        .resolves.toBeDefined();
    });

    it('should return correct rate limit status', () => {
      const status = service.getRateLimitStatus('new-user');
      expect(status.remaining).toBe(10);
      expect(status.resetTime).toBeNull();
    });
  });

  describe('validateConnection', () => {
    it('should return true for valid connection', async () => {
      mockOpenAI.models.list.mockResolvedValue({ data: [] } as any);

      const result = await service.validateConnection();
      expect(result).toBe(true);
    });

    it('should return false for invalid connection', async () => {
      mockOpenAI.models.list.mockRejectedValue(new Error('Unauthorized'));

      const result = await service.validateConnection();
      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return filtered GPT models', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4', object: 'model' },
          { id: 'gpt-3.5-turbo', object: 'model' },
          { id: 'davinci-002', object: 'model' },
          { id: 'gpt-4-vision-preview', object: 'model' }
        ]
      };

      mockOpenAI.models.list.mockResolvedValue(mockModels as any);

      const result = await service.getAvailableModels();
      expect(result).toEqual([
        'gpt-3.5-turbo',
        'gpt-4',
        'gpt-4-vision-preview'
      ]);
    });

    it('should throw OpenAIError on failure', async () => {
      mockOpenAI.models.list.mockRejectedValue(new Error('API error'));

      await expect(service.getAvailableModels())
        .rejects.toThrow(OpenAIError);
    });
  });

  describe('cleanupRateLimits', () => {
    it('should remove expired rate limit entries', async () => {
      const mockCompletion = {
        id: 'chatcmpl-test',
        choices: [{ index: 0, message: { role: 'assistant' as const, content: 'Response' }, finish_reason: 'stop' as const }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        created: Date.now(),
        model: 'gpt-4',
        object: 'chat.completion' as const
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      // Create rate limit entry
      await service.generateCompletion('Test', undefined, { userId: 'user-123' });

      // Verify entry exists
      let status = service.getRateLimitStatus('user-123');
      expect(status.remaining).toBe(9);

      // Fast forward time and cleanup
      jest.advanceTimersByTime(2 * 60 * 1000);
      service.cleanupRateLimits();

      // Entry should be cleaned up
      status = service.getRateLimitStatus('user-123');
      expect(status.remaining).toBe(10);
      expect(status.resetTime).toBeNull();
    });
  });

  describe('createSystemMessage', () => {
    it('should create basic system message', () => {
      const result = service.createSystemMessage({});
      
      expect(result).toContain('You are an expert LinkedIn optimization AI assistant');
      expect(result).toContain('Maintain strict compliance with LinkedIn\'s terms of service');
    });

    it('should include role context', () => {
      const result = service.createSystemMessage({ role: 'Software Engineer' });
      
      expect(result).toContain('helping someone in the Software Engineer role');
    });

    it('should include industry context', () => {
      const result = service.createSystemMessage({ industry: 'Technology' });
      
      expect(result).toContain('They work in the Technology industry');
    });

    it('should include tone specification', () => {
      const result = service.createSystemMessage({ tone: 'professional' });
      
      expect(result).toContain('Use a professional tone');
    });

    it('should include constraints', () => {
      const constraints = ['Keep responses under 500 words', 'Focus on technical skills'];
      const result = service.createSystemMessage({ constraints });
      
      expect(result).toContain('Additional constraints:');
      expect(result).toContain('- Keep responses under 500 words');
      expect(result).toContain('- Focus on technical skills');
    });

    it('should combine all context elements', () => {
      const context = {
        role: 'Data Scientist',
        industry: 'Healthcare',
        tone: 'friendly yet professional',
        constraints: ['Include data-driven insights']
      };

      const result = service.createSystemMessage(context);
      
      expect(result).toContain('Data Scientist role');
      expect(result).toContain('Healthcare industry');
      expect(result).toContain('friendly yet professional tone');
      expect(result).toContain('Include data-driven insights');
    });
  });

  describe('cost calculation', () => {
    it('should calculate cost correctly', async () => {
      const mockCompletion = {
        id: 'chatcmpl-test',
        choices: [{ index: 0, message: { role: 'assistant' as const, content: 'Response' }, finish_reason: 'stop' as const }],
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
        created: Date.now(),
        model: 'gpt-4',
        object: 'chat.completion' as const
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockCompletion);

      const result = await service.generateCompletion('Test prompt');
      
      // 1500 tokens * $0.045 per 1K tokens = $0.0675
      expect(result.usage.cost).toBe(0.0675);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle completion with zero usage tokens', async () => {
      const zeroUsageCompletion = {
        id: 'chatcmpl-test',
        choices: [{ index: 0, message: { role: 'assistant' as const, content: 'Response' }, finish_reason: 'stop' as const }],
        usage: undefined, // No usage information
        created: Date.now(),
        model: 'gpt-4',
        object: 'chat.completion' as const
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(zeroUsageCompletion);

      const result = await service.generateCompletion('Test');
      
      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      });
    });

    it('should handle malformed JSON in structured response extraction', async () => {
      const malformedJsonCompletion = {
        id: 'chatcmpl-test',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Here is data: {name: "John", "age": thirty} invalid'
          },
          finish_reason: 'stop' as const
        }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        created: Date.now(),
        model: 'gpt-4',
        object: 'chat.completion' as const
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(malformedJsonCompletion);

      await expect(service.generateStructuredResponse('Generate data', 'System', {}))
        .rejects.toThrow(ValidationError);
    });
  });
});