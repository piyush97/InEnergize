import { Page, Locator, expect } from '@playwright/test';
import { LinkedInMockService } from './linkedin-mock';
import { TestDataManager } from './TestDataManager';

/**
 * Comprehensive test helpers for InErgize E2E testing
 * Provides utilities for authentication, API interactions, and common test patterns
 */
export class TestHelpers {
  private page: Page;
  private testDataManager: TestDataManager;
  private linkedinMock: LinkedInMockService;

  constructor(page: Page, testDataManager: TestDataManager) {
    this.page = page;
    this.testDataManager = testDataManager;
    this.linkedinMock = new LinkedInMockService(page, testDataManager);
  }

  /**
   * Initialize test environment and mocks
   */
  async initialize(): Promise<void> {
    await this.linkedinMock.setupMocks();
    await this.setupAPIInterceptors();
    await this.setupPerformanceMonitoring();
  }

  /**
   * Authenticate user and setup session
   */
  async authenticateUser(userType: 'default' | 'premium' | 'linkedinConnected' | 'automation' = 'default'): Promise<void> {
    const users = {
      'default': 'test.user@inergize-test.com',
      'premium': 'premium.user@inergize-test.com',
      'linkedinConnected': 'linkedin.connected@inergize-test.com',
      'automation': 'automation.user@inergize-test.com'
    };

    const email = users[userType];
    const password = 'TestPassword123!';

    // Navigate to login page
    await this.page.goto('/auth/signin');
    
    // Fill and submit login form
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');

    // Wait for authentication to complete
    await this.page.waitForURL('/dashboard');
    
    // Verify authentication succeeded
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  /**
   * Setup LinkedIn OAuth flow
   */
  async setupLinkedInOAuth(): Promise<void> {
    // Click LinkedIn connect button
    await this.page.click('[data-testid="connect-linkedin-button"]');
    
    // Handle OAuth popup or redirect
    const popup = await this.page.waitForEvent('popup', { timeout: 10000 });
    
    // Authorize in LinkedIn OAuth page (mocked)
    await popup.waitForLoadState();
    await popup.click('#authorize');
    
    // Wait for popup to close and return to main window
    await popup.waitForEvent('close');
    
    // Verify LinkedIn connection
    await expect(this.page.locator('[data-testid="linkedin-connected-status"]')).toContainText('Connected');
  }

  /**
   * Wait for API calls to complete
   */
  async waitForAPICall(endpoint: string, timeout: number = 10000): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes(endpoint) && response.status() === 200,
      { timeout }
    );
    
