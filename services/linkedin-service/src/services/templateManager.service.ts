// ===================================================================
// TEMPLATE MANAGER SERVICE - Message Templates for LinkedIn Automation
// ===================================================================

import Redis from 'ioredis';

interface ConnectionTemplate {
  id: string;
  name: string;
  subject?: string;
  message: string;
  variables: string[]; // e.g., ['firstName', 'company', 'mutualConnections']
  category: 'general' | 'recruitment' | 'sales' | 'networking';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  usage: {
    totalSent: number;
    successRate: number;
    lastUsed?: Date;
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
  createdAt: Date;
  updatedAt: Date;
  usage: {
    totalUsed: number;
    engagementRate: number;
    lastUsed?: Date;
  };
}

export class LinkedInTemplateManagerService extends EventEmitter {
  private redis: Redis;
  private defaultTemplates: Map<string, ConnectionTemplate>;
  private templatePerformance: Map<string, TemplatePerformanceMetrics>;
  
  // Template categories for better organization
  private readonly TEMPLATE_CATEGORIES = [
    'professional_introduction',
    'industry_specific',
    'mutual_connection',
    'company_interest',
    'content_appreciation',
    'event_networking',
    'job_opportunity',
    'collaboration_request'
  ];

  // Performance tracking thresholds
  private readonly PERFORMANCE_THRESHOLDS = {
    minimumSample: 10,        // Minimum uses before calculating performance
    excellentRate: 0.8,       // 80%+ acceptance rate
    goodRate: 0.6,           // 60%+ acceptance rate
    poorRate: 0.3,           // Below 30% acceptance rate
    staleThreshold: 30,       // Days before template is considered stale
  };

  constructor() {
    super();
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.defaultTemplates = new Map();
    this.templatePerformance = new Map();
    
    this.initializeDefaultTemplates();
    this.startPerformanceTracking();
  }

