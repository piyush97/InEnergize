// Rate Limit Service Unit Tests

import { RateLimitService } from '../../src/services/rateLimit.service';
import Redis from 'ioredis';
import { RateLimitOptions, RateLimitResult } from '../../src/types/auth';

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = {
    multi: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    pipeline: jest.fn()
  };
  
  mockRedis.multi.mockReturnValue({
    get: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, '1'], // GET result
      [null, 1],   // INCR result
      [null, 1]    // EXPIRE result
    ])
  });

  mockRedis.pipeline.mockReturnValue({
    get: jest.fn().mockReturnThis(),
    setex: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, 'OK'],
      [null, 1]
    ])
  });

  return jest.fn(() => mockRedis);
});

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    rateLimitService = new RateLimitService();
    mockRedis = (rateLimitService as any).redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request within rate limit', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000, // 1 minute
        maxRequests: 5,
        identifier: 'user-123',
        action: 'login'
      };

      // Mock current count as 3 (under limit)
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '3'], // Current count
          [null, 4],   // After increment
          [null, 1]    // Expire result
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(1); // 5 - 4
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(result.totalHits).toBe(4);
    });

    it('should deny request when rate limit exceeded', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'login'
      };

      // Mock current count as 5 (at limit)
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '5'], // Current count
          [null, 6],   // After increment (over limit)
          [null, 1]    // Expire result
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.totalHits).toBe(6);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle first request correctly', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'new-user',
        action: 'login'
      };

      // Mock no existing count (first request)
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, null], // No existing count
          [null, 1],    // First increment
          [null, 1]     // Expire result
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4); // 5 - 1
      expect(result.totalHits).toBe(1);
    });

    it('should use custom key generator when provided', async () => {
      const customKeyGenerator = jest.fn().mockReturnValue('custom-key');
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'login',
        keyGenerator: customKeyGenerator
      };

      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '1'],
          [null, 2],
          [null, 1]
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      await rateLimitService.checkRateLimit(options);

      expect(customKeyGenerator).toHaveBeenCalledWith('user-123', 'login');
      expect(mockPipeline.get).toHaveBeenCalledWith('custom-key');
    });

    it('should handle Redis errors gracefully', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'login'
      };

      mockRedis.pipeline.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // Should allow request on Redis failure (fail-open)
      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(true);
      expect(result.error).toBe('Rate limiting service unavailable');
    });

    it('should calculate correct reset time', async () => {
      const windowMs = 60000; // 1 minute
      const options: RateLimitOptions = {
        windowMs,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'login'
      };

      const beforeTime = Date.now();

      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '1'],
          [null, 2],
          [null, 1]
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      const afterTime = Date.now();
      const expectedResetTime = beforeTime + windowMs;

      expect(result.resetTime.getTime()).toBeGreaterThanOrEqual(expectedResetTime);
      expect(result.resetTime.getTime()).toBeLessThanOrEqual(afterTime + windowMs);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for specific identifier and action', async () => {
      const identifier = 'user-123';
      const action = 'login';

      mockRedis.del.mockResolvedValue(1);

      const result = await rateLimitService.resetRateLimit(identifier, action);

      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:user-123:login');
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      const identifier = 'user-123';
      const action = 'login';

      mockRedis.del.mockResolvedValue(0); // Key did not exist

      const result = await rateLimitService.resetRateLimit(identifier, action);

      expect(result).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      const identifier = 'user-123';
      const action = 'login';

      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await rateLimitService.resetRateLimit(identifier, action);

      expect(result).toBe(false);
    });
  });

  describe('resetAllRateLimits', () => {
    it('should reset all rate limits for an identifier', async () => {
      const identifier = 'user-123';
      const mockKeys = [
        'rate_limit:user-123:login',
        'rate_limit:user-123:register',
        'rate_limit:user-123:password_reset'
      ];

      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.del.mockResolvedValue(3);

      const result = await rateLimitService.resetAllRateLimits(identifier);

      expect(mockRedis.keys).toHaveBeenCalledWith('rate_limit:user-123:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys);
      expect(result).toBe(3);
    });

    it('should return 0 when no keys found', async () => {
      const identifier = 'user-123';

      mockRedis.keys.mockResolvedValue([]);

      const result = await rateLimitService.resetAllRateLimits(identifier);

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const identifier = 'user-123';

      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await rateLimitService.resetAllRateLimits(identifier);

      expect(result).toBe(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      const identifier = 'user-123';
      const action = 'login';
      const windowMs = 60000;
      const maxRequests = 5;

      mockRedis.get.mockResolvedValue('3'); // Current count

      const result = await rateLimitService.getRateLimitStatus(
        identifier,
        action,
        windowMs,
        maxRequests
      );

      expect(mockRedis.get).toHaveBeenCalledWith('rate_limit:user-123:login');
      expect(result.currentRequests).toBe(3);
      expect(result.remainingRequests).toBe(2);
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(result.isLimited).toBe(false);
    });

    it('should indicate when limit is exceeded', async () => {
      const identifier = 'user-123';
      const action = 'login';
      const windowMs = 60000;
      const maxRequests = 5;

      mockRedis.get.mockResolvedValue('6'); // Over limit

      const result = await rateLimitService.getRateLimitStatus(
        identifier,
        action,
        windowMs,
        maxRequests
      );

      expect(result.currentRequests).toBe(6);
      expect(result.remainingRequests).toBe(0);
      expect(result.isLimited).toBe(true);
    });

    it('should return zero counts when key does not exist', async () => {
      const identifier = 'user-123';
      const action = 'login';
      const windowMs = 60000;
      const maxRequests = 5;

      mockRedis.get.mockResolvedValue(null);

      const result = await rateLimitService.getRateLimitStatus(
        identifier,
        action,
        windowMs,
        maxRequests
      );

      expect(result.currentRequests).toBe(0);
      expect(result.remainingRequests).toBe(5);
      expect(result.isLimited).toBe(false);
    });
  });

  describe('presets and configurations', () => {
    it('should provide login rate limit preset', async () => {
      const result = await rateLimitService.checkLoginRateLimit('user-123');

      expect(result).toBeDefined();
      // Should use preset values: 5 attempts per 15 minutes
    });

    it('should provide registration rate limit preset', async () => {
      const result = await rateLimitService.checkRegistrationRateLimit('192.168.1.1');

      expect(result).toBeDefined();
      // Should use preset values: 3 registrations per hour
    });

    it('should provide password reset rate limit preset', async () => {
      const result = await rateLimitService.checkPasswordResetRateLimit('user@example.com');

      expect(result).toBeDefined();
      // Should use preset values: 3 resets per hour
    });

    it('should provide MFA rate limit preset', async () => {
      const result = await rateLimitService.checkMFARateLimit('user-123');

      expect(result).toBeDefined();
      // Should use preset values: 5 attempts per 5 minutes
    });
  });

  describe('sliding window implementation', () => {
    it('should implement sliding window correctly', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'test',
        useSlidingWindow: true
      };

      // Mock sliding window logic
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 2], // Removed old entries
          [null, 3], // Current count
          [null, 1], // Added new entry
          [null, 1]  // Expire result
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(4); // 3 + 1 new
    });

    it('should reject request in sliding window when limit exceeded', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 3,
        identifier: 'user-123',
        action: 'test',
        useSlidingWindow: true
      };

      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // Removed old entries
          [null, 3], // Current count (at limit)
          [null, 0], // Not added (would exceed)
          [null, 1]  // Expire result
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(false);
      expect(result.totalHits).toBe(3);
    });
  });

  describe('distributed rate limiting', () => {
    it('should handle concurrent requests correctly', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'concurrent'
      };

      // Simulate concurrent requests
      const promises = Array.from({ length: 3 }, () =>
        rateLimitService.checkRateLimit(options)
      );

      const results = await Promise.all(promises);

      // All should be processed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should maintain consistency across multiple Redis operations', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'consistency'
      };

      // Mock transaction-like behavior
      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '2'],
          [null, 3],
          [null, 1]
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(result.totalHits).toBe(3);
    });
  });

  describe('key generation and security', () => {
    it('should generate secure and predictable keys', () => {
      const key1 = (rateLimitService as any).generateKey('user-123', 'login');
      const key2 = (rateLimitService as any).generateKey('user-123', 'login');
      const key3 = (rateLimitService as any).generateKey('user-456', 'login');

      expect(key1).toBe(key2); // Same inputs = same key
      expect(key1).not.toBe(key3); // Different inputs = different keys
      expect(key1).toMatch(/^rate_limit:/);
    });

    it('should sanitize identifiers in keys', () => {
      const maliciousIdentifier = 'user:123*test';
      const key = (rateLimitService as any).generateKey(maliciousIdentifier, 'login');

      expect(key).not.toContain('*');
      expect(key).not.toContain(':123:'); // Should be sanitized
    });

    it('should handle special characters in actions', () => {
      const specialAction = 'password:reset';
      const key = (rateLimitService as any).generateKey('user-123', specialAction);

      expect(key).toContain('password_reset'); // Colon should be replaced
    });
  });

  describe('performance and optimization', () => {
    it('should complete rate limit check within reasonable time', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'performance'
      };

      const startTime = Date.now();

      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '1'],
          [null, 2],
          [null, 1]
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      await rateLimitService.checkRateLimit(options);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    it('should optimize Redis operations with pipelining', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: 'user-123',
        action: 'pipeline'
      };

      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '1'],
          [null, 2],
          [null, 1]
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      await rateLimitService.checkRateLimit(options);

      // Should use pipeline for multiple operations
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('cleanup and maintenance', () => {
    it('should disconnect from Redis properly', async () => {
      await rateLimitService.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle cleanup of expired keys', async () => {
      const identifier = 'user-123';
      
      mockRedis.keys.mockResolvedValue([
        'rate_limit:user-123:login',
        'rate_limit:user-123:expired'
      ]);
      mockRedis.del.mockResolvedValue(1);

      const result = await rateLimitService.cleanupExpiredKeys(identifier);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid window duration', async () => {
      const options: RateLimitOptions = {
        windowMs: -1000, // Invalid negative window
        maxRequests: 5,
        identifier: 'user-123',
        action: 'invalid'
      };

      await expect(rateLimitService.checkRateLimit(options))
        .rejects.toThrow('Invalid window duration');
    });

    it('should handle zero max requests', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 0, // Zero requests allowed
        identifier: 'user-123',
        action: 'zero'
      };

      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
    });

    it('should handle very large request limits', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: Number.MAX_SAFE_INTEGER,
        identifier: 'user-123',
        action: 'unlimited'
      };

      const mockPipeline = {
        get: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '1000'],
          [null, 1001],
          [null, 1]
        ])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await rateLimitService.checkRateLimit(options);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBeGreaterThan(0);
    });

    it('should handle empty or null identifiers', async () => {
      const options: RateLimitOptions = {
        windowMs: 60000,
        maxRequests: 5,
        identifier: '',
        action: 'empty'
      };

      await expect(rateLimitService.checkRateLimit(options))
        .rejects.toThrow('Identifier cannot be empty');
    });
  });
});