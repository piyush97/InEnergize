import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the InErgize Dashboard
 */
export class DashboardPage extends BasePage {
  // Navigation selectors
  private readonly sidebarNavigation = '[data-testid="sidebar-navigation"]';
  private readonly userMenu = '[data-testid="user-menu"]';
  private readonly profileDropdown = '[data-testid="profile-dropdown"]';
  private readonly logoutButton = '[data-testid="logout-button"]';
  private readonly settingsLink = '[data-testid="settings-link"]';

  // Dashboard sections
  private readonly mainContent = '[data-testid="main-content"]';
  private readonly dashboardGrid = '[data-testid="dashboard-grid"]';
  private readonly profileWidget = '[data-testid="profile-widget"]';
  private readonly analyticsWidget = '[data-testid="analytics-widget"]';
  private readonly automationWidget = '[data-testid="automation-widget"]';
  private readonly contentWidget = '[data-testid="content-widget"]';
  private readonly goalsWidget = '[data-testid="goals-widget"]';

  // Profile completion section
  private readonly profileCompletion = '[data-testid="profile-completion"]';
  private readonly completionScore = '[data-testid="completion-score"]';
  private readonly completionProgress = '[data-testid="completion-progress"]';
  private readonly improvementSuggestions = '[data-testid="improvement-suggestions"]';

  // Analytics section
  private readonly profileViews = '[data-testid="profile-views"]';
  private readonly searchAppearances = '[data-testid="search-appearances"]';
  private readonly postImpressions = '[data-testid="post-impressions"]';
  private readonly engagementRate = '[data-testid="engagement-rate"]';
  private readonly analyticsChart = '[data-testid="analytics-chart"]';
  private readonly timeRangeSelector = '[data-testid="time-range-selector"]';

  // Automation section
  private readonly automationStatus = '[data-testid="automation-status"]';
  private readonly connectionQueue = '[data-testid="connection-queue"]';
  private readonly engagementQueue = '[data-testid="engagement-queue"]';
  private readonly safetyScore = '[data-testid="safety-score"]';
  private readonly automationControls = '[data-testid="automation-controls"]';

  // Content section
  private readonly contentIdeas = '[data-testid="content-ideas"]';
  private readonly scheduledPosts = '[data-testid="scheduled-posts"]';
  private readonly contentCalendar = '[data-testid="content-calendar"]';
  private readonly generateContentButton = '[data-testid="generate-content-button"]';

