import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Enhanced Playwright configuration for InErgize E2E testing
 * Supports multi-browser testing, responsive design, and accessibility validation
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 4,
  
  /* Maximum failures before aborting */
  maxFailures: process.env.CI ? 10 : 5,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['blob', { outputDir: 'test-results/blob-report' }],
    ...(process.env.CI ? [['github']] : [['list']]),
  ],
  
  /* Global test timeout */
  timeout: 60 * 1000, // 60 seconds for comprehensive tests
  
  /* Expect timeout */
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Browser context options */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    /* Navigation timeout */
    navigationTimeout: 30 * 1000,
    
    /* Action timeout */
    actionTimeout: 10 * 1000,
    
    /* API request context */
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    
    /* Locale and timezone */
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    /* Permissions */
    permissions: ['notifications'],
    
    /* Service Workers */
    serviceWorkers: 'allow',
  },

  /* Configure projects for comprehensive browser and device testing */
  projects: [
    // Setup project for authentication and data preparation
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup',
    },
    
    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /global\.teardown\.ts/,
    },

    // Desktop browsers - Core functionality
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
    },

    // Branded browsers
    {
      name: 'chrome-branded',
      use: { 
        ...devices['Desktop Chrome'], 
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['setup'],
    },
    
    {
      name: 'edge-branded',
      use: { 
        ...devices['Desktop Edge'], 
        channel: 'msedge',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['setup'],
    },

    // Tablet viewports
    {
      name: 'tablet-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,
      },
      dependencies: ['setup'],
    },

    {
      name: 'tablet-safari',
      use: { 
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
      },
      dependencies: ['setup'],
    },

    // Mobile devices - Critical user journeys only
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },
      },
      dependencies: ['setup'],
      testMatch: /.*\.(mobile|responsive)\.spec\.ts/,
    },
    
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 13 Pro'],
        viewport: { width: 390, height: 844 },
      },
      dependencies: ['setup'],
      testMatch: /.*\.(mobile|responsive)\.spec\.ts/,
    },

    // Small mobile screens
    {
      name: 'mobile-small',
      use: { 
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 },
      },
      dependencies: ['setup'],
      testMatch: /.*responsive\.spec\.ts/,
    },

    // Accessibility testing
    {
      name: 'accessibility',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        colorScheme: 'light',
      },
      dependencies: ['setup'],
      testMatch: /.*accessibility\.spec\.ts/,
    },

    // High contrast mode testing
    {
      name: 'high-contrast',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        forcedColors: 'active',
      },
      dependencies: ['setup'],
      testMatch: /.*accessibility\.spec\.ts/,
    },

    // Performance testing
    {
      name: 'performance',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      testMatch: /.*performance\.spec\.ts/,
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    // Start infrastructure services
    {
      command: 'docker-compose up -d postgres timescale redis elasticsearch',
      port: 5432,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
    // Start backend services
    {
      command: 'npm run dev:services',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        JWT_SECRET: 'test-jwt-secret-key-for-e2e-testing',
        LINKEDIN_CLIENT_ID: 'test-linkedin-client-id',
        LINKEDIN_CLIENT_SECRET: 'test-linkedin-client-secret',
      },
    },
    // Start web application
    {
      command: 'npm run dev:web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:3007',
      },
    },
  ],
  
  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/setup/global-setup.ts'),
  globalTeardown: require.resolve('./tests/setup/global-teardown.ts'),
  
  /* Output directory for test artifacts */
  outputDir: 'test-results/',
  
  /* Test metadata directory */
  metadata: {
    'test-results': 'test-results/',
    'screenshots': 'test-results/screenshots/',
    'videos': 'test-results/videos/',
    'traces': 'test-results/traces/',
  },
  
  /* Test data directory */
  testIgnore: [
    'node_modules/**',
    'dist/**',
    'coverage/**',
    '**/*.d.ts',
    'test-results/**',
  ],
  
  /* Test match patterns */
  testMatch: [
    '**/tests/e2e/**/*.spec.ts',
    '**/tests/e2e/**/*.test.ts',
  ],
  
  /* Grep patterns for test organization */
  grep: process.env.PLAYWRIGHT_GREP ? new RegExp(process.env.PLAYWRIGHT_GREP) : undefined,
  grepInvert: process.env.PLAYWRIGHT_GREP_INVERT ? new RegExp(process.env.PLAYWRIGHT_GREP_INVERT) : undefined,
});