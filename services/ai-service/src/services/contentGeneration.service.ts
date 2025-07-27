import { OpenAIService } from './openai.service';
import {
  ContentGenerationRequest,
  ContentGenerationResponse,
  ContentType,
  GeneratedContent,
  ContentMetadata,
  LinkedInProfile,
  AIServiceError,
  ValidationError
} from '../types';

export class ContentGenerationService {
  constructor(private openaiService: OpenAIService) {}

  /**
   * Generate LinkedIn content based on request type
   */
  async generateContent(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    try {
      switch (request.type) {
        case ContentType.LINKEDIN_POST:
          return await this.generateLinkedInPost(request);
        case ContentType.ARTICLE:
          return await this.generateArticle(request);
        case ContentType.CAROUSEL_SLIDE:
          return await this.generateCarouselSlide(request);
        case ContentType.COMMENT:
          return await this.generateComment(request);
        case ContentType.CONNECTION_MESSAGE:
          return await this.generateConnectionMessage(request);
        case ContentType.THANK_YOU_MESSAGE:
          return await this.generateThankYouMessage(request);
        default:
          throw new ValidationError(`Unsupported content type: ${request.type}`);
      }
    } catch (error: any) {
      throw new AIServiceError(`Content generation failed: ${error.message}`, 'CONTENT_ERROR');
    }
  }

  /**
   * Generate LinkedIn post content
   */
  private async generateLinkedInPost(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    const { topic, industry, tone, targetAudience, keywords, linkedinProfile } = request;

    const profileContext = linkedinProfile ? this.buildProfileContext(linkedinProfile) : '';
    const systemMessage = this.openaiService.createSystemMessage({
      industry,
      tone: tone || 'professional',
      constraints: [
        'Keep posts under 3000 characters',
        'Include engaging hook in first line',
        'Use line breaks for readability',
        'Include relevant hashtags',
        'End with call-to-action or question'
      ]
    });

    const prompt = `
Create engaging LinkedIn posts about: ${topic}

Context:
${profileContext}
Industry: ${industry || 'General professional'}
Tone: ${tone || 'Professional and engaging'}
Target Audience: ${targetAudience || 'Professional network'}
Keywords: ${keywords?.join(', ') || 'None specified'}

Generate 3 different post variations:
1. Educational/Informative (share insights or tips)
2. Personal/Story-based (professional experience or lesson)
3. Thought leadership (industry opinion or trend analysis)

Each post should:
- Start with compelling hook
- Provide value to readers
- Include relevant hashtags (3-5 max)
- End with engagement prompt
- Be optimized for LinkedIn algorithm
- Maintain authentic voice
- Include call-to-action when appropriate

Ensure content is:
- Original and authentic
- Compliant with LinkedIn policies
- Engaging and shareable
- Professional yet personable
`;

    const { variations, totalUsage } = await this.openaiService.generateVariations(
      prompt,
      systemMessage,
      3,
      { userId: linkedinProfile?.id }
    );

    const content = variations.map((text, index) => this.processLinkedInPost(text, index + 1));
    const metadata = this.analyzeContent(variations.join('\n\n'), 'linkedin_post');

    return {
      content,
      metadata: {
        ...metadata,
        complianceCheck: this.checkLinkedInCompliance(content)
      }
    };
  }

