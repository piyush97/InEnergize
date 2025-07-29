// LinkedIn Compliance Service Unit Tests

import { LinkedInComplianceService } from '../../src/services/compliance.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('LinkedInComplianceService', () => {
  let complianceService: LinkedInComplianceService;

  beforeEach(() => {
    // Set environment variables
    process.env.LINKEDIN_REQUESTS_PER_DAY = '500';
    process.env.LINKEDIN_REQUESTS_PER_HOUR = '50';
    process.env.LINKEDIN_REQUESTS_PER_MINUTE = '5';
    process.env.LINKEDIN_BURST_LIMIT = '10';
    process.env.LINKEDIN_MIN_REQUEST_DELAY = '2000';
    process.env.LINKEDIN_MAX_REQUEST_DELAY = '5000';

    complianceService = new LinkedInComplianceService();

    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('validateRequest', () => {
    const mockUserId = 'user-123';
    const mockEndpoint = '/v2/people/connections';

    it('should allow request within limits', async () => {
      const result = await complianceService.validateRequest(mockUserId, mockEndpoint);

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe('LOW');
      expect(result.reason).toBeUndefined();
      expect(result.retryAfter).toBeUndefined();
    });

    it('should reject request when circuit breaker is open', async () => {
      // Trigger circuit breaker by logging failed requests
      for (let i = 0; i < 5; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: mockEndpoint,
          method: 'GET',
          statusCode: 500,
          responseTime: 1000,
          success: false
        });
      }

      const result = await complianceService.validateRequest(mockUserId, mockEndpoint);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Circuit breaker open - too many recent failures');
      expect(result.retryAfter).toBe(300);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should reject request when minute limit exceeded', async () => {
      // Log 5 requests in the last minute to hit the limit
      for (let i = 0; i < 5; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: mockEndpoint,
          method: 'GET',
          statusCode: 200,
          responseTime: 500,
          success: true
        });
      }

      const result = await complianceService.validateRequest(mockUserId, mockEndpoint);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Minute rate limit exceeded');
      expect(result.retryAfter).toBe(60);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('should reject request when hourly limit exceeded', async () => {
      // Log 50 requests in the last hour to hit the limit
      for (let i = 0; i < 50; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: mockEndpoint,
          method: 'GET',
          statusCode: 200,
          responseTime: 500,
          success: true
        });
      }

      const result = await complianceService.validateRequest(mockUserId, mockEndpoint);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Hourly rate limit exceeded');
      expect(result.retryAfter).toBe(3600);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('should reject request when daily limit exceeded', async () => {
      // Log 500 requests in the last day to hit the limit
      for (let i = 0; i < 500; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: mockEndpoint,
          method: 'GET',
          statusCode: 200,
          responseTime: 500,
          success: true
        });
      }

      const result = await complianceService.validateRequest(mockUserId, mockEndpoint);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily rate limit exceeded');
      expect(result.retryAfter).toBe(86400);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should detect high risk patterns', async () => {
      // Log 25 requests in the last hour to trigger high risk
      for (let i = 0; i < 25; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: mockEndpoint,
          method: 'GET',
          statusCode: 200,
          responseTime: 500,
          success: true
        });
      }

      const result = await complianceService.validateRequest(mockUserId, mockEndpoint);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Suspicious activity pattern detected');
      expect(result.retryAfter).toBe(1800);
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should handle validation errors gracefully', async () => {
      // Simulate error by mocking getUserUsage to throw
      const originalGetUserUsage = (complianceService as any).getUserUsage;
      (complianceService as any).getUserUsage = jest.fn().mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const alertSpy = jest.fn();
      complianceService.on('complianceAlert', alertSpy);

      const result = await complianceService.validateRequest(mockUserId, mockEndpoint);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Compliance service error');
      expect(result.riskLevel).toBe('HIGH');

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'CRITICAL',
          message: expect.stringContaining('Compliance validation error')
        })
      );

      // Restore original method
      (complianceService as any).getUserUsage = originalGetUserUsage;
    });
  });

  describe('logRequest', () => {
    const mockUserId = 'user-123';
    const mockEndpoint = '/v2/people/connections';

    it('should log successful request', async () => {
      const requestData = {
        userId: mockUserId,
        endpoint: mockEndpoint,
        method: 'GET',
        statusCode: 200,
        responseTime: 300,
        success: true,
        userAgent: 'InErgize/1.0'
      };

      const eventSpy = jest.fn();
      complianceService.on('requestLogged', eventSpy);

      await complianceService.logRequest(requestData);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          endpoint: mockEndpoint,
          action: 'GET',
          success: true,
          statusCode: 200,
          responseTime: 300,
          riskScore: expect.any(Number)
        })
      );
    });

    it('should log failed request and update circuit breaker', async () => {
      const requestData = {
        userId: mockUserId,
        endpoint: mockEndpoint,
        method: 'POST',
        statusCode: 500,
        responseTime: 5000,
        success: false
      };

      await complianceService.logRequest(requestData);

      // Check circuit breaker status
      const circuitBreakers = complianceService.getCircuitBreakerStatus();
      const endpointBreaker = circuitBreakers.get(mockEndpoint);

      expect(endpointBreaker).toBeDefined();
      expect(endpointBreaker?.failures).toBe(1);
      expect(endpointBreaker?.isOpen).toBe(false);
    });

    it('should open circuit breaker after 5 consecutive failures', async () => {
      const requestData = {
        userId: mockUserId,
        endpoint: mockEndpoint,
        method: 'POST',
        statusCode: 500,
        responseTime: 1000,
        success: false
      };

      const alertSpy = jest.fn();
      complianceService.on('complianceAlert', alertSpy);

      // Log 5 failed requests
      for (let i = 0; i < 5; i++) {
        await complianceService.logRequest(requestData);
      }

      const circuitBreakers = complianceService.getCircuitBreakerStatus();
      const endpointBreaker = circuitBreakers.get(mockEndpoint);

      expect(endpointBreaker?.isOpen).toBe(true);
      expect(endpointBreaker?.failures).toBe(5);

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'CRITICAL',
          message: expect.stringContaining('Circuit breaker opened')
        })
      );
    });

    it('should detect rate limit violations', async () => {
      const requestData = {
        userId: mockUserId,
        endpoint: mockEndpoint,
        method: 'GET',
        statusCode: 429, // Rate limit exceeded
        responseTime: 100,
        success: false
      };

      const alertSpy = jest.fn();
      complianceService.on('complianceAlert', alertSpy);

      await complianceService.logRequest(requestData);

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'CRITICAL',
          message: expect.stringContaining('Rate limit violation detected')
        })
      );
    });

    it('should detect high error rates', async () => {
      const alertSpy = jest.fn();
      complianceService.on('complianceAlert', alertSpy);

      // Log multiple failed requests to trigger high error rate alert
      for (let i = 0; i < 15; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: mockEndpoint,
          method: 'GET',
          statusCode: i < 10 ? 500 : 200, // 10 failures, 5 successes = 66% error rate
          responseTime: 500,
          success: i >= 10
        });
      }

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'WARNING',
          message: expect.stringContaining('High error rate detected')
        })
      );
    });
  });

  describe('getComplianceMetrics', () => {
    const mockUserId = 'user-123';

    beforeEach(async () => {
      // Log some sample requests
      const endpoints = ['/v2/connections', '/v2/people', '/v2/messages'];
      
      for (let i = 0; i < 30; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: endpoints[i % 3],
          method: 'GET',
          statusCode: i % 5 === 0 ? 500 : 200, // 20% error rate
          responseTime: 300 + Math.random() * 200,
          success: i % 5 !== 0
        });
      }
    });

    it('should return comprehensive compliance metrics', () => {
      const metrics = complianceService.getComplianceMetrics(mockUserId);

      expect(metrics).toMatchObject({
        dailyLimits: {
          connectionRequests: {
            limit: 20,
            used: expect.any(Number),
            remaining: expect.any(Number)
          },
          messages: {
            limit: 25,
            used: expect.any(Number),
            remaining: expect.any(Number)
          },
          profileViews: {
            limit: 50,
            used: expect.any(Number),
            remaining: expect.any(Number)
          }
        },
        accountHealth: {
          score: expect.any(Number),
          riskLevel: expect.any(String),
          warnings: expect.any(Array)
        },
        recentActivity: expect.any(Array)
      });

      expect(metrics.accountHealth.score).toBeGreaterThanOrEqual(0);
      expect(metrics.accountHealth.score).toBeLessThanOrEqual(100);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(metrics.accountHealth.riskLevel);
    });

    it('should calculate correct remaining limits', () => {
      const metrics = complianceService.getComplianceMetrics(mockUserId);

      expect(metrics.dailyLimits.connectionRequests.remaining).toBe(
        Math.max(0, metrics.dailyLimits.connectionRequests.limit - metrics.dailyLimits.connectionRequests.used)
      );
    });

    it('should include appropriate warnings', () => {
      // Log many requests to trigger warnings
      for (let i = 0; i < 400; i++) {
        complianceService['requestLog'].get(mockUserId)?.push({
          userId: mockUserId,
          endpoint: '/v2/test',
          action: 'GET',
          timestamp: new Date(),
          target: '/v2/test',
          success: true,
          statusCode: 200,
          responseTime: 300,
          riskScore: 1
        });
      }

      const metrics = complianceService.getComplianceMetrics(mockUserId);

      expect(metrics.accountHealth.warnings).toContain('Approaching daily request limit');
    });
  });

  describe('performAccountHealthCheck', () => {
    const mockUserId = 'user-123';
    const mockAccessToken = 'mock-access-token';

    it('should perform comprehensive health check with healthy account', async () => {
      // Mock successful LinkedIn API call
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: { id: 'linkedin-user-id' }
      });

      const result = await complianceService.performAccountHealthCheck(mockUserId, mockAccessToken);

      expect(result.overall).toBe('HEALTHY');
      expect(result.score).toBeGreaterThan(80);
      expect(result.checks).toHaveLength(4);
      expect(result.trends).toMatchObject({
        errorRateWeekly: expect.any(Number),
        usageGrowthRate: expect.any(Number),
        successRateChange: expect.any(Number)
      });

      // Check that all health checks passed
      const passedChecks = result.checks.filter(check => check.status === 'PASS');
      expect(passedChecks.length).toBeGreaterThan(0);
    });

    it('should detect API connectivity issues', async () => {
      // Mock failed LinkedIn API call
      mockAxios.get.mockRejectedValue({
        response: { status: 401 }
      });

      const result = await complianceService.performAccountHealthCheck(mockUserId, mockAccessToken);

      expect(result.overall).toBe('AT_RISK');
      expect(result.score).toBeLessThan(100);

      const apiCheck = result.checks.find(check => check.name === 'API Connectivity');
      expect(apiCheck?.status).toBe('FAIL');
      expect(apiCheck?.message).toContain('invalid or expired');
    });

    it('should detect rate limit issues', async () => {
      mockAxios.get.mockResolvedValue({ status: 200, data: {} });

      // Create high usage scenario
      for (let i = 0; i < 450; i++) { // Near daily limit
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: '/v2/test',
          method: 'GET',
          statusCode: 200,
          responseTime: 300,
          success: true
        });
      }

      const result = await complianceService.performAccountHealthCheck(mockUserId, mockAccessToken);

      const rateLimitCheck = result.checks.find(check => check.name === 'Rate Limit Compliance');
      expect(rateLimitCheck?.status).toBe('FAIL');
      expect(rateLimitCheck?.message).toContain('Daily usage at');
    });

    it('should detect behavioral pattern issues', async () => {
      mockAxios.get.mockResolvedValue({ status: 200, data: {} });

      // Create rapid request pattern
      const now = new Date();
      for (let i = 0; i < 15; i++) {
        const timestamp = new Date(now.getTime() - (i * 10000)); // 10 seconds apart
        complianceService['requestLog'].set(mockUserId, [
          ...(complianceService['requestLog'].get(mockUserId) || []),
          {
            userId: mockUserId,
            endpoint: '/v2/test',
            action: 'GET',
            timestamp,
            target: '/v2/test',
            success: true,
            statusCode: 200,
            responseTime: 300,
            riskScore: 2
          }
        ]);
      }

      const result = await complianceService.performAccountHealthCheck(mockUserId, mockAccessToken);

      const behaviorCheck = result.checks.find(check => check.name === 'Behavioral Patterns');
      expect(behaviorCheck?.status).toBe('FAIL');
      expect(behaviorCheck?.message).toContain('rapid requests detected');
    });

    it('should detect TOS compliance violations', async () => {
      mockAxios.get.mockResolvedValue({ status: 200, data: {} });

      // Create scenario with excessive connections
      for (let i = 0; i < 60; i++) {
        await complianceService.logRequest({
          userId: mockUserId,
          endpoint: '/v2/connections',
          method: 'POST',
          statusCode: 200,
          responseTime: 300,
          success: true
        });
      }

      const result = await complianceService.performAccountHealthCheck(mockUserId, mockAccessToken);

      const tosCheck = result.checks.find(check => check.name === 'LinkedIn TOS Compliance');
      expect(tosCheck?.status).toBe('FAIL');
      expect(tosCheck?.message).toContain('Multiple TOS violations detected');
    });

    it('should handle health check errors gracefully', async () => {
      // Mock API error
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await complianceService.performAccountHealthCheck(mockUserId, mockAccessToken);

      expect(result.overall).toBe('CRITICAL');
      expect(result.score).toBe(0);
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].status).toBe('FAIL');
    });
  });

  describe('generateHumanLikeDelay', () => {
    it('should generate delay within configured range', () => {
      const delay = complianceService.generateHumanLikeDelay();

      expect(delay).toBeGreaterThanOrEqual(1000); // Minimum 1 second
      expect(delay).toBeLessThanOrEqual(5500); // Max + jitter
    });

    it('should respect minimum delay', () => {
      // Test with very low configured delays
      process.env.LINKEDIN_MIN_REQUEST_DELAY = '500';
      process.env.LINKEDIN_MAX_REQUEST_DELAY = '800';

      const newService = new LinkedInComplianceService();
      const delay = newService.generateHumanLikeDelay();

      expect(delay).toBeGreaterThanOrEqual(1000); // Should enforce minimum
    });

    it('should add jitter when enabled', () => {
      process.env.LINKEDIN_ENABLE_JITTER = 'true';

      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(complianceService.generateHumanLikeDelay());
      }

      // With jitter, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('setUserLimits and getUserLimits', () => {
    const mockUserId = 'user-123';

    it('should set and retrieve custom user limits', () => {
      const customLimits = {
        daily: {
          requests: 300,
          connections: 15,
          messages: 20,
          profileViews: 40
        }
      };

      complianceService.setUserLimits(mockUserId, customLimits);

      const userLimits = (complianceService as any).getUserLimits(mockUserId);
      expect(userLimits.daily.requests).toBe(300);
      expect(userLimits.daily.connections).toBe(15);
    });

    it('should merge custom limits with defaults', () => {
      const partialLimits = {
        daily: {
          connections: 10 // Only override connections
        }
      };

      complianceService.setUserLimits(mockUserId, partialLimits);

      const userLimits = (complianceService as any).getUserLimits(mockUserId);
      expect(userLimits.daily.connections).toBe(10); // Custom value
      expect(userLimits.daily.requests).toBe(500); // Default value
    });
  });

  describe('circuit breaker management', () => {
    const mockEndpoint = '/v2/test';

    it('should reset circuit breaker', () => {
      // First, open the circuit breaker
      const breaker = { isOpen: true, failures: 5, lastFailure: new Date() };
      (complianceService as any).circuitBreakers.set(mockEndpoint, breaker);

      complianceService.resetCircuitBreaker(mockEndpoint);

      const resetBreaker = complianceService.getCircuitBreakerStatus().get(mockEndpoint);
      expect(resetBreaker?.isOpen).toBe(false);
      expect(resetBreaker?.failures).toBe(0);
    });

    it('should automatically reset circuit breaker after timeout', async () => {
      // Open circuit breaker with old failure time
      const oldFailure = new Date(Date.now() - 400000); // 6.67 minutes ago
      const breaker = { isOpen: true, failures: 5, lastFailure: oldFailure };
      (complianceService as any).circuitBreakers.set(mockEndpoint, breaker);

      const result = await complianceService.validateRequest('user-123', mockEndpoint);

      // Should now be allowed since enough time has passed
      expect(result.allowed).toBe(true);

      const resetBreaker = (complianceService as any).circuitBreakers.get(mockEndpoint);
      expect(resetBreaker.isOpen).toBe(false);
    });
  });

  describe('alert history management', () => {
    it('should retrieve alert history', async () => {
      // Generate some alerts
      await complianceService.logRequest({
        userId: 'test-user',
        endpoint: '/v2/test',
        method: 'GET',
        statusCode: 429,
        responseTime: 100,
        success: false
      });

      const alerts = complianceService.getAlertHistory(1); // Last 1 hour
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toMatchObject({
        level: expect.any(String),
        message: expect.any(String),
        timestamp: expect.any(Date)
      });
    });

    it('should limit alert history size', async () => {
      const alertHistory = (complianceService as any).alertHistory;
      
      // Add more than 1000 alerts
      for (let i = 0; i < 1200; i++) {
        alertHistory.push({
          level: 'WARNING',
          message: `Test alert ${i}`,
          timestamp: new Date(),
          metrics: {}
        });
      }

      // Trigger cleanup by emitting another alert
      (complianceService as any).emitAlert('WARNING', 'Trigger cleanup', {});

      expect(alertHistory.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('cleanup and reporting', () => {
    it('should clean up old logs', () => {
      const mockUserId = 'test-user';
      
      // Add old requests
      const oldRequests = Array.from({ length: 10 }, (_, i) => ({
        userId: mockUserId,
        endpoint: '/v2/test',
        action: 'GET',
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        target: '/v2/test',
        success: true,
        statusCode: 200,
        responseTime: 300,
        riskScore: 1
      }));

      (complianceService as any).requestLog.set(mockUserId, oldRequests);

      // Trigger cleanup
      (complianceService as any).cleanupOldLogs();

      const remainingRequests = (complianceService as any).requestLog.get(mockUserId);
      expect(remainingRequests).toBeUndefined(); // Should be completely removed
    });

    it('should generate compliance reports', () => {
      const reportSpy = jest.fn();
      complianceService.on('complianceReport', reportSpy);

      // Trigger report generation
      (complianceService as any).generateComplianceReport();

      expect(reportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
          totalUsers: expect.any(Number),
          totalRequests: expect.any(Number),
          activeCircuitBreakers: expect.any(Number),
          recentAlerts: expect.any(Number)
        })
      );
    });
  });

  describe('risk calculation', () => {
    it('should calculate higher risk for unusual hours', () => {
      const earlyMorningRequest = {
        userId: 'test-user',
        endpoint: '/v2/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 300,
        success: true
      };

      // Mock current time to be 3 AM
      const originalDate = Date;
      const mockDate = jest.fn(() => ({
        getHours: () => 3
      }));
      global.Date = mockDate as any;

      const riskScore = (complianceService as any).calculateRiskScore(earlyMorningRequest);

      expect(riskScore).toBeGreaterThan(1); // Base score + unusual hour penalty

      // Restore original Date
      global.Date = originalDate;
    });

    it('should calculate higher risk for connection endpoints', () => {
      const connectionRequest = {
        userId: 'test-user',
        endpoint: '/v2/connections',
        method: 'POST',
        statusCode: 200,
        responseTime: 300,
        success: true
      };

      const riskScore = (complianceService as any).calculateRiskScore(connectionRequest);

      expect(riskScore).toBeGreaterThanOrEqual(4); // Base + connection penalty
    });

    it('should calculate maximum risk for rate limit responses', () => {
      const rateLimitRequest = {
        userId: 'test-user',
        endpoint: '/v2/test',
        method: 'GET',
        statusCode: 429,
        responseTime: 100,
        success: false
      };

      const riskScore = (complianceService as any).calculateRiskScore(rateLimitRequest);

      expect(riskScore).toBe(10); // Should hit maximum
    });
  });
});