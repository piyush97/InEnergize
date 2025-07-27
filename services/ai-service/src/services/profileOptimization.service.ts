import { OpenAIService } from './openai.service';
import {
  LinkedInProfile,
  ProfileCompleteness,
  ProfileOptimizationRequest,
  ProfileOptimizationResponse,
  ProfileRecommendation,
  PrioritizedAction,
  HeadlineGenerationRequest,
  HeadlineGenerationResponse,
  SummaryGenerationRequest,
  SummaryGenerationResponse,
  SkillSuggestionRequest,
  SkillSuggestionResponse,
  GeneratedHeadline,
  GeneratedSummary,
  SuggestedSkill,
  ValidationError,
  AIServiceError
} from '../types';

export class ProfileOptimizationService {
  constructor(private openaiService: OpenAIService) {}

  /**
   * Generate comprehensive profile optimization recommendations
   */
  async optimizeProfile(request: ProfileOptimizationRequest): Promise<ProfileOptimizationResponse> {
    try {
      const { linkedinProfile, completenessData, targetRole, industry, careerLevel, goals } = request;

      // Create context for AI
      const profileContext = this.buildProfileContext(linkedinProfile, completenessData);
      const systemMessage = this.openaiService.createSystemMessage({
        role: targetRole,
        industry,
        tone: 'professional',
        constraints: [
          'Focus on LinkedIn-specific optimization',
          'Provide measurable improvements',
          'Consider current LinkedIn algorithm preferences',
          'Ensure recommendations are actionable'
        ]
      });

      const prompt = `
Analyze this LinkedIn profile and provide comprehensive optimization recommendations:

Profile Context:
${profileContext}

Target Role: ${targetRole || 'Not specified'}
Industry: ${industry || 'Not specified'}
Career Level: ${careerLevel || 'Not specified'}
Goals: ${goals?.join(', ') || 'General profile improvement'}

Current completeness score: ${completenessData.score}/100
Missing fields: ${completenessData.missingFields.join(', ')}

Please provide:
1. Overall assessment and score (0-100)
2. Specific recommendations for each profile section
3. Prioritized action items
4. Estimated impact on profile performance

Focus on:
- LinkedIn algorithm optimization
- Professional branding
- Industry-specific improvements
- Measurable outcomes
`;

      const schema = {
        overallScore: 'number',
        recommendations: [
          {
            field: 'string',
            currentValue: 'string',
            suggestedValue: 'string',
            reasoning: 'string',
            impact: 'string',
            difficulty: 'string',
            category: 'string'
          }
        ],
        prioritizedActions: [
          {
            title: 'string',
            description: 'string',
            priority: 'number',
            estimatedTime: 'string',
            impact: 'string',
            field: 'string'
          }
        ],
        estimatedImpact: {
          profileViews: 'number',
          connectionAcceptance: 'number',
          recruiterInterest: 'number'
        }
      };

      const { data, usage } = await this.openaiService.generateStructuredResponse<ProfileOptimizationResponse>(
        prompt,
        systemMessage,
        schema,
        { userId: request.linkedinProfile.id }
      );

      // Validate and enhance response
      return this.enhanceOptimizationResponse(data, completenessData);
    } catch (error: any) {
      throw new AIServiceError(`Profile optimization failed: ${error.message}`, 'OPTIMIZATION_ERROR');
    }
  }

