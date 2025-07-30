/**
 * Emergency Stop Service - Critical LinkedIn Compliance Testing Suite
 * 
 * This test suite validates the emergency stop mechanisms that are essential
 * for LinkedIn API compliance and user account safety. Tests cover circuit
 * breaker patterns, automated stops, manual interventions, and system-wide
 * emergency procedures.
 * 
 * Critical compliance features tested:
 * - Circuit breaker for LinkedIn API failures
 * - Automatic emergency stops on rate limit violations
 * - Manual emergency stop triggers
 * - System-wide emergency stop capabilities
 * - Auto-resume mechanisms with safety checks
 * - Dashboard monitoring and reporting
 */

import { EmergencyStopService } from '../../src/services/emergencyStop.service';
import { EmergencyStopReason, EmergencyStopStatus, CircuitBreakerState } from '../../src/types/linkedin';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

// Mock Redis for testing
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

// Mock EventEmitter methods
const mockEmit = jest.fn();
jest.mock('events', () => ({
  EventEmitter: jest.fn().mockImplementation(() => ({
    emit: mockEmit,
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
  }))
}));

describe('EmergencyStopService - Critical Compliance Tests', () => {
  let emergencyStopService: EmergencyStopService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock Redis instance with comprehensive method coverage
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      zadd: jest.fn(),
      zrevrange: jest.fn(),
      zremrangebyrank: jest.fn(),
      publish: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      })
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    
    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    emergencyStopService = new EmergencyStopService();
  });

  afterEach(async () => {
    await emergencyStopService.cleanup();
    jest.restoreAllMocks();
  });

  describe('Circuit Breaker Functionality - LinkedIn API Protection', () => {
    describe('Circuit Breaker Initialization', () => {
      it('should initialize circuit breaker for new user services', async () => {
        const userId = 'test-user-1';
        const service = 'connection';
        
        mockRedis.setex.mockResolvedValue('OK');
        
        await emergencyStopService.initializeCircuitBreaker(userId, service);
        
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `circuit_breaker:${userId}:${service}`,
          24 * 60 * 60, // 24 hours
          expect.stringContaining('"state":"CLOSED"')
        );
      });

      it('should not reinitialize existing circuit breakers', async () => {
        const userId = 'test-user-2';
        const service = 'engagement';
        
        // Mock existing circuit breaker
        mockRedis.get.mockResolvedValue(JSON.stringify({
          state: 'OPEN',
          failureCount: 3,
          successCount: 0
        }));
        
        await emergencyStopService.initializeCircuitBreaker(userId, service);
        await emergencyStopService.initializeCircuitBreaker(userId, service);
        
        // Should only be called once during first initialization
        expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      });
    });

    describe('Success Recording - Recovery Mechanism', () => {
      it('should record successful operations and reset counters', async () => {
        const userId = 'test-user-3';
        const service = 'profile_view';
        
        mockRedis.setex.mockResolvedValue('OK');
        
        await emergencyStopService.recordSuccess(userId, service);
        
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `circuit_breaker:${userId}:${service}`,
          24 * 60 * 60,
          expect.stringContaining('"successCount":1')
        );
      });

      it('should close circuit breaker after sufficient successes in half-open state', async () => {
        const userId = 'test-user-4';
        const service = 'connection';
        
        // Set up circuit breaker in half-open state with 2 successes
        const mockBreaker = {
          state: 'HALF_OPEN',
          failureCount: 5,
          successCount: 2
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        
        await emergencyStopService.recordSuccess(userId, service);
        
        // Should emit circuit breaker closed event
        expect(mockEmit).toHaveBeenCalledWith('circuitBreakerClosed', {
          userId,
          service
        });
        
        // Should reset counters and close circuit
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          expect.stringContaining('"state":"CLOSED"')
        );
      });
    });

    describe('Failure Recording - Protection Mechanism', () => {
      it('should record failures and open circuit breaker at threshold', async () => {
        const userId = 'test-user-5';
        const service = 'engagement';
        const error = 'LinkedIn API rate limit exceeded';
        
        // Mock circuit breaker approaching failure threshold
        const mockBreaker = {
          state: 'CLOSED',
          failureCount: 4, // One below threshold of 5
          successCount: 0
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        
        const circuitOpened = await emergencyStopService.recordFailure(userId, service, error);
        
        expect(circuitOpened).toBe(true);
        expect(mockEmit).toHaveBeenCalledWith('circuitBreakerOpened', {
          userId,
          service,
          error
        });
        
        // Should save opened state with next attempt time
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          expect.stringMatching(/"state":"OPEN".*"nextAttemptTime"/)
        );
      });

      it('should trigger emergency stop for critical failures', async () => {
        const userId = 'test-user-6';
        const service = 'connection';
        const criticalError = 'Account suspended due to rate limit violations';
        
        const mockBreaker = {
          state: 'CLOSED',
          failureCount: 4,
          successCount: 0
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.zadd.mockResolvedValue(1);
        mockRedis.zremrangebyrank.mockResolvedValue(0);
        mockRedis.keys.mockResolvedValue([]);
        mockRedis.lpush.mockResolvedValue(1);
        mockRedis.ltrim.mockResolvedValue('OK');
        mockRedis.publish.mockResolvedValue(1);

        await emergencyStopService.recordFailure(userId, service, criticalError);
        
        // Should trigger emergency stop
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expect.any(Number),
          expect.stringContaining('Account suspended')
        );
      });

      it('should immediately reopen circuit breaker from half-open on failure', async () => {
        const userId = 'test-user-7';
        const service = 'follow';
        const error = 'Connection timeout';
        
        const mockBreaker = {
          state: 'HALF_OPEN',
          failureCount: 5,
          successCount: 1
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        
        await emergencyStopService.recordFailure(userId, service, error);
        
        // Should immediately open and reset success count
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          expect.stringMatching(/"state":"OPEN".*"successCount":0/)
        );
      });
    });

    describe('Operation Authorization - Request Gating', () => {
      it('should allow operations when circuit breaker is closed', async () => {
        const userId = 'test-user-8';
        const service = 'connection';
        
        const mockBreaker = {
          state: 'CLOSED',
          failureCount: 2,
          successCount: 0
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        
        const result = await emergencyStopService.isOperationAllowed(userId, service);
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should block operations when circuit breaker is open', async () => {
        const userId = 'test-user-9';
        const service = 'engagement';
        
        const mockBreaker = {
          state: 'OPEN',
          failureCount: 5,
          successCount: 0,
          nextAttemptTime: new Date(Date.now() + 60000) // 1 minute in future
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        
        const result = await emergencyStopService.isOperationAllowed(userId, service);
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Circuit breaker is open');
        expect(result.retryAfter).toBeGreaterThan(0);
      });

      it('should transition to half-open when timeout expires', async () => {
        const userId = 'test-user-10';
        const service = 'profile_view';
        
        const mockBreaker = {
          state: 'OPEN',
          failureCount: 5,
          successCount: 0,
          nextAttemptTime: new Date(Date.now() - 1000) // 1 second in past
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        mockRedis.setex.mockResolvedValue('OK');
        
        const result = await emergencyStopService.isOperationAllowed(userId, service);
        
        expect(result.allowed).toBe(true);
        
        // Should update to half-open state
        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          expect.stringContaining('"state":"HALF_OPEN"')
        );
      });

      it('should allow limited operations in half-open state', async () => {
        const userId = 'test-user-11';
        const service = 'connection';
        
        const mockBreaker = {
          state: 'HALF_OPEN',
          failureCount: 5,
          successCount: 1
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockBreaker));
        
        const result = await emergencyStopService.isOperationAllowed(userId, service);
        
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('Emergency Stop Triggers - Compliance Enforcement', () => {
    describe('Individual User Emergency Stops', () => {
      it('should trigger emergency stop with proper metadata storage', async () => {
        const userId = 'emergency-test-user-1';
        const reason: EmergencyStopReason = {
          type: 'RATE_LIMIT',
          severity: 'HIGH',
          description: 'LinkedIn daily connection limit exceeded',
          metadata: { dailyConnections: 100, limit: 15 },
          autoResumeAfter: 60 // 1 hour
        };
        
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.zadd.mockResolvedValue(1);
        mockRedis.zremrangebyrank.mockResolvedValue(0);
        mockRedis.keys.mockResolvedValue([]);
        mockRedis.lpush.mockResolvedValue(1);
        mockRedis.ltrim.mockResolvedValue('OK');
        mockRedis.publish.mockResolvedValue(1);
        
        await emergencyStopService.triggerEmergencyStop(userId, reason, 'safety-monitor');
        
        // Verify emergency stop status is stored
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expect.any(Number),
          expect.stringMatching(/"active":true.*"reason":.*"RATE_LIMIT"/)
        );
        
        // Verify global emergency stops tracking
        expect(mockRedis.zadd).toHaveBeenCalledWith(
          'global_emergency_stops',
          expect.any(Number),
          expect.stringContaining(userId)
        );
        
        // Verify WebSocket notification
        expect(mockRedis.publish).toHaveBeenCalledWith(
          'emergency_stops',
          expect.stringMatching(/"action":"triggered".*"userId":".*emergency-test-user-1"/)
        );
        
        // Verify event emission
        expect(mockEmit).toHaveBeenCalledWith('emergencyStopTriggered', expect.objectContaining({
          userId,
          active: true,
          reason
        }));
      });

      it('should set correct TTL based on auto-resume time', async () => {
        const userId = 'emergency-test-user-2';
        const reasonWithAutoResume: EmergencyStopReason = {
          type: 'API_ERROR',
          severity: 'MEDIUM',
          description: 'Temporary API errors',
          autoResumeAfter: 30 // 30 minutes
        };
        
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.zadd.mockResolvedValue(1);
        mockRedis.zremrangebyrank.mockResolvedValue(0);
        mockRedis.keys.mockResolvedValue([]);
        mockRedis.lpush.mockResolvedValue(1);
        mockRedis.ltrim.mockResolvedValue('OK');
        mockRedis.publish.mockResolvedValue(1);
        
        await emergencyStopService.triggerEmergencyStop(userId, reasonWithAutoResume);
        
        // TTL should be autoResumeAfter + 1 hour buffer in seconds
        const expectedTTL = (30 + 60) * 60; // (30 + 60) minutes in seconds
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expectedTTL,
          expect.any(String)
        );
      });

      it('should require manual resume for critical violations', async () => {
        const userId = 'emergency-test-user-3';
        const criticalReason: EmergencyStopReason = {
          type: 'COMPLIANCE_VIOLATION',
          severity: 'CRITICAL',
          description: 'Detected bot-like behavior patterns',
          metadata: { pattern: 'regular_intervals', confidence: 0.95 },
          autoResumeAfter: null // Manual resume required
        };
        
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.zadd.mockResolvedValue(1);
        mockRedis.zremrangebyrank.mockResolvedValue(0);
        mockRedis.keys.mockResolvedValue([]);
        mockRedis.lpush.mockResolvedValue(1);
        mockRedis.ltrim.mockResolvedValue('OK');
        mockRedis.publish.mockResolvedValue(1);
        
        await emergencyStopService.triggerEmergencyStop(userId, criticalReason);
        
        // Should set long TTL for manual resume (7 days)
        const expectedTTL = 7 * 24 * 60 * 60; // 7 days in seconds
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `emergency_stop:${userId}`,
          expectedTTL,
          expect.stringContaining('"manualResumeRequired":true')
        );
      });
    });

    describe('Emergency Stop Status Retrieval', () => {
      it('should return null when no emergency stop is active', async () => {
        const userId = 'no-emergency-user';
        
        mockRedis.get.mockResolvedValue(null);
        
        const status = await emergencyStopService.getEmergencyStopStatus(userId);
        
        expect(status).toBeNull();
      });

      it('should return active emergency stop status', async () => {
        const userId = 'active-emergency-user';
        const mockStatus: EmergencyStopStatus = {
          userId,
          active: true,
          reason: {
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'HIGH',
            description: 'Unusual activity patterns detected',
            autoResumeAfter: 120
          },
          triggeredAt: new Date('2025-01-29T10:00:00Z'),
          triggeredBy: 'safety-monitor',
          manualResumeRequired: false,
          estimatedResumeTime: new Date('2025-01-29T12:00:00Z')
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockStatus));
        
        const status = await emergencyStopService.getEmergencyStopStatus(userId);
        
        expect(status).toEqual(expect.objectContaining({
          userId,
          active: true,
          reason: expect.objectContaining({
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'HIGH'
          })
        }));
      });

      it('should auto-resume when estimated time has passed', async () => {
        const userId = 'auto-resume-user';
        const pastResumeTime = new Date(Date.now() - 60000); // 1 minute ago
        
        const mockStatus: EmergencyStopStatus = {
          userId,
          active: true,
          reason: {
            type: 'API_ERROR',
            severity: 'MEDIUM',
            description: 'Temporary API issues',
            autoResumeAfter: 30
          },
          triggeredAt: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
          triggeredBy: 'system',
          manualResumeRequired: false,
          estimatedResumeTime: pastResumeTime
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockStatus));
        mockRedis.del.mockResolvedValue(1);
        mockRedis.keys.mockResolvedValue([]);
        mockRedis.lpush.mockResolvedValue(1);
        mockRedis.ltrim.mockResolvedValue('OK');
        mockRedis.publish.mockResolvedValue(1);
        
        const status = await emergencyStopService.getEmergencyStopStatus(userId);
        
        // Should auto-resume and return null
        expect(status).toBeNull();
        expect(mockRedis.del).toHaveBeenCalledWith(`emergency_stop:${userId}`);
      });
    });

    describe('Manual Resume Functionality', () => {
      it('should successfully resume automation with manual intervention', async () => {
        const userId = 'manual-resume-user';
        const mockStatus: EmergencyStopStatus = {
          userId,
          active: true,
          reason: {
            type: 'RATE_LIMIT',
            severity: 'HIGH',
            description: 'Rate limit exceeded',
            autoResumeAfter: 60
          },
          triggeredAt: new Date(),
          triggeredBy: 'system',
          manualResumeRequired: false
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockStatus));
        mockRedis.del.mockResolvedValue(1);
        mockRedis.keys.mockResolvedValue([]);
        mockRedis.lpush.mockResolvedValue(1);
        mockRedis.ltrim.mockResolvedValue('OK');
        mockRedis.publish.mockResolvedValue(1);
        
        const result = await emergencyStopService.resumeAutomation(
          userId,
          'admin-user',
          'Manual review completed'
        );
        
        expect(result.success).toBe(true);
        expect(result.message).toContain('successfully');
        
        // Should remove emergency stop
        expect(mockRedis.del).toHaveBeenCalledWith(`emergency_stop:${userId}`);
        
        // Should log resume action
        expect(mockRedis.lpush).toHaveBeenCalledWith(
          `automation_resume_log:${userId}`,
          expect.stringContaining('"resumedBy":"admin-user"')
        );
        
        // Should notify WebSocket
        expect(mockRedis.publish).toHaveBeenCalledWith(
          'emergency_stops',
          expect.stringContaining('"action":"resumed"')
        );
      });

      it('should reject resume when no emergency stop is active', async () => {
        const userId = 'no-stop-user';
        
        mockRedis.get.mockResolvedValue(null);
        
        const result = await emergencyStopService.resumeAutomation(userId, 'admin');
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('No active emergency stop');
      });

      it('should reject system resume when manual resume is required', async () => {
        const userId = 'manual-required-user';
        const mockStatus: EmergencyStopStatus = {
          userId,
          active: true,
          reason: {
            type: 'COMPLIANCE_VIOLATION',
            severity: 'CRITICAL',
            description: 'Critical compliance violation',
            autoResumeAfter: null
          },
          triggeredAt: new Date(),
          triggeredBy: 'system',
          manualResumeRequired: true
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockStatus));
        
        const result = await emergencyStopService.resumeAutomation(userId, 'system');
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Manual resume required');
      });

      it('should perform safety checks before manual resume', async () => {
        const userId = 'safety-check-user';
        const mockStatus: EmergencyStopStatus = {
          userId,
          active: true,
          reason: {
            type: 'SUSPICIOUS_ACTIVITY',
            severity: 'HIGH',
            description: 'Suspicious patterns',
            autoResumeAfter: 120
          },
          triggeredAt: new Date(),
          triggeredBy: 'system',
          manualResumeRequired: false
        };
        
        mockRedis.get.mockResolvedValue(JSON.stringify(mockStatus));
        
        // Mock high failure rate to fail safety check
        mockRedis.lrange.mockResolvedValue([]);
        jest.spyOn(emergencyStopService as any, 'getRecentFailureRate')
          .mockResolvedValue(0.8); // 80% failure rate
        
        const result = await emergencyStopService.resumeAutomation(
          userId,
          'admin-user',
          'Force resume attempt'
        );
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('High recent failure rate');
      });
    });
  });

  describe('System-Wide Emergency Stop - Crisis Management', () => {
    it('should trigger system-wide emergency stop for all active users', async () => {
      const activeUsers = ['user-1', 'user-2', 'user-3'];
      const reason = 'LinkedIn API outage detected';
      const triggeredBy = 'system-admin';
      
      // Mock active users
      mockRedis.keys.mockResolvedValue(
        activeUsers.map(userId => `automation_status:${userId}`)
      );
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      const result = await emergencyStopService.triggerSystemWideEmergencyStop(
        reason,
        triggeredBy,
        activeUsers
      );
      
      expect(result.success).toBe(true);
      expect(result.affectedUsers).toBe(3);
      expect(result.message).toContain('System-wide emergency stop activated');
      
      // Should trigger emergency stop for each user
      expect(mockRedis.setex).toHaveBeenCalledTimes(3);
      
      // Should publish system-wide notification
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'system_emergency_stop',
        expect.stringContaining(reason)
      );
    });

    it('should handle partial failures gracefully in system-wide stop', async () => {
      const activeUsers = ['user-1', 'user-2', 'user-3'];
      const reason = 'Critical security incident';
      const triggeredBy = 'security-team';
      
      mockRedis.keys.mockResolvedValue(
        activeUsers.map(userId => `automation_status:${userId}`)
      );
      
      // Mock failure for one user
      mockRedis.setex
        .mockResolvedValueOnce('OK')
        .mockRejectedValueOnce(new Error('Redis connection failed'))
        .mockResolvedValueOnce('OK');
      
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      const result = await emergencyStopService.triggerSystemWideEmergencyStop(
        reason,
        triggeredBy,
        activeUsers
      );
      
      expect(result.success).toBe(true);
      expect(result.affectedUsers).toBe(2); // Only 2 succeeded
      expect(result.message).toContain('2 users');
    });
  });

  describe('Dashboard and Monitoring - Operational Visibility', () => {
    it('should generate comprehensive emergency stop dashboard', async () => {
      // Mock recent emergency stops
      const mockRecentStops = [
        JSON.stringify({ userId: 'user-1', reason: 'RATE_LIMIT', severity: 'HIGH' }),
        '1643284800000', // timestamp
        JSON.stringify({ userId: 'user-2', reason: 'API_ERROR', severity: 'MEDIUM' }),
        '1643284700000',
        JSON.stringify({ userId: 'user-3', reason: 'COMPLIANCE_VIOLATION', severity: 'CRITICAL' }),
        '1643284600000'
      ];
      
      mockRedis.zrevrange.mockResolvedValue(mockRecentStops);
      mockRedis.keys
        .mockResolvedValueOnce(['emergency_stop:user-1', 'emergency_stop:user-2']) // Active stops
        .mockResolvedValueOnce([ // Circuit breakers
          'circuit_breaker:user-1:connection',
          'circuit_breaker:user-2:engagement'
        ]);
      
      // Mock circuit breaker states
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ state: 'OPEN' }))
        .mockResolvedValueOnce(JSON.stringify({ state: 'CLOSED' }));
      
      const dashboard = await emergencyStopService.getEmergencyStopDashboard();
      
      expect(dashboard.activeStops).toBe(2);
      expect(dashboard.stopsByType).toEqual({
        'RATE_LIMIT': 1,
        'API_ERROR': 1,
        'COMPLIANCE_VIOLATION': 1
      });
      expect(dashboard.stopsBySeverity).toEqual({
        'HIGH': 1,
        'MEDIUM': 1,
        'CRITICAL': 1
      });
      expect(dashboard.recentStops).toHaveLength(3);
      expect(dashboard.circuitBreakerStats).toEqual({
        open: 1,
        halfOpen: 0,
        closed: 1
      });
    });

    it('should handle malformed data gracefully in dashboard', async () => {
      // Mock corrupted data
      const corruptedStops = [
        'invalid-json',
        '1643284800000',
        JSON.stringify({ valid: true }),
        'invalid-timestamp'
      ];
      
      mockRedis.zrevrange.mockResolvedValue(corruptedStops);
      mockRedis.keys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['circuit_breaker:corrupt']);
      
      mockRedis.get.mockResolvedValue('invalid-json');
      
      const dashboard = await emergencyStopService.getEmergencyStopDashboard();
      
      // Should not throw error and provide reasonable defaults
      expect(dashboard).toBeDefined();
      expect(dashboard.activeStops).toBe(0);
      expect(dashboard.recentStops).toBeInstanceOf(Array);
      expect(dashboard.circuitBreakerStats).toEqual({
        open: 0,
        halfOpen: 0,
        closed: 0
      });
    });
  });

  describe('Maintenance and Monitoring - Background Operations', () => {
    it('should perform periodic maintenance tasks', async () => {
      // Mock emergency stops ready for auto-resume
      const expiredStopKey = 'emergency_stop:expired-user';
      const futureStopKey = 'emergency_stop:future-user';
      
      mockRedis.keys.mockResolvedValue([expiredStopKey, futureStopKey]);
      
      const expiredStatus = {
        userId: 'expired-user',
        active: true,
        manualResumeRequired: false,
        estimatedResumeTime: new Date(Date.now() - 60000) // 1 minute ago
      };
      
      const futureStatus = {
        userId: 'future-user',
        active: true,
        manualResumeRequired: false,
        estimatedResumeTime: new Date(Date.now() + 60000) // 1 minute from now
      };
      
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(expiredStatus))
        .mockResolvedValueOnce(JSON.stringify(futureStatus));
      
      mockRedis.del.mockResolvedValue(1);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      // Call maintenance directly (normally called by interval)
      await (emergencyStopService as any).performMaintenanceTasks();
      
      // Should resume expired emergency stop
      expect(mockRedis.del).toHaveBeenCalledWith('emergency_stop:expired-user');
      
      // Should not resume future emergency stop
      expect(mockRedis.del).not.toHaveBeenCalledWith('emergency_stop:future-user');
    });

    it('should cleanup old circuit breakers', async () => {
      const oldBreakerKey = 'circuit_breaker:old-user:connection';
      const recentBreakerKey = 'circuit_breaker:recent-user:engagement';
      
      mockRedis.keys.mockResolvedValue([oldBreakerKey, recentBreakerKey]);
      
      const oldBreaker = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      const recentBreaker = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
      };
      
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(oldBreaker))
        .mockResolvedValueOnce(JSON.stringify(recentBreaker));
      
      mockRedis.del.mockResolvedValue(1);
      
      await (emergencyStopService as any).cleanupOldCircuitBreakers();
      
      // Should delete old circuit breaker
      expect(mockRedis.del).toHaveBeenCalledWith(oldBreakerKey);
      
      // Should not delete recent circuit breaker
      expect(mockRedis.del).not.toHaveBeenCalledWith(recentBreakerKey);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle Redis connection failures gracefully', async () => {
      const userId = 'redis-error-user';
      const service = 'connection';
      
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      // Should not throw error
      const result = await emergencyStopService.isOperationAllowed(userId, service);
      
      expect(result).toBeDefined();
      expect(result.allowed).toBe(true); // Default to allow on error
    });

    it('should handle emergency stop trigger failures', async () => {
      const userId = 'trigger-error-user';
      const reason: EmergencyStopReason = {
        type: 'RATE_LIMIT',
        severity: 'HIGH',
        description: 'Test error scenario',
        autoResumeAfter: 60
      };
      
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));
      
      // Should throw error for critical operations
      await expect(
        emergencyStopService.triggerEmergencyStop(userId, reason)
      ).rejects.toThrow('Redis write failed');
    });

    it('should handle corrupted emergency stop data', async () => {
      const userId = 'corrupted-data-user';
      
      // Mock corrupted JSON data
      mockRedis.get.mockResolvedValue('invalid-json-data');
      
      const status = await emergencyStopService.getEmergencyStopStatus(userId);
      
      // Should return null for corrupted data
      expect(status).toBeNull();
    });

    it('should handle dashboard generation errors', async () => {
      mockRedis.zrevrange.mockRejectedValue(new Error('Redis query failed'));
      
      // Should throw error for dashboard (operational visibility is critical)
      await expect(
        emergencyStopService.getEmergencyStopDashboard()
      ).rejects.toThrow('Redis query failed');
    });
  });

  describe('Integration with LinkedIn Compliance - End-to-End Scenarios', () => {
    it('should execute complete compliance violation workflow', async () => {
      const userId = 'compliance-test-user';
      const service = 'connection';
      
      // Step 1: Record multiple failures leading to circuit breaker opening
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'CLOSED',
        failureCount: 4,
        successCount: 0
      }));
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      const circuitOpened = await emergencyStopService.recordFailure(
        userId,
        service,
        'LinkedIn API rate limit exceeded'
      );
      
      expect(circuitOpened).toBe(true);
      
      // Step 2: Verify circuit breaker blocks subsequent operations
      mockRedis.get.mockResolvedValue(JSON.stringify({
        state: 'OPEN',
        failureCount: 5,
        nextAttemptTime: new Date(Date.now() + 300000) // 5 minutes
      }));
      
      const blockResult = await emergencyStopService.isOperationAllowed(userId, service);
      expect(blockResult.allowed).toBe(false);
      
      // Step 3: Verify emergency stop was triggered
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `emergency_stop:${userId}`,
        expect.any(Number),
        expect.stringContaining('API_ERROR')
      );
      
      // Step 4: Verify WebSocket notification was sent
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'emergency_stops',
        expect.stringContaining('"action":"triggered"')
      );
    });

    it('should handle successful recovery after emergency stop', async () => {
      const userId = 'recovery-test-user';
      const service = 'engagement';
      
      // Step 1: Set up emergency stop that's ready for auto-resume
      const pastResumeTime = new Date(Date.now() - 60000);
      const emergencyStatus = {
        userId,
        active: true,
        manualResumeRequired: false,
        estimatedResumeTime: pastResumeTime,
        reason: {
          type: 'API_ERROR',
          severity: 'MEDIUM',
          autoResumeAfter: 30
        }
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(emergencyStatus));
      mockRedis.del.mockResolvedValue(1);
      mockRedis.keys.mockResolvedValue([`circuit_breaker:${userId}:${service}`]);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      // Step 2: Check emergency stop status (should auto-resume)
      const status = await emergencyStopService.getEmergencyStopStatus(userId);
      expect(status).toBeNull(); // Auto-resumed
      
      // Step 3: Verify circuit breakers were reset
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `circuit_breaker:${userId}:${service}`,
        expect.any(Number),
        expect.stringContaining('"state":"CLOSED"')
      );
      
      // Step 4: Record successful operation to validate recovery
      await emergencyStopService.recordSuccess(userId, service);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining(`circuit_breaker:${userId}:${service}`),
        expect.any(Number),
        expect.stringContaining('"successCount":1')
      );
    });

    it('should enforce manual intervention for critical compliance violations', async () => {
      const userId = 'critical-violation-user';
      const criticalReason: EmergencyStopReason = {
        type: 'COMPLIANCE_VIOLATION',
        severity: 'CRITICAL',
        description: 'Bot-like behavior detected - manual review required',
        metadata: {
          pattern: 'regular_intervals',
          confidence: 0.98,
          violations: ['timing_pattern', 'volume_spike', 'success_rate']
        },
        autoResumeAfter: null // Manual resume required
      };
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zremrangebyrank.mockResolvedValue(0);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.lpush.mockResolvedValue(1);
      mockRedis.ltrim.mockResolvedValue('OK');
      mockRedis.publish.mockResolvedValue(1);
      
      // Step 1: Trigger critical emergency stop
      await emergencyStopService.triggerEmergencyStop(userId, criticalReason, 'ai-monitor');
      
      // Step 2: Verify manual resume requirement
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId,
        active: true,
        manualResumeRequired: true,
        reason: criticalReason
      }));
      
      // Step 3: Attempt system auto-resume (should fail)
      const autoResumeResult = await emergencyStopService.resumeAutomation(userId, 'system');
      expect(autoResumeResult.success).toBe(false);
      expect(autoResumeResult.message).toContain('Manual resume required');
      
      // Step 4: Manual resume by authorized user
      mockRedis.del.mockResolvedValue(1);
      
      const manualResumeResult = await emergencyStopService.resumeAutomation(
        userId,
        'compliance-officer',
        'Reviewed and approved after security audit'
      );
      
      expect(manualResumeResult.success).toBe(true);
      
      // Step 5: Verify resume was logged with proper attribution
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        `automation_resume_log:${userId}`,
        expect.stringContaining('"resumedBy":"compliance-officer"')
      );
    });
  });
});

