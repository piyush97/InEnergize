import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface EmergencyStopReason {
  type: 'MANUAL' | 'RATE_LIMIT' | 'API_ERROR' | 'COMPLIANCE_VIOLATION' | 'SUSPICIOUS_ACTIVITY' | 'SYSTEM_OVERLOAD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata?: any;
  autoResumeAfter?: number; // minutes
}

export interface EmergencyStopStatus {
  userId: string;
  active: boolean;
  reason?: EmergencyStopReason;
  triggeredAt?: Date;
  triggeredBy?: string; // user ID or 'system'
  estimatedResumeTime?: Date;
  manualResumeRequired: boolean;
}

export class EmergencyStopService extends EventEmitter {
  private redis: Redis;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Circuit breaker thresholds
  private readonly CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,        // Failures before opening circuit
    successThreshold: 3,        // Successes before closing circuit from half-open
    timeoutMs: 300000,          // 5 minutes before attempting half-open
    halfOpenMaxAttempts: 1      // Max attempts in half-open state
  };

  // Emergency stop triggers and their auto-resume times
  private readonly EMERGENCY_TRIGGERS = {
    RATE_LIMIT: {
      severity: 'HIGH' as const,
      autoResumeAfter: 60,      // 1 hour
      description: 'LinkedIn API rate limit exceeded'
    },
    API_ERROR: {
      severity: 'MEDIUM' as const,
      autoResumeAfter: 30,      // 30 minutes
      description: 'LinkedIn API returning consistent errors'
    },
    COMPLIANCE_VIOLATION: {
      severity: 'CRITICAL' as const,
      autoResumeAfter: null,    // Manual resume required
      description: 'LinkedIn compliance violation detected'
    },
    SUSPICIOUS_ACTIVITY: {
      severity: 'HIGH' as const,
      autoResumeAfter: 120,     // 2 hours
      description: 'Suspicious automation patterns detected'
    },
    SYSTEM_OVERLOAD: {
      severity: 'MEDIUM' as const,
      autoResumeAfter: 15,      // 15 minutes
      description: 'System resources overloaded'
    }
  };

  constructor() {
    super();
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.circuitBreakers = new Map();
    this.startMonitoring();
    
    console.log('Emergency Stop Service initialized with circuit breaker protection');
  }

  /**
   * Initialize circuit breaker for a user service
   */
  async initializeCircuitBreaker(
    userId: string, 
    service: 'connection' | 'engagement' | 'profile_view' | 'follow'
  ): Promise<void> {
    const key = `${userId}:${service}`;
    
    if (!this.circuitBreakers.has(key)) {
      const initialState: CircuitBreakerState = {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0
      };
      
      this.circuitBreakers.set(key, initialState);
      
      // Store in Redis for persistence
      await this.redis.setex(
        `circuit_breaker:${key}`,
        24 * 60 * 60, // 24 hours
        JSON.stringify(initialState)
      );
    }
  }

  /**
   * Record operation success for circuit breaker
   */
  async recordSuccess(
    userId: string,
    service: 'connection' | 'engagement' | 'profile_view' | 'follow'
  ): Promise<void> {
    const key = `${userId}:${service}`;
    await this.initializeCircuitBreaker(userId, service);
    
    const breaker = this.circuitBreakers.get(key)!;
    
    breaker.successCount++;
    
    // If in half-open state and enough successes, close the circuit
    if (breaker.state === 'HALF_OPEN' && breaker.successCount >= this.CIRCUIT_BREAKER_CONFIG.successThreshold) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      
      console.log(`Circuit breaker closed for ${key} after successful recovery`);
      this.emit('circuitBreakerClosed', { userId, service });
    }
    
    // Store updated state
    await this.redis.setex(
      `circuit_breaker:${key}`,
      24 * 60 * 60,
      JSON.stringify(breaker)
    );
  }

  /**
   * Record operation failure for circuit breaker
   */
  async recordFailure(
    userId: string,
    service: 'connection' | 'engagement' | 'profile_view' | 'follow',
    error: string
  ): Promise<boolean> {
    const key = `${userId}:${service}`;
    await this.initializeCircuitBreaker(userId, service);
    
    const breaker = this.circuitBreakers.get(key)!;
    
    breaker.failureCount++;
    breaker.lastFailureTime = new Date();
    
    // Check if circuit should open
    if (breaker.state === 'CLOSED' && breaker.failureCount >= this.CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = new Date(Date.now() + this.CIRCUIT_BREAKER_CONFIG.timeoutMs);
      
      console.warn(`Circuit breaker opened for ${key} due to ${breaker.failureCount} failures`);
      this.emit('circuitBreakerOpened', { userId, service, error });
      
      // Trigger emergency stop if failures are critical
      if (this.isCriticalFailure(error)) {
        await this.triggerEmergencyStop(userId, {
          type: 'API_ERROR',
          severity: 'HIGH',
          description: `Critical failures in ${service}: ${error}`,
          metadata: { service, error, failureCount: breaker.failureCount }
        });
      }
    }
    
    // If in half-open state, immediately open on failure
    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = new Date(Date.now() + this.CIRCUIT_BREAKER_CONFIG.timeoutMs);
      breaker.successCount = 0;
      
      console.warn(`Circuit breaker reopened for ${key} during half-open test`);
    }
    
    // Store updated state
    await this.redis.setex(
      `circuit_breaker:${key}`,
      24 * 60 * 60,
      JSON.stringify(breaker)
    );
    
    return breaker.state === 'OPEN';
  }

  /**
   * Check if operation is allowed by circuit breaker
   */
  async isOperationAllowed(
    userId: string,
    service: 'connection' | 'engagement' | 'profile_view' | 'follow'
  ): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
    const key = `${userId}:${service}`;
    await this.initializeCircuitBreaker(userId, service);
    
    const breaker = this.circuitBreakers.get(key)!;
    const now = new Date();
    
    switch (breaker.state) {
      case 'CLOSED':
        return { allowed: true };
      
      case 'OPEN':
        if (breaker.nextAttemptTime && now >= breaker.nextAttemptTime) {
          // Transition to half-open
          breaker.state = 'HALF_OPEN';
          breaker.successCount = 0;
          
          await this.redis.setex(
            `circuit_breaker:${key}`,
            24 * 60 * 60,
            JSON.stringify(breaker)
          );
          
          console.log(`Circuit breaker transitioned to half-open for ${key}`);
          return { allowed: true };
        }
        
        const retryAfter = breaker.nextAttemptTime 
          ? Math.ceil((breaker.nextAttemptTime.getTime() - now.getTime()) / 1000)
          : 300;
          
        return {
          allowed: false,
          reason: 'Circuit breaker is open due to repeated failures',
          retryAfter
        };
      
      case 'HALF_OPEN':
        // Allow limited attempts in half-open state
        return { allowed: true };
      
      default:
        return { allowed: true };
    }
  }

  /**
   * Trigger emergency stop for a user
   */
  async triggerEmergencyStop(
    userId: string,
    reason: EmergencyStopReason,
    triggeredBy?: string
  ): Promise<void> {
    try {
      const stopStatus: EmergencyStopStatus = {
        userId,
        active: true,
        reason,
        triggeredAt: new Date(),
        triggeredBy: triggeredBy || 'system',
        manualResumeRequired: reason.autoResumeAfter === null || reason.autoResumeAfter === undefined,
        estimatedResumeTime: reason.autoResumeAfter 
          ? new Date(Date.now() + reason.autoResumeAfter * 60 * 1000)
          : undefined
      };

      // Store emergency stop status
      const ttl = reason.autoResumeAfter 
        ? (reason.autoResumeAfter + 60) * 60 // TTL = autoResumeAfter + 1 hour buffer
        : 7 * 24 * 60 * 60; // 7 days for manual resume

      await this.redis.setex(
        `emergency_stop:${userId}`,
        ttl,
        JSON.stringify(stopStatus)
      );

      // Add to global emergency stops list for monitoring
      await this.redis.zadd(
        'global_emergency_stops',
        Date.now(),
        JSON.stringify({ userId, reason: reason.type, severity: reason.severity, triggeredAt: stopStatus.triggeredAt })
      );

      // Remove old entries (keep last 1000)
      await this.redis.zremrangebyrank('global_emergency_stops', 0, -1001);

      // Clear all pending automation tasks for this user
      await this.clearUserAutomationTasks(userId);

      // Notify WebSocket service for real-time updates
      await this.redis.publish('emergency_stops', JSON.stringify({
        userId,
        action: 'triggered',
        reason,
        triggeredBy: stopStatus.triggeredBy,
        estimatedResumeTime: stopStatus.estimatedResumeTime
      }));

      this.emit('emergencyStopTriggered', stopStatus);
      
      console.error(`Emergency stop triggered for user ${userId}: ${reason.description}`);
      
    } catch (error) {
      console.error('Error triggering emergency stop:', error);
      throw error;
    }
  }

  /**
   * Check if user has active emergency stop
   */
  async getEmergencyStopStatus(userId: string): Promise<EmergencyStopStatus | null> {
    try {
      const statusData = await this.redis.get(`emergency_stop:${userId}`);
      
      if (!statusData) {
        return null;
      }

      const status: EmergencyStopStatus = JSON.parse(statusData);
      
      // Check if auto-resume time has passed
      if (!status.manualResumeRequired && status.estimatedResumeTime && new Date() >= status.estimatedResumeTime) {
        await this.resumeAutomation(userId, 'system', 'Auto-resume after timeout');
        return null;
      }

      return status;
    } catch (error) {
      console.error('Error getting emergency stop status:', error);
      return null;
    }
  }

  /**
   * Resume automation for a user (manual or automatic)
   */
  async resumeAutomation(
    userId: string,
    resumedBy: string,
    reason: string = 'Manual resume'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const currentStatus = await this.getEmergencyStopStatus(userId);
      
      if (!currentStatus || !currentStatus.active) {
        return {
          success: false,
          message: 'No active emergency stop found for this user'
        };
      }

      // Check if manual resume is required and not provided by authorized user
      if (currentStatus.manualResumeRequired && resumedBy === 'system') {
        return {
          success: false,
          message: 'Manual resume required - automatic resume not allowed'
        };
      }

      // Check safety score before resuming (if manual resume)
      if (resumedBy !== 'system') {
        const safetyCheck = await this.performPreResumeChecks(userId);
        if (!safetyCheck.safe) {
          return {
            success: false,
            message: `Resume blocked: ${safetyCheck.reason}`
          };
        }
      }

      // Remove emergency stop
      await this.redis.del(`emergency_stop:${userId}`);

      // Reset relevant circuit breakers
      await this.resetUserCircuitBreakers(userId);

      // Log resume action
      await this.redis.lpush(
        `automation_resume_log:${userId}`,
        JSON.stringify({
          resumedAt: new Date(),
          resumedBy,
          reason,
          previousReason: currentStatus.reason
        })
      );
      await this.redis.ltrim(`automation_resume_log:${userId}`, 0, 99); // Keep last 100 entries

      // Notify WebSocket service
      await this.redis.publish('emergency_stops', JSON.stringify({
        userId,
        action: 'resumed',
        resumedBy,
        reason
      }));

      this.emit('automationResumed', { userId, resumedBy, reason });
      
      console.log(`Automation resumed for user ${userId} by ${resumedBy}: ${reason}`);
      
      return {
        success: true,
        message: 'Automation resumed successfully'
      };
      
    } catch (error) {
      console.error('Error resuming automation:', error);
      return {
        success: false,
        message: 'Internal error while resuming automation'
      };
    }
  }

  /**
   * Get global emergency stop dashboard data
   */
  async getEmergencyStopDashboard(): Promise<{
    activeStops: number;
    stopsByType: { [key: string]: number };
    stopsBySeverity: { [key: string]: number };
    recentStops: any[];
    circuitBreakerStats: {
      open: number;
      halfOpen: number;
      closed: number;
    };
  }> {
    try {
      // Get recent emergency stops
      const recentStops = await this.redis.zrevrange('global_emergency_stops', 0, 49, 'WITHSCORES');
      const recentStopsData = [];
      
      for (let i = 0; i < recentStops.length; i += 2) {
        try {
          const stopData = JSON.parse(recentStops[i]);
          stopData.timestamp = new Date(parseInt(recentStops[i + 1]));
          recentStopsData.push(stopData);
        } catch (e) {
          // Skip invalid entries
        }
      }

      // Count active stops
      const activeStopKeys = await this.redis.keys('emergency_stop:*');
      const activeStops = activeStopKeys.length;

      // Aggregate by type and severity
      const stopsByType: { [key: string]: number } = {};
      const stopsBySeverity: { [key: string]: number } = {};

      recentStopsData.forEach(stop => {
        stopsByType[stop.reason] = (stopsByType[stop.reason] || 0) + 1;
        stopsBySeverity[stop.severity] = (stopsBySeverity[stop.severity] || 0) + 1;
      });

      // Circuit breaker stats
      const circuitBreakerKeys = await this.redis.keys('circuit_breaker:*');
      const circuitBreakerStats = {
        open: 0,
        halfOpen: 0,
        closed: 0
      };

      for (const key of circuitBreakerKeys) {
        try {
          const breakerData = await this.redis.get(key);
          if (breakerData) {
            const breaker = JSON.parse(breakerData);
            switch (breaker.state) {
              case 'OPEN':
                circuitBreakerStats.open++;
                break;
              case 'HALF_OPEN':
                circuitBreakerStats.halfOpen++;
                break;
              case 'CLOSED':
                circuitBreakerStats.closed++;
                break;
            }
          }
        } catch (e) {
          // Skip invalid entries
        }
      }

      return {
        activeStops,
        stopsByType,
        stopsBySeverity,
        recentStops: recentStopsData.slice(0, 20),
        circuitBreakerStats
      };
    } catch (error) {
      console.error('Error getting emergency stop dashboard:', error);
      throw error;
    }
  }

  /**
   * Bulk emergency stop (system-wide)
   */
  async triggerSystemWideEmergencyStop(
    reason: string,
    triggeredBy: string,
    affectedUsers?: string[]
  ): Promise<{ success: boolean; affectedUsers: number; message: string }> {
    try {
      const userIds = affectedUsers || await this.getActiveAutomationUsers();
      let successCount = 0;

      const emergencyReason: EmergencyStopReason = {
        type: 'SYSTEM_OVERLOAD',
        severity: 'CRITICAL',
        description: `System-wide emergency stop: ${reason}`,
        metadata: { systemWide: true, triggeredBy },
        autoResumeAfter: null // Manual resume required for system-wide stops
      };

      // Trigger emergency stop for each user
      for (const userId of userIds) {
        try {
          await this.triggerEmergencyStop(userId, emergencyReason, triggeredBy);
          successCount++;
        } catch (error) {
          console.error(`Failed to trigger emergency stop for user ${userId}:`, error);
        }
      }

      // Notify all services
      await this.redis.publish('system_emergency_stop', JSON.stringify({
        reason,
        triggeredBy,
        affectedUsers: successCount,
        timestamp: new Date()
      }));

      console.error(`System-wide emergency stop triggered by ${triggeredBy}: ${reason}. Affected ${successCount} users.`);

      return {
        success: true,
        affectedUsers: successCount,
        message: `System-wide emergency stop activated for ${successCount} users`
      };
    } catch (error) {
      console.error('Error triggering system-wide emergency stop:', error);
      return {
        success: false,
        affectedUsers: 0,
        message: 'Failed to trigger system-wide emergency stop'
      };
    }
  }

  // Private helper methods

  private startMonitoring(): void {
    // Monitor circuit breakers and emergency stops every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMaintenanceTasks();
      } catch (error) {
        console.error('Error in emergency stop monitoring:', error);
      }
    }, 30000);

    console.log('Emergency stop monitoring started');
  }

  private async performMaintenanceTasks(): Promise<void> {
    // Check for auto-resume opportunities
    const emergencyStopKeys = await this.redis.keys('emergency_stop:*');
    
    for (const key of emergencyStopKeys) {
      try {
        const statusData = await this.redis.get(key);
        if (statusData) {
          const status: EmergencyStopStatus = JSON.parse(statusData);
          const userId = key.replace('emergency_stop:', '');
          
          // Check for auto-resume
          if (!status.manualResumeRequired && 
              status.estimatedResumeTime && 
              new Date() >= status.estimatedResumeTime) {
            
            await this.resumeAutomation(userId, 'system', 'Auto-resume timeout reached');
          }
        }
      } catch (error) {
        console.error(`Error processing emergency stop ${key}:`, error);
      }
    }

    // Clean up old circuit breaker states
    await this.cleanupOldCircuitBreakers();
  }

  private async cleanupOldCircuitBreakers(): Promise<void> {
    const circuitBreakerKeys = await this.redis.keys('circuit_breaker:*');
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const key of circuitBreakerKeys) {
      try {
        const breakerData = await this.redis.get(key);
        if (breakerData) {
          const breaker = JSON.parse(breakerData);
          
          // Remove old circuit breakers that haven't been used
          if (breaker.lastFailureTime) {
            const lastActivity = new Date(breaker.lastFailureTime).getTime();
            if (now - lastActivity > cleanupThreshold && breaker.state === 'CLOSED') {
              await this.redis.del(key);
              this.circuitBreakers.delete(key.replace('circuit_breaker:', ''));
            }
          }
        }
      } catch (error) {
        // Skip invalid entries
      }
    }
  }

  private isCriticalFailure(error: string): boolean {
    const criticalPatterns = [
      'rate limit',
      'too many requests',
      'suspended',
      'restricted',
      'unauthorized',
      'forbidden',
      'account blocked'
    ];
    
    const lowerError = error.toLowerCase();
    return criticalPatterns.some(pattern => lowerError.includes(pattern));
  }

  private async clearUserAutomationTasks(userId: string): Promise<void> {
    // This would integrate with your queue manager to clear pending tasks
    const queueTypes = ['connections', 'engagement', 'profile_views', 'follows'];
    const priorities = ['high', 'normal', 'low'];
    
    for (const type of queueTypes) {
      for (const priority of priorities) {
        const queueKey = `linkedin-${type}-${priority}`;
        // Remove user's jobs from queue
        // Implementation would depend on your queue system
      }
    }
  }

  private async resetUserCircuitBreakers(userId: string): Promise<void> {
    const pattern = `circuit_breaker:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    
    for (const key of keys) {
      const breakerKey = key.replace('circuit_breaker:', '');
      const resetState: CircuitBreakerState = {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0
      };
      
      this.circuitBreakers.set(breakerKey, resetState);
      await this.redis.setex(key, 24 * 60 * 60, JSON.stringify(resetState));
    }
  }

  private async performPreResumeChecks(userId: string): Promise<{ safe: boolean; reason?: string }> {
    // Check various safety metrics before allowing resume
    try {
      // Check recent failure rate
      const recentFailures = await this.getRecentFailureRate(userId);
      if (recentFailures > 0.5) {
        return {
          safe: false,
          reason: `High recent failure rate: ${(recentFailures * 100).toFixed(1)}%`
        };
      }

      // Check if there are multiple emergency stops recently
      const recentStops = await this.getRecentEmergencyStops(userId);
      if (recentStops.length > 3) {
        return {
          safe: false,
          reason: 'Multiple emergency stops in recent history'
        };
      }

      // Check system load
      const systemLoad = await this.getSystemLoad();
      if (systemLoad > 0.8) {
        return {
          safe: false,
          reason: 'System load too high'
        };
      }

      return { safe: true };
    } catch (error) {
      return {
        safe: false,
        reason: 'Error performing safety checks'
      };
    }
  }

  private async getRecentFailureRate(userId: string): Promise<number> {
    // Simplified implementation - in production, analyze actual failure data
    return Math.random() * 0.3; // Mock failure rate between 0-30%
  }

  private async getRecentEmergencyStops(userId: string): Promise<any[]> {
    const logData = await this.redis.lrange(`automation_resume_log:${userId}`, 0, 9);
    return logData.map(entry => JSON.parse(entry));
  }

  private async getSystemLoad(): Promise<number> {
    // Simplified system load check - in production, check actual system metrics
    return Math.random() * 0.7; // Mock system load between 0-70%
  }

  private async getActiveAutomationUsers(): Promise<string[]> {
    // Get all users with active automation
    const keys = await this.redis.keys('automation_status:*');
    return keys.map(key => key.replace('automation_status:', ''));
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.redis.quit();
    console.log('Emergency Stop Service cleaned up');
  }
}

/**
 * LinkedIn Automation Engine - Phase 3 Implementation
 * Ultra-conservative compliance enforcement with 15% rate limits
 * Emergency stop at 3% error rate, human-like delays (45-180 seconds)
 * Circuit breakers for reliability, comprehensive logging and monitoring
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { LinkedInConnectionAutomationService } from './connectionAutomation.service';
import { LinkedInEngagementAutomationService } from './engagementAutomation.service';
import { QueueManagerService } from './queueManager.service';
import { LinkedInSafetyMonitorService } from './safetyMonitor.service';
import { LinkedInTemplateManagerService } from './templateManager.service';
import { HealthDashboardService } from './healthDashboard.service';
import { EmergencyStopService } from './emergencyStop.service';

export interface AutomationEngineConfig {
  // Ultra-conservative rate limits (15% of LinkedIn's actual limits)
  rateLimits: {
    connections: {
      daily: 15;     // LinkedIn allows 100/day
      hourly: 3;     // LinkedIn allows ~10/hour  
      minDelay: 45000;   // 45 seconds minimum
      maxDelay: 180000;  // 3 minutes maximum
    };
    engagement: {
      likes: {
        daily: 30;     // LinkedIn allows 200/day
        hourly: 8;     // LinkedIn allows ~25/hour
        minDelay: 60000;   // 1 minute minimum
        maxDelay: 300000;  // 5 minutes maximum
      };
      comments: {
        daily: 8;      // LinkedIn allows 50/day
        hourly: 2;     // LinkedIn allows ~6/hour
        minDelay: 120000;  // 2 minutes minimum
        maxDelay: 480000;  // 8 minutes maximum
      };
      profileViews: {
        daily: 25;     // LinkedIn allows 150/day
        hourly: 6;     // LinkedIn allows ~20/hour
        minDelay: 180000;  // 3 minutes minimum
        maxDelay: 600000;  // 10 minutes maximum
      };
      follows: {
        daily: 5;      // LinkedIn allows 30/day
        hourly: 1;     // LinkedIn allows ~5/hour
        minDelay: 600000;  // 10 minutes minimum
        maxDelay: 1800000; // 30 minutes maximum
      };
    };
  };
  
  // Safety thresholds
  safety: {
    errorRateThreshold: 0.03;      // 3% error rate triggers emergency stop
    consecutiveFailureLimit: 3;     // 3 consecutive failures = suspension
    healthScoreMinimum: 70;         // Health score <70 = warning
    riskScoreThreshold: 75;         // Risk score >75 = suspension
    dailyActivityWindow: 8;         // 8 hours of activity per day (work hours simulation)
    weekendReduction: 0.3;          // 30% of weekday limits on weekends
  };

  // Human behavior simulation
  humanBehavior: {
    workHours: { start: 9, end: 17 };  // 9 AM to 5 PM
    lunchBreak: { start: 12, end: 13 }; // 12 PM to 1 PM pause
    timeZone: 'America/New_York';       // Default timezone
    variability: 0.25;                  // ±25% timing variability
  };
}

export interface AutomationJob {
  id: string;
  userId: string;
  type: 'connection' | 'like' | 'comment' | 'profile_view' | 'follow';
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'suspended';
  data: any;
  scheduledAt: Date;
  processedAt?: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationMetrics {
  userId: string;
  daily: {
    connections: { sent: number; remaining: number; };
    likes: { sent: number; remaining: number; };
    comments: { sent: number; remaining: number; };
    profileViews: { sent: number; remaining: number; };
    follows: { sent: number; remaining: number; };
  };
  hourly: {
    connections: { sent: number; remaining: number; };
    likes: { sent: number; remaining: number; };
    comments: { sent: number; remaining: number; };
    profileViews: { sent: number; remaining: number; };
    follows: { sent: number; remaining: number; };
  };
  safety: {
    score: number;
    status: 'SAFE' | 'WARNING' | 'CRITICAL' | 'SUSPENDED';
    errorRate: number;
    healthScore: number;
    lastCheck: Date;
  };
  queue: {
    pending: number;
    processing: number;
    nextJobTime?: Date;
  };
}

export class LinkedInAutomationEngine extends EventEmitter {
  private redis: Redis;
  private config: AutomationEngineConfig;
  private connectionService: LinkedInConnectionAutomationService;
  private engagementService: LinkedInEngagementAutomationService;
  private queueManager: QueueManagerService;
  private safetyMonitor: LinkedInSafetyMonitorService;
  private templateManager: LinkedInTemplateManagerService;
  private healthDashboard: HealthDashboardService;
  private emergencyStop: EmergencyStopService;
  
  private isRunning: boolean = false;
  private userStatuses: Map<string, 'active' | 'paused' | 'suspended'> = new Map();
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private circuitBreakers: Map<string, { failures: number; lastFailure: Date; isOpen: boolean; }> = new Map();

  constructor(
    connectionService: LinkedInConnectionAutomationService,
    engagementService: LinkedInEngagementAutomationService,
    queueManager: QueueManagerService,
    safetyMonitor: LinkedInSafetyMonitorService,
    templateManager: LinkedInTemplateManagerService,
    healthDashboard: HealthDashboardService,
    emergencyStop: EmergencyStopService
  ) {
    super();
    
    this.connectionService = connectionService;
    this.engagementService = engagementService;
    this.queueManager = queueManager;
    this.safetyMonitor = safetyMonitor;
    this.templateManager = templateManager;
    this.healthDashboard = healthDashboard;
    this.emergencyStop = emergencyStop;

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.config = this.getDefaultConfig();
    this.setupEventListeners();
    
    console.log('LinkedIn Automation Engine initialized with ultra-conservative compliance controls');
  }

  /**
   * Start the automation engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Automation engine is already running');
    }

    this.isRunning = true;
    
    // Start core services
    await this.startCoreServices();
    
    // Start job processors
    this.startJobProcessors();
    
    // Start monitoring
    this.startSystemMonitoring();
    
    this.emit('engineStarted');
    console.log('LinkedIn Automation Engine started successfully');
  }

  /**
   * Stop the automation engine gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // Stop all processing intervals
    for (const [userId, interval] of this.processingIntervals.entries()) {
      clearInterval(interval);
    }
    this.processingIntervals.clear();
    
    // Stop monitoring for all users
    for (const userId of this.userStatuses.keys()) {
      await this.safetyMonitor.stopUserMonitoring(userId);
    }
    
    this.emit('engineStopped');
    console.log('LinkedIn Automation Engine stopped gracefully');
  }

  /**
   * Enable automation for a user with full safety initialization
   */
  async enableUserAutomation(
    userId: string, 
    settings: {
      connectionAutomation?: boolean;
      engagementAutomation?: boolean;
      profileViewAutomation?: boolean;
      followAutomation?: boolean;
      timeZone?: string;
    }
  ): Promise<{ success: boolean; reason?: string; }> {
    try {
      // Check if user is already in system
      const suspended = await this.emergencyStop.getEmergencyStopStatus(userId);
      if (suspended.isActive) {
        return {
          success: false,
          reason: `User automation is under emergency stop: ${suspended.reason}`
        };
      }

      // Initialize safety monitoring
      await this.safetyMonitor.startUserMonitoring(userId);
      
      // Set user status
      this.userStatuses.set(userId, 'active');
      
      // Store user settings
      await this.redis.setex(
        `automation_settings:${userId}`,
        30 * 24 * 60 * 60, // 30 days
        JSON.stringify({
          ...settings,
          enabledAt: new Date(),
          version: '3.0'
        })
      );

      // Start user-specific processing
      this.startUserProcessing(userId);
      
      this.emit('userAutomationEnabled', { userId, settings });
      console.log(`Automation enabled for user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error(`Error enabling automation for user ${userId}:`, error);
      return { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Disable automation for a user
   */
  async disableUserAutomation(userId: string): Promise<{ success: boolean; reason?: string; }> {
    try {
      // Stop safety monitoring
      await this.safetyMonitor.stopUserMonitoring(userId);
      
      // Clear processing interval
      const interval = this.processingIntervals.get(userId);
      if (interval) {
        clearInterval(interval);
        this.processingIntervals.delete(userId);
      }
      
      // Update status
      this.userStatuses.set(userId, 'paused');
      
      // Cancel all pending jobs
      await this.cancelAllUserJobs(userId);
      
      this.emit('userAutomationDisabled', { userId });
      console.log(`Automation disabled for user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error(`Error disabling automation for user ${userId}:`, error);
      return { 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Schedule automation job with comprehensive safety checks
   */
  async scheduleJob(
    userId: string,
    type: 'connection' | 'like' | 'comment' | 'profile_view' | 'follow',
    data: any,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      scheduledAt?: Date;
      templateId?: string;
    } = {}
  ): Promise<{ success: boolean; jobId?: string; reason?: string; retryAfter?: number; }> {
    try {
      // Check if user automation is enabled
      const userStatus = this.userStatuses.get(userId);
      if (userStatus !== 'active') {
        return {
          success: false,
          reason: `User automation is ${userStatus || 'not enabled'}`
        };
      }

      // Check emergency stop status
      const emergencyStatus = await this.emergencyStop.getEmergencyStopStatus(userId);
      if (emergencyStatus.isActive) {
        return {
          success: false,
          reason: `Emergency stop active: ${emergencyStatus.reason}`,
          retryAfter: 24 * 60 * 60 // 24 hours
        };
      }

      // Check circuit breaker
      const circuitBreakerCheck = this.checkCircuitBreaker(userId, type);
      if (!circuitBreakerCheck.allowed) {
        return {
          success: false,
          reason: circuitBreakerCheck.reason,
          retryAfter: circuitBreakerCheck.retryAfter
        };
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimits(userId, type);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          reason: rateLimitCheck.reason,
          retryAfter: rateLimitCheck.retryAfter
        };
      }

      // Check if it's appropriate time (work hours simulation)
      const timeCheck = this.checkWorkingHours();
      if (!timeCheck.allowed) {
        // Schedule for next work hour instead of rejecting
        options.scheduledAt = timeCheck.nextWorkingTime;
      }

      // Create job with human-like scheduling
      const scheduledAt = options.scheduledAt || this.calculateHumanLikeDelay(type);
      const jobId = `job_${userId}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const job: AutomationJob = {
        id: jobId,
        userId,
        type,
        priority: options.priority || 'normal',
        status: 'pending',
        data: {
          ...data,
          templateId: options.templateId
        },
        scheduledAt,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store job
      await this.storeJob(job);
      
      // Add to appropriate queue
      const queueResult = await this.queueManager.addJob(userId, type, data, {
        priority: options.priority,
        scheduledAt,
        maxRetries: 2
      });

      if (!queueResult.success) {
        return {
          success: false,
          reason: queueResult.reason,
          retryAfter: queueResult.retryAfter
        };
      }

      // Update counters
      await this.updateUserCounters(userId, type);

      this.emit('jobScheduled', { userId, jobId, type, scheduledAt });

      return {
        success: true,
        jobId
      };

    } catch (error) {
      console.error(`Error scheduling job for user ${userId}:`, error);
      return {
        success: false,
        reason: 'Internal error scheduling job'
      };
    }
  }

  /**
   * Get comprehensive automation metrics for a user
   */
  async getUserMetrics(userId: string): Promise<AutomationMetrics> {
    const [
      dailyLimits,
      hourlyLimits,
      safetyStatus,
      queueStatus
    ] = await Promise.all([
      this.getDailyMetrics(userId),
      this.getHourlyMetrics(userId),
      this.safetyMonitor.performUserSafetyCheck(userId).catch(() => ({
        score: 0,
        overallStatus: 'SUSPENDED' as const,
        metrics: { errorRate: 1, complianceScore: 0, riskLevel: 'HIGH' as const, dailyActions: 0 },
        lastHealthCheck: new Date()
      })),
      this.queueManager.getUserQueueStatus(userId)
    ]);

    return {
      userId,
      daily: dailyLimits,
      hourly: hourlyLimits,
      safety: {
        score: safetyStatus.score,
        status: safetyStatus.overallStatus,
        errorRate: safetyStatus.metrics.errorRate,
        healthScore: safetyStatus.metrics.complianceScore,
        lastCheck: safetyStatus.lastHealthCheck
      },
      queue: {
        pending: queueStatus.totalJobs,
        processing: Object.values(queueStatus.queues).reduce((sum, q) => sum + q.active, 0),
        nextJobTime: queueStatus.nextJobTime
      }
    };
  }

  /**
   * Get system-wide automation dashboard data
   */
  async getSystemDashboard(): Promise<{
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    totalJobsToday: number;
    successRate: number;
    averageSafetyScore: number;
    systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    activeAlerts: number;
    topAlerts: Array<{ type: string; count: number; }>;
  }> {
    const [
      safetyDashboard,
      queueStats,
      systemHealth
    ] = await Promise.all([
      this.safetyMonitor.getSafetyDashboard(),
      this.queueManager.getGlobalQueueStats(),
      this.healthDashboard.getSystemHealthMetrics()
    ]);

    const totalUsers = this.userStatuses.size;
    const activeUsers = Array.from(this.userStatuses.values()).filter(s => s === 'active').length;
    const suspendedUsers = safetyDashboard.statusBreakdown.suspended;

    const totalJobsToday = Object.values(queueStats).reduce((sum, stats) => 
      sum + stats.completed + stats.failed, 0
    );

    const successRate = totalJobsToday > 0 
      ? (Object.values(queueStats).reduce((sum, stats) => sum + stats.completed, 0) / totalJobsToday) * 100
      : 100;

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalJobsToday,
      successRate: Math.round(successRate * 100) / 100,
      averageSafetyScore: safetyDashboard.averageSafetyScore,
      systemHealth: systemHealth.overallStatus,
      activeAlerts: safetyDashboard.activeAlerts,
      topAlerts: this.aggregateAlertTypes(safetyDashboard.recentAlerts)
    };
  }

  /**
   * Emergency stop for specific user
   */
  async triggerEmergencyStop(
    userId: string, 
    reason: string, 
    triggeredBy: 'system' | 'admin' | 'user' = 'system'
  ): Promise<void> {
    await this.emergencyStop.triggerEmergencyStop(userId, 'SYSTEM_DETECTED', reason, triggeredBy === 'system' ? 'AUTOMATION_ENGINE' : triggeredBy);
    
    // Suspend user automation
    this.userStatuses.set(userId, 'suspended');
    
    // Stop processing
    const interval = this.processingIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.processingIntervals.delete(userId);
    }
    
    // Cancel pending jobs
    await this.cancelAllUserJobs(userId);
    
    this.emit('emergencyStopTriggered', { userId, reason, triggeredBy });
    console.error(`Emergency stop triggered for user ${userId}: ${reason}`);
  }

  /**
   * System-wide emergency stop
   */
  async triggerSystemEmergencyStop(reason: string): Promise<void> {
    console.error(`SYSTEM EMERGENCY STOP: ${reason}`);
    
    // Stop all user automation
    for (const userId of this.userStatuses.keys()) {
      await this.triggerEmergencyStop(userId, `System emergency: ${reason}`, 'system');
    }
    
    // Stop the engine
    await this.stop();
    
    this.emit('systemEmergencyStop', { reason });
  }

  // Private helper methods

  private getDefaultConfig(): AutomationEngineConfig {
    return {
      rateLimits: {
        connections: {
          daily: 15,
          hourly: 3,
          minDelay: 45000,
          maxDelay: 180000
        },
        engagement: {
          likes: {
            daily: 30,
            hourly: 8,
            minDelay: 60000,
            maxDelay: 300000
          },
          comments: {
            daily: 8,
            hourly: 2,
            minDelay: 120000,
            maxDelay: 480000
          },
          profileViews: {
            daily: 25,
            hourly: 6,
            minDelay: 180000,
            maxDelay: 600000
          },
          follows: {
            daily: 5,
            hourly: 1,
            minDelay: 600000,
            maxDelay: 1800000
          }
        }
      },
      safety: {
        errorRateThreshold: 0.03,
        consecutiveFailureLimit: 3,
        healthScoreMinimum: 70,
        riskScoreThreshold: 75,
        dailyActivityWindow: 8,
        weekendReduction: 0.3
      },
      humanBehavior: {
        workHours: { start: 9, end: 17 },
        lunchBreak: { start: 12, end: 13 },
        timeZone: 'America/New_York',
        variability: 0.25
      }
    };
  }

  private setupEventListeners(): void {
    // Listen for safety alerts
    this.safetyMonitor.on('safetyAlert', async (alert) => {
      if (alert.type === 'CRITICAL' || alert.type === 'EMERGENCY') {
        await this.triggerEmergencyStop(alert.userId, `Safety alert: ${alert.message}`, 'system');
      }
    });

    // Listen for emergency stops
    this.emergencyStop.on('emergencyStopTriggered', (data) => {
      this.userStatuses.set(data.userId, 'suspended');
    });

    // Listen for queue failures
    this.queueManager.on('emergencyStop', async (data) => {
      await this.triggerEmergencyStop(data.userId, data.reason, 'system');
    });
  }

  private async startCoreServices(): Promise<void> {
    // Start health dashboard monitoring
    // Note: Other services are already initialized and started
    console.log('Core automation services initialized');
  }

  private startJobProcessors(): void {
    // Job processing is handled by the QueueManagerService
    // This method can be used for additional job processing logic if needed
    console.log('Job processors started');
  }

  private startSystemMonitoring(): void {
    // Monitor system health every 30 seconds
    setInterval(async () => {
      try {
        await this.performSystemHealthCheck();
      } catch (error) {
        console.error('System health check error:', error);
      }
    }, 30000);

    console.log('System monitoring started');
  }

  private startUserProcessing(userId: string): void {
    // Individual user processing is handled by safety monitoring
    // This method can be extended for user-specific processing logic
    console.log(`User processing started for ${userId}`);
  }

  private async performSystemHealthCheck(): Promise<void> {
    // Check for system-wide issues
    const metrics = await this.getSystemDashboard();
    
    if (metrics.successRate < 90) {
      this.emit('systemAlert', {
        type: 'LOW_SUCCESS_RATE',
        message: `System success rate dropped to ${metrics.successRate}%`,
        severity: 'WARNING'
      });
    }

    if (metrics.averageSafetyScore < 60) {
      this.emit('systemAlert', {
        type: 'LOW_SAFETY_SCORE',
        message: `Average safety score dropped to ${metrics.averageSafetyScore}`,
        severity: 'CRITICAL'
      });
    }

    // Check if too many users are suspended (possible LinkedIn policy change)
    const suspensionRate = metrics.suspendedUsers / metrics.totalUsers;
    if (suspensionRate > 0.2) { // More than 20% suspended
      await this.triggerSystemEmergencyStop(`High suspension rate detected: ${(suspensionRate * 100).toFixed(1)}%`);
    }
  }

  private checkCircuitBreaker(userId: string, type: string): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  } {
    const key = `${userId}:${type}`;
    const breaker = this.circuitBreakers.get(key);
    
    if (!breaker) {
      return { allowed: true };
    }

    if (breaker.isOpen) {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
      const cooldownPeriod = 10 * 60 * 1000; // 10 minutes
      
      if (timeSinceLastFailure < cooldownPeriod) {
        return {
          allowed: false,
          reason: 'Circuit breaker is open due to recent failures',
          retryAfter: Math.ceil((cooldownPeriod - timeSinceLastFailure) / 1000)
        };
      } else {
        // Reset circuit breaker
        breaker.isOpen = false;
        breaker.failures = 0;
      }
    }

    return { allowed: true };
  }

  private async checkRateLimits(userId: string, type: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const limits = this.getRateLimitsForType(type);
    if (!limits) {
      return { allowed: true };
    }

    // Check daily limits
    const dailyCount = await this.getDailyCount(userId, type);
    if (dailyCount >= limits.daily) {
      return {
        allowed: false,
        reason: `Daily limit reached (${dailyCount}/${limits.daily})`,
        retryAfter: this.getSecondsUntilMidnight()
      };
    }

    // Check hourly limits
    const hourlyCount = await this.getHourlyCount(userId, type);
    if (hourlyCount >= limits.hourly) {
      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      return {
        allowed: false,
        reason: `Hourly limit reached (${hourlyCount}/${limits.hourly})`,
        retryAfter: Math.ceil((nextHour.getTime() - now.getTime()) / 1000)
      };
    }

    return { allowed: true };
  }

  private checkWorkingHours(): {
    allowed: boolean;
    nextWorkingTime?: Date;
  } {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Check if weekend (apply reduction)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Check if within work hours
    const { start, end } = this.config.humanBehavior.workHours;
    const { start: lunchStart, end: lunchEnd } = this.config.humanBehavior.lunchBreak;
    
    const isWorkHours = hour >= start && hour < end;
    const isLunchTime = hour >= lunchStart && hour < lunchEnd;
    
    if (!isWorkHours || isLunchTime) {
      // Calculate next working time
      const nextWorkingTime = new Date(now);
      
      if (hour < start) {
        // Too early, wait for work to start
        nextWorkingTime.setHours(start, 0, 0, 0);
      } else if (hour >= end) {
        // Too late, wait for next day
        nextWorkingTime.setDate(nextWorkingTime.getDate() + 1);
        nextWorkingTime.setHours(start, 0, 0, 0);
      } else if (isLunchTime) {
        // Lunch time, wait for lunch to end
        nextWorkingTime.setHours(lunchEnd, 0, 0, 0);
      }
      
      return {
        allowed: false,
        nextWorkingTime
      };
    }

    return { allowed: true };
  }

  private calculateHumanLikeDelay(type: string): Date {
    const limits = this.getRateLimitsForType(type);
    if (!limits) {
      return new Date(Date.now() + 60000); // Default 1 minute
    }

    const baseDelay = limits.minDelay + Math.random() * (limits.maxDelay - limits.minDelay);
    const variability = this.config.humanBehavior.variability;
    const jitter = baseDelay * variability * (Math.random() - 0.5);
    
    const delay = Math.max(limits.minDelay, baseDelay + jitter);
    return new Date(Date.now() + delay);
  }

  private getRateLimitsForType(type: string): { daily: number; hourly: number; minDelay: number; maxDelay: number; } | null {
    switch (type) {
      case 'connection':
        return this.config.rateLimits.connections;
      case 'like':
        return this.config.rateLimits.engagement.likes;
      case 'comment':
        return this.config.rateLimits.engagement.comments;
      case 'profile_view':
        return this.config.rateLimits.engagement.profileViews;
      case 'follow':
        return this.config.rateLimits.engagement.follows;
      default:
        return null;
    }
  }

  private async getDailyCount(userId: string, type: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `automation_daily:${userId}:${type}:${today}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0');
  }

  private async getHourlyCount(userId: string, type: string): Promise<number> {
    const now = new Date();
    const hour = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const key = `automation_hourly:${userId}:${type}:${hour}`;
    const count = await this.redis.get(key);
    return parseInt(count || '0');
  }

  private async updateUserCounters(userId: string, type: string): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    
    const dailyKey = `automation_daily:${userId}:${type}:${today}`;
    const hourlyKey = `automation_hourly:${userId}:${type}:${hour}`;
    
    await Promise.all([
      this.redis.incr(dailyKey),
      this.redis.expire(dailyKey, 25 * 60 * 60), // 25 hours
      this.redis.incr(hourlyKey),
      this.redis.expire(hourlyKey, 61 * 60) // 61 minutes
    ]);
  }

  private async storeJob(job: AutomationJob): Promise<void> {
    await this.redis.setex(
      `automation_job:${job.id}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify(job)
    );
  }

  private async cancelAllUserJobs(userId: string): Promise<void> {
    // This would integrate with the QueueManagerService to cancel jobs
    // Implementation depends on your queue system
    console.log(`Cancelling all jobs for user ${userId}`);
  }

  private async getDailyMetrics(userId: string): Promise<AutomationMetrics['daily']> {
    const types = ['connections', 'likes', 'comments', 'profileViews', 'follows'];
    const metrics: any = {};
    
    for (const type of types) {
      const count = await this.getDailyCount(userId, type);
      const limits = this.getRateLimitsForType(type === 'connections' ? 'connection' : 
                    type === 'likes' ? 'like' :
                    type === 'comments' ? 'comment' :
                    type === 'profileViews' ? 'profile_view' : 'follow');
      
      metrics[type] = {
        sent: count,
        remaining: limits ? Math.max(0, limits.daily - count) : 0
      };
    }
    
    return metrics;
  }

  private async getHourlyMetrics(userId: string): Promise<AutomationMetrics['hourly']> {
    const types = ['connections', 'likes', 'comments', 'profileViews', 'follows'];
    const metrics: any = {};
    
    for (const type of types) {
      const count = await this.getHourlyCount(userId, type);
      const limits = this.getRateLimitsForType(type === 'connections' ? 'connection' : 
                    type === 'likes' ? 'like' :
                    type === 'comments' ? 'comment' :
                    type === 'profileViews' ? 'profile_view' : 'follow');
      
      metrics[type] = {
        sent: count,
        remaining: limits ? Math.max(0, limits.hourly - count) : 0
      };
    }
    
    return metrics;
  }

  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  private aggregateAlertTypes(alerts: any[]): Array<{ type: string; count: number; }> {
    const counts = new Map<string, number>();
    
    for (const alert of alerts) {
      const count = counts.get(alert.category) || 0;
      counts.set(alert.category, count + 1);
    }
    
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.stop();
    await this.redis.quit();
    console.log('Automation Engine cleaned up');
  }
}
