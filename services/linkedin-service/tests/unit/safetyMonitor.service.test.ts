// Safety Monitor Service Unit Tests

import { LinkedInSafetyMonitorService } from '../../src/services/safetyMonitor.service';
import { LinkedInRateLimitService } from '../../src/services/rateLimit.service';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    incrby: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    zadd: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    zcount: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue('OK'),
    pipeline: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnThis(),
      setex: jest.fn().mockReturnThis(),
      incr: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([['OK'], [1], [1]])
    })
  };
  return jest.fn(() => mockRedis);
});

jest.mock('../../src/services/rateLimit.service');

describe('LinkedInSafetyMonitorService', () => {
  let safetyService: LinkedInSafetyMonitorService;
  let mockRateLimitService: jest.Mocked<LinkedInRateLimitService>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRateLimitService = new LinkedInRateLimitService() as jest.Mocked<LinkedInRateLimitService>;
    safetyService = new LinkedInSafetyMonitorService(mockRateLimitService);
    mockRedis = (safetyService as any).redis;

    // Mock current time for consistent testing
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('performHealthCheck', () => {
    it('should return healthy status for good metrics', async () => {
      const userId = 'user-123';

      // Mock healthy metrics
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '10',
        'connections_success_24h': '9',
        'connections_failed_24h': '1',
        'likes_sent_24h': '25',
        'likes_failed_24h': '0',
        'profile_views_24h': '15',
        'last_connection_time': String(Date.now() - 7200000), // 2 hours ago
        'last_like_time': String(Date.now() - 3600000), // 1 hour ago
        'account_warnings': '0',
        'rate_limit_hits': '0'
      });

      mockRedis.zcount.mockResolvedValue(2); // 2 failed requests in last 24h

      const result = await safetyService.performHealthCheck(userId);

      expect(result.overall).toBe('HEALTHY');
      expect(result.score).toBeGreaterThan(80);
      expect(result.riskLevel).toBe('LOW');
      expect(result.warnings).toHaveLength(0);
      expect(result.restrictions).toHaveLength(0);
    });

    it('should return at-risk status for moderate issues', async () => {
      const userId = 'user-123';

      // Mock at-risk metrics
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '14',
        'connections_success_24h': '10',
        'connections_failed_24h': '4',
        'likes_sent_24h': '35',
        'likes_failed_24h': '5',
        'profile_views_24h': '25',
        'last_connection_time': String(Date.now() - 1800000), // 30 minutes ago
        'last_like_time': String(Date.now() - 900000), // 15 minutes ago
        'account_warnings': '1',
        'rate_limit_hits': '2'
      });

      mockRedis.zcount.mockResolvedValue(8); // 8 failed requests in last 24h

      const result = await safetyService.performHealthCheck(userId);

      expect(result.overall).toBe('AT_RISK');
      expect(result.score).toBeLessThan(80);
      expect(result.score).toBeGreaterThan(40);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should return critical status for severe issues', async () => {
      const userId = 'user-123';

      // Mock critical metrics
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '15',
        'connections_success_24h': '5',
        'connections_failed_24h': '10',
        'likes_sent_24h': '45',
        'likes_failed_24h': '15',
        'profile_views_24h': '30',
        'last_connection_time': String(Date.now() - 300000), // 5 minutes ago
        'last_like_time': String(Date.now() - 180000), // 3 minutes ago
        'account_warnings': '3',
        'rate_limit_hits': '5'
      });

      mockRedis.zcount.mockResolvedValue(15); // 15 failed requests in last 24h

      const result = await safetyService.performHealthCheck(userId);

      expect(result.overall).toBe('CRITICAL');
      expect(result.score).toBeLessThan(40);
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.warnings.length).toBeGreaterThan(2);
      expect(result.restrictions.length).toBeGreaterThan(0);
    });

    it('should detect bot-like behavior patterns', async () => {
      const userId = 'user-123';

      // Mock bot-like patterns: too frequent, too consistent
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '15',
        'connections_success_24h': '15',
        'connections_failed_24h': '0',
        'likes_sent_24h': '50', // Over limit
        'likes_failed_24h': '0',
        'profile_views_24h': '25',
        'last_connection_time': String(Date.now() - 45000), // 45 seconds ago (too frequent)
        'last_like_time': String(Date.now() - 30000), // 30 seconds ago (too frequent)
        'account_warnings': '0',
        'rate_limit_hits': '0'
      });

      mockRedis.zcount.mockResolvedValue(0);

      const result = await safetyService.performHealthCheck(userId);

      expect(result.warnings).toContain('Bot-like behavior detected - too frequent activity');
      expect(result.warnings).toContain('Daily limit exceeded for likes');
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should handle Redis errors gracefully', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockRejectedValue(new Error('Redis connection failed'));

      const result = await safetyService.performHealthCheck(userId);

      expect(result.overall).toBe('UNKNOWN');
      expect(result.score).toBe(0);
      expect(result.warnings).toContain('Unable to assess account health');
    });
  });

  describe('recordSuccess', () => {
    it('should record connection success', async () => {
      const userId = 'user-123';
      const action = 'connection';

      await safetyService.recordSuccess(userId, action);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'connections_success_24h',
        expect.any(Number)
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'last_connection_time',
        String(Date.now())
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(`safety:${userId}`, 86400);
    });

    it('should record like success', async () => {
      const userId = 'user-123';
      const action = 'like';

      await safetyService.recordSuccess(userId, action);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'likes_success_24h',
        expect.any(Number)
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'last_like_time',
        String(Date.now())
      );
    });

    it('should record comment success', async () => {
      const userId = 'user-123';
      const action = 'comment';

      await safetyService.recordSuccess(userId, action);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'comments_success_24h',
        expect.any(Number)
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'last_comment_time',
        String(Date.now())
      );
    });

    it('should handle unknown action types', async () => {
      const userId = 'user-123';
      const action = 'unknown';

      await expect(safetyService.recordSuccess(userId, action))
        .rejects.toThrow('Unknown action type');
    });
  });

  describe('recordFailure', () => {
    it('should record connection failure with reason', async () => {
      const userId = 'user-123';
      const action = 'connection';
      const reason = 'Rate limit exceeded';

      await safetyService.recordFailure(userId, action, reason);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'connections_failed_24h',
        expect.any(Number)
      );
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `failures:${userId}`,
        Date.now(),
        expect.stringContaining(reason)
      );
    });

    it('should increment account warnings for security violations', async () => {
      const userId = 'user-123';
      const action = 'connection';
      const reason = 'Account restricted by LinkedIn';

      await safetyService.recordFailure(userId, action, reason);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'account_warnings',
        expect.any(Number)
      );
    });

    it('should increment rate limit hits for rate limit errors', async () => {
      const userId = 'user-123';
      const action = 'like';
      const reason = 'Rate limit exceeded';

      await safetyService.recordFailure(userId, action, reason);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        `safety:${userId}`,
        'rate_limit_hits',
        expect.any(Number)
      );
    });

    it('should handle network errors appropriately', async () => {
      const userId = 'user-123';
      const action = 'connection';
      const reason = 'Network timeout';

      await safetyService.recordFailure(userId, action, reason);

      // Network errors shouldn't increment warnings
      expect(mockRedis.hset).not.toHaveBeenCalledWith(
        `safety:${userId}`,
        'account_warnings',
        expect.any(Number)
      );
    });
  });

  describe('isActionAllowed', () => {
    it('should allow action for healthy account', async () => {
      const userId = 'user-123';
      const action = 'connection';

      // Mock healthy metrics
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '10',
        'connections_failed_24h': '1',
        'account_warnings': '0'
      });

      const result = await safetyService.isActionAllowed(userId, action);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block action when daily limit exceeded', async () => {
      const userId = 'user-123';
      const action = 'connection';

      // Mock over-limit metrics
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '16', // Over daily limit of 15
        'connections_failed_24h': '1',
        'account_warnings': '0'
      });

      const result = await safetyService.isActionAllowed(userId, action);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily connection limit exceeded');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should block action when failure rate is too high', async () => {
      const userId = 'user-123';
      const action = 'connection';

      // Mock high failure rate
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '10',
        'connections_success_24h': '5',
        'connections_failed_24h': '5', // 50% failure rate
        'account_warnings': '0'
      });

      const result = await safetyService.isActionAllowed(userId, action);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('High failure rate detected - automation paused');
    });

    it('should block action when account has warnings', async () => {
      const userId = 'user-123';
      const action = 'connection';

      // Mock account with warnings
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '5',
        'connections_failed_24h': '0',
        'account_warnings': '3' // Multiple warnings
      });

      const result = await safetyService.isActionAllowed(userId, action);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Account has multiple warnings - automation suspended');
    });

    it('should enforce minimum time between actions', async () => {
      const userId = 'user-123';
      const action = 'connection';

      // Mock recent activity
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '5',
        'connections_failed_24h': '0',
        'account_warnings': '0',
        'last_connection_time': String(Date.now() - 30000) // 30 seconds ago (too recent)
      });

      const result = await safetyService.isActionAllowed(userId, action);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Minimum time between connections not met');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should allow action after sufficient cool-down period', async () => {
      const userId = 'user-123';
      const action = 'connection';

      // Mock activity with sufficient gap
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '10',
        'connections_failed_24h': '1',
        'account_warnings': '0',
        'last_connection_time': String(Date.now() - 120000) // 2 minutes ago (sufficient)
      });

      const result = await safetyService.isActionAllowed(userId, action);

      expect(result.allowed).toBe(true);
    });
  });

  describe('getHumanLikeDelay', () => {
    it('should return appropriate delay for connections', () => {
      const action = 'connection';
      const delay = safetyService.getHumanLikeDelay(action);

      expect(delay).toBeGreaterThanOrEqual(45000); // 45 seconds minimum
      expect(delay).toBeLessThanOrEqual(180000); // 3 minutes maximum
    });

    it('should return appropriate delay for likes', () => {
      const action = 'like';
      const delay = safetyService.getHumanLikeDelay(action);

      expect(delay).toBeGreaterThanOrEqual(60000); // 1 minute minimum
      expect(delay).toBeLessThanOrEqual(300000); // 5 minutes maximum
    });

    it('should return appropriate delay for comments', () => {
      const action = 'comment';
      const delay = safetyService.getHumanLikeDelay(action);

      expect(delay).toBeGreaterThanOrEqual(120000); // 2 minutes minimum
      expect(delay).toBeLessThanOrEqual(600000); // 10 minutes maximum
    });

    it('should return different delays on subsequent calls', () => {
      const action = 'connection';
      const delay1 = safetyService.getHumanLikeDelay(action);
      const delay2 = safetyService.getHumanLikeDelay(action);

      // Should be randomized
      expect(delay1).not.toBe(delay2);
    });

    it('should handle unknown action types', () => {
      const action = 'unknown';
      
      expect(() => safetyService.getHumanLikeDelay(action))
        .toThrow('Unknown action type');
    });
  });

  describe('getSafetyMetrics', () => {
    it('should return comprehensive safety metrics', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '12',
        'connections_success_24h': '10',
        'connections_failed_24h': '2',
        'likes_sent_24h': '25',
        'likes_success_24h': '24',
        'likes_failed_24h': '1',
        'account_warnings': '1',
        'rate_limit_hits': '0'
      });

      mockRedis.zcount.mockResolvedValue(3); // Recent failures

      const metrics = await safetyService.getSafetyMetrics(userId);

      expect(metrics).toEqual({
        requestsLast24h: 37, // 12 + 25
        requestsLastHour: expect.any(Number),
        successRate: expect.any(Number),
        rateLimitHits: 0,
        accountHealth: expect.objectContaining({
          score: expect.any(Number),
          riskLevel: expect.any(String),
          warnings: expect.any(Array),
          restrictions: expect.any(Array),
          recommendations: expect.any(Array)
        }),
        safetyMetrics: expect.objectContaining({
          humanLikeScore: expect.any(Number),
          patternDetected: expect.any(Boolean),
          suspiciousActivity: expect.any(Boolean)
        })
      });
    });

    it('should calculate success rate correctly', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '10',
        'connections_success_24h': '8',
        'connections_failed_24h': '2',
        'likes_sent_24h': '20',
        'likes_success_24h': '19',
        'likes_failed_24h': '1'
      });

      mockRedis.zcount.mockResolvedValue(0);

      const metrics = await safetyService.getSafetyMetrics(userId);

      expect(metrics.successRate).toBe(90); // 27 success / 30 total * 100
    });

    it('should handle zero requests gracefully', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.zcount.mockResolvedValue(0);

      const metrics = await safetyService.getSafetyMetrics(userId);

      expect(metrics.requestsLast24h).toBe(0);
      expect(metrics.successRate).toBe(100); // Default to 100% if no requests
    });
  });

  describe('resetSafetyData', () => {
    it('should reset all safety data for user', async () => {
      const userId = 'user-123';

      await safetyService.resetSafetyData(userId);

      expect(mockRedis.del).toHaveBeenCalledWith(`safety:${userId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`failures:${userId}`);
    });

    it('should return true when data was deleted', async () => {
      const userId = 'user-123';

      mockRedis.del.mockResolvedValue(2); // 2 keys deleted

      const result = await safetyService.resetSafetyData(userId);

      expect(result).toBe(true);
    });

    it('should return false when no data existed', async () => {
      const userId = 'user-123';

      mockRedis.del.mockResolvedValue(0); // No keys deleted

      const result = await safetyService.resetSafetyData(userId);

      expect(result).toBe(false);
    });
  });

  describe('compliance and safety patterns', () => {
    it('should detect weekend activity patterns', async () => {
      const userId = 'user-123';

      // Mock weekend detection (assuming Saturday)
      jest.spyOn(Date.prototype, 'getDay').mockReturnValue(6); // Saturday

      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '15', // Full weekday limit on weekend
        'connections_success_24h': '15',
        'connections_failed_24h': '0'
      });

      const result = await safetyService.performHealthCheck(userId);

      expect(result.warnings).toContain('High activity on weekend detected');
    });

    it('should detect night-time activity patterns', async () => {
      const userId = 'user-123';

      // Mock night time activity (2 AM)
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(2);

      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '10',
        'last_connection_time': String(Date.now() - 300000), // 5 minutes ago
        'last_like_time': String(Date.now() - 600000) // 10 minutes ago
      });

      const result = await safetyService.performHealthCheck(userId);

      expect(result.warnings).toContain('Unusual activity hours detected');
    });

    it('should calculate human-like score based on behavior patterns', async () => {
      const userId = 'user-123';

      // Mock good human-like behavior
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '8',
        'connections_success_24h': '7',
        'connections_failed_24h': '1',
        'likes_sent_24h': '15',
        'likes_success_24h': '15',
        'likes_failed_24h': '0',
        'last_connection_time': String(Date.now() - 7200000), // 2 hours ago
        'last_like_time': String(Date.now() - 3600000) // 1 hour ago
      });

      const metrics = await safetyService.getSafetyMetrics(userId);

      expect(metrics.safetyMetrics.humanLikeScore).toBeGreaterThan(80);
      expect(metrics.safetyMetrics.patternDetected).toBe(false);
      expect(metrics.safetyMetrics.suspiciousActivity).toBe(false);
    });

    it('should detect suspicious activity patterns', async () => {
      const userId = 'user-123';

      // Mock suspicious patterns: too perfect, too fast
      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '15',
        'connections_success_24h': '15', // 100% success rate (suspicious)
        'connections_failed_24h': '0',
        'likes_sent_24h': '50', // Over limit
        'likes_success_24h': '50',
        'likes_failed_24h': '0',
        'last_connection_time': String(Date.now() - 45000), // 45 seconds ago (too frequent)
        'last_like_time': String(Date.now() - 30000) // 30 seconds ago (too frequent)
      });

      const metrics = await safetyService.getSafetyMetrics(userId);

      expect(metrics.safetyMetrics.humanLikeScore).toBeLessThan(50);
      expect(metrics.safetyMetrics.patternDetected).toBe(true);
      expect(metrics.safetyMetrics.suspiciousActivity).toBe(true);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle Redis connection failures gracefully', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockRejectedValue(new Error('Redis connection failed'));

      const result = await safetyService.isActionAllowed(userId, 'connection');

      // Should fail-safe: deny action on Redis failure
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Safety check failed');
    });

    it('should handle malformed data in Redis', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': 'invalid-number',
        'connections_failed_24h': 'also-invalid'
      });

      const result = await safetyService.performHealthCheck(userId);

      expect(result.overall).toBe('UNKNOWN');
      expect(result.warnings).toContain('Data corruption detected');
    });

    it('should handle very large numbers gracefully', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': String(Number.MAX_SAFE_INTEGER),
        'connections_success_24h': String(Number.MAX_SAFE_INTEGER)
      });

      const result = await safetyService.performHealthCheck(userId);

      expect(result.overall).toBe('CRITICAL');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle concurrent safety checks', async () => {
      const userId = 'user-123';

      mockRedis.hgetall.mockResolvedValue({
        'connections_sent_24h': '5',
        'connections_failed_24h': '0'
      });

      // Run multiple concurrent checks
      const promises = Array.from({ length: 5 }, () =>
        safetyService.performHealthCheck(userId)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.overall).toBeDefined();
      });
    });
  });

  describe('cleanup and maintenance', () => {
    it('should cleanup Redis connection', async () => {
      await safetyService.cleanup();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should cleanup expired failure records', async () => {
      const userId = 'user-123';
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

      await safetyService.cleanupExpiredData(userId);

      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        `failures:${userId}`,
        0,
        cutoffTime
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const userId = 'user-123';

      mockRedis.zremrangebyscore.mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(safetyService.cleanupExpiredData(userId))
        .resolves.not.toThrow();
    });
  });
});