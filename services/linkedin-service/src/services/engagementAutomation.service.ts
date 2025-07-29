// ===================================================================
// ENGAGEMENT AUTOMATION SERVICE - LinkedIn-Compliant Post Engagement
// ===================================================================

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { LinkedInAPIService } from './api.service';
import { LinkedInComplianceService } from './compliance.service';
import { LinkedInRateLimitService } from './rateLimit.service';

interface EngagementTask {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'view_profile' | 'follow';
  targetId: string; // post ID, profile ID, etc.
  targetUrl?: string;
  content?: string; // comment text
  templateId?: string;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
  metadata?: {
    postTitle?: string;
    authorName?: string;
    industry?: string;
    contentType?: 'article' | 'video' | 'image' | 'poll' | 'document' | 'text';
    url?: string;
    publishedAt?: string;
    likeCount?: number;
    commentCount?: number;
    keywords?: string[];
    authorFollowerCount?: number;
    authorPostFrequency?: 'low' | 'medium' | 'high';
    authorTitle?: string;
    authorConnectionDegree?: number;
    isSponsored?: boolean;
    hasExternalLinks?: boolean;
    authorVerified?: boolean;
    authorCompanySize?: string;
  };
}

interface CommentTemplate {
  id: string;
  name: string;
  text: string;
  variables: string[]; // e.g., ['authorName', 'industry', 'postTopic']
  category: 'general' | 'professional' | 'supportive' | 'insightful';
  enabled: boolean;
  tone: 'formal' | 'casual' | 'enthusiastic' | 'thoughtful';
}

interface EngagementScoring {
  relevanceScore: number; // 0-100 - how relevant is this content to user
  engagementPotential: number; // 0-100 - likelihood to generate meaningful interaction  
  authorInfluence: number; // 0-100 - influence level of content author
  riskScore: number; // 0-100 - risk of automated detection
  overallScore: number; // 0-100 - combined weighted score
}

export class LinkedInEngagementAutomationService extends EventEmitter {
  private redis: Redis;
  private apiService: LinkedInAPIService;
  private complianceService: LinkedInComplianceService;
  private rateLimitService: LinkedInRateLimitService;
  private isProcessing: Map<string, boolean>;

  // Conservative engagement limits
  private readonly ENGAGEMENT_LIMITS = {
    maxLikesPerDay: 30,           // LinkedIn allows ~300, we use 30
    maxCommentsPerDay: 8,         // LinkedIn allows ~50, we use 8
    maxProfileViewsPerDay: 25,    // LinkedIn allows ~100, we use 25
    maxFollowsPerDay: 5,          // LinkedIn allows ~20, we use 5
    minDelayBetweenActions: 60000,  // Minimum 1 minute
    maxDelayBetweenActions: 300000, // Maximum 5 minutes
    maxRetries: 2,
    minimumEngagementScore: 70,   // Only engage with high-scoring content
  };

  constructor(
    apiService: LinkedInAPIService,
    complianceService: LinkedInComplianceService,
    rateLimitService: LinkedInRateLimitService
  ) {
    super();
    this.apiService = apiService;
    this.complianceService = complianceService;
    this.rateLimitService = rateLimitService;
    this.isProcessing = new Map();
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Start background job processor
    this.startEngagementProcessor();
  }

