// LinkedIn Integration Controller

import { Request, Response } from 'express';
import { LinkedInOAuthService } from '../services/oauth.service';
import { LinkedInAPIService } from '../services/api.service';
import { ProfileCompletenessService } from '../services/completeness.service';
import { LinkedInRateLimitService } from '../services/rateLimit.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class LinkedInController {
  private oauthService: LinkedInOAuthService;
  private apiService: LinkedInAPIService;
  private completenessService: ProfileCompletenessService;
  private rateLimitService: LinkedInRateLimitService;

  constructor() {
    this.oauthService = new LinkedInOAuthService();
    this.apiService = new LinkedInAPIService();
    this.completenessService = new ProfileCompletenessService();
    this.rateLimitService = new LinkedInRateLimitService();
  }

  /**
   * Initiate LinkedIn OAuth flow
   */
  async initiateAuth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const authUrl = this.oauthService.generateAuthUrl(userId);

      res.json({
        success: true,
        data: {
          authUrl,
          message: 'Redirect user to this URL to begin LinkedIn authorization'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to initiate LinkedIn authorization',
        code: 'AUTH_INITIATION_ERROR'
      });
    }
  }

  /**
   * Handle LinkedIn OAuth callback
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        res.status(400).json({
          success: false,
          message: error_description || 'LinkedIn authorization was denied',
          code: error as string
        });
        return;
      }

      if (!code || !state) {
        res.status(400).json({
          success: false,
          message: 'Missing authorization code or state parameter',
          code: 'INVALID_CALLBACK'
        });
        return;
      }

      const result = await this.oauthService.exchangeCodeForTokens(
        code as string,
        state as string
      );

      if (!result.success || !result.data) {
        res.status(400).json({
          success: false,
          message: result.error?.message || 'Failed to exchange authorization code',
          code: result.error?.code || 'TOKEN_EXCHANGE_ERROR'
        });
        return;
      }

      const { tokens, userId } = result.data;

      // Get LinkedIn profile data
      const profileResult = await this.apiService.getComprehensiveProfile(
        tokens.accessToken,
        userId
      );

      if (!profileResult.success) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch LinkedIn profile data',
          code: 'PROFILE_FETCH_ERROR'
        });
        return;
      }

      // Calculate profile completeness
      const completeness = this.completenessService.calculateCompleteness(
        profileResult.data!
      );

      // TODO: Store tokens and profile data in database
      // This would typically involve:
      // - Encrypting and storing access/refresh tokens
      // - Storing profile data
      // - Creating/updating LinkedInAccount record
      // - Logging the connection event

      res.json({
        success: true,
        data: {
          message: 'LinkedIn account successfully connected',
          profile: profileResult.data,
          completeness,
          userId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'OAuth callback handling failed',
        code: 'CALLBACK_PROCESSING_ERROR'
      });
    }
  }

  /**
   * Get current LinkedIn profile data
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // TODO: Get access token from database
      const accessToken = req.headers['linkedin-access-token'] as string;
      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'LinkedIn access token required',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }

      const profileResult = await this.apiService.getComprehensiveProfile(
        accessToken,
        userId
      );

      if (!profileResult.success) {
        res.status(400).json(profileResult);
        return;
      }

      // Calculate completeness score
      const completeness = this.completenessService.calculateCompleteness(
        profileResult.data!
      );

      res.json({
        success: true,
        data: {
          profile: profileResult.data,
          completeness,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch profile',
        code: 'PROFILE_FETCH_ERROR'
      });
    }
  }

  /**
   * Get profile completeness analysis
   */
  async getCompleteness(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const accessToken = req.headers['linkedin-access-token'] as string;
      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'LinkedIn access token required',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }

      // Get profile data
      const profileResult = await this.apiService.getComprehensiveProfile(
        accessToken,
        userId
      );

      if (!profileResult.success) {
        res.status(400).json(profileResult);
        return;
      }

      // Calculate completeness
      const completeness = this.completenessService.calculateCompleteness(
        profileResult.data!
      );

      // Get improvement priorities
      const priorities = this.completenessService.getPriorityImprovements(completeness);

      // Get industry benchmarks
      const benchmarks = this.completenessService.getIndustryBenchmarks(
        profileResult.data!.industry
      );

      res.json({
        success: true,
        data: {
          completeness,
          priorities,
          benchmarks,
          analyzedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to analyze profile completeness',
        code: 'COMPLETENESS_ANALYSIS_ERROR'
      });
    }
  }

  /**
   * Sync profile data from LinkedIn
   */
  async syncProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const accessToken = req.headers['linkedin-access-token'] as string;
      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'LinkedIn access token required',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }

      // Validate token first
      const isValidToken = await this.apiService.validateToken(accessToken, userId);
      if (!isValidToken) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired LinkedIn access token',
          code: 'INVALID_TOKEN'
        });
        return;
      }

      // Get fresh profile data
      const profileResult = await this.apiService.getComprehensiveProfile(
        accessToken,
        userId
      );

      if (!profileResult.success) {
        res.status(400).json(profileResult);
        return;
      }

      // TODO: Update database with fresh profile data
      // This would typically involve:
      // - Updating LinkedInAccount.profileData
      // - Updating LinkedInAccount.lastSyncAt
      // - Creating LinkedInAnalytics records if analytics available
      // - Logging the sync event

      res.json({
        success: true,
        data: {
          message: 'Profile data synchronized successfully',
          profile: profileResult.data,
          syncedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Profile sync failed',
        code: 'SYNC_ERROR'
      });
    }
  }

  /**
   * Get LinkedIn analytics data
   */
  async getAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const accessToken = req.headers['linkedin-access-token'] as string;
      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'LinkedIn access token required',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }

      const analyticsResult = await this.apiService.getProfileAnalytics(
        accessToken,
        userId
      );

      if (!analyticsResult.success) {
        res.status(400).json(analyticsResult);
        return;
      }

      res.json({
        success: true,
        data: {
          analytics: analyticsResult.data,
          retrievedAt: new Date().toISOString(),
          note: 'Full analytics require LinkedIn Marketing API access'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch analytics',
        code: 'ANALYTICS_ERROR'
      });
    }
  }

  /**
   * Create LinkedIn post
   */
  async createPost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const accessToken = req.headers['linkedin-access-token'] as string;
      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'LinkedIn access token required',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }

      const { text, visibility = 'CONNECTIONS', media } = req.body;

      if (!text) {
        res.status(400).json({
          success: false,
          message: 'Post text is required',
          code: 'MISSING_TEXT'
        });
        return;
      }

      const postResult = await this.apiService.createPost(
        accessToken,
        userId,
        { text, visibility, media }
      );

      if (!postResult.success) {
        res.status(400).json(postResult);
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'Post created successfully',
          post: postResult.data
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create post',
        code: 'POST_CREATION_ERROR'
      });
    }
  }

  /**
   * Send connection request
   */
  async sendConnectionRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const accessToken = req.headers['linkedin-access-token'] as string;
      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'LinkedIn access token required',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }

      const { targetUserId, message } = req.body;

      if (!targetUserId) {
        res.status(400).json({
          success: false,
          message: 'Target user ID is required',
          code: 'MISSING_TARGET_USER_ID'
        });
        return;
      }

      const result = await this.apiService.sendConnectionRequest(
        accessToken,
        userId,
        targetUserId,
        message
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'Connection request sent successfully',
          targetUserId,
          sentAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send connection request',
        code: 'CONNECTION_REQUEST_ERROR'
      });
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const rateLimitStatus = await this.apiService.getRateLimitStatus(userId);

      res.json({
        success: true,
        data: {
          rateLimits: rateLimitStatus,
          retrievedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get rate limit status',
        code: 'RATE_LIMIT_STATUS_ERROR'
      });
    }
  }

  /**
   * Disconnect LinkedIn account
   */
  async disconnectAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const accessToken = req.headers['linkedin-access-token'] as string;
      if (accessToken) {
        // Revoke access token
        const revokeResult = await this.oauthService.revokeAccessToken(accessToken);
        if (!revokeResult.success) {
          console.warn('Failed to revoke LinkedIn access token:', revokeResult.error);
        }
      }

      // TODO: Remove LinkedIn account data from database
      // This would typically involve:
      // - Deleting LinkedInAccount record
      // - Optionally keeping analytics data for user insights
      // - Logging the disconnection event

      res.json({
        success: true,
        data: {
          message: 'LinkedIn account disconnected successfully',
          disconnectedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disconnect LinkedIn account',
        code: 'DISCONNECT_ERROR'
      });
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const [apiHealth, rateLimitHealth] = await Promise.all([
        this.apiService.getHealthStatus(),
        this.rateLimitService.getHealthStatus()
      ]);

      const overallStatus = apiHealth.status === 'healthy' && rateLimitHealth.status === 'healthy' 
        ? 'healthy' 
        : 'degraded';

      res.json({
        status: overallStatus,
        service: 'linkedin-service',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        checks: {
          api: apiHealth.status,
          rateLimiting: rateLimitHealth.status,
          oauth: this.oauthService.isConfigured() ? 'configured' : 'not_configured'
        },
        details: {
          api: apiHealth,
          rateLimiting: rateLimitHealth,
          pendingOAuthStates: this.oauthService.getPendingStatesCount()
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        service: 'linkedin-service',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  }
}