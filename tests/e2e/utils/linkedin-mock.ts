import { Page } from '@playwright/test';
import { TestDataManager } from './TestDataManager';
import linkedinProfiles from '../fixtures/linkedin-profiles.json';
import automationTemplates from '../fixtures/automation-templates.json';

/**
 * LinkedIn API Mock Service
 * Provides comprehensive mocking for LinkedIn OAuth and API endpoints
 * Ensures compliance testing and rate limiting validation
 */
export class LinkedInMockService {
  private page: Page;
  private testDataManager: TestDataManager;
  private mockResponses: Map<string, any> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private lastRequestTime: Map<string, number> = new Map();

  constructor(page: Page, testDataManager: TestDataManager) {
    this.page = page;
    this.testDataManager = testDataManager;
    this.initializeMockResponses();
  }

  /**
   * Initialize all LinkedIn API mock responses
   */
  private initializeMockResponses(): void {
    // OAuth endpoints
    this.mockResponses.set('oauth/authorize', this.getMockOAuthAuthorize());
    this.mockResponses.set('oauth/accessToken', this.getMockAccessToken());
    this.mockResponses.set('oauth/refresh', this.getMockTokenRefresh());

    // Profile endpoints
    this.mockResponses.set('people/~', linkedinProfiles.completeProfile);
    this.mockResponses.set('people/~:(id,first-name,last-name)', this.getMockBasicProfile());
    this.mockResponses.set('people/~:(id,first-name,last-name,headline,summary)', this.getMockDetailedProfile());

    // Connection endpoints
    this.mockResponses.set('people-search', this.getMockPeopleSearch());
    this.mockResponses.set('people/*/network', this.getMockNetworkInfo());
    this.mockResponses.set('invitations', this.getMockInvitations());

    // Content endpoints
    this.mockResponses.set('shares', this.getMockShares());
    this.mockResponses.set('posts', this.getMockPosts());
    this.mockResponses.set('socialActions', this.getMockSocialActions());

    // Analytics endpoints
    this.mockResponses.set('analytics/shares', this.getMockShareAnalytics());
    this.mockResponses.set('analytics/followers', this.getMockFollowerAnalytics());
  }

  /**
   * Setup comprehensive LinkedIn API mocks
   */
  async setupMocks(): Promise<void> {
    await this.setupOAuthMocks();
    await this.setupProfileMocks();
    await this.setupConnectionMocks();
    await this.setupContentMocks();
    await this.setupAnalyticsMocks();
    await this.setupComplianceMocks();
  }

  /**
   * Setup OAuth flow mocks
   */
  private async setupOAuthMocks(): Promise<void> {
    // LinkedIn OAuth authorization page
    await this.page.route('https://www.linkedin.com/oauth/v2/authorization**', async (route) => {
      const url = new URL(route.request().url());
      const clientId = url.searchParams.get('client_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = url.searchParams.get('state');

      // Simulate OAuth authorization page
      const authPage = `
        <!DOCTYPE html>
        <html>
        <head><title>LinkedIn OAuth - Test Mode</title></head>
        <body>
          <h1>LinkedIn Authorization (Test Mode)</h1>
          <p>App is requesting access to your LinkedIn profile</p>
          <button id="authorize" onclick="authorize()">Authorize</button>
          <button id="deny" onclick="deny()">Deny</button>
          <script>
            function authorize() {
              const code = 'mock_auth_code_' + Math.random().toString(36).substring(7);
              window.location.href = '${redirectUri}?code=' + code + '&state=${state}';
            }
            function deny() {
              window.location.href = '${redirectUri}?error=access_denied&state=${state}';
            }
          </script>
        </body>
        </html>
      `;

      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: authPage,
      });
    });

