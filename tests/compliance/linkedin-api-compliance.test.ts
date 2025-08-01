/**
 * LinkedIn API Compliance Testing Framework
 * 
 * Ultra-conservative compliance testing ensuring 15% safety margins on all LinkedIn limits
 * Critical for maintaining platform compliance and avoiding account suspensions
 */

import { LinkedInComplianceService } from '../../services/linkedin-service/src/services/compliance.service';
import { SafetyMonitorService } from '../../services/linkedin-service/src/services/safetyMonitor.service';
import { EmergencyStopService } from '../../services/linkedin-service/src/services/emergencyStop.service';
import { ComplianceMetrics, LinkedInAPIError } from '../../services/linkedin-service/src/types/linkedin';
import Redis from 'ioredis';
import axios from 'axios';

// Mock dependencies
jest.mock('ioredis');
jest.mock('axios');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
const MockedAxios = axios as jest.Mocked<typeof axios>;

describe('LinkedIn API Compliance Testing', () => {
  let complianceService: LinkedInComplianceService;
  let safetyMonitorService: SafetyMonitorService;
  let emergencyStopService: EmergencyStopService;
  let mockRedis: jest.Mocked<Redis>;

  // LinkedIn's actual limits vs our ultra-conservative limits
  const LINKEDIN_ACTUAL_LIMITS = {
    CONNECTION_REQUESTS_DAILY: 100,
    LIKES_DAILY: 200,
    COMMENTS_DAILY: 50,
    PROFILE_VIEWS_DAILY: 150,
    FOLLOWS_DAILY: 30,
    MESSAGES_DAILY: 100
  };

  const OUR_CONSERVATIVE_LIMITS = {
    CONNECTION_REQUESTS_DAILY: 15, // 15% of LinkedIn's limit
    LIKES_DAILY: 30, // 15% of LinkedIn's limit
    COMMENTS_DAILY: 8, // 16% of LinkedIn's limit
    PROFILE_VIEWS_DAILY: 25, // 17% of LinkedIn's limit
    FOLLOWS_DAILY: 5, // 17% of LinkedIn's limit
    MESSAGES_DAILY: 15 // 15% of LinkedIn's limit
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      }),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      scard: jest.fn(),
      smembers: jest.fn(),
      exists: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    
    complianceService = new LinkedInComplianceService();
    safetyMonitorService = new SafetyMonitorService();
    emergencyStopService = new EmergencyStopService();

    // Mock axios for LinkedIn API health checks
    MockedAxios.get.mockResolvedValue({
      status: 200,
      data: { id: 'test-user' },
      headers: {},
      config: {},
      statusText: 'OK'
    });
  });

  afterEach(async () => {
    await complianceService.disconnect?.();
    await safetyMonitorService.disconnect?.();
    await emergencyStopService.disconnect?.();
  });

  describe('Ultra-Conservative Rate Limit Enforcement', () => {
    describe('Connection Request Limits', () => {
      it('should strictly enforce 15/day connection request limit', async () => {
        const userId = 'compliance-test-user-1';
        const endpoint = '/v2/people/~/connections';

        // Mock Redis to show user at daily limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('15'); // At our conservative limit
          }
          return Promise.resolve('0');
        });

        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation.allowed).toBe(false);
        expect(validation.reason).toContain('Daily rate limit exceeded');
        expect(validation.riskLevel).toBe('HIGH');
        expect(validation.retryAfter).toBeGreaterThan(3600); // At least 1 hour
      });

      it('should trigger warnings at 80% of connection limit (12 requests)', async () => {
        const userId = 'compliance-test-user-2';
        const endpoint = '/v2/people/~/connections';

        // Mock Redis to show user at 80% of limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('12'); // 80% of our 15/day limit
          }
          if (key.includes('connections') && key.includes('hourly')) {
            return Promise.resolve('6'); // Within hourly limits
          }
          return Promise.resolve('0');
        });

        // Mock activity history for compliance scoring
        mockRedis.lrange.mockResolvedValue([]);
        mockRedis.keys.mockResolvedValue([]);

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.score).toBeLessThan(85);
        expect(complianceStatus.accountHealth.riskLevel).toBe('MEDIUM');
        expect(complianceStatus.accountHealth.warnings).toContain('Approaching daily request limit');
      });

      it('should enforce hourly burst protection (max 8/hour for connections)', async () => {
        const userId = 'compliance-test-user-3';
        const endpoint = '/v2/people/~/connections';

        // Mock Redis to show hourly limit reached
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('hourly')) {
            return Promise.resolve('8'); // At hourly burst limit
          }
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('8'); // Still within daily limit
          }
          return Promise.resolve('0');
        });

        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation.allowed).toBe(false);
        expect(validation.reason).toContain('Hourly rate limit exceeded');
        expect(validation.retryAfter).toBeLessThanOrEqual(3600); // Within 1 hour
      });

      it('should demonstrate 15% safety factor vs LinkedIn actual limits', async () => {
        const ourLimit = OUR_CONSERVATIVE_LIMITS.CONNECTION_REQUESTS_DAILY;
        const linkedinLimit = LINKEDIN_ACTUAL_LIMITS.CONNECTION_REQUESTS_DAILY;
        const safetyFactor = ourLimit / linkedinLimit;

        expect(safetyFactor).toBeLessThanOrEqual(0.17); // At most 17% of LinkedIn's limit
        expect(safetyFactor).toBeGreaterThanOrEqual(0.13); // At least 13% for buffer

        console.log('Connection request safety factor:', {
          ourLimit,
          linkedinLimit,
          safetyFactor: (safetyFactor * 100).toFixed(1) + '%'
        });
      });
    });

    describe('Engagement Limits', () => {
      it('should enforce 30/day likes limit (15% of LinkedIn\'s 200/day)', async () => {
        const userId = 'compliance-test-user-4';
        const endpoint = '/v2/reactions';

        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('reactions') && key.includes('daily')) {
            return Promise.resolve('30'); // At our conservative limit
          }
          return Promise.resolve('0');
        });

        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation.allowed).toBe(false);
        expect(validation.reason).toContain('Daily rate limit exceeded');

        // Verify safety factor
        const safetyFactor = OUR_CONSERVATIVE_LIMITS.LIKES_DAILY / LINKEDIN_ACTUAL_LIMITS.LIKES_DAILY;
        expect(safetyFactor).toBe(0.15); // Exactly 15%
      });

      it('should enforce 8/day comments limit (16% of LinkedIn\'s 50/day)', async () => {
        const userId = 'compliance-test-user-5';
        const endpoint = '/v2/posts';

        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('posts') && key.includes('daily')) {
            return Promise.resolve('8'); // At our conservative limit
          }
          return Promise.resolve('0');
        });

        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation.allowed).toBe(false);
        expect(validation.reason).toContain('Daily rate limit exceeded');

        // Verify safety factor is within acceptable range
        const safetyFactor = OUR_CONSERVATIVE_LIMITS.COMMENTS_DAILY / LINKEDIN_ACTUAL_LIMITS.COMMENTS_DAILY;
        expect(safetyFactor).toBe(0.16); // 16% of LinkedIn's limit
      });

      it('should enforce 25/day profile views limit (17% of LinkedIn\'s 150/day)', async () => {
        const userId = 'compliance-test-user-6';
        const endpoint = '/v2/people/{id}';

        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('people') && key.includes('daily')) {
            return Promise.resolve('25'); // At our conservative limit
          }
          return Promise.resolve('0');
        });

        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation.allowed).toBe(false);
        expect(validation.reason).toContain('Daily rate limit exceeded');

        // Verify safety factor
        const safetyFactor = OUR_CONSERVATIVE_LIMITS.PROFILE_VIEWS_DAILY / LINKEDIN_ACTUAL_LIMITS.PROFILE_VIEWS_DAILY;
        expect(safetyFactor).toBeCloseTo(0.167, 2); // ~17% of LinkedIn's limit
      });
    });

    describe('Global Rate Limiting', () => {
      it('should enforce system-wide rate limits across all endpoints', async () => {
        const userId = 'compliance-test-user-7';
        const endpoints = ['/v2/me', '/v2/people', '/v2/posts', '/v2/reactions'];

        // Mock global usage at limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('global') && key.includes('daily')) {
            return Promise.resolve('500'); // At system-wide daily limit
          }
          if (key.includes('global') && key.includes('hourly')) {
            return Promise.resolve('100'); // At system-wide hourly limit
          }
          return Promise.resolve('0');
        });

        for (const endpoint of endpoints) {
          const validation = await complianceService.validateRequest(userId, endpoint);
          
          expect(validation.allowed).toBe(false);
          expect(validation.reason).toContain('Daily rate limit exceeded');
          expect(validation.riskLevel).toBe('HIGH');
        }
      });

      it('should prioritize endpoint-specific limits over global limits', async () => {
        const userId = 'compliance-test-user-8';
        const endpoint = '/v2/people/~/connections';

        // Mock scenario: global limits OK, but connection limits exceeded
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('15'); // Connection limit exceeded
          }
          if (key.includes('global') && key.includes('daily')) {
            return Promise.resolve('200'); // Global limit still OK
          }
          return Promise.resolve('0');
        });

        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation.allowed).toBe(false);
        expect(validation.reason).toContain('Daily rate limit exceeded'); // Should fail on connection limit
      });
    });
  });

  describe('Human-Like Behavior Pattern Validation', () => {
    describe('Temporal Pattern Analysis', () => {
      it('should detect and flag bot-like regular timing patterns', async () => {
        const userId = 'pattern-test-user-1';
        
        // Create perfectly regular pattern (every 60 seconds exactly)
        const regularPattern = Array.from({ length: 10 }, (_, i) => 
          JSON.stringify({
            endpoint: '/v2/people/~/connections',
            timestamp: new Date(Date.now() - (10 - i) * 60000).toISOString(),
            success: true,
            responseTime: 200
          })
        );

        mockRedis.lrange.mockResolvedValue(regularPattern);
        mockRedis.get.mockImplementation(() => Promise.resolve('5'));
        mockRedis.keys.mockResolvedValue([]);

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.score).toBeLessThan(70);
        expect(complianceStatus.accountHealth.riskLevel).toBe('HIGH');
        expect(complianceStatus.accountHealth.warnings).toContain(
          expect.stringMatching(/suspicious.*pattern/i)
        );
      });

      it('should accept natural human-like irregular patterns', async () => {
        const userId = 'pattern-test-user-2';
        
        // Create natural human-like pattern with varying intervals
        const naturalIntervals = [45, 123, 87, 234, 156, 89, 178, 93, 267, 134]; // seconds
        let currentTime = Date.now() - 3600000; // 1 hour ago
        
        const naturalPattern = naturalIntervals.map(interval => {
          currentTime += interval * 1000;
          return JSON.stringify({
            endpoint: '/v2/people/~/connections',
            timestamp: new Date(currentTime).toISOString(),
            success: true,
            responseTime: 180 + Math.random() * 100
          });
        });

        mockRedis.lrange.mockResolvedValue(naturalPattern);
        mockRedis.get.mockImplementation(() => Promise.resolve('5'));
        mockRedis.keys.mockResolvedValue([]);

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.score).toBeGreaterThan(80);
        expect(complianceStatus.accountHealth.riskLevel).toBe('LOW');
      });

      it('should flag excessive burst activity as high risk', async () => {
        const userId = 'pattern-test-user-3';
        
        // Create burst pattern (10 requests in 2 minutes)
        const burstPattern = Array.from({ length: 10 }, (_, i) => 
          JSON.stringify({
            endpoint: '/v2/people/~/connections',
            timestamp: new Date(Date.now() - (120000 - i * 12000)).toISOString(), // Every 12 seconds
            success: true,
            responseTime: 150
          })
        );

        mockRedis.lrange.mockResolvedValue(burstPattern);
        mockRedis.get.mockImplementation(() => Promise.resolve('10'));
        mockRedis.keys.mockResolvedValue([]);

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.score).toBeLessThan(60);
        expect(complianceStatus.accountHealth.riskLevel).toBe('HIGH');
      });
    });

    describe('Activity Distribution Analysis', () => {
      it('should validate working hours activity distribution', async () => {
        const userId = 'distribution-test-user-1';
        
        // Create activity pattern during normal working hours (9 AM - 5 PM EST)
        const workingHoursPattern = Array.from({ length: 8 }, (_, i) => {
          const hour = 9 + i; // 9 AM to 4 PM
          const activityTime = new Date();
          activityTime.setHours(hour, Math.random() * 60, Math.random() * 60);
          
          return JSON.stringify({
            endpoint: '/v2/people/~/connections',
            timestamp: activityTime.toISOString(),
            success: true,
            responseTime: 200
          });
        });

        mockRedis.lrange.mockResolvedValue(workingHoursPattern);
        mockRedis.get.mockImplementation(() => Promise.resolve('4'));
        mockRedis.keys.mockResolvedValue([]);

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        // Working hours activity should be viewed favorably
        expect(complianceStatus.accountHealth.score).toBeGreaterThan(75);
      });

      it('should flag suspicious 24/7 activity patterns', async () => {
        const userId = 'distribution-test-user-2';
        
        // Create 24/7 activity pattern (including 3 AM activity)
        const nightTimePattern = Array.from({ length: 5 }, (_, i) => {
          const suspiciousTime = new Date();
          suspiciousTime.setHours(3, i * 10, 0); // 3:00 AM, 3:10 AM, etc.
          
          return JSON.stringify({
            endpoint: '/v2/people/~/connections',
            timestamp: suspiciousTime.toISOString(),
            success: true,
            responseTime: 180
          });
        });

        mockRedis.lrange.mockResolvedValue(nightTimePattern);
        mockRedis.get.mockImplementation(() => Promise.resolve('5'));
        mockRedis.keys.mockResolvedValue([]);

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.warnings).toContain(
          expect.stringMatching(/unusual.*hours/i)
        );
      });
    });

    describe('Velocity and Acceleration Monitoring', () => {
      it('should detect rapid increases in API usage velocity', async () => {
        const userId = 'velocity-test-user-1';
        
        // Mock historical data showing sudden spike
        mockRedis.keys.mockImplementation((pattern: string) => {
          if (pattern.includes('2025-01-28')) {
            return Promise.resolve(['key1', 'key2']); // 2 requests yesterday
          } else if (pattern.includes('2025-01-29')) {
            return Promise.resolve(Array(20).fill('key')); // 20 requests today (900% increase)
          }
          return Promise.resolve([]);
        });

        mockRedis.lrange.mockResolvedValue([]);
        mockRedis.get.mockImplementation(() => Promise.resolve('8'));

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.warnings).toContain(
          expect.stringMatching(/rapid.*increase/i)
        );
        expect(complianceStatus.accountHealth.score).toBeLessThan(70);
      });

      it('should accept gradual, natural usage growth', async () => {
        const userId = 'velocity-test-user-2';
        
        // Mock gradual increase over time
        mockRedis.keys.mockImplementation((pattern: string) => {
          if (pattern.includes('2025-01-27')) {
            return Promise.resolve(Array(3).fill('key')); // 3 requests
          } else if (pattern.includes('2025-01-28')) {
            return Promise.resolve(Array(5).fill('key')); // 5 requests (67% increase)
          } else if (pattern.includes('2025-01-29')) {
            return Promise.resolve(Array(7).fill('key')); // 7 requests (40% increase)
          }
          return Promise.resolve([]);
        });

        mockRedis.lrange.mockResolvedValue([]);
        mockRedis.get.mockImplementation(() => Promise.resolve('7'));

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.score).toBeGreaterThan(80);
        expect(complianceStatus.accountHealth.riskLevel).toBe('LOW');
      });
    });
  });

  describe('Real-Time Safety Monitoring', () => {
    describe('Health Score Calculation', () => {
      it('should calculate comprehensive health scores based on multiple factors', async () => {
        const userId = 'health-score-test-user';
        
        // Mock moderate usage scenario
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('8'); // 53% of daily limit
          }
          if (key.includes('reactions') && key.includes('daily')) {
            return Promise.resolve('15'); // 50% of daily limit
          }
          if (key.includes('global') && key.includes('daily')) {
            return Promise.resolve('250'); // 50% of global limit
          }
          return Promise.resolve('0');
        });

        // Mock good activity pattern
        mockRedis.lrange.mockResolvedValue([
          JSON.stringify({
            endpoint: '/v2/people/~/connections',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            success: true,
            responseTime: 200
          })
        ]);
        mockRedis.keys.mockResolvedValue([]);

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        // Health score components
        expect(complianceStatus.accountHealth.score).toBeGreaterThan(70);
        expect(complianceStatus.accountHealth.score).toBeLessThan(90);
        
        // Verify score factors are reasonable
        expect(complianceStatus.dailyLimits.connectionRequests.used).toBe(8);
        expect(complianceStatus.dailyLimits.connectionRequests.remaining).toBe(7);
      });

      it('should trigger CRITICAL status when multiple violations detected', async () => {
        const userId = 'critical-test-user';
        
        // Mock multiple violations
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('15'); // At connection limit
          }
          if (key.includes('reactions') && key.includes('daily')) {
            return Promise.resolve('30'); // At likes limit
          }
          if (key.includes('global') && key.includes('daily')) {
            return Promise.resolve('480'); // 96% of global limit
          }
          return Promise.resolve('0');
        });

        // Mock violation history
        mockRedis.keys.mockResolvedValue([
          'violation:user:2025-01-29',
          'violation:user:2025-01-28',
          'violation:user:2025-01-27'
        ]);

        // Mock suspicious patterns
        mockRedis.lrange.mockResolvedValue(Array(10).fill(
          JSON.stringify({
            endpoint: '/v2/people/~/connections',
            timestamp: new Date().toISOString(),
            success: false,
            statusCode: 429,
            responseTime: 100
          })
        ));

        const complianceStatus = await complianceService.getComplianceMetrics(userId);

        expect(complianceStatus.accountHealth.score).toBeLessThan(50);
        expect(complianceStatus.accountHealth.riskLevel).toBe('HIGH');
        expect(complianceStatus.accountHealth.warnings.length).toBeGreaterThan(2);
      });
    });

    describe('Real-Time Alert System', () => {
      it('should emit immediate alerts for rate limit violations', async () => {
        const userId = 'alert-test-user';
        const endpoint = '/v2/people/~/connections';
        
        // Mock scenario that will trigger violation
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('16'); // Exceeds our 15/day limit
          }
          return Promise.resolve('0');
        });

        const alertPromise = new Promise((resolve) => {
          complianceService.on('complianceAlert', (alert) => {
            resolve(alert);
          });
        });

        // This should trigger an alert
        const validation = await complianceService.validateRequest(userId, endpoint);
        
        expect(validation.allowed).toBe(false);
        
        // Wait for alert to be emitted
        const alert = await Promise.race([
          alertPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('No alert emitted')), 1000))
        ]) as any;

        expect(alert.level).toBe('CRITICAL');
        expect(alert.message).toContain('Rate limit violation');
        expect(alert.userId).toBe(userId);
      });

      it('should provide accurate retry-after timing', async () => {
        const userId = 'retry-after-test-user';
        const endpoint = '/v2/people/~/connections';
        
        // Mock user at daily limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('15');
          }
          return Promise.resolve('0');
        });

        // Mock TTL for rate limit key (simulating time until reset)
        mockRedis.ttl.mockResolvedValue(14400); // 4 hours until reset

        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation.allowed).toBe(false);
        expect(validation.retryAfter).toBeGreaterThan(14000); // At least 14000 seconds
        expect(validation.retryAfter).toBeLessThan(15000); // Less than 15000 seconds
      });
    });
  });

  describe('Emergency Stop Mechanisms', () => {
    describe('Individual User Emergency Stop', () => {
      it('should immediately halt all API activity for flagged user', async () => {
        const userId = 'emergency-stop-user';
        const reason = 'Multiple rate limit violations detected';
        
        // Trigger emergency stop
        await emergencyStopService.emergencyStopUser(userId, reason, 'system');

        // Mock Redis to simulate emergency stop flag
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('emergency_stop')) {
            return Promise.resolve(JSON.stringify({
              userId,
              reason,
              triggeredAt: new Date().toISOString(),
              triggeredBy: 'system',
              duration: 86400000 // 24 hours
            }));
          }
          return Promise.resolve('0');
        });

        // Test that all endpoints are blocked
        const endpoints = [
          '/v2/people/~/connections',
          '/v2/reactions',
          '/v2/posts',
          '/v2/people/{id}'
        ];

        for (const endpoint of endpoints) {
          const validation = await complianceService.validateRequest(userId, endpoint);
          
          expect(validation.allowed).toBe(false);
          expect(validation.reason).toContain('Emergency stop');
          expect(validation.riskLevel).toBe('HIGH');
          expect(validation.retryAfter).toBeGreaterThan(3600); // At least 1 hour
        }
      });

      it('should record emergency stop events for audit trail', async () => {
        const userId = 'audit-trail-user';
        const reason = 'Suspicious automation pattern detected';
        const triggeredBy = 'compliance-system';

        await emergencyStopService.emergencyStopUser(userId, reason, triggeredBy);

        // Verify audit log entry
        expect(mockRedis.lpush).toHaveBeenCalledWith(
          expect.stringContaining('emergency_stop_log'),
          expect.stringContaining(userId)
        );
        
        expect(mockRedis.lpush).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining(reason)
        );
      });
    });

    describe('System-Wide Emergency Stop', () => {
      it('should halt all LinkedIn API activity system-wide when triggered', async () => {
        const reason = 'LinkedIn API reported abuse across multiple accounts';
        const triggeredBy = 'security-team';
        
        await emergencyStopService.emergencyStopSystem(reason, triggeredBy);

        // Mock system-wide stop flag
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('system_emergency_stop')) {
            return Promise.resolve(JSON.stringify({
              reason,
              triggeredAt: new Date().toISOString(),
              triggeredBy,
              affectedUsers: 'all'
            }));
          }
          return Promise.resolve('0');
        });

        // Test multiple users are blocked
        const testUsers = ['user1', 'user2', 'user3'];
        
        for (const userId of testUsers) {
          const validation = await complianceService.validateRequest(userId, '/v2/me');
          
          expect(validation.allowed).toBe(false);
          expect(validation.reason).toContain('System-wide emergency stop');
          expect(validation.riskLevel).toBe('HIGH');
        }
      });
    });

    describe('Automatic Recovery Mechanisms', () => {
      it('should automatically restore service after emergency stop duration expires', async () => {
        const userId = 'recovery-test-user';
        
        // Mock expired emergency stop
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('emergency_stop')) {
            return Promise.resolve(null); // Emergency stop has expired/been cleared
          }
          if (key.includes('connections') && key.includes('daily')) {
            return Promise.resolve('5'); // Normal usage levels
          }
          return Promise.resolve('0');
        });

        const validation = await complianceService.validateRequest(userId, '/v2/me');

        expect(validation.allowed).toBe(true);
        expect(validation.riskLevel).toBe('LOW');
      });

      it('should implement graduated recovery with reduced limits', async () => {
        const userId = 'graduated-recovery-user';
        
        // Mock recent emergency stop recovery
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('recovery_mode')) {
            return Promise.resolve(JSON.stringify({
              userId,
              reducedLimits: true,
              recoveryStarted: new Date().toISOString(),
              originalLimits: {
                connectionsDaily: 15,
                reactionsDaily: 30
              },
              reducedLimits: {
                connectionsDaily: 8, // 50% of normal limit during recovery
                reactionsDaily: 15
              }
            }));
          }
          return Promise.resolve('0');
        });

        // During recovery, limits should be reduced
        const complianceStatus = await complianceService.getComplianceMetrics(userId);
        
        expect(complianceStatus.dailyLimits.connectionRequests.limit).toBeLessThan(15);
        expect(complianceStatus.accountHealth.warnings).toContain(
          expect.stringMatching(/recovery.*mode/i)
        );
      });
    });
  });

  describe('Compliance Reporting and Analytics', () => {
    describe('System-Wide Compliance Overview', () => {
      it('should generate comprehensive compliance dashboard data', async () => {
        // Mock multiple users with different compliance states
        const users = ['compliant-user', 'warning-user', 'violation-user'];
        
        mockRedis.keys.mockResolvedValue(users.map(u => `rate_limit:${u}:daily`));
        
        // Mock different compliance statuses for each user
        const mockGetComplianceMetrics = jest.spyOn(complianceService, 'getComplianceMetrics');
        mockGetComplianceMetrics
          .mockResolvedValueOnce({
            accountHealth: { score: 90, riskLevel: 'LOW', warnings: [] },
            dailyLimits: { connectionRequests: { limit: 15, used: 3, remaining: 12 } }
          } as any)
          .mockResolvedValueOnce({
            accountHealth: { score: 65, riskLevel: 'MEDIUM', warnings: ['Approaching limits'] },
            dailyLimits: { connectionRequests: { limit: 15, used: 12, remaining: 3 } }
          } as any)
          .mockResolvedValueOnce({
            accountHealth: { score: 30, riskLevel: 'HIGH', warnings: ['Multiple violations'] },
            dailyLimits: { connectionRequests: { limit: 15, used: 15, remaining: 0 } }
          } as any);

        const report = await complianceService.getSystemComplianceReport();

        expect(report.totalUsers).toBe(3);
        expect(report.complianceBreakdown.compliant).toBe(1);
        expect(report.complianceBreakdown.warning).toBe(1);
        expect(report.complianceBreakdown.violation).toBe(1);
        expect(report.averageComplianceScore).toBeCloseTo(61.67, 1);
        
        mockGetComplianceMetrics.mockRestore();
      });

      it('should track compliance trends over time', async () => {
        const timeRange = 7; // 7 days
        
        // Mock historical compliance data
        mockRedis.keys.mockImplementation((pattern: string) => {
          const date = pattern.match(/\d{4}-\d{2}-\d{2}/)?.[0];
          if (date) {
            // Simulate improving compliance over time
            const daysSinceStart = new Date(date).getTime() - new Date('2025-01-23').getTime();
            const days = Math.floor(daysSinceStart / (24 * 60 * 60 * 1000));
            const violationCount = Math.max(0, 10 - days); // Decreasing violations
            return Promise.resolve(Array(violationCount).fill('violation'));
          }
          return Promise.resolve([]);
        });

        const trends = await complianceService.getComplianceTrends(timeRange);

        expect(trends.period).toBe(timeRange);
        expect(trends.violationTrend).toBe('decreasing');
        expect(trends.complianceImprovement).toBeGreaterThan(0);
        
        // Verify daily violation counts are decreasing
        const violationCounts = trends.dailyViolations.map(d => d.count);
        const isDecreasing = violationCounts.every((count, i) => 
          i === 0 || count <= violationCounts[i - 1]
        );
        expect(isDecreasing).toBe(true);
      });
    });

    describe('Risk Assessment Reporting', () => {
      it('should identify highest risk factors across system', async () => {
        // Mock various violation types
        mockRedis.keys.mockResolvedValue([
          'violation:user1:rate_limit_exceeded',
          'violation:user2:rate_limit_exceeded',
          'violation:user3:suspicious_pattern',
          'violation:user4:rate_limit_exceeded',
          'violation:user5:rapid_usage_increase'
        ]);

        const riskAssessment = await complianceService.getRiskAssessment();

        expect(riskAssessment.topRiskFactors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              factor: 'rate_limit_exceeded',
              frequency: 3,
              severity: 'high'
            })
          ])
        );

        expect(riskAssessment.riskScore).toBeGreaterThan(0);
        expect(riskAssessment.riskScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Integration with LinkedIn API Health Monitoring', () => {
    describe('API Health Verification', () => {
      it('should perform LinkedIn API health checks', async () => {
        const userId = 'health-check-user';
        const accessToken = 'test-access-token';

        // Mock successful LinkedIn API response
        MockedAxios.get.mockResolvedValueOnce({
          status: 200,
          data: { id: userId, firstName: { localized: { 'en_US': 'Test' } } },
          headers: {},
          config: {},
          statusText: 'OK'
        });

        const healthCheck = await complianceService.performLinkedInHealthCheck(userId, accessToken);

        expect(healthCheck.apiConnectivity).toBe('healthy');
        expect(healthCheck.authenticationStatus).toBe('valid');
        expect(healthCheck.responseTime).toBeLessThan(1000);

        // Verify API call was made with correct parameters
        expect(MockedAxios.get).toHaveBeenCalledWith(
          'https://api.linkedin.com/v2/me',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': `Bearer ${accessToken}`
            })
          })
        );
      });

      it('should handle LinkedIn API errors gracefully', async () => {
        const userId = 'error-test-user';
        const accessToken = 'invalid-token';

        // Mock LinkedIn API error response
        MockedAxios.get.mockRejectedValueOnce({
          response: {
            status: 401,
            data: { error: 'Unauthorized' }
          }
        });

        const healthCheck = await complianceService.performLinkedInHealthCheck(userId, accessToken);

        expect(healthCheck.apiConnectivity).toBe('error');
        expect(healthCheck.authenticationStatus).toBe('invalid');
        expect(healthCheck.errorDetails).toContain('401');
      });

      it('should detect LinkedIn rate limiting responses', async () => {
        const userId = 'rate-limit-test-user';
        const accessToken = 'test-token';

        // Mock 429 rate limit response
        MockedAxios.get.mockRejectedValueOnce({
          response: {
            status: 429,
            headers: {
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 3600
            },
            data: { error: 'Rate limit exceeded' }
          }
        });

        const healthCheck = await complianceService.performLinkedInHealthCheck(userId, accessToken);

        expect(healthCheck.apiConnectivity).toBe('rate_limited');
        expect(healthCheck.rateLimitStatus).toEqual(
          expect.objectContaining({
            remaining: 0,
            resetTime: expect.any(Number)
          })
        );
      });
    });
  });

  describe('Performance and Reliability', () => {
    describe('High-Load Compliance Validation', () => {
      it('should handle 1000+ concurrent compliance checks efficiently', async () => {
        const concurrentRequests = 1000;
        const userId = 'load-test-user';
        const endpoint = '/v2/me';

        // Mock Redis responses for all concurrent requests
        mockRedis.get.mockResolvedValue('5'); // Within limits

        const startTime = Date.now();

        // Fire 1000 concurrent compliance checks
        const promises = Array(concurrentRequests).fill(null).map(() =>
          complianceService.validateRequest(userId, endpoint)
        );

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Verify all requests completed successfully
        expect(results).toHaveLength(concurrentRequests);
        results.forEach(result => {
          expect(result).toBeDefined();
          expect(result.allowed).toBeDefined();
        });

        // Performance requirement: <5 seconds for 1000 requests
        expect(totalTime).toBeLessThan(5000);

        console.log(`Compliance load test: ${concurrentRequests} requests in ${totalTime}ms`);
      });
    });

    describe('Redis Failure Resilience', () => {
      it('should handle Redis connection failures gracefully', async () => {
        const userId = 'redis-failure-user';
        const endpoint = '/v2/me';

        // Mock Redis connection failure
        mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

        // Should not throw but return safe default
        const validation = await complianceService.validateRequest(userId, endpoint);

        expect(validation).toBeDefined();
        expect(validation.allowed).toBe(false); // Fail-safe behavior
        expect(validation.reason).toContain('Service unavailable');
      });
    });
  });
});

