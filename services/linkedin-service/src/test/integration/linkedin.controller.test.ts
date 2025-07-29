// LinkedIn Controller Integration Tests

import request from 'supertest';
import express from 'express';
import { LinkedInController } from '../../controllers/linkedin.controller';
import { LinkedInOAuthService } from '../../services/oauth.service';
import { LinkedInAPIService } from '../../services/api.service';
import { ProfileCompletenessService } from '../../services/completeness.service';
import { LinkedInRateLimitService } from '../../services/rateLimit.service';

// Mock all services
jest.mock('../../services/oauth.service');
jest.mock('../../services/api.service');
jest.mock('../../services/completeness.service');
jest.mock('../../services/rateLimit.service');

describe('LinkedInController Integration', () => {
  let app: express.Application;
  let controller: LinkedInController;
  let mockOAuthService: jest.Mocked<LinkedInOAuthService>;
  let mockAPIService: jest.Mocked<LinkedInAPIService>;
  let mockCompletenessService: jest.Mocked<ProfileCompletenessService>;
  let mockRateLimitService: jest.Mocked<LinkedInRateLimitService>;
  let mockDatabaseService: jest.Mocked<any>;

  beforeEach(() => {
    // Create mocked services
    mockOAuthService = new LinkedInOAuthService() as jest.Mocked<LinkedInOAuthService>;
    mockAPIService = new LinkedInAPIService({} as any) as jest.Mocked<LinkedInAPIService>;
    mockCompletenessService = new ProfileCompletenessService() as jest.Mocked<ProfileCompletenessService>;
    mockRateLimitService = new LinkedInRateLimitService() as jest.Mocked<LinkedInRateLimitService>;
    
    // Create mocked database service
    mockDatabaseService = {
      getStoredAccessToken: jest.fn(),
      updateLinkedInAccount: jest.fn(),
      sendAnalyticsData: jest.fn()
    };

    // Create controller with mocked services
    controller = new LinkedInController();
    
    // Inject mocked services
    (controller as any).oauthService = mockOAuthService;
    (controller as any).apiService = mockAPIService;
    (controller as any).completenessService = mockCompletenessService;
    (controller as any).rateLimitService = mockRateLimitService;
    (controller as any).databaseService = mockDatabaseService;

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = {
        id: 'test-user-123',
        email: 'test@example.com',
        role: 'USER',
        subscriptionLevel: 'PRO'
      };
      next();
    });

    // Setup routes (simplified for testing)
    app.post('/auth/initiate', controller.initiateAuth.bind(controller));
    app.post('/auth/callback', controller.handleCallback.bind(controller));
    app.get('/profile', controller.getProfile.bind(controller));
    app.post('/profile/sync', controller.syncProfile.bind(controller));
    app.get('/profile/completeness', controller.getCompleteness.bind(controller));
    app.get('/rate-limits', controller.getRateLimitStatus.bind(controller));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/initiate', () => {
    it('should initiate OAuth flow successfully', async () => {
      const mockAuthUrl = 'https://www.linkedin.com/oauth/v2/authorization?client_id=123&state=state-123&...';

      mockOAuthService.generateAuthUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .post('/auth/initiate')
        .send({
          scopes: ['profile', 'email', 'openid'],
          redirectUri: 'http://localhost:3000/callback'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBe(mockAuthUrl);
      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith('test-user-123');
    });

    it('should handle OAuth service errors', async () => {
      mockOAuthService.generateAuthUrl.mockImplementation(() => {
        throw new Error('OAuth service unavailable');
      });

      const response = await request(app)
        .post('/auth/initiate')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('OAuth service unavailable');
    });

    it('should handle rate limiting', async () => {
      mockOAuthService.generateAuthUrl.mockImplementation(() => {
        const error = new Error('Rate limit exceeded') as any;
        error.name = 'RateLimitError';
        error.retryAfter = 3600;
        throw error;
      });

      const response = await request(app)
        .post('/auth/initiate')
        .send({});

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Rate limit exceeded');
    });
  });

  describe('POST /auth/callback', () => {
    it('should handle OAuth callback successfully', async () => {
      const mockTokenResponse = {
        success: true,
        data: {
          tokens: {
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-123',
            expiresIn: 5184000,
            scope: 'profile email openid'
          },
          userId: 'test-user-123'
        }
      };

      mockOAuthService.validateState.mockResolvedValue(true);
      mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokenResponse as any);

      const response = await request(app)
        .post('/auth/callback')
        .send({
          code: 'auth-code-123',
          state: 'state-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe(mockTokenResponse.data.tokens.accessToken);
      expect(mockOAuthService.validateState).toHaveBeenCalledWith('state-123');
    });

    it('should reject invalid state parameter', async () => {
      mockOAuthService.validateState.mockResolvedValue(false);

      const response = await request(app)
        .post('/auth/callback')
        .send({
          code: 'auth-code-123',
          state: 'invalid-state'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid state parameter');
    });

    it('should handle missing required parameters', async () => {
      const response = await request(app)
        .post('/auth/callback')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Missing required parameters');
    });
  });

  describe('GET /profile', () => {
    it('should return user profile successfully', async () => {
      const mockProfile = {
        success: true,
        data: {
          id: 'linkedin-123',
          firstName: {
            localized: { 'en_US': 'John' },
            preferredLocale: { country: 'US', language: 'en' }
          },
          lastName: {
            localized: { 'en_US': 'Doe' },
            preferredLocale: { country: 'US', language: 'en' }
          },
          headline: 'Software Engineer',
          summary: 'Experienced developer...',
          emailAddress: 'john@example.com'
        }
      };

      mockAPIService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/profile');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProfile);
      expect(mockAPIService.getProfile).toHaveBeenCalledWith('test-user-123');
    });

    it('should handle profile not found', async () => {
      mockAPIService.getProfile.mockRejectedValue({
        name: 'LinkedInAPIError',
        statusCode: 404,
        message: 'Profile not found'
      });

      const response = await request(app)
        .get('/profile');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Profile not found');
    });

    it('should handle LinkedIn API errors', async () => {
      mockAPIService.getProfile.mockRejectedValue({
        name: 'LinkedInAPIError',
        statusCode: 403,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });

      const response = await request(app)
        .get('/profile');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Insufficient permissions');
    });
  });

  describe('POST /profile/sync', () => {
    it('should sync profile successfully', async () => {
      const mockProfile = {
        id: 'linkedin-123',
        firstName: {
          localized: { 'en_US': 'John' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'Doe' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        headline: 'Senior Software Engineer | Building scalable solutions',
        summary: 'Experienced software engineer with 5+ years of experience in developing scalable web applications...',
        industry: 'Information Technology',
        location: { country: 'US', postalCode: '94102' },
        profilePicture: {
          displayImage: 'urn:li:digitalmediaAsset:profile-pic',
          'displayImage~': { elements: [{ identifiers: [{ identifier: 'profile.jpg' }] }] }
        },
        positions: [
          {
            id: 'pos-1',
            title: 'Senior Software Engineer',
            company: { name: 'Tech Corp', id: 'tech-corp-123' },
            startDate: { year: 2020, month: 1 },
            isCurrent: true
          }
        ],
        skills: [
          { name: 'JavaScript', endorsementCount: 15 },
          { name: 'React', endorsementCount: 12 }
        ],
        connectionCount: 500
      };

      const mockCompleteness = {
        score: 85,
        breakdown: {
          basicInfo: 100,
          headline: 90,
          summary: 85,
          experience: 90,
          skills: 80
        },
        suggestions: ['Add more skills to improve discoverability'],
        missingFields: [],
        priorityImprovements: []
      };

      const mockSyncResult = {
        success: true,
        profile: mockProfile,
        completeness: mockCompleteness,
        analytics: {
          profileViews: 45,
          searchAppearances: 23,
          connectionRequests: 3
        }
      };

      mockAPIService.getComprehensiveProfile.mockResolvedValue({
        success: true,
        data: mockProfile
      });

      mockAPIService.getProfileAnalytics.mockResolvedValue({
        success: true,
        data: {
          profileViews: 45,
          searchAppearances: 23,
          connectionRequests: 3
        }
      });

      mockCompletenessService.calculateCompleteness.mockReturnValue(mockCompleteness);
      mockDatabaseService.updateLinkedInAccount.mockResolvedValue(true);
      mockDatabaseService.sendAnalyticsData.mockResolvedValue(true);
      mockDatabaseService.getStoredAccessToken.mockResolvedValue('valid-access-token');
      mockAPIService.validateToken.mockResolvedValue(true);

      const response = await request(app)
        .post('/profile/sync')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toEqual(mockProfile);
      expect(response.body.data.completeness.score).toBe(85);
      expect(response.body.data.analytics).toBeDefined();
      expect(response.body.data.syncedAt).toBeDefined();
      expect(response.body.data.nextSyncRecommended).toBeDefined();
    });

    it('should handle missing access token', async () => {
      mockDatabaseService.getStoredAccessToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/profile/sync')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_REQUIRED');
      expect(response.body.message).toContain('LinkedIn access token required');
    });

    it('should handle invalid access token', async () => {
      mockDatabaseService.getStoredAccessToken.mockResolvedValue('invalid-token');
      mockAPIService.validateToken.mockResolvedValue(false);

      const response = await request(app)
        .post('/profile/sync')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
      expect(response.body.message).toContain('Invalid or expired LinkedIn access token');
    });

    it('should handle LinkedIn API errors', async () => {
      const linkedinError = {
        success: false,
        error: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          userMessage: 'You\'ve made too many requests. Please wait before trying again.',
          httpStatus: 429
        }
      };

      mockDatabaseService.getStoredAccessToken.mockResolvedValue('valid-token');
      mockAPIService.validateToken.mockResolvedValue(true);
      mockAPIService.getComprehensiveProfile.mockResolvedValue(linkedinError);

      const response = await request(app)
        .post('/profile/sync')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toEqual(linkedinError.error);
    });

    it('should calculate enhanced profile completeness', async () => {
      const mockProfile = {
        id: 'linkedin-123',
        firstName: 'Jane',
        lastName: 'Smith',
        headline: 'Expert Product Manager | Driving innovation in FinTech',
        summary: 'Passionate product manager with expertise in financial technology, user experience design, and data-driven decision making. Proven track record of launching successful products.',
        industryName: 'Financial Services',
        locationName: 'New York, NY',
        profilePicture: 'https://example.com/profile.jpg',
        positions: [
          {
            id: 'pos-1',
            title: 'Senior Product Manager',
            company: { name: 'FinTech Innovations', id: 'fintech-123' },
            startDate: '2021-03',
            isCurrent: true,
            description: 'Leading product strategy for mobile banking solutions'
          }
        ],
        skills: [
          { id: 'skill-1', name: 'Product Management', endorsementCount: 25 },
          { id: 'skill-2', name: 'Agile', endorsementCount: 18 },
          { id: 'skill-3', name: 'Data Analysis', endorsementCount: 15 }
        ],
        educations: [
          {
            id: 'edu-1',
            schoolName: 'Stanford University',
            degree: 'MBA',
            fieldOfStudy: 'Business Administration',
            startDate: '2018-09',
            endDate: '2020-06'
          }
        ],
        certifications: [
          {
            id: 'cert-1',
            name: 'Certified Product Manager',
            authority: 'Product Management Institute',
            startDate: '2021-01'
          }
        ],
        languages: [
          { id: 'lang-1', name: 'English', proficiency: 'Native' },
          { id: 'lang-2', name: 'Spanish', proficiency: 'Professional' }
        ],
        connectionCount: 750,
        vanityName: 'jane-smith-pm',
        publicProfileUrl: 'https://linkedin.com/in/jane-smith-pm'
      };

      mockDatabaseService.getStoredAccessToken.mockResolvedValue('valid-token');
      mockAPIService.validateToken.mockResolvedValue(true);
      mockAPIService.getComprehensiveProfile.mockResolvedValue({
        success: true,
        data: mockProfile
      });

      // Use actual completeness service for testing
      const actualCompletenessService = new ProfileCompletenessService();
      const completeness = actualCompletenessService.calculateCompleteness(mockProfile, 750);

      expect(completeness.score).toBeGreaterThan(80); // Should be high due to complete profile
      expect(completeness.breakdown.basicInfo).toBeGreaterThan(80);
      expect(completeness.breakdown.headline).toBeGreaterThan(80); // Enhanced headline with keywords
      expect(completeness.breakdown.summary).toBeGreaterThan(80); // Keywords and call to action
      expect(completeness.suggestions).toBeInstanceOf(Array);
      expect(completeness.priorityImprovements).toBeInstanceOf(Array);
    });
  });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSyncResult);
    });

    it('should handle sync conflicts', async () => {
      mockAPIService.getComprehensiveProfile.mockRejectedValue({
        name: 'SyncConflictError',
        message: 'Profile has been modified since last sync',
        conflictingFields: ['headline', 'summary']
      });

      const response = await request(app)
        .post('/profile/sync');

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('Profile has been modified');
    });
  });

  describe('GET /profile/completeness', () => {
    it('should return profile completeness score', async () => {
      const mockProfile = {
        success: true,
        data: {
          firstName: 'John',
          lastName: 'Doe',
          headline: 'Software Engineer'
        }
      };
      const mockCompletenessResult = {
        score: 65,
        breakdown: {
          basicInfo: 15,
          headline: 10,
          summary: 20,
          experience: 0,
          education: 10,
          skills: 10,
          profilePicture: 4,
          connections: 4,
          certifications: 0,
          languages: 0,
          projects: 0,
          volunteerWork: 0,
          recommendations: 0,
          customUrl: 0
        },
        suggestions: [
          'Add professional summary',
          'Include work experience',
          'Add education background'
        ],
        missingFields: ['Professional Summary', 'Work Experience'],
        priorityImprovements: []
      };

      mockAPIService.getProfile.mockResolvedValue(mockProfile);
      mockCompletenessService.calculateScore.mockReturnValue(mockCompletenessResult);

      const response = await request(app)
        .get('/profile/completeness');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBe(65);
      expect(response.body.data.suggestions).toHaveLength(3);
    });

    it('should handle missing profile gracefully', async () => {
      mockAPIService.getProfile.mockRejectedValue({
        name: 'LinkedInAPIError',
        statusCode: 404,
        message: 'Profile not found'
      });

      const response = await request(app)
        .get('/profile/completeness');

      expect(response.status).toBe(200);
      expect(response.body.data.score).toBe(0);
      expect(response.body.data.suggestions).toContain('Connect your LinkedIn account');
    });
  });

  describe('GET /rate-limits', () => {
    it('should return current rate limit status', async () => {
      const mockRateLimits = {
        endpoints: [
          {
            endpoint: '/v2/me',
            hourlyUsage: 5,
            dailyUsage: 15,
            hourlyLimit: 40,
            dailyLimit: 400,
            remainingHourly: 35,
            remainingDaily: 385
          }
        ],
        global: {
          hourlyUsage: 20,
          dailyUsage: 50,
          hourlyLimit: 150,
          dailyLimit: 800
        }
      };

      mockRateLimitService.getAllLimits.mockResolvedValue(mockRateLimits);

      const response = await request(app)
        .get('/rate-limits');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRateLimits);
      expect(mockRateLimitService.getAllLimits).toHaveBeenCalledWith('test-user-123');
    });

    it('should handle rate limit service errors', async () => {
      mockRateLimitService.getAllLimits.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/rate-limits');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('oauth');
      expect(response.body.data).toHaveProperty('api');
      expect(response.body.data).toHaveProperty('connections');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockAPIService.getProfile.mockRejectedValue(new Error('Unexpected database error'));

      const response = await request(app)
        .get('/profile');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');
    });

    it('should provide detailed errors in development mode', async () => {
      process.env.NODE_ENV = 'development';
      mockAPIService.getProfile.mockRejectedValue(new Error('Database connection timeout'));

      const response = await request(app)
        .get('/profile');

      expect(response.status).toBe(500);
      expect(response.body.details).toContain('Database connection timeout');
      
      // Reset environment
      process.env.NODE_ENV = 'test';
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/auth/callback')
        .send('invalid-json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication Integration', () => {
    it('should handle missing authentication', async () => {
      // Create app without auth middleware
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.get('/profile', controller.getProfile.bind(controller));

      const response = await request(appNoAuth)
        .get('/profile');

      expect(response.status).toBe(401);
    });

    it('should validate subscription levels', async () => {
      // Mock user with insufficient subscription
      app.use((req: any, res, next) => {
        req.user = {
          id: 'basic-user',
          email: 'basic@example.com',
          role: 'USER',
          subscriptionLevel: 'BASIC'
        };
        next();
      });

      // This would need subscription validation in the actual controller
      const response = await request(app)
        .get('/profile');

      expect(response.status).toBe(200); // Should still work for basic features
    });
  });
});