    // LinkedIn token exchange
    await this.page.route('https://www.linkedin.com/oauth/v2/accessToken', async (route) => {
      const requestBody = await route.request().postData();
      const params = new URLSearchParams(requestBody || '');
      const grantType = params.get('grant_type');
      const code = params.get('code');

      if (grantType === 'authorization_code' && code?.startsWith('mock_auth_code_')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock_access_token_' + Date.now(),
            expires_in: 5184000,
            scope: 'r_liteprofile r_emailaddress w_member_social',
            token_type: 'Bearer',
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          }),
        });
      }
    });
  }

  /**
   * Setup profile API mocks
   */
  private async setupProfileMocks(): Promise<void> {
    // Basic profile info
    await this.page.route('https://api.linkedin.com/v2/people/~**', async (route) => {
      await this.handleRateLimit(route, 'profile');
      
      const url = new URL(route.request().url());
      const projection = url.searchParams.get('projection') || url.pathname.split(':')[1];
      
      let response;
      if (projection?.includes('headline,summary,positions')) {
        response = linkedinProfiles.completeProfile;
      } else if (projection?.includes('headline')) {
        response = this.getMockDetailedProfile();
      } else {
        response = this.getMockBasicProfile();
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Profile picture upload
    await this.page.route('https://api.linkedin.com/v2/assets**', async (route) => {
      await this.handleRateLimit(route, 'upload');

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          value: {
            asset: 'urn:li:digitalmediaAsset:mock-uploaded-image-' + Date.now(),
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://mock-upload-url.com/upload',
                headers: {}
              }
            }
          }
        }),
      });
    });
  }

  /**
   * Setup connection and networking mocks
   */
  private async setupConnectionMocks(): Promise<void> {
    // People search
    await this.page.route('https://api.linkedin.com/v2/people-search**', async (route) => {
      await this.handleRateLimit(route, 'search');

      const searchResults = this.getMockPeopleSearch();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResults),
      });
    });

    // Send connection invitation
    await this.page.route('https://api.linkedin.com/v2/invitations', async (route) => {
      if (route.request().method() === 'POST') {
        await this.handleRateLimit(route, 'connection');
        
        const body = JSON.parse(await route.request().postData() || '{}');
        
        // Simulate LinkedIn's compliance checking
        if (this.isConnectionRequestCompliant(body)) {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'mock_invitation_' + Date.now(),
              createdAt: new Date().toISOString(),
              state: 'PENDING'
            }),
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'RATE_LIMIT_EXCEEDED',
              message: 'You have exceeded the daily limit for connection requests'
            }),
          });
        }
      }
    });

    // Get connections
    await this.page.route('https://api.linkedin.com/v2/connections**', async (route) => {
      await this.handleRateLimit(route, 'connections');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          elements: [
            {
              to: 'urn:li:person:mock-connection-1',
              createdAt: '2024-01-01T12:00:00.000Z'
            },
            {
              to: 'urn:li:person:mock-connection-2',
              createdAt: '2024-01-02T12:00:00.000Z'
            }
          ],
          paging: {
            count: 10,
            start: 0,
            total: 250
          }
        }),
      });
    });
  }

  /**
   * Setup content and social action mocks
   */
  private async setupContentMocks(): Promise<void> {
    // Create post/share
    await this.page.route('https://api.linkedin.com/v2/ugcPosts', async (route) => {
      if (route.request().method() === 'POST') {
        await this.handleRateLimit(route, 'content');

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'urn:li:ugcPost:mock-post-' + Date.now(),
            createdAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString()
          }),
        });
      }
    });

    // Social actions (likes, comments)
    await this.page.route('https://api.linkedin.com/v2/socialActions/*/likes', async (route) => {
      if (route.request().method() === 'POST') {
        await this.handleRateLimit(route, 'like');

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            created: new Date().toISOString(),
            actor: 'urn:li:person:mock-user'
          }),
        });
      }
    });

    await this.page.route('https://api.linkedin.com/v2/socialActions/*/comments', async (route) => {
      if (route.request().method() === 'POST') {
        await this.handleRateLimit(route, 'comment');

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'urn:li:comment:mock-comment-' + Date.now(),
            created: new Date().toISOString(),
            actor: 'urn:li:person:mock-user'
          }),
        });
      }
    });
  }

  /**
   * Setup analytics mocks
   */
  private async setupAnalyticsMocks(): Promise<void> {
    await this.page.route('https://api.linkedin.com/v2/organizationalEntityShareStatistics**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          elements: [
            {
              totalShareStatistics: {
                shareCount: 150,
                likeCount: 1250,
                commentCount: 89,
                clickCount: 456,
                impressionCount: 8900
              },
              organizationalEntity: 'urn:li:organization:mock-company'
            }
          ]
        }),
      });
    });

    await this.page.route('https://api.linkedin.com/v2/networkSizes/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          firstDegreeSize: 850,
          secondDegreeSize: 12400
        }),
      });
    });
  }

  /**
   * Setup compliance and rate limiting mocks
   */
  private async setupComplianceMocks(): Promise<void> {
    // Mock rate limit headers on all LinkedIn API calls
    await this.page.route('https://api.linkedin.com/**', async (route, request) => {
      const response = await route.fetch();
      const body = await response.text();
      
      // Add rate limit headers
      const headers = {
        ...response.headers(),
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '95',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
        'X-LinkedIn-Request-Id': 'mock-request-' + Date.now()
      };

      await route.fulfill({
        status: response.status(),
        headers,
        body,
      });
    });
  }

  /**
   * Handle rate limiting simulation
   */
  private async handleRateLimit(route: any, actionType: string): Promise<void> {
    const key = actionType;
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(key) || 0;
    const timeDiff = now - lastRequest;
    
    // Simulate LinkedIn's rate limiting
    const minDelay = this.getMinDelayForAction(actionType);
    if (timeDiff < minDelay) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for ${actionType}. Please wait ${minDelay - timeDiff}ms`,
          retryAfter: Math.ceil((minDelay - timeDiff) / 1000)
        }),
      });
      return;
    }

    // Update request tracking
    const count = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, count + 1);
    this.lastRequestTime.set(key, now);

    // Check daily limits
    const dailyLimit = this.getDailyLimitForAction(actionType);
    if (count >= dailyLimit) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'DAILY_LIMIT_EXCEEDED',
          message: `Daily limit of ${dailyLimit} exceeded for ${actionType}`,
          retryAfter: 86400 // 24 hours
        }),
      });
      return;
    }
  }

  /**
   * Check if connection request is compliant
   */
  private isConnectionRequestCompliant(requestBody: any): boolean {
    // Check for personalization
    if (!requestBody.message || requestBody.message.length < 10) {
      return false;
    }

    // Check for spam indicators
    const spamKeywords = ['please connect', 'expand my network', 'mutual benefit'];
    const message = requestBody.message.toLowerCase();
    
    return !spamKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Get minimum delay for action type
   */
  private getMinDelayForAction(actionType: string): number {
    const delays = {
      connection: 45000, // 45 seconds
      like: 30000,       // 30 seconds
      comment: 60000,    // 60 seconds
      profile: 5000,     // 5 seconds
      search: 10000,     // 10 seconds
      content: 120000,   // 2 minutes
      upload: 30000      // 30 seconds
    };
    
    return delays[actionType as keyof typeof delays] || 5000;
  }

  /**
   * Get daily limit for action type
   */
  private getDailyLimitForAction(actionType: string): number {
    const limits = {
      connection: 15,    // InErgize limit (15% of LinkedIn's 100)
      like: 30,          // InErgize limit (15% of LinkedIn's 200)
      comment: 8,        // InErgize limit (16% of LinkedIn's 50)
      profile: 25,       // InErgize limit (17% of LinkedIn's 150)
      search: 100,       // Standard search limit
      content: 20,       // Content creation limit
      upload: 50         // File upload limit
    };
    
    return limits[actionType as keyof typeof limits] || 100;
  }

  /**
   * Generate mock responses
   */
  private getMockOAuthAuthorize() {
    return {
      authorization_url: 'https://www.linkedin.com/oauth/v2/authorization',
      state: 'mock_state_' + Math.random().toString(36).substring(7)
    };
  }

  private getMockAccessToken() {
    return {
      access_token: 'mock_access_token_' + Date.now(),
      expires_in: 5184000,
      scope: 'r_liteprofile r_emailaddress w_member_social',
      token_type: 'Bearer'
    };
  }

  private getMockTokenRefresh() {
    return {
      access_token: 'mock_refreshed_token_' + Date.now(),
      expires_in: 5184000,
      token_type: 'Bearer'
    };
  }

  private getMockBasicProfile() {
    return {
      id: 'mock_profile_' + Date.now(),
      firstName: {
        localized: { en_US: 'Test' },
        preferredLocale: { country: 'US', language: 'en' }
      },
      lastName: {
        localized: { en_US: 'User' },
        preferredLocale: { country: 'US', language: 'en' }
      }
    };
  }

  private getMockDetailedProfile() {
    return {
      ...this.getMockBasicProfile(),
      headline: 'Software Engineer at Tech Company',
      summary: 'Passionate about building great software and solving complex problems.'
    };
  }

  private getMockPeopleSearch() {
    return {
      elements: [
        {
          id: 'search_result_1',
          firstName: { localized: { en_US: 'John' } },
          lastName: { localized: { en_US: 'Smith' } },
          headline: 'Senior Developer at Tech Corp',
          industry: 'Computer Software'
        },
        {
          id: 'search_result_2',
          firstName: { localized: { en_US: 'Jane' } },
          lastName: { localized: { en_US: 'Doe' } },
          headline: 'Marketing Manager at Growth Co',
          industry: 'Marketing and Advertising'
        }
      ],
      paging: {
        count: 10,
        start: 0,
        total: 150
      }
    };
  }

  private getMockNetworkInfo() {
    return {
      firstDegreeSize: 850,
      secondDegreeSize: 12400
    };
  }

  private getMockInvitations() {
    return {
      elements: [
        {
          id: 'invitation_1',
          createdAt: '2024-01-15T10:00:00.000Z',
          state: 'PENDING',
          invitee: 'urn:li:person:invited_person_1'
        }
      ]
    };
  }

  private getMockShares() {
    return {
      id: 'urn:li:share:mock_share_' + Date.now(),
      createdAt: new Date().toISOString(),
      text: {
        text: 'This is a test share from E2E testing'
      }
    };
  }

  private getMockPosts() {
    return {
      id: 'urn:li:ugcPost:mock_post_' + Date.now(),
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    };
  }

  private getMockSocialActions() {
    return {
      created: new Date().toISOString(),
      actor: 'urn:li:person:mock_user'
    };
  }

  private getMockShareAnalytics() {
    return {
      elements: [
        {
          totalShareStatistics: {
            shareCount: 25,
            likeCount: 150,
            commentCount: 12,
            clickCount: 45,
            impressionCount: 890
          }
        }
      ]
    };
  }

  private getMockFollowerAnalytics() {
    return {
      elements: [
        {
          followerGains: {
            organicFollowerGain: 15,
            paidFollowerGain: 5
          },
          followerCountsByAssociationType: [
            {
              associationType: 'ORGANIC',
              followerCounts: {
                totalFollowerCount: 1250
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Reset request counters (useful for daily limit testing)
   */
  resetCounters(): void {
    this.requestCounts.clear();
    this.lastRequestTime.clear();
  }

  /**
   * Get current request count for action type
   */
  getRequestCount(actionType: string): number {
    return this.requestCounts.get(actionType) || 0;
  }

  /**
   * Cleanup mocks
   */
  async cleanup(): Promise<void> {
    await this.page.unrouteAll();
    this.resetCounters();
  }
}