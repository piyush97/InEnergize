// Connection Automation Service Unit Tests

import { LinkedInConnectionAutomationService } from '../../src/services/connectionAutomation.service';
import { LinkedInAPIService } from '../../src/services/api.service';
import { LinkedInComplianceService } from '../../src/services/compliance.service';
import { LinkedInRateLimitService } from '../../src/services/rateLimit.service';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis', () => {
  const mockRedis = {
    lpush: jest.fn().mockResolvedValue(1),
    brpop: jest.fn().mockResolvedValue(null),
    expire: jest.fn().mockResolvedValue(1),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(0),
    incrby: jest.fn().mockResolvedValue(1),
    llen: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  return jest.fn(() => mockRedis);
});

jest.mock('../../src/services/api.service');
jest.mock('../../src/services/compliance.service');
jest.mock('../../src/services/rateLimit.service');

describe('LinkedInConnectionAutomationService', () => {
  let connectionService: LinkedInConnectionAutomationService;
  let mockApiService: jest.Mocked<LinkedInAPIService>;
  let mockComplianceService: jest.Mocked<LinkedInComplianceService>;
  let mockRateLimitService: jest.Mocked<LinkedInRateLimitService>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Set environment variables
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    // Create mock services
    mockApiService = new LinkedInAPIService() as jest.Mocked<LinkedInAPIService>;
    mockComplianceService = new LinkedInComplianceService() as jest.Mocked<LinkedInComplianceService>;
    mockRateLimitService = new LinkedInRateLimitService() as jest.Mocked<LinkedInRateLimitService>;

    connectionService = new LinkedInConnectionAutomationService(
      mockApiService,
      mockComplianceService,
      mockRateLimitService
    );

    mockRedis = (connectionService as any).redis;

    // Mock timers to prevent actual delays in tests
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('scheduleConnectionRequest', () => {
    const mockUserId = 'user-123';
    const mockTargetProfileId = 'target-456';

    beforeEach(() => {
      // Mock compliance validation to allow by default
      mockComplianceService.validateRequest.mockResolvedValue({
        allowed: true,
        reason: undefined,
        retryAfter: undefined
      });

      // Mock account health check
      mockComplianceService.performAccountHealthCheck.mockResolvedValue({
        overall: 'HEALTHY',
        score: 85,
        riskLevel: 'LOW',
        warnings: [],
        restrictions: [],
        recommendations: []
      });

      // Mock daily count to be under limit
      mockRedis.get.mockResolvedValue('5'); // 5 connections sent today
      mockRedis.exists.mockResolvedValue(0); // No recent contact
    });

    it('should schedule connection request successfully', async () => {
      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId,
        {
          message: 'Hello, I would like to connect!',
          priority: 'normal'
        }
      );

      expect(result.success).toBe(true);
      expect(result.requestId).toBeDefined();
      expect(result.requestId).toMatch(/^conn_user-123_\d+_[a-z0-9]+$/);

      // Verify Redis operations
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'connections:normal',
        expect.stringContaining(mockUserId)
      );
      expect(mockRedis.expire).toHaveBeenCalled();
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringMatching(/connections:daily:user-123:\d{4}-\d{2}-\d{2}/),
        1
      );
    });

    it('should reject request when compliance validation fails', async () => {
      mockComplianceService.validateRequest.mockResolvedValue({
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: 3600
      });

      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
      expect(result.retryAfter).toBe(3600);
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    it('should reject request when daily limit reached', async () => {
      // Mock daily count to be at limit
      mockRedis.get.mockResolvedValue('15'); // At daily limit

      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Daily connection limit reached');
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    it('should reject request when profile was recently contacted', async () => {
      mockRedis.exists.mockResolvedValue(1); // Recent contact exists

      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Profile contacted recently (within 30 days)');
      expect(result.retryAfter).toBe(30 * 24 * 60 * 60);
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    it('should reject request when account health is critical', async () => {
      mockComplianceService.performAccountHealthCheck.mockResolvedValue({
        overall: 'CRITICAL',
        score: 30,
        riskLevel: 'CRITICAL',
        warnings: ['Multiple failed requests'],
        restrictions: ['Automation suspended'],
        recommendations: ['Contact support']
      });

      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Account health critical - automation suspended');
      expect(result.retryAfter).toBe(24 * 60 * 60);
    });

    it('should reject request when account health is at risk', async () => {
      mockComplianceService.performAccountHealthCheck.mockResolvedValue({
        overall: 'AT_RISK',
        score: 65,
        riskLevel: 'MEDIUM',
        warnings: ['High failure rate'],
        restrictions: [],
        recommendations: ['Reduce automation frequency']
      });

      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Account health at risk - reduce automation');
      expect(result.retryAfter).toBe(4 * 60 * 60);
    });

    it('should schedule with high priority', async () => {
      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId,
        { priority: 'high' }
      );

      expect(result.success).toBe(true);
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'connections:high',
        expect.any(String)
      );
    });

    it('should schedule with template ID', async () => {
      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId,
        {
          templateId: 'template-123',
          scheduledAt: new Date('2024-01-01T12:00:00Z')
        }
      );

      expect(result.success).toBe(true);
      
      const queuedData = JSON.parse(mockRedis.lpush.mock.calls[0][1]);
      expect(queuedData.templateId).toBe('template-123');
      expect(queuedData.scheduledAt).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should handle errors gracefully', async () => {
      mockComplianceService.validateRequest.mockRejectedValue(new Error('Database error'));

      const result = await connectionService.scheduleConnectionRequest(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Internal error scheduling connection request');
    });
  });

  describe('getConnectionStats', () => {
    const mockUserId = 'user-123';

    beforeEach(() => {
      // Mock compliance metrics
      mockComplianceService.getComplianceMetrics.mockResolvedValue({
        requestsLast24h: 10,
        requestsLastHour: 2,
        successRate: 95,
        rateLimitHits: 0,
        accountHealth: {
          score: 85,
          riskLevel: 'LOW',
          warnings: [],
          restrictions: [],
          recommendations: []
        },
        safetyMetrics: {
          humanLikeScore: 90,
          patternDetected: false,
          suspiciousActivity: false
        }
      });
    });

    it('should return connection statistics', async () => {
      mockRedis.get.mockResolvedValue('8'); // Daily count
      mockRedis.llen.mockResolvedValue(5); // Pending requests

      const stats = await connectionService.getConnectionStats(mockUserId);

      expect(stats).toEqual({
        today: {
          sent: 8,
          pending: 15, // 5 * 3 queues (simplified)
          failed: 0,
          remaining: 7 // 15 - 8
        },
        thisWeek: {
          sent: 0,
          pending: 15,
          failed: 0
        },
        accountHealth: {
          score: 85,
          status: 'LOW',
          warnings: []
        }
      });
    });

    it('should handle zero remaining connections', async () => {
      mockRedis.get.mockResolvedValue('15'); // Daily limit reached
      mockRedis.llen.mockResolvedValue(0);

      const stats = await connectionService.getConnectionStats(mockUserId);

      expect(stats.today.remaining).toBe(0);
      expect(stats.today.sent).toBe(15);
    });

    it('should handle compliance service errors', async () => {
      mockComplianceService.getComplianceMetrics.mockRejectedValue(new Error('Service unavailable'));
      mockRedis.get.mockResolvedValue('5');
      mockRedis.llen.mockResolvedValue(0);

      await expect(connectionService.getConnectionStats(mockUserId))
        .rejects.toThrow('Service unavailable');
    });
  });

  describe('cancelConnectionRequest', () => {
    const mockUserId = 'user-123';
    const mockRequestId = 'conn_user-123_1640995200000_abc123';

    it('should cancel pending connection request successfully', async () => {
      const mockConnectionRequest = {
        id: mockRequestId,
        userId: mockUserId,
        targetProfileId: 'target-456',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockConnectionRequest));

      const result = await connectionService.cancelConnectionRequest(mockUserId, mockRequestId);

      expect(result.success).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `connection:${mockRequestId}`,
        7 * 24 * 60 * 60,
        expect.stringContaining('"status":"cancelled"')
      );
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringMatching(/connections:daily:user-123:\d{4}-\d{2}-\d{2}/),
        -1
      );
    });

    it('should reject cancellation of non-existent request', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await connectionService.cancelConnectionRequest(mockUserId, mockRequestId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Connection request not found');
    });

    it('should reject cancellation by unauthorized user', async () => {
      const mockConnectionRequest = {
        id: mockRequestId,
        userId: 'different-user',
        targetProfileId: 'target-456',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockConnectionRequest));

      const result = await connectionService.cancelConnectionRequest(mockUserId, mockRequestId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Unauthorized');
    });

    it('should reject cancellation of non-pending request', async () => {
      const mockConnectionRequest = {
        id: mockRequestId,
        userId: mockUserId,
        targetProfileId: 'target-456',
        status: 'sent',
        createdAt: new Date().toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockConnectionRequest));

      const result = await connectionService.cancelConnectionRequest(mockUserId, mockRequestId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Cannot cancel request with status: sent');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await connectionService.cancelConnectionRequest(mockUserId, mockRequestId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Internal error');
    });
  });

  describe('safety mechanisms', () => {
    it('should enforce minimum delay between requests', () => {
      const delay = (connectionService as any).generateHumanLikeDelay();

      expect(delay).toBeGreaterThanOrEqual(45000); // 45 seconds minimum
      expect(delay).toBeLessThanOrEqual(180000); // 3 minutes maximum
    });

    it('should identify permanent errors correctly', () => {
      const isPermanent1 = (connectionService as any).isPermanentError('Permission denied - account restricted');
      const isPermanent2 = (connectionService as any).isPermanentError('Already connected to this profile');
      const isTemporary = (connectionService as any).isPermanentError('Network timeout');

      expect(isPermanent1).toBe(true);
      expect(isPermanent2).toBe(true);
      expect(isTemporary).toBe(false);
    });

    it('should calculate seconds until midnight correctly', () => {
      // Mock current time to 10 PM
      const mockDate = new Date('2024-01-01T22:00:00Z');
      jest.spyOn(Date.prototype, 'getTime').mockReturnValue(mockDate.getTime());

      const secondsUntilMidnight = (connectionService as any).getSecondsUntilMidnight();

      expect(secondsUntilMidnight).toBe(2 * 60 * 60); // 2 hours = 7200 seconds
    });

    it('should get correct queue key for different priorities', () => {
      expect((connectionService as any).getQueueKey('high')).toBe('connections:high');
      expect((connectionService as any).getQueueKey('normal')).toBe('connections:normal');
      expect((connectionService as any).getQueueKey('low')).toBe('connections:low');
    });
  });

  describe('template and personalization', () => {
    it('should render template with profile data', () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Networking Template',
        message: 'Hi {firstName}, I noticed you work at {company}. Would love to connect!',
        variables: ['firstName', 'company'],
        category: 'networking' as const,
        enabled: true
      };

      const mockProfileData = {
        firstName: 'John',
        company: 'Tech Corp',
        jobTitle: 'Software Engineer'
      };

      const renderedMessage = (connectionService as any).renderTemplate(mockTemplate, mockProfileData);

      expect(renderedMessage).toBe('Hi John, I noticed you work at Tech Corp. Would love to connect!');
    });

    it('should handle missing template variables', () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Networking Template',
        message: 'Hi {firstName}, I see you are in {industry}.',
        variables: ['firstName', 'industry'],
        category: 'networking' as const,
        enabled: true
      };

      const mockProfileData = {
        firstName: 'John'
        // Missing industry
      };

      const renderedMessage = (connectionService as any).renderTemplate(mockTemplate, mockProfileData);

      expect(renderedMessage).toBe('Hi John, I see you are in [industry].');
    });
  });

  describe('event emission', () => {
    it('should emit connectionScheduled event', async () => {
      const mockUserId = 'user-123';
      const mockTargetProfileId = 'target-456';

      // Mock all validation to pass
      mockComplianceService.validateRequest.mockResolvedValue({ allowed: true });
      mockComplianceService.performAccountHealthCheck.mockResolvedValue({
        overall: 'HEALTHY',
        score: 85
      } as any);
      mockRedis.get.mockResolvedValue('5');
      mockRedis.exists.mockResolvedValue(0);

      const eventSpy = jest.fn();
      connectionService.on('connectionScheduled', eventSpy);

      await connectionService.scheduleConnectionRequest(mockUserId, mockTargetProfileId);

      expect(eventSpy).toHaveBeenCalledWith({
        userId: mockUserId,
        requestId: expect.stringMatching(/^conn_user-123_\d+_[a-z0-9]+$/),
        targetProfileId: mockTargetProfileId
      });
    });

    it('should emit connectionCancelled event', async () => {
      const mockUserId = 'user-123';
      const mockRequestId = 'conn_user-123_1640995200000_abc123';

      const mockConnectionRequest = {
        id: mockRequestId,
        userId: mockUserId,
        targetProfileId: 'target-456',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockConnectionRequest));

      const eventSpy = jest.fn();
      connectionService.on('connectionCancelled', eventSpy);

      await connectionService.cancelConnectionRequest(mockUserId, mockRequestId);

      expect(eventSpy).toHaveBeenCalledWith({
        requestId: mockRequestId,
        userId: mockUserId
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup Redis connection', async () => {
      await connectionService.cleanup();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors in scheduleConnectionRequest', async () => {
      mockComplianceService.validateRequest.mockResolvedValue({ allowed: true });
      mockComplianceService.performAccountHealthCheck.mockResolvedValue({
        overall: 'HEALTHY',
        score: 85
      } as any);

      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await connectionService.scheduleConnectionRequest('user-123', 'target-456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Internal error scheduling connection request');
    });

    it('should handle malformed JSON in Redis', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await connectionService.cancelConnectionRequest('user-123', 'request-123');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Internal error');
    });
  });
});