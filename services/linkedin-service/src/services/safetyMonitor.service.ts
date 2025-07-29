// ===================================================================
// SAFETY MONITOR SERVICE - Real-time LinkedIn Compliance Monitoring
// ===================================================================

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { LinkedInComplianceService } from './compliance.service';
import { LinkedInRateLimitService } from './rateLimit.service';

interface SafetyAlert {
  id: string;
  userId: string;
  type: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  category: 'RATE_LIMIT' | 'ACCOUNT_HEALTH' | 'PATTERN_DETECTION' | 'API_ERROR' | 'COMPLIANCE_VIOLATION';
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  actions: string[];
}

interface UserSafetyStatus {
  userId: string;
  overallStatus: 'SAFE' | 'WARNING' | 'CRITICAL' | 'SUSPENDED';
  score: number; // 0-100
  activeAlerts: SafetyAlert[];
  automationEnabled: boolean;
  lastHealthCheck: Date;
  suspensionReason?: string;
  metrics: {
    dailyActions: number;
    errorRate: number;
    complianceScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

interface SafetyThresholds {
  errorRateThreshold: number;       // 0.05 = 5%
  dailyActionLimit: number;         // Total daily actions across all types
  consecutiveFailureLimit: number;  // Max consecutive failures before suspension
  riskScoreThreshold: number;       // 0-100, above which to suspend
  accountHealthMinimum: number;     // Minimum account health score
}

export class LinkedInSafetyMonitorService extends EventEmitter {
  private redis: Redis;
  private complianceService: LinkedInComplianceService;
  private rateLimitService: LinkedInRateLimitService;
  private userStatuses: Map<string, UserSafetyStatus>;
  private monitoringIntervals: Map<string, NodeJS.Timeout>;

  // Ultra-conservative safety thresholds
  private readonly SAFETY_THRESHOLDS: SafetyThresholds = {
    errorRateThreshold: 0.03,        // 3% error rate triggers warning
    dailyActionLimit: 50,            // Maximum 50 total daily actions
    consecutiveFailureLimit: 3,      // 3 consecutive failures = suspension
    riskScoreThreshold: 75,          // Risk score >75 = suspension
    accountHealthMinimum: 70,        // Health score <70 = warning
  };

  constructor(
    complianceService: LinkedInComplianceService,
    rateLimitService: LinkedInRateLimitService
  ) {
    super();
    this.complianceService = complianceService;
    this.rateLimitService = rateLimitService;
    this.userStatuses = new Map();
    this.monitoringIntervals = new Map();
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    // Start global monitoring
    this.startGlobalMonitoring();
  }

  /**
   * Start monitoring a user's LinkedIn automation safety
   */
  async startUserMonitoring(userId: string): Promise<void> {
    try {
      // Initialize user safety status
      const status = await this.initializeUserStatus(userId);
      this.userStatuses.set(userId, status);

      // Start individual user monitoring
      const interval = setInterval(async () => {
        await this.performUserSafetyCheck(userId);
      }, 60000); // Check every minute

      this.monitoringIntervals.set(userId, interval);

      // Perform immediate safety check
      await this.performUserSafetyCheck(userId);

      this.emit('userMonitoringStarted', { userId });
      console.log(`Safety monitoring started for user ${userId}`);

    } catch (error) {
      console.error(`Error starting monitoring for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring a user
   */
  async stopUserMonitoring(userId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(userId);
    }

    this.userStatuses.delete(userId);
    this.emit('userMonitoringStopped', { userId });
    console.log(`Safety monitoring stopped for user ${userId}`);
  }

  /**
   * Perform comprehensive safety check for a user
   */
  async performUserSafetyCheck(userId: string): Promise<UserSafetyStatus> {
    try {
      const status = this.userStatuses.get(userId);
      if (!status) {
        throw new Error(`User ${userId} not being monitored`);
      }

      // Update metrics
      await this.updateUserMetrics(status);

      // Perform safety checks
      await this.checkErrorRates(status);
      await this.checkDailyLimits(status);
      await this.checkAccountHealth(status);
      await this.checkPatternAnomalies(status);
      await this.checkConsecutiveFailures(status);

      // Calculate overall safety score and status
      this.calculateOverallSafetyStatus(status);

      // Take action if needed
      await this.enforceAutomationControls(status);

      // Update last check time
      status.lastHealthCheck = new Date();

      // Store status in Redis for persistence
      await this.storeUserStatus(status);

      this.emit('safetyCheckCompleted', { userId, status: status.overallStatus, score: status.score });

      return status;

    } catch (error) {
      console.error(`Error performing safety check for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize user safety status
   */
  private async initializeUserStatus(userId: string): Promise<UserSafetyStatus> {
    // Try to load existing status from Redis
    const existingStatus = await this.loadUserStatus(userId);
    if (existingStatus) {
      return existingStatus;
    }

    // Create new status
    return {
      userId,
      overallStatus: 'SAFE',
      score: 100,
      activeAlerts: [],
      automationEnabled: true,
      lastHealthCheck: new Date(),
      metrics: {
        dailyActions: 0,
        errorRate: 0,
        complianceScore: 100,
        riskLevel: 'LOW'
      }
    };
  }

  /**
   * Update user metrics from various sources
   */
  private async updateUserMetrics(status: UserSafetyStatus): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get daily action count from all automation services
    const [connectionCount, engagementStats] = await Promise.all([
      this.getDailyConnectionCount(status.userId),
      this.getDailyEngagementCounts(status.userId)
    ]);

    status.metrics.dailyActions = connectionCount + engagementStats.total;

    // Get error rate from compliance service
    const complianceMetrics = await this.complianceService.getComplianceMetrics(status.userId);
    status.metrics.complianceScore = complianceMetrics.accountHealth.score;
    status.metrics.riskLevel = complianceMetrics.accountHealth.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH';

    // Calculate error rate from recent activity
    status.metrics.errorRate = await this.calculateErrorRate(status.userId);
  }

  /**
   * Check error rates and create alerts if necessary
   */
  private async checkErrorRates(status: UserSafetyStatus): Promise<void> {
    if (status.metrics.errorRate > this.SAFETY_THRESHOLDS.errorRateThreshold) {
      const alertType = status.metrics.errorRate > 0.1 ? 'CRITICAL' : 'WARNING';
      
      await this.createAlert(status, {
        type: alertType,
        category: 'API_ERROR',
        message: `High error rate detected: ${(status.metrics.errorRate * 100).toFixed(1)}%`,
        details: {
          errorRate: status.metrics.errorRate,
          threshold: this.SAFETY_THRESHOLDS.errorRateThreshold
        },
        actions: alertType === 'CRITICAL' 
          ? ['Suspend automation immediately', 'Review recent activity', 'Contact support']
          : ['Reduce automation frequency', 'Monitor closely', 'Review error patterns']
      });
    }
  }

  /**
   * Check daily action limits
   */
  private async checkDailyLimits(status: UserSafetyStatus): Promise<void> {
    if (status.metrics.dailyActions > this.SAFETY_THRESHOLDS.dailyActionLimit) {
      await this.createAlert(status, {
        type: 'WARNING',
        category: 'RATE_LIMIT',
        message: `Daily action limit exceeded: ${status.metrics.dailyActions}/${this.SAFETY_THRESHOLDS.dailyActionLimit}`,
        details: {
          dailyActions: status.metrics.dailyActions,
          limit: this.SAFETY_THRESHOLDS.dailyActionLimit
        },
        actions: ['Pause automation for today', 'Review automation settings']
      });
    } else if (status.metrics.dailyActions > this.SAFETY_THRESHOLDS.dailyActionLimit * 0.8) {
      await this.createAlert(status, {
        type: 'WARNING',
        category: 'RATE_LIMIT',
        message: `Approaching daily action limit: ${status.metrics.dailyActions}/${this.SAFETY_THRESHOLDS.dailyActionLimit}`,
        details: {
          dailyActions: status.metrics.dailyActions,
          limit: this.SAFETY_THRESHOLDS.dailyActionLimit
        },
        actions: ['Reduce automation frequency', 'Monitor remaining actions']
      });
    }
  }

  /**
   * Check account health
   */
  private async checkAccountHealth(status: UserSafetyStatus): Promise<void> {
    if (status.metrics.complianceScore < this.SAFETY_THRESHOLDS.accountHealthMinimum) {
      const alertType = status.metrics.complianceScore < 50 ? 'CRITICAL' : 'WARNING';
      
      await this.createAlert(status, {
        type: alertType,
        category: 'ACCOUNT_HEALTH',
        message: `Account health score below threshold: ${status.metrics.complianceScore}/${this.SAFETY_THRESHOLDS.accountHealthMinimum}`,
        details: {
          healthScore: status.metrics.complianceScore,
          threshold: this.SAFETY_THRESHOLDS.accountHealthMinimum,
          riskLevel: status.metrics.riskLevel
        },
        actions: alertType === 'CRITICAL'
          ? ['Immediate automation suspension', 'Account health review', 'Contact LinkedIn support if needed']
          : ['Reduce automation activity', 'Review compliance guidelines', 'Monitor health score']
      });
    }
  }

  /**
   * Check for pattern anomalies that might indicate bot detection
   */
  private async checkPatternAnomalies(status: UserSafetyStatus): Promise<void> {
    const anomalies = await this.detectPatternAnomalies(status.userId);
    
    if (anomalies.length > 0) {
      await this.createAlert(status, {
        type: 'WARNING',
        category: 'PATTERN_DETECTION',
        message: `Suspicious activity patterns detected: ${anomalies.join(', ')}`,
        details: {
          anomalies,
          detectionTime: new Date()
        },
        actions: [
          'Vary automation timing',
          'Add more randomness to actions',
          'Reduce automation frequency',
          'Review activity patterns'
        ]
      });
    }
  }

  /**
   * Check for consecutive failures
   */
  private async checkConsecutiveFailures(status: UserSafetyStatus): Promise<void> {
    const consecutiveFailures = await this.getConsecutiveFailureCount(status.userId);
    
    if (consecutiveFailures >= this.SAFETY_THRESHOLDS.consecutiveFailureLimit) {
      await this.createAlert(status, {
        type: 'CRITICAL',
        category: 'API_ERROR',
        message: `${consecutiveFailures} consecutive failures detected`,
        details: {
          consecutiveFailures,
          threshold: this.SAFETY_THRESHOLDS.consecutiveFailureLimit
        },
        actions: [
          'Immediate automation suspension',
          'Review LinkedIn API access',
          'Check for account restrictions',
          'Contact support if issues persist'
        ]
      });
    }
  }

  /**
   * Calculate overall safety status and score
   */
  private calculateOverallSafetyStatus(status: UserSafetyStatus): void {
    let score = 100;
    let worstStatus: 'SAFE' | 'WARNING' | 'CRITICAL' | 'SUSPENDED' = 'SAFE';

    // Deduct points based on active alerts
    for (const alert of status.activeAlerts) {
      if (alert.type === 'CRITICAL') {
        score -= 25;
        if (worstStatus !== 'SUSPENDED') worstStatus = 'CRITICAL';
      } else if (alert.type === 'WARNING') {
        score -= 10;
        if (worstStatus === 'SAFE') worstStatus = 'WARNING';
      } else if (alert.type === 'EMERGENCY') {
        score -= 50;
        worstStatus = 'SUSPENDED';
      }
    }

    // Additional scoring based on metrics
    if (status.metrics.errorRate > 0.05) score -= 15;
    if (status.metrics.dailyActions > this.SAFETY_THRESHOLDS.dailyActionLimit) score -= 20;
    if (status.metrics.complianceScore < 70) score -= 15;
    if (status.metrics.riskLevel === 'HIGH') score -= 20;

    // Ensure score is within bounds
    status.score = Math.max(0, Math.min(100, score));

    // Determine status based on score and alerts
    if (status.score < 30 || worstStatus === 'SUSPENDED') {
      status.overallStatus = 'SUSPENDED';
    } else if (status.score < 60 || worstStatus === 'CRITICAL') {
      status.overallStatus = 'CRITICAL';
    } else if (status.score < 80 || worstStatus === 'WARNING') {
      status.overallStatus = 'WARNING';
    } else {
      status.overallStatus = 'SAFE';
    }
  }

  /**
   * Enforce automation controls based on safety status
   */
  private async enforceAutomationControls(status: UserSafetyStatus): Promise<void> {
    const shouldSuspend = status.overallStatus === 'SUSPENDED' || status.overallStatus === 'CRITICAL';
    
    if (shouldSuspend && status.automationEnabled) {
      // Suspend automation
      await this.suspendUserAutomation(status.userId, status.overallStatus === 'CRITICAL' ? 'Critical safety violation detected' : 'Safety score too low');
      status.automationEnabled = false;
      status.suspensionReason = status.overallStatus === 'CRITICAL' ? 'Critical safety violation' : 'Low safety score';
      
      // Create emergency alert
      await this.createAlert(status, {
        type: 'EMERGENCY',
        category: 'COMPLIANCE_VIOLATION',
        message: 'Automation suspended due to safety violations',
        details: {
          reason: status.suspensionReason,
          score: status.score,
          activeAlerts: status.activeAlerts.length
        },
        actions: [
          'Automation suspended',
          'Review all safety alerts',
          'Contact support',
          'Do not resume until issues resolved'
        ]
      });

      this.emit('automationSuspended', { 
        userId: status.userId, 
        reason: status.suspensionReason,
        score: status.score 
      });

    } else if (!shouldSuspend && !status.automationEnabled && status.score > 85) {
      // Consider re-enabling automation if safety score is high
      // This should require manual approval
      this.emit('automationReenableCandidate', { 
        userId: status.userId, 
        score: status.score 
      });
    }
  }

  /**
   * Create and store a safety alert
   */
  private async createAlert(status: UserSafetyStatus, alertData: {
    type: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
    category: string;
    message: string;
    details: any;
    actions: string[];
  }): Promise<void> {
    const alertId = `alert_${status.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: SafetyAlert = {
      id: alertId,
      userId: status.userId,
      type: alertData.type,
      category: alertData.category as any,
      message: alertData.message,
      details: alertData.details,
      timestamp: new Date(),
      resolved: false,
      actions: alertData.actions
    };

    // Check if similar alert already exists to avoid spam
    const existingAlert = status.activeAlerts.find(a => 
      a.category === alert.category && 
      a.message === alert.message && 
      !a.resolved
    );

    if (!existingAlert) {
      status.activeAlerts.push(alert);
      
      // Store alert in Redis
      await this.redis.setex(
        `safety_alert:${alertId}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify(alert)
      );

      this.emit('safetyAlert', alert);
      console.warn(`Safety alert created for user ${status.userId}: ${alert.message}`);
    }
  }

  /**
   * Suspend user automation
   */
  private async suspendUserAutomation(userId: string, reason: string): Promise<void> {
    // Set suspension flag in Redis for all automation services to check
    await this.redis.setex(
      `automation_suspended:${userId}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify({
        suspended: true,
        reason,
        timestamp: new Date().toISOString()
      })
    );

    // Clear all pending automation tasks for this user
    await this.clearUserAutomationQueues(userId);

    console.error(`Automation suspended for user ${userId}: ${reason}`);
  }

  /**
   * Check if user automation is currently suspended
   */
  async isUserAutomationSuspended(userId: string): Promise<{ suspended: boolean; reason?: string }> {
    const suspensionData = await this.redis.get(`automation_suspended:${userId}`);
    
    if (suspensionData) {
      const data = JSON.parse(suspensionData);
      return {
        suspended: data.suspended,
        reason: data.reason
      };
    }
    
    return { suspended: false };
  }

  /**
   * Manually resume user automation (admin function)
   */
  async resumeUserAutomation(userId: string, adminId: string): Promise<{ success: boolean; reason?: string }> {
    try {
      const status = this.userStatuses.get(userId);
      if (!status) {
        return { success: false, reason: 'User not found in monitoring system' };
      }

      // Check if it's safe to resume
      if (status.score < 80) {
        return { success: false, reason: `Safety score too low (${status.score}/100). Minimum required: 80` };
      }

      // Remove suspension
      await this.redis.del(`automation_suspended:${userId}`);
      
      status.automationEnabled = true;
      status.suspensionReason = undefined;
      
      // Resolve all active alerts
      for (const alert of status.activeAlerts) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
      }
      
      await this.storeUserStatus(status);

      // Log admin action
      await this.redis.lpush(
        `admin_actions:${userId}`,
        JSON.stringify({
          action: 'resume_automation',
          adminId,
          timestamp: new Date().toISOString(),
          reason: 'Manual admin override'
        })
      );

      this.emit('automationResumed', { userId, adminId });
      console.log(`Automation resumed for user ${userId} by admin ${adminId}`);

      return { success: true };

    } catch (error) {
      console.error(`Error resuming automation for user ${userId}:`, error);
      return { success: false, reason: 'Internal error' };
    }
  }

  /**
   * Get safety dashboard data for all monitored users
   */
  async getSafetyDashboard(): Promise<{
    totalUsers: number;
    statusBreakdown: {
      safe: number;
      warning: number;
      critical: number;
      suspended: number;
    };
    activeAlerts: number;
    averageSafetyScore: number;
    recentAlerts: SafetyAlert[];
  }> {
    const statuses = Array.from(this.userStatuses.values());
    
    const statusBreakdown = {
      safe: statuses.filter(s => s.overallStatus === 'SAFE').length,
      warning: statuses.filter(s => s.overallStatus === 'WARNING').length,
      critical: statuses.filter(s => s.overallStatus === 'CRITICAL').length,
      suspended: statuses.filter(s => s.overallStatus === 'SUSPENDED').length
    };

    const allActiveAlerts = statuses.flatMap(s => s.activeAlerts.filter(a => !a.resolved));
    const averageSafetyScore = statuses.length > 0 
      ? Math.round(statuses.reduce((sum, s) => sum + s.score, 0) / statuses.length)
      : 100;

    // Get recent alerts (last 24 hours)
    const recentAlerts = allActiveAlerts
      .filter(a => a.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);

    return {
      totalUsers: statuses.length,
      statusBreakdown,
      activeAlerts: allActiveAlerts.length,
      averageSafetyScore,
      recentAlerts
    };
  }

  /**
   * Start global monitoring for system-wide safety checks
   */
  private startGlobalMonitoring(): void {
    // Check for system-wide anomalies every 5 minutes
    setInterval(async () => {
      try {
        await this.performGlobalSafetyCheck();
      } catch (error) {
        console.error('Error in global safety check:', error);
      }
    }, 5 * 60 * 1000);

    console.log('Global safety monitoring started');
  }

  /**
   * Perform system-wide safety checks
   */
  private async performGlobalSafetyCheck(): Promise<void> {
    const statuses = Array.from(this.userStatuses.values());
    
    // Check for patterns that might indicate system-wide issues
    const highErrorRateUsers = statuses.filter(s => s.metrics.errorRate > 0.1);
    const suspendedUsers = statuses.filter(s => s.overallStatus === 'SUSPENDED');
    
    if (highErrorRateUsers.length > statuses.length * 0.2) {
      // More than 20% of users have high error rates - possible LinkedIn API issue
      this.emit('systemAlert', {
        type: 'API_DEGRADATION',
        message: `${highErrorRateUsers.length}/${statuses.length} users experiencing high error rates`,
        recommendation: 'Consider pausing automation system-wide'
      });
    }

    if (suspendedUsers.length > statuses.length * 0.1) {
      // More than 10% of users suspended - possible policy change
      this.emit('systemAlert', {
        type: 'POLICY_CHANGE',
        message: `${suspendedUsers.length}/${statuses.length} users suspended`,
        recommendation: 'Review LinkedIn policy changes and automation practices'
      });
    }
  }

  // Helper methods (implement based on your existing services)
  private async getDailyConnectionCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `connections:daily:${userId}:${today}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0');
  }

  private async getDailyEngagementCounts(userId: string): Promise<{ total: number; likes: number; comments: number; views: number }> {
    const today = new Date().toISOString().split('T')[0];
    const types = ['like', 'comment', 'view_profile', 'follow'];
    
    const counts = await Promise.all(
      types.map(async type => {
        const key = `engagement:daily:${userId}:${type}:${today}`;
        const count = await this.redis.get(key);
        return parseInt(count || '0');
      })
    );

    return {
      total: counts.reduce((sum, count) => sum + count, 0),
      likes: counts[0],
      comments: counts[1],
      views: counts[2]
    };
  }

  private async calculateErrorRate(userId: string): Promise<number> {
    // Get recent API calls from analytics
    const analyticsKey = `linkedin_analytics:${userId}:${new Date().toISOString().split('T')[0]}`;
    const entries = await this.redis.lrange(analyticsKey, 0, 99);
    
    if (entries.length === 0) return 0;

    const errors = entries.filter(entry => {
      try {
        const data = JSON.parse(entry);
        return !data.success;
      } catch {
        return false;
      }
    }).length;

    return errors / entries.length;
  }

  private async detectPatternAnomalies(userId: string): Promise<string[]> {
    const anomalies: string[] = [];
    
    // Check for overly regular timing patterns
    const timing = await this.analyzeTimingPatterns(userId);
    if (timing.regularity > 0.8) {
      anomalies.push('Highly regular timing patterns detected');
    }

    // Check for burst activity
    if (timing.bursty) {
      anomalies.push('Burst activity pattern detected');
    }

    // Check for unusual time periods
    if (timing.overnightActivity > 0.2) {
      anomalies.push('High overnight activity detected');
    }

    return anomalies;
  }

  private async analyzeTimingPatterns(userId: string): Promise<{
    regularity: number;
    bursty: boolean;
    overnightActivity: number;
  }> {
    // Simplified pattern analysis - implement more sophisticated analysis as needed
    return {
      regularity: Math.random() * 0.7, // Random for now
      bursty: false,
      overnightActivity: 0.1
    };
  }

  private async getConsecutiveFailureCount(userId: string): Promise<number> {
    const analyticsKey = `linkedin_analytics:${userId}:${new Date().toISOString().split('T')[0]}`;
    const entries = await this.redis.lrange(analyticsKey, 0, 19); // Last 20 entries
    
    let consecutiveFailures = 0;
    
    for (const entry of entries) {
      try {
        const data = JSON.parse(entry);
        if (!data.success) {
          consecutiveFailures++;
        } else {
          break; // Stop counting when we hit a success
        }
      } catch {
        // Skip invalid entries
      }
    }

    return consecutiveFailures;
  }

  private async clearUserAutomationQueues(userId: string): Promise<void> {
    // Clear connection automation queues
    const connectionQueues = ['connections:high', 'connections:normal', 'connections:low'];
    
    for (const queueKey of connectionQueues) {
      const tasks = await this.redis.lrange(queueKey, 0, -1);
      const userTasks = tasks.filter(task => {
        try {
          const data = JSON.parse(task);
          return data.userId === userId;
        } catch {
          return false;
        }
      });

      // Remove user's tasks
      for (const task of userTasks) {
        await this.redis.lrem(queueKey, 1, task);
      }
    }

    // Clear engagement automation queues
    const engagementTypes = ['like', 'comment', 'view_profile', 'follow'];
    const priorities = ['high', 'normal', 'low'];
    
    for (const type of engagementTypes) {
      for (const priority of priorities) {
        const queueKey = `engagements:${type}:${priority}`;
        const tasks = await this.redis.lrange(queueKey, 0, -1);
        const userTasks = tasks.filter(task => {
          try {
            const data = JSON.parse(task);
            return data.userId === userId;
          } catch {
            return false;
          }
        });

        for (const task of userTasks) {
          await this.redis.lrem(queueKey, 1, task);
        }
      }
    }
  }

  private async storeUserStatus(status: UserSafetyStatus): Promise<void> {
    await this.redis.setex(
      `safety_status:${status.userId}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify(status)
    );
  }

  private async loadUserStatus(userId: string): Promise<UserSafetyStatus | null> {
    const statusData = await this.redis.get(`safety_status:${userId}`);
    return statusData ? JSON.parse(statusData) : null;
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Clear all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    
    await this.redis.quit();
  }
}