  /**
   * Generate optimized LinkedIn headlines
   */
  async generateHeadlines(request: HeadlineGenerationRequest): Promise<HeadlineGenerationResponse> {
    try {
      const { linkedinProfile, targetRole, industry, keywords, tone, includeMetrics } = request;

      const profileSummary = this.extractProfileSummary(linkedinProfile);
      const systemMessage = this.openaiService.createSystemMessage({
        role: targetRole,
        industry,
        tone: tone || 'professional',
        constraints: [
          'Headlines must be under 220 characters',
          'Include relevant keywords naturally',
          'Focus on value proposition',
          'Avoid clichés and buzzwords'
        ]
      });

      const prompt = `
Create compelling LinkedIn headlines for this professional:

Profile Summary:
${profileSummary}

Target Role: ${targetRole || 'Current role enhancement'}
Industry: ${industry || 'Current industry'}
Keywords to include: ${keywords?.join(', ') || 'None specified'}
Include metrics: ${includeMetrics ? 'Yes' : 'No'}
Tone: ${tone || 'Professional'}

Generate 5 different headline variations:
1. Standard professional (focus on role and value)
2. Achievement-focused (highlight key accomplishments)
3. Skills-based (emphasize core competencies)
4. Industry-specific (tailored to industry trends)
5. Growth-oriented (future-focused aspirations)

Each headline should:
- Be under 220 characters
- Include relevant keywords naturally
- Showcase unique value proposition
- Be optimized for LinkedIn search
- Stand out from generic headlines
`;

      const schema = {
        headlines: [
          {
            id: 'string',
            text: 'string',
            length: 'number',
            score: 'number',
            strengths: ['string'],
            keywords: ['string'],
            variant: 'string'
          }
        ],
        analysis: {
          optimalLength: 'number',
          keywordDensity: 'number',
          industryRelevance: 'number',
          uniquenessScore: 'number',
          recommendations: ['string']
        }
      };

      const { data, usage } = await this.openaiService.generateStructuredResponse<HeadlineGenerationResponse>(
        prompt,
        systemMessage,
        schema,
        { userId: linkedinProfile.id }
      );

      return this.enhanceHeadlineResponse(data);
    } catch (error: any) {
      throw new AIServiceError(`Headline generation failed: ${error.message}`, 'HEADLINE_ERROR');
    }
  }

  /**
   * Generate optimized LinkedIn summaries
   */
  async generateSummaries(request: SummaryGenerationRequest): Promise<SummaryGenerationResponse> {
    try {
      const { linkedinProfile, targetRole, achievements, careerGoals, personalBrand, tone } = request;

      const profileSummary = this.extractProfileSummary(linkedinProfile);
      const systemMessage = this.openaiService.createSystemMessage({
        role: targetRole,
        tone: tone || 'narrative',
        constraints: [
          'Summary should be 3-5 paragraphs',
          'Include compelling hook in first line',
          'End with clear call-to-action',
          'Balance personal and professional elements'
        ]
      });

      const prompt = `
Create compelling LinkedIn summary/about sections for this professional:

Profile Summary:
${profileSummary}

Target Role: ${targetRole || 'Current role enhancement'}
Key Achievements: ${achievements?.join(', ') || 'Not specified'}
Career Goals: ${careerGoals?.join(', ') || 'Not specified'}
Personal Brand: ${personalBrand || 'Not specified'}
Tone: ${tone || 'Narrative storytelling'}

Generate 3 different summary variations:
1. Narrative style (storytelling approach)
2. Achievement-focused (results and metrics)
3. Hybrid approach (combination of story and achievements)

Each summary should:
- Start with compelling hook
- Tell professional story
- Highlight key achievements
- Include relevant keywords
- End with call-to-action
- Be optimized for LinkedIn search
- Reflect authentic personality
`;

      const schema = {
        summaries: [
          {
            id: 'string',
            text: 'string',
            wordCount: 'number',
            score: 'number',
            structure: 'string',
            keyPoints: ['string']
          }
        ],
        analysis: {
          optimalLength: 'number',
          keywordOptimization: 'number',
          storytellingScore: 'number',
          callToActionStrength: 'number',
          recommendations: ['string']
        }
      };

      const { data, usage } = await this.openaiService.generateStructuredResponse<SummaryGenerationResponse>(
        prompt,
        systemMessage,
        schema,
        { userId: linkedinProfile.id }
      );

      return this.enhanceSummaryResponse(data);
    } catch (error: any) {
      throw new AIServiceError(`Summary generation failed: ${error.message}`, 'SUMMARY_ERROR');
    }
  }

