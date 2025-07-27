// LinkedIn Integration Controller

import { Request, Response } from 'express';
import { LinkedInOAuthService } from '../services/oauth.service';
import { LinkedInAPIService } from '../services/api.service';
import { ProfileCompletenessService } from '../services/completeness.service';
import { LinkedInRateLimitService } from '../services/rateLimit.service';
import { LinkedInDatabaseService } from '../services/compliance.service';
import { 
  LinkedInProfile, 
  ProfileCompleteness, 
  LinkedInAnalytics,
  OptimizationSuggestion,
  OptimizationSuggestionResponse,
  AISuggestionRequest,
  AISuggestionResponse,
  SuggestionCompletionResponse
} from '../types/linkedin';

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
   * Get industry benchmarks for profile completeness
   */
  async getBenchmarks(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Get user's profile to determine industry
      const profileData = await this.databaseService.getCachedProfile(userId);
      let industry = 'general';
      
      if (profileData && profileData.profile.industry) {
        industry = profileData.profile.industry;
      }

      // Get industry benchmarks
      const benchmarks = this.completenessService.getIndustryBenchmarks(industry);

      res.json({
        success: true,
        data: {
          ...benchmarks,
          industry,
          retrievedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch industry benchmarks',
        code: 'BENCHMARKS_ERROR'
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
   * Get compliance status for a user
   */
  async getComplianceStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const complianceStatus = await this.rateLimitService.getComplianceStatus(userId);

      res.json({
        success: true,
        data: {
          compliance: complianceStatus,
          retrievedAt: new Date().toISOString(),
          statusSummary: {
            isCompliant: complianceStatus.status === 'COMPLIANT',
            needsAttention: complianceStatus.status === 'WARNING',
            hasViolations: complianceStatus.status === 'VIOLATION',
            safeToOperate: complianceStatus.score >= 70
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get compliance status',
        code: 'COMPLIANCE_STATUS_ERROR'
      });
    }
  }

  /**
   * Record a compliance violation (admin endpoint)
   */
  async recordViolation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // Only allow admins to record violations for other users
      const targetUserId = req.body.userId || userId;
      if (targetUserId !== userId && userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Admin access required to record violations for other users',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      const { violationType, details } = req.body;

      if (!violationType) {
        res.status(400).json({
          success: false,
          message: 'Violation type is required',
          code: 'MISSING_VIOLATION_TYPE'
        });
        return;
      }

      await this.rateLimitService.recordViolation(targetUserId, violationType, details || {});

      res.json({
        success: true,
        data: {
          message: 'Compliance violation recorded successfully',
          userId: targetUserId,
          violationType,
          recordedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to record violation',
        code: 'VIOLATION_RECORDING_ERROR'
      });
    }
  }

  /**
   * Get compliance report (admin endpoint)
   */
  async getComplianceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;
      
      if (userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Admin access required for compliance reports',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      const complianceReport = await this.rateLimitService.getComplianceReport();

      res.json({
        success: true,
        data: {
          report: complianceReport,
          generatedAt: new Date().toISOString(),
          summary: {
            totalCompliantUsers: complianceReport.complianceBreakdown.compliant,
            totalWarningUsers: complianceReport.complianceBreakdown.warning,
            totalViolationUsers: complianceReport.complianceBreakdown.violation,
            complianceRate: complianceReport.totalUsers > 0 
              ? Math.round((complianceReport.complianceBreakdown.compliant / complianceReport.totalUsers) * 100)
              : 100,
            riskLevel: complianceReport.averageComplianceScore >= 80 ? 'LOW' : 
                      complianceReport.averageComplianceScore >= 60 ? 'MEDIUM' : 'HIGH'
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate compliance report',
        code: 'COMPLIANCE_REPORT_ERROR'
      });
    }
  }

  /**
   * Get profile optimization suggestions
   */
  async getOptimizationSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Parse query parameters
      const {
        categories,
        priorities,
        maxSuggestions = 10,
        includeCompleted = false
      } = req.query;

      // Get current profile data and completeness
      const profileData = await this.databaseService.getCachedProfile(userId);
      if (!profileData) {
        res.status(400).json({
          success: false,
          message: 'Profile data not found. Please sync your LinkedIn profile first.',
          code: 'PROFILE_NOT_FOUND'
        });
        return;
      }

      const { profile, completeness } = profileData;

      // Generate optimization suggestions based on completeness analysis
      const priorityImprovements = this.completenessService.getPriorityImprovements(completeness);
      const recommendations = this.completenessService.getRecommendations(profile);

      // Convert completeness suggestions to our optimization format
      const suggestions = await this.generateOptimizationSuggestions(
        profile,
        completeness,
        priorityImprovements,
        recommendations,
        userId
      );

      // Filter suggestions based on query parameters
      let filteredSuggestions = suggestions;

      if (categories) {
        const categoryArray = Array.isArray(categories) ? categories : [categories];
        filteredSuggestions = filteredSuggestions.filter(s => 
          categoryArray.includes(s.category)
        );
      }

      if (priorities) {
        const priorityArray = Array.isArray(priorities) ? priorities : [priorities];
        filteredSuggestions = filteredSuggestions.filter(s => 
          priorityArray.includes(s.priority)
        );
      }

      if (!includeCompleted) {
        filteredSuggestions = filteredSuggestions.filter(s => !s.isCompleted);
      }

      // Limit results
      const limitedSuggestions = filteredSuggestions.slice(0, parseInt(maxSuggestions as string));

      // Calculate response metadata
      const completedCount = suggestions.filter(s => s.isCompleted).length;
      const potentialScoreIncrease = limitedSuggestions
        .filter(s => !s.isCompleted)
        .reduce((sum, s) => sum + s.impact, 0);

      const estimatedTimeToComplete = this.calculateEstimatedTime(
        limitedSuggestions.filter(s => !s.isCompleted)
      );

      const nextRecommendedAction = limitedSuggestions
        .filter(s => !s.isCompleted)
        .sort((a, b) => {
          // Sort by priority (high=3, medium=2, low=1) then by impact
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          return b.impact - a.impact;
        })[0];

      const response: OptimizationSuggestionResponse = {
        suggestions: limitedSuggestions,
        totalCount: filteredSuggestions.length,
        completedCount,
        potentialScoreIncrease,
        estimatedTimeToComplete,
        nextRecommendedAction
      };

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get optimization suggestions',
        code: 'OPTIMIZATION_SUGGESTIONS_ERROR'
      });
    }
  }

  /**
   * Mark optimization suggestion as completed
   */
  async completeOptimizationSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const { id: suggestionId } = req.params;
      const { implementedValue, feedback, partialCompletion = false } = req.body;

      if (!suggestionId) {
        res.status(400).json({
          success: false,
          message: 'Suggestion ID is required',
          code: 'MISSING_SUGGESTION_ID'
        });
        return;
      }

      // Get current profile data to calculate impact
      const profileDataBefore = await this.databaseService.getCachedProfile(userId);
      if (!profileDataBefore) {
        res.status(400).json({
          success: false,
          message: 'Profile data not found',
          code: 'PROFILE_NOT_FOUND'
        });
        return;
      }

      // Find the suggestion to complete
      const suggestions = await this.getStoredSuggestions(userId);
      const suggestion = suggestions.find(s => s.id === suggestionId);

      if (!suggestion) {
        res.status(404).json({
          success: false,
          message: 'Optimization suggestion not found',
          code: 'SUGGESTION_NOT_FOUND'
        });
        return;
      }

      if (suggestion.isCompleted) {
        res.status(400).json({
          success: false,
          message: 'Suggestion is already completed',
          code: 'SUGGESTION_ALREADY_COMPLETED'
        });
        return;
      }

      // Mark suggestion as completed
      const completedSuggestion: OptimizationSuggestion = {
        ...suggestion,
        isCompleted: !partialCompletion,
        completedAt: new Date(),
        updatedAt: new Date()
      };

      if (implementedValue) {
        completedSuggestion.suggestedValue = implementedValue;
      }

      // Store the completion
      await this.storeSuggestionCompletion(userId, completedSuggestion, feedback);

      // Trigger profile resync to get updated score
      const accessToken = await this.databaseService.getStoredAccessToken(userId);
      if (accessToken) {
        await this.performProfileSync(accessToken, userId);
      }

      // Get updated profile data to calculate score change
      const profileDataAfter = await this.databaseService.getCachedProfile(userId);
      const scoreChange = profileDataAfter 
        ? profileDataAfter.completeness.score - profileDataBefore.completeness.score
        : suggestion.impact; // fallback to estimated impact

      // Generate new recommendations
      const updatedSuggestions = await this.getStoredSuggestions(userId);
      const nextRecommendations = updatedSuggestions
        .filter(s => !s.isCompleted)
        .slice(0, 3);

      const response: SuggestionCompletionResponse = {
        suggestion: completedSuggestion,
        profileScoreChange: scoreChange,
        newProfileScore: profileDataAfter?.completeness.score || profileDataBefore.completeness.score,
        nextRecommendations,
        completedAt: completedSuggestion.completedAt!
      };

      // Track completion event for analytics
      await this.databaseService.trackLinkedInEvent(userId, 'optimization_suggestion_completed', {
        suggestionId,
        field: suggestion.field,
        category: suggestion.category,
        impact: suggestion.impact,
        scoreChange,
        partialCompletion
      });

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to complete optimization suggestion',
        code: 'SUGGESTION_COMPLETION_ERROR'
      });
    }
  }

  /**
   * Generate AI-powered suggestions for profile optimization
   */
  async generateAISuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const {
        field,
        currentContent,
        targetAudience,
        industry,
        tone = 'professional',
        maxLength,
        includeKeywords = []
      }: AISuggestionRequest = req.body;

      if (!field) {
        res.status(400).json({
          success: false,
          message: 'Field to optimize is required',
          code: 'MISSING_FIELD'
        });
        return;
      }

      // Get user's profile for context
      const profileData = await this.databaseService.getCachedProfile(userId);
      if (!profileData) {
        res.status(400).json({
          success: false,
          message: 'Profile data not found. Please sync your LinkedIn profile first.',
          code: 'PROFILE_NOT_FOUND'
        });
        return;
      }

      const { profile } = profileData;

      // Generate AI suggestions based on field type
      const suggestions = await this.generateAIContentSuggestions({
        field,
        currentContent: currentContent || this.getFieldValue(profile, field),
        profile,
        targetAudience,
        industry: industry || profile.industry,
        tone,
        maxLength,
        includeKeywords
      });

      // Generate compliance notes for LinkedIn
      const complianceNotes = this.generateComplianceNotes(field, suggestions);

      // Estimate impact on profile score
      const estimatedImpact = this.estimateAIContentImpact(field, currentContent, suggestions[0]);

      const response: AISuggestionResponse = {
        suggestions,
        originalContent: currentContent,
        improvementRationale: this.generateImprovementRationale(field, currentContent, suggestions[0]),
        keywordOptimization: includeKeywords,
        complianceNotes,
        estimatedImpact,
        generatedAt: new Date()
      };

      // Track AI suggestion generation for analytics
      await this.databaseService.trackLinkedInEvent(userId, 'ai_suggestion_generated', {
        field,
        tone,
        estimatedImpact,
        suggestionCount: suggestions.length
      });

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate AI suggestions',
        code: 'AI_SUGGESTION_ERROR'
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
  /**
   * Generate optimization suggestions from completeness analysis
   */
  private async generateOptimizationSuggestions(
    profile: LinkedInProfile,
    completeness: ProfileCompleteness,
    priorityImprovements: any[],
    recommendations: any[],
    userId: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const storedSuggestions = await this.getStoredSuggestions(userId);

    // Helper to create suggestion ID
    const createSuggestionId = (field: string, type: string) => 
      `${userId}_${field}_${type}_${Date.now()}`;

    // Convert priority improvements to suggestions
    priorityImprovements.forEach((improvement, index) => {
      const suggestionId = createSuggestionId(improvement.field, 'priority');
      
      // Check if this suggestion already exists
      const existingSuggestion = storedSuggestions.find(s => 
        s.field === improvement.field && s.title.includes(improvement.suggestion.substring(0, 20))
      );

      if (existingSuggestion) {
        suggestions.push(existingSuggestion);
        return;
      }

      suggestions.push({
        id: suggestionId,
        field: improvement.field,
        category: this.mapFieldToCategory(improvement.field),
        priority: improvement.impact >= 15 ? 'high' : improvement.impact >= 8 ? 'medium' : 'low',
        impact: improvement.impact,
        difficulty: improvement.difficulty,
        timeEstimate: improvement.timeEstimate,
        title: this.generateSuggestionTitle(improvement.field, improvement.suggestion),
        description: improvement.suggestion,
        actionSteps: this.generateActionSteps(improvement.field, profile),
        complianceNotes: this.generateFieldComplianceNotes(improvement.field),
        currentValue: this.getFieldValue(profile, improvement.field),
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    // Convert general recommendations to suggestions
    recommendations.forEach((rec, index) => {
      if (suggestions.some(s => s.field === rec.field)) return; // Avoid duplicates

      const suggestionId = createSuggestionId(rec.field, 'recommendation');
      
      suggestions.push({
        id: suggestionId,
        field: rec.field,
        category: this.mapFieldToCategory(rec.field),
        priority: rec.priority,
        impact: rec.impact,
        difficulty: rec.priority === 'high' ? 'easy' : rec.priority === 'medium' ? 'medium' : 'hard',
        timeEstimate: rec.timeEstimate,
        title: this.generateSuggestionTitle(rec.field, rec.suggestion),
        description: rec.suggestion,
        actionSteps: this.generateActionSteps(rec.field, profile),
        complianceNotes: this.generateFieldComplianceNotes(rec.field),
        currentValue: this.getFieldValue(profile, rec.field),
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    return suggestions;
  }

  /**
   * Map profile field to optimization category
   */
  private mapFieldToCategory(field: string): 'content' | 'engagement' | 'visibility' | 'networking' {
    const categoryMap: { [key: string]: 'content' | 'engagement' | 'visibility' | 'networking' } = {
      headline: 'content',
      summary: 'content',
      experience: 'content',
      skills: 'content',
      education: 'content',
      certifications: 'content',
      projects: 'content',
      languages: 'content',
      profilePicture: 'visibility',
      customUrl: 'visibility',
      connections: 'networking',
      recommendations: 'networking',
      volunteerWork: 'engagement',
      basicInfo: 'visibility'
    };

    return categoryMap[field] || 'content';
  }

  /**
   * Generate action steps for a specific field improvement
   */
  private generateActionSteps(field: string, profile: LinkedInProfile): string[] {
    const stepMap: { [key: string]: string[] } = {
      headline: [
        'Review current headline for clarity and impact',
        'Include your current role and key expertise',
        'Add value proposition or unique selling point',
        'Keep within 120 characters for optimal display',
        'Test different versions and monitor profile views'
      ],
      summary: [
        'Start with a compelling opening statement',
        'Highlight your key achievements and experience',
        'Include relevant keywords for your industry',
        'Add a call-to-action for networking',
        'Keep paragraphs short and scannable',
        'Proofread for grammar and spelling'
      ],
      experience: [
        'Add all relevant work positions',
        'Write detailed descriptions with accomplishments',
        'Use action verbs and quantify results where possible',
        'Include keywords relevant to your industry',
        'Keep descriptions between 50-200 words'
      ],
      skills: [
        'Add 5-15 relevant skills to your profile',
        'Prioritize skills most important to your career goals',
        'Ask colleagues and connections for endorsements',
        'Keep skills list updated with industry trends',
        'Remove outdated or irrelevant skills'
      ],
      profilePicture: [
        'Use a professional headshot photo',
        'Ensure good lighting and clear image quality',
        'Dress appropriately for your industry',
        'Smile and make eye contact with the camera',
        'Update photo every 2-3 years'
      ],
      connections: [
        'Send personalized connection requests',
        'Connect with colleagues, classmates, and industry peers',
        'Engage with connections\' content regularly',
        'Attend industry events and follow up with new contacts',
        'Maintain relationships through regular interaction'
      ]
    };

    return stepMap[field] || [
      'Review current content for completeness',
      'Research best practices for this field',
      'Update with relevant and accurate information',
      'Optimize for LinkedIn search visibility'
    ];
  }

  /**
   * Generate compliance notes for specific fields
   */
  private generateFieldComplianceNotes(field: string): string[] {
    const complianceMap: { [key: string]: string[] } = {
      headline: [
        'Avoid misleading job titles or company names',
        'Do not use excessive keywords or hashtags',
        'Keep professional and industry-appropriate'
      ],
      summary: [
        'Avoid personal contact information in summary',
        'Do not include links to external websites',
        'Keep content professional and truthful',
        'Respect LinkedIn community guidelines'
      ],
      experience: [
        'Ensure all employment information is accurate',
        'Do not exaggerate roles or responsibilities',
        'Respect confidentiality of previous employers',
        'Use appropriate professional language'
      ],
      connections: [
        'Only connect with people you know professionally',
        'Do not send spam or automated connection requests',
        'Respect LinkedIn\'s weekly connection limits',
        'Personalize connection request messages when possible'
      ]
    };

    return complianceMap[field] || [
      'Ensure all information is accurate and truthful',
      'Follow LinkedIn community guidelines',
      'Maintain professional standards'
    ];
  }

  /**
   * Generate suggestion title from field and description
   */
  private generateSuggestionTitle(field: string, description: string): string {
    const titleMap: { [key: string]: string } = {
      headline: 'Optimize Your Professional Headline',
      summary: 'Enhance Your Professional Summary',
      experience: 'Improve Work Experience Details',
      skills: 'Expand Your Skills Section',
      profilePicture: 'Add Professional Profile Photo',
      connections: 'Build Your Professional Network',
      education: 'Complete Education Information',
      certifications: 'Add Professional Certifications',
      projects: 'Showcase Your Projects',
      languages: 'Add Language Skills',
      recommendations: 'Get Professional Recommendations',
      customUrl: 'Create Custom LinkedIn URL'
    };

    return titleMap[field] || `Improve ${field.charAt(0).toUpperCase() + field.slice(1)}`;
  }

  /**
   * Get field value from profile
   */
  private getFieldValue(profile: LinkedInProfile, field: string): string {
    const getLocalizedValue = (obj?: { localized: { [key: string]: string } }) => {
      if (!obj?.localized) return '';
      const values = Object.values(obj.localized);
      return values.length > 0 ? values[0] : '';
    };

    switch (field) {
      case 'headline':
        return profile.headline || '';
      case 'summary':
        return profile.summary || '';
      case 'experience':
        return `${profile.positions?.length || 0} positions added`;
      case 'skills':
        return `${profile.skills?.length || 0} skills added`;
      case 'education':
        return `${profile.educations?.length || 0} education entries`;
      case 'profilePicture':
        return profile.profilePicture ? 'Photo uploaded' : 'No photo';
      case 'basicInfo':
        const firstName = getLocalizedValue(profile.firstName);
        const lastName = getLocalizedValue(profile.lastName);
        return `${firstName} ${lastName}`.trim();
      default:
        return 'Not specified';
    }
  }

  /**
   * Calculate estimated time to complete multiple suggestions
   */
  private calculateEstimatedTime(suggestions: OptimizationSuggestion[]): string {
    if (suggestions.length === 0) return '0 minutes';

    const timeMap: { [key: string]: number } = {
      '5 minutes': 5,
      '10 minutes': 10,
      '15 minutes': 15,
      '20 minutes': 20,
      '30 minutes': 30,
      '45 minutes': 45,
      '1 hour': 60,
      '1-2 hours': 90,
      '2 hours': 120
    };

    const totalMinutes = suggestions.reduce((sum, suggestion) => {
      const minutes = timeMap[suggestion.timeEstimate] || 30; // default to 30 minutes
      return sum + minutes;
    }, 0);

    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else if (totalMinutes < 120) {
      return `${Math.round(totalMinutes / 60 * 10) / 10} hour${totalMinutes >= 120 ? 's' : ''}`;
    } else {
      const hours = Math.round(totalMinutes / 60 * 10) / 10;
      return `${hours} hours`;
    }
  }

  /**
   * Get stored suggestions for a user (placeholder for database integration)
   */
  private async getStoredSuggestions(userId: string): Promise<OptimizationSuggestion[]> {
    // In a real implementation, this would fetch from database
    // For now, return empty array to indicate no stored suggestions
    return [];
  }

  /**
   * Store suggestion completion (placeholder for database integration)
   */
  private async storeSuggestionCompletion(
    userId: string, 
    suggestion: OptimizationSuggestion, 
    feedback?: string
  ): Promise<void> {
    // In a real implementation, this would store in database
    // For now, we'll track it as an analytics event
    await this.databaseService.trackLinkedInEvent(userId, 'suggestion_completion_stored', {
      suggestionId: suggestion.id,
      field: suggestion.field,
      impact: suggestion.impact,
      feedback
    });
  }

  /**
   * Generate AI content suggestions (placeholder for AI integration)
   */
  private async generateAIContentSuggestions(params: {
    field: string;
    currentContent?: string;
    profile: LinkedInProfile;
    targetAudience?: string;
    industry?: string;
    tone: string;
    maxLength?: number;
    includeKeywords: string[];
  }): Promise<string[]> {
    // This would integrate with OpenAI GPT-4 or similar AI service
    // For now, return template-based suggestions
    
    const { field, currentContent, profile, tone, includeKeywords } = params;

    const templateSuggestions: { [key: string]: string[] } = {
      headline: [
        `${profile.positions?.[0]?.title || 'Professional'} | Helping companies achieve their goals through innovative solutions`,
        `Experienced ${profile.industry || 'Professional'} | Driving growth and efficiency | Let's connect!`,
        `${profile.positions?.[0]?.title || 'Professional'} specializing in ${includeKeywords.join(', ') || 'industry expertise'}`
      ],
      summary: [
        `As an experienced ${profile.positions?.[0]?.title || 'professional'}, I bring a unique blend of skills and expertise to drive results. My background in ${profile.industry || 'various industries'} has equipped me with the knowledge to tackle complex challenges and deliver innovative solutions.\n\nKey areas of expertise:\n• ${includeKeywords.slice(0, 3).join('\n• ') || 'Industry-specific skills'}\n\nI'm passionate about building meaningful professional relationships and contributing to organizational success. Let's connect to explore opportunities for collaboration!`,
        
        `Dedicated ${profile.positions?.[0]?.title || 'professional'} with a proven track record of success in ${profile.industry || 'business development'}. I specialize in ${includeKeywords.slice(0, 2).join(' and ') || 'strategic initiatives'} and am committed to driving growth and innovation.\n\nThroughout my career, I've demonstrated expertise in:\n• Strategic planning and execution\n• Team leadership and development\n• ${includeKeywords[0] || 'Industry expertise'}\n\nI'm always interested in connecting with like-minded professionals and exploring new opportunities. Feel free to reach out!`
      ]
    };

    return templateSuggestions[field] || [
      `Optimized ${field} content tailored for your profile`,
      `Professional ${field} with industry keywords: ${includeKeywords.join(', ')}`,
      `Enhanced ${field} designed to improve your LinkedIn visibility`
    ];
  }

  /**
   * Generate compliance notes for AI suggestions
   */
  private generateComplianceNotes(field: string, suggestions: string[]): string[] {
    const baseNotes = [
      'Ensure all content is truthful and accurate',
      'Follow LinkedIn community guidelines',
      'Avoid excessive self-promotion',
      'Respect intellectual property rights'
    ];

    const fieldSpecificNotes: { [key: string]: string[] } = {
      headline: [
        'Do not use misleading job titles',
        'Avoid excessive keywords or hashtags',
        'Keep within LinkedIn character limits'
      ],
      summary: [
        'Do not include external links or contact information',
        'Avoid overly promotional language',
        'Ensure content is professional and appropriate'
      ]
    };

    return [...baseNotes, ...(fieldSpecificNotes[field] || [])];
  }

  /**
   * Estimate impact of AI content improvement
   */
  private estimateAIContentImpact(field: string, currentContent?: string, suggestedContent?: string): number {
    // Simple impact estimation based on field importance and content improvement
    const fieldImpacts: { [key: string]: number } = {
      headline: 12,
      summary: 18,
      experience: 15,
      skills: 8,
      education: 6
    };

    const baseImpact = fieldImpacts[field] || 5;
    
    // Reduce impact if current content exists and is substantial
    if (currentContent && currentContent.length > 50) {
      return Math.round(baseImpact * 0.3); // 30% of full impact for improvements
    }

    return baseImpact; // Full impact for missing content
  }

  /**
   * Generate improvement rationale for AI suggestions
   */
  private generateImprovementRationale(field: string, currentContent?: string, suggestedContent?: string): string {
    if (!currentContent) {
      return `Adding optimized ${field} content will significantly improve your profile completeness and visibility on LinkedIn.`;
    }

    const improvements = [
      'Enhanced keyword optimization for better search visibility',
      'Improved professional tone and clarity',
      'Better structure and readability',
      'Industry-specific language and terminology',
      'Call-to-action for networking and engagement'
    ];

    return `The suggested ${field} improvements focus on: ${improvements.slice(0, 3).join(', ')}. These changes will help increase your profile visibility and professional credibility.`;
  }

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