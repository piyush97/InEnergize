// LinkedIn Compliance Service for TOS adherence and rate limiting
// This service ensures all LinkedIn API interactions comply with LinkedIn's Terms of Service

import { EventEmitter } from 'events';
import axios from 'axios';
import { ComplianceMetrics, RateLimitInfo, LinkedInAPIError, LinkedInProfile, ProfileCompleteness, LinkedInAnalytics } from '../types/linkedin';

// Simple logger for the service
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || '')
};

export interface RequestMetrics {
  userId: string;
  endpoint: string;
  action: string;
  timestamp: Date;
  target?: string;
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
      this.emitAlert('CRITICAL', `Compliance validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, { userId, endpoint, error });
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
      action: request.method || 'unknown',
      target: request.endpoint,
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

  /**
   * Enhanced LinkedIn Account Health Monitoring
   */
  async performAccountHealthCheck(userId: string, accessToken: string): Promise<{
    overall: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
    score: number;
    checks: Array<{
      name: string;
      status: 'PASS' | 'WARN' | 'FAIL';
      message: string;
      recommendation?: string;
    }>;
    trends: {
      errorRateWeekly: number;
      usageGrowthRate: number;
      successRateChange: number;
    };
  }> {
    const checks: Array<{
      name: string;
      status: 'PASS' | 'WARN' | 'FAIL';
      message: string;
      recommendation?: string;
    }> = [];
    let score = 100;
    
    try {
      // Check 1: API Response Health
      const apiHealthCheck = await this.checkAPIHealth(userId, accessToken);
      checks.push(apiHealthCheck);
      if (apiHealthCheck.status === 'FAIL') score -= 25;
      if (apiHealthCheck.status === 'WARN') score -= 10;
      
      // Check 2: Rate Limit Compliance
      const rateLimitCheck = await this.checkRateLimitCompliance(userId);
      checks.push(rateLimitCheck);
      if (rateLimitCheck.status === 'FAIL') score -= 30;
      if (rateLimitCheck.status === 'WARN') score -= 15;
      
      // Check 3: Behavioral Pattern Analysis
      const behaviorCheck = await this.checkBehavioralPatterns(userId);
      checks.push(behaviorCheck);
      if (behaviorCheck.status === 'FAIL') score -= 20;
      if (behaviorCheck.status === 'WARN') score -= 10;
      
      // Check 4: LinkedIn TOS Compliance
      const tosCheck = await this.checkTOSCompliance(userId);
      checks.push(tosCheck);
      if (tosCheck.status === 'FAIL') score -= 35;
      if (tosCheck.status === 'WARN') score -= 15;
      
      // Calculate trends
      const trends = await this.calculateHealthTrends(userId);
      
      let overall: 'HEALTHY' | 'AT_RISK' | 'CRITICAL' = 'HEALTHY';
      if (score < 80) overall = 'AT_RISK';
      if (score < 60) overall = 'CRITICAL';
      
      return {
        overall,
        score: Math.max(0, score),
        checks,
        trends
      };
      
    } catch (error) {
      this.emitAlert('CRITICAL', `Account health check failed for user ${userId}`, { userId, error });
      
      return {
        overall: 'CRITICAL',
        score: 0,
        checks: [{
          name: 'Health Check Error',
          status: 'FAIL',
          message: 'Failed to perform account health check',
          recommendation: 'Review system health and retry'
        }],
        trends: {
          errorRateWeekly: 1.0,
          usageGrowthRate: 0,
          successRateChange: -100
        }
      };
    }
  }

  /**
   * Check LinkedIn API health by making a test call
   */
  private async checkAPIHealth(userId: string, accessToken: string): Promise<{
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    recommendation?: string;
  }> {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202401',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.status === 200) {
        return {
          name: 'API Connectivity',
          status: 'PASS',
          message: 'LinkedIn API responding normally'
        };
      } else {
        return {
          name: 'API Connectivity',
          status: 'WARN',
          message: `LinkedIn API returned status ${response.status}`,
          recommendation: 'Monitor API responses closely'
        };
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        return {
          name: 'API Connectivity',
          status: 'FAIL',
          message: 'LinkedIn access token is invalid or expired',
          recommendation: 'Refresh access token immediately'
        };
      } else if (error.response?.status === 429) {
        return {
          name: 'API Connectivity',
          status: 'FAIL',
          message: 'LinkedIn API rate limit exceeded',
          recommendation: 'Reduce API usage immediately'
        };
      } else {
        return {
          name: 'API Connectivity',
          status: 'WARN',
          message: `LinkedIn API error: ${error.message}`,
          recommendation: 'Check network connectivity and API status'
        };
      }
    }
  }

  /**
   * Check rate limit compliance
   */
  private async checkRateLimitCompliance(userId: string): Promise<{
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    recommendation?: string;
  }> {
    const usage = this.getUserUsage(userId);
    const limits = this.getUserLimits(userId);
    
    const dailyUsageRate = usage.daily.requests / limits.daily.requests;
    const hourlyUsageRate = usage.hourly.requests / limits.hourly.requests;
    
    if (dailyUsageRate >= 0.9) {
      return {
        name: 'Rate Limit Compliance',
        status: 'FAIL',
        message: `Daily usage at ${(dailyUsageRate * 100).toFixed(1)}% of limit`,
        recommendation: 'Stop all non-essential API calls'
      };
    } else if (dailyUsageRate >= 0.7 || hourlyUsageRate >= 0.8) {
      return {
        name: 'Rate Limit Compliance',
        status: 'WARN',
        message: `Usage approaching limits (daily: ${(dailyUsageRate * 100).toFixed(1)}%, hourly: ${(hourlyUsageRate * 100).toFixed(1)}%)`,
        recommendation: 'Reduce API call frequency'
      };
    } else {
      return {
        name: 'Rate Limit Compliance',
        status: 'PASS',
        message: `Usage within safe limits (daily: ${(dailyUsageRate * 100).toFixed(1)}%)`
      };
    }
  }

  /**
   * Check behavioral patterns for bot-like activity
   */
  private async checkBehavioralPatterns(userId: string): Promise<{
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    recommendation?: string;
  }> {
    const recentRequests = this.getRecentActivity(userId, 2); // Last 2 hours
    
    if (recentRequests.length === 0) {
      return {
        name: 'Behavioral Patterns',
        status: 'PASS',
        message: 'No recent activity to analyze'
      };
    }
    
    // Check for rapid-fire requests (bot-like behavior)
    const rapidRequests = this.checkForRapidRequests(recentRequests);
    if (rapidRequests.count > 10) {
      return {
        name: 'Behavioral Patterns',
        status: 'FAIL',
        message: `${rapidRequests.count} rapid requests detected (${rapidRequests.timeSpan}ms average)`,
        recommendation: 'Add random delays between requests (30-120 seconds)'
      };
    }
    
    // Check for pattern regularity (exact timing intervals)
    const regularityScore = this.calculatePatternRegularity(recentRequests);
    if (regularityScore > 0.8) {
      return {
        name: 'Behavioral Patterns',
        status: 'WARN',
        message: `High pattern regularity detected (${(regularityScore * 100).toFixed(1)}%)`,
        recommendation: 'Introduce more randomness in request timing'
      };
    }
    
    // Check for varied endpoints (human-like behavior)
    const endpointVariety = new Set(recentRequests.map(r => r.endpoint)).size;
    if (endpointVariety === 1 && recentRequests.length > 5) {
      return {
        name: 'Behavioral Patterns',
        status: 'WARN',
        message: 'Low endpoint variety - may appear automated',
        recommendation: 'Vary API endpoint usage patterns'
      };
    }
    
    return {
      name: 'Behavioral Patterns',
      status: 'PASS',
      message: 'Behavioral patterns appear human-like'
    };
  }

  /**
   * Check LinkedIn Terms of Service compliance
   */
  private async checkTOSCompliance(userId: string): Promise<{
    name: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    recommendation?: string;
  }> {
    const usage = this.getUserUsage(userId);
    const violations: string[] = [];
    
    // Check connection request limits (LinkedIn's most sensitive area)
    if (usage.daily.connections > 50) {
      violations.push('Excessive connection requests');
    }
    
    // Check for message spam patterns
    if (usage.daily.messages > 30) {
      violations.push('High message volume');
    }
    
    // Check for profile scraping patterns
    if (usage.daily.profileViews > 100) {
      violations.push('Excessive profile viewing');
    }
    
    // Check error rate (high error rate suggests aggressive automation)
    const recentRequests = this.getRecentActivity(userId, 24);
    const errorRate = recentRequests.filter(r => !r.success).length / Math.max(1, recentRequests.length);
    
    if (errorRate > 0.15) {
      violations.push('High error rate suggests aggressive automation');
    }
    
    if (violations.length > 2) {
      return {
        name: 'LinkedIn TOS Compliance',
        status: 'FAIL',
        message: `Multiple TOS violations detected: ${violations.join(', ')}`,
        recommendation: 'Immediately reduce automation and review LinkedIn Terms of Service'
      };
    } else if (violations.length > 0) {
      return {
        name: 'LinkedIn TOS Compliance',
        status: 'WARN',
        message: `Potential TOS concerns: ${violations.join(', ')}`,
        recommendation: 'Review and adjust automation parameters'
      };
    } else {
      return {
        name: 'LinkedIn TOS Compliance',
        status: 'PASS',
        message: 'No TOS violations detected'
      };
    }
  }

  /**
   * Calculate health trends over time
   */
  private async calculateHealthTrends(userId: string): Promise<{
    errorRateWeekly: number;
    usageGrowthRate: number;
    successRateChange: number;
  }> {
    const weeklyRequests = this.getRecentActivity(userId, 168); // 7 days
    const previousWeekRequests = this.getRecentActivity(userId, 336).slice(168); // Previous week
    
    // Calculate error rates
    const weeklyErrorRate = weeklyRequests.filter(r => !r.success).length / Math.max(1, weeklyRequests.length);
    const previousErrorRate = previousWeekRequests.filter(r => !r.success).length / Math.max(1, previousWeekRequests.length);
    
    // Calculate usage growth
    const usageGrowthRate = previousWeekRequests.length === 0 
      ? 0 
      : (weeklyRequests.length - previousWeekRequests.length) / previousWeekRequests.length;
    
    // Calculate success rate change
    const successRateChange = (1 - weeklyErrorRate) - (1 - previousErrorRate);
    
    return {
      errorRateWeekly: weeklyErrorRate,
      usageGrowthRate,
      successRateChange
    };
  }

  /**
   * Helper methods for behavioral analysis
   */
  private checkForRapidRequests(requests: RequestMetrics[]): { count: number; timeSpan: number } {
    let rapidCount = 0;
    let totalTimeSpan = 0;
    
    for (let i = 1; i < requests.length; i++) {
      const timeDiff = requests[i].timestamp.getTime() - requests[i-1].timestamp.getTime();
      if (timeDiff < 30000) { // Less than 30 seconds
        rapidCount++;
        totalTimeSpan += timeDiff;
      }
    }
    
    return {
      count: rapidCount,
      timeSpan: rapidCount > 0 ? totalTimeSpan / rapidCount : 0
    };
  }

  private calculatePatternRegularity(requests: RequestMetrics[]): number {
    if (requests.length < 3) return 0;
    
    const intervals: number[] = [];
    for (let i = 1; i < requests.length; i++) {
      intervals.push(requests[i].timestamp.getTime() - requests[i-1].timestamp.getTime());
    }
    
    // Calculate variance in intervals
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower variance = higher regularity (more bot-like)
    const coefficientOfVariation = standardDeviation / mean;
    return Math.max(0, 1 - coefficientOfVariation); // Invert so high score = high regularity
  }
}

/**
 * Database integration service for LinkedIn profile data
 * Handles storage, caching, and synchronization with analytics service
 */
export class LinkedInDatabaseService {
  private readonly cachePrefix = 'linkedin:';
  private readonly cacheTTL = 3600; // 1 hour cache

  /**
   * Store LinkedIn account data after OAuth connection
   */
  async storeLinkedInAccount(userId: string, data: {
    accessToken: string;
    refreshToken?: string;
    profile: LinkedInProfile;
    completeness: ProfileCompleteness;
    connectedAt: Date;
    lastSyncAt: Date;
  }): Promise<void> {
    try {
      // Store encrypted tokens (implementation would use proper encryption)
      const encryptedTokens = {
        accessToken: this.encryptToken(data.accessToken),
        refreshToken: data.refreshToken ? this.encryptToken(data.refreshToken) : null,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours typical expiry
      };

      // Store in database (pseudo-implementation)
      const accountData = {
        userId,
        linkedinId: data.profile.id,
        profileData: JSON.stringify(data.profile),
        completenessData: JSON.stringify(data.completeness),
        tokens: JSON.stringify(encryptedTokens),
        connectedAt: data.connectedAt,
        lastSyncAt: data.lastSyncAt,
        isActive: true
      };

      // TODO: Implement actual database storage
      // await database.query('INSERT INTO linkedin_accounts ...', accountData);

      // Cache the profile data for quick access
      await this.cacheProfileData(userId, data.profile, data.completeness);

      logger.info('LinkedIn account stored successfully', { userId, linkedinId: data.profile.id });
    } catch (error) {
      logger.error('Failed to store LinkedIn account', { error, userId });
      throw error;
    }
  }

  /**
   * Update LinkedIn account data after sync
   */
  async updateLinkedInAccount(userId: string, data: {
    profile: LinkedInProfile;
    completeness: ProfileCompleteness;
    analytics?: Partial<LinkedInAnalytics>;
    lastSyncAt: Date;
  }): Promise<void> {
    try {
      const updateData = {
        profileData: JSON.stringify(data.profile),
        completenessData: JSON.stringify(data.completeness),
        analyticsData: data.analytics ? JSON.stringify(data.analytics) : null,
        lastSyncAt: data.lastSyncAt
      };

      // TODO: Implement actual database update
      // await database.query('UPDATE linkedin_accounts SET ... WHERE userId = ?', [updateData, userId]);

      // Update cache
      await this.cacheProfileData(userId, data.profile, data.completeness);

      logger.info('LinkedIn account updated successfully', { userId, syncedAt: data.lastSyncAt });
    } catch (error) {
      logger.error('Failed to update LinkedIn account', { error, userId });
      throw error;
    }
  }

  /**
   * Get stored access token for user
   */
  async getStoredAccessToken(userId: string): Promise<string | null> {
    try {
      // TODO: Implement actual database query
      // const result = await database.query('SELECT tokens FROM linkedin_accounts WHERE userId = ? AND isActive = true', [userId]);
      
      // if (result.rows.length === 0) return null;
      
      // const tokens = JSON.parse(result.rows[0].tokens);
      // return this.decryptToken(tokens.accessToken);
      
      return null; // Placeholder
    } catch (error) {
      logger.error('Failed to get stored access token', { error, userId });
      return null;
    }
  }

  /**
   * Get cached profile data
   */
  async getCachedProfile(userId: string): Promise<{
    profile: LinkedInProfile;
    completeness: ProfileCompleteness;
    lastSyncAt: Date;
  } | null> {
    try {
      // Check cache first (Redis implementation)
      const cacheKey = `${this.cachePrefix}profile:${userId}`;
      // const cached = await redis.get(cacheKey);
      
      // if (cached) {
      //   return JSON.parse(cached);
      // }

      // Fallback to database
      // TODO: Implement actual database query
      // const result = await database.query(
      //   'SELECT profileData, completenessData, lastSyncAt FROM linkedin_accounts WHERE userId = ? AND isActive = true',
      //   [userId]
      // );

      // if (result.rows.length === 0) return null;

      // const row = result.rows[0];
      // const profileData = {
      //   profile: JSON.parse(row.profileData),
      //   completeness: JSON.parse(row.completenessData),
      //   lastSyncAt: row.lastSyncAt
      // };

      // Cache for future requests
      // await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(profileData));

      // return profileData;
      
      return null; // Placeholder
    } catch (error) {
      logger.error('Failed to get cached profile', { error, userId });
      return null;
    }
  }

  /**
   * Remove LinkedIn account data
   */
  async removeLinkedInAccount(userId: string): Promise<void> {
    try {
      // Soft delete - keep analytics data but mark as inactive
      // TODO: Implement actual database update
      // await database.query(
      //   'UPDATE linkedin_accounts SET isActive = false, tokens = null, disconnectedAt = NOW() WHERE userId = ?',
      //   [userId]
      // );

      // Remove from cache
      const cacheKey = `${this.cachePrefix}profile:${userId}`;
      // await redis.del(cacheKey);

      logger.info('LinkedIn account removed successfully', { userId });
    } catch (error) {
      logger.error('Failed to remove LinkedIn account', { error, userId });
      throw error;
    }
  }

  /**
   * Send analytics data to analytics service
   */
  async sendAnalyticsData(userId: string, data: {
    profile: LinkedInProfile;
    completeness: ProfileCompleteness;
    analytics?: Partial<LinkedInAnalytics>;
  }): Promise<void> {
    try {
      const analyticsPayload = {
        userId,
        timestamp: new Date(),
        eventType: 'profile_sync',
        data: {
          profileViews: data.analytics?.profileViews?.total || 0,
          searchAppearances: data.analytics?.searchAppearances?.total || 0,
          connectionsCount: (data.profile.positions || []).length, // Approximate
          completenessScore: data.completeness.score,
          skillsCount: data.profile.skills?.length || 0,
          endorsementsCount: data.profile.skills?.reduce((sum, skill) => sum + (skill.endorsementCount || 0), 0) || 0,
          postsCount: data.analytics?.postViews?.total || 0,
          engagementRate: 0.0, // Would be calculated from engagement data
          source: 'linkedin_service'
        }
      };

      // Send to analytics service
      await this.sendToAnalyticsService('/ingest/event', analyticsPayload);

      logger.info('Analytics data sent successfully', { userId });
    } catch (error) {
      logger.error('Failed to send analytics data', { error, userId });
      // Don't throw - analytics failure shouldn't break main flow
    }
  }

  /**
   * Track LinkedIn events for analytics
   */
  async trackLinkedInEvent(userId: string, eventType: string, eventData: any): Promise<void> {
    try {
      const payload = {
        userId,
        timestamp: new Date(),
        eventType,
        data: eventData
      };

      await this.sendToAnalyticsService('/ingest/event', payload);
    } catch (error) {
      logger.error('Failed to track LinkedIn event', { error, userId, eventType });
    }
  }

  /**
   * Get LinkedIn account status for user
   */
  async getAccountStatus(userId: string): Promise<{
    isConnected: boolean;
    connectedAt?: Date;
    lastSyncAt?: Date;
    tokenExpiry?: Date;
    profileCompleteness?: number;
  }> {
    try {
      // TODO: Implement actual database query
      // const result = await database.query(
      //   'SELECT connectedAt, lastSyncAt, tokens, completenessData FROM linkedin_accounts WHERE userId = ? AND isActive = true',
      //   [userId]
      // );

      // if (result.rows.length === 0) {
      //   return { isConnected: false };
      // }

      // const row = result.rows[0];
      // const tokens = JSON.parse(row.tokens);
      // const completeness = JSON.parse(row.completenessData);

      // return {
      //   isConnected: true,
      //   connectedAt: row.connectedAt,
      //   lastSyncAt: row.lastSyncAt,
      //   tokenExpiry: tokens.expiresAt,
      //   profileCompleteness: completeness.score
      // };

      return { isConnected: false }; // Placeholder
    } catch (error) {
      logger.error('Failed to get account status', { error, userId });
      return { isConnected: false };
    }
  }

  // Private helper methods

  /**
   * Cache profile data for quick access
   */
  private async cacheProfileData(
    userId: string,
    profile: LinkedInProfile,
    completeness: ProfileCompleteness
  ): Promise<void> {
    try {
      const cacheKey = `${this.cachePrefix}profile:${userId}`;
      const cacheData = {
        profile,
        completeness,
        lastSyncAt: new Date()
      };

      // TODO: Implement Redis caching
      // await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(cacheData));
    } catch (error) {
      logger.warn('Failed to cache profile data', { error, userId });
    }
  }

  /**
   * Send data to analytics service
   */
  private async sendToAnalyticsService(endpoint: string, data: any): Promise<void> {
    try {
      const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3004';
      
      // TODO: Implement HTTP client call to analytics service
      // const response = await axios.post(`${analyticsServiceUrl}${endpoint}`, data, {
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-Service-Token': process.env.SERVICE_TOKEN
      //   },
      //   timeout: 5000
      // });

      // if (response.status !== 200 && response.status !== 201) {
      //   throw new Error(`Analytics service returned ${response.status}`);
      // }
    } catch (error) {
      logger.error('Failed to send data to analytics service', { error, endpoint });
      throw error;
    }
  }

  /**
   * Encrypt access token for storage
   */
  private encryptToken(token: string): string {
    // TODO: Implement proper token encryption
    // This is a placeholder - use proper encryption in production
    return Buffer.from(token).toString('base64');
  }

  /**
   * Decrypt access token from storage
   */
  private decryptToken(encryptedToken: string): string {
    // TODO: Implement proper token decryption
    // This is a placeholder - use proper decryption in production
    return Buffer.from(encryptedToken, 'base64').toString('utf-8');
  }
}
