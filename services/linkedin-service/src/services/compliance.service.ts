// LinkedIn Compliance Service for TOS adherence and rate limiting
// This service ensures all LinkedIn API interactions comply with LinkedIn's Terms of Service

import { EventEmitter } from 'events';
import { ComplianceMetrics, RateLimitInfo, LinkedInAPIError } from '../types/linkedin';

export interface RequestMetrics {
  userId: string;
  endpoint: string;
  timestamp: Date;
  success: boolean;
  statusCode: number;
  responseTime: number;
  riskScore: number;
}

export interface ComplianceLimits {
  daily: {
    requests: number;
    connections: number;
    messages: number;
    profileViews: number;
  };
  hourly: {
    requests: number;
  };
  minute: {
    requests: number;
    burst: number;
  };
}

export interface ComplianceAlert {
  level: 'WARNING' | 'CRITICAL';
  message: string;
  userId?: string;
  endpoint?: string;
  metrics: any;
  timestamp: Date;
}

export class LinkedInComplianceService extends EventEmitter {
  private requestLog: Map<string, RequestMetrics[]>;
  private userLimits: Map<string, ComplianceLimits>;
  private alertHistory: ComplianceAlert[];
  private circuitBreakers: Map<string, { isOpen: boolean; failures: number; lastFailure?: Date }>;

  private readonly defaultLimits: ComplianceLimits = {
    daily: {
      requests: parseInt(process.env.LINKEDIN_REQUESTS_PER_DAY || '500'),
      connections: 20,      // LinkedIn allows 100, we use 20 for safety
      messages: 25,         // LinkedIn allows 100, we use 25 for safety  
      profileViews: 50      // Conservative limit
    },
    hourly: {
      requests: parseInt(process.env.LINKEDIN_REQUESTS_PER_HOUR || '50')
    },
    minute: {
      requests: parseInt(process.env.LINKEDIN_REQUESTS_PER_MINUTE || '5'),
      burst: parseInt(process.env.LINKEDIN_BURST_LIMIT || '10')
    }
  };

  constructor() {
    super();
    this.requestLog = new Map();
    this.userLimits = new Map();
    this.alertHistory = [];
    this.circuitBreakers = new Map();

    // Clean up old request logs every hour
    setInterval(() => this.cleanupOldLogs(), 60 * 60 * 1000);
    
    // Generate compliance reports every 4 hours
    setInterval(() => this.generateComplianceReport(), 4 * 60 * 60 * 1000);
  }

  /**
   * Validate if a request can be made for a user/endpoint
   */
  async validateRequest(userId: string, endpoint: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(endpoint)) {
        return {
          allowed: false,
          reason: 'Circuit breaker open - too many recent failures',
          retryAfter: 300, // 5 minutes
          riskLevel: 'HIGH'
        };
      }

      // Get user's current usage
      const usage = this.getUserUsage(userId);
      const limits = this.getUserLimits(userId);

      // Check minute limits (burst protection)
      if (usage.minute.requests >= limits.minute.requests) {
        this.emitAlert('WARNING', `Minute rate limit exceeded for user ${userId}`, { userId, endpoint, usage });
        return {
          allowed: false,
          reason: 'Minute rate limit exceeded',
          retryAfter: 60,
          riskLevel: 'MEDIUM'
        };
      }

      // Check hourly limits
      if (usage.hourly.requests >= limits.hourly.requests) {
        this.emitAlert('WARNING', `Hourly rate limit exceeded for user ${userId}`, { userId, endpoint, usage });
        return {
          allowed: false,
          reason: 'Hourly rate limit exceeded',
          retryAfter: 3600,
          riskLevel: 'MEDIUM'
        };
      }

      // Check daily limits
      if (usage.daily.requests >= limits.daily.requests) {
        this.emitAlert('CRITICAL', `Daily rate limit exceeded for user ${userId}`, { userId, endpoint, usage });
        return {
          allowed: false,
          reason: 'Daily rate limit exceeded',
          retryAfter: 86400,
          riskLevel: 'HIGH'
        };
      }