// Test utilities for compliance validation
export class ComplianceTestUtils {
  static createMockProfile(overrides: any = {}): any {
    return {
      id: 'test-user-' + Math.random().toString(36).substr(2, 9),
      firstName: { localized: { 'en_US': 'Test' } },
      lastName: { localized: { 'en_US': 'User' } },
      ...overrides
    };
  }

  static createMockComplianceMetrics(overrides: any = {}): ComplianceMetrics {
    return {
      dailyLimits: {
        connectionRequests: { limit: 15, used: 5, remaining: 10 },
        messages: { limit: 15, used: 3, remaining: 12 },
        profileViews: { limit: 25, used: 8, remaining: 17 }
      },
      accountHealth: {
        score: 85,
        riskLevel: 'LOW',
        warnings: []
      },
      recentActivity: [],
      ...overrides
    } as ComplianceMetrics;
  }

  static async simulateAPIUsage(
    complianceService: LinkedInComplianceService,
    userId: string,
    endpoint: string,
    count: number
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      await complianceService.logRequest({
        userId,
        endpoint,
        method: 'GET',
        statusCode: 200,
        responseTime: 200,
        success: true
      });
    }
  }

  static calculateSafetyFactor(ourLimit: number, linkedinLimit: number): number {
    return ourLimit / linkedinLimit;
  }

  static validateSafetyFactor(safetyFactor: number): boolean {
    return safetyFactor >= 0.13 && safetyFactor <= 0.17; // 13-17% range
  }
}