// ===================================================================
// CONNECTION AUTOMATION SERVICE - LinkedIn-Compliant Connection Requests
// ===================================================================

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { LinkedInAPIService } from './api.service';
import { LinkedInComplianceService } from './compliance.service';
import { LinkedInRateLimitService } from './rateLimit.service';

interface ConnectionRequest {
  id: string;
  userId: string;
  targetProfileId: string;
  targetProfileUrl: string;
  personalizedMessage?: string;
  templateId?: string;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  retryCount: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

interface ConnectionTemplate {
  id: string;
  name: string;
  subject?: string;
  message: string;
  variables: string[]; // e.g., ['firstName', 'company', 'mutualConnections']
  category: 'general' | 'recruitment' | 'sales' | 'networking';
  enabled: boolean;
}

interface AutomationJobOptions {
  maxConnectionsPerDay: number;
  delayBetweenRequests: { min: number; max: number }; // seconds
  targetCriteria?: {
    industries?: string[];
    locations?: string[];
    companies?: string[];
    jobTitles?: string[];
    keywords?: string[];
  };
  blacklist?: {
    companies?: string[];
    keywords?: string[];
    userIds?: string[];
  };
  template?: string;
  skipIfRecentlyContacted?: boolean; // within 30 days
}

export class LinkedInConnectionAutomationService extends EventEmitter {
  private redis: Redis;
  private apiService: LinkedInAPIService;
  private complianceService: LinkedInComplianceService;
  private rateLimitService: LinkedInRateLimitService;
  private isProcessing: Map<string, boolean>;

  // Safety limits (ultra-conservative)
  private readonly SAFETY_LIMITS = {
    maxConnectionsPerDay: 15,        // LinkedIn allows 100, we use 15
    maxConnectionsPerHour: 3,        // Very conservative hourly limit
    minDelayBetweenRequests: 45000,  // Minimum 45 seconds
    maxDelayBetweenRequests: 180000, // Maximum 3 minutes
    maxRetries: 2,
    cooldownAfterFailure: 3600000,   // 1 hour cooldown after failure
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
    this.startJobProcessor();
  }