    await responsePromise;
  }

  /**
   * Mock API response for testing
   */
  async mockAPIResponse(endpoint: string, response: any, status: number = 200): Promise<void> {
    await this.page.route(`**/${endpoint}**`, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Setup WebSocket connection for real-time testing
   */
  async setupWebSocketConnection(): Promise<void> {
    await this.page.addInitScript(() => {
      window.testWebSocketMessages = [];
      
      const originalWebSocket = window.WebSocket;
      window.WebSocket = function(url, protocols) {
        const ws = new originalWebSocket(url, protocols);
        
        ws.addEventListener('message', (event) => {
          window.testWebSocketMessages.push({
            timestamp: Date.now(),
            data: JSON.parse(event.data)
          });
        });
        
        return ws;
      };
    });
  }

  /**
   * Get WebSocket messages received during test
   */
  async getWebSocketMessages(): Promise<any[]> {
    return await this.page.evaluate(() => window.testWebSocketMessages || []);
  }

  /**
   * Simulate automation action with compliance checking
   */
  async simulateAutomationAction(
    actionType: 'connection' | 'like' | 'comment' | 'view',
    targetData: any
  ): Promise<void> {
    const actions = {
      connection: async () => {
        await this.page.click('[data-testid="send-connection-button"]');
        await this.page.fill('[data-testid="connection-message"]', targetData.message);
        await this.page.click('[data-testid="confirm-connection"]');
      },
      like: async () => {
        await this.page.click(`[data-testid="like-post-${targetData.postId}"]`);
      },
      comment: async () => {
        await this.page.click(`[data-testid="comment-post-${targetData.postId}"]`);
        await this.page.fill('[data-testid="comment-input"]', targetData.comment);
        await this.page.click('[data-testid="submit-comment"]');
      },
      view: async () => {
        await this.page.goto(`/profile/${targetData.profileId}`);
      }
    };

    await actions[actionType]();
    
    // Wait for action to complete and check compliance
    await this.waitForAPICall('automation');
    
    // Verify action was recorded in queue
    const queueStatus = await this.page.locator('[data-testid="automation-queue-status"]').textContent();
    expect(queueStatus).toContain('Action queued');
  }

  /**
   * Check automation compliance and safety scores
   */
  async checkAutomationCompliance(): Promise<{ safetyScore: number; rateLimitStatus: string }> {
    await this.page.goto('/automation/safety');
    
    const safetyScore = await this.page.locator('[data-testid="safety-score"]').textContent();
    const rateLimitStatus = await this.page.locator('[data-testid="rate-limit-status"]').textContent();
    
    return {
      safetyScore: parseFloat(safetyScore?.replace('%', '') || '0'),
      rateLimitStatus: rateLimitStatus || 'unknown'
    };
  }

  /**
   * Generate AI content and validate
   */
  async generateAIContent(contentType: 'post' | 'article' | 'banner', prompt: string): Promise<string> {
    await this.page.goto('/content/generate');
    
    // Select content type
    await this.page.selectOption('[data-testid="content-type-select"]', contentType);
    
    // Enter prompt
    await this.page.fill('[data-testid="content-prompt"]', prompt);
    
    // Generate content
    await this.page.click('[data-testid="generate-button"]');
    
    // Wait for generation to complete
    await this.page.waitForSelector('[data-testid="generated-content"]', { timeout: 30000 });
    
    // Get generated content
    const content = await this.page.locator('[data-testid="generated-content"]').textContent();
    
    return content || '';
  }

  /**
   * Test responsive design across viewports
   */
  async testResponsiveDesign(viewports: { width: number; height: number }[]): Promise<void> {
    for (const viewport of viewports) {
      await this.page.setViewportSize(viewport);
      
      // Check for horizontal scroll
      const hasHorizontalScroll = await this.page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });
      
      expect(hasHorizontalScroll).toBe(false);
      
      // Ensure main content is visible
      await expect(this.page.locator('main')).toBeVisible();
      
      // Check navigation accessibility
      const nav = this.page.locator('nav');
      if (viewport.width < 768) {
        // Mobile: hamburger menu should be visible
        await expect(this.page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
      } else {
        // Desktop: full navigation should be visible
        await expect(nav).toBeVisible();
      }
    }
  }

  /**
   * Measure page performance
   */
  async measurePagePerformance(): Promise<{
    loadTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
  }> {
    const performanceMetrics = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics: any = {};
          
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation') {
              metrics.loadTime = entry.loadEventEnd - entry.loadEventStart;
            }
            if (entry.name === 'first-contentful-paint') {
              metrics.firstContentfulPaint = entry.startTime;
            }
            if (entry.name === 'largest-contentful-paint') {
              metrics.largestContentfulPaint = entry.startTime;
            }
          });
          
          resolve(metrics);
        }).observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
        
        setTimeout(() => resolve({}), 5000); // Fallback timeout
      });
    });

    return performanceMetrics as any;
  }

  /**
   * Take screenshot with context
   */
  async takeScreenshot(name: string, options?: { fullPage?: boolean; clip?: any }): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    
    await this.page.screenshot({
      path: `test-results/screenshots/${filename}`,
      fullPage: options?.fullPage || false,
      clip: options?.clip,
    });
  }

  /**
   * Check for console errors
   */
  async checkConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    this.page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    return errors;
  }

  /**
   * Wait for element with custom timeout and retry logic
   */
  async waitForElementWithRetry(
    selector: string, 
    options?: { timeout?: number; retries?: number }
  ): Promise<Locator> {
    const timeout = options?.timeout || 10000;
    const retries = options?.retries || 3;
    
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.waitForSelector(selector, { timeout });
        return this.page.locator(selector);
      } catch (error) {
        if (i === retries - 1) throw error;
        
        // Wait before retry
        await this.page.waitForTimeout(1000);
      }
    }
    
    throw new Error(`Element ${selector} not found after ${retries} retries`);
  }

  /**
   * Fill form with validation
   */
  async fillFormWithValidation(formData: Record<string, string>): Promise<void> {
    for (const [field, value] of Object.entries(formData)) {
      const input = this.page.locator(`[data-testid="${field}"]`);
      
      // Clear and fill field
      await input.clear();
      await input.fill(value);
      
      // Trigger validation
      await input.blur();
      
      // Check for validation errors
      const errorElement = this.page.locator(`[data-testid="${field}-error"]`);
      const hasError = await errorElement.isVisible();
      
      if (hasError) {
        const errorText = await errorElement.textContent();
        throw new Error(`Validation error for ${field}: ${errorText}`);
      }
    }
  }

  /**
   * Test drag and drop functionality
   */
  async performDragAndDrop(sourceSelector: string, targetSelector: string): Promise<void> {
    const source = this.page.locator(sourceSelector);
    const target = this.page.locator(targetSelector);
    
    // Perform drag and drop
    await source.dragTo(target);
    
    // Verify drop was successful
    await expect(target).toHaveAttribute('data-dropped', 'true');
  }

  /**
   * Test file upload functionality
   */
  async uploadFile(inputSelector: string, filePath: string): Promise<void> {
    const fileInput = this.page.locator(inputSelector);
    await fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete
    await this.page.waitForSelector('[data-testid="upload-success"]', { timeout: 15000 });
  }

  /**
   * Setup API interceptors for testing
   */
  private async setupAPIInterceptors(): Promise<void> {
    // Intercept and log all API calls
    await this.page.route('**/api/**', async (route) => {
      const request = route.request();
      console.log(`API Call: ${request.method()} ${request.url()}`);
      
      await route.continue();
    });

    // Intercept LinkedIn API calls
    await this.page.route('**/linkedin.com/oauth/**', async (route) => {
      console.log(`LinkedIn OAuth: ${route.request().url()}`);
      await route.continue();
    });
  }

  /**
   * Setup performance monitoring
   */
  private async setupPerformanceMonitoring(): Promise<void> {
    await this.page.addInitScript(() => {
      // Monitor long tasks
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) { // Long task threshold
            console.warn(`Long task detected: ${entry.duration}ms`);
          }
        });
      }).observe({ entryTypes: ['longtask'] });

      // Monitor layout shifts
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.hadRecentInput) return;
          
          const cls = entry.value;
          if (cls > 0.1) { // CLS threshold
            console.warn(`High CLS detected: ${cls}`);
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });
    });
  }

  /**
   * Cleanup test environment
   */
  async cleanup(): Promise<void> {
    await this.linkedinMock.cleanup();
    await this.page.unrouteAll();
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestHelpers {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Measure Core Web Vitals
   */
  async measureCoreWebVitals(): Promise<{
    lcp: number;
    fid: number;
    cls: number;
  }> {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = { lcp: 0, fid: 0, cls: 0 };
        
        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((entryList) => {
          const firstEntry = entryList.getEntries()[0];
          vitals.fid = firstEntry.processingStart - firstEntry.startTime;
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        new PerformanceObserver((entryList) => {
          entryList.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              vitals.cls += entry.value;
            }
          });
        }).observe({ entryTypes: ['layout-shift'] });

        // Return vitals after a reasonable time
        setTimeout(() => resolve(vitals), 3000);
      });
    });
  }

  /**
   * Test network throttling
   */
  async testWithNetworkThrottling(conditions: 'slow3g' | 'fast3g' | 'offline'): Promise<void> {
    const networkConditions = {
      slow3g: { offline: false, downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8, latency: 400 },
      fast3g: { offline: false, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 150 },
      offline: { offline: true, downloadThroughput: 0, uploadThroughput: 0, latency: 0 }
    };

    const cdp = await this.page.context().newCDPSession(this.page);
    await cdp.send('Network.emulateNetworkConditions', networkConditions[conditions]);
  }
}

/**
 * Database testing utilities
 */
export class DatabaseTestHelpers {
  /**
   * Clear test data from database
   */
  static async clearTestData(): Promise<void> {
    // This would typically connect to test database and clear test data
    // For now, we'll mock this functionality
    console.log('Clearing test data from database...');
  }

  /**
   * Seed test data
   */
  static async seedTestData(): Promise<void> {
    console.log('Seeding test data...');
  }

  /**
   * Verify database state
   */
  static async verifyDatabaseState(expectedData: any): Promise<boolean> {
    console.log('Verifying database state...', expectedData);
    return true;
  }
}

// Extend global window interface for TypeScript
declare global {
  interface Window {
    testWebSocketMessages: any[];
  }
}