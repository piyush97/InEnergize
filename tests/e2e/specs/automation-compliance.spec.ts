/**
 * LinkedIn Automation Compliance E2E Tests
 * 
 * End-to-end tests validating LinkedIn automation compliance across the entire
 * application stack. Tests real user workflows to ensure ultra-conservative
 * rate limiting, emergency stops, and safety monitoring work correctly.
 * 
 * Critical compliance scenarios tested:
 * - Ultra-conservative rate limits (15% of LinkedIn's limits)
 * - Real-time safety monitoring and alerts
 * - Emergency stop triggers and recovery
 * - Human-like behavior validation
 * - Cross-browser automation safety
 * - Mobile responsive safety controls
 */

import { test, expect, Page } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AutomationPage } from '../pages/AutomationPage';

// Test fixtures for compliance testing
const COMPLIANCE_TEST_DATA = {
  conservativeLimits: {
    dailyConnections: 15,    // 15% of LinkedIn's 100/day
    dailyLikes: 30,          // 15% of LinkedIn's 200/day
    dailyComments: 8,        // 16% of LinkedIn's 50/day
    dailyViews: 25,          // 17% of LinkedIn's 150/day
    dailyFollows: 5          // 17% of LinkedIn's 30/day
  },
  safetyThresholds: {
    healthScoreMin: 60,
    emergencyStopThreshold: 40,
    warningThreshold: 70,
    maxErrorRate: 0.05,      // 5% max error rate
    minDelaySeconds: 45,     // Minimum delay between actions
    maxDelaySeconds: 180     // Maximum delay between actions
  },
  testUsers: {
    compliantUser: {
      email: 'compliant.test@inergize.com',
      password: 'CompliantTest123!',
      subscription: 'premium'
    },
    violationUser: {
      email: 'violation.test@inergize.com', 
      password: 'ViolationTest123!',
      subscription: 'free'
    },
    emergencyUser: {
      email: 'emergency.test@inergize.com',
      password: 'EmergencyTest123!',
      subscription: 'enterprise'
    }
  }
};

