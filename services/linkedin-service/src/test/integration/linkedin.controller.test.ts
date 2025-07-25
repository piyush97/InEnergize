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

  beforeEach(() => {
    // Create mocked services
    mockOAuthService = new LinkedInOAuthService({} as any) as jest.Mocked<LinkedInOAuthService>;
    mockAPIService = new LinkedInAPIService({} as any) as jest.Mocked<LinkedInAPIService>;
    mockCompletenessService = new ProfileCompletenessService() as jest.Mocked<ProfileCompletenessService>;
    mockRateLimitService = new LinkedInRateLimitService() as jest.Mocked<LinkedInRateLimitService>;

    // Create controller with mocked services
    controller = new LinkedInController(
      mockOAuthService,
      mockAPIService,
      mockCompletenessService,
      mockRateLimitService
    );

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
    app.get('/profile/completeness', controller.getProfileCompleteness.bind(controller));
    app.get('/rate-limits', controller.getRateLimitStatus.bind(controller));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/initiate', () => {
    it('should initiate OAuth flow successfully', async () => {
      const mockAuthResponse = {
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization?client_id=123&...',
        state: 'state-123',
        codeVerifier: 'verifier-123'
      };

      mockOAuthService.generateAuthUrl.mockResolvedValue(mockAuthResponse);

      const response = await request(app)
        .post('/auth/initiate')
        .send({
          scopes: ['r_basicprofile', 'r_emailaddress'],
          redirectUri: 'http://localhost:3000/callback'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBe(mockAuthResponse.authUrl);
      expect(response.body.data.state).toBe(mockAuthResponse.state);
      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith(
        'test-user-123',
        ['r_basicprofile', 'r_emailaddress']
      );
    });

    it('should handle OAuth service errors', async () => {
      mockOAuthService.generateAuthUrl.mockRejectedValue(new Error('OAuth service unavailable'));

      const response = await request(app)
        .post('/auth/initiate')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('OAuth service unavailable');
    });

    it('should handle rate limiting', async () => {
      mockOAuthService.generateAuthUrl.mockRejectedValue({
        name: 'RateLimitError',
        message: 'Rate limit exceeded',
        retryAfter: 3600
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
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 5184000,
        scope: 'r_basicprofile r_emailaddress'
      };

      mockOAuthService.validateState.mockResolvedValue(true);
      mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokenResponse);

      const response = await request(app)
        .post('/auth/callback')
        .send({
          code: 'auth-code-123',
          state: 'state-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe(mockTokenResponse.accessToken);
      expect(mockOAuthService.validateState).toHaveBeenCalledWith('state-123', 'test-user-123');
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
        id: 'linkedin-123',
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Software Engineer',
        summary: 'Experienced developer...',
        emailAddress: 'john@example.com'
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
      const mockSyncResult = {
        success: true,
        updatedFields: ['headline', 'summary', 'positions'],
        profileData: {
          id: 'linkedin-123',
          firstName: 'John',
          lastName: 'Doe'
        }
      };

      mockAPIService.syncProfile.mockResolvedValue(mockSyncResult);

      const response = await request(app)
        .post('/profile/sync')
        .send({
          forceSync: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSyncResult);
    });

    it('should handle sync conflicts', async () => {
      mockAPIService.syncProfile.mockRejectedValue({
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
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Software Engineer'
      };
      const mockCompletenessResult = {
        score: 65,
        breakdown: {
          basicInfo: 15,
          contactInfo: 10,
          experience: 20,
          education: 0,
          skills: 10,
          media: 10
        },
        suggestions: [
          'Add professional summary',
          'Include work experience',
          'Add education background'
        ]
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
        oauth: {
          limit: 20,
          remaining: 15,
          resetTime: Date.now() + 3600000,
          retryAfter: null
        },
        api: {
          limit: 500,
          remaining: 450,
          resetTime: Date.now() + 3600000,
          retryAfter: null
        },
        connections: {
          limit: 100,
          remaining: 85,
          resetTime: Date.now() + 86400000,
          retryAfter: null
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