  /**
   * Schedule an engagement action with intelligent scoring
   */
  async scheduleEngagement(
    userId: string,
    type: 'like' | 'comment' | 'view_profile' | 'follow',
    targetId: string,
    options: {
      content?: string;
      templateId?: string;
      priority?: 'low' | 'normal' | 'high';
      metadata?: any;
      forceScore?: number; // Override scoring for testing
    } = {}
  ): Promise<{ 
    success: boolean; 
    taskId?: string; 
    reason?: string; 
    score?: EngagementScoring;
    retryAfter?: number;
  }> {
    try {
      // Safety validation first
      const safetyCheck = await this.validateEngagementSafety(userId, type);
      if (!safetyCheck.allowed) {
        return {
          success: false,
          reason: safetyCheck.reason,
          retryAfter: safetyCheck.retryAfter
        };
      }

      // Intelligent content scoring (unless overridden for testing)
      let engagementScore: EngagementScoring;
      if (options.forceScore !== undefined) {
        engagementScore = {
          relevanceScore: options.forceScore,
          engagementPotential: options.forceScore,
          authorInfluence: options.forceScore,
          riskScore: 100 - options.forceScore,
          overallScore: options.forceScore
        };
      } else {
        engagementScore = await this.scoreEngagementOpportunity(userId, type, targetId, options.metadata);
      }

      // Only proceed with high-quality engagement opportunities
      if (engagementScore.overallScore < this.ENGAGEMENT_LIMITS.minimumEngagementScore) {
        return {
          success: false,
          reason: `Engagement score too low (${engagementScore.overallScore}/100). Minimum required: ${this.ENGAGEMENT_LIMITS.minimumEngagementScore}`,
          score: engagementScore
        };
      }

      // Create engagement task
      const taskId = `eng_${type}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const engagementTask: EngagementTask = {
        id: taskId,
        userId,
        type,
        targetId,
        targetUrl: options.metadata?.url,
        content: options.content,
        templateId: options.templateId,
        scheduledAt: new Date(Date.now() + this.calculateOptimalDelay()),
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        metadata: options.metadata
      };

      // Queue with priority based on engagement score
      const priority = this.determinePriority(engagementScore, options.priority);
      const queueKey = this.getEngagementQueueKey(type, priority);
      
      await this.redis.lpush(queueKey, JSON.stringify(engagementTask));
      await this.redis.expire(`engagement:${taskId}`, 7 * 24 * 60 * 60); // 7 days

      // Update daily engagement count
      await this.updateDailyEngagementCount(userId, type, 1);

      this.emit('engagementScheduled', { 
        userId, 
        taskId, 
        type, 
        targetId, 
        score: engagementScore 
      });

      return {
        success: true,
        taskId,
        score: engagementScore
      };

    } catch (error) {
      console.error('Error scheduling engagement:', error);
      return {
        success: false,
        reason: 'Internal error scheduling engagement'
      };
    }
  }

  /**
   * Intelligent engagement opportunity scoring
   */
  private async scoreEngagementOpportunity(
    userId: string,
    type: string,
    targetId: string,
    metadata?: any
  ): Promise<EngagementScoring> {
    try {
      // Get user's profile and interests for relevance scoring
      const userProfile = await this.getUserProfile(userId);
      
      // Base scoring
      let relevanceScore = 50;
      let engagementPotential = 50;
      let authorInfluence = 50;
      let riskScore = 30; // Lower is better

      // Relevance scoring based on user interests
      if (metadata && userProfile) {
        relevanceScore = this.calculateRelevanceScore(userProfile, metadata);
        engagementPotential = this.calculateEngagementPotential(metadata);
        authorInfluence = this.calculateAuthorInfluence(metadata);
        riskScore = this.calculateRiskScore(type, metadata);
      }

      // Weight the scores
      const overallScore = Math.round(
        (relevanceScore * 0.3) +
        (engagementPotential * 0.25) +
        (authorInfluence * 0.2) +
        ((100 - riskScore) * 0.25) // Invert risk score
      );

      return {
        relevanceScore,
        engagementPotential,
        authorInfluence,
        riskScore,
        overallScore
      };

    } catch (error) {
      console.error('Error scoring engagement opportunity:', error);
      // Return conservative scores on error
      return {
        relevanceScore: 40,
        engagementPotential: 40,
        authorInfluence: 40,
        riskScore: 60,
        overallScore: 40
      };
    }
  }

  /**
   * Calculate relevance score based on user profile and content
   */
  private calculateRelevanceScore(userProfile: any, metadata: any): number {
    let score = 50;

    // Industry match
    if (userProfile.industry && metadata.industry) {
      if (userProfile.industry.toLowerCase() === metadata.industry.toLowerCase()) {
        score += 20;
      } else if (this.isRelatedIndustry(userProfile.industry, metadata.industry)) {
        score += 10;
      }
    }

    // Skills/keywords match
    if (userProfile.skills && metadata.keywords) {
      const matchingSkills = userProfile.skills.filter((skill: string) =>
        metadata.keywords.some((keyword: string) =>
          skill.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      score += Math.min(20, matchingSkills.length * 5);
    }

    // Company size/type match
    if (userProfile.companySize && metadata.authorCompanySize) {
      if (this.isSimilarCompanySize(userProfile.companySize, metadata.authorCompanySize)) {
        score += 10;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate engagement potential based on content characteristics
   */
  private calculateEngagementPotential(metadata: any): number {
    let score = 50;

    // Post age (newer posts have higher potential)
    if (metadata.publishedAt) {
      const postAge = Date.now() - new Date(metadata.publishedAt).getTime();
      const hoursOld = postAge / (1000 * 60 * 60);
      
      if (hoursOld < 2) score += 25; // Very fresh
      else if (hoursOld < 6) score += 15; // Fresh
      else if (hoursOld < 24) score += 10; // Recent
      else if (hoursOld > 168) score -= 20; // Too old
    }

    // Existing engagement
    if (metadata.likeCount || metadata.commentCount) {
      const totalEngagement = (metadata.likeCount || 0) + (metadata.commentCount || 0) * 3;
      if (totalEngagement > 100) score += 15;
      else if (totalEngagement > 50) score += 10;
      else if (totalEngagement > 20) score += 5;
      else if (totalEngagement < 2) score -= 10; // Very low engagement
    }

    // Content type scoring
    if (metadata.contentType) {
      switch (metadata.contentType) {
        case 'article': score += 15; break;
        case 'video': score += 10; break;
        case 'image': score += 5; break;
        case 'poll': score += 20; break; // Polls typically get high engagement
        case 'document': score += 12; break;
        default: break;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate author influence score
   */
  private calculateAuthorInfluence(metadata: any): number {
    let score = 50;

    // Follower count
    if (metadata.authorFollowerCount) {
      if (metadata.authorFollowerCount > 10000) score += 20;
      else if (metadata.authorFollowerCount > 5000) score += 15;
      else if (metadata.authorFollowerCount > 1000) score += 10;
      else if (metadata.authorFollowerCount > 500) score += 5;
      else if (metadata.authorFollowerCount < 100) score -= 10;
    }

    // Author activity level
    if (metadata.authorPostFrequency) {
      if (metadata.authorPostFrequency === 'high') score += 10;
      else if (metadata.authorPostFrequency === 'medium') score += 5;
      else if (metadata.authorPostFrequency === 'low') score -= 5;
    }

    // Professional title/seniority
    if (metadata.authorTitle) {
      const seniorTitles = ['ceo', 'cto', 'vp', 'director', 'head', 'lead', 'senior', 'principal'];
      if (seniorTitles.some(title => metadata.authorTitle.toLowerCase().includes(title))) {
        score += 15;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate risk score for automated detection
   */
  private calculateRiskScore(type: string, metadata: any): number {
    let riskScore = 20; // Base low risk

    // Type-based risk
    switch (type) {
      case 'like': riskScore += 5; break;          // Low risk
      case 'view_profile': riskScore += 10; break; // Medium risk
      case 'comment': riskScore += 20; break;      // Higher risk
      case 'follow': riskScore += 25; break;       // Highest risk
    }

    // Content characteristics that increase risk
    if (metadata.isSponsored) riskScore += 15; // Sponsored content is riskier
    if (metadata.hasExternalLinks) riskScore += 10; // External links increase risk
    if (metadata.authorConnectionDegree > 2) riskScore += 10; // Engaging with strangers is riskier

    // Reduce risk for high-quality content
    if (metadata.likeCount > 100) riskScore -= 5;
    if (metadata.commentCount > 20) riskScore -= 5;
    if (metadata.authorVerified) riskScore -= 10;

    return Math.min(100, Math.max(0, riskScore));
  }

  /**
   * Validate if engagement action is safe to proceed
   */
  private async validateEngagementSafety(
    userId: string,
    type: string
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    
    // Check compliance status
    const endpoint = this.getEndpointForType(type);
    const compliance = await this.complianceService.validateRequest(userId, endpoint);
    if (!compliance.allowed) {
      return {
        allowed: false,
        reason: compliance.reason,
        retryAfter: compliance.retryAfter
      };
    }

    // Check daily engagement limits
    const dailyCount = await this.getDailyEngagementCount(userId, type);
    const limit = this.getDailyLimitForType(type);
    
    if (dailyCount >= limit) {
      return {
        allowed: false,
        reason: `Daily ${type} limit reached (${limit})`,
        retryAfter: this.getSecondsUntilMidnight()
      };
    }

    // Check account health
    const healthCheck = await this.complianceService.getComplianceMetrics(userId);
    
    if (healthCheck.accountHealth.riskLevel === 'HIGH') {
      return {
        allowed: false,
        reason: 'Account risk level too high for automation',
        retryAfter: 24 * 60 * 60 // 24 hours
      };
    }

    return { allowed: true };
  }

  /**
   * Process engagement tasks from queue
   */
  private async startEngagementProcessor(): Promise<void> {
    console.log('Starting LinkedIn engagement automation processor...');
    
    const processEngagements = async () => {
      try {
        const types = ['like', 'comment', 'view_profile', 'follow'];
        const priorities = ['high', 'normal', 'low'];
        
        // Process one task at a time across all queues
        for (const type of types) {
          for (const priority of priorities) {
            const queueKey = this.getEngagementQueueKey(type, priority);
            const taskData = await this.redis.brpop(queueKey, 1);
            
            if (taskData && taskData[1]) {
              const task: EngagementTask = JSON.parse(taskData[1]);
              await this.processEngagementTask(task);
              
              // Human-like delay between tasks
              const delay = this.generateEngagementDelay();
              await this.sleep(delay);
              
              // Process only one task per cycle to maintain natural patterns
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error in engagement processor:', error);
      }
      
      // Continue processing with a delay
      setTimeout(processEngagements, 10000); // 10 second cycle
    };

    processEngagements();
  }

  /**
   * Process individual engagement task
   */
  private async processEngagementTask(task: EngagementTask): Promise<void> {
    try {
      this.isProcessing.set(task.userId, true);
      task.status = 'processing';
      
      // Update in Redis
      await this.redis.setex(
        `engagement:${task.id}`,
        7 * 24 * 60 * 60,
        JSON.stringify(task)
      );

      // Final safety check
      const safetyCheck = await this.validateEngagementSafety(task.userId, task.type);
      if (!safetyCheck.allowed) {
        await this.handleFailedEngagement(task, safetyCheck.reason || 'Safety check failed');
        return;
      }

      // Prepare content if needed (for comments)
      if (task.type === 'comment') {
        task.content = await this.prepareComment(task);
      }

      // Execute the engagement action
      const result = await this.executeEngagement(task);

      if (result.success) {
        task.status = 'completed';
        task.processedAt = new Date();
        
        // Log successful engagement
        await this.complianceService.logRequest({
          userId: task.userId,
          endpoint: this.getEndpointForType(task.type),
          method: 'POST',
          statusCode: 200,
          responseTime: result.responseTime || 0,
          success: true
        });

        this.emit('engagementCompleted', {
          taskId: task.id,
          userId: task.userId,
          type: task.type,
          targetId: task.targetId
        });

        // Record engagement analytics
        await this.recordEngagementAnalytics(task);

      } else {
        await this.handleFailedEngagement(task, result.error || 'Unknown error');
      }

    } catch (error) {
      console.error('Error processing engagement task:', error);
      await this.handleFailedEngagement(task, `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isProcessing.set(task.userId, false);
    }
  }