  /**
   * Initialize default high-performing templates
   */
  private initializeDefaultTemplates(): void {
    const templates: ConnectionTemplate[] = [
      {
        id: 'professional_intro_1',
        name: 'Professional Introduction - Standard',
        category: 'professional_introduction',
        message: 'Hi {firstName}, I noticed we work in similar {industry} roles. I\'d love to connect and potentially share insights about {topic}.',
        variables: ['firstName', 'industry', 'topic'],
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          tone: 'professional',
          length: 'short',
          personalization: 'medium'
        }
      },
      {
        id: 'mutual_connection_1',
        name: 'Mutual Connection Reference',
        category: 'mutual_connection',
        message: 'Hi {firstName}, I see we\'re both connected to {mutualConnection}. I\'d appreciate the opportunity to connect with you as well.',
        variables: ['firstName', 'mutualConnection'],
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          tone: 'friendly',
          length: 'short',
          personalization: 'high'
        }
      },
      {
        id: 'company_interest_1',
        name: 'Company Interest - Genuine',
        category: 'company_interest',
        message: 'Hi {firstName}, I\'ve been following {company}\'s work in {industry} and am impressed by your recent {achievement}. Would love to connect!',
        variables: ['firstName', 'company', 'industry', 'achievement'],
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          tone: 'enthusiastic',
          length: 'medium',
          personalization: 'high'
        }
      },
      {
        id: 'content_appreciation_1',
        name: 'Content Appreciation',
        category: 'content_appreciation',
        message: 'Hi {firstName}, I really enjoyed your recent post about {postTopic}. Your insights on {specificPoint} were particularly valuable. I\'d love to connect!',
        variables: ['firstName', 'postTopic', 'specificPoint'],
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          tone: 'appreciative',
          length: 'medium',
          personalization: 'very_high'
        }
      },
      {
        id: 'event_networking_1',
        name: 'Event Networking',
        category: 'event_networking',
        message: 'Hi {firstName}, I believe we may have crossed paths at {eventName}. I\'d love to continue our conversation about {discussionTopic}.',
        variables: ['firstName', 'eventName', 'discussionTopic'],
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          tone: 'familiar',
          length: 'short',
          personalization: 'very_high'
        }
      },
      {
        id: 'collaboration_1',
        name: 'Collaboration Interest',
        category: 'collaboration_request',
        message: 'Hi {firstName}, I admire your expertise in {skillArea}. I\'m working on {projectType} and would value your perspective. Would you be open to connecting?',
        variables: ['firstName', 'skillArea', 'projectType'],
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          tone: 'respectful',
          length: 'medium',
          personalization: 'high'
        }
      }
    ];

    templates.forEach(template => {
      this.defaultTemplates.set(template.id, template);
    });

    console.log(`Initialized ${templates.length} default connection templates`);
  }

  /**
   * Get all templates for a user with performance metrics
   */
  async getUserTemplates(userId: string): Promise<{
    userTemplates: ConnectionTemplate[];
    defaultTemplates: ConnectionTemplate[];
    performanceMetrics: { [templateId: string]: TemplatePerformanceMetrics };
    recommendations: TemplateRecommendation[];
  }> {
    try {
      // Get user's custom templates
      const userTemplateKeys = await this.redis.keys(`template:${userId}:*`);
      const userTemplates = await Promise.all(
        userTemplateKeys.map(async key => {
          const data = await this.redis.get(key);
          return data ? JSON.parse(data) : null;
        })
      );

      // Get performance metrics for all templates
      const allTemplateIds = [
        ...userTemplates.filter(t => t).map(t => t.id),
        ...Array.from(this.defaultTemplates.keys())
      ];

      const performanceMetrics: { [templateId: string]: TemplatePerformanceMetrics } = {};
      for (const templateId of allTemplateIds) {
        const metrics = await this.getTemplatePerformance(userId, templateId);
        if (metrics) {
          performanceMetrics[templateId] = metrics;
        }
      }

      // Generate recommendations
      const recommendations = await this.generateTemplateRecommendations(userId, performanceMetrics);

      return {
        userTemplates: userTemplates.filter(t => t && t.isActive),
        defaultTemplates: Array.from(this.defaultTemplates.values()).filter(t => t.isActive),
        performanceMetrics,
        recommendations
      };

    } catch (error) {
      console.error(`Error fetching templates for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new custom template for a user
   */
  async createUserTemplate(
    userId: string,
    templateData: {
      name: string;
      category: string;
      message: string;
      variables: string[];
      metadata?: any;
    }
  ): Promise<{ success: boolean; templateId?: string; reason?: string }> {
    try {
      // Validate template
      const validation = this.validateTemplate(templateData);
      if (!validation.valid) {
        return { success: false, reason: validation.reason };
      }

      // Check user template limit (based on subscription)
      const templateCount = await this.getUserTemplateCount(userId);
      const limit = await this.getUserTemplateLimit(userId);
      
      if (templateCount >= limit) {
        return { 
          success: false, 
          reason: `Template limit reached (${templateCount}/${limit}). Upgrade subscription for more templates.` 
        };
      }

      const templateId = `user_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const template: ConnectionTemplate = {
        id: templateId,
        userId,
        name: templateData.name,
        category: templateData.category,
        message: templateData.message,
        variables: templateData.variables,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: templateData.metadata || {}
      };

      // Store template
      await this.redis.setex(
        `template:${userId}:${templateId}`,
        365 * 24 * 60 * 60, // 1 year
        JSON.stringify(template)
      );

      // Initialize performance tracking
      await this.initializeTemplatePerformance(userId, templateId);

      this.emit('templateCreated', { userId, templateId, template });
      console.log(`Custom template created: ${templateId} for user ${userId}`);

      return { success: true, templateId };

    } catch (error) {
      console.error(`Error creating template for user ${userId}:`, error);
      return { success: false, reason: 'Internal error creating template' };
    }
  }

  /**
   * Update an existing template
   */
  async updateUserTemplate(
    userId: string,
    templateId: string,
    updates: Partial<{
      name: string;
      category: string;
      message: string;
      variables: string[];
      isActive: boolean;
      metadata: any;
    }>
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Get existing template
      const existingTemplate = await this.getUserTemplate(userId, templateId);
      if (!existingTemplate) {
        return { success: false, reason: 'Template not found' };
      }

      // Validate ownership (for user templates)
      if (!existingTemplate.isDefault && existingTemplate.userId !== userId) {
        return { success: false, reason: 'Unauthorized' };
      }

      // Can't modify default templates directly
      if (existingTemplate.isDefault) {
        return { success: false, reason: 'Cannot modify default templates' };
      }

      // Validate updates
      if (updates.message || updates.variables) {
        const validation = this.validateTemplate({
          name: updates.name || existingTemplate.name,
          category: updates.category || existingTemplate.category,
          message: updates.message || existingTemplate.message,
          variables: updates.variables || existingTemplate.variables
        });
        
        if (!validation.valid) {
          return { success: false, reason: validation.reason };
        }
      }

      // Apply updates
      const updatedTemplate: ConnectionTemplate = {
        ...existingTemplate,
        ...updates,
        updatedAt: new Date()
      };

      // Store updated template
      await this.redis.setex(
        `template:${userId}:${templateId}`,
        365 * 24 * 60 * 60, // 1 year
        JSON.stringify(updatedTemplate)
      );

      this.emit('templateUpdated', { userId, templateId, updates });
      console.log(`Template updated: ${templateId} for user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error(`Error updating template ${templateId} for user ${userId}:`, error);
      return { success: false, reason: 'Internal error updating template' };
    }
  }

  /**
   * Delete a user template
   */
  async deleteUserTemplate(userId: string, templateId: string): Promise<{ success: boolean; reason?: string }> {
    try {
      // Get template to check ownership
      const template = await this.getUserTemplate(userId, templateId);
      if (!template) {
        return { success: false, reason: 'Template not found' };
      }

      // Can't delete default templates
      if (template.isDefault) {
        return { success: false, reason: 'Cannot delete default templates' };
      }

      // Validate ownership
      if (template.userId !== userId) {
        return { success: false, reason: 'Unauthorized' };
      }

      // Delete template
      await this.redis.del(`template:${userId}:${templateId}`);
      
      // Clean up performance data
      await this.redis.del(`template_performance:${userId}:${templateId}`);

      this.emit('templateDeleted', { userId, templateId });
      console.log(`Template deleted: ${templateId} for user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error(`Error deleting template ${templateId} for user ${userId}:`, error);
      return { success: false, reason: 'Internal error deleting template' };
    }
  }

  /**
   * Record template usage and outcome for performance tracking
   */
  async recordTemplateUsage(
    userId: string,
    templateId: string,
    outcome: 'sent' | 'accepted' | 'declined' | 'ignored' | 'error',
    metadata?: {
      targetProfileId?: string;
      targetIndustry?: string;
      targetCompany?: string;
      responseTime?: number;
      connectionContext?: string;
    }
  ): Promise<void> {
    try {
      const usageRecord = {
        userId,
        templateId,
        outcome,
        timestamp: new Date(),
        metadata: metadata || {}
      };

      // Store individual usage record
      const recordId = `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.redis.setex(
        `template_usage:${userId}:${templateId}:${recordId}`,
        90 * 24 * 60 * 60, // 90 days retention
        JSON.stringify(usageRecord)
      );

      // Update aggregated performance metrics
      await this.updateTemplatePerformanceMetrics(userId, templateId, outcome, metadata);

      // Check if template performance warrants notification
      await this.checkTemplatePerformanceAlerts(userId, templateId);

      this.emit('templateUsageRecorded', { userId, templateId, outcome });

    } catch (error) {
      console.error(`Error recording template usage for ${templateId}:`, error);
    }
  }

  /**
   * Get detailed template performance analytics
   */
  async getTemplateAnalytics(userId: string, templateId?: string): Promise<{
    overallPerformance: {
      totalTemplates: number;
      averageAcceptanceRate: number;
      totalUsage: number;
      topPerformingTemplate: { id: string; name: string; acceptanceRate: number; } | null;
      worstPerformingTemplate: { id: string; name: string; acceptanceRate: number; } | null;
    };
    templateDetails: TemplateAnalytics[];
    trends: {
      dailyUsage: { date: string; sent: number; accepted: number; }[];
      categoryPerformance: { category: string; acceptanceRate: number; usage: number; }[];
      industryInsights: { industry: string; bestTemplate: string; acceptanceRate: number; }[];
    };
    recommendations: TemplateRecommendation[];
  }> {
    try {
      // Get all templates for the user
      const userTemplates = await this.getUserTemplates(userId);
      const allTemplates = [
        ...userTemplates.userTemplates,
        ...userTemplates.defaultTemplates
      ];

      // Filter by specific template if requested
      const templatesToAnalyze = templateId 
        ? allTemplates.filter(t => t.id === templateId)
        : allTemplates;

      // Calculate analytics for each template
      const templateDetails: TemplateAnalytics[] = [];
      let totalUsage = 0;
      let totalAccepted = 0;

      for (const template of templatesToAnalyze) {
        const analytics = await this.calculateTemplateAnalytics(userId, template);
        templateDetails.push(analytics);
        totalUsage += analytics.totalUsage;
        totalAccepted += analytics.accepted;
      }

      // Overall performance metrics
      const averageAcceptanceRate = totalUsage > 0 ? (totalAccepted / totalUsage) * 100 : 0;
      
      const sortedByPerformance = templateDetails
        .filter(t => t.totalUsage >= this.PERFORMANCE_THRESHOLDS.minimumSample)
        .sort((a, b) => b.acceptanceRate - a.acceptanceRate);

      const overallPerformance = {
        totalTemplates: templateDetails.length,
        averageAcceptanceRate: Math.round(averageAcceptanceRate * 100) / 100,
        totalUsage,
        topPerformingTemplate: sortedByPerformance[0] ? {
          id: sortedByPerformance[0].templateId,
          name: sortedByPerformance[0].templateName,
          acceptanceRate: sortedByPerformance[0].acceptanceRate
        } : null,
        worstPerformingTemplate: sortedByPerformance.length > 0 ? {
          id: sortedByPerformance[sortedByPerformance.length - 1].templateId,
          name: sortedByPerformance[sortedByPerformance.length - 1].templateName,
          acceptanceRate: sortedByPerformance[sortedByPerformance.length - 1].acceptanceRate
        } : null
      };

      // Generate trends
      const trends = await this.generateAnalyticsTrends(userId, templateDetails);

      // Generate recommendations
      const recommendations = await this.generateTemplateRecommendations(userId, userTemplates.performanceMetrics);

      return {
        overallPerformance,
        templateDetails,
        trends,
        recommendations
      };

    } catch (error) {
      console.error(`Error generating template analytics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get template recommendations based on performance and trends
   */
  async getTemplateRecommendations(userId: string): Promise<TemplateRecommendation[]> {
    try {
      const userTemplates = await this.getUserTemplates(userId);
      return await this.generateTemplateRecommendations(userId, userTemplates.performanceMetrics);
    } catch (error) {
      console.error(`Error generating recommendations for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get the best performing template for a specific context
   */
  async getBestTemplateForContext(
    userId: string,
    context: {
      industry?: string;
      company?: string;
      mutualConnections?: boolean;
      recentContent?: boolean;
      eventContext?: boolean;
    }
  ): Promise<{ template: ConnectionTemplate; confidence: number; reason: string; } | null> {
    try {
      const userTemplates = await this.getUserTemplates(userId);
      const allTemplates = [
        ...userTemplates.userTemplates,
        ...userTemplates.defaultTemplates
      ];

      // Score templates based on context and performance
      const scoredTemplates = [];

      for (const template of allTemplates) {
        const performance = userTemplates.performanceMetrics[template.id];
        let contextScore = 0;
        let reasons = [];

        // Category matching
        if (context.mutualConnections && template.category === 'mutual_connection') {
          contextScore += 30;
          reasons.push('matches mutual connection context');
        }
        if (context.recentContent && template.category === 'content_appreciation') {
          contextScore += 25;
          reasons.push('optimized for content engagement');
        }
        if (context.eventContext && template.category === 'event_networking') {
          contextScore += 25;
          reasons.push('designed for event networking');
        }
        if (context.company && template.category === 'company_interest') {
          contextScore += 20;
          reasons.push('targets company-specific connections');
        }

        // Industry-specific performance
        if (context.industry && performance?.performanceByIndustry?.[context.industry]) {
          const industryPerformance = performance.performanceByIndustry[context.industry];
          contextScore += Math.min(industryPerformance.acceptanceRate * 20, 20);
          reasons.push(`${industryPerformance.acceptanceRate.toFixed(1)}% success rate in ${context.industry}`);
        }

        // Overall performance score
        const performanceScore = performance ? Math.min(performance.acceptanceRate * 30, 30) : 10;
        contextScore += performanceScore;

        if (performance?.acceptanceRate && performance.acceptanceRate > this.PERFORMANCE_THRESHOLDS.excellentRate) {
          reasons.push(`excellent ${(performance.acceptanceRate * 100).toFixed(1)}% acceptance rate`);
        }

        // Minimum usage requirement
        if (performance && performance.totalUsage < this.PERFORMANCE_THRESHOLDS.minimumSample) {
          contextScore *= 0.7; // Reduce confidence for templates with limited data
          reasons.push('limited usage data');
        }

        if (contextScore > 0) {
          scoredTemplates.push({
            template,
            score: contextScore,
            confidence: Math.min(contextScore / 100, 1),
            reason: reasons.join(', ')
          });
        }
      }

      // Return the highest scoring template
      if (scoredTemplates.length === 0) {
        return null;
      }

      scoredTemplates.sort((a, b) => b.score - a.score);
      const best = scoredTemplates[0];

      return {
        template: best.template,
        confidence: best.confidence,
        reason: best.reason
      };

    } catch (error) {
      console.error(`Error finding best template for context:`, error);
      return null;
    }
  }

  // Private helper methods

  private validateTemplate(templateData: {
    name: string;
    category: string;
    message: string;
    variables: string[];
  }): { valid: boolean; reason?: string } {
    
    if (!templateData.name || templateData.name.trim().length < 3) {
      return { valid: false, reason: 'Template name must be at least 3 characters' };
    }

    if (!this.TEMPLATE_CATEGORIES.includes(templateData.category)) {
      return { valid: false, reason: 'Invalid template category' };
    }

    if (!templateData.message || templateData.message.trim().length < 10) {
      return { valid: false, reason: 'Template message must be at least 10 characters' };
    }

    if (templateData.message.length > 300) {
      return { valid: false, reason: 'Template message must be under 300 characters (LinkedIn limit)' };
    }

    // Check that all variables in message are declared
    const messageVariables = templateData.message.match(/\{([^}]+)\}/g) || [];
    const declaredVariables = templateData.variables.map(v => `{${v}}`);
    
    for (const variable of messageVariables) {
      if (!declaredVariables.includes(variable)) {
        return { valid: false, reason: `Variable ${variable} used in message but not declared` };
      }
    }

    // Check for potentially spammy content
    const spamIndicators = ['guaranteed', 'urgent', 'limited time', 'act now', 'free money'];
    const lowerMessage = templateData.message.toLowerCase();
    
    for (const indicator of spamIndicators) {
      if (lowerMessage.includes(indicator)) {
        return { valid: false, reason: `Template contains potentially spammy content: "${indicator}"` };
      }
    }

    return { valid: true };
  }

  private async getUserTemplateCount(userId: string): Promise<number> {
    const keys = await this.redis.keys(`template:${userId}:*`);
    return keys.length;
  }

  private async getUserTemplateLimit(userId: string): Promise<number> {
    // Get user subscription tier
    const userData = await this.redis.get(`user:${userId}`);
    if (!userData) return 5; // Default limit

    const user = JSON.parse(userData);
    
    switch (user.subscriptionTier) {
      case 'FREE': return 5;
      case 'BASIC': return 15;
      case 'PRO': return 50;
      case 'ENTERPRISE': return 200;
      default: return 5;
    }
  }

  private async getUserTemplate(userId: string, templateId: string): Promise<ConnectionTemplate | null> {
    // Check user templates
    const userData = await this.redis.get(`template:${userId}:${templateId}`);
    if (userData) {
      return JSON.parse(userData);
    }

    // Check default templates
    return this.defaultTemplates.get(templateId) || null;
  }

  private async initializeTemplatePerformance(userId: string, templateId: string): Promise<void> {
    const performance: TemplatePerformanceMetrics = {
      templateId,
      userId,
      totalUsage: 0,
      sent: 0,
      accepted: 0,
      declined: 0,
      ignored: 0,
      errors: 0,
      acceptanceRate: 0,
      responseRate: 0,
      averageResponseTime: 0,
      lastUsed: null,
      createdAt: new Date(),
      performanceByIndustry: {},
      performanceByDay: {},
      trend: 'stable'
    };

    await this.redis.setex(
      `template_performance:${userId}:${templateId}`,
      365 * 24 * 60 * 60, // 1 year
      JSON.stringify(performance)
    );
  }

  private async getTemplatePerformance(userId: string, templateId: string): Promise<TemplatePerformanceMetrics | null> {
    const data = await this.redis.get(`template_performance:${userId}:${templateId}`);
    return data ? JSON.parse(data) : null;
  }

  private async updateTemplatePerformanceMetrics(
    userId: string,
    templateId: string,
    outcome: string,
    metadata?: any
  ): Promise<void> {
    let performance = await this.getTemplatePerformance(userId, templateId);
    
    if (!performance) {
      await this.initializeTemplatePerformance(userId, templateId);
      performance = await this.getTemplatePerformance(userId, templateId);
      if (!performance) return;
    }

    // Update counters
    performance.totalUsage++;
    performance[outcome as keyof TemplatePerformanceMetrics] = (performance[outcome as keyof TemplatePerformanceMetrics] as number || 0) + 1;
    performance.lastUsed = new Date();

    // Update rates
    performance.acceptanceRate = performance.totalUsage > 0 ? (performance.accepted / performance.totalUsage) : 0;
    performance.responseRate = performance.totalUsage > 0 ? 
      ((performance.accepted + performance.declined) / performance.totalUsage) : 0;

    // Update industry-specific performance
    if (metadata?.targetIndustry) {
      const industry = metadata.targetIndustry;
      if (!performance.performanceByIndustry[industry]) {
        performance.performanceByIndustry[industry] = {
          usage: 0,
          accepted: 0,
          acceptanceRate: 0
        };
      }
      
      performance.performanceByIndustry[industry].usage++;
      if (outcome === 'accepted') {
        performance.performanceByIndustry[industry].accepted++;
      }
      performance.performanceByIndustry[industry].acceptanceRate = 
        performance.performanceByIndustry[industry].accepted / performance.performanceByIndustry[industry].usage;
    }

    // Update daily performance
    const today = new Date().toISOString().split('T')[0];
    if (!performance.performanceByDay[today]) {
      performance.performanceByDay[today] = { usage: 0, accepted: 0 };
    }
    performance.performanceByDay[today].usage++;
    if (outcome === 'accepted') {
      performance.performanceByDay[today].accepted++;
    }

    // Calculate trend (simple 7-day comparison)
    const dates = Object.keys(performance.performanceByDay).sort().slice(-14);
    if (dates.length >= 7) {
      const recentWeek = dates.slice(-7);
      const previousWeek = dates.slice(-14, -7);
      
      const recentRate = recentWeek.reduce((sum, date) => {
        const day = performance!.performanceByDay[date];
        return sum + (day.usage > 0 ? day.accepted / day.usage : 0);
      }, 0) / recentWeek.length;

      const previousRate = previousWeek.reduce((sum, date) => {
        const day = performance!.performanceByDay[date];
        return sum + (day.usage > 0 ? day.accepted / day.usage : 0);
      }, 0) / previousWeek.length;

      if (recentRate > previousRate * 1.1) {
        performance.trend = 'improving';
      } else if (recentRate < previousRate * 0.9) {
        performance.trend = 'declining';
      } else {
        performance.trend = 'stable';
      }
    }

    // Store updated performance
    await this.redis.setex(
      `template_performance:${userId}:${templateId}`,
      365 * 24 * 60 * 60, // 1 year
      JSON.stringify(performance)
    );
  }

  private async checkTemplatePerformanceAlerts(userId: string, templateId: string): Promise<void> {
    const performance = await this.getTemplatePerformance(userId, templateId);
    if (!performance || performance.totalUsage < this.PERFORMANCE_THRESHOLDS.minimumSample) {
      return;
    }

    // Alert for poor performance
    if (performance.acceptanceRate < this.PERFORMANCE_THRESHOLDS.poorRate) {
      this.emit('templateAlert', {
        userId,
        templateId,
        type: 'poor_performance',
        message: `Template has low acceptance rate: ${(performance.acceptanceRate * 100).toFixed(1)}%`,
        performance
      });
    }

    // Alert for excellent performance
    if (performance.acceptanceRate > this.PERFORMANCE_THRESHOLDS.excellentRate && performance.totalUsage >= 20) {
      this.emit('templateAlert', {
        userId,
        templateId,
        type: 'excellent_performance',
        message: `Template performing excellently: ${(performance.acceptanceRate * 100).toFixed(1)}% acceptance rate`,
        performance
      });
    }

    // Alert for declining performance
    if (performance.trend === 'declining' && performance.acceptanceRate < this.PERFORMANCE_THRESHOLDS.goodRate) {
      this.emit('templateAlert', {
        userId,
        templateId,
        type: 'declining_performance',
        message: `Template performance is declining`,
        performance
      });
    }
  }

  private async calculateTemplateAnalytics(userId: string, template: ConnectionTemplate): Promise<TemplateAnalytics> {
    const performance = await this.getTemplatePerformance(userId, template.id);
    
    if (!performance) {
      return {
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        totalUsage: 0,
        sent: 0,
        accepted: 0,
        declined: 0,
        ignored: 0,
        errors: 0,
        acceptanceRate: 0,
        responseRate: 0,
        averageResponseTime: 0,
        lastUsed: null,
        trend: 'stable',
        performanceRating: 'unknown'
      };
    }

    let performanceRating: 'excellent' | 'good' | 'average' | 'poor' | 'unknown' = 'unknown';
    
    if (performance.totalUsage >= this.PERFORMANCE_THRESHOLDS.minimumSample) {
      if (performance.acceptanceRate >= this.PERFORMANCE_THRESHOLDS.excellentRate) {
        performanceRating = 'excellent';
      } else if (performance.acceptanceRate >= this.PERFORMANCE_THRESHOLDS.goodRate) {
        performanceRating = 'good';
      } else if (performance.acceptanceRate >= this.PERFORMANCE_THRESHOLDS.poorRate) {
        performanceRating = 'average';
      } else {
        performanceRating = 'poor';
      }
    }

    return {
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      totalUsage: performance.totalUsage,
      sent: performance.sent,
      accepted: performance.accepted,
      declined: performance.declined,
      ignored: performance.ignored,
      errors: performance.errors,
      acceptanceRate: Math.round(performance.acceptanceRate * 10000) / 100, // Round to 2 decimal places
      responseRate: Math.round(performance.responseRate * 10000) / 100,
      averageResponseTime: performance.averageResponseTime,
      lastUsed: performance.lastUsed,
      trend: performance.trend,
      performanceRating
    };
  }

  private async generateAnalyticsTrends(userId: string, templateDetails: TemplateAnalytics[]): Promise<{
    dailyUsage: { date: string; sent: number; accepted: number; }[];
    categoryPerformance: { category: string; acceptanceRate: number; usage: number; }[];
    industryInsights: { industry: string; bestTemplate: string; acceptanceRate: number; }[];
  }> {
    // Generate daily usage trends (last 30 days)
    const dailyUsage: { date: string; sent: number; accepted: number; }[] = [];
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    for (const date of last30Days) {
      let sent = 0;
      let accepted = 0;
      
      // Aggregate from all templates
      for (const template of templateDetails) {
        const performance = await this.getTemplatePerformance(userId, template.templateId);
        if (performance?.performanceByDay[date]) {
          sent += performance.performanceByDay[date].usage;
          accepted += performance.performanceByDay[date].accepted;
        }
      }
      
      dailyUsage.push({ date, sent, accepted });
    }

    // Category performance analysis
    const categoryStats = new Map<string, { usage: number; accepted: number; }>();
    
    for (const template of templateDetails) {
      const existing = categoryStats.get(template.category) || { usage: 0, accepted: 0 };
      existing.usage += template.totalUsage;
      existing.accepted += template.accepted;
      categoryStats.set(template.category, existing);
    }

    const categoryPerformance = Array.from(categoryStats.entries()).map(([category, stats]) => ({
      category,
      acceptanceRate: stats.usage > 0 ? Math.round((stats.accepted / stats.usage) * 10000) / 100 : 0,
      usage: stats.usage
    })).sort((a, b) => b.acceptanceRate - a.acceptanceRate);

    // Industry insights (simplified - would need more detailed tracking)
    const industryInsights: { industry: string; bestTemplate: string; acceptanceRate: number; }[] = [];

    return {
      dailyUsage,
      categoryPerformance,
      industryInsights
    };
  }

  private async generateTemplateRecommendations(
    userId: string, 
    performanceMetrics: { [templateId: string]: TemplatePerformanceMetrics }
  ): Promise<TemplateRecommendation[]> {
    const recommendations: TemplateRecommendation[] = [];

    // Analyze existing templates for patterns
    const templates = Object.values(performanceMetrics);
    const activeTemplates = templates.filter(t => t.totalUsage >= this.PERFORMANCE_THRESHOLDS.minimumSample);

    if (activeTemplates.length === 0) {
      recommendations.push({
        type: 'create_template',
        title: 'Start Using Templates',
        description: 'Begin tracking template performance by using our default templates.',
        priority: 'high',
        actionItems: [
          'Try the "Professional Introduction" template',
          'Use "Mutual Connection Reference" when you have shared connections',
          'Track results to see what works best for your network'
        ]
      });
      return recommendations;
    }

    // Find poor performing templates
    const poorTemplates = activeTemplates.filter(t => t.acceptanceRate < this.PERFORMANCE_THRESHOLDS.poorRate);
    if (poorTemplates.length > 0) {
      recommendations.push({
        type: 'improve_template',
        title: 'Improve Low-Performing Templates',
        description: `${poorTemplates.length} template(s) have acceptance rates below 30%.`,
        priority: 'high',
        actionItems: [
          'Review and rewrite underperforming templates',
          'Add more personalization variables',
          'Consider archiving templates with consistently poor performance',
          'Test new variations of successful templates'
        ]
      });
    }

    // Check for missing categories
    const usedCategories = new Set(activeTemplates.map(t => {
      // Get template category from template data
      return 'professional_introduction'; // Placeholder
    }));

    const missingImportantCategories = ['mutual_connection', 'content_appreciation', 'company_interest']
      .filter(cat => !usedCategories.has(cat));

    if (missingImportantCategories.length > 0) {
      recommendations.push({
        type: 'create_template',
        title: 'Expand Template Variety',
        description: `Consider creating templates for: ${missingImportantCategories.join(', ')}.`,
        priority: 'medium',
        actionItems: missingImportantCategories.map(cat => 
          `Create a template for ${cat.replace('_', ' ')}`
        )
      });
    }

    // Find excellent templates to replicate
    const excellentTemplates = activeTemplates.filter(t => t.acceptanceRate > this.PERFORMANCE_THRESHOLDS.excellentRate);
    if (excellentTemplates.length > 0) {
      recommendations.push({
        type: 'optimize_template',
        title: 'Replicate Success Patterns',
        description: `${excellentTemplates.length} template(s) have excellent performance. Use similar patterns.`,
        priority: 'medium',
        actionItems: [
          'Analyze what makes your top templates successful',
          'Create variations of high-performing templates',
          'Apply successful patterns to underperforming templates'
        ]
      });
    }

    // Check for stale templates
    const now = new Date();
    const staleTemplates = activeTemplates.filter(t => {
      if (!t.lastUsed) return true;
      const daysSinceUse = (now.getTime() - new Date(t.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUse > this.PERFORMANCE_THRESHOLDS.staleThreshold;
    });

    if (staleTemplates.length > 0) {
      recommendations.push({
        type: 'archive_template',
        title: 'Archive Unused Templates',
        description: `${staleTemplates.length} template(s) haven't been used recently.`,
        priority: 'low',
        actionItems: [
          'Review templates not used in the last 30 days',
          'Archive or update outdated templates',
          'Focus on templates that are actively performing well'
        ]
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private startPerformanceTracking(): void {
    // Clean up old performance data periodically
    setInterval(async () => {
      try {
        await this.cleanupOldPerformanceData();
      } catch (error) {
        console.error('Error cleaning up template performance data:', error);
      }
    }, 24 * 60 * 60 * 1000); // Once per day

    console.log('Template performance tracking started');
  }

  private async cleanupOldPerformanceData(): Promise<void> {
    // Clean up usage records older than 90 days
    const keys = await this.redis.keys('template_usage:*');
    const now = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    for (const key of keys) {
      try {
        const data = await this.redis.get(key);
        if (data) {
          const record = JSON.parse(data);
          const recordTime = new Date(record.timestamp).getTime();
          
          if (recordTime < ninetyDaysAgo) {
            await this.redis.del(key);
          }
        }
      } catch (error) {
        // Skip invalid records
      }
    }

    console.log(`Cleaned up old template performance data: ${keys.length} keys processed`);
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
    console.log('Template Manager Service cleaned up');
  }
}

// Additional interfaces for template analytics
export interface TemplatePerformanceMetrics {
  templateId: string;
  userId: string;
  totalUsage: number;
  sent: number;
  accepted: number;
  declined: number;
  ignored: number;
  errors: number;
  acceptanceRate: number;
  responseRate: number;
  averageResponseTime: number;
  lastUsed: Date | null;
  createdAt: Date;
  performanceByIndustry: { 
    [industry: string]: { 
      usage: number; 
      accepted: number; 
      acceptanceRate: number; 
    } 
  };
  performanceByDay: { 
    [date: string]: { 
      usage: number; 
      accepted: number; 
    } 
  };
  trend: 'improving' | 'declining' | 'stable';
}

export interface TemplateAnalytics {
  templateId: string;
  templateName: string;
  category: string;
  totalUsage: number;
  sent: number;
  accepted: number;
  declined: number;
  ignored: number;
  errors: number;
  acceptanceRate: number;
  responseRate: number;
  averageResponseTime: number;
  lastUsed: Date | null;
  trend: 'improving' | 'declining' | 'stable';
  performanceRating: 'excellent' | 'good' | 'average' | 'poor' | 'unknown';
}

export interface TemplateRecommendation {
  type: 'create_template' | 'improve_template' | 'optimize_template' | 'archive_template';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionItems: string[];
}