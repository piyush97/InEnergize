// LinkedIn OAuth Service for secure authentication flow

import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { URLSearchParams } from 'url';
import {
  LinkedInOAuthConfig,
  LinkedInTokens,
  LinkedInAPIResponse,
  LinkedInAPIError
} from '../types/linkedin';

export class LinkedInOAuthService {
  private config: LinkedInOAuthConfig;
  private stateStore: Map<string, { userId: string; createdAt: Date }>;

  constructor() {
    this.config = {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/auth/linkedin/callback',
      scope: [
        'r_liteprofile',
        'r_emailaddress',
        'r_basicprofile',
        'rw_company_admin',
        'w_member_social'
      ]
    };

    this.stateStore = new Map();
    
    // Clean up expired states every hour
    setInterval(() => this.cleanupExpiredStates(), 60 * 60 * 1000);

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('LinkedIn OAuth configuration is incomplete');
    }
  }

  /**
   * Generate authorization URL for LinkedIn OAuth flow
   */
  generateAuthUrl(userId: string): string {
    const state = this.generateState();
    
    // Store state with user ID for validation
    this.stateStore.set(state, {
      userId,
      createdAt: new Date()
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: this.config.scope.join(' ')
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<LinkedInAPIResponse<{ tokens: LinkedInTokens; userId: string }>> {
    try {
      // Validate state parameter
      const stateData = this.stateStore.get(state);
      if (!stateData) {
        throw new LinkedInAPIError('Invalid or expired state parameter', 'INVALID_STATE');
      }

      // Remove used state
      this.stateStore.delete(state);

      // Exchange code for tokens
      const tokenResponse = await this.requestAccessToken(code);
      
      return {
        success: true,
        data: {
          tokens: tokenResponse,
          userId: stateData.userId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Token exchange failed',
          code: error instanceof LinkedInAPIError ? error.code : 'TOKEN_EXCHANGE_ERROR',
          details: error
        }
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<LinkedInAPIResponse<LinkedInTokens>> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      const response: AxiosResponse<any> = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      const tokens: LinkedInTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope || this.config.scope.join(' ')
      };

      return {
        success: true,
        data: tokens
      };
    } catch (error) {
      const axiosError = error as any;
      return {
        success: false,
        error: {
          message: axiosError.response?.data?.error_description || 'Token refresh failed',
          code: axiosError.response?.data?.error || 'REFRESH_TOKEN_ERROR',
          details: axiosError.response?.data
        }
      };
    }
  }

  /**
   * Validate access token by making a test API call
   */
  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(
        'https://api.linkedin.com/v2/me',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke access token
   */
  async revokeAccessToken(accessToken: string): Promise<LinkedInAPIResponse<void>> {
    try {
      const params = new URLSearchParams({
        token: accessToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      await axios.post(
        'https://www.linkedin.com/oauth/v2/revoke',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      return { success: true };
    } catch (error) {
      const axiosError = error as any;
      return {
        success: false,
        error: {
          message: axiosError.response?.data?.error_description || 'Token revocation failed',
          code: axiosError.response?.data?.error || 'REVOKE_TOKEN_ERROR',
          details: axiosError.response?.data
        }
      };
    }
  }

  /**
   * Generate secure random state parameter
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Request access token from LinkedIn
   */
  private async requestAccessToken(code: string): Promise<LinkedInTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const response: AxiosResponse<any> = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    if (!response.data.access_token) {
      throw new LinkedInAPIError(
        'No access token received',
        'INVALID_TOKEN_RESPONSE',
        response.status,
        response.data
      );
    }

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type || 'Bearer',
      scope: response.data.scope || this.config.scope.join(' ')
    };
  }

  /**
   * Clean up expired state parameters
   */
  private cleanupExpiredStates(): void {
    const now = new Date();
    const expiredStates: string[] = [];

    for (const [state, data] of this.stateStore.entries()) {
      // States expire after 10 minutes
      if (now.getTime() - data.createdAt.getTime() > 10 * 60 * 1000) {
        expiredStates.push(state);
      }
    }

    expiredStates.forEach(state => this.stateStore.delete(state));
  }

  /**
   * Get current OAuth configuration (without secrets)
   */
  getPublicConfig() {
    return {
      clientId: this.config.clientId,
      redirectUri: this.config.redirectUri,
      scope: this.config.scope
    };
  }

  /**
   * Update OAuth configuration
   */
  updateConfig(newConfig: Partial<LinkedInOAuthConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if OAuth is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.redirectUri);
  }

  /**
   * Get pending states count (for monitoring)
   */
  getPendingStatesCount(): number {
    return this.stateStore.size;
  }

  /**
   * Clear all pending states (for testing/cleanup)
   */
  clearPendingStates(): void {
    this.stateStore.clear();
  }
}