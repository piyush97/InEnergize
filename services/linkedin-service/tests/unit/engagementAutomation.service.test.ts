// Engagement Automation Service Unit Tests

import { LinkedInEngagementAutomationService } from '../../src/services/engagementAutomation.service';
import { LinkedInAPIService } from '../../src/services/api.service';
import { LinkedInComplianceService } from '../../src/services/compliance.service';
import { LinkedInSafetyMonitorService } from '../../src/services/safetyMonitor.service';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis', () => {
  const mockRedis = {
    lpush: jest.fn().mockResolvedValue(1),
    brpop: jest.fn().mockResolvedValue(null),
    llen: jest.fn().mockResolvedValue(0),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    incrby: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
    pipeline: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnThis(),
      setex: jest.fn().mockReturnThis(),
      incrby: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([['OK'], [1], [1]])
    })
  };
  return jest.fn(() => mockRedis);
});

jest.mock('../../src/services/api.service');
jest.mock('../../src/services/compliance.service');
jest.mock('../../src/services/safetyMonitor.service');

describe('LinkedInEngagementAutomationService', () => {
  let engagementService: LinkedInEngagementAutomationService;
  let mockApiService: jest.Mocked<LinkedInAPIService>;
  let mockComplianceService: jest.Mocked<LinkedInComplianceService>;
  let mockSafetyService: jest.Mocked<LinkedInSafetyMonitorService>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockApiService = new LinkedInAPIService() as jest.Mocked<LinkedInAPIService>;
    mockComplianceService = new LinkedInComplianceService() as jest.Mocked<LinkedInComplianceService>;
    mockSafetyService = new LinkedInSafetyMonitorService() as jest.Mocked<LinkedInSafetyMonitorService>;

    engagementService = new LinkedInEngagementAutomationService(
      mockApiService,
      mockComplianceService,
      mockSafetyService
    );

    mockRedis = (engagementService as any).redis;

    // Mock timers for testing
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('scheduleLike', () => {
    const mockUserId = 'user-123';
    const mockPostId = 'post-456';

    beforeEach(() => {
      // Mock safety and compliance checks to pass by default
      mockSafetyService.isActionAllowed.mockResolvedValue({
        allowed: true
      });

      mockComplianceService.validateRequest.mockResolvedValue({
        allowed: true
      });

      // Mock current daily count
      mockRedis.get.mockResolvedValue('15'); // Under limit
    });

    it('should schedule like successfully', async () => {
      const result = await engagementService.scheduleLike(mockUserId, mockPostId, {
        priority: 'normal'
      });

      expect(result.success).toBe(true);
      expect(result.likeId).toBeDefined();
      expect(result.likeId).toMatch(/^like_user-123_\d+_[a-z0-9]+$/);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'likes:normal',
        expect.stringContaining(mockUserId)
      );
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        expect.stringMatching(/likes:daily:user-123:\d{4}-\d{2}-\d{2}/),
        1
      );
    });

    it('should reject like when safety check fails', async () => {
      mockSafetyService.isActionAllowed.mockResolvedValue({
        allowed: false,
        reason: 'Daily limit reached',
        retryAfter: 3600
      });

      const result = await engagementService.scheduleLike(mockUserId, mockPostId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Daily limit reached');
      expect(result.retryAfter).toBe(3600);
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    it('should reject like when compliance check fails', async () => {
      mockComplianceService.validateRequest.mockResolvedValue({
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: 1800
      });

      const result = await engagementService.scheduleLike(mockUserId, mockPostId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
      expect(result.retryAfter).toBe(1800);
    });

    it('should reject like when daily limit exceeded', async () => {
      // Mock daily count at limit
      mockRedis.get.mockResolvedValue('30'); // At daily limit

      const result = await engagementService.scheduleLike(mockUserId, mockPostId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Daily like limit reached');
    });

    it('should reject like when post was recently engaged with', async () => {
      mockRedis.exists.mockResolvedValue(1); // Recent engagement exists

      const result = await engagementService.scheduleLike(mockUserId, mockPostId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Post engaged with recently (within 7 days)');
      expect(result.retryAfter).toBe(7 * 24 * 60 * 60);
    });

    it('should schedule with high priority', async () => {
      const result = await engagementService.scheduleLike(mockUserId, mockPostId, {
        priority: 'high'
      });

      expect(result.success).toBe(true);
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'likes:high',
        expect.any(String)
      );
    });

    it('should schedule with custom delay', async () => {
      const scheduledAt = new Date(Date.now() + 3600000); // 1 hour from now

      const result = await engagementService.scheduleLike(mockUserId, mockPostId, {
        scheduledAt
      });

      expect(result.success).toBe(true);
      
      const queuedData = JSON.parse(mockRedis.lpush.mock.calls[0][1]);
      expect(queuedData.scheduledAt).toBe(scheduledAt.toISOString());
    });

    it('should handle errors gracefully', async () => {
      mockSafetyService.isActionAllowed.mockRejectedValue(new Error('Service error'));

      const result = await engagementService.scheduleLike(mockUserId, mockPostId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Internal error scheduling like');
    });
  });

  describe('scheduleComment', () => {
    const mockUserId = 'user-123';
    const mockPostId = 'post-456';
    const mockComment = 'Great insights! Thanks for sharing.';

    beforeEach(() => {
      mockSafetyService.isActionAllowed.mockResolvedValue({ allowed: true });
      mockComplianceService.validateRequest.mockResolvedValue({ allowed: true });
      mockRedis.get.mockResolvedValue('3'); // Under daily limit
    });

    it('should schedule comment successfully', async () => {
      const result = await engagementService.scheduleComment(
        mockUserId,
        mockPostId,
        {
          comment: mockComment,
          priority: 'normal'
        }
      );

      expect(result.success).toBe(true);
      expect(result.commentId).toBeDefined();
      expect(result.commentId).toMatch(/^comment_user-123_\d+_[a-z0-9]+$/);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'comments:normal',
        expect.stringContaining(mockComment)
      );
    });

    it('should validate comment content', async () => {
      const result = await engagementService.scheduleComment(
        mockUserId,
        mockPostId,
        {
          comment: '', // Empty comment
          priority: 'normal'
        }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Comment cannot be empty');
    });

    it('should reject comment that is too long', async () => {
      const longComment = 'A'.repeat(1001); // Over 1000 character limit

      const result = await engagementService.scheduleComment(
        mockUserId,
        mockPostId,
        {
          comment: longComment,
          priority: 'normal'
        }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Comment too long (max 1000 characters)');
    });

    it('should detect and reject spam-like comments', async () => {
      const spamComment = 'Check out my website: https://spam.com for amazing deals!!!';

      const result = await engagementService.scheduleComment(
        mockUserId,
        mockPostId,
        {
          comment: spamComment,
          priority: 'normal'
        }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Comment appears to be spam');
    });

    it('should reject comment when daily limit exceeded', async () => {
      mockRedis.get.mockResolvedValue('8'); // At daily limit

      const result = await engagementService.scheduleComment(
        mockUserId,
        mockPostId,
        {
          comment: mockComment
        }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Daily comment limit reached');
    });

    it('should use template when provided', async () => {
      const templateId = 'template-123';

      const result = await engagementService.scheduleComment(
        mockUserId,
        mockPostId,
        {
          templateId,
          priority: 'normal'
        }
      );

      expect(result.success).toBe(true);
      
      const queuedData = JSON.parse(mockRedis.lpush.mock.calls[0][1]);
      expect(queuedData.templateId).toBe(templateId);
    });
  });

  describe('scheduleProfileView', () => {
    const mockUserId = 'user-123';
    const mockTargetProfileId = 'profile-456';

    beforeEach(() => {
      mockSafetyService.isActionAllowed.mockResolvedValue({ allowed: true });
      mockComplianceService.validateRequest.mockResolvedValue({ allowed: true });
      mockRedis.get.mockResolvedValue('15'); // Under daily limit
    });

    it('should schedule profile view successfully', async () => {
      const result = await engagementService.scheduleProfileView(
        mockUserId,
        mockTargetProfileId,
        {
          priority: 'low'
        }
      );

      expect(result.success).toBe(true);
      expect(result.viewId).toBeDefined();

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'profile_views:low',
        expect.stringContaining(mockTargetProfileId)
      );
    });

    it('should reject profile view when daily limit exceeded', async () => {
      mockRedis.get.mockResolvedValue('25'); // At daily limit

      const result = await engagementService.scheduleProfileView(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Daily profile view limit reached');
    });

    it('should reject profile view of recently viewed profile', async () => {
      mockRedis.exists.mockResolvedValue(1); // Recent view exists

      const result = await engagementService.scheduleProfileView(
        mockUserId,
        mockTargetProfileId
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Profile viewed recently (within 24 hours)');
    });

    it('should prevent viewing own profile', async () => {
      const result = await engagementService.scheduleProfileView(
        mockUserId,
        mockUserId // Same as user ID
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Cannot view own profile');
    });
  });

  describe('getEngagementStats', () => {
    const mockUserId = 'user-123';

    beforeEach(() => {
      // Mock compliance metrics
      mockComplianceService.getComplianceMetrics.mockResolvedValue({
        requestsLast24h: 45,
        requestsLastHour: 3,
        successRate: 94,
        rateLimitHits: 1,
        accountHealth: {
          score: 88,
          riskLevel: 'LOW',
          warnings: [],
          restrictions: [],
          recommendations: []
        },
        safetyMetrics: {
          humanLikeScore: 92,
          patternDetected: false,
          suspiciousActivity: false
        }
      });
    });

    it('should return comprehensive engagement statistics', async () => {
      // Mock daily counts
      mockRedis.get
        .mockResolvedValueOnce('15') // likes today
        .mockResolvedValueOnce('5')  // comments today
        .mockResolvedValueOnce('20') // profile views today
        .mockResolvedValueOnce('2')  // failed likes
        .mockResolvedValueOnce('0')  // failed comments
        .mockResolvedValueOnce('1'); // failed profile views

      // Mock pending queue sizes
      mockRedis.llen
        .mockResolvedValueOnce(3) // likes pending
        .mockResolvedValueOnce(1) // comments pending
        .mockResolvedValueOnce(5); // profile views pending

      const stats = await engagementService.getEngagementStats(mockUserId);

      expect(stats).toEqual({
        today: {
          likes: {
            sent: 15,
            pending: 9, // 3 * 3 queues
            failed: 2,
            remaining: 15 // 30 - 15
          },
          comments: {
            sent: 5,
            pending: 3,
            failed: 0,
            remaining: 3 // 8 - 5
          },
          profileViews: {
            sent: 20,
            pending: 15,
            failed: 1,
            remaining: 5 // 25 - 20
          }
        },
        thisWeek: {
          likes: { sent: 0, pending: 9, failed: 0 },
          comments: { sent: 0, pending: 3, failed: 0 },
          profileViews: { sent: 0, pending: 15, failed: 0 }
        },
        accountHealth: {
          score: 88,
          status: 'LOW',
          warnings: []
        }
      });
    });

    it('should handle zero engagement gracefully', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.llen.mockResolvedValue(0);

      const stats = await engagementService.getEngagementStats(mockUserId);

      expect(stats.today.likes.sent).toBe(0);
      expect(stats.today.likes.remaining).toBe(30); // Full daily limit
    });

    it('should handle service errors gracefully', async () => {
      mockComplianceService.getComplianceMetrics.mockRejectedValue(
        new Error('Service unavailable')
      );

      await expect(engagementService.getEngagementStats(mockUserId))
        .rejects.toThrow('Service unavailable');
    });
  });

  describe('cancelEngagement', () => {
    const mockUserId = 'user-123';
    const mockEngagementId = 'like_user-123_1640995200000_abc123';

    it('should cancel pending engagement successfully', async () => {
      const mockEngagement = {
        id: mockEngagementId,
        userId: mockUserId,
        type: 'like',
        postId: 'post-456',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockEngagement));

      const result = await engagementService.cancelEngagement(mockUserId, mockEngagementId);

      expect(result.success).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `engagement:${mockEngagementId}`,
        7 * 24 * 60 * 60,
        expect.stringContaining('"status":"cancelled"')
      );
    });

    it('should reject cancellation of non-existent engagement', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await engagementService.cancelEngagement(mockUserId, mockEngagementId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Engagement not found');
    });

    it('should reject cancellation by unauthorized user', async () => {
      const mockEngagement = {
        id: mockEngagementId,
        userId: 'different-user',
        status: 'pending'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockEngagement));

      const result = await engagementService.cancelEngagement(mockUserId, mockEngagementId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Unauthorized');
    });

    it('should reject cancellation of completed engagement', async () => {
      const mockEngagement = {
        id: mockEngagementId,
        userId: mockUserId,
        status: 'completed'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockEngagement));

      const result = await engagementService.cancelEngagement(mockUserId, mockEngagementId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Cannot cancel completed engagement');
    });
  });

  describe('content moderation and safety', () => {
    it('should detect inappropriate language in comments', async () => {
      const inappropriateComment = 'This is terrible and stupid content!';

      const result = await engagementService.scheduleComment(
        'user-123',
        'post-456',
        {
          comment: inappropriateComment
        }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Comment contains inappropriate language');
    });

    it('should detect promotional content in comments', async () => {
      const promotionalComment = 'Buy now at www.example.com with 50% discount code SAVE50!';

      const result = await engagementService.scheduleComment(
        'user-123',
        'post-456',
        {
          comment: promotionalComment
        }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Comment appears to be promotional');
    });

    it('should validate comment relevance', async () => {
      const irrelevantComment = 'Random unrelated text that has nothing to do with anything.';

      // Mock validation failure
      const isRelevant = (engagementService as any).validateCommentRelevance(
        irrelevantComment,
        'post about AI technology'
      );

      expect(isRelevant).toBe(false);
    });

    it('should generate appropriate engagement delays', () => {
      const likeDelay = (engagementService as any).generateEngagementDelay('like');
      const commentDelay = (engagementService as any).generateEngagementDelay('comment');
      const viewDelay = (engagementService as any).generateEngagementDelay('profile_view');

      expect(likeDelay).toBeGreaterThanOrEqual(60000); // 1 minute minimum
      expect(commentDelay).toBeGreaterThanOrEqual(120000); // 2 minutes minimum
      expect(viewDelay).toBeGreaterThanOrEqual(30000); // 30 seconds minimum

      expect(likeDelay).toBeLessThanOrEqual(300000); // 5 minutes maximum
      expect(commentDelay).toBeLessThanOrEqual(600000); // 10 minutes maximum
      expect(viewDelay).toBeLessThanOrEqual(180000); // 3 minutes maximum
    });
  });

  describe('template management', () => {
    it('should render comment template with variables', () => {
      const template = {
        id: 'template-123',
        content: 'Great post about {topic}, {firstName}! Thanks for sharing your insights on {industry}.',
        variables: ['topic', 'firstName', 'industry']
      };

      const profileData = {
        firstName: 'John',
        topic: 'AI technology',
        industry: 'software development'
      };

      const rendered = (engagementService as any).renderCommentTemplate(template, profileData);

      expect(rendered).toBe('Great post about AI technology, John! Thanks for sharing your insights on software development.');
    });

    it('should handle missing template variables gracefully', () => {
      const template = {
        id: 'template-123',
        content: 'Hi {firstName}, interesting thoughts on {topic}!',
        variables: ['firstName', 'topic']
      };

      const profileData = {
        firstName: 'John'
        // Missing topic
      };

      const rendered = (engagementService as any).renderCommentTemplate(template, profileData);

      expect(rendered).toBe('Hi John, interesting thoughts on [topic]!');
    });

    it('should validate template variables', () => {
      const template = {
        content: 'Hello {firstName} from {company}',
        variables: ['firstName', 'company']
      };

      const isValid = (engagementService as any).validateTemplateVariables(template);

      expect(isValid).toBe(true);
    });

    it('should detect mismatched template variables', () => {
      const template = {
        content: 'Hello {firstName} from {company}',
        variables: ['firstName'] // Missing company
      };

      const isValid = (engagementService as any).validateTemplateVariables(template);

      expect(isValid).toBe(false);
    });
  });

  describe('engagement patterns and timing', () => {
    it('should respect business hours for scheduling', () => {
      // Mock business hours check (9 AM - 5 PM)
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14); // 2 PM

      const isBusinessHours = (engagementService as any).isBusinessHours();

      expect(isBusinessHours).toBe(true);
    });

    it('should detect non-business hours', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(22); // 10 PM

      const isBusinessHours = (engagementService as any).isBusinessHours();

      expect(isBusinessHours).toBe(false);
    });

    it('should adjust scheduling for weekends', () => {
      jest.spyOn(Date.prototype, 'getDay').mockReturnValue(0); // Sunday

      const isWeekend = (engagementService as any).isWeekend();

      expect(isWeekend).toBe(true);
    });

    it('should calculate optimal engagement timing', () => {
      const postTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      const optimalTime = (engagementService as any).calculateOptimalEngagementTime(postTimestamp);

      expect(optimalTime).toBeGreaterThan(Date.now());
      expect(optimalTime).toBeLessThan(Date.now() + 24 * 60 * 60 * 1000); // Within 24 hours
    });
  });

  describe('queue management', () => {
    it('should get correct queue key for different priorities', () => {
      expect((engagementService as any).getQueueKey('like', 'high')).toBe('likes:high');
      expect((engagementService as any).getQueueKey('comment', 'normal')).toBe('comments:normal');
      expect((engagementService as any).getQueueKey('profile_view', 'low')).toBe('profile_views:low');
    });

    it('should process queues in priority order', async () => {
      const queueOrder = (engagementService as any).getQueueProcessingOrder();

      expect(queueOrder[0]).toContain('high');
      expect(queueOrder[queueOrder.length - 1]).toContain('low');
    });

    it('should handle queue overflow gracefully', async () => {
      // Mock queue at capacity
      mockRedis.llen.mockResolvedValue(1000); // Queue full

      const result = await engagementService.scheduleLike('user-123', 'post-456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Engagement queue is full');
    });
  });

  describe('event emission', () => {
    it('should emit engagementScheduled event', async () => {
      mockSafetyService.isActionAllowed.mockResolvedValue({ allowed: true });
      mockComplianceService.validateRequest.mockResolvedValue({ allowed: true });
      mockRedis.get.mockResolvedValue('10');

      const eventSpy = jest.fn();
      engagementService.on('engagementScheduled', eventSpy);

      await engagementService.scheduleLike('user-123', 'post-456');

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-123',
        engagementId: expect.stringMatching(/^like_user-123_\d+_[a-z0-9]+$/),
        type: 'like',
        postId: 'post-456'
      });
    });

    it('should emit engagementCancelled event', async () => {
      const mockEngagement = {
        id: 'like_user-123_123_abc',
        userId: 'user-123',
        status: 'pending'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockEngagement));

      const eventSpy = jest.fn();
      engagementService.on('engagementCancelled', eventSpy);

      await engagementService.cancelEngagement('user-123', 'like_user-123_123_abc');

      expect(eventSpy).toHaveBeenCalledWith({
        engagementId: 'like_user-123_123_abc',
        userId: 'user-123'
      });
    });
  });

  describe('cleanup and maintenance', () => {
    it('should cleanup Redis connection', async () => {
      await engagementService.cleanup();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should cleanup expired engagements', async () => {
      const userId = 'user-123';

      mockRedis.keys.mockResolvedValue([
        'engagement:like_user-123_123_abc',
        'engagement:comment_user-123_456_def'
      ]);

      await engagementService.cleanupExpiredEngagements(userId);

      expect(mockRedis.keys).toHaveBeenCalledWith(`engagement:*_${userId}_*`);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle Redis connection failures gracefully', async () => {
      mockSafetyService.isActionAllowed.mockResolvedValue({ allowed: true });
      mockComplianceService.validateRequest.mockResolvedValue({ allowed: true });
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await engagementService.scheduleLike('user-123', 'post-456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Internal error scheduling like');
    });

    it('should handle malformed engagement data', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await engagementService.cancelEngagement('user-123', 'engagement-123');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Engagement data corrupted');
    });

    it('should validate engagement ID format', () => {
      const validId = 'like_user-123_1640995200000_abc123';
      const invalidId = 'invalid-engagement-id';

      const isValid1 = (engagementService as any).isValidEngagementId(validId);
      const isValid2 = (engagementService as any).isValidEngagementId(invalidId);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(false);
    });
  });
});