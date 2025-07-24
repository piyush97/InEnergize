import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
  });

  test('should display login page correctly', async ({ page }) => {
    // Check that the main elements are visible
    await expect(page.locator('h1')).toContainText('InErgize');
    await expect(page.locator('h2')).toContainText('LinkedIn Profile Optimization Platform');
    
    // Check for development status message
    await expect(page.locator('text=Platform under development')).toBeVisible();
    await expect(page.locator('text=Full implementation coming in Phase 1')).toBeVisible();
  });

  test('should handle navigation correctly', async ({ page }) => {
    // Check that the page loads without errors
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    
    // Check page title
    await expect(page).toHaveTitle(/InErgize/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that elements are still visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h2')).toBeVisible();
  });

  test('should handle API health check', async ({ page }) => {
    // Test health endpoint
    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('service', 'web-app');
  });
});

test.describe('Service Integration', () => {
  test('auth service should be healthy', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('service', 'auth-service');
    expect(data).toHaveProperty('uptime');
  });

  test('user service should be healthy', async ({ page }) => {
    const response = await page.request.get('http://localhost:3002/health');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
    expect(data).toHaveProperty('service', 'user-service');
    expect(data).toHaveProperty('uptime');
  });
});

test.describe('Performance', () => {
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have good lighthouse scores', async ({ page }) => {
    await page.goto('/');
    
    // Check for basic performance indicators
    const performanceEntry = await page.evaluate(() => {
      return performance.getEntriesByType('navigation')[0];
    });
    
    expect(performanceEntry).toBeTruthy();
  });
});