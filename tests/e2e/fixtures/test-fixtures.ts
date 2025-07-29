import { test as baseTest, expect } from '@playwright/test';
import { TestDataManager } from '../utils/TestDataManager';

/**
 * Custom test fixtures for InErgize E2E testing
 * Provides reusable test data and utilities
 */

type TestFixtures = {
  testDataManager: TestDataManager;
  testUser: any;
  linkedInProfile: any;
  analyticsData: any;
  automationSettings: any;
  contentIdeas: any[];
};

export const test = baseTest.extend<TestFixtures>({
  /**
   * Test data manager fixture
   */
  testDataManager: async ({}, use) => {
    const manager = TestDataManager.getInstance();
    await use(manager);
    // Cleanup after test
    manager.cleanup();
  },

  /**
   * Default test user fixture
   */
  testUser: async ({ testDataManager }, use) => {
    const user = testDataManager.generateTestUser('default');
    await use(user);
  },

  /**
   * LinkedIn profile fixture
   */
  linkedInProfile: async ({ testDataManager }, use) => {
    const profile = testDataManager.generateLinkedInProfile('default');
    await use(profile);
  },

  /**
   * Analytics data fixture
   */
  analyticsData: async ({ testDataManager }, use) => {
    const analytics = testDataManager.generateAnalyticsData(30);
    await use(analytics);
  },

  /**
   * Automation settings fixture
   */
  automationSettings: async ({ testDataManager }, use) => {
    const settings = testDataManager.generateAutomationSettings();
    await use(settings);
  },

  /**
   * Content ideas fixture
   */
  contentIdeas: async ({ testDataManager }, use) => {
    const ideas = testDataManager.generateContentIdeas();
    await use(ideas);
  },
});

export { expect } from '@playwright/test';

/**
 * Test utilities for common operations
 */
export class TestUtils {
  /**
   * Generate random string for unique identifiers
   */
  static generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Wait for a specific amount of time
   */
  static async wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Format date for testing
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate random email for testing
   */
  static generateTestEmail(): string {
    const randomString = this.generateRandomString(8);
    return `test+${randomString}@inergize-test.com`;
  }

  /**
   * Generate random phone number
   */
  static generateTestPhoneNumber(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `${areaCode}-${exchange}-${number}`;
  }

  /**
   * Mock LinkedIn OAuth response
   */
  static getMockLinkedInOAuthResponse() {
    return {
      access_token: 'mock_access_token_' + this.generateRandomString(20),
      expires_in: 5184000,
      scope: 'r_liteprofile r_emailaddress w_member_social',
      token_type: 'Bearer',
    };
  }

  /**
   * Mock LinkedIn profile response
   */
  static getMockLinkedInProfileResponse() {
    return {
      id: 'mock_linkedin_id_' + this.generateRandomString(10),
      firstName: {
        localized: { en_US: 'John' },
        preferredLocale: { country: 'US', language: 'en' }
      },
      lastName: {
        localized: { en_US: 'Doe' },
        preferredLocale: { country: 'US', language: 'en' }
      },
      profilePicture: {
        displayImage: 'urn:li:digitalmediaAsset:mock-image-id'
      },
      vanityName: 'johndoe',
    };
  }

  /**
   * Mock API health check response
   */
  static getMockHealthResponse(serviceName: string) {
    return {
      status: 'healthy',
      service: serviceName,
      version: '1.0.0',
      uptime: Math.floor(Math.random() * 86400),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: 'connected',
        redis: 'connected',
        external_apis: 'available'
      }
    };
  }

  /**
   * Common viewport sizes for responsive testing
   */
  static getViewportSizes() {
    return {
      mobile: [
        { width: 320, height: 568 }, // iPhone SE
        { width: 375, height: 667 }, // iPhone 8
        { width: 414, height: 896 }, // iPhone 11
      ],
      tablet: [
        { width: 768, height: 1024 }, // iPad
        { width: 1024, height: 768 }, // iPad Landscape
      ],
      desktop: [
        { width: 1280, height: 720 }, // Small Desktop
        { width: 1440, height: 900 }, // Medium Desktop
        { width: 1920, height: 1080 }, // Large Desktop
      ]
    };
  }

  /**
   * Get accessibility test selectors
   */
  static getAccessibilitySelectors() {
    return {
      skipLinks: 'a[href="#main-content"], a[href="#content"]',
      mainContent: 'main, [role="main"]',
      headings: 'h1, h2, h3, h4, h5, h6',
      focusableElements: 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      landmarks: '[role="banner"], [role="navigation"], [role="main"], [role="contentinfo"]',
      images: 'img',
      forms: 'form',
      labels: 'label',
    };
  }

  /**
   * Performance thresholds for testing
   */
  static getPerformanceThresholds() {
    return {
      loadTime: 3000, // 3 seconds
      firstContentfulPaint: 1500, // 1.5 seconds
      largestContentfulPaint: 2500, // 2.5 seconds
      cumulativeLayoutShift: 0.1,
      firstInputDelay: 100, // 100ms
    };
  }

  /**
   * Common test tags for organizing tests
   */
  static getTestTags() {
    return {
      smoke: '@smoke',
      regression: '@regression',
      critical: '@critical',
      slow: '@slow',
      flaky: '@flaky',
      auth: '@auth',
      profile: '@profile',
      automation: '@automation',
      content: '@content',
      analytics: '@analytics',
      responsive: '@responsive',
      accessibility: '@accessibility',
      performance: '@performance',
    };
  }
}

/**
 * Custom test helpers for common assertions
 */
export class TestAssertions {
  /**
   * Assert element is visible and accessible
   */
  static async assertElementAccessibility(element: any) {
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    
    // Check if element is focusable
    const tagName = await element.evaluate((el: Element) => el.tagName.toLowerCase());
    const focusableElements = ['button', 'input', 'select', 'textarea', 'a'];
    
    if (focusableElements.includes(tagName)) {
      await element.focus();
      await expect(element).toBeFocused();
    }
  }

  /**
   * Assert form field validation
   */
  static async assertFormFieldValidation(field: any, value: string, expectedError?: string) {
    await field.fill(value);
    await field.blur();
    
    if (expectedError) {
      const errorElement = field.locator('xpath=following-sibling::*[contains(@class, "error")]');
      await expect(errorElement).toContainText(expectedError);
    }
  }

  /**
   * Assert API response structure
   */
  static assertApiResponse(response: any, expectedStructure: any) {
    for (const key in expectedStructure) {
      expect(response).toHaveProperty(key);
      
      if (typeof expectedStructure[key] === 'object' && expectedStructure[key] !== null) {
        this.assertApiResponse(response[key], expectedStructure[key]);
      }
    }
  }

  /**
   * Assert performance metrics
   */
  static assertPerformanceMetrics(metrics: any) {
    const thresholds = TestUtils.getPerformanceThresholds();
    
    expect(metrics.loadTime).toBeLessThan(thresholds.loadTime);
    expect(metrics.largestContentfulPaint).toBeLessThan(thresholds.largestContentfulPaint);
    expect(metrics.cumulativeLayoutShift).toBeLessThan(thresholds.cumulativeLayoutShift);
  }

  /**
   * Assert responsive design
   */
  static async assertResponsiveDesign(page: any, viewportSize: { width: number; height: number }) {
    await page.setViewportSize(viewportSize);
    
    // Check for horizontal scrollbar
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
    
    // Ensure content is still accessible
    const mainContent = page.locator('main, [role="main"]');
    await expect(mainContent).toBeVisible();
  }
}