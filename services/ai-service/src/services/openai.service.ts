import OpenAI from 'openai';
import { 
  AIServiceConfig, 
  OpenAIError, 
  RateLimitError, 
  ValidationError,
  OpenAIUsage,
  AIRequestType 
} from '../types';

export class OpenAIService {
  private openai: OpenAI;
  private config: AIServiceConfig;
  private requestCounts: Map<string, { count: number; resetTime: Date }> = new Map();

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /**
   * Generate a completion using GPT-4
   */
  async generateCompletion(
    prompt: string,
    systemMessage?: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      userId?: string;
    }
  ): Promise<{ content: string; usage: OpenAIUsage }> {
    try {
      // Rate limiting check
      if (options?.userId) {
        await this.checkRateLimit(options.userId);
      }

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      
      if (systemMessage) {
        messages.push({ role: 'system', content: systemMessage });
      }
      
      messages.push({ role: 'user', content: prompt });

      const completion = await this.openai.chat.completions.create({
        model: options?.model || this.config.model,
        messages,
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
        response_format: { type: "text" }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new OpenAIError('No content generated from OpenAI response');
      }

      const usage: OpenAIUsage = {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        cost: this.calculateCost(completion.usage?.total_tokens || 0)
      };

      // Update rate limiting
      if (options?.userId) {
        this.updateRateLimit(options.userId);
      }

      return { content, usage };
    } catch (error: any) {
      if (error.status === 429) {
        throw new RateLimitError('OpenAI rate limit exceeded');
      }
      if (error.status === 400) {
        throw new ValidationError(`OpenAI validation error: ${error.message}`);
      }
      throw new OpenAIError(`OpenAI API error: ${error.message}`, error);
    }
  }

  /**
   * Generate multiple variations of content
   */
  async generateVariations(
    prompt: string,
    systemMessage: string,
    count: number = 3,
    options?: {
      maxTokens?: number;
      temperature?: number;
      userId?: string;
    }
  ): Promise<{ variations: string[]; totalUsage: OpenAIUsage }> {
    const variations: string[] = [];
    let totalUsage: OpenAIUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0
    };

    for (let i = 0; i < count; i++) {
      const { content, usage } = await this.generateCompletion(
        prompt,
        systemMessage,
        {
          ...options,
          temperature: (options?.temperature || this.config.temperature) + (i * 0.1) // Slight temperature variation
        }
      );
      
      variations.push(content);
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
      totalUsage.cost = (totalUsage.cost || 0) + (usage.cost || 0);
    }

    return { variations, totalUsage };
  }

  /**
   * Generate structured JSON response
   */
  async generateStructuredResponse<T>(
    prompt: string,
    systemMessage: string,
    schema: any,
    options?: {
      maxTokens?: number;
      temperature?: number;
      userId?: string;
    }
  ): Promise<{ data: T; usage: OpenAIUsage }> {
    try {
      const structuredPrompt = `${prompt}\n\nPlease respond with valid JSON that matches this schema:\n${JSON.stringify(schema, null, 2)}`;
      
      const { content, usage } = await this.generateCompletion(
        structuredPrompt,
        systemMessage,
        options
      );

      // Try to parse JSON response
      let data: T;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        // If direct parsing fails, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          data = JSON.parse(jsonMatch[0]);
        } else {
          throw new ValidationError('Failed to parse JSON from OpenAI response');
        }
      }

      return { data, usage };
    } catch (error: any) {
      throw new OpenAIError(`Structured response generation failed: ${error.message}`, error);
    }
  }

  /**
   * Check if user has exceeded rate limits
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const now = new Date();
    const userLimits = this.requestCounts.get(userId);

    if (userLimits) {
      // Reset if past reset time
      if (now > userLimits.resetTime) {
        this.requestCounts.delete(userId);
      } else if (userLimits.count >= this.config.rateLimits.requestsPerMinute) {
        throw new RateLimitError(
          'Rate limit exceeded for user',
          userLimits.resetTime
        );
      }
    }
  }

  /**
   * Update rate limit counters
   */
  private updateRateLimit(userId: string): void {
    const now = new Date();
    const resetTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
    const userLimits = this.requestCounts.get(userId);

    if (userLimits && now < userLimits.resetTime) {
      userLimits.count += 1;
    } else {
      this.requestCounts.set(userId, { count: 1, resetTime });
    }
  }

  /**
   * Calculate approximate cost based on token usage
   */
  private calculateCost(tokens: number): number {
    // GPT-4 pricing (approximate): $0.03 per 1K prompt tokens, $0.06 per 1K completion tokens
    // Simplified calculation using average rate
    const costPer1KTokens = 0.045; // Average between prompt and completion costs
    return (tokens / 1000) * costPer1KTokens;
  }

  /**
   * Validate OpenAI API key and connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const models = await this.openai.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      throw new OpenAIError('Failed to fetch available models');
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimits(): void {
    const now = new Date();
    for (const [userId, limits] of this.requestCounts.entries()) {
      if (now > limits.resetTime) {
        this.requestCounts.delete(userId);
      }
    }
  }

  /**
   * Get current rate limit status for a user
   */
  getRateLimitStatus(userId: string): { remaining: number; resetTime: Date | null } {
    const userLimits = this.requestCounts.get(userId);
    
    if (!userLimits) {
      return {
        remaining: this.config.rateLimits.requestsPerMinute,
        resetTime: null
      };
    }

    const now = new Date();
    if (now > userLimits.resetTime) {
      return {
        remaining: this.config.rateLimits.requestsPerMinute,
        resetTime: null
      };
    }

    return {
      remaining: Math.max(0, this.config.rateLimits.requestsPerMinute - userLimits.count),
      resetTime: userLimits.resetTime
    };
  }

  /**
   * Create system message based on context
   */
  createSystemMessage(context: {
    role?: string;
    industry?: string;
    tone?: string;
    constraints?: string[];
  }): string {
    let systemMessage = `You are an expert LinkedIn optimization AI assistant specializing in professional profile enhancement and content creation.`;

    if (context.role) {
      systemMessage += ` You are helping someone in the ${context.role} role.`;
    }

    if (context.industry) {
      systemMessage += ` They work in the ${context.industry} industry.`;
    }

    if (context.tone) {
      systemMessage += ` Use a ${context.tone} tone in your responses.`;
    }

    systemMessage += `\n\nKey principles:
- Maintain strict compliance with LinkedIn's terms of service
- Focus on authenticity and professional growth
- Provide actionable, specific recommendations
- Consider current LinkedIn best practices and algorithm preferences
- Ensure all suggestions are ethical and honest`;

    if (context.constraints && context.constraints.length > 0) {
      systemMessage += `\n\nAdditional constraints:\n${context.constraints.map(c => `- ${c}`).join('\n')}`;
    }

    return systemMessage;
  }
}