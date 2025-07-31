/**
 * Safety Monitor Service - Critical Testing Suite
 * 
 * Tests ensuring real-time safety monitoring and emergency stop mechanisms
 * Critical for preventing LinkedIn account suspensions and maintaining compliance
 */

import { SafetyMonitorService } from '../../../../../services/linkedin-service/src/services/safetyMonitor.service';
import { LinkedInRateLimitService } from '../../../../../services/linkedin-service/src/services/rateLimit.service';
import { SafetyStatus, SafetyAlert } from '../../../../../services/linkedin-service/src/types/automation';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('../../../../../services/linkedin-service/src/services/rateLimit.service');

const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
const MockedRateLimitService = LinkedInRateLimitService as jest.MockedClass<typeof LinkedInRateLimitService>;

describe('SafetyMonitorService - Critical Safety Tests', () => {
  let safetyMonitor: SafetyMonitorService;
  let mockRedis: jest.Mocked<Redis>;
  let mockRateLimitService: jest.Mocked<LinkedInRateLimitService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);

    // Mock Rate Limit Service
    mockRateLimitService = {
      getComplianceStatus: jest.fn(),
      recordViolation: jest.fn(),
      getUsageStatistics: jest.fn(),
      getHealthStatus: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockedRateLimitService.mockImplementation(() => mockRateLimitService);

    safetyMonitor = new SafetyMonitorService();
  });

  afterEach(async () => {
    await safetyMonitor.disconnect();
  });

  describe('Real-Time Safety Monitoring', () => {
    describe('Health Score Calculation', () => {
      it('should calculate health score based on multiple safety factors', async () => {
        const userId = 'test-user-1';
        
        // Mock compliance status with various issues
        mockRateLimitService.getComplianceStatus.mockResolvedValue({
          status: 'WARNING',
          score: 65,
          recommendations: ['Reduce API calls'],
          riskFactors: ['High daily usage', 'Unusual patterns'],
          nextAllowedAction: new Date(Date.now() + 60000),
          safetyMetrics: {
            velocityScore: 70,
            patternScore: 60,
            complianceHistory: 80
          }
        });

        // Mock recent violations
        mockRedis.lrange.mockResolvedValue([
          JSON.stringify({ type: 'RATE_LIMIT_WARNING', timestamp: new Date().toISOString(), severity: 'medium' }),
          JSON.stringify({ type: 'PATTERN_ANOMALY', timestamp: new Date().toISOString(), severity: 'low' })
        ]);

        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);

        expect(safetyStatus.score).toBeGreaterThan(0);
        expect(safetyStatus.score).toBeLessThan(100);
        expect(safetyStatus.overallStatus).toBe('warning');
        expect(safetyStatus.activeAlerts).toHaveLength(2);
      });

      it('should return healthy status for compliant users', async () => {
        const userId = 'compliant-user';
        
        mockRateLimitService.getComplianceStatus.mockResolvedValue({
          status: 'COMPLIANT',
          score: 95,
          recommendations: [],
          riskFactors: [],
          nextAllowedAction: new Date(),
          safetyMetrics: {
            velocityScore: 90,
            patternScore: 95,
            complianceHistory: 100
          }
        });

        mockRedis.lrange.mockResolvedValue([]);

        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);

        expect(safetyStatus.score).toBeGreaterThan(90);
        expect(safetyStatus.overallStatus).toBe('healthy');
        expect(safetyStatus.activeAlerts).toHaveLength(0);
        expect(safetyStatus.recommendations).toHaveLength(0);
      });

      it('should trigger critical status for severe violations', async () => {
        const userId = 'violation-user';
        
        mockRateLimitService.getComplianceStatus.mockResolvedValue({
          status: 'VIOLATION',
          score: 25,
          recommendations: ['Stop all automation', 'Review account status'],
          riskFactors: ['Rate limit exceeded', 'Suspicious patterns', 'Historical violations'],
          nextAllowedAction: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
          safetyMetrics: {
            velocityScore: 30,
            patternScore: 20,
            complianceHistory: 40
          }
        });

        // Mock recent critical violations
        mockRedis.lrange.mockResolvedValue([
          JSON.stringify({ type: 'RATE_LIMIT_EXCEEDED', timestamp: new Date().toISOString(), severity: 'critical' }),
          JSON.stringify({ type: 'ACCOUNT_FLAGGED', timestamp: new Date().toISOString(), severity: 'critical' }),
          JSON.stringify({ type: 'BOT_BEHAVIOR_DETECTED', timestamp: new Date().toISOString(), severity: 'high' })
        ]);

        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);

        expect(safetyStatus.score).toBeLessThan(40);
        expect(safetyStatus.overallStatus).toBe('critical');
        expect(safetyStatus.activeAlerts.length).toBeGreaterThan(2);
        expect(safetyStatus.emergencyStopRequired).toBe(true);
        expect(safetyStatus.recommendations).toContain('Stop all automation');
      });
    });

    describe('Alert Generation and Management', () => {
      it('should generate appropriate alerts for different violation types', async () => {
        const userId = 'alert-test-user';
        
        // Test rate limit alert
        await safetyMonitor.recordViolation(userId, {
          type: 'RATE_LIMIT_EXCEEDED',
          endpoint: '/v2/invitation',
          details: { limit: 15, attempted: 16 },
          severity: 'high',
          timestamp: new Date()
        });

        // Test pattern anomaly alert
        await safetyMonitor.recordViolation(userId, {
          type: 'PATTERN_ANOMALY',
          details: { reason: 'Regular intervals detected', confidence: 0.8 },
          severity: 'medium',
          timestamp: new Date()
        });

        expect(mockRedis.lpush).toHaveBeenCalledTimes(2);
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `safety_alerts:${userId}`,
          expect.stringContaining('RATE_LIMIT_EXCEEDED')
        );
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `safety_alerts:${userId}`,
          expect.stringContaining('PATTERN_ANOMALY')
        );
      });

      it('should escalate repeated violations to critical alerts', async () => {
        const userId = 'escalation-test-user';
        
        // Mock multiple rate limit violations in short time
        const recentViolations = Array(5).fill(null).map((_, i) => 
          JSON.stringify({
            type: 'RATE_LIMIT_EXCEEDED',
            timestamp: new Date(Date.now() - i * 60000).toISOString(), // Every minute
            severity: 'medium'
          })
        );
        
        mockRedis.lrange.mockResolvedValue(recentViolations);
        
        await safetyMonitor.recordViolation(userId, {
          type: 'RATE_LIMIT_EXCEEDED',
          endpoint: '/v2/invitation',
          details: { limit: 15, attempted: 16 },
          severity: 'medium',
          timestamp: new Date()
        });

        // Should escalate to critical due to repeated violations
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `safety_alerts:${userId}`,
          expect.stringContaining('"severity":"critical"')
        );
      });

      it('should auto-acknowledge resolved alerts', async () => {
        const userId = 'auto-ack-user';
        
        // Mock old alert that should be auto-acknowledged
        const oldAlert = {
          id: 'alert-1',
          type: 'RATE_LIMIT_WARNING',
          severity: 'low',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          acknowledged: false,
          autoResolve: true
        };

        mockRedis.lrange.mockResolvedValue([JSON.stringify(oldAlert)]);
        
        // Mock current healthy compliance status
        mockRateLimitService.getComplianceStatus.mockResolvedValue({
          status: 'COMPLIANT',
          score: 90,
          recommendations: [],
          riskFactors: [],
          nextAllowedAction: new Date(),
          safetyMetrics: {
            velocityScore: 85,
            patternScore: 90,
            complianceHistory: 95
          }
        });

        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);

        // Old alert should be auto-acknowledged
        expect(safetyStatus.activeAlerts).toHaveLength(0);
        expect(mockRedis.set).toHaveBeenCalledWith(
          expect.stringContaining('alert-1'),
          expect.stringContaining('"acknowledged":true'),
          'EX',
          expect.any(Number)
        );
      });
    });
  });

  describe('Emergency Stop Mechanisms', () => {
    describe('Automatic Emergency Stop Triggers', () => {
      it('should trigger emergency stop when health score drops below 40', async () => {
        const userId = 'emergency-user-1';
        
        mockRateLimitService.getComplianceStatus.mockResolvedValue({
          status: 'VIOLATION',
          score: 35,
          recommendations: ['Emergency stop required'],
          riskFactors: ['Critical violations detected'],
          nextAllowedAction: new Date(Date.now() + 4 * 60 * 60 * 1000),
          safetyMetrics: {
            velocityScore: 30,
            patternScore: 25,
            complianceHistory: 20
          }
        });

        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);

        expect(safetyStatus.emergencyStopRequired).toBe(true);
        expect(safetyStatus.overallStatus).toBe('critical');
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expect.stringContaining('CRITICAL_SAFETY_VIOLATION')
        );
      });

      it('should trigger emergency stop for LinkedIn API errors', async () => {
        const userId = 'api-error-user';
        
        await safetyMonitor.recordViolation(userId, {
          type: 'LINKEDIN_API_ERROR',
          details: { 
            statusCode: 429, 
            message: 'Too Many Requests',
            endpoint: '/v2/invitation',
            consecutiveErrors: 3
          },
          severity: 'critical',
          timestamp: new Date()
        });

        // Emergency stop should be triggered immediately for critical API errors
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expect.stringContaining('LINKEDIN_API_ERROR')
        );
      });

      it('should trigger emergency stop for account suspension indicators', async () => {
        const userId = 'suspension-user';
        
        await safetyMonitor.recordViolation(userId, {
          type: 'ACCOUNT_RESTRICTION_DETECTED',
          details: { 
            restrictionType: 'AUTOMATED_ACTIVITY_BLOCKED',
            confidence: 0.9,
            indicators: ['login_challenge', 'captcha_required', 'feature_disabled']
          },
          severity: 'critical',
          timestamp: new Date()
        });

        expect(mockRedis.publish).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expect.stringContaining('ACCOUNT_RESTRICTION_DETECTED')
        );
      });
    });

    describe('Emergency Stop Execution', () => {
      it('should execute emergency stop within 5 seconds', async () => {
        const userId = 'stop-execution-user';
        const startTime = Date.now();
        
        const stopResult = await safetyMonitor.executeEmergencyStop(userId, {
          reason: 'Critical safety violation detected',
          triggeredBy: 'AUTOMATED_SAFETY_MONITOR',
          severity: 'critical'
        });

        const executionTime = Date.now() - startTime;

        expect(executionTime).toBeLessThan(5000); // Must complete within 5 seconds
        expect(stopResult.success).toBe(true);
        expect(stopResult.stoppedAt).toBeDefined();
        expect(stopResult.affectedQueues).toContain('connection_requests');
        expect(stopResult.affectedQueues).toContain('engagement_actions');
        
        // Verify all automation queues are cleared
        expect(mockRedis.del).toHaveBeenCalledWith(
          expect.stringContaining(`automation_queue:${userId}:connections`)
        );
        expect(mockRedis.del).toHaveBeenCalledWith(
          expect.stringContaining(`automation_queue:${userId}:engagement`)
        );
      });

      it('should prevent new automation tasks after emergency stop', async () => {
        const userId = 'stop-prevention-user';
        
        // Execute emergency stop
        await safetyMonitor.executeEmergencyStop(userId, {
          reason: 'Testing prevention mechanism',
          triggeredBy: 'TEST_SUITE',
          severity: 'high'
        });

        // Verify automation is disabled
        const isAutomationAllowed = await safetyMonitor.isAutomationAllowed(userId);
        expect(isAutomationAllowed).toBe(false);

        // Check emergency stop flag is set
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `emergency_stop:${userId}:active`,
          expect.any(Number),
          expect.stringContaining('true')
        );
      });

      it('should notify all relevant services about emergency stop', async () => {
        const userId = 'notification-user';
        
        await safetyMonitor.executeEmergencyStop(userId, {
          reason: 'Testing notification system',
          triggeredBy: 'SAFETY_MONITOR',
          severity: 'critical'
        });

        // Verify notifications sent to all services
        expect(mockRedis.publish).toHaveBeenCalledWith(
          'emergency_stop:all_services',
          expect.stringContaining(userId)
        );
        expect(mockRedis.publish).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expect.any(String)
        );
        expect(mockRedis.publish).toHaveBeenCalledWith(
          'safety_dashboard:updates',
          expect.stringContaining('EMERGENCY_STOP_EXECUTED')
        );
      });
    });

    describe('Recovery and Resume Mechanisms', () => {
      it('should require manual approval before allowing resume after critical stop', async () => {
        const userId = 'recovery-user';
        
        // Execute critical emergency stop
        await safetyMonitor.executeEmergencyStop(userId, {
          reason: 'Critical LinkedIn API violation',
          triggeredBy: 'AUTOMATED_SAFETY_MONITOR',
          severity: 'critical'
        });

        // Attempt immediate resume (should be blocked)
        const resumeResult = await safetyMonitor.attemptResume(userId, {
          requestedBy: 'USER',
          manualApproval: false
        });

        expect(resumeResult.success).toBe(false);
        expect(resumeResult.reason).toContain('manual approval required');
      });

      it('should allow resume after safety conditions are met', async () => {
        const userId = 'safe-resume-user';
        
        // Mock improved safety conditions
        mockRateLimitService.getComplianceStatus.mockResolvedValue({
          status: 'COMPLIANT',
          score: 85,
          recommendations: [],
          riskFactors: [],
          nextAllowedAction: new Date(),
          safetyMetrics: {
            velocityScore: 80,
            patternScore: 85,
            complianceHistory: 90
          }
        });

        // Mock no recent violations
        mockRedis.lrange.mockResolvedValue([]);
        
        // Execute low-severity stop
        await safetyMonitor.executeEmergencyStop(userId, {
          reason: 'Precautionary stop',
          triggeredBy: 'USER',
          severity: 'medium'
        });

        // Wait for cooldown period (mocked)
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('emergency_stop_time')) {
            return Promise.resolve(String(Date.now() - 2 * 60 * 60 * 1000)); // 2 hours ago
          }
          return Promise.resolve(null);
        });

        const resumeResult = await safetyMonitor.attemptResume(userId, {
          requestedBy: 'USER',
          manualApproval: true
        });

        expect(resumeResult.success).toBe(true);
        expect(resumeResult.resumedAt).toBeDefined();
        expect(mockRedis.del).toHaveBeenCalledWith(`emergency_stop:${userId}:active`);
      });

      it('should implement gradual resume with reduced limits', async () => {
        const userId = 'gradual-resume-user';
        
        const resumeResult = await safetyMonitor.attemptResume(userId, {
          requestedBy: 'USER',
          manualApproval: true,
          gradualResume: true
        });

        if (resumeResult.success) {
          expect(resumeResult.reducedLimits).toBe(true);
          expect(resumeResult.limitReduction).toBeGreaterThan(0.3); // At least 30% reduction
          expect(resumeResult.monitoringPeriod).toBeGreaterThan(24 * 60 * 60 * 1000); // At least 24 hours
        }
      });
    });
  });

  describe('Compliance Monitoring Integration', () => {
    describe('LinkedIn Policy Adherence', () => {
      it('should monitor LinkedIn Terms of Service compliance', async () => {
        const userId = 'tos-compliance-user';
        
        // Mock behavior that violates LinkedIn ToS
        await safetyMonitor.evaluateComplianceRisk(userId, {
          action: 'bulk_connection_requests',
          targetCount: 50, // Excessive bulk requests
          timeframe: 60000, // 1 minute
          pattern: 'automated'
        });

        expect(mockRateLimitService.recordViolation).toHaveBeenCalledWith(
          userId,
          'TOS_VIOLATION_RISK',
          expect.objectContaining({
            severity: 'high',
            reason: expect.stringContaining('bulk')
          })
        );
      });

      it('should detect and prevent spam-like behavior', async () => {
        const userId = 'spam-detection-user';
        
        const spamRisk = await safetyMonitor.evaluateSpamRisk(userId, {
          messageContent: 'Hi! Check out this amazing opportunity!',
          recipientCount: 100,
          templateSimilarity: 0.95, // 95% similar to previous messages
          timespan: 30 * 60 * 1000 // 30 minutes
        });

        expect(spamRisk.riskLevel).toBe('HIGH');
        expect(spamRisk.shouldBlock).toBe(true);
        expect(spamRisk.reasons).toContain('HIGH_TEMPLATE_SIMILARITY');
        expect(spamRisk.reasons).toContain('EXCESSIVE_VOLUME');
      });

      it('should validate connection request authenticity', async () => {
        const userId = 'authenticity-user';
        
        const authenticityCheck = await safetyMonitor.validateConnectionAuthenticity(userId, {
          targetProfileId: 'target-123',
          connectionReason: 'I saw your profile and would like to connect',
          mutualConnections: 0,
          profileSimilarity: 0.1, // Very different profiles
          interactionHistory: false
        });

        expect(authenticityCheck.isAuthentic).toBe(false);
        expect(authenticityCheck.riskFactors).toContain('NO_MUTUAL_CONNECTIONS');
        expect(authenticityCheck.riskFactors).toContain('LOW_PROFILE_SIMILARITY');
        expect(authenticityCheck.riskFactors).toContain('NO_PRIOR_INTERACTION');
      });
    });

    describe('Account Health Monitoring', () => {
      it('should track account health indicators', async () => {
        const userId = 'health-tracking-user';
        
        // Mock various health indicators
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('login_challenges')) return Promise.resolve('2');
          if (key.includes('captcha_requests')) return Promise.resolve('1');
          if (key.includes('feature_restrictions')) return Promise.resolve('0');
          if (key.includes('connection_acceptance_rate')) return Promise.resolve('0.75');
          return Promise.resolve('0');
        });

        const healthIndicators = await safetyMonitor.getAccountHealthIndicators(userId);

        expect(healthIndicators.loginChallenges).toBe(2);
        expect(healthIndicators.captchaRequests).toBe(1);
        expect(healthIndicators.featureRestrictions).toBe(0);
        expect(healthIndicators.connectionAcceptanceRate).toBe(0.75);
        expect(healthIndicators.overallHealthScore).toBeGreaterThan(0);
        expect(healthIndicators.overallHealthScore).toBeLessThanOrEqual(100);
      });

      it('should predict account suspension risk', async () => {
        const userId = 'suspension-risk-user';
        
        // Mock high-risk indicators
        mockRedis.lrange.mockResolvedValue([
          JSON.stringify({ type: 'LOGIN_CHALLENGE', timestamp: new Date().toISOString() }),
          JSON.stringify({ type: 'CAPTCHA_REQUIRED', timestamp: new Date().toISOString() }),
          JSON.stringify({ type: 'RATE_LIMIT_EXCEEDED', timestamp: new Date().toISOString() }),
          JSON.stringify({ type: 'CONNECTION_REJECTED', timestamp: new Date().toISOString() })
        ]);

        const suspensionRisk = await safetyMonitor.predictSuspensionRisk(userId);

        expect(suspensionRisk.riskLevel).toBe('HIGH');
        expect(suspensionRisk.probability).toBeGreaterThan(0.7);
        expect(suspensionRisk.timeframe).toBe('IMMEDIATE');
        expect(suspensionRisk.recommendedActions).toContain('STOP_ALL_AUTOMATION');
      });
    });
  });

  describe('Performance and Scalability', () => {
    describe('High-Volume Safety Monitoring', () => {
      it('should handle monitoring for 1000+ concurrent users', async () => {
        const userIds = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
        const startTime = Date.now();

        // Mock basic safety status for all users
        mockRateLimitService.getComplianceStatus.mockResolvedValue({
          status: 'COMPLIANT',
          score: 80,
          recommendations: [],
          riskFactors: [],
          nextAllowedAction: new Date(),
          safetyMetrics: {
            velocityScore: 75,
            patternScore: 80,
            complianceHistory: 85
          }
        });

        mockRedis.lrange.mockResolvedValue([]);

        // Execute safety checks for all users concurrently
        const safetyChecks = await Promise.all(
          userIds.map(userId => safetyMonitor.getSafetyStatus(userId))
        );

        const executionTime = Date.now() - startTime;

        expect(safetyChecks).toHaveLength(1000);
        expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
        
        // Verify all checks completed successfully
        safetyChecks.forEach(status => {
          expect(status).toBeDefined();
          expect(status.score).toBeGreaterThan(0);
        });
      });

      it('should maintain performance under high alert volume', async () => {
        const userId = 'high-alert-user';
        const alertCount = 100;
        const startTime = Date.now();

        // Generate multiple alerts rapidly
        const alertPromises = Array.from({ length: alertCount }, (_, i) => 
          safetyMonitor.recordViolation(userId, {
            type: 'PERFORMANCE_TEST_ALERT',
            details: { alertNumber: i },
            severity: 'low',
            timestamp: new Date()
          })
        );

        await Promise.all(alertPromises);
        const executionTime = Date.now() - startTime;

        expect(executionTime).toBeLessThan(5000); // Should handle 100 alerts within 5 seconds
        expect(mockRedis.lpush).toHaveBeenCalledTimes(alertCount);
      });
    });

    describe('Resource Usage Optimization', () => {
      it('should clean up old safety data automatically', async () => {
        const userId = 'cleanup-user';
        
        // Mock old safety data
        mockRedis.lrange.mockResolvedValue([
          JSON.stringify({ 
            type: 'OLD_ALERT', 
            timestamp: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() // 31 days ago
          })
        ]);

        await safetyMonitor.performMaintenanceCleanup();

        // Verify old data is cleaned up
        expect(mockRedis.ltrim).toHaveBeenCalledWith(
          expect.stringContaining(userId),
          0,
          expect.any(Number)
        );
      });

      it('should implement efficient caching for frequent safety checks', async () => {
        const userId = 'cache-test-user';
        
        // First call - should cache result
        await safetyMonitor.getSafetyStatus(userId);
        
        // Second call within cache window - should use cache
        const cachedResult = await safetyMonitor.getSafetyStatus(userId);
        
        expect(mockRedis.get).toHaveBeenCalledWith(
          expect.stringContaining(`safety_status_cache:${userId}`)
        );
        expect(cachedResult).toBeDefined();
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    describe('Service Degradation Handling', () => {
      it('should handle Redis connection failures gracefully', async () => {
        const userId = 'redis-failure-user';
        
        mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
        mockRedis.lrange.mockRejectedValue(new Error('Redis connection failed'));
        
        // Should not throw error but provide degraded functionality
        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);
        
        expect(safetyStatus).toBeDefined();
        expect(safetyStatus.degradedMode).toBe(true);
        expect(safetyStatus.score).toBeGreaterThanOrEqual(50); // Conservative safe score
      });

      it('should handle rate limit service failures', async () => {
        const userId = 'rate-limit-failure-user';
        
        mockRateLimitService.getComplianceStatus.mockRejectedValue(
          new Error('Rate limit service unavailable')
        );
        
        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);
        
        expect(safetyStatus).toBeDefined();
        expect(safetyStatus.degradedMode).toBe(true);
        expect(safetyStatus.warnings).toContain('COMPLIANCE_CHECK_FAILED');
      });
    });

    describe('Data Corruption Recovery', () => {
      it('should handle corrupted safety data', async () => {
        const userId = 'corrupt-data-user';
        
        // Mock corrupted data
        mockRedis.lrange.mockResolvedValue([
          'invalid-json-data',
          '{"incomplete": "data"}',
          JSON.stringify({ type: 'VALID_ALERT', timestamp: new Date().toISOString() })
        ]);
        
        const safetyStatus = await safetyMonitor.getSafetyStatus(userId);
        
        expect(safetyStatus).toBeDefined();
        expect(safetyStatus.activeAlerts).toHaveLength(1); // Only valid alert processed
        expect(safetyStatus.warnings).toContain('DATA_CORRUPTION_DETECTED');
      });
    });
  });
});

