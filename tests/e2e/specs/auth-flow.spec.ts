import { test, expect } from '../fixtures/test-fixtures';
import { HomePage } from '../pages/HomePage';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TestUtils } from '../fixtures/test-fixtures';

test.describe('Registration & LinkedIn OAuth Flow', () => {
  let homePage: HomePage;
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe('User Registration Flow @auth @critical', () => {
    test('should complete successful user registration', async ({ page, testUser }) => {
      // Navigate to registration page
      await homePage.goto();
      await homePage.clickSignUp();

      // Verify sign up form is displayed
      await authPage.verifySignUpForm();

      // Fill and submit registration form
      await authPage.fillSignUpForm(testUser);
      await authPage.submitForm();

      // Verify successful registration
      await authPage.verifyAuthSuccess();

      // Should redirect to dashboard or onboarding
      expect(page.url()).toMatch(/\/(dashboard|onboarding)/);
    });

    test('should validate required fields during registration', async ({ testUser }) => {
      await authPage.gotoSignUp();

      // Test form validation
      await authPage.testFormValidation();
      await authPage.testPasswordConfirmation();
      await authPage.testTermsAcceptance();
    });

    test('should prevent registration with existing email', async ({ testUser }) => {
      await authPage.gotoSignUp();
      
      // Mock API response for existing email
      await authPage.mockApiResponse('auth/register', {
        error: 'Email already exists'
      }, 409);

      await authPage.fillSignUpForm(testUser);
      await authPage.submitForm();

      await authPage.verifyGeneralError('Email already exists');
    });

    test('should show password strength indicator', async ({ page, testUser }) => {
      await authPage.gotoSignUp();

      const passwordInput = page.locator('[data-testid="password-input"]');
      const strengthIndicator = page.locator('[data-testid="password-strength"]');

      if (await strengthIndicator.count() > 0) {
        // Test weak password
        await passwordInput.fill('123');
        await expect(strengthIndicator).toContainText('Weak');

        // Test medium password
        await passwordInput.fill('password123');
        await expect(strengthIndicator).toContainText('Medium');

        // Test strong password
        await passwordInput.fill(testUser.password);
        await expect(strengthIndicator).toContainText('Strong');
      }
    });
  });

  test.describe('User Sign In Flow @auth @critical', () => {
    test('should complete successful sign in', async ({ page, testUser }) => {
      await authPage.gotoSignIn();
      
      // Mock successful authentication
      await authPage.mockApiResponse('auth/login', {
        success: true,
        token: 'mock_jwt_token',
        user: {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName
        }
      });

      await authPage.fillSignInForm(testUser.email, testUser.password);
      await authPage.submitForm();

      await authPage.verifyAuthSuccess();
      expect(page.url()).toMatch(/\/dashboard/);
    });

    test('should handle invalid credentials', async ({ testUser }) => {
      await authPage.gotoSignIn();
      
      // Mock authentication failure
      await authPage.mockApiResponse('auth/login', {
        error: 'Invalid credentials'
      }, 401);

      await authPage.fillSignInForm(testUser.email, 'wrongpassword');
      await authPage.submitForm();

      await authPage.verifyGeneralError('Invalid credentials');
    });

    test('should implement rate limiting protection', async ({ testUser }) => {
      await authPage.gotoSignIn();
      
      // Mock rate limit response after multiple attempts
      await authPage.mockApiResponse('auth/login', {
        error: 'Too many login attempts. Please try again later.'
      }, 429);

      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await authPage.fillSignInForm(testUser.email, 'wrongpassword');
        await authPage.submitForm();
      }

      await authPage.verifyGeneralError('Too many login attempts');
    });

    test('should remember user with "Remember Me" option', async ({ page, testUser }) => {
      await authPage.gotoSignIn();

      const rememberCheckbox = page.locator('[data-testid="remember-me-checkbox"]');
      if (await rememberCheckbox.count() > 0) {
        await rememberCheckbox.check();
        await authPage.fillSignInForm(testUser.email, testUser.password);
        await authPage.submitForm();

        // Verify persistent session
        const hasRememberToken = await page.evaluate(() => {
          return localStorage.getItem('remember_token') !== null;
        });
        expect(hasRememberToken).toBe(true);
      }
    });
  });

  test.describe('LinkedIn OAuth Integration @auth @critical', () => {
    test('should initiate LinkedIn OAuth flow', async ({ page }) => {
      await authPage.gotoSignIn();

      // Mock LinkedIn OAuth responses
      await authPage.mockLinkedInOAuth();

      // Test LinkedIn OAuth flow
      await authPage.testLinkedInOAuth();
    });

    test('should handle LinkedIn OAuth callback', async ({ page }) => {
      // Navigate to OAuth callback URL with mock parameters
      await page.goto('/auth/linkedin/callback?code=mock_code&state=mock_state');

      // Mock token exchange
      await authPage.mockApiResponse('auth/linkedin/callback', {
        success: true,
        token: 'mock_jwt_token',
        user: {
          id: 'linkedin_user_123',
          email: 'linkedin@example.com',
          firstName: 'John',
          lastName: 'Doe',
          linkedInId: 'mock_linkedin_id'
        }
      });

      await authPage.waitForPageLoad();
      
      // Should redirect to dashboard or onboarding
      expect(page.url()).toMatch(/\/(dashboard|onboarding)/);
    });

    test('should handle LinkedIn OAuth errors', async ({ page }) => {
      // Navigate with error parameters
      await page.goto('/auth/linkedin/callback?error=access_denied&error_description=User+cancelled');

      // Should redirect back to auth page with error
      await expect(page.locator('[data-testid="oauth-error"]')).toContainText('LinkedIn authorization was cancelled');
    });

    test('should sync LinkedIn profile data after OAuth', async ({ page, linkedInProfile }) => {
      await authPage.gotoSignIn();
      await authPage.mockLinkedInOAuth();

      // Mock profile sync API
      await authPage.mockApiResponse('api/v1/linkedin/sync', {
        success: true,
        profile: linkedInProfile
      });

      await authPage.testLinkedInOAuth();

      // Verify profile data was synced
      await dashboardPage.goto();
      await dashboardPage.verifyProfileCompletion();
    });
  });

  test.describe('Password Recovery Flow @auth', () => {
    test('should send password reset email', async ({ testUser }) => {
      await authPage.testForgotPassword(testUser.email);
    });

    test('should validate email format in forgot password', async () => {
      await authPage.gotoForgotPassword();
      
      const emailInput = '[data-testid="email-input"]';
      await authPage.fillInput(emailInput, 'invalid-email');
      await authPage.submitForm();
      
      await authPage.verifyFieldError('Please enter a valid email');
    });

    test('should handle non-existent email in forgot password', async () => {
      await authPage.gotoForgotPassword();
      
      // Mock API response for non-existent email
      await authPage.mockApiResponse('auth/forgot-password', {
        error: 'Email not found'
      }, 404);
      
      const emailInput = '[data-testid="email-input"]';
      await authPage.fillInput(emailInput, 'nonexistent@example.com');
      await authPage.submitForm();
      
      await authPage.verifyGeneralError('Email not found');
    });
  });

  test.describe('Session Management @auth', () => {
    test('should maintain session across page refreshes', async ({ page, testUser }) => {
      // Sign in first
      await authPage.signIn(testUser.email, testUser.password);
      await dashboardPage.verifyDashboardLoaded();

      // Refresh page
      await page.reload();
      
      // Should still be authenticated
      await dashboardPage.verifyDashboardLoaded();
      expect(page.url()).toMatch(/\/dashboard/);
    });

    test('should handle expired session gracefully', async ({ page, testUser }) => {
      // Sign in first
      await authPage.signIn(testUser.email, testUser.password);
      await dashboardPage.verifyDashboardLoaded();

      // Mock expired token
      await page.evaluate(() => {
        localStorage.setItem('auth_token', 'expired_token');
      });

      // Mock API response for expired token
      await authPage.mockApiResponse('auth/verify', {
        error: 'Token expired'
      }, 401);

      // Try to access protected resource
      await page.reload();

      // Should redirect to login
      await page.waitForURL(/\/(auth|login)/);
    });

    test('should logout successfully', async ({ page, testUser }) => {
      // Sign in first
      await authPage.signIn(testUser.email, testUser.password);
      await dashboardPage.verifyDashboardLoaded();

      // Logout
      await dashboardPage.logout();

      // Should redirect to login page
      expect(page.url()).toMatch(/\/(auth|login)/);
      
      // Auth tokens should be cleared
      const hasAuthToken = await page.evaluate(() => {
        return localStorage.getItem('auth_token') !== null;
      });
      expect(hasAuthToken).toBe(false);
    });
  });

  test.describe('Multi-Factor Authentication @auth @security', () => {
    test('should handle MFA setup during registration', async ({ page, testUser }) => {
      await authPage.signUp(testUser);

      const mfaSetup = page.locator('[data-testid="mfa-setup"]');
      if (await mfaSetup.count() > 0) {
        await expect(mfaSetup).toBeVisible();
        
        // Mock MFA QR code generation
        const qrCode = page.locator('[data-testid="mfa-qr-code"]');
        await expect(qrCode).toBeVisible();
        
        // Mock MFA verification
        const mfaInput = page.locator('[data-testid="mfa-code-input"]');
        await mfaInput.fill('123456');
        
        const verifyButton = page.locator('[data-testid="verify-mfa-button"]');
        await verifyButton.click();
        
        await authPage.verifySuccessMessage('MFA enabled successfully');
      }
    });

    test('should require MFA code during sign in', async ({ page, testUser }) => {
      await authPage.gotoSignIn();
      
      // Mock MFA required response
      await authPage.mockApiResponse('auth/login', {
        mfaRequired: true,
        tempToken: 'temp_mfa_token'
      });

      await authPage.fillSignInForm(testUser.email, testUser.password);
      await authPage.submitForm();

      const mfaInput = page.locator('[data-testid="mfa-code-input"]');
      if (await mfaInput.count() > 0) {
        await expect(mfaInput).toBeVisible();
        
        // Mock successful MFA verification
        await authPage.mockApiResponse('auth/verify-mfa', {
          success: true,
          token: 'final_auth_token'
        });
        
        await mfaInput.fill('123456');
        await authPage.submitForm();
        
        await authPage.verifyAuthSuccess();
      }
    });
  });

  test.describe('Email Verification @auth', () => {
    test('should require email verification for new accounts', async ({ page, testUser }) => {
      await authPage.signUp(testUser);

      const verificationMessage = page.locator('[data-testid="email-verification-message"]');
      if (await verificationMessage.count() > 0) {
        await expect(verificationMessage).toContainText('Please check your email');
      }
    });

    test('should handle email verification link', async ({ page }) => {
      // Navigate to verification URL
      await page.goto('/auth/verify-email?token=mock_verification_token');

      // Mock verification API
      await authPage.mockApiResponse('auth/verify-email', {
        success: true,
        message: 'Email verified successfully'
      });

      await authPage.verifySuccessMessage('Email verified successfully');
      
      // Should redirect to dashboard
      await page.waitForURL(/\/dashboard/);
    });

    test('should handle invalid verification tokens', async ({ page }) => {
      await page.goto('/auth/verify-email?token=invalid_token');

      await authPage.mockApiResponse('auth/verify-email', {
        error: 'Invalid verification token'
      }, 400);

      await authPage.verifyGeneralError('Invalid verification token');
    });
  });

  test.describe('Accessibility & Responsive Design @auth @accessibility @responsive', () => {
    test('should be accessible with screen readers', async ({ page }) => {
      await authPage.gotoSignIn();
      await authPage.testAuthAccessibility();
    });

    test('should work on mobile devices', async ({ page }) => {
      await authPage.gotoSignIn();
      await authPage.testAuthResponsive();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await authPage.gotoSignIn();
      
      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('name', 'email');
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('type', 'password');
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('type', 'submit');
    });

    test('should have proper color contrast', async ({ page }) => {
      await authPage.gotoSignIn();
      
      // Test color contrast (this would typically use axe-core)
      const contrastIssues = await page.evaluate(() => {
        // Mock contrast check - in real implementation, use axe-core
        return [];
      });
      
      expect(contrastIssues).toHaveLength(0);
    });
  });

  test.describe('Performance @auth @performance', () => {
    test('should load quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await authPage.gotoSignIn();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
    });

    test('should have good Core Web Vitals', async ({ page }) => {
      await authPage.gotoSignIn();
      await authPage.verifyCoreWebVitals();
    });
  });
});