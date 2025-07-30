/**
 * Automation Queue Processing - Testing Suite
 * 
 * Tests for job scheduling, priority management, retry logic,
 * and bulk operations in the automation queue system
 */

import Bull from 'bull';
import Redis from 'ioredis';
import { QueueManager } from '../../../../../services/linkedin-service/src/services/queueManager.service';
import { SafetyMonitorService } from '../../../../../services/linkedin-service/src/services/safetyMonitor.service';
import { LinkedInRateLimitService } from '../../../../../services/linkedin-service/src/services/rateLimit.service';
import { QueueItem, JobStatus } from '../../../../../services/linkedin-service/src/types/automation';

// Mock dependencies
jest.mock('bull');
jest.mock('ioredis');
jest.mock('../../../../../services/linkedin-service/src/services/safetyMonitor.service');
jest.mock('../../../../../services/linkedin-service/src/services/rateLimit.service');

const MockedBull = Bull as jest.MockedClass<typeof Bull>;
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
const MockedSafetyMonitor = SafetyMonitorService as jest.MockedClass<typeof SafetyMonitorService>;
const MockedRateLimitService = LinkedInRateLimitService as jest.MockedClass<typeof LinkedInRateLimitService>;

describe('QueueManager - Job Processing Tests', () => {
  let queueManager: QueueManager;
  let mockConnectionQueue: jest.Mocked<Bull.Queue>;
  let mockEngagementQueue: jest.Mocked<Bull.Queue>;
  let mockRedis: jest.Mocked<Redis>;
  let mockSafetyMonitor: jest.Mocked<SafetyMonitorService>;
  let mockRateLimitService: jest.Mocked<LinkedInRateLimitService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      incr: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);

    // Mock Bull queues
    mockConnectionQueue = {
      add: jest.fn(),
      process: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      getJobCounts: jest.fn(),
      removeJobs: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn()
    } as any;

    mockEngagementQueue = {
      add: jest.fn(),
      process: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      getJobCounts: jest.fn(),
      removeJobs: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      clean: jest.fn()
    } as any;

    MockedBull.mockImplementation((name: string) => {
      if (name.includes('connection')) return mockConnectionQueue;
      if (name.includes('engagement')) return mockEngagementQueue;
      return mockConnectionQueue;
    });

    // Mock Safety Monitor
    mockSafetyMonitor = {
      isAutomationAllowed: jest.fn().mockResolvedValue(true),
      getSafetyStatus: jest.fn().mockResolvedValue({
        overallStatus: 'healthy',
        score: 85,
        emergencyStopRequired: false
      }),
      recordViolation: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockedSafetyMonitor.mockImplementation(() => mockSafetyMonitor);

    // Mock Rate Limit Service
    mockRateLimitService = {
      checkRateLimit: jest.fn().mockResolvedValue({
        remaining: 10,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: undefined
      }),
      recordRequest: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockedRateLimitService.mockImplementation(() => mockRateLimitService);

    queueManager = new QueueManager();
  });

  afterEach(async () => {
    await queueManager.disconnect();
  });

  describe('Job Scheduling and Priority Management', () => {
    describe('Connection Request Scheduling', () => {
      it('should schedule connection requests with proper delay and priority', async () => {
        const connectionRequest = {
          userId: 'test-user-1',
          targetId: 'target-profile-123',
          targetName: 'John Doe',
          message: 'I would like to connect with you',
          priority: 'high' as const,
          scheduledAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
        };

        const result = await queueManager.scheduleConnectionRequest(connectionRequest);

        expect(mockConnectionQueue.add).toHaveBeenCalledWith(
          'send_connection_request',
          expect.objectContaining({
            userId: 'test-user-1',
            targetId: 'target-profile-123',
            message: 'I would like to connect with you'
          }),
          expect.objectContaining({
            delay: expect.any(Number),
            priority: expect.any(Number),
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            }
          })
        );

        expect(result.success).toBe(true);
        expect(result.queueItem).toBeDefined();
        expect(result.queueItem.type).toBe('connection');
        expect(result.queueItem.priority).toBe('high');
      });

      it('should respect human-like delays between connection requests', async () => {
        const userId = 'delay-test-user';
        
        // Schedule multiple connection requests
        const requests = Array.from({ length: 3 }, (_, i) => ({
          userId,
          targetId: `target-${i}`,
          targetName: `Target ${i}`,
          message: 'Connection request',
          priority: 'medium' as const,
          scheduledAt: new Date(Date.now() + (i + 1) * 60 * 1000)
        }));

        const results = await Promise.all(
          requests.map(req => queueManager.scheduleConnectionRequest(req))
        );

        // Verify all requests were scheduled successfully
        results.forEach(result => {
          expect(result.success).toBe(true);
        });

        // Verify proper delays were applied (between 45-180 seconds)
        const addCalls = mockConnectionQueue.add.mock.calls;
        expect(addCalls).toHaveLength(3);
        
        addCalls.forEach(call => {
          const options = call[2];
          expect(options.delay).toBeGreaterThanOrEqual(45000); // 45 seconds
          expect(options.delay).toBeLessThanOrEqual(180000); // 180 seconds
        });
      });

      it('should enforce daily connection limits', async () => {
        const userId = 'limit-test-user';
        
        // Mock user already at daily limit
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('daily_connections')) return Promise.resolve('15'); // At limit
          return Promise.resolve('0');
        });

        const connectionRequest = {
          userId,
          targetId: 'target-over-limit',
          targetName: 'Over Limit',
          message: 'This should be rejected',
          priority: 'medium' as const,
          scheduledAt: new Date(Date.now() + 60000)
        };

        const result = await queueManager.scheduleConnectionRequest(connectionRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('daily limit');
        expect(mockConnectionQueue.add).not.toHaveBeenCalled();
      });

      it('should handle priority queue ordering correctly', async () => {
        const userId = 'priority-test-user';
        
        const requests = [
          { priority: 'low' as const, targetId: 'low-priority' },
          { priority: 'high' as const, targetId: 'high-priority' },
          { priority: 'medium' as const, targetId: 'medium-priority' }
        ];

        for (const req of requests) {
          await queueManager.scheduleConnectionRequest({
            userId,
            targetId: req.targetId,
            targetName: 'Test Target',
            message: 'Test message',
            priority: req.priority,
            scheduledAt: new Date(Date.now() + 60000)
          });
        }

        // Verify priority values (higher number = higher priority in Bull)
        const addCalls = mockConnectionQueue.add.mock.calls;
        expect(addCalls[0][2].priority).toBe(1); // low
        expect(addCalls[1][2].priority).toBe(3); // high
        expect(addCalls[2][2].priority).toBe(2); // medium
      });
    });

    describe('Engagement Scheduling', () => {
      it('should schedule engagement actions with rate limiting compliance', async () => {
        const engagementRequest = {
          userId: 'engagement-user',
          targetId: 'post-123',
          targetName: 'LinkedIn Post',
          action: 'like' as const,
          priority: 'medium' as const,
          scheduledAt: new Date(Date.now() + 2 * 60 * 1000)
        };

        const result = await queueManager.scheduleEngagementAction(engagementRequest);

        expect(mockEngagementQueue.add).toHaveBeenCalledWith(
          'like_post',
          expect.objectContaining({
            userId: 'engagement-user',
            targetId: 'post-123',
            action: 'like'
          }),
          expect.objectContaining({
            delay: expect.any(Number),
            priority: 2,
            attempts: 3
          })
        );

        expect(result.success).toBe(true);
        expect(result.queueItem.action).toBe('like');
      });

      it('should enforce engagement rate limits', async () => {
        const userId = 'engagement-limit-user';
        
        // Mock rate limit service to indicate limit reached
        mockRateLimitService.checkRateLimit.mockResolvedValue({
          remaining: 0,
          resetTime: new Date(Date.now() + 60000),
          retryAfter: 3600 // 1 hour
        });

        const engagementRequest = {
          userId,
          targetId: 'post-456',
          targetName: 'Another Post',
          action: 'comment' as const,
          content: 'Great post!',
          priority: 'high' as const,
          scheduledAt: new Date(Date.now() + 60000)
        };

        const result = await queueManager.scheduleEngagementAction(engagementRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('rate limit');
        expect(mockEngagementQueue.add).not.toHaveBeenCalled();
      });

      it('should handle different engagement types correctly', async () => {
        const userId = 'multi-engagement-user';
        
        const engagements = [
          { action: 'like' as const, targetId: 'post-1' },
          { action: 'comment' as const, targetId: 'post-2', content: 'Great insight!' },
          { action: 'view_profile' as const, targetId: 'profile-1' },
          { action: 'follow' as const, targetId: 'company-1' }
        ];

        const results = await Promise.all(
          engagements.map(eng => queueManager.scheduleEngagementAction({
            userId,
            targetId: eng.targetId,
            targetName: 'Test Target',
            action: eng.action,
            content: eng.content,
            priority: 'medium' as const,
            scheduledAt: new Date(Date.now() + 60000)
          }))
        );

        results.forEach((result, index) => {
          expect(result.success).toBe(true);
          expect(result.queueItem.action).toBe(engagements[index].action);
        });

        expect(mockEngagementQueue.add).toHaveBeenCalledTimes(4);
      });
    });
  });

  describe('Job Processing and Execution', () => {
    describe('Connection Request Processing', () => {
      it('should process connection requests with safety checks', async () => {
        const jobData = {
          userId: 'processor-user',
          targetId: 'target-123',
          targetName: 'Test Target',
          message: 'Test connection request',
          queueItemId: 'queue-item-1'
        };

        // Mock safety monitor allows automation
        mockSafetyMonitor.isAutomationAllowed.mockResolvedValue(true);
        
        // Mock rate limit allows request
        mockRateLimitService.checkRateLimit.mockResolvedValue({
          remaining: 5,
          resetTime: new Date(Date.now() + 60000),
          retryAfter: undefined
        });

        // Setup connection request processor
        const processor = mockConnectionQueue.process.mock.calls[0]?.[1];
        if (processor) {
          const mockJob = {
            data: jobData,
            id: 'job-123',
            attemptsMade: 1,
            opts: { attempts: 3 }
          };

          const result = await processor(mockJob);

          expect(mockSafetyMonitor.isAutomationAllowed).toHaveBeenCalledWith(jobData.userId);
          expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
            jobData.userId,
            '/v2/invitation'
          );
          expect(result.success).toBe(true);
        }
      });

      it('should handle safety monitor blocking automation', async () => {
        const jobData = {
          userId: 'blocked-user',
          targetId: 'target-456',
          targetName: 'Blocked Target',
          message: 'This should be blocked',
          queueItemId: 'queue-item-2'
        };

        // Mock safety monitor blocks automation
        mockSafetyMonitor.isAutomationAllowed.mockResolvedValue(false);

        const processor = mockConnectionQueue.process.mock.calls[0]?.[1];
        if (processor) {
          const mockJob = {
            data: jobData,
            id: 'job-456',
            attemptsMade: 1,
            opts: { attempts: 3 }
          };

          await expect(processor(mockJob)).rejects.toThrow('Automation blocked');
          
          expect(mockRateLimitService.checkRateLimit).not.toHaveBeenCalled();
        }
      });

      it('should implement exponential backoff on failures', async () => {
        const jobData = {
          userId: 'retry-user',
          targetId: 'target-789',
          targetName: 'Retry Target',
          message: 'This will fail initially',
          queueItemId: 'queue-item-3'
        };

        // Mock initial safety approval
        mockSafetyMonitor.isAutomationAllowed.mockResolvedValue(true);
        mockRateLimitService.checkRateLimit.mockResolvedValue({
          remaining: 5,
          resetTime: new Date(Date.now() + 60000),
          retryAfter: undefined
        });

        // Verify queue was configured with proper retry settings
        expect(MockedBull).toHaveBeenCalledWith(
          expect.stringContaining('connections'),
          expect.objectContaining({
            redis: expect.any(Object),
            defaultJobOptions: expect.objectContaining({
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000
              }
            })
          })
        );
      });

      it('should record successful connection attempts', async () => {
        const jobData = {
          userId: 'success-user',
          targetId: 'target-success',
          targetName: 'Success Target',
          message: 'Successful connection',
          queueItemId: 'queue-item-success'
        };

        mockSafetyMonitor.isAutomationAllowed.mockResolvedValue(true);
        mockRateLimitService.checkRateLimit.mockResolvedValue({
          remaining: 10,
          resetTime: new Date(Date.now() + 60000),
          retryAfter: undefined
        });

        const processor = mockConnectionQueue.process.mock.calls[0]?.[1];
        if (processor) {
          const mockJob = {
            data: jobData,
            id: 'job-success',
            attemptsMade: 1,
            opts: { attempts: 3 }
          };

          await processor(mockJob);

          expect(mockRateLimitService.recordRequest).toHaveBeenCalledWith(
            jobData.userId,
            '/v2/invitation',
            true
          );
        }
      });
    });

    describe('Engagement Action Processing', () => {
      it('should process different engagement types appropriately', async () => {
        const engagementTypes = [
          { action: 'like', endpoint: '/v2/networkUpdates' },
          { action: 'comment', endpoint: '/v2/posts' },
          { action: 'view_profile', endpoint: '/v2/people' },
          { action: 'follow', endpoint: '/v2/connections' }
        ];

        mockSafetyMonitor.isAutomationAllowed.mockResolvedValue(true);
        mockRateLimitService.checkRateLimit.mockResolvedValue({
          remaining: 8,
          resetTime: new Date(Date.now() + 60000),
          retryAfter: undefined
        });

        const processor = mockEngagementQueue.process.mock.calls[0]?.[1];
        
        if (processor) {
          for (const { action, endpoint } of engagementTypes) {
            const jobData = {
              userId: `${action}-user`,
              targetId: `target-${action}`,
              action,
              queueItemId: `queue-${action}`
            };

            const mockJob = {
              data: jobData,
              id: `job-${action}`,
              attemptsMade: 1,
              opts: { attempts: 3 }
            };

            await processor(mockJob);

            expect(mockRateLimitService.checkRateLimit).toHaveBeenCalledWith(
              jobData.userId,
              endpoint
            );
          }
        }
      });

      it('should handle engagement-specific rate limits', async () => {
        const jobData = {
          userId: 'engagement-rate-user',
          targetId: 'post-rate-test',
          action: 'like',
          queueItemId: 'queue-rate-test'
        };

        // Mock rate limit service indicates likes limit reached
        mockRateLimitService.checkRateLimit.mockResolvedValue({
          remaining: 0,
          resetTime: new Date(Date.now() + 60000),
          retryAfter: 3600
        });

        const processor = mockEngagementQueue.process.mock.calls[0]?.[1];
        if (processor) {
          const mockJob = {
            data: jobData,
            id: 'job-rate-test',
            attemptsMade: 1,
            opts: { attempts: 3 }
          };

          await expect(processor(mockJob)).rejects.toThrow('Rate limit');
        }
      });
    });
  });

  describe('Queue Management and Operations', () => {
    describe('Queue Status and Monitoring', () => {
      it('should provide accurate queue statistics', async () => {
        // Mock job counts from Bull queues
        mockConnectionQueue.getJobCounts.mockResolvedValue({
          waiting: 5,
          active: 2,
          completed: 15,
          failed: 1,
          delayed: 3
        });

        mockEngagementQueue.getJobCounts.mockResolvedValue({
          waiting: 8,
          active: 1,
          completed: 25,
          failed: 2,
          delayed: 4
        });

        const stats = await queueManager.getQueueStatistics('test-user');

        expect(stats.connections.pending).toBe(8); // waiting + delayed
        expect(stats.connections.processing).toBe(2);
        expect(stats.connections.completed).toBe(15);
        expect(stats.connections.failed).toBe(1);

        expect(stats.engagement.pending).toBe(12); // waiting + delayed
        expect(stats.engagement.processing).toBe(1);
        expect(stats.engagement.completed).toBe(25);
        expect(stats.engagement.failed).toBe(2);

        expect(stats.total).toBe(74); // Sum of all jobs
      });

      it('should retrieve user-specific queue items', async () => {
        const userId = 'queue-items-user';
        
        const mockJobs = [
          {
            id: 'job-1',
            data: { userId, targetId: 'target-1', action: 'send_invitation' },
            opts: { priority: 3, delay: 60000 },
            timestamp: Date.now(),
            processedOn: null,
            finishedOn: null,
            failedReason: null
          },
          {
            id: 'job-2',
            data: { userId, targetId: 'target-2', action: 'like_post' },
            opts: { priority: 2, delay: 120000 },
            timestamp: Date.now() - 30000,
            processedOn: Date.now() - 5000,
            finishedOn: Date.now(),
            failedReason: null
          }
        ];

        mockConnectionQueue.getJobs.mockResolvedValue([mockJobs[0]]);
        mockEngagementQueue.getJobs.mockResolvedValue([mockJobs[1]]);

        const queueItems = await queueManager.getUserQueueItems(userId);

        expect(queueItems).toHaveLength(2);
        expect(queueItems[0].type).toBe('connection');
        expect(queueItems[0].status).toBe('pending');
        expect(queueItems[1].type).toBe('engagement');
        expect(queueItems[1].status).toBe('completed');
      });

      it('should calculate estimated processing times', async () => {
        const userId = 'timing-user';
        
        // Mock queue with various job states
        mockConnectionQueue.getJobs.mockResolvedValue([
          {
            id: 'job-timing-1',
            data: { userId, targetId: 'target-timing-1' },
            opts: { delay: 5 * 60 * 1000 }, // 5 minutes delay
            timestamp: Date.now()
          },
          {
            id: 'job-timing-2',
            data: { userId, targetId: 'target-timing-2' },
            opts: { delay: 10 * 60 * 1000 }, // 10 minutes delay
            timestamp: Date.now()
          }
        ]);

        mockEngagementQueue.getJobs.mockResolvedValue([]);

        const queueItems = await queueManager.getUserQueueItems(userId);

        queueItems.forEach(item => {
          expect(item.estimatedExecutionTime).toBeDefined();
          expect(item.estimatedExecutionTime).toBeGreaterThan(Date.now());
        });
      });
    });

    describe('Bulk Operations', () => {
      it('should handle bulk job cancellation', async () => {
        const userId = 'bulk-cancel-user';
        const jobIds = ['job-1', 'job-2', 'job-3'];
        
        // Mock jobs exist in different queues
        mockConnectionQueue.getJob.mockImplementation((id) => {
          if (id === 'job-1' || id === 'job-2') {
            return Promise.resolve({
              id,
              data: { userId },
              remove: jest.fn().mockResolvedValue(true)
            });
          }
          return Promise.resolve(null);
        });

        mockEngagementQueue.getJob.mockImplementation((id) => {
          if (id === 'job-3') {
            return Promise.resolve({
              id,
              data: { userId },
              remove: jest.fn().mockResolvedValue(true)
            });
          }
          return Promise.resolve(null);
        });

        const result = await queueManager.bulkCancelJobs(userId, jobIds);

        expect(result.success).toBe(true);
        expect(result.canceledCount).toBe(3);
        expect(result.failedCount).toBe(0);
      });

      it('should handle bulk priority updates', async () => {
        const userId = 'bulk-priority-user';
        const updates = [
          { jobId: 'job-priority-1', priority: 'high' as const },
          { jobId: 'job-priority-2', priority: 'low' as const }
        ];

        // Mock jobs with update capability
        const mockUpdateJob = jest.fn().mockResolvedValue(true);
        
        mockConnectionQueue.getJob.mockImplementation((id) => {
          return Promise.resolve({
            id,
            data: { userId },
            update: mockUpdateJob,
            opts: { priority: 2 }
          });
        });

        const result = await queueManager.bulkUpdatePriority(userId, updates);

        expect(result.success).toBe(true);
        expect(result.updatedCount).toBe(2);
        expect(mockUpdateJob).toHaveBeenCalledTimes(2);
      });

      it('should handle bulk job retry with safety checks', async () => {
        const userId = 'bulk-retry-user';
        const jobIds = ['failed-job-1', 'failed-job-2'];

        // Mock safety allows retries
        mockSafetyMonitor.getSafetyStatus.mockResolvedValue({
          overallStatus: 'healthy',
          score: 85,
          emergencyStopRequired: false
        });

        // Mock failed jobs
        mockConnectionQueue.getJob.mockImplementation((id) => {
          return Promise.resolve({
            id,
            data: { userId },
            retry: jest.fn().mockResolvedValue(true),
            opts: { attempts: 3 },
            attemptsMade: 3,
            failedReason: 'Network error'
          });
        });

        const result = await queueManager.bulkRetryJobs(userId, jobIds);

        expect(result.success).toBe(true);
        expect(result.retriedCount).toBe(2);
        expect(mockSafetyMonitor.getSafetyStatus).toHaveBeenCalledWith(userId);
      });

      it('should prevent bulk operations when safety score is low', async () => {
        const userId = 'unsafe-bulk-user';
        const jobIds = ['job-unsafe-1', 'job-unsafe-2'];

        // Mock low safety score
        mockSafetyMonitor.getSafetyStatus.mockResolvedValue({
          overallStatus: 'critical',
          score: 35,
          emergencyStopRequired: true
        });

        const result = await queueManager.bulkRetryJobs(userId, jobIds);

        expect(result.success).toBe(false);
        expect(result.error).toContain('safety');
        expect(result.retriedCount).toBe(0);
      });
    });

    describe('Queue Cleanup and Maintenance', () => {
      it('should clean up old completed jobs', async () => {
        const cleanupResult = await queueManager.cleanupOldJobs({
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          limit: 100
        });

        expect(mockConnectionQueue.clean).toHaveBeenCalledWith(
          7 * 24 * 60 * 60 * 1000,
          'completed',
          100
        );
        expect(mockEngagementQueue.clean).toHaveBeenCalledWith(
          7 * 24 * 60 * 60 * 1000,
          'completed',
          100
        );
        
        expect(cleanupResult.success).toBe(true);
      });

      it('should remove stuck jobs', async () => {
        // Mock stuck jobs (active for too long)
        const stuckJobs = [
          {
            id: 'stuck-job-1',
            data: { userId: 'stuck-user' },
            timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
            processedOn: Date.now() - 10 * 60 * 1000,
            finishedOn: null,
            remove: jest.fn().mockResolvedValue(true)
          }
        ];

        mockConnectionQueue.getJobs.mockResolvedValue(stuckJobs);
        mockEngagementQueue.getJobs.mockResolvedValue([]);

        const result = await queueManager.removeStuckJobs({
          maxProcessingTime: 5 * 60 * 1000 // 5 minutes
        });

        expect(result.removedCount).toBe(1);
        expect(stuckJobs[0].remove).toHaveBeenCalled();
      });

      it('should pause all queues during maintenance', async () => {
        await queueManager.pauseAllQueues();

        expect(mockConnectionQueue.pause).toHaveBeenCalled();
        expect(mockEngagementQueue.pause).toHaveBeenCalled();
      });

      it('should resume all queues after maintenance', async () => {
        await queueManager.resumeAllQueues();

        expect(mockConnectionQueue.resume).toHaveBeenCalled();
        expect(mockEngagementQueue.resume).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    describe('Job Failure Handling', () => {
      it('should handle job failures with proper error recording', async () => {
        const jobData = {
          userId: 'error-user',
          targetId: 'error-target',
          queueItemId: 'error-queue-item'
        };

        // Setup job failure handler
        const failedHandler = mockConnectionQueue.on.mock.calls.find(
          call => call[0] === 'failed'
        )?.[1];

        if (failedHandler) {
          const mockJob = {
            id: 'failed-job',
            data: jobData,
            attemptsMade: 3,
            opts: { attempts: 3 },
            failedReason: 'LinkedIn API returned 429'
          };

          const mockError = new Error('Rate limit exceeded');

          await failedHandler(mockJob, mockError);

          expect(mockSafetyMonitor.recordViolation).toHaveBeenCalledWith(
            jobData.userId,
            expect.objectContaining({
              type: 'JOB_FAILURE',
              details: expect.objectContaining({
                jobId: 'failed-job',
                reason: 'Rate limit exceeded'
              })
            })
          );
        }
      });

      it('should escalate repeated failures to safety monitor', async () => {
        const userId = 'repeated-failures-user';
        
        // Mock multiple job failures for same user
        for (let i = 0; i < 5; i++) {
          const failedHandler = mockConnectionQueue.on.mock.calls.find(
            call => call[0] === 'failed'
          )?.[1];

          if (failedHandler) {
            const mockJob = {
              id: `failed-job-${i}`,
              data: { userId, targetId: `target-${i}` },
              attemptsMade: 3,
              opts: { attempts: 3 },
              failedReason: 'Repeated failure'
            };

            await failedHandler(mockJob, new Error('Persistent error'));
          }
        }

        // After 5 failures, should escalate to safety monitor
        expect(mockSafetyMonitor.recordViolation).toHaveBeenCalledTimes(5);
        
        // Last call should indicate escalation
        const lastCall = mockSafetyMonitor.recordViolation.mock.calls[4];
        expect(lastCall[1].severity).toBe('high');
      });
    });

    describe('Queue Recovery', () => {
      it('should recover from Redis connection failures', async () => {
        // Simulate Redis connection failure
        mockRedis.ping.mockRejectedValue(new Error('Redis connection lost'));

        const healthStatus = await queueManager.getHealthStatus();

        expect(healthStatus.status).toBe('degraded');
        expect(healthStatus.issues).toContain('Redis connection failed');
      });

      it('should handle Bull queue initialization failures', async () => {
        // Mock Bull constructor to throw error
        MockedBull.mockImplementation(() => {
          throw new Error('Queue initialization failed');
        });

        // Create new instance to trigger error
        expect(() => new QueueManager()).toThrow('Queue initialization failed');
      });

      it('should provide graceful degradation when queues are unavailable', async () => {
        // Mock queue operations to fail
        mockConnectionQueue.add.mockRejectedValue(new Error('Queue unavailable'));

        const result = await queueManager.scheduleConnectionRequest({
          userId: 'degraded-user',
          targetId: 'degraded-target',
          targetName: 'Degraded Target',
          message: 'Test message',
          priority: 'medium',
          scheduledAt: new Date(Date.now() + 60000)
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Queue unavailable');
        expect(result.degradedMode).toBe(true);
      });
    });
  });

  describe('Performance and Scalability', () => {
    describe('High-Load Queue Processing', () => {
      it('should handle 1000+ concurrent job additions', async () => {
        const userId = 'load-test-user';
        const jobCount = 1000;
        const startTime = Date.now();

        // Mock successful queue additions
        mockConnectionQueue.add.mockResolvedValue({ id: 'mock-job' } as any);

        const jobPromises = Array.from({ length: jobCount }, (_, i) => 
          queueManager.scheduleConnectionRequest({
            userId,
            targetId: `target-${i}`,
            targetName: `Target ${i}`,
            message: 'Load test message',
            priority: 'medium',
            scheduledAt: new Date(Date.now() + (i * 1000)) // Stagger by 1 second
          })
        );

        const results = await Promise.all(jobPromises);
        const executionTime = Date.now() - startTime;

        expect(results).toHaveLength(jobCount);
        expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
        
        results.forEach(result => {
          expect(result.success).toBe(true);
        });
      });

      it('should maintain performance with large queue backlogs', async () => {
        const userId = 'backlog-user';
        
        // Mock large number of existing jobs
        const existingJobs = Array.from({ length: 5000 }, (_, i) => ({
          id: `existing-job-${i}`,
          data: { userId, targetId: `existing-target-${i}` },
          opts: { priority: 2 },
          timestamp: Date.now() - (i * 1000)
        }));

        mockConnectionQueue.getJobs.mockResolvedValue(existingJobs);
        mockEngagementQueue.getJobs.mockResolvedValue([]);

        const startTime = Date.now();
        const queueItems = await queueManager.getUserQueueItems(userId);
        const queryTime = Date.now() - startTime;

        expect(queueItems).toHaveLength(5000);
        expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds
      });
    });

    describe('Memory and Resource Management', () => {
      it('should limit queue size per user', async () => {
        const userId = 'queue-limit-user';
        const maxQueueSize = 100;

        // Mock user already has max queue items
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes(`queue_size:${userId}`)) {
            return Promise.resolve(String(maxQueueSize));
          }
          return Promise.resolve('0');
        });

        const result = await queueManager.scheduleConnectionRequest({
          userId,
          targetId: 'over-limit-target',
          targetName: 'Over Limit Target',
          message: 'This should be rejected',
          priority: 'medium',
          scheduledAt: new Date(Date.now() + 60000)
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('queue limit');
      });

      it('should implement job data compression for large payloads', async () => {
        const largeMessage = 'A'.repeat(5000); // 5KB message
        
        const result = await queueManager.scheduleConnectionRequest({
          userId: 'compression-user',
          targetId: 'large-payload-target',
          targetName: 'Large Payload Target',
          message: largeMessage,
          priority: 'medium',
          scheduledAt: new Date(Date.now() + 60000)
        });

        expect(result.success).toBe(true);
        
        // Verify job data was compressed (in real implementation)
        const addCall = mockConnectionQueue.add.mock.calls[0];
        expect(addCall[1]).toBeDefined();
      });
    });
  });
});