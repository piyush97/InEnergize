// LinkedIn API Service for profile data synchronization and management

import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Extend axios request config to include metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: number;
  };
}
import {
  LinkedInProfile,
  LinkedInAPIResponse,
  LinkedInAPIError,
  LinkedInAnalytics,
  LinkedInConnection,
  LinkedInPost,
  RateLimitInfo
} from '../types/linkedin';
import { LinkedInRateLimitService } from './rateLimit.service';

export class LinkedInAPIService {
  private axiosInstance: AxiosInstance;
  private rateLimitService: LinkedInRateLimitService;
  private baseURL = 'https://api.linkedin.com';

  constructor() {
    this.rateLimitService = new LinkedInRateLimitService();
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'InErgize-LinkedIn-Integration/1.0'
      }
    });

    // Add request interceptor for authentication and rate limiting
    this.axiosInstance.interceptors.request.use(
      async (config: ExtendedAxiosRequestConfig) => {
        // Add timestamp for request tracking
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling and rate limit tracking
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Track successful requests
        const config = response.config as any;
        if (config.metadata?.userId && config.metadata?.endpoint) {
          this.rateLimitService.recordRequest(
            config.metadata.userId,
            config.metadata.endpoint,
            true
          );
        }
        return response;
      },
      async (error) => {
        // Track failed requests
        const config = error.config as any;
        if (config?.metadata?.userId && config?.metadata?.endpoint) {
          await this.rateLimitService.recordRequest(
            config.metadata.userId,
            config.metadata.endpoint,
            false
          );
        }

        // Handle LinkedIn-specific errors
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          throw new LinkedInAPIError(
            'Rate limit exceeded',
            'RATE_LIMIT_EXCEEDED',
            429,
            error.response.data
          );
        }

        throw error;
      }
    );
  }

  /**
   * Get user's basic profile information
   */
  async getProfile(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInProfile>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/me',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get('/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
            metadata: { userId, endpoint: '/v2/me' }
          } as any);

          // Get additional profile data
          const [emailResponse, positionsResponse] = await Promise.all([
            this.getEmailAddress(accessToken, userId),
            this.getPositions(accessToken, userId)
          ]);

          const profile: LinkedInProfile = {
            ...response.data,
            emailAddress: emailResponse.data,
            positions: positionsResponse.data
          };

          return {
            success: true,
            data: profile
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch LinkedIn profile');
        }
      }
    );
  }

  /**
   * Get user's email address
   */
  async getEmailAddress(accessToken: string, userId: string): Promise<LinkedInAPIResponse<string>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/emailAddress',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/emailAddress?q=members&projection=(elements*(handle~))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/emailAddress' }
            } as any
          );

          const email = response.data.elements?.[0]?.['handle~']?.emailAddress;
          
          return {
            success: true,
            data: email || ''
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch email address');
        }
      }
    );
  }

  /**
   * Get user's work positions/experience
   */
  async getPositions(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInProfile['positions']>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/positions',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/positions?q=members&projection=(elements*(*,company~(name)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/positions' }
            } as any
          );

          const positions = response.data.elements?.map((pos: any) => ({
            id: pos.id,
            title: pos.title,
            company: {
              name: pos['company~']?.name || pos.companyName || '',
              id: pos.company || ''
            },
            location: pos.location,
            description: pos.description,
            startDate: pos.startDate,
            endDate: pos.endDate,
            isCurrent: !pos.endDate
          })) || [];

          return {
            success: true,
            data: positions
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch positions');
        }
      }
    );
  }

  /**
   * Get user's education information
   */
  async getEducation(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInProfile['educations']>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/educations',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/educations?q=members&projection=(elements*(*,school~(name)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/educations' }
            } as any
          );

          const educations = response.data.elements?.map((edu: any) => ({
            id: edu.id,
            schoolName: edu['school~']?.name || edu.schoolName || '',
            fieldOfStudy: edu.fieldOfStudy,
            degree: edu.degree,
            grade: edu.grade,
            activities: edu.activities,
            notes: edu.notes,
            startDate: edu.startDate,
            endDate: edu.endDate
          })) || [];

          return {
            success: true,
            data: educations
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch education');
        }
      }
    );
  }

  /**
   * Get user's skills
   */
  async getSkills(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInProfile['skills']>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/skills',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/skills?q=members&projection=(elements*(name,endorsementCount))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/skills' }
            } as any
          );

          const skills = response.data.elements?.map((skill: any) => ({
            id: skill.id,
            name: skill.name,
            endorsementCount: skill.endorsementCount || 0
          })) || [];

          return {
            success: true,
            data: skills
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch skills');
        }
      }
    );
  }

  /**
   * Get user's connections (limited by LinkedIn API)
   */
  async getConnections(accessToken: string, userId: string, start: number = 0, count: number = 50): Promise<LinkedInAPIResponse<LinkedInConnection[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/connections',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            `/v2/connections?q=viewer&start=${start}&count=${count}&projection=(elements*(firstName,lastName,headline,profilePicture))`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/connections' }
            } as any
          );

          const connections: LinkedInConnection[] = response.data.elements?.map((conn: any) => ({
            id: conn.id,
            firstName: conn.firstName,
            lastName: conn.lastName,
            headline: conn.headline,
            profilePicture: conn.profilePicture?.displayImage,
            publicProfileUrl: conn.publicProfileUrl,
            connectionDate: new Date(),
            mutualConnections: 0 // LinkedIn doesn't provide this in basic API
          })) || [];

          return {
            success: true,
            data: connections
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch connections');
        }
      }
    );
  }

  /**
   * Get profile analytics (limited - requires LinkedIn Marketing API)
   */
  async getProfileAnalytics(accessToken: string, userId: string): Promise<LinkedInAPIResponse<Partial<LinkedInAnalytics>>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/networkUpdates',
      async () => {
        try {
          // Note: Full analytics require LinkedIn Marketing API access
          // This is a simplified version using available data
          
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/networkUpdates?q=memberNetworkActivity&count=50',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/networkUpdates' }
            } as any
          );

          // Basic analytics from available data
          const analytics: Partial<LinkedInAnalytics> = {
            profileViews: {
              total: 0, // Not available in basic API
              change: 0,
              period: '7d'
            },
            searchAppearances: {
              total: 0, // Not available in basic API
              change: 0,
              period: '7d'
            },
            postViews: {
              total: response.data.elements?.length || 0,
              change: 0,
              period: '7d'
            },
            connectionGrowth: {
              total: 0, // Would need historical data
              change: 0,
              period: '7d'
            }
          };

          return {
            success: true,
            data: analytics
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch profile analytics');
        }
      }
    );
  }

  /**
   * Create a post on LinkedIn
   */
  async createPost(
    accessToken: string,
    userId: string,
    postData: {
      text: string;
      visibility: 'PUBLIC' | 'CONNECTIONS';
      media?: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; title?: string; description?: string; }>;
    }
  ): Promise<LinkedInAPIResponse<LinkedInPost>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/shares',
      async () => {
        try {
          const shareData = {
            author: `urn:li:person:${userId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                  text: postData.text
                },
                shareMediaCategory: postData.media?.length ? 'IMAGE' : 'NONE',
                media: postData.media?.map(m => ({
                  status: 'READY',
                  description: {
                    text: m.description || ''
                  },
                  media: m.url,
                  title: {
                    text: m.title || ''
                  }
                }))
              }
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': postData.visibility
            }
          };

          const response: AxiosResponse = await this.axiosInstance.post(
            '/v2/ugcPosts',
            shareData,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/shares' }
            } as any
          );

          const post: LinkedInPost = {
            id: response.data.id,
            authorId: userId,
            text: postData.text,
            publishedAt: new Date(),
            visibility: postData.visibility,
            engagement: {
              likes: 0,
              comments: 0,
              shares: 0,
              views: 0
            },
            content: {
              media: postData.media
            }
          };

          return {
            success: true,
            data: post
          };
        } catch (error) {
          return this.handleError(error, 'Failed to create LinkedIn post');
        }
      }
    );
  }

  /**
   * Send connection request
   */
  async sendConnectionRequest(
    accessToken: string,
    userId: string,
    targetUserId: string,
    message?: string
  ): Promise<LinkedInAPIResponse<void>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/invitations',
      async () => {
        try {
          const invitationData = {
            invitee: {
              'com.linkedin.voyager.growth.invitation.InviteeProfile': {
                profileId: targetUserId
              }
            },
            message: message || 'I would like to connect with you on LinkedIn.'
          };

          await this.axiosInstance.post(
            '/v2/invitations',
            invitationData,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/invitations' }
            } as any
          );

          return { success: true };
        } catch (error) {
          return this.handleError(error, 'Failed to send connection request');
        }
      }
    );
  }

  /**
   * Get comprehensive profile data
   */
  async getComprehensiveProfile(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInProfile>> {
    try {
      const [profile, education, skills] = await Promise.all([
        this.getProfile(accessToken, userId),
        this.getEducation(accessToken, userId),
        this.getSkills(accessToken, userId)
      ]);

      if (!profile.success) {
        return profile;
      }

      const comprehensiveProfile: LinkedInProfile = {
        ...profile.data!,
        educations: education.success ? education.data : [],
        skills: skills.success ? skills.data : []
      };

      return {
        success: true,
        data: comprehensiveProfile
      };
    } catch (error) {
      return this.handleError(error, 'Failed to fetch comprehensive profile');
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string, userId: string): Promise<boolean> {
    try {
      const response = await this.getProfile(accessToken, userId);
      return response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get rate limit status for user
   */
  async getRateLimitStatus(userId: string): Promise<any> {
    return this.rateLimitService.getUsageStatistics(userId);
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: any, defaultMessage: string): LinkedInAPIResponse<any> {
    if (error instanceof LinkedInAPIError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.response
        }
      };
    }

    if (error.response) {
      // LinkedIn API error
      const status = error.response.status;
      const data = error.response.data;

      let message = defaultMessage;
      let code = 'LINKEDIN_API_ERROR';

      switch (status) {
        case 400:
          message = 'Bad request - invalid parameters';
          code = 'BAD_REQUEST';
          break;
        case 401:
          message = 'Unauthorized - invalid or expired access token';
          code = 'UNAUTHORIZED';
          break;
        case 403:
          message = 'Forbidden - insufficient permissions';
          code = 'FORBIDDEN';
          break;
        case 404:
          message = 'Resource not found';
          code = 'NOT_FOUND';
          break;
        case 429:
          message = 'Rate limit exceeded';
          code = 'RATE_LIMITED';
          break;
        case 500:
          message = 'LinkedIn server error';
          code = 'SERVER_ERROR';
          break;
        default:
          message = data?.message || defaultMessage;
      }

      return {
        success: false,
        error: {
          message,
          code,
          details: data
        }
      };
    }

    // Network or other error
    return {
      success: false,
      error: {
        message: error.message || defaultMessage,
        code: 'NETWORK_ERROR',
        details: error
      }
    };
  }

  /**
   * Close service and cleanup resources
   */
  async disconnect(): Promise<void> {
    await this.rateLimitService.disconnect();
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    rateLimiting: any;
  }> {
    const rateLimitHealth = await this.rateLimitService.getHealthStatus();
    
    return {
      status: rateLimitHealth.status,
      rateLimiting: rateLimitHealth
    };
  }
}