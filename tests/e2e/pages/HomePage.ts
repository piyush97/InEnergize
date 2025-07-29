import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the InErgize Home Page
 */
export class HomePage extends BasePage {
  // Selectors
  private readonly mainHeading = 'h1';
  private readonly subHeading = 'h2';
  private readonly platformDescription = 'text=LinkedIn Profile Optimization Platform';
  private readonly developmentMessage = 'text=Platform under development';
  private readonly signInButton = '[data-testid="sign-in-button"]';
  private readonly signUpButton = '[data-testid="sign-up-button"]';
  private readonly linkedInConnectButton = '[data-testid="linkedin-connect-button"]';
  private readonly featuresSection = '[data-testid="features-section"]';
  private readonly pricingSection = '[data-testid="pricing-section"]';
  private readonly heroSection = '[data-testid="hero-section"]';
  private readonly navigationMenu = '[data-testid="navigation-menu"]';
  private readonly footer = '[data-testid="footer"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the home page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForPageLoad();
  }

  /**
   * Verify page loads correctly
   */
  async verifyPageLoaded(): Promise<void> {
    await expect(this.page.locator(this.mainHeading)).toContainText('InErgize');
    await expect(this.page.locator(this.subHeading)).toContainText('LinkedIn Profile Optimization Platform');
    await expect(this.page.locator(this.developmentMessage)).toBeVisible();
  }

  /**
   * Click sign in button
   */
  async clickSignIn(): Promise<void> {
    if (await this.elementExists(this.signInButton)) {
      await this.clickElement(this.signInButton);
    } else {
      // Fallback for current implementation
      await this.page.goto('/auth/signin');
    }
  }

  /**
   * Click sign up button
   */
  async clickSignUp(): Promise<void> {
    if (await this.elementExists(this.signUpButton)) {
      await this.clickElement(this.signUpButton);
    } else {
      // Fallback for current implementation
      await this.page.goto('/auth/signup');
    }
  }

  /**
   * Click LinkedIn connect button
   */
  async clickLinkedInConnect(): Promise<void> {
    if (await this.elementExists(this.linkedInConnectButton)) {
      await this.clickElement(this.linkedInConnectButton);
    } else {
      // This will be available in future implementations
      console.log('LinkedIn connect button not yet implemented');
    }
  }

  /**
   * Verify hero section content
   */
  async verifyHeroSection(): Promise<void> {
    const heroText = await this.getElementText(this.mainHeading);
    expect(heroText).toContain('InErgize');
    
    const subText = await this.getElementText(this.subHeading);
    expect(subText).toContain('LinkedIn Profile Optimization Platform');
  }

  /**
   * Verify navigation menu
   */
  async verifyNavigationMenu(): Promise<void> {
    if (await this.elementExists(this.navigationMenu)) {
      await expect(this.page.locator(this.navigationMenu)).toBeVisible();
      
      // Check for common navigation items
      const expectedNavItems = ['Dashboard', 'Profile', 'Content', 'Analytics', 'Settings'];
      for (const item of expectedNavItems) {
        const navItem = this.page.locator(`text=${item}`).first();
        // Only check if the item exists (future implementation)
        if (await navItem.count() > 0) {
          await expect(navItem).toBeVisible();
        }
      }
    }
  }

  /**
   * Verify features section (when implemented)
   */
  async verifyFeaturesSection(): Promise<void> {
    if (await this.elementExists(this.featuresSection)) {
      await expect(this.page.locator(this.featuresSection)).toBeVisible();
      
      const expectedFeatures = [
        'Profile Optimization',
        'Content Generation',
        'Analytics Dashboard',
        'Automation Tools'
      ];
      
      for (const feature of expectedFeatures) {
        const featureElement = this.page.locator(`text=${feature}`).first();
        if (await featureElement.count() > 0) {
          await expect(featureElement).toBeVisible();
        }
      }
    }
  }

  /**
   * Verify pricing section (when implemented)
   */
  async verifyPricingSection(): Promise<void> {
    if (await this.elementExists(this.pricingSection)) {
      await expect(this.page.locator(this.pricingSection)).toBeVisible();
      
      const expectedPlans = ['Free', 'Pro', 'Enterprise'];
      for (const plan of expectedPlans) {
        const planElement = this.page.locator(`text=${plan}`).first();
        if (await planElement.count() > 0) {
          await expect(planElement).toBeVisible();
        }
      }
    }
  }

  /**
   * Verify footer content
   */
  async verifyFooter(): Promise<void> {
    if (await this.elementExists(this.footer)) {
      await expect(this.page.locator(this.footer)).toBeVisible();
      
      const expectedFooterLinks = ['Privacy Policy', 'Terms of Service', 'Contact'];
      for (const link of expectedFooterLinks) {
        const linkElement = this.page.locator(`text=${link}`).first();
        if (await linkElement.count() > 0) {
          await expect(linkElement).toBeVisible();
        }
      }
    }
  }

  /**
   * Test health check endpoint
   */
  async verifyHealthCheck(): Promise<void> {
    const response = await this.page.request.get('/api/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('service', 'web-app');
  }

  /**
   * Verify page meta information
   */
  async verifyPageMeta(): Promise<void> {
    await expect(this.page).toHaveTitle(/InErgize/);
    
    // Check meta description (when implemented)
    const metaDescription = this.page.locator('meta[name="description"]');
    if (await metaDescription.count() > 0) {
      const description = await metaDescription.getAttribute('content');
      expect(description).toContain('LinkedIn');
    }
  }

  /**
   * Verify social media links (when implemented)
   */
  async verifySocialMediaLinks(): Promise<void> {
    const socialLinks = ['LinkedIn', 'Twitter', 'Facebook'];
    
    for (const social of socialLinks) {
      const socialLink = this.page.locator(`a[aria-label*="${social}"], a[title*="${social}"]`);
      if (await socialLink.count() > 0) {
        await expect(socialLink).toBeVisible();
        
        const href = await socialLink.getAttribute('href');
        expect(href).toBeTruthy();
      }
    }
  }

  /**
   * Test call-to-action buttons
   */
  async testCTAButtons(): Promise<void> {
    const ctaButtons = [
      { selector: this.signInButton, action: 'sign-in' },
      { selector: this.signUpButton, action: 'sign-up' },
      { selector: this.linkedInConnectButton, action: 'linkedin-connect' }
    ];

    for (const button of ctaButtons) {
      if (await this.elementExists(button.selector)) {
        await expect(this.page.locator(button.selector)).toBeVisible();
        await expect(this.page.locator(button.selector)).toBeEnabled();
        
        // Verify button is accessible
        await this.verifyElementHasFocus(button.selector);
      }
    }
  }

  /**
   * Verify responsive behavior
   */
  async verifyResponsiveBehavior(): Promise<void> {
    const viewports = [
      { width: 320, height: 568 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }, // Desktop
    ];

    for (const viewport of viewports) {
      await this.verifyResponsiveDesign(viewport.width, viewport.height);
      
      // Verify key elements are still visible
      await expect(this.page.locator(this.mainHeading)).toBeVisible();
      await expect(this.page.locator(this.subHeading)).toBeVisible();
    }
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(): Promise<void> {
    // Tab through focusable elements
    const focusableElements = await this.page.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();

    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await this.navigateWithKeyboard('Tab');
      // Verify an element has focus
      const focusedElement = await this.page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
  }

  /**
   * Test loading states
   */
  async testLoadingStates(): Promise<void> {
    // Simulate slow network
    await this.page.route('**/*', route => {
      setTimeout(() => route.continue(), 100);
    });

    await this.goto();
    await this.waitForLoadingToComplete();
    await this.verifyPageLoaded();
    
    // Clear route
    await this.page.unroute('**/*');
  }

  /**
   * Test error handling
   */
  async testErrorHandling(): Promise<void> {
    // Test 404 page
    const response = await this.page.goto('/non-existent-page');
    expect(response?.status()).toBe(404);
    
    // Navigate back to home
    await this.goto();
    await this.verifyPageLoaded();
  }
}