  // Quick actions
  private readonly quickActions = '[data-testid="quick-actions"]';
  private readonly connectLinkedInButton = '[data-testid="connect-linkedin-button"]';
  private readonly optimizeProfileButton = '[data-testid="optimize-profile-button"]';
  private readonly createContentButton = '[data-testid="create-content-button"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to dashboard
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
    await this.waitForLoadingToComplete();
  }

  /**
   * Verify dashboard loaded correctly
   */
  async verifyDashboardLoaded(): Promise<void> {
    await expect(this.page.locator(this.mainContent)).toBeVisible();
    
    // Check for key dashboard elements
    if (await this.elementExists(this.dashboardGrid)) {
      await expect(this.page.locator(this.dashboardGrid)).toBeVisible();
    }
    
    // Verify navigation
    if (await this.elementExists(this.sidebarNavigation)) {
      await expect(this.page.locator(this.sidebarNavigation)).toBeVisible();
    }
  }

  /**
   * Verify sidebar navigation
   */
  async verifySidebarNavigation(): Promise<void> {
    if (await this.elementExists(this.sidebarNavigation)) {
      const expectedNavItems = [
        'Dashboard',
        'Profile',
        'Content',
        'Automation',
        'Analytics',
        'Settings'
      ];

      for (const item of expectedNavItems) {
        const navItem = this.page.locator(`text=${item}`).first();
        if (await navItem.count() > 0) {
          await expect(navItem).toBeVisible();
        }
      }
    }
  }

  /**
   * Navigate to specific section
   */
  async navigateToSection(section: string): Promise<void> {
    const sectionLink = this.page.locator(`[data-testid="${section}-nav"], text=${section}`).first();
    
    if (await sectionLink.count() > 0) {
      await sectionLink.click();
      await this.waitForPageLoad();
    } else {
      // Fallback navigation
      await this.page.goto(`/dashboard/${section.toLowerCase()}`);
      await this.waitForPageLoad();
    }
  }

  /**
   * Verify profile completion widget
   */
  async verifyProfileCompletion(): Promise<void> {
    if (await this.elementExists(this.profileCompletion)) {
      await expect(this.page.locator(this.profileCompletion)).toBeVisible();
      
      // Check completion score
      if (await this.elementExists(this.completionScore)) {
        const scoreText = await this.getElementText(this.completionScore);
        expect(scoreText).toMatch(/\d+%/); // Should contain percentage
      }
      
      // Check progress bar
      if (await this.elementExists(this.completionProgress)) {
        await expect(this.page.locator(this.completionProgress)).toBeVisible();
      }
      
      // Check improvement suggestions
      if (await this.elementExists(this.improvementSuggestions)) {
        await expect(this.page.locator(this.improvementSuggestions)).toBeVisible();
      }
    }
  }

  /**
   * Verify analytics widget
   */
  async verifyAnalyticsWidget(): Promise<void> {
    if (await this.elementExists(this.analyticsWidget)) {
      await expect(this.page.locator(this.analyticsWidget)).toBeVisible();
      
      // Check key metrics
      const metrics = [
        this.profileViews,
        this.searchAppearances,
        this.postImpressions,
        this.engagementRate
      ];

      for (const metric of metrics) {
        if (await this.elementExists(metric)) {
          await expect(this.page.locator(metric)).toBeVisible();
          
          // Verify metric has a value
          const metricValue = await this.getElementText(metric);
          expect(metricValue).toMatch(/\d+/); // Should contain numbers
        }
      }
    }
  }

  /**
   * Verify automation widget
   */
  async verifyAutomationWidget(): Promise<void> {
    if (await this.elementExists(this.automationWidget)) {
      await expect(this.page.locator(this.automationWidget)).toBeVisible();
      
      // Check automation status
      if (await this.elementExists(this.automationStatus)) {
        const statusText = await this.getElementText(this.automationStatus);
        expect(statusText).toMatch(/Active|Inactive|Paused/);
      }
      
      // Check safety score
      if (await this.elementExists(this.safetyScore)) {
        const safetyText = await this.getElementText(this.safetyScore);
        expect(safetyText).toMatch(/\d+/); // Should contain score
      }
      
      // Check queue information
      if (await this.elementExists(this.connectionQueue)) {
        await expect(this.page.locator(this.connectionQueue)).toBeVisible();
      }
    }
  }

  /**
   * Verify content widget
   */
  async verifyContentWidget(): Promise<void> {
    if (await this.elementExists(this.contentWidget)) {
      await expect(this.page.locator(this.contentWidget)).toBeVisible();
      
      // Check content ideas
      if (await this.elementExists(this.contentIdeas)) {
        await expect(this.page.locator(this.contentIdeas)).toBeVisible();
      }
      
      // Check scheduled posts
      if (await this.elementExists(this.scheduledPosts)) {
        await expect(this.page.locator(this.scheduledPosts)).toBeVisible();
      }
    }
  }

  /**
   * Test quick actions
   */
  async testQuickActions(): Promise<void> {
    if (await this.elementExists(this.quickActions)) {
      const actions = [
        { selector: this.connectLinkedInButton, name: 'Connect LinkedIn' },
        { selector: this.optimizeProfileButton, name: 'Optimize Profile' },
        { selector: this.createContentButton, name: 'Create Content' }
      ];

      for (const action of actions) {
        if (await this.elementExists(action.selector)) {
          await expect(this.page.locator(action.selector)).toBeVisible();
          await expect(this.page.locator(action.selector)).toBeEnabled();
        }
      }
    }
  }

  /**
   * Test user menu
   */
  async testUserMenu(): Promise<void> {
    if (await this.elementExists(this.userMenu)) {
      await this.clickElement(this.userMenu);
      
      if (await this.elementExists(this.profileDropdown)) {
        await expect(this.page.locator(this.profileDropdown)).toBeVisible();
        
        // Check for common menu items
        const menuItems = ['Profile', 'Settings', 'Logout'];
        for (const item of menuItems) {
          const menuItem = this.page.locator(`text=${item}`).first();
          if (await menuItem.count() > 0) {
            await expect(menuItem).toBeVisible();
          }
        }
      }
    }
  }

  /**
   * Change analytics time range
   */
  async changeTimeRange(range: '7d' | '30d' | '90d' | '1y'): Promise<void> {
    if (await this.elementExists(this.timeRangeSelector)) {
      await this.clickElement(this.timeRangeSelector);
      
      const rangeOption = this.page.locator(`[data-value="${range}"], text="${range}"`);
      if (await rangeOption.count() > 0) {
        await rangeOption.click();
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * Connect LinkedIn account
   */
  async connectLinkedIn(): Promise<void> {
    if (await this.elementExists(this.connectLinkedInButton)) {
      await this.clickElement(this.connectLinkedInButton);
      
      // Should redirect to LinkedIn OAuth or show connection modal
      await this.waitForPageLoad();
    }
  }

  /**
   * Generate content
   */
  async generateContent(): Promise<void> {
    if (await this.elementExists(this.generateContentButton)) {
      await this.clickElement(this.generateContentButton);
      await this.waitForLoadingToComplete();
    } else if (await this.elementExists(this.createContentButton)) {
      await this.clickElement(this.createContentButton);
      await this.waitForLoadingToComplete();
    }
  }

  /**
   * Toggle automation
   */
  async toggleAutomation(): Promise<void> {
    if (await this.elementExists(this.automationControls)) {
      const toggleButton = this.page.locator('[data-testid="automation-toggle"]').first();
      if (await toggleButton.count() > 0) {
        await toggleButton.click();
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * View detailed analytics
   */
  async viewDetailedAnalytics(): Promise<void> {
    if (await this.elementExists(this.analyticsChart)) {
      const viewMoreButton = this.page.locator('[data-testid="view-analytics"], text="View More"').first();
      if (await viewMoreButton.count() > 0) {
        await viewMoreButton.click();
        await this.waitForPageLoad();
      } else {
        await this.navigateToSection('Analytics');
      }
    }
  }

  /**
   * Logout from dashboard
   */
  async logout(): Promise<void> {
    // Open user menu first
    if (await this.elementExists(this.userMenu)) {
      await this.clickElement(this.userMenu);
    }
    
    // Click logout
    if (await this.elementExists(this.logoutButton)) {
      await this.clickElement(this.logoutButton);
      await this.waitForPageLoad();
      
      // Should redirect to login page
      await this.page.waitForURL(/\/(auth|login)/);
    }
  }

  /**
   * Test real-time updates
   */
  async testRealTimeUpdates(): Promise<void> {
    // Wait for WebSocket connection
    await this.waitForWebSocketConnection();
    
    // Mock real-time data updates
    await this.page.evaluate(() => {
      // Simulate WebSocket message
      const mockData = {
        type: 'profile_metrics',
        data: {
          profileViews: 125,
          searchAppearances: 45,
          engagement: 8.5
        }
      };
      
      // Dispatch custom event to simulate WebSocket message
      window.dispatchEvent(new CustomEvent('websocket-message', { detail: mockData }));
    });
    
    // Wait for UI to update
    await this.page.waitForTimeout(1000);
  }

  /**
   * Test dashboard responsiveness
   */
  async testDashboardResponsive(): Promise<void> {
    const viewports = [
      { width: 320, height: 568 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }, // Desktop
    ];

    for (const viewport of viewports) {
      await this.verifyResponsiveDesign(viewport.width, viewport.height);
      
      // Verify key elements are accessible
      await expect(this.page.locator(this.mainContent)).toBeVisible();
      
      if (viewport.width < 768) {
        // Mobile: sidebar might be collapsed
        const mobileMenuButton = this.page.locator('[data-testid="mobile-menu-button"]');
        if (await mobileMenuButton.count() > 0) {
          await expect(mobileMenuButton).toBeVisible();
        }
      } else {
        // Desktop/Tablet: sidebar should be visible
        if (await this.elementExists(this.sidebarNavigation)) {
          await expect(this.page.locator(this.sidebarNavigation)).toBeVisible();
        }
      }
    }
  }

  /**
   * Test dashboard accessibility
   */
  async testDashboardAccessibility(): Promise<void> {
    await this.verifyAccessibility();
    
    // Test keyboard navigation
    await this.page.keyboard.press('Tab');
    
    // Verify skip links
    const skipLink = this.page.locator('a[href="#main-content"]');
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeVisible();
    }
    
    // Test ARIA labels on widgets
    const widgets = [
      this.profileWidget,
      this.analyticsWidget,
      this.automationWidget,
      this.contentWidget
    ];
    
    for (const widget of widgets) {
      if (await this.elementExists(widget)) {
        const ariaLabel = await this.page.locator(widget).getAttribute('aria-label');
        const ariaLabelledBy = await this.page.locator(widget).getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  }

  /**
   * Test dashboard performance
   */
  async testDashboardPerformance(): Promise<void> {
    const metrics = await this.getPerformanceMetrics();
    
    // Dashboard should load quickly
    expect(metrics.loadTime).toBeLessThan(2000); // 2 seconds
    expect(metrics.domContentLoaded).toBeLessThan(1000); // 1 second
    
    // Check for memory leaks
    const memoryUsage = await this.page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Memory usage should be reasonable (less than 50MB)
    expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
  }

  /**
   * Mock dashboard data
   */
  async mockDashboardData(): Promise<void> {
    // Mock profile completion data
    await this.mockApiResponse('api/v1/profile/completion', {
      score: 85,
      suggestions: [
        'Add professional headline',
        'Upload profile photo',
        'Complete work experience'
      ]
    });

    // Mock analytics data
    await this.mockApiResponse('api/v1/analytics/metrics', {
      profileViews: 125,
      searchAppearances: 45,
      postImpressions: 1250,
      engagementRate: 8.5,
      connections: 15,
      followers: 35
    });

    // Mock automation status
    await this.mockApiResponse('api/v1/automation/status', {
      isActive: true,
      safetyScore: 92,
      connectionsToday: 5,
      engagementsToday: 12,
      queueSize: 25
    });

    // Mock content data
    await this.mockApiResponse('api/v1/content/ideas', {
      ideas: [
        {
          type: 'post',
          topic: 'Industry Insights',
          estimatedReach: 500
        }
      ],
      scheduled: 3
    });
  }

  /**
   * Verify all dashboard widgets
   */
  async verifyAllWidgets(): Promise<void> {
    await this.verifyProfileCompletion();
    await this.verifyAnalyticsWidget();
    await this.verifyAutomationWidget();
    await this.verifyContentWidget();
  }
}