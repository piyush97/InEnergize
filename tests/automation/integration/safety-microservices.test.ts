/**
 * Safety Monitoring Microservices Integration Tests
 * 
 * Tests inter-service communication for LinkedIn compliance safety monitoring.
 * Validates that safety alerts, emergency stops, and rate limiting work correctly
 * across the entire microservices architecture.
 * 
 * Service Integration Coverage:
 * - LinkedIn Service → Analytics Service (metrics reporting)
 * - LinkedIn Service → WebSocket Service (real-time alerts)
 * - LinkedIn Service → Auth Service (user validation)
 * - Analytics Service → WebSocket Service (dashboard updates)
 * - Emergency Stop Service → All Services (system-wide stops)
 */

import { jest } from '@jest/globals';
import axios from 'axios';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { LinkedInRateLimitService } from '../../../services/linkedin-service/src/services/rateLimit.service';
import { EmergencyStopService } from '../../../services/linkedin-service/src/services/emergencyStop.service';
import { LinkedInSafetyMonitorService } from '../../../services/linkedin-service/src/services/safetyMonitor.service';

// Mock external dependencies
jest.mock('axios');
jest.mock('ioredis');
jest.mock('ws');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('Safety Monitoring Microservices Integration', () => {
  let mockRedis: jest.Mocked<Redis>;
  let rateLimitService: LinkedInRateLimitService;
  let emergencyStopService: EmergencyStopService;
  let safetyMonitorService: LinkedInSafetyMonitorService;

  // Service endpoints for integration testing
  const SERVICE_ENDPOINTS = {
    auth: 'http://localhost:3001',
    linkedin: 'http://localhost:3003', 
    analytics: 'http://localhost:3004',
    websocket: 'http://localhost:3007',
    user: 'http://localhost:3002'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup comprehensive Redis mock
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      lpop: jest.fn(),
      rpop: jest.fn(),
      lrange: jest.fn(),
      ltrim: jest.fn(),
      llen: jest.fn(),
      zadd: jest.fn(),
      zrange: jest.fn(),
      zrevrange: jest.fn(),
      zremrangebyrank: jest.fn(),
      zscore: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      psubscribe: jest.fn(),
      punsubscribe: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn(),
      duplicate: jest.fn().mockReturnThis(),
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      })
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    
    // Initialize services
    rateLimitService = new LinkedInRateLimitService();
    emergencyStopService = new EmergencyStopService();
    safetyMonitorService = new LinkedInSafetyMonitorService();
    
    // Mock console to reduce test noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await rateLimitService.disconnect();
    await emergencyStopService.cleanup();
    await safetyMonitorService.cleanup();
    jest.restoreAllMocks();
  });

  describe('LinkedIn Service → Analytics Service Integration', () => {
    it('should send rate limit metrics to analytics service', async () => {
      const userId = 'integration-test-user-1';
      const endpoint = '/v2/invitation';
      
      // Mock successful analytics API call
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, metricId: 'metric-123' }
      });
      
      mockRedis.get.mockResolvedValue('5'); // Current usage
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue(1);
      
      // Trigger rate limit check (should send metrics)
      await rateLimitService.checkRateLimit(userId, endpoint);
      
      // Verify analytics service was called
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${SERVICE_ENDPOINTS.analytics}/api/v1/metrics/rate-limit`,
        expect.objectContaining({
          userId,
          endpoint,
          currentUsage: expect.any(Number),
          limit: expect.any(Number),
          timestamp: expect.any(String)
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringMatching(/Bearer .+/),
            'Content-Type': 'application/json'
          }),
          timeout: 5000
        })
      );
    });

    it('should handle analytics service failures gracefully', async () => {
      const userId = 'integration-test-user-2';
      const endpoint = '/v2/me';
      
      // Mock analytics service failure
      mockedAxios.post.mockRejectedValue(new Error('Analytics service unavailable'));
      
      mockRedis.get.mockResolvedValue('0');
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      
      // Rate limiting should still work despite analytics failure
      const result = await rateLimitService.checkRateLimit(userId, endpoint);
      
      expect(result).toBeDefined();
      expect(result.allowed).toBe(true);
      
      // Should attempt to send metrics but not fail
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should send compliance violation metrics to analytics', async () => {
      const userId = 'compliance-test-user';
      const violationData = {
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        endpoint: '/v2/invitation',
        details: { attempted: 16, limit: 15 }
      };
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, alertId: 'alert-456' }
      });
      
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);
      
      // Record compliance violation
      await rateLimitService.recordViolation(userId, violationData.type, violationData.details);
      
      // Verify analytics received violation data
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${SERVICE_ENDPOINTS.analytics}/api/v1/metrics/compliance-violation`,
        expect.objectContaining({
          userId,
          violationType: 'RATE_LIMIT_EXCEEDED',
          severity: 'HIGH',
          metadata: violationData.details
        }),
        expect.any(Object)
      );
    });

    it('should aggregate safety metrics for analytics dashboard', async () => {
      const userId = 'safety-metrics-user';
      
      // Mock safety monitor data
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('safety_score')) return Promise.resolve('75');
        if (key.includes('daily_connections')) return Promise.resolve('12');
        if (key.includes('hourly_connections')) return Promise.resolve('3');
        return Promise.resolve('0');
      });
      
      mockRedis.lrange.mockResolvedValue([
        JSON.stringify({ 
          timestamp: new Date().toISOString(),
          endpoint: '/v2/invitation',
          success: true
        })
      ]);
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true }
      });
      
      // Get safety status (should trigger analytics update)
      const safetyStatus = await safetyMonitorService.getUserSafetyStatus(userId);
      
      expect(safetyStatus).toBeDefined();
      
      // Verify aggregated metrics sent to analytics
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${SERVICE_ENDPOINTS.analytics}/api/v1/metrics/safety-status`,
        expect.objectContaining({
          userId,
          safetyScore: expect.any(Number),
          metrics: expect.objectContaining({
            dailyUsage: expect.any(Object),
            patterns: expect.any(Object)
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('LinkedIn Service → WebSocket Service Integration', () => {
    it('should send real-time safety alerts via WebSocket', async () => {
      const userId = 'websocket-alert-user';
      const alertData = {
        type: 'CRITICAL_SAFETY_ALERT',
        userId,
        severity: 'CRITICAL',
        message: 'Emergency stop triggered due to compliance violation',
        timestamp: new Date().toISOString(),
        actionRequired: true
      };
      
      mockRedis.publish.mockResolvedValue(1);
      
      // Trigger safety alert
      await safetyMonitorService.broadcastSafetyAlert(userId, alertData);
      
      // Verify WebSocket notification was published
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `safety_alerts:${userId}`,
        JSON.stringify(alertData)
      );
      
      // Verify global alert channel
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'global_safety_alerts',
        JSON.stringify({
          ...alertData,
          channel: `safety_alerts:${userId}`
        })
      );
    });

    it('should broadcast emergency stop events to all connected clients', async () => {
      const userId = 'emergency-broadcast-user';
      const emergencyReason = {
        type: 'COMPLIANCE_VIOLATION',
        severity: 'CRITICAL',
        description: 'Bot-like behavior detected',
        autoResumeAfter: null
      };
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      // Trigger emergency stop
      await emergencyStopService.triggerEmergencyStop(userId, emergencyReason, 'ai-monitor');
      
      // Verify emergency stop broadcast
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'emergency_stops',
        expect.stringContaining('"action":"triggered"')
      );
      
      // Verify user-specific channel
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `user_alerts:${userId}`,
        expect.stringContaining('emergency_stop_triggered')
      );
    });

    it('should send queue status updates in real-time', async () => {
      const userId = 'queue-status-user';
      const queueUpdate = {
        type: 'QUEUE_UPDATE',
        action: 'paused',
        reason: 'Safety score below threshold',
        queueSize: 15,
        estimatedResumeTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
      
      mockRedis.publish.mockResolvedValue(1);
      
      // Simulate queue manager sending update
      await mockRedis.publish(`queue_updates:${userId}`, JSON.stringify(queueUpdate));
      
      // Verify WebSocket service received queue update
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `queue_updates:${userId}`,
        JSON.stringify(queueUpdate)
      );
    });

    it('should handle WebSocket connection failures with retry logic', async () => {
      const userId = 'websocket-failure-user';
      const alertData = {
        type: 'RATE_LIMIT_WARNING',
        severity: 'MEDIUM',
        message: 'Approaching daily connection limit'
      };
      
      // Mock initial failure, then success
      mockRedis.publish
        .mockRejectedValueOnce(new Error('WebSocket service unavailable'))
        .mockResolvedValueOnce(1);
      
      // Mock retry mechanism
      const publishWithRetry = async (channel: string, message: string, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            await mockRedis.publish(channel, message);
            return;
          } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      };
      
      // Should eventually succeed with retry
      await expect(
        publishWithRetry(`safety_alerts:${userId}`, JSON.stringify(alertData))
      ).resolves.not.toThrow();
      
      // Verify retry attempts
      expect(mockRedis.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe('LinkedIn Service → Auth Service Integration', () => {
    it('should validate user permissions before automation actions', async () => {
      const userId = 'auth-validation-user';
      const authToken = 'test-jwt-token';
      
      // Mock auth service validation
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          valid: true,
          user: {
            id: userId,
            subscriptionTier: 'premium',
            permissions: ['linkedin_automation', 'advanced_features']
          }
        }
      });
      
      mockRedis.get.mockResolvedValue('5'); // Current usage
      
      // Check rate limit with auth validation
      const result = await rateLimitService.checkRateLimit(userId, '/v2/invitation', {
        authToken,
        validatePermissions: true
      });
      
      // Verify auth service was called
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${SERVICE_ENDPOINTS.auth}/api/v1/validate`,
        {
          token: authToken,
          requiredPermissions: ['linkedin_automation']
        },
        expect.objectContaining({
          timeout: 3000
        })
      );
      
      expect(result.allowed).toBe(true);
    });

    it('should reject automation for users without proper permissions', async () => {
      const userId = 'unauthorized-user';
      const authToken = 'invalid-token';
      
      // Mock auth service rejection
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          valid: false,
          error: 'Insufficient permissions for LinkedIn automation'
        }
      });
      
      // Should reject rate limit check
      const result = await rateLimitService.checkRateLimit(userId, '/v2/invitation', {
        authToken,
        validatePermissions: true
      });
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('permission');
    });

    it('should handle auth service downtime gracefully', async () => {
      const userId = 'auth-downtime-user';
      const authToken = 'test-token';
      
      // Mock auth service timeout
      mockedAxios.post.mockRejectedValue(new Error('Auth service timeout'));
      
      mockRedis.get.mockResolvedValue('3');
      
      // Should fallback to local validation/cache
      const result = await rateLimitService.checkRateLimit(userId, '/v2/me', {
        authToken,
        validatePermissions: true,
        allowFallback: true
      });
      
      expect(result).toBeDefined();
      // Should have warning about auth service unavailability
      expect(result.warnings).toContain('Auth service unavailable');
    });

    it('should update user subscription limits based on auth service data', async () => {
      const userId = 'subscription-update-user';
      
      // Mock auth service with updated subscription
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          user: {
            id: userId,
            subscriptionTier: 'enterprise',
            limits: {
              dailyConnections: 50, // Higher limit for enterprise
              dailyLikes: 100,
              dailyComments: 25
            }
          }
        }
      });
      
      // Sync user limits
      await rateLimitService.syncUserLimits(userId);
      
      // Verify auth service was queried
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${SERVICE_ENDPOINTS.auth}/api/v1/users/${userId}/subscription`,
        expect.objectContaining({
          timeout: 5000
        })
      );
      
      // Verify updated limits in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `user_limits:${userId}`,
        24 * 60 * 60, // 24 hours
        expect.stringContaining('"dailyConnections":50')
      );
    });
  });

  describe('Analytics Service → WebSocket Service Integration', () => {
    it('should stream real-time dashboard metrics to WebSocket clients', async () => {
      const userId = 'dashboard-metrics-user';
      const metricsData = {
        profileViews: 45,
        connectionRequests: 12,
        acceptanceRate: 0.75,
        engagementRate: 0.88,
        safetyScore: 82,
        timestamp: new Date().toISOString()
      };
      
      mockRedis.publish.mockResolvedValue(1);
      
      // Mock analytics service sending metrics update
      await mockRedis.publish(
        `dashboard_metrics:${userId}`,
        JSON.stringify({
          type: 'METRICS_UPDATE',
          data: metricsData
        })
      );
      
      // Verify WebSocket received dashboard update
      expect(mockRedis.publish).toHaveBeenCalledWith(
        `dashboard_metrics:${userId}`,
        expect.stringContaining('"profileViews":45')
      );
    });

    it('should aggregate system-wide metrics for admin dashboard', async () => {
      const systemMetrics = {
        totalActiveUsers: 150,
        totalEmergencyStops: 3,
        averageSafetyScore: 87.5,
        complianceViolations24h: 2,
        systemHealth: 'excellent',
        timestamp: new Date().toISOString()
      };
      
      mockRedis.publish.mockResolvedValue(1);
      
      // Mock analytics service broadcasting system metrics
      await mockRedis.publish('system_metrics', JSON.stringify({
        type: 'SYSTEM_HEALTH_UPDATE',
        data: systemMetrics
      }));
      
      // Verify system-wide broadcast
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'system_metrics',
        expect.stringContaining('"totalActiveUsers":150')
      );
    });

    it('should trigger alerts based on analytics thresholds', async () => {
      const alertThresholds = {
        safetyScoreBelow: 60,
        emergencyStopsAbove: 5,
        violationsPerHour: 3
      };
      
      const currentMetrics = {
        averageSafetyScore: 55, // Below threshold
        emergencyStopsLast24h: 7, // Above threshold
        violationsLastHour: 4 // Above threshold
      };
      
      mockRedis.publish.mockResolvedValue(1);
      
      // Mock analytics triggering threshold alerts
      for (const [metric, value] of Object.entries(currentMetrics)) {
        await mockRedis.publish('threshold_alerts', JSON.stringify({
          type: 'THRESHOLD_EXCEEDED',
          metric,
          value,
          threshold: alertThresholds[metric as keyof typeof alertThresholds],
          severity: 'HIGH',
          timestamp: new Date().toISOString()
        }));
      }
      
      // Verify all threshold alerts were sent
      expect(mockRedis.publish).toHaveBeenCalledTimes(3);
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'threshold_alerts',
        expect.stringContaining('"type":"THRESHOLD_EXCEEDED"')
      );
    });
  });

  describe('System-Wide Emergency Stop Integration', () => {
    it('should coordinate emergency stop across all services', async () => {
      const reason = 'LinkedIn API maintenance window detected';
      const triggeredBy = 'system-monitor';
      const affectedUsers = ['user-1', 'user-2', 'user-3'];
      
      // Mock all services responding to emergency stop
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue(
        affectedUsers.map(id => `automation_status:${id}`)
      );
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      // Mock service acknowledgments
      mockedAxios.post
        .mockResolvedValueOnce({ status: 200, data: { acknowledged: true, service: 'analytics' } })
        .mockResolvedValueOnce({ status: 200, data: { acknowledged: true, service: 'websocket' } })
        .mockResolvedValueOnce({ status: 200, data: { acknowledged: true, service: 'auth' } });
      
      // Trigger system-wide emergency stop
      const result = await emergencyStopService.triggerSystemWideEmergencyStop(
        reason,
        triggeredBy,
        affectedUsers
      );
      
      expect(result.success).toBe(true);
      expect(result.affectedUsers).toBe(3);
      
      // Verify emergency stops were triggered for all users
      expect(mockRedis.setex).toHaveBeenCalledTimes(3);
      
      // Verify system-wide broadcast
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'system_emergency_stop',
        expect.stringContaining(reason)
      );
      
      // Verify all services were notified
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${SERVICE_ENDPOINTS.analytics}/api/v1/emergency-stop`,
        expect.objectContaining({ reason, triggeredBy }),
        expect.any(Object)
      );
    });

    it('should handle partial service failures during system-wide stop', async () => {
      const reason = 'Critical security incident detected';
      const triggeredBy = 'security-team';
      const affectedUsers = ['user-1', 'user-2'];
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue(
        affectedUsers.map(id => `automation_status:${id}`)
      );
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      // Mock analytics service failure
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Analytics service unavailable'))
        .mockResolvedValueOnce({ status: 200, data: { acknowledged: true } })
        .mockResolvedValueOnce({ status: 200, data: { acknowledged: true } });
      
      const result = await emergencyStopService.triggerSystemWideEmergencyStop(
        reason,
        triggeredBy,
        affectedUsers
      );
      
      // Should succeed despite partial failures
      expect(result.success).toBe(true);
      expect(result.affectedUsers).toBe(2);
      
      // Should log service failures but not fail completely
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'system_emergency_log',
        expect.stringContaining('Analytics service unavailable')
      );
    });

    it('should coordinate system recovery after emergency stop', async () => {
      const recoveryReason = 'LinkedIn API fully restored';
      const recoveredBy = 'system-monitor';
      const usersToRecover = ['user-1', 'user-2', 'user-3'];
      
      // Mock emergency stop status for users
      mockRedis.get.mockImplementation((key: string) => {
        if (key.startsWith('emergency_stop:')) {
          return Promise.resolve(JSON.stringify({
            userId: key.replace('emergency_stop:', ''),
            active: true,
            manualResumeRequired: false,
            estimatedResumeTime: new Date(Date.now() - 60000) // Past time
          }));
        }
        return Promise.resolve(null);
      });
      
      mockRedis.del.mockResolvedValue(1);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      // Mock service recovery confirmations
      mockedAxios.post
        .mockResolvedValueOnce({ status: 200, data: { recovered: true, service: 'analytics' } })
        .mockResolvedValueOnce({ status: 200, data: { recovered: true, service: 'websocket' } })
        .mockResolvedValueOnce({ status: 200, data: { recovered: true, service: 'auth' } });
      
      // Perform system recovery
      const recoveryPromises = usersToRecover.map(userId =>
        emergencyStopService.resumeAutomation(userId, recoveredBy, recoveryReason)
      );
      
      const results = await Promise.all(recoveryPromises);
      
      // All users should be successfully recovered
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Verify system recovery broadcast
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'system_recovery',
        expect.stringContaining(recoveryReason)
      );
      
      // Verify all services were notified of recovery
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recovery'),
        expect.objectContaining({ recoveredBy, reason: recoveryReason }),
        expect.any(Object)
      );
    });
  });

  describe('Cross-Service Error Handling and Resilience', () => {
    it('should maintain core functionality when analytics service is down', async () => {
      const userId = 'resilience-test-user';
      
      // Mock analytics service down
      mockedAxios.post.mockRejectedValue(new Error('Service unavailable'));
      
      mockRedis.get.mockResolvedValue('8');
      mockRedis.incr.mockResolvedValue(9);
      mockRedis.expire.mockResolvedValue(1);
      
      // Rate limiting should still work
      const rateLimitResult = await rateLimitService.checkRateLimit(userId, '/v2/invitation');
      expect(rateLimitResult.allowed).toBe(true);
      
      // Safety monitoring should still work
      mockRedis.lrange.mockResolvedValue([]);
      const safetyStatus = await safetyMonitorService.getUserSafetyStatus(userId);
      expect(safetyStatus).toBeDefined();
      
      // Emergency stops should still work
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      const emergencyResult = await emergencyStopService.triggerEmergencyStop(userId, {
        type: 'RATE_LIMIT',
        severity: 'HIGH',
        description: 'Test with analytics down',
        autoResumeAfter: 60
      });
      
      // Should succeed despite analytics being down
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `emergency_stop:${userId}`,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should queue metrics when WebSocket service is unavailable', async () => {
      const userId = 'websocket-down-user';
      const metricsData = {
        type: 'SAFETY_ALERT',
        userId,
        severity: 'HIGH',
        message: 'Rate limit warning'
      };
      
      // Mock WebSocket service failure
      mockRedis.publish.mockRejectedValue(new Error('WebSocket service down'));
      
      // Should queue metrics for later delivery
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      
      // Attempt to send metrics
      try {
        await mockRedis.publish(`safety_alerts:${userId}`, JSON.stringify(metricsData));
      } catch (error) {
        // Queue for retry
        await mockRedis.lpush(
          'websocket_retry_queue',
          JSON.stringify({
            channel: `safety_alerts:${userId}`,
            message: JSON.stringify(metricsData),
            timestamp: new Date().toISOString(),
            retryCount: 0
          })
        );
      }
      
      // Verify metrics were queued
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'websocket_retry_queue',
        expect.stringContaining('"retryCount":0')
      );
    });

    it('should implement circuit breaker for service-to-service calls', async () => {
      const userId = 'circuit-breaker-user';
      
      // Simulate repeated failures to analytics service
      const failures = Array(6).fill(null).map(() => 
        new Error('Analytics service timeout')
      );
      
      mockedAxios.post
        .mockRejectedValueOnce(failures[0])
        .mockRejectedValueOnce(failures[1])
        .mockRejectedValueOnce(failures[2])
        .mockRejectedValueOnce(failures[3])
        .mockRejectedValueOnce(failures[4])
        .mockRejectedValueOnce(failures[5]);
      
      // Mock circuit breaker logic
      let circuitOpen = false;
      let failureCount = 0;
      
      const callServiceWithCircuitBreaker = async () => {
        if (circuitOpen) {
          throw new Error('Circuit breaker is open');
        }
        
        try {
          await mockedAxios.post(`${SERVICE_ENDPOINTS.analytics}/api/v1/test`);
          failureCount = 0; // Reset on success
        } catch (error) {
          failureCount++;
          if (failureCount >= 5) {
            circuitOpen = true;
          }
          throw error;
        }
      };
      
      // First 5 calls should fail and open circuit
      for (let i = 0; i < 5; i++) {
        await expect(callServiceWithCircuitBreaker()).rejects.toThrow();
      }
      
      expect(circuitOpen).toBe(true);
      
      // 6th call should fail due to circuit breaker
      await expect(callServiceWithCircuitBreaker()).rejects.toThrow('Circuit breaker is open');
    });

    it('should implement exponential backoff for retry logic', async () => {
      const userId = 'retry-backoff-user';
      const maxRetries = 3;
      const baseDelay = 100;
      
      // Mock service temporarily unavailable
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockRejectedValueOnce(new Error('Service unavailable'))
        .mockResolvedValueOnce({ status: 200, data: { success: true } });
      
      const callWithExponentialBackoff = async (attempt = 0): Promise<any> => {
        try {
          return await mockedAxios.post(`${SERVICE_ENDPOINTS.analytics}/api/v1/metrics`);
        } catch (error) {
          if (attempt >= maxRetries) {
            throw error;
          }
          
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          return callWithExponentialBackoff(attempt + 1);
        }
      };
      
      const startTime = Date.now();
      const result = await callWithExponentialBackoff();
      const totalTime = Date.now() - startTime;
      
      expect(result.status).toBe(200);
      expect(totalTime).toBeGreaterThan(baseDelay * 3); // Should have delayed
      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    });
  });

  describe('End-to-End Integration Scenarios', () => {
    it('should execute complete safety violation workflow across all services', async () => {
      const userId = 'e2e-safety-user';
      const scenario = 'Rate limit exceeded → Emergency stop → Recovery';
      
      // Step 1: User hits rate limit
      mockRedis.get.mockResolvedValue('15'); // At daily limit
      
      const rateLimitResult = await rateLimitService.checkRateLimit(userId, '/v2/invitation');
      expect(rateLimitResult.allowed).toBe(false);
      
      // Step 2: Safety monitor detects violation
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);
      
      await rateLimitService.recordViolation(userId, 'RATE_LIMIT_EXCEEDED', {
        attempted: 16,
        limit: 15,
        endpoint: '/v2/invitation'
      });
      
      // Step 3: Emergency stop is triggered
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      await emergencyStopService.triggerEmergencyStop(userId, {
        type: 'RATE_LIMIT',
        severity: 'HIGH',
        description: 'Daily connection limit exceeded',
        autoResumeAfter: 60
      });
      
      // Step 4: Analytics service receives metrics
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true }
      });
      
      // Step 5: WebSocket service broadcasts alerts
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'emergency_stops',
        expect.stringContaining('"action":"triggered"')
      );
      
      // Step 6: Auto-recovery after timeout
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId,
        active: true,
        manualResumeRequired: false,
        estimatedResumeTime: new Date(Date.now() - 60000) // Past time
      }));
      
      mockRedis.del.mockResolvedValue(1);
      
      const status = await emergencyStopService.getEmergencyStopStatus(userId);
      expect(status).toBeNull(); // Auto-resumed
      
      // Verify complete workflow
      expect(mockRedis.lpush).toHaveBeenCalled(); // Violation recorded
      expect(mockRedis.setex).toHaveBeenCalled(); // Emergency stop set
      expect(mockRedis.publish).toHaveBeenCalled(); // WebSocket notified
      expect(mockRedis.del).toHaveBeenCalled(); // Emergency stop cleared
    });

    it('should handle concurrent users with different compliance statuses', async () => {
      const users = [
        { id: 'compliant-user', status: 'compliant', usage: 5 },
        { id: 'warning-user', status: 'warning', usage: 12 },
        { id: 'violation-user', status: 'violation', usage: 16 }
      ];
      
      // Mock different Redis responses for each user
      mockRedis.get.mockImplementation((key: string) => {
        const user = users.find(u => key.includes(u.id));
        return Promise.resolve(user ? user.usage.toString() : '0');
      });
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true }
      });
      
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.publish.mockResolvedValue(1);
      
      // Process all users concurrently
      const results = await Promise.all(
        users.map(user => 
          rateLimitService.checkRateLimit(user.id, '/v2/invitation')
        )
      );
      
      // Verify different outcomes
      expect(results[0].allowed).toBe(true); // Compliant user
      expect(results[1].allowed).toBe(true); // Warning user (still allowed)
      expect(results[2].allowed).toBe(false); // Violation user
      
      // Verify analytics received metrics for all users
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      
      // Verify emergency stop only for violation user
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'emergency_stop:violation-user',
        expect.any(Number),
        expect.any(String)
      );
    });
  });
});