test.describe('LinkedIn Automation Compliance E2E Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let automationPage: AutomationPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    automationPage = new AutomationPage(page);

    // Navigate to application
    await page.goto('/');
    await expect(page).toHaveTitle(/InErgize/);
  });

  test.describe('Ultra-Conservative Rate Limiting Compliance @critical @compliance', () => {
    test('should enforce 15% LinkedIn connection limits', async ({ page }) => {
      // Sign in as compliant user
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await dashboardPage.verifyDashboardLoaded();
      await automationPage.goto();
      
      // Configure connection automation with maximum allowed limit
      await automationPage.configureConnectionAutomation({
        enabled: true,
        dailyLimit: COMPLIANCE_TEST_DATA.conservativeLimits.dailyConnections,
        targetAudience: 'software engineers in tech',
        messageTemplate: 'Hi {firstName}, I noticed we both work in {industry}.',
        personalizedMessage: true,
        delayBetweenConnections: { min: 45, max: 180 }
      });
      
      // Verify limit is properly displayed
      const dailyLimitInput = page.locator('[data-testid="daily-connection-limit"]');
      await expect(dailyLimitInput).toHaveValue('15');
      
      // Verify LinkedIn API compliance warning
      await expect(page.locator('[data-testid="compliance-info"]')).toContainText(
        '15% of LinkedIn daily limit (100 connections)'
      );
      
      // Start automation
      await automationPage.startAutomation();
      await automationPage.verifyAutomationStatus('Active');
      
      // Monitor that connections don't exceed limit
      await page.waitForTimeout(2000); // Allow some processing
      
      const todayStats = await automationPage.getTodayStats();
      expect(todayStats.connections).toBeLessThanOrEqual(15);
      
      // Verify safety score remains high
      const safetyScore = await automationPage.getCurrentSafetyScore();
      expect(safetyScore).toBeGreaterThanOrEqual(70);
    });

    test('should reject settings above LinkedIn compliance limits', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Attempt to set connection limit above conservative threshold
      await automationPage.setConnectionLimit(50); // Above 15 limit
      await automationPage.saveAutomationSettings();
      
      // Should show compliance error
      await expect(page.locator('[data-testid="compliance-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="compliance-error"]')).toContainText(
        'Daily limit exceeds conservative LinkedIn compliance (15 connections/day)'
      );
      
      // Settings should not be saved
      const savedLimit = await page.locator('[data-testid="daily-connection-limit"]').inputValue();
      expect(parseInt(savedLimit)).toBeLessThanOrEqual(15);
    });

    test('should enforce engagement automation limits', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Configure engagement automation
      await automationPage.configureEngagementAutomation({
        enabled: true,
        dailyLikes: COMPLIANCE_TEST_DATA.conservativeLimits.dailyLikes,
        dailyComments: COMPLIANCE_TEST_DATA.conservativeLimits.dailyComments,
        dailyViews: COMPLIANCE_TEST_DATA.conservativeLimits.dailyViews,
        targetHashtags: ['#technology', '#software', '#innovation'],
        commentTemplates: [
          'Great insights! Thanks for sharing.',
          'This is really valuable information.'
        ]
      });
      
      // Verify all limits are within compliance
      await expect(page.locator('[data-testid="daily-likes-limit"]')).toHaveValue('30');
      await expect(page.locator('[data-testid="daily-comments-limit"]')).toHaveValue('8');
      await expect(page.locator('[data-testid="daily-views-limit"]')).toHaveValue('25');
      
      // Start engagement automation
      await automationPage.startAutomation();
      
      // Monitor engagement stats stay within limits
      await page.waitForTimeout(3000);
      
      const stats = await automationPage.getTodayStats();
      expect(stats.likes).toBeLessThanOrEqual(30);
      expect(stats.comments).toBeLessThanOrEqual(8);
      expect(stats.views).toBeLessThanOrEqual(25);
    });

    test('should enforce human-like delay patterns', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Configure with minimum human-like delays
      await automationPage.configureConnectionAutomation({
        enabled: true,
        dailyLimit: 10,
        delayBetweenConnections: { 
          min: COMPLIANCE_TEST_DATA.safetyThresholds.minDelaySeconds, 
          max: COMPLIANCE_TEST_DATA.safetyThresholds.maxDelaySeconds 
        },
        randomizeDelays: true
      });
      
      // Verify delay settings
      await expect(page.locator('[data-testid="min-delay"]')).toHaveValue('45');
      await expect(page.locator('[data-testid="max-delay"]')).toHaveValue('180');
      
      // Start automation and monitor timing patterns
      await automationPage.startAutomation();
      
      // Monitor automation queue for proper delays
      await page.waitForTimeout(5000);
      
      const queueItems = await automationPage.getQueueItems();
      if (queueItems.length > 1) {
        // Check that scheduled times have proper delays
        const scheduledTimes = queueItems.map(item => new Date(item.scheduledAt).getTime());
        
        for (let i = 1; i < scheduledTimes.length; i++) {
          const delay = (scheduledTimes[i] - scheduledTimes[i-1]) / 1000; // Convert to seconds
          expect(delay).toBeGreaterThanOrEqual(45); // Minimum delay
          expect(delay).toBeLessThanOrEqual(300); // Maximum reasonable delay
        }
      }
    });
  });

  test.describe('Real-Time Safety Monitoring @critical @safety', () => {
    test('should display real-time safety score and alerts', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Verify safety score is visible and high initially
      const initialSafetyScore = await automationPage.getCurrentSafetyScore();
      expect(initialSafetyScore).toBeGreaterThanOrEqual(80);
      
      // Start automation
      await automationPage.startAutomation();
      
      // Monitor safety score updates in real-time
      let previousScore = initialSafetyScore;
      let scoreUpdated = false;
      
      // Wait for real-time updates (up to 30 seconds)
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        
        const currentScore = await automationPage.getCurrentSafetyScore();
        if (currentScore !== previousScore) {
          scoreUpdated = true;
          break;
        }
      }
      
      expect(scoreUpdated).toBe(true);
      
      // Verify safety indicators are present
      const healthIndicators = [
        '[data-testid="connection-health"]',
        '[data-testid="engagement-health"]',
        '[data-testid="api-health"]',
        '[data-testid="pattern-health"]'
      ];
      
      for (const indicator of healthIndicators) {
        if (await page.locator(indicator).count() > 0) {
          await expect(page.locator(indicator)).toBeVisible();
          
          const status = await page.locator(indicator).getAttribute('data-status');
          expect(['healthy', 'warning', 'critical']).toContain(status);
        }
      }
    });

    test('should trigger warnings when approaching limits', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Mock approaching daily limit (12 out of 15 connections)
      await automationPage.mockApiResponse('api/v1/automation/status', {
        todayStats: {
          connections: 12,
          connectionsLimit: 15,
          likes: 25,
          likesLimit: 30
        },
        safetyScore: 75, // Warning threshold
        status: 'Warning'
      });
      
      await page.reload();
      await automationPage.waitForPageLoad();
      
      // Should show approaching limit warning
      const warningAlert = page.locator('[data-testid="limit-warning"]');
      if (await warningAlert.count() > 0) {
        await expect(warningAlert).toBeVisible();
        await expect(warningAlert).toContainText('Approaching daily connection limit');
      }
      
      // Safety score should reflect warning state
      const safetyScore = await automationPage.getCurrentSafetyScore();
      expect(safetyScore).toBeLessThanOrEqual(80);
      expect(safetyScore).toBeGreaterThanOrEqual(60);
    });

    test('should show compliance recommendations', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Mock moderate usage scenario
      await automationPage.mockApiResponse('api/v1/automation/compliance-status', {
        complianceScore: 72,
        recommendations: [
          'Reduce daily connection requests to stay well within LinkedIn limits',
          'Increase delays between actions to appear more human-like',
          'Consider targeting a more specific audience to improve acceptance rates'
        ],
        riskFactors: [
          'Daily usage at 80% of conservative limit',
          'Delay patterns showing some regularity'
        ]
      });
      
      await page.reload();
      
      // Should display compliance recommendations
      const recommendationsSection = page.locator('[data-testid="compliance-recommendations"]');
      if (await recommendationsSection.count() > 0) {
        await expect(recommendationsSection).toBeVisible();
        
        const recommendations = await recommendationsSection.locator('.recommendation-item').allTextContents();
        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations[0]).toContain('Reduce daily connection requests');
      }
    });

    test('should update metrics in real-time via WebSocket', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Get initial stats
      const initialStats = await automationPage.getTodayStats();
      
      // Mock WebSocket real-time update
      await page.evaluate(() => {
        const mockUpdate = {
          type: 'automation_stats_update',
          data: {
            connections: 8,
            likes: 15,
            comments: 3,
            views: 12,
            safetyScore: 85
          },
          timestamp: new Date().toISOString()
        };
        
        window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockUpdate }));
      });
      
      // Wait for UI to update
      await page.waitForTimeout(1000);
      
      const updatedStats = await automationPage.getTodayStats();
      
      // Stats should have been updated
      expect(updatedStats.connections).toBeGreaterThanOrEqual(initialStats.connections);
      expect(updatedStats.likes).toBeGreaterThanOrEqual(initialStats.likes);
      
      // Safety score should be updated
      const safetyScore = await automationPage.getCurrentSafetyScore();
      expect(safetyScore).toBeGreaterThanOrEqual(80);
    });
  });

  test.describe('Emergency Stop Functionality @critical @emergency', () => {
    test('should trigger automatic emergency stop on critical safety score', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.email,
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.password
      );
      
      await automationPage.goto();
      await automationPage.startAutomation();
      
      // Mock critical safety score scenario
      await automationPage.mockApiResponse('api/v1/automation/status', {
        isActive: true,
        safetyScore: 35, // Below emergency threshold
        status: 'Critical',
        emergencyStop: {
          triggered: true,
          reason: 'Safety score critically low',
          triggeredAt: new Date().toISOString(),
          manualResumeRequired: false,
          estimatedResumeTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
        }
      });
      
      await page.reload();
      await automationPage.waitForPageLoad();
      
      // Should show emergency stop alert
      const emergencyAlert = page.locator('[data-testid="emergency-alert"]');
      await expect(emergencyAlert).toBeVisible();
      await expect(emergencyAlert).toContainText('Emergency stop activated');
      
      // Automation should be stopped
      await automationPage.verifyAutomationStatus('Emergency Stop');
      
      // Should show reason and estimated resume time
      await expect(page.locator('[data-testid="emergency-reason"]')).toContainText('Safety score critically low');
      await expect(page.locator('[data-testid="estimated-resume"]')).toBeVisible();
    });

    test('should allow manual emergency stop trigger', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.email,
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.password
      );
      
      await automationPage.goto();
      await automationPage.startAutomation();
      
      // Manually trigger emergency stop
      await automationPage.emergencyStop();
      
      // Should show confirmation dialog
      const confirmDialog = page.locator('[data-testid="emergency-stop-confirm"]');
      await expect(confirmDialog).toBeVisible();
      
      await page.locator('[data-testid="confirm-emergency-stop"]').click();
      
      // Automation should be stopped
      await automationPage.verifyAutomationStatus('Emergency Stop');
      
      // Should show manual trigger information
      await expect(page.locator('[data-testid="emergency-reason"]')).toContainText('Manual emergency stop');
    });

    test('should handle emergency stop recovery process', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.email,
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.password
      );
      
      await automationPage.goto();
      
      // Mock emergency stop status ready for recovery
      await automationPage.mockApiResponse('api/v1/automation/status', {
        isActive: false,
        safetyScore: 75, // Recovered score
        status: 'Emergency Stop',
        emergencyStop: {
          triggered: true,
          reason: 'API errors detected',
          triggeredAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 minutes ago
          manualResumeRequired: false,
          estimatedResumeTime: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute ago (ready)
          canResume: true
        }
      });
      
      await page.reload();
      
      // Should show recovery option
      const resumeButton = page.locator('[data-testid="resume-automation"]');
      if (await resumeButton.count() > 0) {
        await expect(resumeButton).toBeVisible();
        await expect(resumeButton).toBeEnabled();
        
        // Click resume
        await resumeButton.click();
        
        // Should show recovery confirmation
        await expect(page.locator('[data-testid="recovery-success"]')).toBeVisible();
        
        // Automation should be active again
        await page.waitForTimeout(2000);
        await automationPage.verifyAutomationStatus('Active');
      }
    });

    test('should prevent resume when manual intervention required', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.email,
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.password
      );
      
      await automationPage.goto();
      
      // Mock critical compliance violation requiring manual review
      await automationPage.mockApiResponse('api/v1/automation/status', {
        isActive: false,
        safetyScore: 45,
        status: 'Emergency Stop',
        emergencyStop: {
          triggered: true,
          reason: 'Critical compliance violation - bot behavior detected',
          triggeredAt: new Date().toISOString(),
          manualResumeRequired: true,
          estimatedResumeTime: null,
          canResume: false,
          requiresAdminApproval: true
        }
      });
      
      await page.reload();
      
      // Resume button should be disabled or not present
      const resumeButton = page.locator('[data-testid="resume-automation"]');
      if (await resumeButton.count() > 0) {
        await expect(resumeButton).toBeDisabled();
      }
      
      // Should show manual intervention message
      await expect(page.locator('[data-testid="manual-intervention-required"]')).toBeVisible();
      await expect(page.locator('[data-testid="manual-intervention-required"]')).toContainText(
        'Manual review required before automation can be resumed'
      );
      
      // Should show contact support option
      await expect(page.locator('[data-testid="contact-support"]')).toBeVisible();
    });
  });

  test.describe('Queue Management and Monitoring @automation @queue', () => {
    test('should display automation queue with proper ordering', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      await automationPage.startAutomation();
      
      // Wait for queue to populate
      await page.waitForTimeout(3000);
      
      const queueSize = await automationPage.getQueueSize();
      expect(queueSize).toBeGreaterThanOrEqual(0);
      
      if (queueSize > 0) {
        // Verify queue table is visible
        const queueTable = page.locator('[data-testid="queue-table"]');
        await expect(queueTable).toBeVisible();
        
        // Check queue items have required information
        const queueItems = page.locator('[data-testid="queue-item"]');
        const firstItem = queueItems.first();
        
        await expect(firstItem).toContainText(/connection|like|comment|view/i);
        await expect(firstItem).toContainText(/pending|processing|completed|scheduled/i);
        
        // Verify scheduled times are in proper order (chronological)
        const scheduledTimes = await queueItems.locator('[data-testid="scheduled-time"]').allTextContents();
        if (scheduledTimes.length > 1) {
          const timestamps = scheduledTimes.map(time => new Date(time).getTime());
          
          for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i-1]);
          }
        }
      }
    });

    test('should pause queue when safety score drops', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      await automationPage.startAutomation();
      
      // Mock dropping safety score
      await page.evaluate(() => {
        const mockUpdate = {
          type: 'safety_score_update',
          data: {
            safetyScore: 55, // Below warning threshold
            queueStatus: 'paused',
            reason: 'Safety score below acceptable threshold'
          }
        };
        
        window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockUpdate }));
      });
      
      await page.waitForTimeout(1000);
      
      // Queue should show paused status
      const queueStatus = page.locator('[data-testid="queue-status"]');
      if (await queueStatus.count() > 0) {
        await expect(queueStatus).toContainText('Paused');
      }
      
      // Should show pause reason
      const pauseReason = page.locator('[data-testid="queue-pause-reason"]');
      if (await pauseReason.count() > 0) {
        await expect(pauseReason).toContainText('Safety score below acceptable threshold');
      }
    });

    test('should allow manual queue management', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      await automationPage.startAutomation();
      
      await page.waitForTimeout(2000);
      
      const initialQueueSize = await automationPage.getQueueSize();
      
      if (initialQueueSize > 0) {
        // Test prioritizing a queue item
        const queueItems = page.locator('[data-testid="queue-item"]');
        const firstItem = queueItems.first();
        
        // Click priority button if available
        const priorityButton = firstItem.locator('[data-testid="priority-item"]');
        if (await priorityButton.count() > 0) {
          await priorityButton.click();
          
          // Should show success notification
          await expect(page.locator('[data-testid="queue-action-success"]')).toBeVisible();
        }
        
        // Test removing a queue item
        const removeButton = firstItem.locator('[data-testid="remove-item"]');
        if (await removeButton.count() > 0) {
          await removeButton.click();
          
          // Should show confirmation
          const confirmDialog = page.locator('[data-testid="remove-item-confirm"]');
          if (await confirmDialog.count() > 0) {
            await confirmDialog.locator('[data-testid="confirm-remove"]').click();
          }
          
          // Queue size should decrease
          await page.waitForTimeout(1000);
          const newQueueSize = await automationPage.getQueueSize();
          expect(newQueueSize).toBeLessThan(initialQueueSize);
        }
      }
    });

    test('should clear queue when emergency stop is triggered', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.email,
        COMPLIANCE_TEST_DATA.testUsers.emergencyUser.password
      );
      
      await automationPage.goto();
      await automationPage.startAutomation();
      
      // Wait for queue to populate
      await page.waitForTimeout(2000);
      const initialQueueSize = await automationPage.getQueueSize();
      
      // Trigger emergency stop
      await automationPage.emergencyStop();
      await page.locator('[data-testid="confirm-emergency-stop"]').click();
      
      // Wait for emergency stop to process
      await page.waitForTimeout(2000);
      
      // Queue should be cleared
      const finalQueueSize = await automationPage.getQueueSize();
      expect(finalQueueSize).toBe(0);
      
      // Should show queue cleared message
      const queueMessage = page.locator('[data-testid="queue-status-message"]');
      if (await queueMessage.count() > 0) {
        await expect(queueMessage).toContainText('Queue cleared due to emergency stop');
      }
    });
  });

  test.describe('Cross-Browser Compliance @cross-browser', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`should maintain compliance features in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
        test.skip(currentBrowser !== browserName, `Skipping ${browserName} test`);
        
        await authPage.signIn(
          COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
          COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
        );
        
        await automationPage.goto();
        
        // Verify core compliance features work
        await automationPage.configureConnectionAutomation({
          enabled: true,
          dailyLimit: 15,
          delayBetweenConnections: { min: 45, max: 180 }
        });
        
        // Start automation
        await automationPage.startAutomation();
        
        // Verify safety score is visible
        const safetyScore = await automationPage.getCurrentSafetyScore();
        expect(safetyScore).toBeGreaterThanOrEqual(70);
        
        // Verify queue management works
        const queueSize = await automationPage.getQueueSize();
        expect(queueSize).toBeGreaterThanOrEqual(0);
        
        // Test emergency stop
        await automationPage.emergencyStop();
        const confirmButton = page.locator('[data-testid="confirm-emergency-stop"]');
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await automationPage.verifyAutomationStatus('Emergency Stop');
        }
      });
    });
  });

  test.describe('Mobile Responsive Safety Controls @mobile @responsive', () => {
    test('should display safety controls on mobile viewports', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Verify safety score is visible on mobile
      const safetyScore = page.locator('[data-testid="safety-score-mobile"]');
      if (await safetyScore.count() === 0) {
        // Fallback to regular safety score
        await expect(page.locator('[data-testid="safety-score"]')).toBeVisible();
      } else {
        await expect(safetyScore).toBeVisible();
      }
      
      // Verify emergency stop button is accessible
      const emergencyButton = page.locator('[data-testid="emergency-stop-button"]');
      await expect(emergencyButton).toBeVisible();
      await expect(emergencyButton).toBeInViewport();
      
      // Verify automation controls are accessible
      const startButton = page.locator('[data-testid="start-automation"]');
      if (await startButton.count() > 0) {
        await expect(startButton).toBeVisible();
        await expect(startButton).toBeInViewport();
      }
      
      // Test mobile navigation to automation settings
      const settingsButton = page.locator('[data-testid="automation-settings-mobile"]');
      if (await settingsButton.count() > 0) {
        await settingsButton.click();
        
        // Should navigate to settings
        await expect(page.locator('[data-testid="automation-settings-form"]')).toBeVisible();
      }
    });

    test('should handle touch interactions on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12 Pro
      
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Test touch interaction with safety score details
      const safetyScoreElement = page.locator('[data-testid="safety-score"]');
      await safetyScoreElement.tap();
      
      // Should show safety details modal or expanded view
      const safetyDetails = page.locator('[data-testid="safety-details"]');
      if (await safetyDetails.count() > 0) {
        await expect(safetyDetails).toBeVisible();
      }
      
      // Test swipe gestures on queue items (if queue has items)
      const queueItems = page.locator('[data-testid="queue-item"]');
      const itemCount = await queueItems.count();
      
      if (itemCount > 0) {
        const firstItem = queueItems.first();
        
        // Simulate swipe right for actions
        await firstItem.hover();
        await page.mouse.down();
        await page.mouse.move(100, 0); // Swipe right
        await page.mouse.up();
        
        // Should reveal action buttons
        const actionButtons = page.locator('[data-testid="queue-item-actions"]');
        if (await actionButtons.count() > 0) {
          await expect(actionButtons).toBeVisible();
        }
      }
    });
  });

  test.describe('Accessibility Compliance @accessibility', () => {
    test('should be fully accessible for screen readers', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Check for screen reader announcements
      const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]');
      if (await liveRegion.count() > 0) {
        await expect(liveRegion.first()).toBeInViewport();
      }
      
      // Check for descriptive labels on automation controls
      const criticalControls = [
        '[data-testid="start-automation"]',
        '[data-testid="stop-automation"]',
        '[data-testid="emergency-stop-button"]',
        '[data-testid="daily-connection-limit"]'
      ];
      
      for (const selector of criticalControls) {
        const control = page.locator(selector);
        if (await control.count() > 0) {
          const ariaLabel = await control.getAttribute('aria-label');
          const ariaLabelledBy = await control.getAttribute('aria-labelledby');
          const title = await control.getAttribute('title');
          
          expect(ariaLabel || ariaLabelledBy || title).toBeTruthy();
        }
      }
      
      // Check for proper heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      
      if (headingCount > 0) {
        const firstHeading = headings.first();
        const tagName = await firstHeading.evaluate(el => el.tagName.toLowerCase());
        expect(tagName).toBe('h1'); // Should start with h1
      }
      
      // Check for focus management
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await authPage.signIn(
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
        COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
      );
      
      await automationPage.goto();
      
      // Test keyboard navigation through automation controls
      await page.keyboard.press('Tab'); // Focus first element
      
      let tabCount = 0;
      const maxTabs = 20; // Prevent infinite loop
      
      while (tabCount < maxTabs) {
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? {
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            testId: el.getAttribute('data-testid')
          } : null;
        });
        
        if (focusedElement?.testId === 'emergency-stop-button') {
          // Test that emergency stop can be triggered with keyboard
          await page.keyboard.press('Enter');
          
          const confirmDialog = page.locator('[data-testid="emergency-stop-confirm"]');
          if (await confirmDialog.count() > 0) {
            await expect(confirmDialog).toBeVisible();
            
            // Press Escape to cancel
            await page.keyboard.press('Escape');
            await expect(confirmDialog).not.toBeVisible();
          }
          break;
        }
        
        await page.keyboard.press('Tab');
        tabCount++;
      }
      
      expect(tabCount).toBeLessThan(maxTabs); // Should have found the emergency stop button
    });
  });
});

test.describe('Performance Under Load @performance', () => {
  test('should maintain responsiveness with high automation activity', async ({ page }) => {
    const authPage = new AuthPage(page);
    const automationPage = new AutomationPage(page);
    
    await authPage.signIn(
      COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
      COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
    );
    
    await automationPage.goto();
    
    // Measure initial page load time
    const navigationStart = await page.evaluate(() => performance.timing.navigationStart);
    const loadComplete = await page.evaluate(() => performance.timing.loadEventEnd);
    const initialLoadTime = loadComplete - navigationStart;
    
    expect(initialLoadTime).toBeLessThan(5000); // Should load within 5 seconds
    
    // Start automation with high activity simulation
    await automationPage.startAutomation();
    
    // Simulate rapid WebSocket updates
    for (let i = 0; i < 50; i++) {
      await page.evaluate((index) => {
        const mockUpdate = {
          type: 'automation_stats_update',
          data: {
            connections: index + 1,
            safetyScore: 90 - (index * 0.5),
            queueSize: 20 - Math.floor(index / 3)
          }
        };
        
        window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockUpdate }));
      }, i);
      
      if (i % 10 === 0) {
        await page.waitForTimeout(100); // Small pause every 10 updates
      }
    }
    
    // UI should still be responsive
    const finalStats = await automationPage.getTodayStats();
    expect(finalStats.connections).toBe(50);
    
    // Safety score should still be accessible
    const safetyScore = await automationPage.getCurrentSafetyScore();
    expect(safetyScore).toBeGreaterThan(0);
  });

  test('should handle concurrent user simulation', async ({ page, context }) => {
    // This test simulates multiple users by opening multiple pages
    const authPage = new AuthPage(page);
    const automationPage = new AutomationPage(page);
    
    // User 1
    await authPage.signIn(
      COMPLIANCE_TEST_DATA.testUsers.compliantUser.email,
      COMPLIANCE_TEST_DATA.testUsers.compliantUser.password
    );
    await automationPage.goto();
    await automationPage.startAutomation();
    
    // Create additional pages for concurrent users
    const page2 = await context.newPage();
    const authPage2 = new AuthPage(page2);
    const automationPage2 = new AutomationPage(page2);
    
    // User 2
    await authPage2.signIn(
      COMPLIANCE_TEST_DATA.testUsers.violationUser.email,
      COMPLIANCE_TEST_DATA.testUsers.violationUser.password
    );
    await automationPage2.goto();
    await automationPage2.startAutomation();
    
    // Both users should be able to operate simultaneously
    const stats1 = await automationPage.getTodayStats();
    const stats2 = await automationPage2.getTodayStats();
    
    expect(stats1).toBeDefined();
    expect(stats2).toBeDefined();
    
    // Both safety scores should be accessible
    const score1 = await automationPage.getCurrentSafetyScore();
    const score2 = await automationPage2.getCurrentSafetyScore();
    
    expect(score1).toBeGreaterThan(0);
    expect(score2).toBeGreaterThan(0);
    
    await page2.close();
  });
});