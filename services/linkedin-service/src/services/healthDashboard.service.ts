import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { LinkedInSafetyMonitorService } from './safetyMonitor.service';
import { LinkedInRateLimitService } from './rateLimit.service';
import { LinkedInComplianceService } from './compliance.service';
import { QueueManagerService } from './queueManager.service';
import { EmergencyStopService } from './emergencyStop.service';

export interface SystemHealthMetrics {
  timestamp: Date;
  overall: {
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DOWN';
    score: number; // 0-100
    uptime: number; // seconds
    version: string;
  };
  services: {
    [serviceName: string]: {
      status: 'UP' | 'DOWN' | 'DEGRADED';
      responseTime: number; // ms
      errorRate: number; // percentage
      lastCheck: Date;
    };
  };
  automation: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    totalOperations24h: number;
    successRate24h: number;
    queueHealth: {
      totalJobs: number;
      processingJobs: number;
      failedJobs: number;
      avgWaitTime: number; // minutes
    };
  };
  safety: {
    averageSafetyScore: number;
    criticalAlerts: number;
    emergencyStops: number;
    circuitBreakerTrips: number;
    complianceViolations: number;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    requestsPerSecond: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    cpuUsage: number;
  };
  rateLimits: {
    totalUsers: number;
    usersNearLimit: number;
    averageUsageRate: number;
    topEndpointUsage: Array<{
      endpoint: string;
      usage: number;
      limit: number;
    }>;
  };
}

export interface UserHealthSummary {
  userId: string;
  overallHealth: number; // 0-100
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'SUSPENDED';
  lastActivity: Date;
  automation: {
    enabled: boolean;
    totalOperations24h: number;
    successRate24h: number;
    queuedJobs: number;
    nextScheduledAction?: Date;
  };
  safety: {
    score: number;
    alerts: number;
    emergencyStop: boolean;
    circuitBreakerStatus: {
      connections: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      engagement: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      profileViews: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      follows: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    };
  };
  compliance: {
    score: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recentViolations: number;
  };
  rateLimits: {
    hourlyUsage: number;
    dailyUsage: number;
    nearLimitWarning: boolean;
  };
}

export interface AlertSummary {
  total: number;
  byType: {
    [alertType: string]: number;
  };
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  recent: Array<{
    id: string;
    type: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    timestamp: Date;
    userId?: string;
    resolved: boolean;
  }>;
}

