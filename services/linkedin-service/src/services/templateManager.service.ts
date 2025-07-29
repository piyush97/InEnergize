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

export class LinkedInTemplateManagerService {
  private redis: Redis;

  // Default professional templates
  private readonly DEFAULT_CONNECTION_TEMPLATES: Omit<ConnectionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usage'>[] = [
    {
      name: 'Professional Networking',
      message: 'Hi {firstName}, I came across your profile and was impressed by your experience at {company}. I\'d love to connect and learn more about your work in {industry}.',
      variables: ['firstName', 'company', 'industry'],
      category: 'networking',
      enabled: true
    },
    {
      name: 'Mutual Connection',
      message: 'Hi {firstName}, I noticed we have {mutualConnections} mutual connections and similar interests in {industry}. I\'d appreciate the opportunity to connect!',
      variables: ['firstName', 'mutualConnections', 'industry'],
      category: 'networking',
      enabled: true
    },
    {
      name: 'Industry Interest',
      message: 'Hello {firstName}, I\'m reaching out because I\'m passionate about {industry} and would love to connect with like-minded professionals. Your background at {company} is quite impressive!',
      variables: ['firstName', 'industry', 'company'],
      category: 'general',
      enabled: true
    },
    {
      name: 'Conference/Event Follow-up',
      message: 'Hi {firstName}, great meeting you at {event}! I enjoyed our conversation about {topic}. Would love to stay connected.',
      variables: ['firstName', 'event', 'topic'],
      category: 'networking',
      enabled: true
    },
    {
      name: 'Same Company Alumni',
      message: 'Hi {firstName}, I see you also worked at {company}! I was there from {timeFrame}. Would be great to connect with a fellow {company} alum.',
      variables: ['firstName', 'company', 'timeFrame'],
      category: 'networking',
      enabled: true
    }
  ];

  private readonly DEFAULT_COMMENT_TEMPLATES: Omit<CommentTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usage'>[] = [
    {
      name: 'Appreciative Professional',
      text: 'Thank you for sharing this valuable insight, {authorName}! This is particularly relevant for those of us working in {industry}.',
      variables: ['authorName', 'industry'],
      category: 'professional',
      tone: 'formal',
      enabled: true
    },
    {
      name: 'Thoughtful Question',
      text: 'Great perspective on {postTopic}, {authorName}! Have you found this approach to be effective in {industry} specifically?',
      variables: ['postTopic', 'authorName', 'industry'],
      category: 'insightful',
      tone: 'thoughtful',
      enabled: true
    },
    {
      name: 'Supportive Engagement',
      text: 'Really appreciate you sharing this, {authorName}. This resonates with my experience in {relatedField}.',
      variables: ['authorName', 'relatedField'],
      category: 'supportive',
      tone: 'casual',
      enabled: true
    },
    {
      name: 'Value Addition',
      text: 'Excellent points, {authorName}! In addition to what you mentioned, I\'ve found {additionalInsight} to be helpful in this context.',
      variables: ['authorName', 'additionalInsight'],
      category: 'insightful',
      tone: 'formal',
      enabled: true
    },
    {
      name: 'Experience Sharing',
      text: 'Thanks for posting this, {authorName}! I had a similar experience when working on {relatedProject}. The insights you shared are spot on.',
      variables: ['authorName', 'relatedProject'],
      category: 'professional',
      tone: 'thoughtful',
      enabled: true
    },
    {
      name: 'General Appreciation',
      text: 'Fantastic content as always, {authorName}! Your insights on {postTopic} are always thought-provoking.',
      variables: ['authorName', 'postTopic'],
      category: 'general',
      tone: 'enthusiastic',
      enabled: true
    }
  ];

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Initialize default templates
    this.initializeDefaultTemplates();
  }

  // ===================================================================
  // CONNECTION TEMPLATE METHODS
  // ===================================================================

  /**
   * Get all connection templates for a user
   */
  async getConnectionTemplates(userId: string): Promise<ConnectionTemplate[]> {
    try {
      const userTemplatesKey = `connection_templates:${userId}`;
      const templateIds = await this.redis.smembers(userTemplatesKey);
      
      if (templateIds.length === 0) {
        // Return default templates for new users
        return this.getDefaultConnectionTemplates();
      }

      const templates: ConnectionTemplate[] = [];
      
      for (const templateId of templateIds) {
        const templateData = await this.redis.get(`connection_template:${templateId}`);
        if (templateData) {
          templates.push(JSON.parse(templateData));
        }
      }

      return templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Error getting connection templates:', error);
      return this.getDefaultConnectionTemplates();
    }
  }

  /**
   * Get a specific connection template
   */
  async getConnectionTemplate(templateId: string): Promise<ConnectionTemplate | null> {
    try {
      const templateData = await this.redis.get(`connection_template:${templateId}`);
      return templateData ? JSON.parse(templateData) : null;
    } catch (error) {
      console.error('Error getting connection template:', error);
      return null;
    }
  }

  /**
   * Create a new connection template
   */
  async createConnectionTemplate(
    userId: string,
    template: Omit<ConnectionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usage'>
  ): Promise<ConnectionTemplate> {
    try {
      const templateId = `conn_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newTemplate: ConnectionTemplate = {
        id: templateId,
        ...template,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          totalSent: 0,
          successRate: 0
        }
      };

      // Store template
      await this.redis.setex(
        `connection_template:${templateId}`,
        365 * 24 * 60 * 60, // 1 year
        JSON.stringify(newTemplate)
      );

      // Add to user's template set
      await this.redis.sadd(`connection_templates:${userId}`, templateId);

      return newTemplate;
    } catch (error) {
      console.error('Error creating connection template:', error);
      throw error;
    }
  }

  /**
   * Update a connection template
   */
  async updateConnectionTemplate(
    userId: string,
    templateId: string,
    updates: Partial<Omit<ConnectionTemplate, 'id' | 'createdAt' | 'usage'>>
  ): Promise<ConnectionTemplate | null> {
    try {
      const existingTemplate = await this.getConnectionTemplate(templateId);
      if (!existingTemplate) {
        return null;
      }

      // Verify ownership
      const isOwner = await this.redis.sismember(`connection_templates:${userId}`, templateId);
      if (!isOwner) {
        throw new Error('Template not found or access denied');
      }

      const updatedTemplate: ConnectionTemplate = {
        ...existingTemplate,
        ...updates,
        updatedAt: new Date()
      };

      await this.redis.setex(
        `connection_template:${templateId}`,
        365 * 24 * 60 * 60,
        JSON.stringify(updatedTemplate)
      );

      return updatedTemplate;
    } catch (error) {
      console.error('Error updating connection template:', error);
      throw error;
    }
  }

  /**
   * Delete a connection template
   */
  async deleteConnectionTemplate(userId: string, templateId: string): Promise<boolean> {
    try {
      // Verify ownership
      const isOwner = await this.redis.sismember(`connection_templates:${userId}`, templateId);
      if (!isOwner) {
        return false;
      }

      // Remove from user's set
      await this.redis.srem(`connection_templates:${userId}`, templateId);
      
      // Delete the template
      await this.redis.del(`connection_template:${templateId}`);

      return true;
    } catch (error) {
      console.error('Error deleting connection template:', error);
      return false;
    }
  }

  // ===================================================================
  // COMMENT TEMPLATE METHODS
  // ===================================================================

  /**
   * Get all comment templates for a user
   */
  async getCommentTemplates(userId: string): Promise<CommentTemplate[]> {
    try {
      const userTemplatesKey = `comment_templates:${userId}`;
      const templateIds = await this.redis.smembers(userTemplatesKey);
      
      if (templateIds.length === 0) {
        // Return default templates for new users
        return this.getDefaultCommentTemplates();
      }

      const templates: CommentTemplate[] = [];
      
      for (const templateId of templateIds) {
        const templateData = await this.redis.get(`comment_template:${templateId}`);
        if (templateData) {
          templates.push(JSON.parse(templateData));
        }
      }

      return templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Error getting comment templates:', error);
      return this.getDefaultCommentTemplates();
    }
  }

  /**
   * Get a specific comment template
   */
  async getCommentTemplate(templateId: string): Promise<CommentTemplate | null> {
    try {
      const templateData = await this.redis.get(`comment_template:${templateId}`);
      return templateData ? JSON.parse(templateData) : null;
    } catch (error) {
      console.error('Error getting comment template:', error);
      return null;
    }
  }

  /**
   * Create a new comment template
   */
  async createCommentTemplate(
    userId: string,
    template: Omit<CommentTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usage'>
  ): Promise<CommentTemplate> {
    try {
      const templateId = `comment_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newTemplate: CommentTemplate = {
        id: templateId,
        ...template,
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          totalUsed: 0,
          engagementRate: 0
        }
      };

      // Store template
      await this.redis.setex(
        `comment_template:${templateId}`,
        365 * 24 * 60 * 60, // 1 year
        JSON.stringify(newTemplate)
      );

      // Add to user's template set
      await this.redis.sadd(`comment_templates:${userId}`, templateId);

      return newTemplate;
    } catch (error) {
      console.error('Error creating comment template:', error);
      throw error;
    }
  }

  // ===================================================================
  // TEMPLATE RENDERING METHODS
  // ===================================================================

  /**
   * Render a connection template with provided data
   */
  renderConnectionTemplate(template: ConnectionTemplate, data: { [key: string]: any }): string {
    let message = template.message;
    
    template.variables.forEach(variable => {
      const value = data[variable] || `[${variable}]`;
      message = message.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
    });
    
    return message;
  }

  /**
   * Render a comment template with provided data
   */
  renderCommentTemplate(template: CommentTemplate, data: { [key: string]: any }): string {
    let text = template.text;
    
    template.variables.forEach(variable => {
      const value = data[variable] || `[${variable}]`;
      text = text.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
    });
    
    return text;
  }

  /**
   * Get best matching template based on context
   */
  async getBestConnectionTemplate(
    userId: string,
    context: {
      industry?: string;
      company?: string;
      mutualConnections?: number;
      relationship?: 'alumni' | 'industry_peer' | 'conference' | 'general';
    }
  ): Promise<ConnectionTemplate | null> {
    try {
      const templates = await this.getConnectionTemplates(userId);
      const enabledTemplates = templates.filter(t => t.enabled);

      if (enabledTemplates.length === 0) {
        return null;
      }

      // Score templates based on context
      const scoredTemplates = enabledTemplates.map(template => {
        let score = 0;
        
        // Category matching
        if (context.relationship === 'alumni' && template.category === 'networking') score += 30;
        if (context.relationship === 'industry_peer' && template.category === 'general') score += 25;
        if (context.relationship === 'conference' && template.category === 'networking') score += 35;
        
        // Variable matching
        if (context.industry && template.variables.includes('industry')) score += 20;
        if (context.company && template.variables.includes('company')) score += 15;
        if (context.mutualConnections && template.variables.includes('mutualConnections')) score += 25;
        
        // Success rate bonus
        score += template.usage.successRate * 0.3;
        
        return { template, score };
      });

      // Sort by score and return best match
      scoredTemplates.sort((a, b) => b.score - a.score);
      return scoredTemplates[0]?.template || enabledTemplates[0];

    } catch (error) {
      console.error('Error getting best connection template:', error);
      return null;
    }
  }

  /**
   * Get best matching comment template based on post context
   */
  async getBestCommentTemplate(
    userId: string,
    context: {
      authorName?: string;
      industry?: string;
      postTopic?: string;
      postType?: 'article' | 'video' | 'image' | 'poll' | 'text';
      tone?: 'formal' | 'casual' | 'enthusiastic' | 'thoughtful';
    }
  ): Promise<CommentTemplate | null> {
    try {
      const templates = await this.getCommentTemplates(userId);
      const enabledTemplates = templates.filter(t => t.enabled);

      if (enabledTemplates.length === 0) {
        return null;
      }

      // Score templates based on context
      const scoredTemplates = enabledTemplates.map(template => {
        let score = 0;
        
        // Tone matching
        if (context.tone && template.tone === context.tone) score += 30;
        
        // Variable matching
        if (context.authorName && template.variables.includes('authorName')) score += 20;
        if (context.industry && template.variables.includes('industry')) score += 15;
        if (context.postTopic && template.variables.includes('postTopic')) score += 25;
        
        // Post type considerations
        if (context.postType === 'article' && template.category === 'professional') score += 15;
        if (context.postType === 'poll' && template.category === 'insightful') score += 20;
        
        // Engagement rate bonus
        score += template.usage.engagementRate * 0.2;
        
        return { template, score };
      });

      // Sort by score and return best match
      scoredTemplates.sort((a, b) => b.score - a.score);
      return scoredTemplates[0]?.template || enabledTemplates[0];

    } catch (error) {
      console.error('Error getting best comment template:', error);
      return null;
    }
  }

  // ===================================================================
  // TEMPLATE ANALYTICS METHODS
  // ===================================================================

  /**
   * Update template usage statistics
   */
  async updateTemplateUsage(
    templateId: string,
    type: 'connection' | 'comment',
    success: boolean,
    engagementData?: { likes?: number; replies?: number; shares?: number }
  ): Promise<void> {
    try {
      const template = type === 'connection' 
        ? await this.getConnectionTemplate(templateId)
        : await this.getCommentTemplate(templateId);

      if (!template) return;

      if (type === 'connection') {
        const connTemplate = template as ConnectionTemplate;
        connTemplate.usage.totalSent++;
        connTemplate.usage.lastUsed = new Date();
        
        if (success) {
          // Update success rate (moving average)
          const successCount = Math.round(connTemplate.usage.successRate * (connTemplate.usage.totalSent - 1) / 100) + 1;
          connTemplate.usage.successRate = (successCount / connTemplate.usage.totalSent) * 100;
        }

        await this.redis.setex(
          `connection_template:${templateId}`,
          365 * 24 * 60 * 60,
          JSON.stringify(connTemplate)
        );
      } else {
        const commentTemplate = template as CommentTemplate;
        commentTemplate.usage.totalUsed++;
        commentTemplate.usage.lastUsed = new Date();
        
        if (engagementData) {
          // Calculate engagement score based on likes, replies, shares
          const totalEngagement = (engagementData.likes || 0) + 
                                  (engagementData.replies || 0) * 3 + 
                                  (engagementData.shares || 0) * 5;
          
          // Update engagement rate (moving average)
          const currentEngagement = commentTemplate.usage.engagementRate * (commentTemplate.usage.totalUsed - 1);
          commentTemplate.usage.engagementRate = (currentEngagement + totalEngagement) / commentTemplate.usage.totalUsed;
        }

        await this.redis.setex(
          `comment_template:${templateId}`,
          365 * 24 * 60 * 60,
          JSON.stringify(commentTemplate)
        );
      }
    } catch (error) {
      console.error('Error updating template usage:', error);
    }
  }

  /**
   * Get template analytics for a user
   */
  async getTemplateAnalytics(userId: string): Promise<{
    connectionTemplates: {
      total: number;
      mostSuccessful: ConnectionTemplate | null;
      leastUsed: ConnectionTemplate[];
    };
    commentTemplates: {
      total: number;
      highestEngagement: CommentTemplate | null;
      leastUsed: CommentTemplate[];
    };
  }> {
    try {
      const [connectionTemplates, commentTemplates] = await Promise.all([
        this.getConnectionTemplates(userId),
        this.getCommentTemplates(userId)
      ]);

      // Connection template analytics
      const mostSuccessful = connectionTemplates.length > 0
        ? connectionTemplates.reduce((best, current) => 
            current.usage.successRate > best.usage.successRate ? current : best
          )
        : null;

      const leastUsedConnections = connectionTemplates
        .filter(t => t.usage.totalSent === 0)
        .slice(0, 5);

      // Comment template analytics
      const highestEngagement = commentTemplates.length > 0
        ? commentTemplates.reduce((best, current) => 
            current.usage.engagementRate > best.usage.engagementRate ? current : best
          )
        : null;

      const leastUsedComments = commentTemplates
        .filter(t => t.usage.totalUsed === 0)
        .slice(0, 5);

      return {
        connectionTemplates: {
          total: connectionTemplates.length,
          mostSuccessful,
          leastUsed: leastUsedConnections
        },
        commentTemplates: {
          total: commentTemplates.length,
          highestEngagement,
          leastUsed: leastUsedComments
        }
      };
    } catch (error) {
      console.error('Error getting template analytics:', error);
      throw error;
    }
  }

  // ===================================================================
  // PRIVATE HELPER METHODS
  // ===================================================================

  /**
   * Initialize default templates
   */
  private async initializeDefaultTemplates(): Promise<void> {
    try {
      // Check if defaults are already initialized
      const initialized = await this.redis.get('default_templates_initialized');
      if (initialized) return;

      // Store default connection templates
      for (const template of this.DEFAULT_CONNECTION_TEMPLATES) {
        const templateId = `default_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullTemplate: ConnectionTemplate = {
          id: templateId,
          ...template,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: {
            totalSent: 0,
            successRate: 0
          }
        };

        await this.redis.setex(
          `connection_template:${templateId}`,
          365 * 24 * 60 * 60,
          JSON.stringify(fullTemplate)
        );

        await this.redis.sadd('default_connection_templates', templateId);
      }

      // Store default comment templates
      for (const template of this.DEFAULT_COMMENT_TEMPLATES) {
        const templateId = `default_comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullTemplate: CommentTemplate = {
          id: templateId,
          ...template,
          createdAt: new Date(),
          updatedAt: new Date(),
          usage: {
            totalUsed: 0,
            engagementRate: 0
          }
        };

        await this.redis.setex(
          `comment_template:${templateId}`,
          365 * 24 * 60 * 60,
          JSON.stringify(fullTemplate)
        );

        await this.redis.sadd('default_comment_templates', templateId);
      }

      // Mark as initialized
      await this.redis.setex('default_templates_initialized', 365 * 24 * 60 * 60, 'true');
      console.log('Default templates initialized successfully');
    } catch (error) {
      console.error('Error initializing default templates:', error);
    }
  }

  /**
   * Get default connection templates
   */
  private async getDefaultConnectionTemplates(): Promise<ConnectionTemplate[]> {
    try {
      const templateIds = await this.redis.smembers('default_connection_templates');
      const templates: ConnectionTemplate[] = [];
      
      for (const templateId of templateIds) {
        const templateData = await this.redis.get(`connection_template:${templateId}`);
        if (templateData) {
          templates.push(JSON.parse(templateData));
        }
      }

      return templates;
    } catch (error) {
      console.error('Error getting default connection templates:', error);
      return [];
    }
  }

  /**
   * Get default comment templates
   */
  private async getDefaultCommentTemplates(): Promise<CommentTemplate[]> {
    try {
      const templateIds = await this.redis.smembers('default_comment_templates');
      const templates: CommentTemplate[] = [];
      
      for (const templateId of templateIds) {
        const templateData = await this.redis.get(`comment_template:${templateId}`);
        if (templateData) {
          templates.push(JSON.parse(templateData));
        }
      }

      return templates;
    } catch (error) {
      console.error('Error getting default comment templates:', error);
      return [];
    }
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}