  /**
   * Schedule a connection request with safety checks
   */
  async scheduleConnectionRequest(
    userId: string,
    targetProfileId: string,
    options: {
      message?: string;
      templateId?: string;
      scheduledAt?: Date;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<{ success: boolean; requestId?: string; reason?: string; retryAfter?: number }> {
    try {
      // Comprehensive safety validation
      const safetyCheck = await this.validateConnectionSafety(userId, targetProfileId);
      if (!safetyCheck.allowed) {
        return {
          success: false,
          reason: safetyCheck.reason,
          retryAfter: safetyCheck.retryAfter
        };
      }

      // Create connection request
      const requestId = `conn_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const connectionRequest: ConnectionRequest = {
        id: requestId,
        userId,
        targetProfileId,
        targetProfileUrl: `https://linkedin.com/in/${targetProfileId}`,
        personalizedMessage: options.message,
        templateId: options.templateId,
        scheduledAt: options.scheduledAt || new Date(),
        status: 'pending',
        retryCount: 0,
        createdAt: new Date()
      };

      // Store in Redis with appropriate priority
      const queueKey = this.getQueueKey(options.priority || 'normal');
      await this.redis.lpush(queueKey, JSON.stringify(connectionRequest));
      
      // Set expiration (7 days)
      await this.redis.expire(`connection:${requestId}`, 7 * 24 * 60 * 60);

      // Update user's daily connection count
      await this.updateDailyConnectionCount(userId, 1);

      this.emit('connectionScheduled', { userId, requestId, targetProfileId });

      return {
        success: true,
        requestId
      };

    } catch (error) {
      console.error('Error scheduling connection request:', error);
      return {
        success: false,
        reason: 'Internal error scheduling connection request'
      };
    }
  }

  /**
   * Validate if a connection request is safe to proceed
   */
  private async validateConnectionSafety(
    userId: string,
    targetProfileId: string
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    
    // Check compliance status
    const compliance = await this.complianceService.validateRequest(userId, '/v2/invitation');
    if (!compliance.allowed) {
      return {
        allowed: false,
        reason: compliance.reason,
        retryAfter: compliance.retryAfter
      };
    }

    // Check daily connection limits
    const dailyCount = await this.getDailyConnectionCount(userId);
    if (dailyCount >= this.SAFETY_LIMITS.maxConnectionsPerDay) {
      return {
        allowed: false,
        reason: 'Daily connection limit reached',
        retryAfter: this.getSecondsUntilMidnight()
      };
    }

    // Check if recently contacted this profile
    const recentContact = await this.checkRecentContact(userId, targetProfileId);
    if (recentContact) {
      return {
        allowed: false,
        reason: 'Profile contacted recently (within 30 days)',
        retryAfter: 30 * 24 * 60 * 60 // 30 days
      };
    }

    // Check account health
    const healthCheck = await this.complianceService.performAccountHealthCheck(
      userId,
      await this.getAccessToken(userId)
    );
    
    if (healthCheck.overall === 'CRITICAL') {
      return {
        allowed: false,
        reason: 'Account health critical - automation suspended',
        retryAfter: 24 * 60 * 60 // 24 hours
      };
    }

    if (healthCheck.overall === 'AT_RISK' && healthCheck.score < 70) {
      return {
        allowed: false,
        reason: 'Account health at risk - reduce automation',
        retryAfter: 4 * 60 * 60 // 4 hours
      };
    }

    return { allowed: true };
  }

  /**
   * Process connection requests from queue
   */
  private async startJobProcessor(): Promise<void> {
    console.log('Starting LinkedIn connection automation job processor...');
    
    const processJobs = async () => {
      try {
        const queueKeys = ['connections:high', 'connections:normal', 'connections:low'];
        
        for (const queueKey of queueKeys) {
          // Process one job at a time to maintain human-like behavior
          const jobData = await this.redis.brpop(queueKey, 1);
          
          if (jobData && jobData[1]) {
            const request: ConnectionRequest = JSON.parse(jobData[1]);
            await this.processConnectionRequest(request);
            
            // Human-like delay between processing jobs
            const delay = this.generateHumanLikeDelay();
            await this.sleep(delay);
          }
        }
      } catch (error) {
        console.error('Error in connection job processor:', error);
      }
      
      // Continue processing with a small delay
      setTimeout(processJobs, 5000);
    };

    processJobs();
  }

  /**
   * Process individual connection request
   */
  private async processConnectionRequest(request: ConnectionRequest): Promise<void> {
    try {
      // Set processing status
      this.isProcessing.set(request.userId, true);
      request.status = 'processing';
      
      // Update in Redis
      await this.redis.setex(
        `connection:${request.id}`,
        7 * 24 * 60 * 60,
        JSON.stringify(request)
      );

      // Final safety check before sending
      const safetyCheck = await this.validateConnectionSafety(request.userId, request.targetProfileId);
      if (!safetyCheck.allowed) {
        await this.handleFailedRequest(request, safetyCheck.reason || 'Safety check failed');
        return;
      }

      // Prepare the connection request
      const message = await this.preparePersonalizedMessage(request);
      
      // Send connection request via LinkedIn API
      const result = await this.sendConnectionRequest(
        request.userId,
        request.targetProfileId,
        message
      );

      if (result.success) {
        request.status = 'sent';
        request.processedAt = new Date();
        
        // Log successful request
        await this.complianceService.logRequest({
          userId: request.userId,
          endpoint: '/v2/invitation',
          method: 'POST',
          statusCode: 200,
          responseTime: result.responseTime || 0,
          success: true
        });

        this.emit('connectionSent', { 
          requestId: request.id, 
          userId: request.userId,
          targetProfileId: request.targetProfileId 
        });

        // Record in recent contacts
        await this.recordRecentContact(request.userId, request.targetProfileId);

      } else {
        await this.handleFailedRequest(request, result.error || 'Unknown error');
      }

    } catch (error) {
      console.error('Error processing connection request:', error);
      await this.handleFailedRequest(request, `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isProcessing.set(request.userId, false);
    }
  }

  /**
   * Send connection request via LinkedIn API
   */
  private async sendConnectionRequest(
    userId: string,
    targetProfileId: string,
    message?: string
  ): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const accessToken = await this.getAccessToken(userId);
      
      const invitationData = {
        recipients: [`urn:li:person:${targetProfileId}`],
        message: message || 'I\'d like to connect with you on LinkedIn.',
        trackingId: `automation_${Date.now()}`
      };

      // Use rate-limited API call
      const response = await this.rateLimitService.executeWithRateLimit(
        userId,
        '/v2/invitation',
        async () => {
          return await this.apiService.sendConnectionInvitation(accessToken, userId, targetProfileId, message);
        }
      );

      return {
        success: true,
        responseTime: Date.now() - startTime
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Log failed request for compliance monitoring
      await this.complianceService.logRequest({
        userId,
        endpoint: '/v2/invitation',
        method: 'POST',
        statusCode: error.response?.status || 0,
        responseTime,
        success: false
      });

      let errorMessage = 'Unknown error';
      if (error.response?.status === 429) {
        errorMessage = 'Rate limit exceeded';
      } else if (error.response?.status === 403) {
        errorMessage = 'Permission denied - possible LinkedIn restriction';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      return {
        success: false,
        error: errorMessage,
        responseTime
      };
    }
  }

  /**
   * Handle failed connection request
   */
  private async handleFailedRequest(request: ConnectionRequest, error: string): Promise<void> {
    request.status = 'failed';
    request.error = error;
    request.retryCount++;

    // Check if should retry
    if (request.retryCount <= this.SAFETY_LIMITS.maxRetries && !this.isPermanentError(error)) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, request.retryCount) * 60000; // minutes
      request.scheduledAt = new Date(Date.now() + retryDelay);
      request.status = 'pending';
      
      // Re-queue for retry
      await this.redis.lpush('connections:low', JSON.stringify(request));
    }

    // Update in Redis
    await this.redis.setex(
      `connection:${request.id}`,
      7 * 24 * 60 * 60,
      JSON.stringify(request)
    );

    this.emit('connectionFailed', {
      requestId: request.id,
      userId: request.userId,
      error,
      willRetry: request.status === 'pending'
    });
  }

  /**
   * Generate human-like delay between requests
   */
  private generateHumanLikeDelay(): number {
    const { min, max } = {
      min: this.SAFETY_LIMITS.minDelayBetweenRequests,
      max: this.SAFETY_LIMITS.maxDelayBetweenRequests
    };
    
    // Base delay with gaussian distribution for more natural feel
    const baseDelay = min + Math.random() * (max - min);
    
    // Add jitter ±20%
    const jitter = baseDelay * 0.2 * (Math.random() - 0.5);
    
    return Math.max(min, baseDelay + jitter);
  }

  /**
   * Prepare personalized message using templates
   */
  private async preparePersonalizedMessage(request: ConnectionRequest): Promise<string | undefined> {
    if (request.personalizedMessage) {
      return request.personalizedMessage;
    }

    if (request.templateId) {
      const template = await this.getTemplate(request.templateId);
      if (template) {
        // Get profile data for personalization
        const profileData = await this.getTargetProfileData(request.targetProfileId);
        return this.renderTemplate(template, profileData);
      }
    }

    // Return undefined for default LinkedIn connection message
    return undefined;
  }

  /**
   * Get connection request status and analytics
   */
  async getConnectionStats(userId: string): Promise<{
    today: {
      sent: number;
      pending: number;
      failed: number;
      remaining: number;
    };
    thisWeek: {
      sent: number;
      pending: number;
      failed: number;
    };
    accountHealth: {
      score: number;
      status: string;
      warnings: string[];
    };
  }> {
    const today = new Date().toISOString().split('T')[0];
    const dailyCount = await this.getDailyConnectionCount(userId);
    
    // Get pending requests count
    const queueKeys = ['connections:high', 'connections:normal', 'connections:low'];
    let pendingCount = 0;
    
    for (const queueKey of queueKeys) {
      const queueLength = await this.redis.llen(queueKey);
      // This is a simplified count - in practice, you'd filter by userId
      pendingCount += queueLength;
    }

    // Get account health
    const compliance = await this.complianceService.getComplianceMetrics(userId);
    
    return {
      today: {
        sent: dailyCount,
        pending: pendingCount,
        failed: 0, // Would calculate from analytics
        remaining: Math.max(0, this.SAFETY_LIMITS.maxConnectionsPerDay - dailyCount)
      },
      thisWeek: {
        sent: 0, // Would calculate from weekly analytics
        pending: pendingCount,
        failed: 0
      },
      accountHealth: {
        score: compliance.accountHealth.score,
        status: compliance.accountHealth.riskLevel,
        warnings: compliance.accountHealth.warnings
      }
    };
  }

  /**
   * Cancel pending connection request
   */
  async cancelConnectionRequest(userId: string, requestId: string): Promise<{ success: boolean; reason?: string }> {
    try {
      // Get request from Redis
      const requestData = await this.redis.get(`connection:${requestId}`);
      if (!requestData) {
        return { success: false, reason: 'Connection request not found' };
      }

      const request: ConnectionRequest = JSON.parse(requestData);
      
      // Verify ownership
      if (request.userId !== userId) {
        return { success: false, reason: 'Unauthorized' };
      }

      // Can only cancel pending requests
      if (request.status !== 'pending') {
        return { success: false, reason: `Cannot cancel request with status: ${request.status}` };
      }

      // Update status
      request.status = 'cancelled';
      await this.redis.setex(`connection:${requestId}`, 7 * 24 * 60 * 60, JSON.stringify(request));

      // Update daily count (subtract one)
      await this.updateDailyConnectionCount(userId, -1);

      this.emit('connectionCancelled', { requestId, userId });

      return { success: true };

    } catch (error) {
      console.error('Error cancelling connection request:', error);
      return { success: false, reason: 'Internal error' };
    }
  }

  /**
   * Helper methods
   */
  private async getDailyConnectionCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `connections:daily:${userId}:${today}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0');
  }

  private async updateDailyConnectionCount(userId: string, increment: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `connections:daily:${userId}:${today}`;
    await this.redis.incrby(key, increment);
    await this.redis.expire(key, 25 * 60 * 60); // Expire after 25 hours
  }

  private async checkRecentContact(userId: string, targetProfileId: string): Promise<boolean> {
    const key = `recent_contact:${userId}:${targetProfileId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  private async recordRecentContact(userId: string, targetProfileId: string): Promise<void> {
    const key = `recent_contact:${userId}:${targetProfileId}`;
    await this.redis.setex(key, 30 * 24 * 60 * 60, Date.now().toString()); // 30 days
  }

  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  private isPermanentError(error: string): boolean {
    const permanentErrors = [
      'Permission denied',
      'Account restricted',
      'Invalid target profile',
      'Already connected'
    ];
    return permanentErrors.some(perm => error.includes(perm));
  }

  private getQueueKey(priority: 'low' | 'normal' | 'high'): string {
    return `connections:${priority}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Placeholder methods - to be implemented based on your existing API service
  private async getAccessToken(userId: string): Promise<string> {
    // TODO: Implement based on your existing token storage
    // This should retrieve the LinkedIn access token for the user
    const key = `linkedin_tokens:${userId}`;
    const tokenData = await this.redis.get(key);
    if (!tokenData) {
      throw new Error('LinkedIn access token not found');
    }
    const tokens = JSON.parse(tokenData);
    return tokens.accessToken;
  }

  private async getTemplate(templateId: string): Promise<ConnectionTemplate | null> {
    // TODO: Implement template retrieval from database
    // This should get message templates from your database
    const templateKey = `connection_template:${templateId}`;
    const templateData = await this.redis.get(templateKey);
    return templateData ? JSON.parse(templateData) : null;
  }

  private async getTargetProfileData(targetProfileId: string): Promise<any> {
    // TODO: Implement profile data retrieval for personalization
    // This should get basic profile info for message personalization
    return {
      firstName: 'Unknown',
      lastName: 'User',
      company: 'Unknown Company',
      jobTitle: 'Professional'
    };
  }

  private renderTemplate(template: ConnectionTemplate, profileData: any): string {
    // Simple template rendering - replace variables with profile data
    let message = template.message;
    
    template.variables.forEach(variable => {
      const value = profileData[variable] || `[${variable}]`;
      message = message.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
    });
    
    return message;
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}