export class HealthDashboardService extends EventEmitter {
  private redis: Redis;
  private safetyMonitor: LinkedInSafetyMonitorService;
  private rateLimitService: LinkedInRateLimitService;
  private complianceService: LinkedInComplianceService;
  private queueManager: QueueManagerService;
  private emergencyStop: EmergencyStopService;
  private healthCache: Map<string, any>;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    safetyMonitor: LinkedInSafetyMonitorService,
    rateLimitService: LinkedInRateLimitService,
    complianceService: LinkedInComplianceService,
    queueManager: QueueManagerService,
    emergencyStop: EmergencyStopService
  ) {
    super();
    
    this.safetyMonitor = safetyMonitor;
    this.rateLimitService = rateLimitService;
    this.complianceService = complianceService;
    this.queueManager = queueManager;
    this.emergencyStop = emergencyStop;
    this.healthCache = new Map();

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.startHealthMonitoring();
    console.log('Health Dashboard Service initialized');
  }

  /**
   * Get comprehensive system health metrics
   */
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    try {
      const startTime = Date.now();
      
      // Use cached data if available and recent (< 30 seconds)
      const cacheKey = 'system_health_metrics';
      const cached = this.healthCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 30000) {
        return cached.data;
      }

      // Gather health data from all services
      const [
        serviceHealth,
        automationHealth,
        safetyHealth,
        performanceHealth,
        rateLimitHealth
      ] = await Promise.all([
        this.getServiceHealthStatus(),
        this.getAutomationHealthStatus(),
        this.getSafetyHealthStatus(),
        this.getPerformanceMetrics(),
        this.getRateLimitHealthStatus()
      ]);

      // Calculate overall system health score
      const overallScore = this.calculateOverallHealthScore({
        serviceHealth,
        automationHealth,
        safetyHealth,
        performanceHealth,
        rateLimitHealth
      });

      const metrics: SystemHealthMetrics = {
        timestamp: new Date(),
        overall: {
          status: this.getOverallStatus(overallScore),
          score: overallScore,
          uptime: process.uptime(),
          version: process.env.APP_VERSION || '1.0.0'
        },
        services: serviceHealth,
        automation: automationHealth,
        safety: safetyHealth,
        performance: performanceHealth,
        rateLimits: rateLimitHealth
      };

      // Cache the result
      this.healthCache.set(cacheKey, {
        timestamp: Date.now(),
        data: metrics
      });

      const processingTime = Date.now() - startTime;
      console.log(`System health metrics collected in ${processingTime}ms`);

      return metrics;
    } catch (error) {
      console.error('Error getting system health metrics:', error);
      throw error;
    }
  }

  /**
   * Get user health summary
   */
  async getUserHealthSummary(userId: string): Promise<UserHealthSummary> {
    try {
      const [
        queueStatus,
        safetyStatus,
        complianceStatus,
        rateLimitStatus,
        emergencyStopStatus,
        circuitBreakerStatus
      ] = await Promise.all([
        this.queueManager.getUserQueueStatus(userId),
        this.safetyMonitor.performUserSafetyCheck(userId).catch(() => null),
        this.rateLimitService.getComplianceStatus(userId),
        this.rateLimitService.getUsageStatistics(userId),
        this.emergencyStop.getEmergencyStopStatus(userId),
        this.getCircuitBreakerStatus(userId)
      ]);

      // Calculate operations in last 24 hours
      const operations24h = await this.getUserOperations24h(userId);
      const successRate24h = await this.getUserSuccessRate24h(userId);

      // Calculate overall health score
      const healthScore = this.calculateUserHealthScore({
        safetyScore: safetyStatus?.score || 100,
        complianceScore: complianceStatus.score,
        emergencyStop: emergencyStopStatus?.active || false,
        circuitBreakerIssues: this.countCircuitBreakerIssues(circuitBreakerStatus),
        successRate: successRate24h
      });

      return {
        userId,
        overallHealth: healthScore,
        status: this.getUserStatus(healthScore, emergencyStopStatus?.active),
        lastActivity: queueStatus.lastActivity || new Date(),
        automation: {
          enabled: queueStatus.automationEnabled,
          totalOperations24h: operations24h,
          successRate24h: successRate24h,
          queuedJobs: queueStatus.totalJobs,
          nextScheduledAction: queueStatus.nextJobTime
        },
        safety: {
          score: safetyStatus?.score || 100,
          alerts: safetyStatus?.activeAlerts?.length || 0,
          emergencyStop: emergencyStopStatus?.active || false,
          circuitBreakerStatus
        },
        compliance: {
          score: complianceStatus.score,
          riskLevel: this.mapRiskLevel(complianceStatus.status),
          recentViolations: await this.getRecentViolations(userId)
        },
        rateLimits: {
          hourlyUsage: rateLimitStatus.global.hourlyUsage,
          dailyUsage: rateLimitStatus.global.dailyUsage,
          nearLimitWarning: this.isNearRateLimit(rateLimitStatus)
        }
      };
    } catch (error) {
      console.error(`Error getting user health summary for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get alert summary
   */
  async getAlertSummary(limit: number = 50): Promise<AlertSummary> {
    try {
      const [
        safetyDashboard,
        emergencyStopDashboard,
        systemAlerts
      ] = await Promise.all([
        this.safetyMonitor.getSafetyDashboard(),
        this.emergencyStop.getEmergencyStopDashboard(),
        this.getSystemAlerts(limit)
      ]);

      // Aggregate alert counts
      const byType: { [key: string]: number } = {};
      const bySeverity = {
        critical: 0,
        warning: 0,
        info: 0
      };

      // Count safety alerts
      safetyDashboard.recentAlerts.forEach(alert => {
        byType[alert.category] = (byType[alert.category] || 0) + 1;
        
        switch (alert.type) {
          case 'CRITICAL':
          case 'EMERGENCY':
            bySeverity.critical++;
            break;
          case 'WARNING':
            bySeverity.warning++;
            break;
          default:
            bySeverity.info++;
        }
      });

      // Count emergency stops as critical alerts
      bySeverity.critical += emergencyStopDashboard.activeStops;
      byType['EMERGENCY_STOP'] = emergencyStopDashboard.activeStops;

      // Add system alerts
      systemAlerts.forEach(alert => {
        byType[alert.type] = (byType[alert.type] || 0) + 1;
        
        switch (alert.severity) {
          case 'CRITICAL':
            bySeverity.critical++;
            break;
          case 'WARNING':
            bySeverity.warning++;
            break;
          default:
            bySeverity.info++;
        }
      });

      const total = bySeverity.critical + bySeverity.warning + bySeverity.info;

      // Combine recent alerts
      const recentAlerts = [
        ...safetyDashboard.recentAlerts.map(alert => ({
          id: alert.id,
          type: alert.category,
          severity: alert.type as 'CRITICAL' | 'WARNING' | 'INFO',
          message: alert.message,
          timestamp: alert.timestamp,
          userId: alert.userId,
          resolved: alert.resolved
        })),
        ...systemAlerts
      ]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

      return {
        total,
        byType,
        bySeverity,
        recent: recentAlerts
      };
    } catch (error) {
      console.error('Error getting alert summary:', error);
      throw error;
    }
  }

  /**
   * Get real-time automation statistics
   */
  async getAutomationStatistics(): Promise<{
    overview: {
      totalUsers: number;
      activeAutomation: number;
      suspended: number;
      operationsToday: number;
      successRateToday: number;
    };
    queues: {
      [queueName: string]: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        avgProcessingTime: number;
      };
    };
    trends: {
      hourlyOperations: Array<{ hour: number; count: number }>;
      successRateByHour: Array<{ hour: number; rate: number }>;
    };
  }> {
    try {
      const [
        queueStats,
        operationStats,
        trends
      ] = await Promise.all([
        this.queueManager.getGlobalQueueStats(),
        this.getGlobalOperationStats(),
        this.getAutomationTrends()
      ]);

      return {
        overview: operationStats,
        queues: await this.enhanceQueueStats(queueStats),
        trends
      };
    } catch (error) {
      console.error('Error getting automation statistics:', error);
      throw error;
    }
  }

  /**
   * Get users requiring attention (health issues)
   */
  async getUsersRequiringAttention(limit: number = 20): Promise<Array<UserHealthSummary & {
    issues: string[];
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>> {
    try {
      // Get users with active issues
      const [
        emergencyStopUsers,
        lowSafetyScoreUsers,
        highErrorRateUsers,
        nearLimitUsers
      ] = await Promise.all([
        this.getEmergencyStopUsers(),
        this.getLowSafetyScoreUsers(),
        this.getHighErrorRateUsers(),
        this.getNearLimitUsers()
      ]);

      // Combine and deduplicate users
      const allUsers = new Set([
        ...emergencyStopUsers,
        ...lowSafetyScoreUsers,
        ...highErrorRateUsers,
        ...nearLimitUsers
      ]);

      const usersWithIssues = [];

      for (const userId of Array.from(allUsers).slice(0, limit)) {
        try {
          const healthSummary = await this.getUserHealthSummary(userId);
          const issues = [];
          let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

          // Determine issues and priority
          if (healthSummary.safety.emergencyStop) {
            issues.push('Emergency stop active');
            priority = 'HIGH';
          }

          if (healthSummary.safety.score < 50) {
            issues.push('Low safety score');
            if (priority !== 'HIGH') priority = 'MEDIUM';
          }

          if (healthSummary.compliance.score < 50) {
            issues.push('Compliance violations');
            if (priority !== 'HIGH') priority = 'MEDIUM';
          }

          if (healthSummary.automation.successRate24h < 50) {
            issues.push('Low success rate');
            if (priority === 'LOW') priority = 'MEDIUM';
          }

          if (healthSummary.rateLimits.nearLimitWarning) {
            issues.push('Near rate limit');
            if (priority === 'LOW') priority = 'MEDIUM';
          }

          // Check circuit breakers
          const breakerIssues = Object.entries(healthSummary.safety.circuitBreakerStatus)
            .filter(([_, status]) => status === 'OPEN')
            .map(([service, _]) => `${service} circuit breaker open`);
          
          issues.push(...breakerIssues);
          if (breakerIssues.length > 0 && priority === 'LOW') {
            priority = 'MEDIUM';
          }

          if (issues.length > 0) {
            usersWithIssues.push({
              ...healthSummary,
              issues,
              priority
            });
          }
        } catch (error) {
          console.error(`Error getting health summary for user ${userId}:`, error);
        }
      }

      // Sort by priority (HIGH first, then by health score)
      return usersWithIssues
        .sort((a, b) => {
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          
          if (priorityDiff !== 0) return priorityDiff;
          return a.overallHealth - b.overallHealth; // Lower health score first
        });
    } catch (error) {
      console.error('Error getting users requiring attention:', error);
      return [];
    }
  }

  // Private helper methods

  private startHealthMonitoring(): void {
    // Update health metrics every 60 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        // Clear old cache entries
        this.clearOldCache();
        
        // Perform health checks
        await this.performHealthChecks();
      } catch (error) {
        console.error('Error in health monitoring:', error);
      }
    }, 60000);

    console.log('Health monitoring started');
  }

  private clearOldCache(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, value] of this.healthCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.healthCache.delete(key);
      }
    }
  }

  private async performHealthChecks(): void {
    try {
      // Get fresh system metrics
      const metrics = await this.getSystemHealthMetrics();
      
      // Emit health status updates
      this.emit('healthUpdate', metrics);
      
      // Check for critical issues
      if (metrics.overall.status === 'CRITICAL' || metrics.overall.status === 'DOWN') {
        this.emit('criticalHealthIssue', {
          status: metrics.overall.status,
          score: metrics.overall.score,
          timestamp: metrics.timestamp
        });
      }
    } catch (error) {
      console.error('Error performing health checks:', error);
    }
  }

  private async getServiceHealthStatus(): Promise<{ [serviceName: string]: any }> {
    const services = {
      redis: await this.checkRedisHealth(),
      rateLimitService: await this.rateLimitService.getHealthStatus(),
      queueManager: { status: 'UP', responseTime: 0, errorRate: 0, lastCheck: new Date() }
    };

    return services;
  }

  private async checkRedisHealth(): Promise<any> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'UP',
        responseTime,
        errorRate: 0,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'DOWN',
        responseTime: 0,
        errorRate: 100,
        lastCheck: new Date()
      };
    }
  }

  private async getAutomationHealthStatus(): Promise<any> {
    const queueStats = await this.queueManager.getGlobalQueueStats();
    
    let totalJobs = 0;
    let processingJobs = 0;
    let failedJobs = 0;
    
    for (const stats of Object.values(queueStats)) {
      totalJobs += stats.total;
      processingJobs += stats.active;
      failedJobs += stats.failed;
    }

    // Get user counts
    const activeUsers = await this.getActiveAutomationUserCount();
    const suspendedUsers = await this.getSuspendedUserCount();
    const totalOperations24h = await this.getTotalOperations24h();
    const successRate24h = await this.getGlobalSuccessRate24h();

    return {
      totalUsers: activeUsers + suspendedUsers,
      activeUsers,
      suspendedUsers,
      totalOperations24h,
      successRate24h,
      queueHealth: {
        totalJobs,
        processingJobs,
        failedJobs,
        avgWaitTime: this.calculateAverageWaitTime(queueStats)
      }
    };
  }

  private async getSafetyHealthStatus(): Promise<any> {
    const safetyDashboard = await this.safetyMonitor.getSafetyDashboard();
    const emergencyStopDashboard = await this.emergencyStop.getEmergencyStopDashboard();

    return {
      averageSafetyScore: safetyDashboard.averageSafetyScore,
      criticalAlerts: safetyDashboard.recentAlerts.filter(a => a.type === 'CRITICAL').length,
      emergencyStops: emergencyStopDashboard.activeStops,
      circuitBreakerTrips: emergencyStopDashboard.circuitBreakerStats.open,
      complianceViolations: await this.getRecentComplianceViolationCount()
    };
  }

  private async getPerformanceMetrics(): Promise<any> {
    const memUsage = process.memoryUsage();
    
    return {
      avgResponseTime: await this.getAverageResponseTime(),
      p95ResponseTime: await this.getP95ResponseTime(),
      requestsPerSecond: await this.getRequestsPerSecond(),
      memoryUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpuUsage: await this.getCpuUsage()
    };
  }

  private async getRateLimitHealthStatus(): Promise<any> {
    const rateLimitHealth = await this.rateLimitService.getHealthStatus();
    const complianceReport = await this.rateLimitService.getComplianceReport();
    
    return {
      totalUsers: rateLimitHealth.details.totalActiveUsers,
      usersNearLimit: complianceReport.complianceBreakdown.warning + complianceReport.complianceBreakdown.violation,
      averageUsageRate: rateLimitHealth.details.averageUsageRate,
      topEndpointUsage: [] // Would implement based on actual endpoint usage tracking
    };
  }

  private calculateOverallHealthScore(healthData: any): number {
    let score = 100;
    
    // Service health (30% weight)
    const downServices = Object.values(healthData.serviceHealth).filter((s: any) => s.status === 'DOWN').length;
    const totalServices = Object.keys(healthData.serviceHealth).length;
    score -= (downServices / totalServices) * 30;
    
    // Safety health (25% weight)
    score -= Math.max(0, (100 - healthData.safetyHealth.averageSafetyScore) * 0.25);
    
    // Performance health (20% weight)
    if (healthData.performanceHealth.memoryUsage.percentage > 90) score -= 15;
    if (healthData.performanceHealth.cpuUsage > 90) score -= 10;
    
    // Automation health (15% weight)
    if (healthData.automationHealth.successRate24h < 80) {
      score -= (80 - healthData.automationHealth.successRate24h) * 0.15;
    }
    
    // Emergency conditions (10% weight)
    score -= healthData.safetyHealth.emergencyStops * 5;
    score -= healthData.safetyHealth.criticalAlerts * 2;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private getOverallStatus(score: number): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DOWN' {
    if (score >= 90) return 'HEALTHY';
    if (score >= 70) return 'DEGRADED';
    if (score >= 30) return 'CRITICAL';
    return 'DOWN';
  }

  private calculateUserHealthScore(data: {
    safetyScore: number;
    complianceScore: number;
    emergencyStop: boolean;
    circuitBreakerIssues: number;
    successRate: number;
  }): number {
    if (data.emergencyStop) return 0;
    
    let score = (data.safetyScore * 0.3) + (data.complianceScore * 0.3) + (data.successRate * 0.25);
    score -= data.circuitBreakerIssues * 10; // 10 points per circuit breaker issue
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private getUserStatus(healthScore: number, emergencyStop?: boolean): 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'SUSPENDED' {
    if (emergencyStop) return 'SUSPENDED';
    if (healthScore >= 80) return 'HEALTHY';
    if (healthScore >= 60) return 'WARNING';
    return 'CRITICAL';
  }

  private mapRiskLevel(status: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (status) {
      case 'COMPLIANT': return 'LOW';
      case 'WARNING': return 'MEDIUM';
      case 'VIOLATION': return 'HIGH';
      default: return 'CRITICAL';
    }
  }

  private countCircuitBreakerIssues(status: any): number {
    return Object.values(status).filter(s => s === 'OPEN').length;
  }

  private isNearRateLimit(rateLimitStatus: any): boolean {
    const hourlyUsage = rateLimitStatus.global.hourlyUsage / rateLimitStatus.global.hourlyLimit;
    const dailyUsage = rateLimitStatus.global.dailyUsage / rateLimitStatus.global.dailyLimit;
    
    return hourlyUsage > 0.8 || dailyUsage > 0.8;
  }

  // Mock implementations for data not yet available
  private async getUserOperations24h(userId: string): Promise<number> {
    // In production, query actual operation data
    return Math.floor(Math.random() * 50);
  }

  private async getUserSuccessRate24h(userId: string): Promise<number> {
    // In production, calculate from actual success/failure data
    return Math.random() * 40 + 60; // 60-100%
  }

  private async getCircuitBreakerStatus(userId: string): Promise<any> {
    return {
      connections: 'CLOSED',
      engagement: 'CLOSED',
      profileViews: 'CLOSED',
      follows: 'CLOSED'
    };
  }

  private async getRecentViolations(userId: string): Promise<number> {
    return Math.floor(Math.random() * 3);
  }

  private async getSystemAlerts(limit: number): Promise<any[]> {
    return []; // Would implement based on actual system alert storage
  }

  private async getGlobalOperationStats(): Promise<any> {
    return {
      totalUsers: 1000,
      activeAutomation: 750,
      suspended: 50,
      operationsToday: 5000,
      successRateToday: 85
    };
  }

  private async getAutomationTrends(): Promise<any> {
    // Mock trend data - in production, query actual time-series data
    const hourlyOperations = [];
    const successRateByHour = [];
    
    for (let i = 0; i < 24; i++) {
      hourlyOperations.push({
        hour: i,
        count: Math.floor(Math.random() * 100) + 50
      });
      successRateByHour.push({
        hour: i,
        rate: Math.random() * 20 + 80 // 80-100%
      });
    }
    
    return { hourlyOperations, successRateByHour };
  }

  private async enhanceQueueStats(queueStats: any): Promise<any> {
    const enhanced: any = {};
    
    for (const [queueName, stats] of Object.entries(queueStats)) {
      enhanced[queueName] = {
        ...stats,
        avgProcessingTime: Math.random() * 300 + 60 // 1-5 minutes
      };
    }
    
    return enhanced;
  }

  private async getEmergencyStopUsers(): Promise<string[]> {
    const keys = await this.redis.keys('emergency_stop:*');
    return keys.map(key => key.replace('emergency_stop:', ''));
  }

  private async getLowSafetyScoreUsers(): Promise<string[]> {
    // In production, query users with safety scores < 70
    return [];
  }

  private async getHighErrorRateUsers(): Promise<string[]> {
    // In production, query users with high error rates
    return [];
  }

  private async getNearLimitUsers(): Promise<string[]> {
    // In production, query users near rate limits
    return [];
  }

  private calculateAverageWaitTime(queueStats: any): number {
    // Simplified calculation - in production, use actual queue wait times
    let totalWaiting = 0;
    let queueCount = 0;
    
    for (const stats of Object.values(queueStats)) {
      totalWaiting += (stats as any).waiting;
      queueCount++;
    }
    
    return queueCount > 0 ? (totalWaiting / queueCount) * 2 : 0; // Estimate 2 minutes per job
  }

  // Mock performance metrics
  private async getActiveAutomationUserCount(): Promise<number> { return 750; }
  private async getSuspendedUserCount(): Promise<number> { return 50; }
  private async getTotalOperations24h(): Promise<number> { return 5000; }
  private async getGlobalSuccessRate24h(): Promise<number> { return 85; }
  private async getRecentComplianceViolationCount(): Promise<number> { return 12; }
  private async getAverageResponseTime(): Promise<number> { return 150; }
  private async getP95ResponseTime(): Promise<number> { return 500; }
  private async getRequestsPerSecond(): Promise<number> { return 25; }
  private async getCpuUsage(): Promise<number> { return Math.random() * 30 + 20; }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.redis.quit();
    console.log('Health Dashboard Service cleaned up');
  }
}