  /**
   * Suggest relevant skills for profile
   */
  async suggestSkills(request: SkillSuggestionRequest): Promise<SkillSuggestionResponse> {
    try {
      const { linkedinProfile, targetRole, industry, includeEmerging, maxSuggestions } = request;

      const currentSkills = linkedinProfile.skills?.map(s => s.name) || [];
      const profileSummary = this.extractProfileSummary(linkedinProfile);

      const systemMessage = this.openaiService.createSystemMessage({
        role: targetRole,
        industry,
        tone: 'analytical',
        constraints: [
          'Focus on in-demand skills',
          'Consider industry trends',
          'Balance technical and soft skills',
          'Provide skill progression recommendations'
        ]
      });

      const prompt = `
Analyze this professional's profile and suggest relevant skills:

Profile Summary:
${profileSummary}

Current Skills: ${currentSkills.join(', ')}
Target Role: ${targetRole || 'Current role enhancement'}
Industry: ${industry || 'Current industry'}
Include Emerging Skills: ${includeEmerging ? 'Yes' : 'No'}
Max Suggestions: ${maxSuggestions || 10}

Provide:
1. Suggested skills categorized by type
2. Skill gaps for target role
3. Industry trend analysis
4. Learning prioritization

Focus on:
- Skills relevant to target role
- Industry-specific competencies
- Emerging technologies/trends
- Skills gap analysis
- Market demand indicators
`;

      const schema = {
        suggestedSkills: [
          {
            name: 'string',
            category: 'string',
            relevanceScore: 'number',
            demandLevel: 'string',
            currentTrend: 'string',
            reasoning: 'string'
          }
        ],
        skillGaps: [
          {
            requiredSkill: 'string',
            currentLevel: 'number',
            targetLevel: 'number',
            priority: 'string',
            learningResources: ['string']
          }
        ],
        industryTrends: [
          {
            skill: 'string',
            growth: 'number',
            demand: 'number',
            timeframe: 'string',
            source: 'string'
          }
        ]
      };

      const { data, usage } = await this.openaiService.generateStructuredResponse<SkillSuggestionResponse>(
        prompt,
        systemMessage,
        schema,
        { userId: linkedinProfile.id }
      );

      return this.enhanceSkillsResponse(data, currentSkills);
    } catch (error: any) {
      throw new AIServiceError(`Skill suggestion failed: ${error.message}`, 'SKILLS_ERROR');
    }
  }

  /**
   * Build comprehensive profile context for AI analysis
   */
  private buildProfileContext(profile: LinkedInProfile, completeness: ProfileCompleteness): string {
    const firstName = Object.values(profile.firstName.localized)[0] || '';
    const lastName = Object.values(profile.lastName.localized)[0] || '';
    
    let context = `Name: ${firstName} ${lastName}\n`;
    
    if (profile.headline) {
      context += `Current Headline: ${profile.headline}\n`;
    }
    
    if (profile.summary) {
      context += `Current Summary: ${profile.summary}\n`;
    }
    
    if (profile.industry) {
      context += `Industry: ${profile.industry}\n`;
    }
    
    if (profile.location) {
      context += `Location: ${profile.location.country}\n`;
    }
    
    if (profile.positions && profile.positions.length > 0) {
      context += `\nCurrent/Recent Positions:\n`;
      profile.positions.slice(0, 3).forEach(pos => {
        context += `- ${pos.title} at ${pos.companyName}`;
        if (pos.current) context += ' (Current)';
        context += '\n';
      });
    }
    
    if (profile.educations && profile.educations.length > 0) {
      context += `\nEducation:\n`;
      profile.educations.slice(0, 2).forEach(edu => {
        context += `- ${edu.degree || 'Degree'} at ${edu.schoolName}`;
        if (edu.fieldOfStudy) context += ` (${edu.fieldOfStudy})`;
        context += '\n';
      });
    }
    
    if (profile.skills && profile.skills.length > 0) {
      context += `\nSkills: ${profile.skills.map(s => s.name).join(', ')}\n`;
    }
    
    context += `\nProfile Completeness Breakdown:\n`;
    Object.entries(completeness.breakdown).forEach(([key, value]) => {
      context += `- ${key}: ${value}%\n`;
    });
    
    return context;
  }