      // Check for suspicious patterns
      const riskLevel = this.assessRiskLevel(userId, endpoint);
      if (riskLevel === 'HIGH') {
        this.emitAlert('WARNING', `High risk pattern detected for user ${userId}`, { userId, endpoint });
        return {
          allowed: false,
          reason: 'Suspicious activity pattern detected',
          retryAfter: 1800, // 30 minutes
          riskLevel: 'HIGH'
        };
      }

      // Request is allowed
      return {
        allowed: true,
        riskLevel
      };
    } catch (error) {
      this.emitAlert('CRITICAL', `Compliance validation error: ${error.message}`, { userId, endpoint, error });
      return {
        allowed: false,
        reason: 'Compliance service error',
        riskLevel: 'HIGH'
      };
    }
  }

  /**
   * Log a LinkedIn API request for compliance tracking
   */
  async logRequest(request: {
    userId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    success: boolean;
    userAgent?: string;
  }): Promise<void> {
    const metrics: RequestMetrics = {
      userId: request.userId,
      endpoint: request.endpoint,
      timestamp: new Date(),
      success: request.success,
      statusCode: request.statusCode,
      responseTime: request.responseTime,
      riskScore: this.calculateRiskScore(request)
    };

    // Store request metrics
    if (!this.requestLog.has(request.userId)) {
      this.requestLog.set(request.userId, []);
    }
    this.requestLog.get(request.userId)!.push(metrics);

    // Update circuit breaker
    this.updateCircuitBreaker(request.endpoint, request.success);

    // Check for compliance violations
    await this.checkComplianceViolations(request.userId, metrics);

    // Emit compliance events
    this.emit('requestLogged', metrics);
  }

  /**
   * Get compliance metrics for a user
   */
  getComplianceMetrics(userId: string): ComplianceMetrics {
    const usage = this.getUserUsage(userId);
    const limits = this.getUserLimits(userId);
    const recentActivity = this.getRecentActivity(userId, 24); // Last 24 hours

    return {
      dailyLimits: {
        connectionRequests: {
          limit: limits.daily.connections,
          used: usage.daily.connections,
          remaining: Math.max(0, limits.daily.connections - usage.daily.connections)
        },
        messages: {
          limit: limits.daily.messages,
          used: usage.daily.messages,
          remaining: Math.max(0, limits.daily.messages - usage.daily.messages)
        },
        profileViews: {
          limit: limits.daily.profileViews,
          used: usage.daily.profileViews,
          remaining: Math.max(0, limits.daily.profileViews - usage.daily.profileViews)
        }
      },
      accountHealth: {
        score: this.calculateAccountHealthScore(userId),
        riskLevel: this.getOverallRiskLevel(userId),
        warnings: this.getActiveWarnings(userId)
      },
      recentActivity
    };
  }

  /**
   * Get current usage for a user
   */
  private getUserUsage(userId: string): any {
    const now = new Date();
    const requests = this.requestLog.get(userId) || [];

    // Filter requests by time windows
    const minuteAgo = new Date(now.getTime() - 60 * 1000);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const minuteRequests = requests.filter(r => r.timestamp >= minuteAgo);
    const hourRequests = requests.filter(r => r.timestamp >= hourAgo);
    const dayRequests = requests.filter(r => r.timestamp >= dayAgo);

    return {
      minute: {
        requests: minuteRequests.length
      },
      hourly: {
        requests: hourRequests.length
      },
      daily: {
        requests: dayRequests.length,
        connections: dayRequests.filter(r => r.endpoint.includes('connection')).length,
        messages: dayRequests.filter(r => r.endpoint.includes('message')).length,
        profileViews: dayRequests.filter(r => r.endpoint.includes('profile')).length
      }
    };
  }

  /**
   * Get rate limits for a user (can be customized per user)
   */
  private getUserLimits(userId: string): ComplianceLimits {
    return this.userLimits.get(userId) || this.defaultLimits;
  }

  /**
   * Assess risk level for a request
   */
  private assessRiskLevel(userId: string, endpoint: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const requests = this.requestLog.get(userId) || [];
    const recentRequests = requests.filter(r => 
      r.timestamp >= new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );

    // Check for bot-like patterns
    if (recentRequests.length > 20) {
      return 'HIGH';
    }

    // Check for rapid-fire requests
    const lastFiveRequests = recentRequests.slice(-5);
    if (lastFiveRequests.length === 5) {
      const timeSpan = lastFiveRequests[4].timestamp.getTime() - lastFiveRequests[0].timestamp.getTime();
      if (timeSpan < 30000) { // 5 requests in less than 30 seconds
        return 'HIGH';
      }
    }

    // Check error rate
    const errorRate = recentRequests.filter(r => !r.success).length / Math.max(1, recentRequests.length);
    if (errorRate > 0.2) { // More than 20% errors
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Calculate risk score for a request
   */
  private calculateRiskScore(request: any): number {
    let score = 0;

    // Base score
    score += 1;

    // Time-based risk (requests at unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 2;
    }

    // Endpoint risk
    if (request.endpoint.includes('connection')) {
      score += 3; // Connection requests are higher risk
    }

    // Error responses
    if (!request.success) {
      score += 5;
    }

    // Rate-limiting responses
    if (request.statusCode === 429) {
      score += 10;
    }

    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Circuit breaker management
   */
  private isCircuitBreakerOpen(endpoint: string): boolean {
    const breaker = this.circuitBreakers.get(endpoint);
    if (!breaker) return false;

    // Check if enough time has passed to try again
    if (breaker.isOpen && breaker.lastFailure) {
      const timeSinceFailure = Date.now() - breaker.lastFailure.getTime();
      if (timeSinceFailure > 300000) { // 5 minutes
        breaker.isOpen = false;
        breaker.failures = 0;
      }
    }

    return breaker.isOpen;
  }

  private updateCircuitBreaker(endpoint: string, success: boolean): void {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, { isOpen: false, failures: 0 });
    }

    const breaker = this.circuitBreakers.get(endpoint)!;

    if (success) {
      breaker.failures = 0;
      breaker.isOpen = false;
    } else {
      breaker.failures++;
      breaker.lastFailure = new Date();

      // Open circuit after 5 consecutive failures
      if (breaker.failures >= 5) {
        breaker.isOpen = true;
        this.emitAlert('CRITICAL', `Circuit breaker opened for endpoint ${endpoint}`, { endpoint, failures: breaker.failures });
      }
    }
  }

  /**
   * Compliance violation checking
   */
  private async checkComplianceViolations(userId: string, metrics: RequestMetrics): Promise<void> {
    // Check for 429 responses (rate limiting)
    if (metrics.statusCode === 429) {
      this.emitAlert('CRITICAL', `Rate limit violation detected for user ${userId}`, { userId, metrics });
    }

    // Check for high error rates
    const recentRequests = this.getRecentActivity(userId, 1); // Last hour
    const errorRate = recentRequests.filter(r => !r.success).length / Math.max(1, recentRequests.length);
    
    if (errorRate > 0.3 && recentRequests.length > 10) {
      this.emitAlert('WARNING', `High error rate detected for user ${userId}: ${(errorRate * 100).toFixed(1)}%`, { userId, errorRate });
    }
  }

  /**
   * Utility methods
   */
  private getRecentActivity(userId: string, hours: number): RequestMetrics[] {
    const requests = this.requestLog.get(userId) || [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return requests.filter(r => r.timestamp >= cutoff);
  }

  private calculateAccountHealthScore(userId: string): number {
    const recentRequests = this.getRecentActivity(userId, 24);
    if (recentRequests.length === 0) return 100;

    const successRate = recentRequests.filter(r => r.success).length / recentRequests.length;
    const avgRiskScore = recentRequests.reduce((sum, r) => sum + r.riskScore, 0) / recentRequests.length;

    // Health score based on success rate and risk
    const healthScore = (successRate * 100) - (avgRiskScore * 5);
    return Math.max(0, Math.min(100, healthScore));
  }

  private getOverallRiskLevel(userId: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const healthScore = this.calculateAccountHealthScore(userId);
    if (healthScore >= 80) return 'LOW';
    if (healthScore >= 60) return 'MEDIUM';
    return 'HIGH';
  }

  private getActiveWarnings(userId: string): string[] {
    const warnings: string[] = [];
    const usage = this.getUserUsage(userId);
    const limits = this.getUserLimits(userId);

    if (usage.daily.requests > limits.daily.requests * 0.8) {
      warnings.push('Approaching daily request limit');
    }

    if (usage.hourly.requests > limits.hourly.requests * 0.8) {
      warnings.push('Approaching hourly request limit');
    }

    const healthScore = this.calculateAccountHealthScore(userId);
    if (healthScore < 70) {
      warnings.push('Account health score below 70');
    }

    return warnings;
  }

  /**
   * Alert management
   */
  private emitAlert(level: 'WARNING' | 'CRITICAL', message: string, data: any): void {
    const alert: ComplianceAlert = {
      level,
      message,
      metrics: data,
      timestamp: new Date()
    };

    this.alertHistory.push(alert);
    this.emit('complianceAlert', alert);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory.splice(0, this.alertHistory.length - 1000);
    }
  }

  /**
   * Cleanup and reporting
   */
  private cleanupOldLogs(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Keep 7 days

    for (const [userId, requests] of this.requestLog.entries()) {
      const filteredRequests = requests.filter(r => r.timestamp >= cutoff);
      if (filteredRequests.length === 0) {
        this.requestLog.delete(userId);
      } else {
        this.requestLog.set(userId, filteredRequests);
      }
    }
  }

  private generateComplianceReport(): void {
    const report = {
      timestamp: new Date(),
      totalUsers: this.requestLog.size,
      totalRequests: Array.from(this.requestLog.values()).reduce((sum, requests) => sum + requests.length, 0),
      activeCircuitBreakers: Array.from(this.circuitBreakers.entries()).filter(([_, breaker]) => breaker.isOpen).length,
      recentAlerts: this.alertHistory.filter(a => a.timestamp >= new Date(Date.now() - 4 * 60 * 60 * 1000)).length
    };

    this.emit('complianceReport', report);
  }

  /**
   * Public API methods
   */
  setUserLimits(userId: string, limits: Partial<ComplianceLimits>): void {
    const currentLimits = this.getUserLimits(userId);
    this.userLimits.set(userId, { ...currentLimits, ...limits });
  }

  getAlertHistory(hours = 24): ComplianceAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alertHistory.filter(a => a.timestamp >= cutoff);
  }

  getCircuitBreakerStatus(): Map<string, { isOpen: boolean; failures: number; lastFailure?: Date }> {
    return new Map(this.circuitBreakers);
  }

  resetCircuitBreaker(endpoint: string): void {
    this.circuitBreakers.set(endpoint, { isOpen: false, failures: 0 });
  }

  /**
   * Generate random delay to make requests appear more human-like
   */
  generateHumanLikeDelay(): number {
    const min = parseInt(process.env.LINKEDIN_MIN_REQUEST_DELAY || '2000');
    const max = parseInt(process.env.LINKEDIN_MAX_REQUEST_DELAY || '5000');
    const jitterEnabled = process.env.LINKEDIN_ENABLE_JITTER === 'true';

    let delay = Math.floor(Math.random() * (max - min + 1)) + min;

    if (jitterEnabled) {
      const jitter = Math.floor(Math.random() * 1000) - 500; // ±500ms jitter
      delay += jitter;
    }

    return Math.max(1000, delay); // Minimum 1 second delay
  }
}