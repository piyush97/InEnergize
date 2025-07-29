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
        endpoint: '/v2/me',
        limit: 500,
        remaining: 450,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: undefined
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: mockProfileResponse,
        status: 200,
        headers: {
          'x-restli-protocol-version': '2.0.0'
        }
      });

      const result = await apiService.getProfile('mock-access-token', 'user-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('linkedin-123');
      expect(result.data?.firstName).toBe('John');
      expect(result.data?.lastName).toBe('Doe');
      expect(result.data?.headline).toBe('Software Engineer at Tech Corp');
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
        endpoint: '/v2/me',
        limit: 500,
        remaining: 0,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: 3600
      });

      await expect(apiService.getProfile('mock-access-token', 'user-123'))
        .rejects.toMatchObject({
          name: 'RateLimitError',
          retryAfter: 3600
        });

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should handle LinkedIn API errors', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/me',
        limit: 500,
        remaining: 450,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: undefined
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

      await expect(apiService.getProfile('mock-access-token', 'user-123'))
        .rejects.toMatchObject({
          name: 'LinkedInAPIError',
          statusCode: 403,
          message: 'Insufficient permissions'
        });
    });

    it('should handle network timeouts', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/me',
        limit: 500,
        remaining: 450,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: undefined
      });

      mockAxiosInstance.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      });

      await expect(apiService.getProfile('mock-access-token', 'user-123'))
        .rejects.toThrow('timeout of 10000ms exceeded');
    });

    it('should retry on transient failures', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/me',
        limit: 500,
        remaining: 450,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: undefined
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

      const result = await apiService.getProfile('mock-access-token', 'user-123');

      expect(result.data?.id).toBe('linkedin-123');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('getComprehensiveProfile', () => {
    it('should get comprehensive profile data successfully', async () => {
      const mockProfileData = {
        id: 'linkedin-123',
        firstName: { localized: { 'en_US': 'John' } },
        lastName: { localized: { 'en_US': 'Doe Updated' } },
        headline: { localized: { 'en_US': 'Senior Software Engineer' } },
        positions: { elements: [] },
        educations: { elements: [] },
        skills: { elements: [] },
        certifications: { elements: [] },
        languages: { elements: [] },
        projects: { elements: [] },
        volunteerExperiences: { elements: [] },
        recommendations: { elements: [] }
      };

      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/me',
        limit: 500,
        remaining: 449,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: undefined
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: mockProfileData,
        status: 200
      });

      const result = await apiService.getComprehensiveProfile('mock-access-token', 'user-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('linkedin-123');
      expect(result.data?.firstName).toBe('John');
      expect(result.data?.lastName).toBe('Doe Updated');
    });
  });

  describe('getProfileAnalytics', () => {
    it('should get profile analytics successfully', async () => {
      const mockAnalyticsResponse = {
        profileViews: {
          total: 150,
          trend: 'increasing'
        },
        searchAppearances: {
          total: 75,
          keywords: ['software engineer', 'javascript', 'react']
        }
      };

      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/analytics',
        limit: 100,
        remaining: 95,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: undefined
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: mockAnalyticsResponse,
        status: 200
      });

      const result = await apiService.getProfileAnalytics('mock-access-token', 'user-123');

      expect(result.success).toBe(true);
      expect(result.data?.profileViews?.total).toBe(150);
      expect(result.data?.searchAppearances?.total).toBe(75);
    });
  });

  describe('sendConnectionRequest', () => {
    it('should send connection request successfully', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/connections',
        limit: 100,
        remaining: 85,
        resetTime: new Date(Date.now() + 86400000),
        retryAfter: undefined
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 'invitation-123' },
        status: 201
      });

      const result = await apiService.sendConnectionRequest('mock-access-token', 'user-123', 'linkedin-456', 'Hi! I would like to connect with you.');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('invitation-123');
    });

    it('should handle connection request limits', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/connections',
        limit: 100,
        remaining: 0,
        resetTime: new Date(Date.now() + 86400000),
        retryAfter: 86400
      });

      await expect(apiService.sendConnectionRequest('mock-access-token', 'user-123', 'linkedin-456', 'Connection request'))
        .rejects.toMatchObject({
          name: 'RateLimitError',
          retryAfter: 86400
        });
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle malformed API responses', async () => {
      mockRateLimitService.checkLimit.mockResolvedValue({
        endpoint: '/v2/me',
        limit: 500,
        remaining: 450,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: undefined
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: null,
        status: 200
      });

      const result = await apiService.getProfile('mock-access-token', 'user-123');
      expect(result.success).toBe(false);
    });
  });
});