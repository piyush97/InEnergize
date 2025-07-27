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
  LinkedInEducation,
  LinkedInSkill,
  RateLimitInfo
} from '../types/linkedin';
import { LinkedInRateLimitService } from './rateLimit.service';

export class LinkedInAPIService {
  private axiosInstance: AxiosInstance;
  private rateLimitService: LinkedInRateLimitService;
  private baseURL = 'https://api.linkedin.com';

  constructor(rateLimitService?: LinkedInRateLimitService) {
    this.rateLimitService = rateLimitService || new LinkedInRateLimitService();
    
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
          // Use proper LinkedIn API v2 endpoint with required fields
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/me?projection=(id,firstName,lastName,headline,summary,profilePicture(displayImage~:playableStreams),industryName,locationName,publicProfileUrl,vanityName)',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/me' }
            } as any
          );

          // Get additional profile data
          const [emailResponse, positionsResponse] = await Promise.all([
            this.getEmailAddress(accessToken, userId),
            this.getPositions(accessToken, userId)
          ]);

          // Parse profile picture properly
          const profilePicture = this.parseProfilePicture(response.data.profilePicture);

          const profile: LinkedInProfile = {
            id: response.data.id,
            firstName: response.data.firstName || {
              localized: { en_US: '' },
              preferredLocale: { country: 'US', language: 'en' }
            },
            lastName: response.data.lastName || {
              localized: { en_US: '' },
              preferredLocale: { country: 'US', language: 'en' }
            },
            headline: response.data.headline?.localized?.en_US || response.data.headline || '',
            summary: response.data.summary?.localized?.en_US || response.data.summary || '',
            industry: response.data.industryName || '',
            location: response.data.locationName ? {
              country: response.data.locationName,
              postalCode: ''
            } : undefined,
            publicProfileUrl: response.data.publicProfileUrl || '',
            vanityName: response.data.vanityName || '',
            profilePicture: profilePicture,
            emailAddress: emailResponse.success ? emailResponse.data : '',
            positions: positionsResponse.success ? positionsResponse.data : []
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
   * Parse LinkedIn profile picture from API response
   */
  private parseProfilePicture(profilePictureData: any): any {
    if (!profilePictureData?.['displayImage~']?.elements) {
      return undefined;
    }

    return {
      displayImage: profilePictureData.displayImage,
      'displayImage~': profilePictureData['displayImage~']
    };
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
          // Use proper LinkedIn API v2 endpoint for positions
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/positions?q=members&projection=(elements*(*,company~(name,id,industry,size)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/positions' }
            } as any
          );

          const positions = response.data.elements?.map((pos: any) => ({
            id: pos.id,
            title: pos.title || '',
            company: {
              name: pos['company~']?.name || pos.companyName || '',
              id: pos.company || '',
              industry: pos['company~']?.industry || '',
              size: pos['company~']?.size || ''
            },
            location: pos.location?.preferredLocale?.country || pos.location || '',
            description: pos.description || '',
            startDate: this.parseLinkedInDate(pos.startDate),
            endDate: this.parseLinkedInDate(pos.endDate),
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
   * Parse LinkedIn date format
   */
  private parseLinkedInDate(dateObj: any): string {
    if (!dateObj) return '';
    const { year, month, day } = dateObj;
    if (year) {
      return `${year}${month ? `-${month.toString().padStart(2, '0')}` : ''}${day ? `-${day.toString().padStart(2, '0')}` : ''}`;
    }
    return '';
  }

  /**
   * Get user's education information
   */
  async getEducation(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInEducation[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/educations',
      async () => {
        try {
          // Use proper LinkedIn API v2 endpoint for education
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/educations?q=members&projection=(elements*(*,school~(name,schoolName),fieldOfStudy,degree,startDate,endDate,grade,activities,notes))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/educations' }
            } as any
          );

          const educations = response.data.elements?.map((edu: any) => ({
            id: edu.id,
            schoolName: edu['school~']?.name || edu.schoolName || '',
            fieldOfStudy: edu.fieldOfStudy || '',
            degree: edu.degree || '',
            startDate: this.parseLinkedInDate(edu.startDate),
            endDate: this.parseLinkedInDate(edu.endDate),
            grade: edu.grade || '',
            activities: edu.activities || '',
            description: edu.notes || ''
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
  async getSkills(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInSkill[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/skills',
      async () => {
        try {
          // Use proper LinkedIn API v2 endpoint for skills
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/skills?q=members&projection=(elements*(*,skill~(name)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/skills' }
            } as any
          );

          const skills = response.data.elements?.map((skill: any) => ({
            id: skill.id,
            name: skill['skill~']?.name || skill.name || '',
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
   * Get user's certifications
   */
  async getCertifications(accessToken: string, userId: string): Promise<LinkedInAPIResponse<any[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/certifications',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/certifications?q=members&projection=(elements*(*,authority~(name)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/certifications' }
            } as any
          );

          const certifications = response.data.elements?.map((cert: any) => ({
            id: cert.id,
            name: cert.name,
            authority: cert['authority~']?.name || cert.authority || '',
            url: cert.url,
            licenseNumber: cert.licenseNumber,
            startDate: cert.startDate,
            endDate: cert.endDate
          })) || [];

          return {
            success: true,
            data: certifications
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch certifications');
        }
      }
    );
  }

  /**
   * Get user's languages
   */
  async getLanguages(accessToken: string, userId: string): Promise<LinkedInAPIResponse<any[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/languages',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/languages?q=members&projection=(elements*(name,proficiency))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/languages' }
            } as any
          );

          const languages = response.data.elements?.map((lang: any) => ({
            id: lang.id,
            name: lang.name,
            proficiency: lang.proficiency || 'PROFESSIONAL_WORKING'
          })) || [];

          return {
            success: true,
            data: languages
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch languages');
        }
      }
    );
  }

  /**
   * Get user's projects
   */
  async getProjects(accessToken: string, userId: string): Promise<LinkedInAPIResponse<any[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/projects',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/projects?q=members&projection=(elements*(*,members*(name)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/projects' }
            } as any
          );

          const projects = response.data.elements?.map((project: any) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            url: project.url,
            startDate: project.startDate,
            endDate: project.endDate,
            members: project.members?.map((member: any) => ({
              name: member.name,
              profileUrl: member.profileUrl
            })) || []
          })) || [];

          return {
            success: true,
            data: projects
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch projects');
        }
      }
    );
  }

  /**
   * Get user's volunteer experience
   */
  async getVolunteerExperience(accessToken: string, userId: string): Promise<LinkedInAPIResponse<any[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/volunteerExperiences',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/volunteerExperiences?q=members&projection=(elements*(*,organization~(name)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/volunteerExperiences' }
            } as any
          );

          const volunteerExperiences = response.data.elements?.map((volunteer: any) => ({
            id: volunteer.id,
            role: volunteer.role,
            organization: {
              name: volunteer['organization~']?.name || volunteer.organization?.name || ''
            },
            cause: volunteer.cause,
            description: volunteer.description,
            startDate: volunteer.startDate,
            endDate: volunteer.endDate
          })) || [];

          return {
            success: true,
            data: volunteerExperiences
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch volunteer experience');
        }
      }
    );
  }

  /**
   * Get user's recommendations
   */
  async getRecommendations(accessToken: string, userId: string): Promise<LinkedInAPIResponse<any[]>> {
    return this.rateLimitService.executeWithRateLimit(
      userId,
      '/v2/recommendations',
      async () => {
        try {
          const response: AxiosResponse = await this.axiosInstance.get(
            '/v2/recommendations?q=members&projection=(elements*(*,recommender*(firstName,lastName,headline),recommendee*(firstName,lastName,headline)))',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              metadata: { userId, endpoint: '/v2/recommendations' }
            } as any
          );

          const recommendations = response.data.elements?.map((rec: any) => ({
            id: rec.id,
            recommendationType: rec.recommendationType || 'RECEIVED',
            recommender: rec.recommender ? {
              firstName: rec.recommender.firstName,
              lastName: rec.recommender.lastName,
              headline: rec.recommender.headline
            } : undefined,
            recommendee: rec.recommendee ? {
              firstName: rec.recommendee.firstName,
              lastName: rec.recommendee.lastName,
              headline: rec.recommendee.headline
            } : undefined,
            text: rec.text || '',
            createdAt: rec.createdAt ? new Date(rec.createdAt) : new Date()
          })) || [];

          return {
            success: true,
            data: recommendations
          };
        } catch (error) {
          return this.handleError(error, 'Failed to fetch recommendations');
        }
      }
    );
  }

  /**
   * Get comprehensive profile data including all available fields
   */
  async getComprehensiveProfile(accessToken: string, userId: string): Promise<LinkedInAPIResponse<LinkedInProfile>> {
    try {
      // Fetch all profile data in parallel
      const [
        profile, 
        education, 
        skills, 
        certifications, 
        languages, 
        projects, 
        volunteerExperience, 
        recommendations,
        connections
      ] = await Promise.all([
        this.getProfile(accessToken, userId),
        this.getEducation(accessToken, userId),
        this.getSkills(accessToken, userId),
        this.getCertifications(accessToken, userId),
        this.getLanguages(accessToken, userId),
        this.getProjects(accessToken, userId),
        this.getVolunteerExperience(accessToken, userId),
        this.getRecommendations(accessToken, userId),
        this.getConnections(accessToken, userId, 0, 10) // Just get count, not all connections
      ]);

      if (!profile.success) {
        return profile;
      }

      const comprehensiveProfile: LinkedInProfile = {
        ...profile.data!,
        educations: education.success ? education.data : [],
        skills: skills.success ? skills.data : [],
        certifications: certifications.success ? certifications.data : [],
        languages: languages.success ? languages.data : [],
        projects: projects.success ? projects.data : [],
        volunteerExperience: volunteerExperience.success ? volunteerExperience.data : [],
        recommendations: recommendations.success ? recommendations.data : [],
        connectionCount: connections.success ? connections.data?.length || 0 : 0
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
      // LinkedIn API error with enhanced error mapping
      const status = error.response.status;
      const data = error.response.data;
      const linkedinErrorCode = data?.error?.code || data?.error || data?.message;

      let message = defaultMessage;
      let code = 'LINKEDIN_API_ERROR';
      let userMessage = 'Unable to complete LinkedIn operation. Please try again.';

      switch (status) {
        case 400:
          message = 'Bad request - invalid parameters';
          code = 'BAD_REQUEST';
          userMessage = 'Invalid request parameters. Please check your data and try again.';
          
          // Handle specific LinkedIn 400 errors
          if (linkedinErrorCode?.includes('INVALID_REQUEST')) {
            userMessage = 'The request format is invalid. Please contact support.';
          } else if (linkedinErrorCode?.includes('MISSING_FIELD')) {
            userMessage = 'Required information is missing. Please complete your profile.';
          }
          break;

        case 401:
          message = 'Unauthorized - invalid or expired access token';
          code = 'UNAUTHORIZED';
          userMessage = 'Your LinkedIn connection has expired. Please reconnect your account.';
          
          if (linkedinErrorCode?.includes('TOKEN_EXPIRED')) {
            userMessage = 'Your LinkedIn access token has expired. Please reconnect your account.';
          } else if (linkedinErrorCode?.includes('INVALID_TOKEN')) {
            userMessage = 'Invalid LinkedIn credentials. Please reconnect your account.';
          }
          break;

        case 403:
          message = 'Forbidden - insufficient permissions';
          code = 'FORBIDDEN';
          userMessage = 'You don\'t have permission to perform this action. Please check your LinkedIn account permissions.';
          
          if (linkedinErrorCode?.includes('INSUFFICIENT_SCOPE')) {
            userMessage = 'Additional LinkedIn permissions are required. Please reconnect with extended permissions.';
          } else if (linkedinErrorCode?.includes('ACCESS_DENIED')) {
            userMessage = 'Access denied. Your LinkedIn account may have restrictions.';
          }
          break;

        case 404:
          message = 'Resource not found';
          code = 'NOT_FOUND';
          userMessage = 'The requested LinkedIn resource was not found.';
          break;

        case 422:
          message = 'Unprocessable entity - validation failed';
          code = 'VALIDATION_ERROR';
          userMessage = 'The data provided doesn\'t meet LinkedIn\'s requirements. Please review and try again.';
          break;

        case 429:
          message = 'Rate limit exceeded';
          code = 'RATE_LIMITED';
          userMessage = 'You\'ve made too many requests. Please wait before trying again.';
          
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            const minutes = Math.ceil(parseInt(retryAfter) / 60);
            userMessage = `Rate limit exceeded. Please wait ${minutes} minute(s) before trying again.`;
          }
          break;

        case 500:
          message = 'LinkedIn server error';
          code = 'SERVER_ERROR';
          userMessage = 'LinkedIn is experiencing technical difficulties. Please try again later.';
          break;

        case 502:
        case 503:
        case 504:
          message = 'LinkedIn service unavailable';
          code = 'SERVICE_UNAVAILABLE';
          userMessage = 'LinkedIn services are temporarily unavailable. Please try again in a few minutes.';
          break;

        default:
          message = data?.message || defaultMessage;
          userMessage = 'An unexpected error occurred. Please try again or contact support.';
      }

      return {
        success: false,
        error: {
          message,
          code,
          userMessage,
          httpStatus: status,
          linkedinError: linkedinErrorCode,
          details: data,
          timestamp: new Date().toISOString()
        }
      };
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: {
          message: 'Unable to connect to LinkedIn',
          code: 'CONNECTION_ERROR',
          userMessage: 'Unable to connect to LinkedIn. Please check your internet connection.',
          details: error,
          timestamp: new Date().toISOString()
        }
      };
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        success: false,
        error: {
          message: 'Request timeout',
          code: 'TIMEOUT_ERROR',
          userMessage: 'The request took too long. Please try again.',
          details: error,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Network or other error
    return {
      success: false,
      error: {
        message: error.message || defaultMessage,
        code: 'NETWORK_ERROR',
        userMessage: 'A network error occurred. Please check your connection and try again.',
        details: error,
        timestamp: new Date().toISOString()
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