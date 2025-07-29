import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TestUser } from '../utils/TestDataManager';

/**
 * Page Object Model for Authentication Pages (Sign In / Sign Up)
 */
export class AuthPage extends BasePage {
  // Common selectors
  private readonly emailInput = '[data-testid="email-input"], input[type="email"], input[name="email"]';
  private readonly passwordInput = '[data-testid="password-input"], input[type="password"], input[name="password"]';
  private readonly confirmPasswordInput = '[data-testid="confirm-password-input"], input[name="confirmPassword"]';
  private readonly firstNameInput = '[data-testid="first-name-input"], input[name="firstName"]';
  private readonly lastNameInput = '[data-testid="last-name-input"], input[name="lastName"]';
  private readonly submitButton = '[data-testid="submit-button"], button[type="submit"]';
  private readonly linkedInOAuthButton = '[data-testid="linkedin-oauth-button"]';
  private readonly forgotPasswordLink = '[data-testid="forgot-password-link"], a[href*="forgot"]';
  private readonly switchModeLink = '[data-testid="switch-mode-link"]';
  private readonly termsCheckbox = '[data-testid="terms-checkbox"], input[name="acceptTerms"]';
  private readonly showPasswordButton = '[data-testid="show-password-button"]';
  
  // Error and success messages
  private readonly fieldError = '[data-testid="field-error"]';
  private readonly generalError = '[data-testid="general-error"]';
  private readonly successMessage = '[data-testid="success-message"]';
  