  /**
   * Execute the actual engagement action
   */
  private async executeEngagement(task: EngagementTask): Promise<{ 
    success: boolean; 
    error?: string; 
    responseTime?: number 
  }> {
    const startTime = Date.now();
    
    try {
      const accessToken = await this.getAccessToken(task.userId);
      
      switch (task.type) {
        case 'like':
          await this.apiService.likePost(accessToken, task.userId, task.targetId);
          break;
          
        case 'comment':
          if (!task.content) {
            throw new Error('Comment content is required');
          }
          await this.apiService.commentOnPost(accessToken, task.userId, task.targetId, task.content);
          break;
          
        case 'view_profile':
          await this.apiService.viewProfile(accessToken, task.userId, task.targetId);
          break;
          
        case 'follow':
          await this.apiService.followUser(accessToken, task.userId, task.targetId);
          break;
          
        default:
          throw new Error(`Unsupported engagement type: ${task.type}`);
      }

      return {
        success: true,
        responseTime: Date.now() - startTime
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Log failed engagement
      await this.complianceService.logRequest({
        userId: task.userId,
        endpoint: this.getEndpointForType(task.type),
        method: 'POST',
        statusCode: error.response?.status || 0,
        responseTime,
        success: false
      });

      return {
        success: false,
        error: error.message || 'Unknown error',
        responseTime
      };
    }
  }

  /**
   * Prepare comment content using templates or AI
   */
  private async prepareComment(task: EngagementTask): Promise<string> {
    if (task.content) {
      return task.content;
    }

    if (task.templateId) {
      const template = await this.getCommentTemplate(task.templateId);
      if (template) {
        return this.renderCommentTemplate(template, task.metadata);
      }
    }

    // Generate intelligent comment based on post content
    return await this.generateIntelligentComment(task);
  }

  /**
   * Generate intelligent comment based on post analysis
   */
  private async generateIntelligentComment(task: EngagementTask): Promise<string> {
    // Safe default comments that add value
    const defaultComments = [
      "Thanks for sharing this valuable insight!",
      "Great perspective on this topic.",
      "This is really helpful, appreciate you sharing!",
      "Interesting points - thanks for the post!",
      "Well said! Thanks for sharing your thoughts.",
      "Valuable information, thank you for posting this.",
      "Great content - really appreciate this perspective!",
      "Thanks for the informative post!",
      "This is exactly what I needed to read today!",
      "Excellent insights, thanks for sharing!"
    ];

    // Select a comment based on content type or use random
    if (task.metadata?.contentType === 'article') {
      return "Thank you for sharing this insightful article!";
    } else if (task.metadata?.contentType === 'video') {
      return "Great video content - thanks for sharing!";
    }

    // Return a random appropriate comment
    return defaultComments[Math.floor(Math.random() * defaultComments.length)];
  }

  /**
   * Helper methods
   */
  private getDailyLimitForType(type: string): number {
    switch (type) {
      case 'like': return this.ENGAGEMENT_LIMITS.maxLikesPerDay;
      case 'comment': return this.ENGAGEMENT_LIMITS.maxCommentsPerDay;
      case 'view_profile': return this.ENGAGEMENT_LIMITS.maxProfileViewsPerDay;
      case 'follow': return this.ENGAGEMENT_LIMITS.maxFollowsPerDay;
      default: return 0;
    }
  }

  private getEndpointForType(type: string): string {
    switch (type) {
      case 'like': return '/v2/posts/{id}/likes';
      case 'comment': return '/v2/posts/{id}/comments';
      case 'view_profile': return '/v2/people/{id}';
      case 'follow': return '/v2/people/{id}/follow';
      default: return '/v2/unknown';
    }
  }

  private getEngagementQueueKey(type: string, priority: string): string {
    return `engagements:${type}:${priority}`;
  }

  private determinePriority(
    score: EngagementScoring, 
    requestedPriority?: string
  ): 'low' | 'normal' | 'high' {
    if (requestedPriority) {
      return requestedPriority as 'low' | 'normal' | 'high';
    }
    
    if (score.overallScore >= 90) return 'high';
    if (score.overallScore >= 75) return 'normal';
    return 'low';
  }

  private calculateOptimalDelay(): number {
    // Spread engagements throughout the day for natural patterns
    const now = new Date();
    const hour = now.getHours();
    
    // Avoid overnight hours (12 AM - 6 AM)
    if (hour >= 0 && hour < 6) {
      const hoursUntil9AM = (9 - hour) % 24;
      return hoursUntil9AM * 60 * 60 * 1000 + Math.random() * 60 * 60 * 1000;
    }
    
    // Random delay between 5 minutes and 2 hours during business hours
    return Math.random() * (2 * 60 * 60 * 1000) + (5 * 60 * 1000);
  }

  private generateEngagementDelay(): number {
    const { min, max } = {
      min: this.ENGAGEMENT_LIMITS.minDelayBetweenActions,
      max: this.ENGAGEMENT_LIMITS.maxDelayBetweenActions
    };
    
    return min + Math.random() * (max - min);
  }

  private async getDailyEngagementCount(userId: string, type: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `engagement:daily:${userId}:${type}:${today}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0');
  }

  private async updateDailyEngagementCount(userId: string, type: string, increment: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `engagement:daily:${userId}:${type}:${today}`;
    await this.redis.incrby(key, increment);
    await this.redis.expire(key, 25 * 60 * 60);
  }

  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  private isRelatedIndustry(industry1: string, industry2: string): boolean {
    // Simple industry relationship mapping
    const relatedIndustries: { [key: string]: string[] } = {
      'technology': ['software', 'it services', 'computer software', 'internet'],
      'finance': ['banking', 'investment', 'financial services', 'fintech'],
      'healthcare': ['medical', 'pharmaceuticals', 'biotechnology', 'hospital'],
      'education': ['e-learning', 'training', 'university', 'academic'],
      'marketing': ['advertising', 'digital marketing', 'public relations', 'media']
    };

    for (const [category, industries] of Object.entries(relatedIndustries)) {
      if (industries.some(ind => 
        industry1.toLowerCase().includes(ind) && industry2.toLowerCase().includes(ind)
      )) {
        return true;
      }
    }
    return false;
  }

  private isSimilarCompanySize(size1: string, size2: string): boolean {
    const sizeMap: { [key: string]: number } = {
      'startup': 1,
      'small': 2,
      'medium': 3,
      'large': 4,
      'enterprise': 5
    };
    
    const diff = Math.abs((sizeMap[size1] || 0) - (sizeMap[size2] || 0));
    return diff <= 1;
  }

  private async handleFailedEngagement(task: EngagementTask, error: string): Promise<void> {
    task.status = 'failed';
    task.error = error;
    task.retryCount++;

    // Check if should retry
    if (task.retryCount <= this.ENGAGEMENT_LIMITS.maxRetries && !this.isPermanentError(error)) {
      // Schedule retry with delay
      const retryDelay = Math.pow(2, task.retryCount) * 60000;
      task.scheduledAt = new Date(Date.now() + retryDelay);
      task.status = 'pending';
      
      // Re-queue for retry
      const queueKey = this.getEngagementQueueKey(task.type, 'low');
      await this.redis.lpush(queueKey, JSON.stringify(task));
    }

    await this.redis.setex(`engagement:${task.id}`, 7 * 24 * 60 * 60, JSON.stringify(task));

    this.emit('engagementFailed', {
      taskId: task.id,
      userId: task.userId,
      type: task.type,
      error,
      willRetry: task.status === 'pending'
    });
  }

  private isPermanentError(error: string): boolean {
    const permanentErrors = [
      'Permission denied',
      'Account restricted',
      'Content not found',
      'Already liked',
      'Already following'
    ];
    return permanentErrors.some(perm => error.includes(perm));
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Placeholder methods - implement based on your existing services
  private async getAccessToken(userId: string): Promise<string> {
    const key = `linkedin_tokens:${userId}`;
    const tokenData = await this.redis.get(key);
    if (!tokenData) {
      throw new Error('LinkedIn access token not found');
    }
    const tokens = JSON.parse(tokenData);
    return tokens.accessToken;
  }

  private async getUserProfile(userId: string): Promise<any> {
    // TODO: Implement user profile retrieval
    return {
      industry: 'technology',
      skills: ['javascript', 'nodejs', 'react'],
      companySize: 'medium'
    };
  }

  private async getCommentTemplate(templateId: string): Promise<CommentTemplate | null> {
    const templateKey = `comment_template:${templateId}`;
    const templateData = await this.redis.get(templateKey);
    return templateData ? JSON.parse(templateData) : null;
  }

  private renderCommentTemplate(template: CommentTemplate, metadata: any): string {
    let comment = template.text;
    
    template.variables.forEach(variable => {
      const value = metadata?.[variable] || `[${variable}]`;
      comment = comment.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
    });
    
    return comment;
  }

  private async recordEngagementAnalytics(task: EngagementTask): Promise<void> {
    const analyticsKey = `engagement_analytics:${task.userId}:${new Date().toISOString().split('T')[0]}`;
    
    const analytics = {
      type: task.type,
      targetId: task.targetId,
      timestamp: new Date().toISOString(),
      success: true
    };
    
    await this.redis.lpush(analyticsKey, JSON.stringify(analytics));
    await this.redis.expire(analyticsKey, 30 * 24 * 60 * 60); // Keep for 30 days
  }

  /**
   * Get engagement statistics
   */
  async getEngagementStats(userId: string): Promise<{
    today: {
      likes: { sent: number; remaining: number };
      comments: { sent: number; remaining: number };
      profileViews: { sent: number; remaining: number };
      follows: { sent: number; remaining: number };
    };
    accountHealth: {
      score: number;
      status: string;
      warnings: string[];
    };
  }> {
    const types = ['like', 'comment', 'view_profile', 'follow'];
    const todayStats: any = {};

    for (const type of types) {
      const sent = await this.getDailyEngagementCount(userId, type);
      const limit = this.getDailyLimitForType(type);
      const key = type === 'view_profile' ? 'profileViews' : 
                  type === 'like' ? 'likes' :
                  type === 'comment' ? 'comments' : 'follows';
      
      todayStats[key] = {
        sent,
        remaining: Math.max(0, limit - sent)
      };
    }

    const compliance = await this.complianceService.getComplianceMetrics(userId);

    return {
      today: todayStats,
      accountHealth: {
        score: compliance.accountHealth.score,
        status: compliance.accountHealth.riskLevel,
        warnings: compliance.accountHealth.warnings
      }
    };
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}