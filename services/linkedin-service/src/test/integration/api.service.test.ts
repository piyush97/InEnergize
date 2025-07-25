// LinkedIn API Service Integration Tests

import axios from 'axios';
import { LinkedInAPIService } from '../../services/api.service';
import { LinkedInRateLimitService } from '../../services/rateLimit.service';

// Mock axios and rate limit service
jest.mock('axios');
jest.mock('../../services/rateLimit.service');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedRateLimitService = LinkedInRateLimitService as jest.MockedClass<typeof LinkedInRateLimitService>;

describe('LinkedInAPIService Integration', () => {
  let apiService: LinkedInAPIService;
  let mockRateLimitService: jest.Mocked<LinkedInRateLimitService>;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    mockRateLimitService = new MockedRateLimitService() as jest.Mocked<LinkedInRateLimitService>;
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    apiService = new LinkedInAPIService(mockRateLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should retrieve user profile successfully', async () => {
      const mockProfileResponse = {
        id: 'linkedin-123',
        firstName: { localized: { 'en_US': 'John' } },
        lastName: { localized: { 'en_US': 'Doe' } },
        headline: { localized: { 'en_US': 'Software Engineer at Tech Corp' } },
        summary: { localized: { 'en_US': 'Experienced developer...' } },
        positions: {
          elements: [{
            id: 123456,
            title: { localized: { 'en_US': 'Senior Software Engineer' } },
            companyName: { localized: { 'en_US': 'Tech Corp' } },
            timePeriod: {
              startDate: { year: 2020, month: 1 }
            }
          }]
        }
      };

      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 450,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: mockProfileResponse,
        status: 200,
        headers: {
          'x-restli-protocol-version': '2.0.0'
        }
      });

      const result = await apiService.getProfile('user-123');

      expect(result.id).toBe('linkedin-123');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.headline).toBe('Software Engineer at Tech Corp');
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith('user-123', 'api');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/v2/people/~:(id,firstName,lastName,headline,summary,positions)',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer')
          })
        })
      );
    });

    it('should handle rate limiting', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 3600000,
        retryAfter: 3600
      });

      await expect(apiService.getProfile('user-123'))
        .rejects.toThrow('Rate limit exceeded');

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should handle LinkedIn API errors', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 450,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 403,
          data: {
            errorCode: 0,
            message: 'Insufficient permissions',
            requestId: 'req-123',
            status: 403,
            timestamp: Date.now()
          }
        }
      });

      await expect(apiService.getProfile('user-123'))
        .rejects.toMatchObject({
          name: 'LinkedInAPIError',
          statusCode: 403,
          message: 'Insufficient permissions'
        });
    });

    it('should handle network timeouts', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 450,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      });

      await expect(apiService.getProfile('user-123'))
        .rejects.toThrow('timeout of 10000ms exceeded');
    });

    it('should retry on transient failures', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 450,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      // First call fails with 500, second succeeds
      mockAxiosInstance.get
        .mockRejectedValueOnce({
          response: { status: 500, data: { message: 'Internal Server Error' } }
        })
        .mockResolvedValueOnce({
          data: { id: 'linkedin-123' },
          status: 200
        });

      const result = await apiService.getProfile('user-123');

      expect(result.id).toBe('linkedin-123');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncProfile', () => {
    it('should sync profile data successfully', async () => {
      const mockProfileData = {
        id: 'linkedin-123',
        firstName: 'John',
        lastName: 'Doe Updated',
        headline: 'Senior Software Engineer'
      };

      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 449,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: mockProfileData,
        status: 200
      });

      const result = await apiService.syncProfile('user-123', { forceSync: true });

      expect(result.success).toBe(true);
      expect(result.updatedFields).toContain('lastName');
      expect(result.profileData.lastName).toBe('Doe Updated');
    });

    it('should handle sync conflicts', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 449,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      // Mock scenario where profile was modified externally
      const result = await apiService.syncProfile('user-123', { 
        forceSync: false,
        lastSyncTimestamp: Date.now() - 3600000 // 1 hour ago
      });

      expect(result.success).toBe(true);
      expect(result.conflictingFields).toBeDefined();
    });

    it('should respect sync intervals', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 449,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      const recentSyncTime = Date.now() - 60000; // 1 minute ago
      
      await expect(apiService.syncProfile('user-123', {
        lastSyncTimestamp: recentSyncTime,
        forceSync: false
      })).rejects.toThrow('Profile was synced recently');
    });
  });

  describe('searchProfiles', () => {
    it('should search profiles successfully', async () => {
      const mockSearchResponse = {
        elements: [
          {
            id: 'profile-1',
            firstName: { localized: { 'en_US': 'Jane' } },
            lastName: { localized: { 'en_US': 'Smith' } },
            headline: { localized: { 'en_US': 'Product Manager' } }
          },
          {
            id: 'profile-2',
            firstName: { localized: { 'en_US': 'Bob' } },
            lastName: { localized: { 'en_US': 'Johnson' } },
            headline: { localized: { 'en_US': 'Designer' } }
          }
        ],
        paging: {
          count: 2,
          start: 0,
          total: 25
        }
      };

      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 448,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: mockSearchResponse,
        status: 200
      });

      const result = await apiService.searchProfiles('user-123', {
        keywords: 'software engineer',
        location: 'San Francisco',
        industry: 'Technology'
      });

      expect(result.profiles).toHaveLength(2);
      expect(result.totalCount).toBe(25);
      expect(result.profiles[0].firstName).toBe('Jane');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/v2/peopleSearch'),
        expect.objectContaining({
          params: expect.objectContaining({
            keywords: 'software engineer',
            location: 'San Francisco'
          })
        })
      );
    });

    it('should handle empty search results', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 448,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          elements: [],
          paging: { count: 0, start: 0, total: 0 }
        },
        status: 200
      });

      const result = await apiService.searchProfiles('user-123', {
        keywords: 'very specific rare skill'
      });

      expect(result.profiles).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('sendConnectionRequest', () => {
    it('should send connection request successfully', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 85,
        resetTime: Date.now() + 86400000,
        retryAfter: null
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 'invitation-123' },
        status: 201
      });

      const result = await apiService.sendConnectionRequest('user-123', {
        recipientProfileId: 'linkedin-456',
        message: 'Hi! I would like to connect with you.',
        trackingId: 'tracking-789'
      });

      expect(result.success).toBe(true);
      expect(result.invitationId).toBe('invitation-123');
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith('user-123', 'connections');
    });

    it('should handle connection request limits', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 86400000,
        retryAfter: 86400
      });

      await expect(apiService.sendConnectionRequest('user-123', {
        recipientProfileId: 'linkedin-456',
        message: 'Connection request'
      })).rejects.toMatchObject({
        name: 'RateLimitError',
        message: expect.stringContaining('Daily connection limit exceeded')
      });
    });

    it('should handle duplicate connection requests', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 85,
        resetTime: Date.now() + 86400000,
        retryAfter: null
      });

      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 409,
          data: {
            errorCode: 0,
            message: 'Invitation already exists',
            status: 409
          }
        }
      });

      await expect(apiService.sendConnectionRequest('user-123', {
        recipientProfileId: 'linkedin-456',
        message: 'Connection request'
      })).rejects.toMatchObject({
        name: 'LinkedInAPIError',
        statusCode: 409,
        message: 'Invitation already exists'
      });
    });
  });

  describe('getAnalytics', () => {
    it('should retrieve profile analytics successfully', async () => {
      const mockAnalyticsResponse = {
        profileViews: {
          total: 150,
          trend: 'increasing',
          dateRange: {
            start: '2023-01-01',
            end: '2023-01-31'
          }
        },
        searchAppearances: {
          total: 75,
          trend: 'stable',
          keywords: ['software engineer', 'javascript', 'react']
        },
        connectionGrowth: {
          newConnections: 25,
          totalConnections: 500,
          trend: 'increasing'
        }
      };

      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 447,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: mockAnalyticsResponse,
        status: 200
      });

      const result = await apiService.getAnalytics('user-123', {
        dateRange: { start: '2023-01-01', end: '2023-01-31' },
        metrics: ['profileViews', 'searchAppearances', 'connectionGrowth']
      });

      expect(result.profileViews.total).toBe(150);
      expect(result.searchAppearances.keywords).toContain('javascript');
      expect(result.connectionGrowth.newConnections).toBe(25);
    });

    it('should handle premium analytics features', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 447,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 403,
          data: {
            errorCode: 100,
            message: 'Premium feature requires LinkedIn Premium',
            status: 403
          }
        }
      });

      await expect(apiService.getAnalytics('user-123', {
        metrics: ['premiumInsights']
      })).rejects.toMatchObject({
        name: 'LinkedInAPIError',
        statusCode: 403,
        code: 'PREMIUM_REQUIRED'
      });
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should implement exponential backoff for retries', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 450,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      // Mock multiple failures followed by success
      mockAxiosInstance.get
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValueOnce({ data: { id: 'success' }, status: 200 });

      const startTime = Date.now();
      const result = await apiService.getProfile('user-123');
      const endTime = Date.now();

      expect(result.id).toBe('success');
      expect(endTime - startTime).toBeGreaterThan(1000); // Should have delays
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should respect circuit breaker pattern', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 450,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      // Simulate multiple consecutive failures
      for (let i = 0; i < 5; i++) {
        mockAxiosInstance.get.mockRejectedValue({ response: { status: 500 } });
        
        try {
          await apiService.getProfile('user-123');
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open now, next call should fail fast
      const startTime = Date.now();
      try {
        await apiService.getProfile('user-123');
      } catch (error) {
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(100); // Should fail fast
      }
    });

    it('should handle malformed API responses', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 450,
        resetTime: Date.now() + 3600000,
        retryAfter: null
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: 'invalid json response',
        status: 200
      });

      await expect(apiService.getProfile('user-123'))
        .rejects.toThrow('Invalid response format');
    });
  });
});