describe('Safety Monitoring Performance Under Load', () => {
  let mockRedis: jest.Mocked<Redis>;
  let rateLimitService: LinkedInRateLimitService;
  let safetyMonitorService: LinkedInSafetyMonitorService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      publish: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      })
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    mockedAxios.post.mockResolvedValue({ status: 200, data: { success: true } });
    
    rateLimitService = new LinkedInRateLimitService();
    safetyMonitorService = new LinkedInSafetyMonitorService();
    
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await rateLimitService.disconnect();
    await safetyMonitorService.cleanup();
    jest.restoreAllMocks();
  });

  it('should handle 1000 concurrent rate limit checks', async () => {
    const userCount = 1000;
    const users = Array.from({ length: userCount }, (_, i) => `load-test-user-${i}`);
    
    mockRedis.get.mockResolvedValue('5');
    mockRedis.incr.mockResolvedValue(6);
    mockRedis.expire.mockResolvedValue(1);
    
    const startTime = Date.now();
    
    // Fire 1000 concurrent requests
    const promises = users.map(userId =>
      rateLimitService.checkRateLimit(userId, '/v2/me')
    );
    
    const results = await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
    
    // All requests should succeed
    expect(results).toHaveLength(userCount);
    results.forEach(result => {
      expect(result.allowed).toBe(true);
    });
    
    // Should not overwhelm Redis
    expect(mockRedis.get).toHaveBeenCalledTimes(userCount);
  });

  it('should maintain service performance during emergency stop cascade', async () => {
    const userCount = 100;
    const users = Array.from({ length: userCount }, (_, i) => `cascade-user-${i}`);
    
    // Mock emergency stop requirements
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.zremrangebyrank.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.lpush.mockResolvedValue(1);
    mockRedis.ltrim.mockResolvedValue('OK');
    mockRedis.publish.mockResolvedValue(1);
    
    const emergencyReason = {
      type: 'SYSTEM_OVERLOAD',
      severity: 'HIGH',
      description: 'Load test emergency stop',
      autoResumeAfter: 15
    };
    
    const startTime = Date.now();
    
    // Trigger emergency stops for all users
    const emergencyStopService = new EmergencyStopService();
    const promises = users.map(userId =>
      emergencyStopService.triggerEmergencyStop(userId, emergencyReason, 'load-test')
    );
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within 10 seconds even under load
    expect(duration).toBeLessThan(10000);
    
    await emergencyStopService.cleanup();
  });
});