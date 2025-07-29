// Rate Limit Service Unit Tests

import { LinkedInRateLimitService } from '../../services/rateLimit.service';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('LinkedInRateLimitService', () => {
  let rateLimitService: LinkedInRateLimitService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    const mockPipeline = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]])
    };
    
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      lpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK')
    } as any;
    
    rateLimitService = new LinkedInRateLimitService();
    // Inject mocked Redis instance
    (rateLimitService as any).redis = mockRedis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const userId = 'user-123';
      // Mock Redis get calls to return different values for different keys
      // The service calculates remaining as Math.min(hourlyRemaining, dailyRemaining, globalHourlyRemaining, globalDailyRemaining, burstRemaining)
      // For /v2/me endpoint: hourly=50, daily=500, globalHourly=200, globalDaily=1000, burst=5
      mockRedis.get.mockImplementation((key: any) => {
        const keyStr = key.toString();
        if (keyStr.includes('burst')) {
          return Promise.resolve('2'); // burst usage (5-2=3 remaining)
        }
        if (keyStr.includes('global')) {
          return Promise.resolve('10'); // global usage (200-10=190 hourly, 1000-10=990 daily remaining)
        }
        return Promise.resolve('5'); // endpoint usage (50-5=45 hourly, 500-5=495 daily remaining)
      });
      mockRedis.ttl.mockResolvedValue(1800); // 30 minutes remaining

      const result = await rateLimitService.checkRateLimit(userId, '/v2/me');

      expect(result.endpoint).toBe('/v2/me');
      expect(result.remaining).toBe(3); // Should be minimum of all limits (burst limit is lowest)
      expect(result.resetTime).toBeDefined();
    });

    it('should deny requests when rate limit exceeded', async () => {
      const userId = 'user-123';
      // Mock Redis get calls to exceed burst limit
      mockRedis.get.mockImplementation((key: any) => {
        const keyStr = key.toString();
        if (keyStr.includes('burst')) {
          return Promise.resolve('5'); // Max burst usage reached
        }
        return Promise.resolve('10'); // Normal usage for other keys
      });
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await rateLimitService.checkRateLimit(userId, '/v2/me');

      expect(result.endpoint).toBe('/v2/me');
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should handle different endpoint types', async () => {
      const userId = 'user-123';
      // Mock Redis get calls with reasonable usage
      // For /v2/people endpoint: hourly=50, daily=500, globalHourly=200, globalDaily=1000, burst=5
      mockRedis.get.mockImplementation((key: any) => {
        const keyStr = key.toString();
        if (keyStr.includes('burst')) {
          return Promise.resolve('1'); // burst usage (5-1=4 remaining)
        }
        if (keyStr.includes('global')) {
          return Promise.resolve('15'); // global usage (200-15=185 hourly, 1000-15=985 daily remaining)
        }
        return Promise.resolve('15'); // endpoint usage (50-15=35 hourly, 500-15=485 daily remaining)
      });
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await rateLimitService.checkRateLimit(userId, '/v2/people');

      expect(result.endpoint).toBe('/v2/people');
      expect(result.remaining).toBe(4); // Should be minimum of all limits (burst limit is lowest)
    });

    it('should handle Redis connection errors', async () => {
      const userId = 'user-123';
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(rateLimitService.checkRateLimit(userId, '/v2/me'))
        .rejects.toThrow('Redis connection failed');
    });
  });

  describe('recordRequest', () => {
    it('should record successful request', async () => {
      const userId = 'user-123';
      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);
      mockRedis.lpush.mockResolvedValue(1);

      await rateLimitService.recordRequest(userId, '/v2/me', true);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalled();
    });

    it('should record failed request', async () => {
      const userId = 'user-123'; 
      const mockPipeline = {
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(), 
        exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]])
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.lpush.mockResolvedValue(1);

      await rateLimitService.recordRequest(userId, '/v2/me', false);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      const userId = 'user-123';
      mockRedis.pipeline.mockImplementation(() => {
        throw new Error('Redis error');
      });

      await expect(rateLimitService.recordRequest(userId, '/v2/me', true))
        .rejects.toThrow('Redis error');
    });
  });

  describe('getUsageStatistics', () => {
    it('should return usage statistics for user', async () => {
      const userId = 'user-123';
      mockRedis.get.mockResolvedValue('15');
      mockRedis.ttl.mockResolvedValue(3600);

      const stats = await rateLimitService.getUsageStatistics(userId);

      expect(stats).toHaveProperty('endpoints');
      expect(stats).toHaveProperty('global');
      expect(Array.isArray(stats.endpoints)).toBe(true);
    });

    it('should handle Redis errors', async () => {
      const userId = 'user-123';
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      await expect(rateLimitService.getUsageStatistics(userId))
        .rejects.toThrow('Redis error');
    });
  });

  describe('resetUserRateLimits', () => {
    it('should reset all user rate limits', async () => {
      const userId = 'user-123';
      mockRedis.del.mockResolvedValue(1);
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);

      await rateLimitService.resetUserRateLimits(userId);

      expect(mockRedis.keys).toHaveBeenCalled();
    });

    it('should handle reset errors', async () => {
      const userId = 'user-123';
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      await expect(rateLimitService.resetUserRateLimits(userId))
        .rejects.toThrow('Redis error');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);

      const health = await rateLimitService.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(health.details).toHaveProperty('redisConnected');
    });

    it('should detect unhealthy Redis connection', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const health = await rateLimitService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.details.redisConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await rateLimitService.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle disconnect errors', async () => {
      mockRedis.quit.mockRejectedValue(new Error('Disconnect failed'));

      await expect(rateLimitService.disconnect())
        .rejects.toThrow('Disconnect failed');
    });
  });
});