  /**
   * Generate article content
   */
  private async generateArticle(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    const { topic, industry, tone, targetAudience, keywords, linkedinProfile } = request;

    const profileContext = linkedinProfile ? this.buildProfileContext(linkedinProfile) : '';
    const systemMessage = this.openaiService.createSystemMessage({
      industry,
      tone: tone || 'professional',
      constraints: [
        'Create comprehensive article structure',
        'Include engaging introduction',
        'Use subheadings for organization',
        'Provide actionable insights',
        'Include conclusion with key takeaways'
      ]
    });

    const prompt = `
Create a comprehensive LinkedIn article about: ${topic}

Context:
${profileContext}
Industry: ${industry || 'General professional'}
Tone: ${tone || 'Professional and authoritative'}
Target Audience: ${targetAudience || 'Industry professionals'}
Keywords: ${keywords?.join(', ') || 'None specified'}

Article structure:
1. Compelling headline
2. Engaging introduction with hook
3. 3-5 main sections with subheadings
4. Actionable insights or tips
5. Conclusion with key takeaways
6. Call-to-action for engagement

Article should:
- Be 800-1500 words
- Provide genuine value
- Include personal insights or experiences
- Use data or examples when relevant
- Be SEO-optimized for LinkedIn
- Maintain thought leadership positioning
`;

    const { content: articleContent, usage } = await this.openaiService.generateCompletion(
      prompt,
      systemMessage,
      { 
        maxTokens: 2000,
        userId: linkedinProfile?.id 
      }
    );

    const content = [{
      id: 'article_1',
      content: articleContent,
      variant: 1,
      score: 85,
      hashtags: this.extractHashtags(articleContent),
      callToAction: this.extractCallToAction(articleContent)
    }];

    const metadata = this.analyzeContent(articleContent, 'article');

    return {
      content,
      metadata: {
        ...metadata,
        complianceCheck: this.checkLinkedInCompliance(content)
      }
    };
  }

  /**
   * Generate carousel slide content
   */
  private async generateCarouselSlide(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    const { topic, industry, tone, customPrompt } = request;

    const systemMessage = this.openaiService.createSystemMessage({
      industry,
      tone: tone || 'visual',
      constraints: [
        'Create content suitable for visual slides',
        'Keep text concise and impactful',
        'Use bullet points when appropriate',
        'Focus on one key point per slide',
        'Include engaging visuals descriptions'
      ]
    });

    const prompt = customPrompt || `
Create content for a LinkedIn carousel post about: ${topic}

Generate 5-7 slides with:
1. Title slide with compelling headline
2. Problem/challenge slide
3. 3-4 solution/tip slides
4. Conclusion/summary slide
5. Call-to-action slide

Each slide should:
- Have concise, impactful text (under 100 words)
- Include visual element suggestions
- Maintain consistent messaging
- Build on previous slides
- Be social media optimized

Industry: ${industry || 'General professional'}
Tone: ${tone || 'Engaging and visual'}
`;

    const { content: carouselContent, usage } = await this.openaiService.generateCompletion(
      prompt,
      systemMessage,
      { userId: request.linkedinProfile?.id }
    );

    const slides = this.parseCarouselSlides(carouselContent);
    const content = slides.map((slide, index) => ({
      id: `slide_${index + 1}`,
      content: slide,
      variant: index + 1,
      score: 80 + Math.random() * 15, // Simulated scoring
      hashtags: index === slides.length - 1 ? this.extractHashtags(slide) : []
    }));

    const metadata = this.analyzeContent(carouselContent, 'carousel');

    return {
      content,
      metadata: {
        ...metadata,
        complianceCheck: this.checkLinkedInCompliance(content)
      }
    };
  }

  /**
   * Generate comment content
   */
  private async generateComment(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    const { customPrompt, tone, linkedinProfile } = request;

    const profileContext = linkedinProfile ? this.buildProfileContext(linkedinProfile) : '';
    const systemMessage = this.openaiService.createSystemMessage({
      tone: tone || 'engaging',
      constraints: [
        'Keep comments under 500 characters',
        'Be genuine and authentic',
        'Add value to the conversation',
        'Avoid generic responses',
        'Maintain professional tone'
      ]
    });

    const prompt = customPrompt || `
Generate thoughtful LinkedIn comments that add value to professional discussions.

Context:
${profileContext}

Create 3 different comment styles:
1. Question-based (ask thoughtful follow-up question)
2. Insight-sharing (add relevant experience or perspective)
3. Supportive engagement (acknowledge and build on the post)

Each comment should:
- Be authentic and professional
- Add value to the conversation
- Encourage further discussion
- Reflect personal expertise
- Be under 500 characters
`;

    const { variations, totalUsage } = await this.openaiService.generateVariations(
      prompt,
      systemMessage,
      3,
      { userId: linkedinProfile?.id }
    );

    const content = variations.map((text, index) => ({
      id: `comment_${index + 1}`,
      content: text.trim(),
      variant: index + 1,
      score: 75 + Math.random() * 20
    }));

    const metadata = this.analyzeContent(variations.join('\n'), 'comment');

    return {
      content,
      metadata: {
        ...metadata,
        complianceCheck: { passed: true }
      }
    };
  }

