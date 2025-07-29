import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { AutomationSettings } from '../utils/TestDataManager';

/**
 * Page Object Model for LinkedIn Automation Setup and Monitoring
 */
export class AutomationPage extends BasePage {
  // Main sections
  private readonly automationDashboard = '[data-testid="automation-dashboard"]';
  private readonly automationOverview = '[data-testid="automation-overview"]';
  private readonly safetyMonitor = '[data-testid="safety-monitor"]';
  private readonly automationQueue = '[data-testid="automation-queue"]';
  private readonly automationSettings = '[data-testid="automation-settings"]';
  
  // Connection automation
  private readonly connectionAutomation = '[data-testid="connection-automation"]';
  private readonly connectionToggle = '[data-testid="connection-toggle"]';
  private readonly connectionSettings = '[data-testid="connection-settings"]';
  private readonly dailyConnectionLimit = '[data-testid="daily-connection-limit"]';
  private readonly targetAudienceInput = '[data-testid="target-audience-input"]';
  private readonly messageTemplateTextarea = '[data-testid="message-template-textarea"]';
  private readonly personalizedMessageToggle = '[data-testid="personalized-message-toggle"]';
  
  // Engagement automation
  private readonly engagementAutomation = '[data-testid="engagement-automation"]';
  private readonly engagementToggle = '[data-testid="engagement-toggle"]';
  private readonly engagementSettings = '[data-testid="engagement-settings"]';
  private readonly dailyLikesLimit = '[data-testid="daily-likes-limit"]';
  private readonly dailyCommentsLimit = '[data-testid="daily-comments-limit"]';
  private readonly dailyViewsLimit = '[data-testid="daily-views-limit"]';
  private readonly targetHashtagsInput = '[data-testid="target-hashtags-input"]';
  private readonly commentTemplatesTextarea = '[data-testid="comment-templates-textarea"]';
  
  // Safety settings
  private readonly safetySettings = '[data-testid="safety-settings"]';
  private readonly healthScoreThreshold = '[data-testid="health-score-threshold"]';
  private readonly maxErrorRate = '[data-testid="max-error-rate"]';
  private readonly weekendActivitySlider = '[data-testid="weekend-activity-slider"]';
  private readonly activityWindowStart = '[data-testid="activity-window-start"]';
  private readonly activityWindowEnd = '[data-testid="activity-window-end"]';
  private readonly randomDelaysToggle = '[data-testid="random-delays-toggle"]';
  private readonly pauseOnLowScoreToggle = '[data-testid="pause-on-low-score-toggle"]';
  
  // Monitoring
  private readonly currentSafetyScore = '[data-testid="current-safety-score"]';
  private readonly automationStatus = '[data-testid="automation-status"]';
  private readonly todayStats = '[data-testid="today-stats"]';
  private readonly connectionsToday = '[data-testid="connections-today"]';
  private readonly likesToday = '[data-testid="likes-today"]';
  private readonly commentsToday = '[data-testid="comments-today"]';
  private readonly viewsToday = '[data-testid="views-today"]';
  private readonly queueSize = '[data-testid="queue-size"]';
  private readonly errorRate = '[data-testid="error-rate"]';
  
  // Queue management
  private readonly queueTable = '[data-testid="queue-table"]';
  private readonly queueItem = '[data-testid="queue-item"]';
  private readonly pauseQueueButton = '[data-testid="pause-queue-button"]';
  private readonly clearQueueButton = '[data-testid="clear-queue-button"]';
  private readonly priorityButton = '[data-testid="priority-button"]';
  private readonly removeFromQueueButton = '[data-testid="remove-from-queue-button"]';
  
  // Templates
  private readonly templateManager = '[data-testid="template-manager"]';
  private readonly addTemplateButton = '[data-testid="add-template-button"]';
  private readonly templateInput = '[data-testid="template-input"]';
  private readonly templateCategory = '[data-testid="template-category"]';
  private readonly saveTemplateButton = '[data-testid="save-template-button"]';
  private readonly templateList = '[data-testid="template-list"]';
  private readonly templateItem = '[data-testid="template-item"]';
  
  // Alerts and notifications
  private readonly alertsPanel = '[data-testid="alerts-panel"]';
  private readonly alertItem = '[data-testid="alert-item"]';
  private readonly alertSeverity = '[data-testid="alert-severity"]';
  private readonly alertMessage = '[data-testid="alert-message"]';
  private readonly alertTimestamp = '[data-testid="alert-timestamp"]';
  private readonly dismissAlertButton = '[data-testid="dismiss-alert-button"]';
  
