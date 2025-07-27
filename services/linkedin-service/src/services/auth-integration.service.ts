import axios from 'axios';
import { LinkedInTokens, LinkedInProfile } from '../types/linkedin';
import { LinkedInTokenEncryption } from './oauth.service';

/**
 * Integration service for connecting LinkedIn service with main auth service
 * Handles unified token management and user account synchronization
 */
export class LinkedInAuthIntegrationService {
  private tokenEncryption: LinkedInTokenEncryption;
  private authServiceUrl: string;
  private authServiceApiKey: string;

  constructor() {
    this.tokenEncryption = new LinkedInTokenEncryption();
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    this.authServiceApiKey = process.env.AUTH_SERVICE_API_KEY || '';
    
    if (!this.authServiceApiKey) {
      throw new Error('AUTH_SERVICE_API_KEY is required for service integration');
    }
  }

  /**
   * Store LinkedIn tokens securely in the main auth service
   */
  async storeLinkedInTokens(
    userId: string, 
    tokens: LinkedInTokens, 
    profile: LinkedInProfile
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Encrypt tokens before storage
      const encryptedTokens = this.tokenEncryption.encryptTokens(tokens);
      
      // Call auth service to store LinkedIn connection
      const response = await axios.post(
        `${this.authServiceUrl}/internal/linkedin/connect`,
        {
          userId,
          encryptedTokens,
          linkedinId: profile.id,
          profileData: {
            firstName: this.extractLocalizedName(profile.firstName),
            lastName: this.extractLocalizedName(profile.lastName),
            email: profile.emailAddress,
            headline: profile.headline,
            profileUrl: profile.publicProfileUrl,
            profilePicture: this.extractProfilePicture(profile.profilePicture)
          },
          connectedAt: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'Content-Type': 'application/json',
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Auth service responded with status ${response.status}` 
        };
      }
      
    } catch (error: any) {
      console.error('Failed to store LinkedIn tokens:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  /**
   * Retrieve and decrypt LinkedIn tokens for a user
   */
  async getLinkedInTokens(userId: string): Promise<{
    success: boolean;
    tokens?: LinkedInTokens;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.authServiceUrl}/internal/linkedin/tokens/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 10000
        }
      );

      if (response.status === 200 && response.data.encryptedTokens) {
        // Decrypt tokens
        const tokens = this.tokenEncryption.decryptTokens(response.data.encryptedTokens);
        
        // Check if tokens are expired
        if (this.tokenEncryption.areTokensExpired(response.data.encryptedTokens)) {
          return {
            success: false,
            error: 'LinkedIn tokens have expired'
          };
        }
        
        return {
          success: true,
          tokens
        };
      } else {
        return {
          success: false,
          error: 'No LinkedIn tokens found for user'
        };
      }
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'User has no LinkedIn connection'
        };
      }
      
      console.error('Failed to retrieve LinkedIn tokens:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Update LinkedIn connection status in auth service
   */
  async updateConnectionStatus(
    userId: string, 
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR',
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.patch(
        `${this.authServiceUrl}/internal/linkedin/status/${userId}`,
        {
          status,
          reason,
          updatedAt: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'Content-Type': 'application/json',
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 10000
        }
      );

      return { success: response.status === 200 };
      
    } catch (error: any) {
      console.error('Failed to update LinkedIn connection status:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Disconnect LinkedIn account from auth service
   */
  async disconnectLinkedInAccount(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await axios.delete(
        `${this.authServiceUrl}/internal/linkedin/disconnect/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 10000
        }
      );

      return { success: response.status === 200 };
      
    } catch (error: any) {
      console.error('Failed to disconnect LinkedIn account:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Refresh LinkedIn tokens and update in auth service
   */
  async refreshLinkedInTokens(
    userId: string, 
    refreshToken: string
  ): Promise<{
    success: boolean;
    tokens?: LinkedInTokens;
    error?: string;
  }> {
    try {
      // This would typically call your LinkedIn OAuth service
      // For now, returning a placeholder implementation
      
      const response = await axios.post(
        `${this.authServiceUrl}/internal/linkedin/refresh/${userId}`,
        {
          refreshToken,
          requestedAt: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'Content-Type': 'application/json',
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 15000
        }
      );

      if (response.status === 200 && response.data.tokens) {
        return {
          success: true,
          tokens: response.data.tokens
        };
      } else {
        return {
          success: false,
          error: 'Failed to refresh LinkedIn tokens'
        };
      }
      
    } catch (error: any) {
      console.error('Failed to refresh LinkedIn tokens:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Sync user profile data between LinkedIn and auth service
   */
  async syncProfileData(
    userId: string, 
    linkedinProfile: LinkedInProfile
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.post(
        `${this.authServiceUrl}/internal/linkedin/sync-profile/${userId}`,
        {
          profileData: {
            linkedinId: linkedinProfile.id,
            firstName: this.extractLocalizedName(linkedinProfile.firstName),
            lastName: this.extractLocalizedName(linkedinProfile.lastName),
            email: linkedinProfile.emailAddress,
            headline: linkedinProfile.headline,
            summary: linkedinProfile.summary,
            industry: linkedinProfile.industry,
            location: linkedinProfile.location,
            profileUrl: linkedinProfile.publicProfileUrl,
            profilePicture: this.extractProfilePicture(linkedinProfile.profilePicture),
            positions: linkedinProfile.positions,
            educations: linkedinProfile.educations,
            skills: linkedinProfile.skills
          },
          syncedAt: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'Content-Type': 'application/json',
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 10000
        }
      );

      return { success: response.status === 200 };
      
    } catch (error: any) {
      console.error('Failed to sync LinkedIn profile data:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get user's LinkedIn connection status from auth service
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR';
    linkedinId?: string;
    connectedAt?: string;
    lastSyncAt?: string;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.authServiceUrl}/internal/linkedin/status/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        return {
          connected: true,
          ...response.data
        };
      } else {
        return {
          connected: false,
          error: 'Failed to get connection status'
        };
      }
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          connected: false
        };
      }
      
      console.error('Failed to get LinkedIn connection status:', error);
      return {
        connected: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Validate auth service connection
   */
  async validateAuthServiceConnection(): Promise<{
    connected: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.authServiceUrl}/internal/health`,
        {
          headers: {
            'Authorization': `Bearer ${this.authServiceApiKey}`,
            'X-Service-Name': 'linkedin-service'
          },
          timeout: 5000
        }
      );

      return {
        connected: response.status === 200,
        version: response.data?.version
      };
      
    } catch (error: any) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  private extractLocalizedName(name: any): string {
    if (!name || !name.localized) return '';
    
    const locale = name.preferredLocale ? 
      `${name.preferredLocale.language}_${name.preferredLocale.country}` : 
      'en_US';
    
    return name.localized[locale] || Object.values(name.localized)[0] || '';
  }

  private extractProfilePicture(profilePicture: any): string | undefined {
    if (!profilePicture || !profilePicture['displayImage~']) return undefined;
    
    const elements = profilePicture['displayImage~'].elements;
    if (!elements || elements.length === 0) return undefined;
    
    // Get the largest image
    const largestImage = elements.reduce((prev: any, current: any) => {
      const prevSize = prev.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize || 0;
      const currentSize = current.data?.['com.linkedin.digitalmedia.mediaartifact.StillImage']?.displaySize || 0;
      return currentSize > prevSize ? current : prev;
    });
    
    return largestImage.identifiers?.[0]?.identifier;
  }
}