  // Form containers
  private readonly signInForm = '[data-testid="sign-in-form"]';
  private readonly signUpForm = '[data-testid="sign-up-form"]';
  private readonly forgotPasswordForm = '[data-testid="forgot-password-form"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to sign in page
   */
  async gotoSignIn(): Promise<void> {
    await this.page.goto('/auth/signin');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to sign up page
   */
  async gotoSignUp(): Promise<void> {
    await this.page.goto('/auth/signup');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to forgot password page
   */
  async gotoForgotPassword(): Promise<void> {
    await this.page.goto('/auth/forgot-password');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to the appropriate auth page
   */
  async goto(page: 'signin' | 'signup' | 'forgot-password' = 'signin'): Promise<void> {
    switch (page) {
      case 'signin':
        await this.gotoSignIn();
        break;
      case 'signup':
        await this.gotoSignUp();
        break;
      case 'forgot-password':
        await this.gotoForgotPassword();
        break;
    }
  }

  /**
   * Fill sign in form
   */
  async fillSignInForm(email: string, password: string): Promise<void> {
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
  }

  /**
   * Fill sign up form
   */
  async fillSignUpForm(user: TestUser, confirmPassword?: string): Promise<void> {
    if (await this.elementExists(this.firstNameInput)) {
      await this.fillInput(this.firstNameInput, user.firstName);
    }
    
    if (await this.elementExists(this.lastNameInput)) {
      await this.fillInput(this.lastNameInput, user.lastName);
    }
    
    await this.fillInput(this.emailInput, user.email);
    await this.fillInput(this.passwordInput, user.password);
    
    if (await this.elementExists(this.confirmPasswordInput)) {
      await this.fillInput(this.confirmPasswordInput, confirmPassword || user.password);
    }
    
    // Accept terms if checkbox exists
    if (await this.elementExists(this.termsCheckbox)) {
      await this.clickElement(this.termsCheckbox);
    }
  }

  /**
   * Submit authentication form
   */
  async submitForm(): Promise<void> {
    await this.clickElement(this.submitButton);
    await this.waitForLoadingToComplete();
  }

  /**
   * Sign in with credentials
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.gotoSignIn();
    await this.fillSignInForm(email, password);
    await this.submitForm();
  }

  /**
   * Sign up with user data
   */
  async signUp(user: TestUser): Promise<void> {
    await this.gotoSignUp();
    await this.fillSignUpForm(user);
    await this.submitForm();
  }

  /**
   * Click LinkedIn OAuth button
   */
  async clickLinkedInOAuth(): Promise<void> {
    if (await this.elementExists(this.linkedInOAuthButton)) {
      await this.clickElement(this.linkedInOAuthButton);
    } else {
      throw new Error('LinkedIn OAuth button not found - may not be implemented yet');
    }
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    if (await this.elementExists(this.forgotPasswordLink)) {
      await this.clickElement(this.forgotPasswordLink);
    } else {
      await this.gotoForgotPassword();
    }
  }

  /**
   * Switch between sign in and sign up modes
   */
  async switchMode(): Promise<void> {
    if (await this.elementExists(this.switchModeLink)) {
      await this.clickElement(this.switchModeLink);
      await this.waitForPageLoad();
    }
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    if (await this.elementExists(this.showPasswordButton)) {
      await this.clickElement(this.showPasswordButton);
    }
  }

  /**
   * Verify sign in form elements
   */
  async verifySignInForm(): Promise<void> {
    await expect(this.page.locator(this.emailInput)).toBeVisible();
    await expect(this.page.locator(this.passwordInput)).toBeVisible();
    await expect(this.page.locator(this.submitButton)).toBeVisible();
    
    // Check for optional elements
    if (await this.elementExists(this.linkedInOAuthButton)) {
      await expect(this.page.locator(this.linkedInOAuthButton)).toBeVisible();
    }
    
    if (await this.elementExists(this.forgotPasswordLink)) {
      await expect(this.page.locator(this.forgotPasswordLink)).toBeVisible();
    }
  }

  /**
   * Verify sign up form elements
   */
  async verifySignUpForm(): Promise<void> {
    await expect(this.page.locator(this.emailInput)).toBeVisible();
    await expect(this.page.locator(this.passwordInput)).toBeVisible();
    await expect(this.page.locator(this.submitButton)).toBeVisible();
    
    // Check for optional elements
    if (await this.elementExists(this.firstNameInput)) {
      await expect(this.page.locator(this.firstNameInput)).toBeVisible();
    }
    
    if (await this.elementExists(this.lastNameInput)) {
      await expect(this.page.locator(this.lastNameInput)).toBeVisible();
    }
    
    if (await this.elementExists(this.confirmPasswordInput)) {
      await expect(this.page.locator(this.confirmPasswordInput)).toBeVisible();
    }
    
    if (await this.elementExists(this.termsCheckbox)) {
      await expect(this.page.locator(this.termsCheckbox)).toBeVisible();
    }
  }

  /**
   * Verify field validation error
   */
  async verifyFieldError(expectedMessage?: string): Promise<void> {
    const errorElement = await this.waitForElement(this.fieldError);
    await expect(errorElement).toBeVisible();
    
    if (expectedMessage) {
      await expect(errorElement).toContainText(expectedMessage);
    }
  }

  /**
   * Verify general error message
   */
  async verifyGeneralError(expectedMessage?: string): Promise<void> {
    const errorElement = await this.waitForElement(this.generalError);
    await expect(errorElement).toBeVisible();
    
    if (expectedMessage) {
      await expect(errorElement).toContainText(expectedMessage);
    }
  }

  /**
   * Verify successful authentication
   */
  async verifyAuthSuccess(): Promise<void> {
    // Should redirect to dashboard or onboarding
    await this.page.waitForURL(/\/(dashboard|onboarding)/);
    
    // Or check for success message if staying on same page
    if (await this.elementExists(this.successMessage)) {
      await this.verifySuccessMessage();
    }
  }

  /**
   * Test form validation
   */
  async testFormValidation(): Promise<void> {
    // Test empty email
    await this.fillInput(this.emailInput, '');
    await this.fillInput(this.passwordInput, 'password123');
    await this.submitForm();
    await this.verifyFieldError('Email is required');

    // Test invalid email format
    await this.fillInput(this.emailInput, 'invalid-email');
    await this.submitForm();
    await this.verifyFieldError('Please enter a valid email');

    // Test empty password
    await this.fillInput(this.emailInput, 'test@example.com');
    await this.fillInput(this.passwordInput, '');
    await this.submitForm();
    await this.verifyFieldError('Password is required');

    // Test weak password (if on sign up)
    if (await this.elementExists(this.confirmPasswordInput)) {
      await this.fillInput(this.passwordInput, '123');
      await this.submitForm();
      await this.verifyFieldError('Password must be at least 8 characters');
    }
  }

  /**
   * Test password confirmation matching
   */
  async testPasswordConfirmation(): Promise<void> {
    if (await this.elementExists(this.confirmPasswordInput)) {
      await this.fillInput(this.passwordInput, 'password123');
      await this.fillInput(this.confirmPasswordInput, 'different123');
      await this.submitForm();
      await this.verifyFieldError('Passwords do not match');
    }
  }

  /**
   * Test terms acceptance requirement
   */
  async testTermsAcceptance(): Promise<void> {
    if (await this.elementExists(this.termsCheckbox)) {
      // Fill form but don't check terms
      await this.fillInput(this.emailInput, 'test@example.com');
      await this.fillInput(this.passwordInput, 'password123');
      await this.submitForm();
      await this.verifyFieldError('You must accept the terms and conditions');
    }
  }

  /**
   * Mock LinkedIn OAuth flow
   */
  async mockLinkedInOAuth(): Promise<void> {
    // Mock LinkedIn OAuth endpoints
    await this.mockApiResponse('linkedin.com/oauth/v2/authorization', {
      code: 'mock_auth_code_123',
      state: 'random_state_value'
    });

    await this.mockApiResponse('linkedin.com/oauth/v2/accessToken', {
      access_token: 'mock_access_token',
      expires_in: 5184000,
      scope: 'r_liteprofile r_emailaddress',
      token_type: 'Bearer'
    });

    await this.mockApiResponse('api.linkedin.com/v2/me', {
      id: 'mock_linkedin_id',
      firstName: { localized: { en_US: 'John' } },
      lastName: { localized: { en_US: 'Doe' } }
    });
  }

  /**
   * Test LinkedIn OAuth flow
   */
  async testLinkedInOAuth(): Promise<void> {
    if (await this.elementExists(this.linkedInOAuthButton)) {
      await this.mockLinkedInOAuth();
      
      // Click LinkedIn OAuth button
      await this.clickLinkedInOAuth();
      
      // Should redirect or show success
      await this.verifyAuthSuccess();
    }
  }

  /**
   * Test forgot password flow
   */
  async testForgotPassword(email: string): Promise<void> {
    await this.gotoForgotPassword();
    
    if (await this.elementExists(this.emailInput)) {
      await this.fillInput(this.emailInput, email);
      await this.submitForm();
      await this.verifySuccessMessage('Password reset instructions sent');
    }
  }

  /**
   * Test accessibility of auth forms
   */
  async testAuthAccessibility(): Promise<void> {
    // Verify form labels
    const emailLabel = this.page.locator('label[for*="email"]');
    if (await emailLabel.count() > 0) {
      await expect(emailLabel).toBeVisible();
    }

    const passwordLabel = this.page.locator('label[for*="password"]');
    if (await passwordLabel.count() > 0) {
      await expect(passwordLabel).toBeVisible();
    }

    // Test keyboard navigation
    await this.page.keyboard.press('Tab');
    await this.verifyElementHasFocus(this.emailInput);
    
    await this.page.keyboard.press('Tab');
    await this.verifyElementHasFocus(this.passwordInput);

    // Test screen reader support
    const emailInput = this.page.locator(this.emailInput);
    const emailAriaLabel = await emailInput.getAttribute('aria-label');
    const emailPlaceholder = await emailInput.getAttribute('placeholder');
    
    expect(emailAriaLabel || emailPlaceholder).toBeTruthy();
  }

  /**
   * Test responsive design of auth forms
   */
  async testAuthResponsive(): Promise<void> {
    const viewports = [
      { width: 320, height: 568 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }, // Desktop
    ];

    for (const viewport of viewports) {
      await this.verifyResponsiveDesign(viewport.width, viewport.height);
      
      // Verify form elements are still usable
      await expect(this.page.locator(this.emailInput)).toBeVisible();
      await expect(this.page.locator(this.passwordInput)).toBeVisible();
      await expect(this.page.locator(this.submitButton)).toBeVisible();
    }
  }

  /**
   * Logout if authenticated
   */
  async logout(): Promise<void> {
    const logoutButton = this.page.locator('[data-testid="logout-button"], text="Logout", text="Sign Out"');
    
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      await this.waitForPageLoad();
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check for authentication indicators
      const dashboardUrl = this.page.url().includes('/dashboard');
      const authToken = await this.page.evaluate(() => localStorage.getItem('auth_token'));
      const userMenu = await this.page.locator('[data-testid="user-menu"]').count() > 0;
      
      return dashboardUrl || !!authToken || userMenu;
    } catch {
      return false;
    }
  }
}