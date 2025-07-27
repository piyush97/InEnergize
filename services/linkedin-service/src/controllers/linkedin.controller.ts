// LinkedIn Integration Controller

import { Request, Response } from 'express';
import { LinkedInOAuthService } from '../services/oauth.service';
import { LinkedInAPIService } from '../services/api.service';
import { ProfileCompletenessService } from '../services/completeness.service';
import { LinkedInRateLimitService } from '../services/rateLimit.service';
import { LinkedInDatabaseService } from '../services/compliance.service';
import { LinkedInProfile, ProfileCompleteness, LinkedInAnalytics } from '../types/linkedin';

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
  private databaseService: LinkedInDatabaseService;

  constructor() {
    this.oauthService = new LinkedInOAuthService();
    this.apiService = new LinkedInAPIService();
    this.completenessService = new ProfileCompletenessService();
    this.rateLimitService = new LinkedInRateLimitService();
    this.databaseService = new LinkedInDatabaseService();
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

      // Get LinkedIn profile data and perform initial synchronization
      const syncResult = await this.performInitialSync(tokens.accessToken, userId);

      if (!syncResult.success) {
        res.status(400).json({
          success: false,
          message: 'Failed to synchronize LinkedIn profile data',
          code: 'INITIAL_SYNC_ERROR'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          message: 'LinkedIn account successfully connected and synchronized',
          profile: syncResult.profile,
          completeness: syncResult.completeness,
          userId,
          syncedAt: new Date().toISOString()
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

      // Get stored access token from database or header
      const accessToken = await this.databaseService.getStoredAccessToken(userId) || 
                          req.headers['linkedin-access-token'] as string;
      
      if (!accessToken) {
        res.status(400).json({
          success: false,
          message: 'LinkedIn access token required. Please reconnect your LinkedIn account.',
          code: 'TOKEN_REQUIRED'
        });
        return;
      }

      // Validate token first
      const isValidToken = await this.apiService.validateToken(accessToken, userId);
      if (!isValidToken) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired LinkedIn access token. Please reconnect your LinkedIn account.',
          code: 'INVALID_TOKEN'
        });
        return;
      }

      // Perform comprehensive profile synchronization
      const syncResult = await this.performProfileSync(accessToken, userId);

      if (!syncResult.success) {
        res.status(400).json(syncResult);
        return;
      }

      // Send real-time analytics data to analytics service
      await this.databaseService.sendAnalyticsData(userId, {
        profile: syncResult.profile!,
        completeness: syncResult.completeness!,
        analytics: syncResult.analytics
      });

      res.json({
        success: true,
        data: {
          message: 'Profile data synchronized successfully',
          profile: syncResult.profile,
          completeness: syncResult.completeness,
          analytics: syncResult.analytics,
          syncedAt: new Date().toISOString(),
          nextSyncRecommended: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
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

      // Try to get cached profile data first
      const cachedProfile = await this.databaseService.getCachedProfile(userId);
      if (cachedProfile) {
        res.json({
          success: true,
          data: {
            profile: cachedProfile.profile,
            completeness: cachedProfile.completeness,
            lastUpdated: cachedProfile.lastSyncAt,
            source: 'cache'
          }
        });
        return;
      }

      // Fallback to live data if no cache
      const accessToken = await this.databaseService.getStoredAccessToken(userId) || 
                          req.headers['linkedin-access-token'] as string;
      
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
          lastUpdated: new Date().toISOString(),
          source: 'live'
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
   * Get profile completeness analysis with industry benchmarks
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

      // Get current profile data
      const profileData = await this.databaseService.getCachedProfile(userId);
      let profile: LinkedInProfile;
      let completeness: ProfileCompleteness;

      if (profileData) {
        profile = profileData.profile;
        completeness = profileData.completeness;
      } else {
        // Fetch live data if no cache
        const accessToken = await this.databaseService.getStoredAccessToken(userId) || 
                            req.headers['linkedin-access-token'] as string;
        
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

        profile = profileResult.data!;
        completeness = this.completenessService.calculateCompleteness(profile);
      }

      // Get improvement priorities
      const priorities = this.completenessService.getPriorityImprovements(completeness);

      // Get industry benchmarks
      const benchmarks = this.completenessService.getIndustryBenchmarks(profile.industry);

      // Calculate industry comparison
      const industryComparison = {
        scoreVsAverage: completeness.score - benchmarks.averageScore,
        scoreVsTopPercentile: completeness.score - benchmarks.topPercentileScore,
        ranking: this.calculateIndustryRanking(completeness.score, benchmarks)
      };

      res.json({
        success: true,
        data: {
          completeness,
          priorities,
          benchmarks,
          industryComparison,
          recommendations: this.generatePersonalizedRecommendations(profile, completeness, priorities),
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

      const accessToken = await this.databaseService.getStoredAccessToken(userId) || 
                          req.headers['linkedin-access-token'] as string;
      
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

      // Enhance analytics with historical data from analytics service
      const enhancedAnalytics = await this.enhanceAnalyticsWithHistoricalData(
        userId, 
        analyticsResult.data!
      );

      res.json({
        success: true,
        data: {
          analytics: enhancedAnalytics,
          retrievedAt: new Date().toISOString(),
          note: 'Analytics combined from LinkedIn API and historical tracking data'
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

      const accessToken = await this.databaseService.getStoredAccessToken(userId) || 
                          req.headers['linkedin-access-token'] as string;
      
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

      // Track post creation in analytics
      await this.databaseService.trackLinkedInEvent(userId, 'post_created', {
        postId: postResult.data!.id,
        text: postResult.data!.text,
        visibility: postResult.data!.visibility,
        hasMedia: !!(postResult.data!.content?.media?.length)
      });

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

      const accessToken = await this.databaseService.getStoredAccessToken(userId) || 
                          req.headers['linkedin-access-token'] as string;
      
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

      // Track connection request in analytics
      await this.databaseService.trackLinkedInEvent(userId, 'connection_request_sent', {
        targetUserId,
        source: 'manual',
        hasPersonalMessage: !!message
      });

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

      const accessToken = await this.databaseService.getStoredAccessToken(userId);
      if (accessToken) {
        // Revoke access token
        const revokeResult = await this.oauthService.revokeAccessToken(accessToken);
        if (!revokeResult.success) {
          console.warn('Failed to revoke LinkedIn access token:', revokeResult.error);
        }
      }

      // Remove LinkedIn account data from database and cache
      await this.databaseService.removeLinkedInAccount(userId);

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

  // Helper methods for database and analytics integration

  /**
   * Perform initial profile synchronization after OAuth
   */
  private async performInitialSync(accessToken: string, userId: string): Promise<{
    success: boolean;
    profile?: LinkedInProfile;
    completeness?: ProfileCompleteness;
    error?: any;
  }> {
    try {
      // Get comprehensive profile data
      const profileResult = await this.apiService.getComprehensiveProfile(accessToken, userId);
      
      if (!profileResult.success) {
        return { success: false, error: profileResult.error };
      }

      const profile = profileResult.data!;
      
      // Calculate completeness
      const completeness = this.completenessService.calculateCompleteness(profile);

      // Store tokens and profile data in database
      await this.databaseService.storeLinkedInAccount(userId, {
        accessToken,
        profile,
        completeness,
        connectedAt: new Date(),
        lastSyncAt: new Date()
      });

      // Send initial analytics data
      await this.databaseService.sendAnalyticsData(userId, {
        profile,
        completeness
      });

      return { success: true, profile, completeness };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Perform comprehensive profile synchronization
   */
  private async performProfileSync(accessToken: string, userId: string): Promise<{
    success: boolean;
    profile?: LinkedInProfile;
    completeness?: ProfileCompleteness;
    analytics?: Partial<LinkedInAnalytics>;
    error?: any;
  }> {
    try {
      // Get fresh profile data
      const [profileResult, analyticsResult] = await Promise.all([
        this.apiService.getComprehensiveProfile(accessToken, userId),
        this.apiService.getProfileAnalytics(accessToken, userId)
      ]);

      if (!profileResult.success) {
        return { success: false, error: profileResult.error };
      }

      const profile = profileResult.data!;
      const analytics = analyticsResult.success ? analyticsResult.data : undefined;
      
      // Calculate updated completeness
      const completeness = this.completenessService.calculateCompleteness(profile);

      // Update database with fresh data
      await this.databaseService.updateLinkedInAccount(userId, {
        profile,
        completeness,
        analytics,
        lastSyncAt: new Date()
      });

      return { success: true, profile, completeness, analytics };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Generate personalized recommendations based on profile analysis
   */
  private generatePersonalizedRecommendations(
    profile: LinkedInProfile,
    completeness: ProfileCompleteness,
    priorities: any[]
  ): string[] {
    const recommendations: string[] = [];

    // High-impact recommendations based on missing elements
    if (completeness.score < 50) {
      recommendations.push('Your profile needs significant improvement. Focus on completing basic information first.');
    } else if (completeness.score < 75) {
      recommendations.push('Your profile is on the right track. Focus on the high-impact improvements below.');
    } else if (completeness.score < 90) {
      recommendations.push('Great profile! A few optimizations will make it excellent.');
    } else {
      recommendations.push('Excellent profile! Focus on maintaining and updating your content regularly.');
    }

    // Add priority-based recommendations
    priorities.slice(0, 3).forEach(priority => {
      recommendations.push(`${priority.suggestion} (${priority.timeEstimate} effort for ${priority.impact} point impact)`);
    });

    // Industry-specific recommendations
    if (profile.industry) {
      const benchmarks = this.completenessService.getIndustryBenchmarks(profile.industry);
      benchmarks.industrySpecificTips.forEach(tip => {
        recommendations.push(`Industry tip: ${tip}`);
      });
    }

    return recommendations;
  }

  /**
   * Calculate industry ranking based on completeness score
   */
  private calculateIndustryRanking(score: number, benchmarks: any): string {
    if (score >= benchmarks.topPercentileScore) {
      return 'Top 10%';
    } else if (score >= benchmarks.averageScore + 10) {
      return 'Above Average';
    } else if (score >= benchmarks.averageScore - 10) {
      return 'Average';
    } else {
      return 'Below Average';
    }
  }

  /**
   * Enhanced analytics with historical data
   */
  private async enhanceAnalyticsWithHistoricalData(
    userId: string,
    currentAnalytics: Partial<LinkedInAnalytics>
  ): Promise<any> {
    // This would fetch historical data from analytics service
    // and combine it with current LinkedIn data
    return {
      ...currentAnalytics,
      historical: {
        profileViewsTrend: [], // 30-day trend
        connectionGrowthTrend: [], // 30-day trend
        completenessHistory: [], // Historical completeness scores
        engagementTrend: [] // 30-day engagement trend
      },
      insights: {
        bestPerformingContent: [],
        optimalPostingTimes: [],
        audienceInsights: {},
        competitorsComparison: {}
      }
    };
  }
}