describe('EmergencyStopService - Load and Stress Testing', () => {
  let emergencyStopService: EmergencyStopService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      zadd: jest.fn(),
      zrevrange: jest.fn(),
      zremrangebyrank: jest.fn(),
      publish: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);
    
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    emergencyStopService = new EmergencyStopService();
  });

  afterEach(async () => {
    await emergencyStopService.cleanup();
    jest.restoreAllMocks();
  });

  it('should handle concurrent circuit breaker operations', async () => {
    const userId = 'concurrent-test-user';
    const services = ['connection', 'engagement', 'profile_view', 'follow'];
    
    mockRedis.get.mockResolvedValue(JSON.stringify({
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0
    }));
    mockRedis.setex.mockResolvedValue('OK');
    
    // Fire 20 concurrent operations across different services
    const operations = [];
    for (let i = 0; i < 20; i++) {
      const service = services[i % services.length] as any;
      operations.push(
        emergencyStopService.recordSuccess(userId, service)
      );
    }
    
    // All operations should complete without error
    await expect(Promise.all(operations)).resolves.not.toThrow();
    
    // Verify Redis was called for each operation
    expect(mockRedis.setex).toHaveBeenCalledTimes(20);
  });

  it('should handle high-frequency emergency stop triggers', async () => {
    const users = Array.from({ length: 50 }, (_, i) => `stress-user-${i}`);
    const reason: EmergencyStopReason = {
      type: 'SYSTEM_OVERLOAD',
      severity: 'HIGH',
      description: 'Load test emergency stop',
      autoResumeAfter: 15
    };
    
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.zremrangebyrank.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.lpush.mockResolvedValue(1);
    mockRedis.ltrim.mockResolvedValue('OK');
    mockRedis.publish.mockResolvedValue(1);
    
    const startTime = Date.now();
    
    // Trigger emergency stops for all users concurrently
    const emergencyPromises = users.map(userId =>
      emergencyStopService.triggerEmergencyStop(userId, reason, 'load-test')
    );
    
    await Promise.all(emergencyPromises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (5 seconds for 50 operations)
    expect(duration).toBeLessThan(5000);
    
    // Each user should have emergency stop triggered
    expect(mockRedis.setex).toHaveBeenCalledTimes(50);
  });

  it('should maintain performance under dashboard query load', async () => {
    // Mock large dataset
    const mockLargeDataset = Array.from({ length: 100 }, (_, i) => [
      JSON.stringify({ userId: `user-${i}`, reason: 'RATE_LIMIT', severity: 'HIGH' }),
      (Date.now() - i * 1000).toString()
    ]).flat();
    
    mockRedis.zrevrange.mockResolvedValue(mockLargeDataset);
    mockRedis.keys
      .mockResolvedValueOnce(Array.from({ length: 25 }, (_, i) => `emergency_stop:user-${i}`))
      .mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => `circuit_breaker:user-${i}:connection`));
    
    // Mock circuit breaker states
    mockRedis.get.mockImplementation(() => 
      Promise.resolve(JSON.stringify({ state: 'CLOSED' }))
    );
    
    const startTime = Date.now();
    
    // Fire 10 concurrent dashboard requests
    const dashboardPromises = Array.from({ length: 10 }, () =>
      emergencyStopService.getEmergencyStopDashboard()
    );
    
    const results = await Promise.all(dashboardPromises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within 3 seconds
    expect(duration).toBeLessThan(3000);
    
    // All results should be consistent
    results.forEach(result => {
      expect(result.activeStops).toBe(25);
      expect(result.recentStops).toHaveLength(20); // Dashboard limit
    });
  });
});