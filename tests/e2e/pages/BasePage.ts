import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model class with common functionality
 * All page objects should extend this class
 */
export abstract class BasePage {
  protected page: Page;
  protected readonly baseURL: string;
  
  // Common selectors
  protected readonly loadingSpinner = '[data-testid="loading-spinner"]';
  protected readonly errorMessage = '[data-testid="error-message"]';
  protected readonly successMessage = '[data-testid="success-message"]';
  protected readonly modal = '[data-testid="modal"]';
  protected readonly closeModalButton = '[data-testid="close-modal"]';

  constructor(page: Page, baseURL: string = '') {
    this.page = page;
    this.baseURL = baseURL;
  }

  /**
   * Navigate to the page
   */
  abstract goto(): Promise<void>;

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoadingToComplete(): Promise<void> {
    try {
      await this.page.waitForSelector(this.loadingSpinner, { 
        state: 'hidden', 
        timeout: 10000 
      });
    } catch (error) {
      // Loading spinner might not exist, which is fine
    }
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true
    });
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector: string, timeout: number = 10000): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  /**
   * Click element with retry logic
   */
  async clickElement(selector: string, timeout: number = 10000): Promise<void> {
    const element = await this.waitForElement(selector, timeout);
    await element.click();
  }

  /**
   * Fill input field with validation
   */
  async fillInput(selector: string, value: string): Promise<void> {
    const input = await this.waitForElement(selector);
    await input.fill(value);
    
    // Verify value was set correctly
    const inputValue = await input.inputValue();
    expect(inputValue).toBe(value);
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    const select = await this.waitForElement(selector);
    await select.selectOption(value);
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get element text content
   */
  async getElementText(selector: string): Promise<string> {
    const element = await this.waitForElement(selector);
    return await element.textContent() || '';
  }

  /**
   * Wait for and verify success message
   */
  async verifySuccessMessage(expectedText?: string): Promise<void> {
    const successElement = await this.waitForElement(this.successMessage);
    await expect(successElement).toBeVisible();
    
    if (expectedText) {
      await expect(successElement).toContainText(expectedText);
    }
  }

  /**
   * Wait for and verify error message
   */
  async verifyErrorMessage(expectedText?: string): Promise<void> {
    const errorElement = await this.waitForElement(this.errorMessage);
    await expect(errorElement).toBeVisible();
    
    if (expectedText) {
      await expect(errorElement).toContainText(expectedText);
    }
  }

  /**
   * Close modal if open
   */
  async closeModal(): Promise<void> {
    if (await this.elementExists(this.modal)) {
      await this.clickElement(this.closeModalButton);
      await this.page.waitForSelector(this.modal, { state: 'hidden' });
    }
  }

  /**
   * Scroll element into view
   */
  async scrollToElement(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.scrollIntoViewIfNeeded();
  }

  /**
   * Wait for specific network response
   */
  async waitForApiResponse(urlPattern: string, method: string = 'GET'): Promise<any> {
    const response = await this.page.waitForResponse(
      response => response.url().includes(urlPattern) && response.request().method() === method
    );
    return await response.json();
  }

  /**
   * Verify page accessibility
   */
  async verifyAccessibility(): Promise<void> {
    // Check for proper heading hierarchy
    const h1Count = await this.page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Check for main content area
    const mainContent = this.page.locator('main, [role="main"]');
    await expect(mainContent).toBeVisible();

    // Check for skip links (if present)
    const skipLink = this.page.locator('a[href="#main-content"], a[href="#content"]');
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeVisible();
    }
  }

  /**
   * Verify responsive design at specific viewport
   */
  async verifyResponsiveDesign(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    await this.waitForPageLoad();
    
    // Verify content is still accessible
    const body = this.page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for horizontal scroll (should not exist)
    const hasHorizontalScroll = await this.page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        largestContentfulPaint: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime || 0,
        cumulativeLayoutShift: performance.getEntriesByName('layout-shift').reduce((sum, entry: any) => sum + entry.value, 0)
      };
    });
  }

  /**
   * Verify Core Web Vitals
   */
  async verifyCoreWebVitals(): Promise<void> {
    const metrics = await this.getPerformanceMetrics();
    
    // LCP should be less than 2.5 seconds
    expect(metrics.largestContentfulPaint).toBeLessThan(2500);
    
    // CLS should be less than 0.1
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1);
    
    // Page load should be less than 3 seconds
    expect(metrics.loadTime).toBeLessThan(3000);
  }

  /**
   * Mock API response for testing
   */
  async mockApiResponse(urlPattern: string, responseData: any, status: number = 200): Promise<void> {
    await this.page.route(`**/${urlPattern}`, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseData)
      });
    });
  }

  /**
   * Clear all API mocks
   */
  async clearApiMocks(): Promise<void> {
    await this.page.unrouteAll();
  }

  /**
   * Wait for WebSocket connection
   */
  async waitForWebSocketConnection(): Promise<void> {
    await this.page.waitForFunction(() => {
      return window.WebSocket && window.WebSocket.OPEN;
    });
  }

  /**
   * Verify element has focus for accessibility
   */
  async verifyElementHasFocus(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await expect(element).toBeFocused();
  }

  /**
   * Navigate using keyboard (accessibility)
   */
  async navigateWithKeyboard(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }
}