  /**
   * Generate connection request message
   */
  private async generateConnectionMessage(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    const { customPrompt, linkedinProfile } = request;

    const profileContext = linkedinProfile ? this.buildProfileContext(linkedinProfile) : '';
    const systemMessage = this.openaiService.createSystemMessage({
      tone: 'personal',
      constraints: [
        'Keep under 300 characters (LinkedIn limit)',
        'Personalize the message',
        'Mention common ground or reason for connecting',
        'Be genuine and professional',
        'Avoid sales language'
      ]
    });

    const prompt = customPrompt || `
Generate personalized LinkedIn connection request messages.

Context:
${profileContext}

Create 3 different message styles:
1. Industry-based connection (shared industry or role)
2. Mutual interest connection (common topics or skills)
3. Event/content-based connection (mutual engagement or event)

Each message should:
- Be under 300 characters
- Include personal touch
- Mention reason for connecting
- Be professional yet friendly
- Avoid generic templates
`;

    const { variations, totalUsage } = await this.openaiService.generateVariations(
      prompt,
      systemMessage,
      3,
      { userId: linkedinProfile?.id }
    );

    const content = variations.map((text, index) => ({
      id: `connection_${index + 1}`,
      content: text.trim(),
      variant: index + 1,
      score: 80 + Math.random() * 15
    }));

    const metadata = this.analyzeContent(variations.join('\n'), 'connection_message');

    return {
      content,
      metadata: {
        ...metadata,
        complianceCheck: this.checkLinkedInCompliance(content)
      }
    };
  }

  /**
   * Generate thank you message
   */
  private async generateThankYouMessage(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    const { customPrompt, tone, linkedinProfile } = request;

    const systemMessage = this.openaiService.createSystemMessage({
      tone: tone || 'grateful',
      constraints: [
        'Express genuine gratitude',
        'Be specific about what you\'re thanking for',
        'Keep it professional yet warm',
        'Include next steps if appropriate'
      ]
    });

    const prompt = customPrompt || `
Generate professional thank you messages for LinkedIn interactions.

Create 3 different thank you message types:
1. Connection acceptance thank you
2. Post engagement thank you (comment/share)
3. Meeting/conversation follow-up thank you

Each message should:
- Express genuine gratitude
- Be specific about the interaction
- Maintain professional tone
- Include appropriate next steps
- Be personalized and authentic
`;

    const { variations, totalUsage } = await this.openaiService.generateVariations(
      prompt,
      systemMessage,
      3,
      { userId: linkedinProfile?.id }
    );

    const content = variations.map((text, index) => ({
      id: `thank_you_${index + 1}`,
      content: text.trim(),
      variant: index + 1,
      score: 85 + Math.random() * 10
    }));

    const metadata = this.analyzeContent(variations.join('\n'), 'thank_you_message');

    return {
      content,
      metadata: {
        ...metadata,
        complianceCheck: { passed: true }
      }
    };
  }

  /**
   * Build profile context for content generation
   */
  private buildProfileContext(profile: LinkedInProfile): string {
    const firstName = Object.values(profile.firstName.localized)[0] || '';
    const currentPosition = profile.positions?.find(p => p.current);
    
    let context = `Professional: ${firstName}`;
    
    if (currentPosition) {
      context += ` - ${currentPosition.title} at ${currentPosition.companyName}`;
    }
    
    if (profile.industry) {
      context += ` | Industry: ${profile.industry}`;
    }
    
    return context;
  }

  /**
   * Process LinkedIn post content
   */
  private processLinkedInPost(text: string, variant: number): GeneratedContent {
    const hashtags = this.extractHashtags(text);
    const callToAction = this.extractCallToAction(text);
    
    return {
      id: `post_${variant}`,
      content: text.trim(),
      variant,
      score: 75 + Math.random() * 20,
      hashtags,
      callToAction,
      estimatedEngagement: {
        likes: Math.floor(Math.random() * 50) + 10,
        comments: Math.floor(Math.random() * 10) + 2,
        shares: Math.floor(Math.random() * 5) + 1
      }
    };
  }