  /**
   * Extract concise profile summary for prompts
   */
  private extractProfileSummary(profile: LinkedInProfile): string {
    const firstName = Object.values(profile.firstName.localized)[0] || '';
    const lastName = Object.values(profile.lastName.localized)[0] || '';
    
    let summary = `${firstName} ${lastName}`;
    
    if (profile.headline) {
      summary += ` - ${profile.headline}`;
    }
    
    if (profile.industry) {
      summary += ` | Industry: ${profile.industry}`;
    }
    
    const currentPosition = profile.positions?.find(p => p.current);
    if (currentPosition) {
      summary += ` | Current: ${currentPosition.title} at ${currentPosition.companyName}`;
    }
    
    return summary;
  }

  /**
   * Enhance optimization response with additional validation
   */
  private enhanceOptimizationResponse(
    response: ProfileOptimizationResponse,
    completeness: ProfileCompleteness
  ): ProfileOptimizationResponse {
    // Ensure recommendations are valid
    response.recommendations = response.recommendations.map(rec => ({
      ...rec,
      impact: this.validateImpactLevel(rec.impact),
      difficulty: this.validateDifficultyLevel(rec.difficulty),
      category: this.validateCategoryLevel(rec.category)
    }));

    // Sort prioritized actions by priority
    response.prioritizedActions.sort((a, b) => b.priority - a.priority);

    // Validate estimated impact ranges
    response.estimatedImpact = {
      profileViews: Math.max(0, Math.min(500, response.estimatedImpact.profileViews)),
      connectionAcceptance: Math.max(0, Math.min(100, response.estimatedImpact.connectionAcceptance)),
      recruiterInterest: Math.max(0, Math.min(100, response.estimatedImpact.recruiterInterest))
    };

    return response;
  }

  /**
   * Enhance headline response with validation
   */
  private enhanceHeadlineResponse(response: HeadlineGenerationResponse): HeadlineGenerationResponse {
    response.headlines = response.headlines.map((headline, index) => ({
      ...headline,
      id: headline.id || `headline_${index + 1}`,
      length: headline.text.length,
      score: Math.max(0, Math.min(100, headline.score))
    }));

    return response;
  }

  /**
   * Enhance summary response with validation
   */
  private enhanceSummaryResponse(response: SummaryGenerationResponse): SummaryGenerationResponse {
    response.summaries = response.summaries.map((summary, index) => ({
      ...summary,
      id: summary.id || `summary_${index + 1}`,
      wordCount: summary.text.split(' ').length,
      score: Math.max(0, Math.min(100, summary.score))
    }));

    return response;
  }

  /**
   * Enhance skills response with filtering
   */
  private enhanceSkillsResponse(
    response: SkillSuggestionResponse,
    currentSkills: string[]
  ): SkillSuggestionResponse {
    // Filter out skills user already has
    response.suggestedSkills = response.suggestedSkills.filter(
      skill => !currentSkills.some(current => 
        current.toLowerCase() === skill.name.toLowerCase()
      )
    );

    // Validate relevance scores
    response.suggestedSkills = response.suggestedSkills.map(skill => ({
      ...skill,
      relevanceScore: Math.max(0, Math.min(100, skill.relevanceScore))
    }));

    return response;
  }

  /**
   * Validate impact level values
   */
  private validateImpactLevel(impact: string): 'high' | 'medium' | 'low' {
    const validImpacts = ['high', 'medium', 'low'];
    return validImpacts.includes(impact.toLowerCase()) 
      ? impact.toLowerCase() as 'high' | 'medium' | 'low'
      : 'medium';
  }

  /**
   * Validate difficulty level values
   */
  private validateDifficultyLevel(difficulty: string): 'easy' | 'medium' | 'hard' {
    const validDifficulties = ['easy', 'medium', 'hard'];
    return validDifficulties.includes(difficulty.toLowerCase())
      ? difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'
      : 'medium';
  }

  /**
   * Validate category level values
   */
  private validateCategoryLevel(category: string): 'basic' | 'advanced' | 'expert' {
    const validCategories = ['basic', 'advanced', 'expert'];
    return validCategories.includes(category.toLowerCase())
      ? category.toLowerCase() as 'basic' | 'advanced' | 'expert'
      : 'basic';
  }
}