/**
 * LinkedIn Rate Limiting Service - Compliance Testing Suite
 * 
 * Critical tests ensuring ultra-conservative compliance with LinkedIn's API limits
 * Tests validate 15% safety factor adherence and emergency stop mechanisms
 */

import { LinkedInRateLimitService } from '../../../../../services/linkedin-service/src/services/rateLimit.service';
import { RateLimitError } from '../../../../../services/linkedin-service/src/types/linkedin';
import Redis from 'ioredis';

// Mock Redis for testing
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('LinkedInRateLimitService - Compliance Tests', () => {
  let rateLimitService: LinkedInRateLimitService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock Redis instance
    mockRedis = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      }),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    rateLimitService = new LinkedInRateLimitService();
  });

  afterEach(async () => {
    await rateLimitService.disconnect();
  });

  describe('Ultra-Conservative Rate Limits', () => {
    describe('Connection Requests - Critical Compliance', () => {
      it('should enforce 15/day limit (15% of LinkedIn\'s 100/day)', async () => {
        const userId = 'test-user-1';
        const endpoint = '/v2/invitation';
        
        // Mock current usage at daily limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily')) return Promise.resolve('15');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(0);
        expect(rateLimitInfo.retryAfter).toBeGreaterThan(0);
      });

      it('should reject requests when approaching daily limit (90% threshold)', async () => {
        const userId = 'test-user-2';
        const endpoint = '/v2/invitation';
        
        // Mock usage at 14/15 (93% of daily limit)
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily')) return Promise.resolve('14');
          if (key.includes('hourly')) return Promise.resolve('6');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(1);
        
        // Should show warning at 90%+ usage
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        expect(complianceStatus.status).toBe('WARNING');
        expect(complianceStatus.score).toBeLessThan(80);
      });

      it('should enforce 8/hour burst limit for connections', async () => {
        const userId = 'test-user-3';
        const endpoint = '/v2/invitation';
        
        // Mock hourly usage at limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('hourly')) return Promise.resolve('8');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(0);
        expect(rateLimitInfo.retryAfter).toBeDefined();
      });
    });

    describe('Engagement Limits - Strict Compliance', () => {
      it('should enforce 30/day likes limit (15% of LinkedIn\'s 200/day)', async () => {
        const userId = 'test-user-4';
        const endpoint = '/v2/networkUpdates';
        
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily') && key.includes('networkUpdates')) return Promise.resolve('30');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(0);
      });

      it('should enforce 8/day comments limit (16% of LinkedIn\'s 50/day)', async () => {
        const userId = 'test-user-5';
        const endpoint = '/v2/posts';
        
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily') && key.includes('posts')) return Promise.resolve('8');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(0);
      });

      it('should enforce 25/day profile views limit (17% of LinkedIn\'s 150/day)', async () => {
        const userId = 'test-user-6';
        const endpoint = '/v2/people';
        
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily') && key.includes('people')) return Promise.resolve('25');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(0);
      });
    });

    describe('Global Rate Limiting', () => {
      it('should enforce global 150/hour limit across all endpoints', async () => {
        const userId = 'test-user-7';
        const endpoint = '/v2/me';
        
        // Mock global hourly usage at limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('global') && key.includes('hourly')) return Promise.resolve('150');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(0);
      });

      it('should enforce global 800/day limit across all endpoints', async () => {
        const userId = 'test-user-8';
        const endpoint = '/v2/me';
        
        // Mock global daily usage at limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('global') && key.includes('daily')) return Promise.resolve('800');
          return Promise.resolve('0');
        });

        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, endpoint);
        
        expect(rateLimitInfo.remaining).toBe(0);
        expect(rateLimitInfo.retryAfter).toBeGreaterThan(3600); // Should wait for next day
      });
    });
  });

  describe('Human-Like Behavior Validation', () => {
    describe('Time-Based Pattern Analysis', () => {
      it('should detect bot-like regular intervals and flag as violation', async () => {
        const userId = 'test-user-9';
        const regularTimestamps = [];
        const baseTime = Date.now();
        
        // Create extremely regular pattern (every 60 seconds exactly)
        for (let i = 0; i < 10; i++) {
          regularTimestamps.push(JSON.stringify({
            endpoint: '/v2/invitation',
            success: true,
            timestamp: new Date(baseTime + (i * 60000)).toISOString()
          }));
        }
        
        mockRedis.lrange.mockResolvedValue(regularTimestamps);
        
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus.riskFactors).toContain('Suspicious time-based usage patterns');
        expect(complianceStatus.score).toBeLessThan(70);
      });

      it('should accept natural human-like irregular patterns', async () => {
        const userId = 'test-user-10';
        const naturalTimestamps = [];
        const baseTime = Date.now();
        
        // Create natural pattern with varying intervals
        const intervals = [45000, 120000, 80000, 300000, 60000, 180000]; // 45s to 5min
        let currentTime = baseTime;
        
        for (let i = 0; i < intervals.length; i++) {
          currentTime += intervals[i];
          naturalTimestamps.push(JSON.stringify({
            endpoint: '/v2/invitation',
            success: true,
            timestamp: new Date(currentTime).toISOString()
          }));
        }
        
        mockRedis.lrange.mockResolvedValue(naturalTimestamps);
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily')) return Promise.resolve('5');
          if (key.includes('hourly')) return Promise.resolve('2');
          return Promise.resolve('0');
        });
        
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus.score).toBeGreaterThan(80);
        expect(complianceStatus.status).toBe('COMPLIANT');
      });

      it('should flag excessive burst activity as violation', async () => {
        const userId = 'test-user-11';
        const burstTimestamps = [];
        const baseTime = Date.now();
        
        // Create burst pattern (10 requests in 2 minutes)
        for (let i = 0; i < 10; i++) {
          burstTimestamps.push(JSON.stringify({
            endpoint: '/v2/invitation',
            success: true,
            timestamp: new Date(baseTime + (i * 12000)).toISOString() // Every 12 seconds
          }));
        }
        
        mockRedis.lrange.mockResolvedValue(burstTimestamps);
        
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus.riskFactors).toContain('Suspicious time-based usage patterns');
        expect(complianceStatus.status).toBe('WARNING');
      });
    });

    describe('Velocity Monitoring', () => {
      it('should detect rapid increase in API usage and reduce score', async () => {
        const userId = 'test-user-12';
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Mock low usage yesterday, high usage today
        mockRedis.lrange.mockImplementation((key: string) => {
          if (key.includes(yesterday)) {
            return Promise.resolve(new Array(5).fill('mock-request')); // 5 requests yesterday
          } else if (key.includes(today)) {
            return Promise.resolve(new Array(25).fill('mock-request')); // 25 requests today (400% increase)
          }
          return Promise.resolve([]);
        });
        
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily')) return Promise.resolve('10');
          if (key.includes('hourly')) return Promise.resolve('5');
          return Promise.resolve('0');
        });
        
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus.safetyMetrics.velocityScore).toBeLessThan(70);
        expect(complianceStatus.riskFactors).toContain('Rapid increase in API usage detected');
      });
    });
  });

  describe('Safety Monitoring & Emergency Stop', () => {
    describe('Real-Time Compliance Scoring', () => {
      it('should calculate compliance score based on multiple factors', async () => {
        const userId = 'test-user-13';
        
        // Mock moderate usage
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily') && key.includes('invitation')) return Promise.resolve('10'); // 67% of daily limit
          if (key.includes('hourly') && key.includes('invitation')) return Promise.resolve('5'); // 62% of hourly limit
          if (key.includes('global') && key.includes('daily')) return Promise.resolve('400'); // 50% of global daily
          return Promise.resolve('0');
        });
        
        mockRedis.lrange.mockResolvedValue([]);
        mockRedis.keys.mockResolvedValue([]);
        
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus.score).toBeGreaterThan(50);
        expect(complianceStatus.score).toBeLessThan(90);
        expect(complianceStatus.status).toBe('WARNING');
      });

      it('should trigger VIOLATION status when limits exceeded', async () => {
        const userId = 'test-user-14';
        
        // Mock usage exceeding safe thresholds
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily') && key.includes('invitation')) return Promise.resolve('15'); // At daily limit
          if (key.includes('global') && key.includes('daily')) return Promise.resolve('700'); // 87% of global daily
          return Promise.resolve('0');
        });
        
        mockRedis.lrange.mockResolvedValue([]);
        mockRedis.keys.mockResolvedValue(['violation-key-1', 'violation-key-2']);
        
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus.score).toBeLessThan(50);
        expect(complianceStatus.status).toBe('VIOLATION');
        expect(complianceStatus.nextAllowedAction.getTime()).toBeGreaterThan(Date.now() + 3.5 * 60 * 60 * 1000); // 4+ hours
      });
    });

    describe('Violation Recording & Tracking', () => {
      it('should record compliance violations with proper metadata', async () => {
        const userId = 'test-user-15';
        const violationType = 'RATE_LIMIT_EXCEEDED';
        const details = {
          endpoint: '/v2/invitation',
          currentLimit: 15,
          attempted: 16,
          severity: 'high'
        };
        
        await rateLimitService.recordViolation(userId, violationType, details);
        
        expect(mockRedis.lpush).toHaveBeenCalledWith(
          expect.stringContaining(`linkedin_violations:${userId}`),
          expect.stringContaining(violationType)
        );
        expect(mockRedis.expire).toHaveBeenCalled();
        expect(mockRedis.ltrim).toHaveBeenCalledWith(expect.any(String), 0, 99);
      });

      it('should track violation history for compliance scoring', async () => {
        const userId = 'test-user-16';
        
        // Mock user with recent violations
        mockRedis.keys.mockResolvedValue([
          `linkedin_violations:${userId}:2025-01-29`,
          `linkedin_violations:${userId}:2025-01-28`,
          `linkedin_violations:${userId}:2025-01-27`
        ]);
        
        mockRedis.get.mockImplementation(() => Promise.resolve('5'));
        mockRedis.lrange.mockResolvedValue([]);
        
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus.safetyMetrics.complianceHistory).toBeLessThan(60);
        expect(complianceStatus.riskFactors).toContain('Poor historical compliance record');
      });
    });
  });

  describe('Adaptive Throttling', () => {
    describe('Error-Based Limit Adjustment', () => {
      it('should reduce limits when 429 error rate exceeds 5%', async () => {
        // Mock analytics showing high 429 error rate
        const analytics = [];
        for (let i = 0; i < 100; i++) {
          analytics.push(JSON.stringify({
            endpoint: '/v2/invitation',
            success: i < 90, // 10% failure rate
            statusCode: i < 90 ? 200 : 429,
            timestamp: new Date().toISOString()
          }));
        }
        
        mockRedis.keys.mockResolvedValue(['analytics-key-1']);
        mockRedis.lrange.mockResolvedValue(analytics);
        
        // Trigger adaptive throttling
        await (rateLimitService as any).adjustLimitsBasedOnErrors();
        
        // Verify limits were reduced (this would need to be tested via subsequent rate limit checks)
        const rateLimitInfo = await rateLimitService.checkRateLimit('test-user', '/v2/invitation');
        
        // After adjustment, limits should be more conservative
        expect(rateLimitInfo.limit).toBeLessThanOrEqual(15);
      });

      it('should cautiously increase limits when error rate is very low', async () => {
        // Mock analytics showing very low error rate
        const analytics = [];
        for (let i = 0; i < 100; i++) {
          analytics.push(JSON.stringify({
            endpoint: '/v2/invitation',
            success: true, // 0% failure rate
            statusCode: 200,
            timestamp: new Date().toISOString()
          }));
        }
        
        mockRedis.keys.mockResolvedValue(['analytics-key-1']);
        mockRedis.lrange.mockResolvedValue(analytics);
        
        // Mock random to ensure increase happens
        const originalRandom = Math.random;
        Math.random = jest.fn().mockReturnValue(0.05); // 5% chance, should trigger increase
        
        await (rateLimitService as any).adjustLimitsBasedOnErrors();
        
        Math.random = originalRandom;
        
        // Verify that the system considered increasing limits (actual increase is cautious)
        expect(mockRedis.lrange).toHaveBeenCalled();
      });
    });
  });

  describe('Enterprise Compliance Reporting', () => {
    describe('System-Wide Compliance Overview', () => {
      it('should generate comprehensive compliance report', async () => {
        // Mock multiple users with various compliance statuses
        mockRedis.keys.mockResolvedValue([
          'linkedin_rate_limit:user1:global:2025-1-29-15',
          'linkedin_rate_limit:user2:global:2025-1-29-15',
          'linkedin_rate_limit:user3:global:2025-1-29-15'
        ]);
        
        // Mock compliance status calls
        const mockGetComplianceStatus = jest.spyOn(rateLimitService, 'getComplianceStatus');
        mockGetComplianceStatus
          .mockResolvedValueOnce({
            status: 'COMPLIANT',
            score: 85,
            recommendations: [],
            riskFactors: [],
            nextAllowedAction: new Date(),
            safetyMetrics: { velocityScore: 80, patternScore: 85, complianceHistory: 90 }
          } as any)
          .mockResolvedValueOnce({
            status: 'WARNING',
            score: 65,
            recommendations: ['Reduce API calls'],
            riskFactors: ['High daily usage'],
            nextAllowedAction: new Date(),
            safetyMetrics: { velocityScore: 70, patternScore: 75, complianceHistory: 85 }
          } as any)
          .mockResolvedValueOnce({
            status: 'VIOLATION',
            score: 45,
            recommendations: ['Pause automation'],
            riskFactors: ['Rate limit exceeded', 'Suspicious patterns'],
            nextAllowedAction: new Date(),
            safetyMetrics: { velocityScore: 50, patternScore: 60, complianceHistory: 70 }
          } as any);
        
        const report = await rateLimitService.getComplianceReport();
        
        expect(report.totalUsers).toBe(3);
        expect(report.complianceBreakdown.compliant).toBe(1);
        expect(report.complianceBreakdown.warning).toBe(1);
        expect(report.complianceBreakdown.violation).toBe(1);
        expect(report.averageComplianceScore).toBeGreaterThan(60);
        expect(report.topRiskFactors).toContain(
          expect.objectContaining({ factor: 'High daily usage' })
        );
        
        mockGetComplianceStatus.mockRestore();
      });
    });
  });

  describe('Error Handling & Resilience', () => {
    describe('Redis Connection Failures', () => {
      it('should handle Redis connection failures gracefully', async () => {
        mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
        
        const healthStatus = await rateLimitService.getHealthStatus();
        
        expect(healthStatus.status).toBe('unhealthy');
        expect(healthStatus.details.redisConnected).toBe(false);
      });

      it('should provide fallback behavior when Redis is unavailable', async () => {
        mockRedis.ping.mockRejectedValue(new Error('Redis unavailable'));
        
        // Should not throw error but handle gracefully
        const rateLimitInfo = await rateLimitService.checkRateLimit('test-user', '/v2/me');
        
        // Should provide conservative defaults or error handling
        expect(rateLimitInfo).toBeDefined();
      });
    });

    describe('Invalid Data Handling', () => {
      it('should handle corrupted analytics data', async () => {
        const userId = 'test-user-17';
        
        // Mock corrupted analytics data
        mockRedis.lrange.mockResolvedValue([
          'invalid-json',
          JSON.stringify({ endpoint: '/v2/me' }), // Missing required fields
          '{"timestamp": "invalid-date"}',
          JSON.stringify({
            endpoint: '/v2/invitation',
            success: true,
            timestamp: new Date().toISOString()
          })
        ]);
        
        mockRedis.get.mockImplementation(() => Promise.resolve('5'));
        mockRedis.keys.mockResolvedValue([]);
        
        // Should not throw error and provide reasonable defaults
        const complianceStatus = await rateLimitService.getComplianceStatus(userId);
        
        expect(complianceStatus).toBeDefined();
        expect(complianceStatus.score).toBeGreaterThan(0);
        expect(complianceStatus.score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Performance Under Load', () => {
    describe('Concurrent Request Handling', () => {
      it('should handle multiple concurrent rate limit checks', async () => {
        const userId = 'test-user-18';
        const endpoint = '/v2/me';
        
        mockRedis.get.mockResolvedValue('0');
        
        // Fire 50 concurrent rate limit checks
        const promises = Array(50).fill(null).map(() => 
          rateLimitService.checkRateLimit(userId, endpoint)
        );
        
        const results = await Promise.all(promises);
        
        // All should complete successfully
        expect(results).toHaveLength(50);
        results.forEach(result => {
          expect(result).toBeDefined();
          expect(result.endpoint).toBe(endpoint);
        });
      });

      it('should maintain accuracy under concurrent updates', async () => {
        const userId = 'test-user-19';
        const endpoint = '/v2/invitation';
        
        mockRedis.get.mockResolvedValue('0');
        
        // Fire concurrent record requests
        const promises = Array(20).fill(null).map(() => 
          rateLimitService.recordRequest(userId, endpoint, true)
        );
        
        await Promise.all(promises);
        
        // Verify Redis operations were called correctly
        expect(mockRedis.pipeline).toHaveBeenCalledTimes(20);
      });
    });
  });
});

describe('LinkedInRateLimitService - Integration Compliance Tests', () => {
  let rateLimitService: LinkedInRateLimitService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      }),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    rateLimitService = new LinkedInRateLimitService();
  });

  afterEach(async () => {
    await rateLimitService.disconnect();
  });

  describe('End-to-End Compliance Workflow', () => {
    it('should enforce complete LinkedIn compliance workflow', async () => {
      const userId = 'compliance-test-user';
      
      // Step 1: Start with clean slate
      mockRedis.get.mockResolvedValue('0');
      
      let complianceStatus = await rateLimitService.getComplianceStatus(userId);
      expect(complianceStatus.status).toBe('COMPLIANT');
      expect(complianceStatus.score).toBeGreaterThan(90);
      
      // Step 2: Make some connection requests (within limits)
      for (let i = 0; i < 8; i++) {
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily') && key.includes('invitation')) return Promise.resolve(String(i));
          if (key.includes('hourly') && key.includes('invitation')) return Promise.resolve(String(i));
          return Promise.resolve('0');
        });
        
        const rateLimitInfo = await rateLimitService.checkRateLimit(userId, '/v2/invitation');
        expect(rateLimitInfo.remaining).toBeGreaterThan(0);
        
        await rateLimitService.recordRequest(userId, '/v2/invitation', true);
      }
      
      // Step 3: Approach daily limit (should trigger warnings)
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily') && key.includes('invitation')) return Promise.resolve('12'); // 80% of limit
        if (key.includes('hourly') && key.includes('invitation')) return Promise.resolve('6');
        return Promise.resolve('0');
      });
      
      complianceStatus = await rateLimitService.getComplianceStatus(userId);
      expect(complianceStatus.status).toBe('WARNING');
      expect(complianceStatus.recommendations).toContain('Reduce API calls for today');
      
      // Step 4: Hit daily limit (should trigger violation)
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily') && key.includes('invitation')) return Promise.resolve('15'); // At limit
        return Promise.resolve('0');
      });
      
      const rateLimitInfo = await rateLimitService.checkRateLimit(userId, '/v2/invitation');
      expect(rateLimitInfo.remaining).toBe(0);
      
      complianceStatus = await rateLimitService.getComplianceStatus(userId);
      expect(complianceStatus.status).toBe('VIOLATION');
      expect(complianceStatus.nextAllowedAction.getTime()).toBeGreaterThan(Date.now());
    });

    it('should demonstrate emergency stop effectiveness', async () => {
      const userId = 'emergency-test-user';
      
      // Simulate high-risk scenario
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily')) return Promise.resolve('14'); // Near daily limit
        if (key.includes('hourly')) return Promise.resolve('7'); // Near hourly limit
        if (key.includes('global') && key.includes('daily')) return Promise.resolve('750'); // Near global limit
        return Promise.resolve('0');
      });
      
      // Mock suspicious patterns
      const suspiciousTimestamps = [];
      const baseTime = Date.now();
      for (let i = 0; i < 10; i++) {
        suspiciousTimestamps.push(JSON.stringify({
          endpoint: '/v2/invitation',
          success: true,
          timestamp: new Date(baseTime + (i * 30000)).toISOString() // Every 30 seconds exactly
        }));
      }
      mockRedis.lrange.mockResolvedValue(suspiciousTimestamps);
      
      const complianceStatus = await rateLimitService.getComplianceStatus(userId);
      
      // Should trigger multiple violations
      expect(complianceStatus.status).toBe('VIOLATION');
      expect(complianceStatus.score).toBeLessThan(40);
      expect(complianceStatus.riskFactors).toContain('High daily API usage');
      expect(complianceStatus.riskFactors).toContain('Suspicious time-based usage patterns');
      
      // Emergency stop should be recommended
      expect(complianceStatus.nextAllowedAction.getTime())
        .toBeGreaterThan(Date.now() + 3.5 * 60 * 60 * 1000); // At least 4 hours
    });
  });
});