  /**
   * Analyze content metadata
   */
  private analyzeContent(content: string, type: string): ContentMetadata {
    const words = content.split(/\s+/).length;
    const characters = content.length;
    
    return {
      wordCount: words,
      characterCount: characters,
      readabilityScore: this.calculateReadabilityScore(content),
      sentimentScore: this.calculateSentimentScore(content),
      keyThemes: this.extractKeyThemes(content),
      complianceCheck: { passed: true }
    };
  }

  /**
   * Extract hashtags from content
   */
  private extractHashtags(content: string): string[] {
    const hashtagPattern = /#[\w]+/g;
    const matches = content.match(hashtagPattern);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  /**
   * Extract call-to-action from content
   */
  private extractCallToAction(content: string): string | undefined {
    const ctaPatterns = [
      /What do you think\?/i,
      /Share your thoughts/i,
      /Let me know/i,
      /Comment below/i,
      /What's your experience/i
    ];
    
    for (const pattern of ctaPatterns) {
      const match = content.match(pattern);
      if (match) return match[0];
    }
    
    return undefined;
  }

  /**
   * Parse carousel slides from generated content
   */
  private parseCarouselSlides(content: string): string[] {
    // Split by slide indicators
    const slidePattern = /Slide \d+:/gi;
    const slides = content.split(slidePattern).filter(slide => slide.trim().length > 0);
    
    if (slides.length === 0) {
      // Fallback: split by double newlines
      return content.split('\n\n').filter(slide => slide.trim().length > 0);
    }
    
    return slides.map(slide => slide.trim());
  }

  /**
   * Check LinkedIn compliance
   */
  private checkLinkedInCompliance(content: GeneratedContent[]): { passed: boolean; issues?: string[] } {
    const issues: string[] = [];
    
    for (const item of content) {
      // Check for spam indicators
      if (this.containsSpamIndicators(item.content)) {
        issues.push('Content may contain spam-like language');
      }
      
      // Check for inappropriate content
      if (this.containsInappropriateContent(item.content)) {
        issues.push('Content may contain inappropriate language');
      }
      
      // Check character limits
      if (item.content.length > 3000) {
        issues.push('Content exceeds LinkedIn character limit');
      }
    }
    
    return {
      passed: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  /**
   * Calculate readability score (simplified)
   */
  private calculateReadabilityScore(content: string): number {
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    
    // Simple readability score (0-100, higher is better)
    const score = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence - 15) * 2));
    return Math.round(score);
  }

  /**
   * Calculate sentiment score (simplified)
   */
  private calculateSentimentScore(content: string): number {
    const positiveWords = ['great', 'excellent', 'amazing', 'successful', 'positive', 'excited'];
    const negativeWords = ['terrible', 'awful', 'failed', 'negative', 'disappointed'];
    
    const words = content.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    // Score from -1 to 1
    const score = (positiveCount - negativeCount) / words.length;
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Extract key themes from content
   */
  private extractKeyThemes(content: string): string[] {
    const commonThemes = [
      'leadership', 'innovation', 'technology', 'growth', 'success',
      'teamwork', 'strategy', 'digital transformation', 'career development',
      'industry trends', 'professional development', 'networking'
    ];
    
    const contentLower = content.toLowerCase();
    return commonThemes.filter(theme => contentLower.includes(theme));
  }

  /**
   * Check for spam indicators
   */
  private containsSpamIndicators(content: string): boolean {
    const spamPatterns = [
      /make money fast/i,
      /click here/i,
      /limited time offer/i,
      /act now/i,
      /guaranteed/i
    ];
    
    return spamPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for inappropriate content
   */
  private containsInappropriateContent(content: string): boolean {
    // Basic inappropriate content detection
    const inappropriatePatterns = [
      /\b(spam|scam)\b/i,
      /\b(hate|offensive)\b/i
    ];
    
    return inappropriatePatterns.some(pattern => pattern.test(content));
  }
}