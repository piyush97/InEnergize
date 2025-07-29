import { test, expect } from '../fixtures/test-fixtures';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AutomationPage } from '../pages/AutomationPage';

test.describe('Automation Setup and Monitoring', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let automationPage: AutomationPage;

  test.beforeEach(async ({ page, testUser }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    automationPage = new AutomationPage(page);

    // Sign in and navigate to automation
    await authPage.signIn(testUser.email, testUser.password);
    await dashboardPage.verifyDashboardLoaded();
    await automationPage.mockAutomationData();
  });

  test.describe('Connection Automation Setup @automation @critical', () => {
    test('should configure connection automation settings', async ({ automationSettings }) => {
      await automationPage.goto();
      await automationPage.verifyAutomationDashboard();

      await automationPage.configureConnectionAutomation({
        enabled: true,
        dailyLimit: automationSettings.connections.dailyLimit,
        targetAudience: automationSettings.connections.targetAudience,
        messageTemplate: automationSettings.connections.messageTemplate,
        personalized: automationSettings.connections.personalizedMessage
      });

      // Verify settings were saved
      const connectionLimit = page.locator('[data-testid="daily-connection-limit"]');
      await expect(connectionLimit).toHaveValue(automationSettings.connections.dailyLimit.toString());
    });

    test('should validate connection automation limits', async () => {
      await automationPage.goto();
      await automationPage.testSettingsValidation();
    });

    test('should start and stop connection automation', async () => {
      await automationPage.goto();
      
      // Start automation
      await automationPage.startAutomation();
      await automationPage.verifyAutomationStatus('Active');

      // Stop automation
      await automationPage.stopAutomation();
      await automationPage.verifyAutomationStatus('Inactive');
    });

    test('should pause and resume connection automation', async () => {
      await automationPage.goto();
      await automationPage.startAutomation();
      
      // Pause automation
      await automationPage.pauseAutomation();
      await automationPage.verifyAutomationStatus('Paused');

      // Resume automation
      await automationPage.resumeAutomation();
      await automationPage.verifyAutomationStatus('Active');
    });
  });

  test.describe('Engagement Automation Setup @automation @critical', () => {
    test('should configure engagement automation settings', async ({ automationSettings }) => {
      await automationPage.goto();

      await automationPage.configureEngagementAutomation({
        enabled: true,
        dailyLikes: automationSettings.engagement.dailyLikes,
        dailyComments: automationSettings.engagement.dailyComments,
        dailyViews: automationSettings.engagement.dailyViews,
        targetHashtags: automationSettings.engagement.targetHashtags,
        commentTemplates: automationSettings.engagement.commentTemplates
      });

      // Verify engagement settings
      const likesLimit = page.locator('[data-testid="daily-likes-limit"]');
      await expect(likesLimit).toHaveValue(automationSettings.engagement.dailyLikes.toString());
    });

    test('should manage comment templates', async () => {
      await automationPage.goto();
      
      const templates = [
        'Great insights! Thanks for sharing.',
        'This is really valuable information.',
        'Interesting perspective on this topic.'
      ];

      for (const template of templates) {
        await automationPage.addMessageTemplate(template, 'engagement');
      }

      // Verify templates were added
      const templateList = page.locator('[data-testid="template-list"]');
      for (const template of templates) {
        await expect(templateList).toContainText(template);
      }
    });
  });

  test.describe('Safety Monitoring @automation @safety @critical', () => {
    test('should configure safety settings', async ({ automationSettings }) => {
      await automationPage.goto();

      await automationPage.configureSafetySettings({
        healthScoreThreshold: automationSettings.safety.healthScoreThreshold,
        maxErrorRate: automationSettings.safety.maxErrorRate,
        weekendActivity: automationSettings.safety.weekendActivity,
        activityWindow: automationSettings.safety.activityWindow,
        randomDelays: automationSettings.safety.randomDelays,
        pauseOnLowScore: automationSettings.safety.pauseOnLowScore
      });

      // Verify safety score threshold
      const threshold = page.locator('[data-testid="health-score-threshold"]');
      await expect(threshold).toHaveValue(automationSettings.safety.healthScoreThreshold.toString());
    });

    test('should monitor safety score in real-time', async () => {
      await automationPage.goto();
      await automationPage.testRealTimeMonitoring();
    });

    test('should trigger emergency stop when safety score is critical', async ({ page }) => {
      await automationPage.goto();
      
      // Mock critical safety score
      await automationPage.mockApiResponse('api/v1/automation/status', {
        isActive: true,
        safetyScore: 35, // Critical score
        status: 'Critical'
      });

      await page.reload();
      await automationPage.waitForPageLoad();

      // Emergency stop should be triggered
      const emergencyAlert = page.locator('[data-testid="emergency-alert"]');
      if (await emergencyAlert.count() > 0) {
        await expect(emergencyAlert).toBeVisible();
        await expect(emergencyAlert).toContainText('Critical safety score detected');
      }

      // Test manual emergency stop
      await automationPage.emergencyStop();
      await automationPage.verifyAutomationStatus('Stopped');
    });

    test('should display safety alerts and warnings', async ({ page }) => {
      await automationPage.goto();

      const alerts = await automationPage.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      // Verify alert structure
      for (const alert of alerts) {
        expect(alert.severity).toMatch(/info|warning|error|critical/);
        expect(alert.message).toBeTruthy();
        expect(alert.timestamp).toBeTruthy();
      }

      // Test dismissing alerts
      if (alerts.length > 0) {
        await automationPage.dismissAlert(0);
        
        const updatedAlerts = await automationPage.getAlerts();
        expect(updatedAlerts.length).toBe(alerts.length - 1);
      }
    });
  });

  test.describe('Queue Management @automation', () => {
    test('should display automation queue', async ({ page }) => {
      await automationPage.goto();

      const queueSize = await automationPage.getQueueSize();
      expect(queueSize).toBeGreaterThanOrEqual(0);

      if (queueSize > 0) {
        const queueTable = page.locator('[data-testid="queue-table"]');
        await expect(queueTable).toBeVisible();

        // Verify queue items have required information
        const queueItems = page.locator('[data-testid="queue-item"]');
        const firstItem = queueItems.first();
        
        if (await firstItem.count() > 0) {
          await expect(firstItem).toContainText(/connection|like|comment|view/);
          await expect(firstItem).toContainText(/pending|processing|completed/);
        }
      }
    });

    test('should manage queue items', async ({ page }) => {
      await automationPage.goto();

      const queueSize = await automationPage.getQueueSize();
      
      if (queueSize > 0) {
        // Test prioritizing queue item
        await automationPage.manageQueueItem(0, 'priority');

        // Test removing queue item
        await automationPage.manageQueueItem(1, 'remove');

        // Verify queue size decreased
        const newQueueSize = await automationPage.getQueueSize();
        expect(newQueueSize).toBeLessThan(queueSize);
      }
    });

    test('should clear entire queue', async () => {
      await automationPage.goto();

      const initialQueueSize = await automationPage.getQueueSize();
      
      if (initialQueueSize > 0) {
        await automationPage.clearQueue();
        
        const finalQueueSize = await automationPage.getQueueSize();
        expect(finalQueueSize).toBe(0);
      }
    });
  });

  test.describe('Real-time Monitoring @automation @realtime', () => {
    test('should display current automation statistics', async () => {
      await automationPage.goto();

      const stats = await automationPage.getTodayStats();
      
      // Verify stats structure
      expect(typeof stats.connections).toBe('number');
      expect(typeof stats.likes).toBe('number');
      expect(typeof stats.comments).toBe('number');
      expect(typeof stats.views).toBe('number');

      // Verify stats are within reasonable ranges
      expect(stats.connections).toBeGreaterThanOrEqual(0);
      expect(stats.connections).toBeLessThanOrEqual(100);
      expect(stats.likes).toBeGreaterThanOrEqual(0);
      expect(stats.likes).toBeLessThanOrEqual(200);
    });

    test('should update statistics in real-time', async ({ page }) => {
      await automationPage.goto();
      
      const initialStats = await automationPage.getTodayStats();
      
      // Mock real-time update
      await page.evaluate(() => {
        const mockUpdate = {
          type: 'automation_stats_update',
          data: {
            connections: 10,
            likes: 18,
            comments: 4,
            views: 25
          }
        };
        
        window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockUpdate }));
      });

      await page.waitForTimeout(1000);
      
      const updatedStats = await automationPage.getTodayStats();
      expect(updatedStats.connections).toBeGreaterThanOrEqual(initialStats.connections);
    });

    test('should show automation health indicators', async ({ page }) => {
      await automationPage.goto();

      const safetyScore = await automationPage.getCurrentSafetyScore();
      expect(safetyScore).toBeGreaterThanOrEqual(0);
      expect(safetyScore).toBeLessThanOrEqual(100);

      // Verify health indicators
      const healthIndicators = [
        '[data-testid="connection-health"]',
        '[data-testid="engagement-health"]',
        '[data-testid="api-health"]'
      ];

      for (const indicator of healthIndicators) {
        if (await page.locator(indicator).count() > 0) {
          await expect(page.locator(indicator)).toBeVisible();
          
          const status = await page.locator(indicator).getAttribute('data-status');
          expect(status).toMatch(/healthy|warning|critical/);
        }
      }
    });
  });

  test.describe('Template Management @automation', () => {
    test('should create custom message templates', async () => {
      await automationPage.goto();

      const customTemplates = [
        {
          text: 'Hi {firstName}, I saw your post about {topic} and found it very insightful.',
          category: 'connection'
        },
        {
          text: 'Great point about {topic}! This aligns with my experience in {industry}.',
          category: 'engagement'
        }
      ];

      for (const template of customTemplates) {
        await automationPage.addMessageTemplate(template.text, template.category);
      }

      // Verify templates are available for use
      const templateList = page.locator('[data-testid="template-list"]');
      for (const template of customTemplates) {
        await expect(templateList).toContainText(template.text);
      }
    });

    test('should validate template variables', async ({ page }) => {
      await automationPage.goto();

      const templateWithInvalidVars = 'Hi {invalidVar}, nice to meet you!';
      
      const addTemplateButton = page.locator('[data-testid="add-template-button"]');
      if (await addTemplateButton.count() > 0) {
        await addTemplateButton.click();
        
        const templateInput = page.locator('[data-testid="template-input"]');
        await templateInput.fill(templateWithInvalidVars);
        
        const saveButton = page.locator('[data-testid="save-template-button"]');
        await saveButton.click();
        
        // Should show validation error
        await automationPage.verifyFieldError('Invalid template variable: {invalidVar}');
      }
    });

    test('should preview template with sample data', async ({ page }) => {
      await automationPage.goto();

      const template = 'Hi {firstName}, I noticed we both work in {industry}.';
      
      const addTemplateButton = page.locator('[data-testid="add-template-button"]');
      if (await addTemplateButton.count() > 0) {
        await addTemplateButton.click();
        
        const templateInput = page.locator('[data-testid="template-input"]');
        await templateInput.fill(template);
        
        const previewButton = page.locator('[data-testid="preview-template-button"]');
        if (await previewButton.count() > 0) {
          await previewButton.click();
          
          const preview = page.locator('[data-testid="template-preview"]');
          await expect(preview).toBeVisible();
          await expect(preview).toContainText('Hi John, I noticed we both work in Technology.');
        }
      }
    });
  });

  test.describe('Compliance and Rate Limiting @automation @compliance', () => {
    test('should enforce LinkedIn rate limits', async ({ page }) => {
      await automationPage.goto();

      // Test setting limits above LinkedIn's maximum
      await automationPage.setConnectionLimit(150); // Above LinkedIn's 100/day limit
      await automationPage.saveAutomationSettings();
      
      await automationPage.verifyFieldError('Daily limit exceeds LinkedIn maximum of 100 connections');
    });

    test('should show compliance warnings', async ({ page }) => {
      await automationPage.goto();

      // Mock compliance warning
      await automationPage.mockApiResponse('api/v1/automation/compliance', {
        warnings: [
          {
            type: 'rate_limit',
            message: 'Approaching daily connection limit',
            severity: 'warning'
          }
        ]
      });

      await page.reload();

      const complianceWarning = page.locator('[data-testid="compliance-warning"]');
      if (await complianceWarning.count() > 0) {
        await expect(complianceWarning).toBeVisible();
        await expect(complianceWarning).toContainText('Approaching daily connection limit');
      }
    });

    test('should pause automation when limits are reached', async ({ page }) => {
      await automationPage.goto();
      await automationPage.startAutomation();

      // Mock limit reached scenario
      await page.evaluate(() => {
        const mockUpdate = {
          type: 'automation_limit_reached',
          data: {
            type: 'daily_connections',
            current: 15,
            limit: 15,
            action: 'paused'
          }
        };
        
        window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockUpdate }));
      });

      await page.waitForTimeout(1000);

      // Automation should be automatically paused
      await automationPage.verifyAutomationStatus('Paused');
      
      const limitAlert = page.locator('[data-testid="limit-reached-alert"]');
      if (await limitAlert.count() > 0) {
        await expect(limitAlert).toBeVisible();
        await expect(limitAlert).toContainText('Daily connection limit reached');
      }
    });
  });

  test.describe('Accessibility & Responsive Design @automation @accessibility @responsive', () => {
    test('should be fully accessible', async () => {
      await automationPage.goto();
      await automationPage.testAutomationAccessibility();
    });

    test('should work on all device sizes', async () => {
      await automationPage.goto();
      await automationPage.testAutomationResponsive();
    });

    test('should support screen readers', async ({ page }) => {
      await automationPage.goto();
      
      // Check for screen reader announcements
      const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]');
      if (await liveRegion.count() > 0) {
        await expect(liveRegion.first()).toBeInViewport();
      }
      
      // Check for descriptive labels on automation controls
      const toggles = page.locator('[data-testid*="toggle"]');
      const toggleCount = await toggles.count();
      
      for (let i = 0; i < toggleCount; i++) {
        const toggle = toggles.nth(i);
        const ariaLabel = await toggle.getAttribute('aria-label');
        const ariaLabelledBy = await toggle.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });
  });

  test.describe('Performance @automation @performance', () => {
    test('should load automation dashboard quickly', async () => {
      const startTime = Date.now();
      
      await automationPage.goto();
      await automationPage.verifyAutomationDashboard();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle real-time updates efficiently', async ({ page }) => {
      await automationPage.goto();
      
      // Send multiple rapid updates
      for (let i = 0; i < 10; i++) {
        await page.evaluate((index) => {
          const mockUpdate = {
            type: 'automation_stats_update',
            data: {
              connections: index + 1,
              safetyScore: 90 - index
            }
          };
          
          window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockUpdate }));
        }, i);
      }
      
      await page.waitForTimeout(1000);
      
      // UI should still be responsive
      const stats = await automationPage.getTodayStats();
      expect(stats.connections).toBe(10);
    });
  });
});