describe('SafetyMonitorService - Integration Tests', () => {
  let safetyMonitor: SafetyMonitorService;
  let mockRedis: jest.Mocked<Redis>;
  let mockRateLimitService: jest.Mocked<LinkedInRateLimitService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);

    mockRateLimitService = {
      getComplianceStatus: jest.fn(),
      recordViolation: jest.fn(),
      getUsageStatistics: jest.fn(),
      getHealthStatus: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockedRateLimitService.mockImplementation(() => mockRateLimitService);

    safetyMonitor = new SafetyMonitorService();
  });

  afterEach(async () => {
    await safetyMonitor.disconnect();
  });

  describe('End-to-End Safety Workflow', () => {
    it('should demonstrate complete safety violation to recovery workflow', async () => {
      const userId = 'e2e-workflow-user';
      
      // Step 1: User starts with healthy status
      mockRateLimitService.getComplianceStatus.mockResolvedValue({
        status: 'COMPLIANT',
        score: 90,
        recommendations: [],
        riskFactors: [],
        nextAllowedAction: new Date(),
        safetyMetrics: { velocityScore: 85, patternScore: 90, complianceHistory: 95 }
      });
      
      mockRedis.lrange.mockResolvedValue([]);
      
      let safetyStatus = await safetyMonitor.getSafetyStatus(userId);
      expect(safetyStatus.overallStatus).toBe('healthy');
      
      // Step 2: Rate limit violation occurs
      await safetyMonitor.recordViolation(userId, {
        type: 'RATE_LIMIT_EXCEEDED',
        endpoint: '/v2/invitation',
        details: { limit: 15, attempted: 20 },
        severity: 'high',
        timestamp: new Date()
      });
      
      // Step 3: Status degrades to warning
      mockRateLimitService.getComplianceStatus.mockResolvedValue({
        status: 'WARNING',
        score: 60,
        recommendations: ['Reduce API usage'],
        riskFactors: ['Rate limit exceeded'],
        nextAllowedAction: new Date(Date.now() + 60000),
        safetyMetrics: { velocityScore: 50, patternScore: 70, complianceHistory: 80 }
      });
      
      mockRedis.lrange.mockResolvedValue([
        JSON.stringify({ type: 'RATE_LIMIT_EXCEEDED', severity: 'high', timestamp: new Date().toISOString() })
      ]);
      
      safetyStatus = await safetyMonitor.getSafetyStatus(userId);
      expect(safetyStatus.overallStatus).toBe('warning');
      
      // Step 4: Multiple violations trigger emergency stop
      await safetyMonitor.recordViolation(userId, {
        type: 'PATTERN_ANOMALY',
        details: { reason: 'Bot-like behavior detected' },
        severity: 'critical',
        timestamp: new Date()
      });
      
      mockRateLimitService.getComplianceStatus.mockResolvedValue({
        status: 'VIOLATION',
        score: 25,
        recommendations: ['Emergency stop required'],
        riskFactors: ['Multiple critical violations'],
        nextAllowedAction: new Date(Date.now() + 4 * 60 * 60 * 1000),
        safetyMetrics: { velocityScore: 20, patternScore: 30, complianceHistory: 40 }
      });
      
      safetyStatus = await safetyMonitor.getSafetyStatus(userId);
      expect(safetyStatus.emergencyStopRequired).toBe(true);
      
      // Step 5: Emergency stop is executed
      const stopResult = await safetyMonitor.executeEmergencyStop(userId, {
        reason: 'Critical safety violations detected',
        triggeredBy: 'AUTOMATED_SAFETY_MONITOR',
        severity: 'critical'
      });
      
      expect(stopResult.success).toBe(true);
      expect(stopResult.affectedQueues.length).toBeGreaterThan(0);
      
      // Step 6: User improves behavior (mocked)
      mockRateLimitService.getComplianceStatus.mockResolvedValue({
        status: 'COMPLIANT',
        score: 85,
        recommendations: [],
        riskFactors: [],
        nextAllowedAction: new Date(),
        safetyMetrics: { velocityScore: 80, patternScore: 85, complianceHistory: 75 }
      });
      
      mockRedis.lrange.mockResolvedValue([]); // No recent violations
      
      // Step 7: Attempt resume with manual approval
      const resumeResult = await safetyMonitor.attemptResume(userId, {
        requestedBy: 'USER',
        manualApproval: true,
        gradualResume: true
      });
      
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.reducedLimits).toBe(true);
      
      // Step 8: Final status check shows recovery
      safetyStatus = await safetyMonitor.getSafetyStatus(userId);
      expect(safetyStatus.overallStatus).toBe('healthy');
      expect(safetyStatus.recoveryMode).toBe(true);
    });
  });
});