  // Action buttons
  private readonly startAutomationButton = '[data-testid="start-automation-button"]';
  private readonly stopAutomationButton = '[data-testid="stop-automation-button"]';
  private readonly pauseAutomationButton = '[data-testid="pause-automation-button"]';
  private readonly resumeAutomationButton = '[data-testid="resume-automation-button"]';
  private readonly saveSettingsButton = '[data-testid="save-settings-button"]';
  private readonly resetSettingsButton = '[data-testid="reset-settings-button"]';
  private readonly emergencyStopButton = '[data-testid="emergency-stop-button"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to automation page
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard/automation');
    await this.waitForPageLoad();
    await this.waitForLoadingToComplete();
  }

  /**
   * Verify automation dashboard loaded
   */
  async verifyAutomationDashboard(): Promise<void> {
    await expect(this.page.locator(this.automationDashboard)).toBeVisible();
    await expect(this.page.locator(this.automationOverview)).toBeVisible();
    await expect(this.page.locator(this.safetyMonitor)).toBeVisible();
  }

  /**
   * Configure connection automation
   */
  async configureConnectionAutomation(settings: {
    enabled: boolean;
    dailyLimit: number;
    targetAudience: string[];
    messageTemplate: string;
    personalized: boolean;
  }): Promise<void> {
    if (await this.elementExists(this.connectionAutomation)) {
      // Toggle automation
      if (settings.enabled) {
        await this.enableConnectionAutomation();
      } else {
        await this.disableConnectionAutomation();
        return;
      }
      
      // Set daily limit
      await this.setConnectionLimit(settings.dailyLimit);
      
      // Set target audience
      await this.setTargetAudience(settings.targetAudience);
      
      // Set message template
      await this.setMessageTemplate(settings.messageTemplate);
      
      // Toggle personalized messages
      await this.togglePersonalizedMessages(settings.personalized);
      
      // Save settings
      await this.saveAutomationSettings();
    }
  }

  /**
   * Configure engagement automation
   */
  async configureEngagementAutomation(settings: {
    enabled: boolean;
    dailyLikes: number;
    dailyComments: number;
    dailyViews: number;
    targetHashtags: string[];
    commentTemplates: string[];
  }): Promise<void> {
    if (await this.elementExists(this.engagementAutomation)) {
      // Toggle automation
      if (settings.enabled) {
        await this.enableEngagementAutomation();
      } else {
        await this.disableEngagementAutomation();
        return;
      }
      
      // Set daily limits
      await this.setEngagementLimits(settings.dailyLikes, settings.dailyComments, settings.dailyViews);
      
      // Set target hashtags
      await this.setTargetHashtags(settings.targetHashtags);
      
      // Set comment templates
      await this.setCommentTemplates(settings.commentTemplates);
      
      // Save settings
      await this.saveAutomationSettings();
    }
  }

  /**
   * Configure safety settings
   */
  async configureSafetySettings(settings: {
    healthScoreThreshold: number;
    maxErrorRate: number;
    weekendActivity: number;
    activityWindow: { start: string; end: string };
    randomDelays: boolean;
    pauseOnLowScore: boolean;
  }): Promise<void> {
    if (await this.elementExists(this.safetySettings)) {
      // Set health score threshold
      await this.setHealthScoreThreshold(settings.healthScoreThreshold);
      
      // Set max error rate
      await this.setMaxErrorRate(settings.maxErrorRate);
      
      // Set weekend activity
      await this.setWeekendActivity(settings.weekendActivity);
      
      // Set activity window
      await this.setActivityWindow(settings.activityWindow.start, settings.activityWindow.end);
      
      // Toggle random delays
      await this.toggleRandomDelays(settings.randomDelays);
      
      // Toggle pause on low score
      await this.togglePauseOnLowScore(settings.pauseOnLowScore);
      
      // Save settings
      await this.saveAutomationSettings();
    }
  }

  /**
   * Enable connection automation
   */
  async enableConnectionAutomation(): Promise<void> {
    const toggle = this.page.locator(this.connectionToggle);
    if (await toggle.count() > 0) {
      const isEnabled = await toggle.isChecked();
      if (!isEnabled) {
        await toggle.click();
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * Disable connection automation
   */
  async disableConnectionAutomation(): Promise<void> {
    const toggle = this.page.locator(this.connectionToggle);
    if (await toggle.count() > 0) {
      const isEnabled = await toggle.isChecked();
      if (isEnabled) {
        await toggle.click();
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * Enable engagement automation
   */
  async enableEngagementAutomation(): Promise<void> {
    const toggle = this.page.locator(this.engagementToggle);
    if (await toggle.count() > 0) {
      const isEnabled = await toggle.isChecked();
      if (!isEnabled) {
        await toggle.click();
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * Disable engagement automation
   */
  async disableEngagementAutomation(): Promise<void> {
    const toggle = this.page.locator(this.engagementToggle);
    if (await toggle.count() > 0) {
      const isEnabled = await toggle.isChecked();
      if (isEnabled) {
        await toggle.click();
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * Set connection daily limit
   */
  async setConnectionLimit(limit: number): Promise<void> {
    if (await this.elementExists(this.dailyConnectionLimit)) {
      await this.fillInput(this.dailyConnectionLimit, limit.toString());
    }
  }

  /**
   * Set target audience
   */
  async setTargetAudience(audience: string[]): Promise<void> {
    if (await this.elementExists(this.targetAudienceInput)) {
      const audienceText = audience.join(', ');
      await this.fillInput(this.targetAudienceInput, audienceText);
    }
  }

  /**
   * Set message template
   */
  async setMessageTemplate(template: string): Promise<void> {
    if (await this.elementExists(this.messageTemplateTextarea)) {
      await this.fillInput(this.messageTemplateTextarea, template);
    }
  }

  /**
   * Toggle personalized messages
   */
  async togglePersonalizedMessages(enabled: boolean): Promise<void> {
    const toggle = this.page.locator(this.personalizedMessageToggle);
    if (await toggle.count() > 0) {
      const isEnabled = await toggle.isChecked();
      if (isEnabled !== enabled) {
        await toggle.click();
      }
    }
  }

  /**
   * Set engagement limits
   */
  async setEngagementLimits(likes: number, comments: number, views: number): Promise<void> {
    if (await this.elementExists(this.dailyLikesLimit)) {
      await this.fillInput(this.dailyLikesLimit, likes.toString());
    }
    
    if (await this.elementExists(this.dailyCommentsLimit)) {
      await this.fillInput(this.dailyCommentsLimit, comments.toString());
    }
    
    if (await this.elementExists(this.dailyViewsLimit)) {
      await this.fillInput(this.dailyViewsLimit, views.toString());
    }
  }

  /**
   * Set target hashtags
   */
  async setTargetHashtags(hashtags: string[]): Promise<void> {
    if (await this.elementExists(this.targetHashtagsInput)) {
      const hashtagText = hashtags.join(', ');
      await this.fillInput(this.targetHashtagsInput, hashtagText);
    }
  }

  /**
   * Set comment templates
   */
  async setCommentTemplates(templates: string[]): Promise<void> {
    if (await this.elementExists(this.commentTemplatesTextarea)) {
      const templatesText = templates.join('\n');
      await this.fillInput(this.commentTemplatesTextarea, templatesText);
    }
  }

  /**
   * Set health score threshold
   */
  async setHealthScoreThreshold(threshold: number): Promise<void> {
    if (await this.elementExists(this.healthScoreThreshold)) {
      await this.fillInput(this.healthScoreThreshold, threshold.toString());
    }
  }

  /**
   * Set max error rate
   */
  async setMaxErrorRate(rate: number): Promise<void> {
    if (await this.elementExists(this.maxErrorRate)) {
      await this.fillInput(this.maxErrorRate, rate.toString());
    }
  }

  /**
   * Set weekend activity level
   */
  async setWeekendActivity(activity: number): Promise<void> {
    if (await this.elementExists(this.weekendActivitySlider)) {
      const slider = this.page.locator(this.weekendActivitySlider);
      
      // Set slider value (assuming 0-1 range)
      await slider.fill(activity.toString());
    }
  }

  /**
   * Set activity window
   */
  async setActivityWindow(start: string, end: string): Promise<void> {
    if (await this.elementExists(this.activityWindowStart)) {
      await this.fillInput(this.activityWindowStart, start);
    }
    
    if (await this.elementExists(this.activityWindowEnd)) {
      await this.fillInput(this.activityWindowEnd, end);
    }
  }

  /**
   * Toggle random delays
   */
  async toggleRandomDelays(enabled: boolean): Promise<void> {
    const toggle = this.page.locator(this.randomDelaysToggle);
    if (await toggle.count() > 0) {
      const isEnabled = await toggle.isChecked();
      if (isEnabled !== enabled) {
        await toggle.click();
      }
    }
  }

  /**
   * Toggle pause on low score
   */
  async togglePauseOnLowScore(enabled: boolean): Promise<void> {
    const toggle = this.page.locator(this.pauseOnLowScoreToggle);
    if (await toggle.count() > 0) {
      const isEnabled = await toggle.isChecked();
      if (isEnabled !== enabled) {
        await toggle.click();
      }
    }
  }

  /**
   * Save automation settings
   */
  async saveAutomationSettings(): Promise<void> {
    if (await this.elementExists(this.saveSettingsButton)) {
      await this.clickElement(this.saveSettingsButton);
      await this.waitForLoadingToComplete();
      await this.verifySuccessMessage('Settings saved successfully');
    }
  }

  /**
   * Start automation
   */
  async startAutomation(): Promise<void> {
    if (await this.elementExists(this.startAutomationButton)) {
      await this.clickElement(this.startAutomationButton);
      await this.waitForLoadingToComplete();
      
      // Verify automation started
      await this.verifyAutomationStatus('Active');
    }
  }

  /**
   * Stop automation
   */
  async stopAutomation(): Promise<void> {
    if (await this.elementExists(this.stopAutomationButton)) {
      await this.clickElement(this.stopAutomationButton);
      await this.waitForLoadingToComplete();
      
      // Verify automation stopped
      await this.verifyAutomationStatus('Inactive');
    }
  }

  /**
   * Pause automation
   */
  async pauseAutomation(): Promise<void> {
    if (await this.elementExists(this.pauseAutomationButton)) {
      await this.clickElement(this.pauseAutomationButton);
      await this.waitForLoadingToComplete();
      
      // Verify automation paused
      await this.verifyAutomationStatus('Paused');
    }
  }

  /**
   * Resume automation
   */
  async resumeAutomation(): Promise<void> {
    if (await this.elementExists(this.resumeAutomationButton)) {
      await this.clickElement(this.resumeAutomationButton);
      await this.waitForLoadingToComplete();
      
      // Verify automation resumed
      await this.verifyAutomationStatus('Active');
    }
  }

  /**
   * Emergency stop
   */
  async emergencyStop(): Promise<void> {
    if (await this.elementExists(this.emergencyStopButton)) {
      await this.clickElement(this.emergencyStopButton);
      
      // Confirm emergency stop if modal appears
      const confirmButton = '[data-testid="confirm-emergency-stop"]';
      if (await this.elementExists(confirmButton)) {
        await this.clickElement(confirmButton);
      }
      
      await this.waitForLoadingToComplete();
      await this.verifyAutomationStatus('Stopped');
    }
  }

  /**
   * Get current safety score
   */
  async getCurrentSafetyScore(): Promise<number> {
    if (await this.elementExists(this.currentSafetyScore)) {
      const scoreText = await this.getElementText(this.currentSafetyScore);
      const match = scoreText.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }

  /**
   * Verify automation status
   */
  async verifyAutomationStatus(expectedStatus: string): Promise<void> {
    if (await this.elementExists(this.automationStatus)) {
      const statusText = await this.getElementText(this.automationStatus);
      expect(statusText).toContain(expectedStatus);
    }
  }

  /**
   * Get today's automation stats
   */
  async getTodayStats(): Promise<{
    connections: number;
    likes: number;
    comments: number;
    views: number;
  }> {
    const stats = {
      connections: 0,
      likes: 0,
      comments: 0,
      views: 0
    };

    if (await this.elementExists(this.connectionsToday)) {
      const connectionsText = await this.getElementText(this.connectionsToday);
      const match = connectionsText.match(/(\d+)/);
      stats.connections = match ? parseInt(match[1]) : 0;
    }

    if (await this.elementExists(this.likesToday)) {
      const likesText = await this.getElementText(this.likesToday);
      const match = likesText.match(/(\d+)/);
      stats.likes = match ? parseInt(match[1]) : 0;
    }

    if (await this.elementExists(this.commentsToday)) {
      const commentsText = await this.getElementText(this.commentsToday);
      const match = commentsText.match(/(\d+)/);
      stats.comments = match ? parseInt(match[1]) : 0;
    }

    if (await this.elementExists(this.viewsToday)) {
      const viewsText = await this.getElementText(this.viewsToday);
      const match = viewsText.match(/(\d+)/);
      stats.views = match ? parseInt(match[1]) : 0;
    }

    return stats;
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    if (await this.elementExists(this.queueSize)) {
      const queueText = await this.getElementText(this.queueSize);
      const match = queueText.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }

  /**
   * Manage queue items
   */
  async manageQueueItem(index: number, action: 'pause' | 'priority' | 'remove'): Promise<void> {
    const queueItems = await this.page.locator(this.queueItem).all();
    
    if (queueItems.length > index) {
      const item = queueItems[index];
      
      switch (action) {
        case 'pause':
          const pauseButton = item.locator(this.pauseQueueButton);
          if (await pauseButton.count() > 0) {
            await pauseButton.click();
          }
          break;
          
        case 'priority':
          const priorityButton = item.locator(this.priorityButton);
          if (await priorityButton.count() > 0) {
            await priorityButton.click();
          }
          break;
          
        case 'remove':
          const removeButton = item.locator(this.removeFromQueueButton);
          if (await removeButton.count() > 0) {
            await removeButton.click();
            
            // Confirm removal if modal appears
            const confirmButton = '[data-testid="confirm-remove"]';
            if (await this.elementExists(confirmButton)) {
              await this.clickElement(confirmButton);
            }
          }
          break;
      }
      
      await this.waitForLoadingToComplete();
    }
  }

  /**
   * Clear entire queue
   */
  async clearQueue(): Promise<void> {
    if (await this.elementExists(this.clearQueueButton)) {
      await this.clickElement(this.clearQueueButton);
      
      // Confirm clearing
      const confirmButton = '[data-testid="confirm-clear-queue"]';
      if (await this.elementExists(confirmButton)) {
        await this.clickElement(confirmButton);
      }
      
      await this.waitForLoadingToComplete();
      
      // Verify queue is empty
      const queueSize = await this.getQueueSize();
      expect(queueSize).toBe(0);
    }
  }

  /**
   * Add message template
   */
  async addMessageTemplate(template: string, category: string): Promise<void> {
    if (await this.elementExists(this.templateManager)) {
      await this.clickElement(this.addTemplateButton);
      
      if (await this.elementExists(this.templateInput)) {
        await this.fillInput(this.templateInput, template);
        
        if (await this.elementExists(this.templateCategory)) {
          await this.selectOption(this.templateCategory, category);
        }
        
        await this.clickElement(this.saveTemplateButton);
        await this.waitForLoadingToComplete();
        
        await this.verifySuccessMessage('Template added successfully');
      }
    }
  }

  /**
   * Get alert notifications
   */
  async getAlerts(): Promise<Array<{
    severity: string;
    message: string;
    timestamp: string;
  }>> {
    const alerts: Array<{
      severity: string;
      message: string;
      timestamp: string;
    }> = [];

    if (await this.elementExists(this.alertsPanel)) {
      const alertItems = await this.page.locator(this.alertItem).all();
      
      for (const alert of alertItems) {
        const severity = await alert.locator(this.alertSeverity).textContent() || '';
        const message = await alert.locator(this.alertMessage).textContent() || '';
        const timestamp = await alert.locator(this.alertTimestamp).textContent() || '';
        
        alerts.push({ severity, message, timestamp });
      }
    }

    return alerts;
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(index: number): Promise<void> {
    const alertItems = await this.page.locator(this.alertItem).all();
    
    if (alertItems.length > index) {
      const dismissButton = alertItems[index].locator(this.dismissAlertButton);
      if (await dismissButton.count() > 0) {
        await dismissButton.click();
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * Mock automation data
   */
  async mockAutomationData(): Promise<void> {
    // Mock automation status
    await this.mockApiResponse('api/v1/automation/status', {
      isActive: true,
      safetyScore: 92,
      status: 'Active',
      todayStats: {
        connections: 8,
        likes: 15,
        comments: 3,
        views: 22
      },
      queueSize: 45,
      errorRate: 0.02
    });

    // Mock automation settings
    await this.mockApiResponse('api/v1/automation/settings', {
      connections: {
        enabled: true,
        dailyLimit: 15,
        targetAudience: ['Software Engineers', 'Product Managers'],
        messageTemplate: 'Hi {firstName}, I noticed we work in similar fields.',
        personalizedMessage: true
      },
      engagement: {
        enabled: true,
        dailyLikes: 30,
        dailyComments: 8,
        dailyViews: 25,
        targetHashtags: ['#technology', '#innovation']
      },
      safety: {
        healthScoreThreshold: 80,
        maxErrorRate: 0.03,
        weekendActivity: 0.3,
        activityWindow: { start: '09:00', end: '17:00' }
      }
    });

    // Mock queue data
    await this.mockApiResponse('api/v1/automation/queue', {
      items: [
        {
          id: '1',
          type: 'connection',
          target: 'John Doe',
          scheduledTime: '2024-01-15T10:30:00Z',
          status: 'pending'
        },
        {
          id: '2',
          type: 'like',
          target: 'Post about AI trends',
          scheduledTime: '2024-01-15T11:00:00Z',
          status: 'pending'
        }
      ]
    });

    // Mock alerts
    await this.mockApiResponse('api/v1/automation/alerts', {
      alerts: [
        {
          id: '1',
          severity: 'warning',
          message: 'Safety score dropped below 85',
          timestamp: '2024-01-15T09:15:00Z'
        }
      ]
    });
  }

  /**
   * Test automation settings validation
   */
  async testSettingsValidation(): Promise<void> {
    // Test invalid daily limits
    await this.setConnectionLimit(-1);
    await this.saveAutomationSettings();
    await this.verifyFieldError('Daily limit must be greater than 0');

    await this.setConnectionLimit(101);
    await this.saveAutomationSettings();
    await this.verifyFieldError('Daily limit cannot exceed 100');

    // Test invalid error rate
    await this.setMaxErrorRate(1.5);
    await this.saveAutomationSettings();
    await this.verifyFieldError('Error rate must be between 0 and 1');

    // Test invalid activity window
    await this.setActivityWindow('18:00', '08:00');
    await this.saveAutomationSettings();
    await this.verifyFieldError('End time must be after start time');
  }

  /**
   * Test real-time monitoring
   */
  async testRealTimeMonitoring(): Promise<void> {
    // Wait for WebSocket connection
    await this.waitForWebSocketConnection();
    
    // Mock real-time updates
    await this.page.evaluate(() => {
      // Simulate WebSocket message for safety score update
      const mockData = {
        type: 'safety_score_update',
        data: {
          score: 88,
          trend: -4
        }
      };
      
      window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockData }));
    });
    
    // Wait for UI to update
    await this.page.waitForTimeout(1000);
    
    // Verify safety score updated
    const currentScore = await this.getCurrentSafetyScore();
    expect(currentScore).toBe(88);
  }

  /**
   * Test accessibility of automation interface
   */
  async testAutomationAccessibility(): Promise<void> {
    await this.verifyAccessibility();
    
    // Test keyboard navigation through controls
    const focusableElements = [
      this.connectionToggle,
      this.engagementToggle,
      this.startAutomationButton,
      this.pauseAutomationButton
    ];
    
    for (const element of focusableElements) {
      if (await this.elementExists(element)) {
        await this.page.keyboard.press('Tab');
        await this.verifyElementHasFocus(element);
      }
    }
    
    // Test ARIA labels for controls
    const importantControls = [
      this.connectionToggle,
      this.engagementToggle,
      this.currentSafetyScore,
      this.emergencyStopButton
    ];
    
    for (const control of importantControls) {
      if (await this.elementExists(control)) {
        const ariaLabel = await this.page.locator(control).getAttribute('aria-label');
        const ariaLabelledBy = await this.page.locator(control).getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  }

  /**
   * Test responsive design of automation interface
   */
  async testAutomationResponsive(): Promise<void> {
    const viewports = [
      { width: 320, height: 568 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }, // Desktop
    ];

    for (const viewport of viewports) {
      await this.verifyResponsiveDesign(viewport.width, viewport.height);
      
      // Verify key elements are accessible
      await expect(this.page.locator(this.automationDashboard)).toBeVisible();
      await expect(this.page.locator(this.safetyMonitor)).toBeVisible();
      
      if (viewport.width < 768) {
        // Mobile: panels might be stacked or collapsible
        const mobileToggle = this.page.locator('[data-testid="mobile-automation-toggle"]');
        if (await mobileToggle.count() > 0) {
          await expect(mobileToggle).toBeVisible();
        }
      }
    }
  }
}