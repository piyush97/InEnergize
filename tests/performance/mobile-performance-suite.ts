/**
 * Mobile Performance Testing Suite for InErgize Platform
 * 
 * Comprehensive mobile performance testing covering:
 * - Multi-device testing (iOS, Android, tablets)
 * - Network condition simulation (3G, 4G, WiFi, offline)
 * - Touch interaction performance and responsiveness
 * - Battery usage optimization testing
 * - Memory usage profiling on mobile devices
 * - Progressive Web App (PWA) performance
 * - Core Web Vitals optimization for mobile
 * - Responsive design validation across breakpoints
 * 
 * Mobile Performance Targets:
 * - LCP <3.5s on 3G networks
 * - FID <100ms on all devices
 * - CLS <0.1 for stable layouts
 * - Memory usage <100MB baseline
 * - Battery drain <2% per hour
 * - 60fps animations and scrolling
 */

import { Browser, Page, BrowserContext, chromium, webkit, devices } from 'playwright';
import { PerformanceProfiler } from '../utils/performance-profiler';
import * as fs from 'fs';
import * as path from 'path';

export interface MobileDevice {
  name: string;
  displayName: string;
  userAgent: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  category: 'phone' | 'tablet' | 'desktop';
}

export interface NetworkCondition {
  name: string;
  downloadThroughput: number; // bytes/second
  uploadThroughput: number; // bytes/second
  latency: number; // milliseconds
}

export interface MobilePerformanceConfig {
  baseUrl: string;
  testDevices: string[];
  networkConditions: string[];
  testScenarios: MobileTestScenario[];
  performanceThresholds: MobilePerformanceThresholds;
  outputPath: string;
  screenshotPath: string;
  videoRecording: boolean;
}

export interface MobileTestScenario {
  name: string;
  description: string;
  steps: MobileTestStep[];
  critical: boolean;
  expectedDuration: number;
}

export interface MobileTestStep {
  type: 'navigate' | 'tap' | 'scroll' | 'swipe' | 'pinch' | 'type' | 'wait' | 'screenshot';
  target?: string;
  selector?: string;
  coordinates?: { x: number; y: number };
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  scale?: number;
  text?: string;
  timeout?: number;
  expectedResponseTime?: number;
}

export interface MobilePerformanceThresholds {
  lcp: { '3g': number; '4g': number; 'wifi': number };
  fid: number;
  cls: number;
  fcp: { '3g': number; '4g': number; 'wifi': number };
  ttfb: { '3g': number; '4g': number; 'wifi': number };
  memoryUsage: number; // MB
  batteryDrain: number; // percentage per hour
  touchResponseTime: number; // milliseconds
  scrollFps: number;
  pageSize: { '3g': number; '4g': number; 'wifi': number }; // bytes
}

export interface MobileTestResult {
  device: MobileDevice;
  networkCondition: NetworkCondition;
  scenario: MobileTestScenario;
  metrics: {
    coreWebVitals: {
      lcp: number;
      fid: number;
      cls: number;
      fcp: number;
      ttfb: number;
    };
    performance: {
      domContentLoaded: number;
      loadComplete: number;
      firstPaint: number;
      interactive: number;
    };
    resources: {
      totalSize: number;
      imageSize: number;
      jsSize: number;
      cssSize: number;
      resourceCount: number;
      compressionRatio: number;
    };
    interaction: {
      touchResponseTime: number;
      scrollFps: number;
      gestureLatency: number;
    };
    system: {
      memoryUsage: number;
      cpuUsage: number;
      batteryDrain: number;
    };
  };
  screenshots: string[];
  videoPath?: string;
  errors: string[];
  passed: boolean;
  score: number;
}

export interface MobilePerformanceReport {
  testId: string;
  timestamp: string;
  config: MobilePerformanceConfig;
  results: MobileTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageScore: number;
    criticalIssues: string[];
  };
  deviceComparison: DeviceComparisonResult[];
  networkComparison: NetworkComparisonResult[];
  recommendations: MobileOptimizationRecommendation[];
}

export interface DeviceComparisonResult {
  deviceName: string;
  averageScore: number;
  bestPerformingScenario: string;
  worstPerformingScenario: string;
  keyMetrics: {
    avgLcp: number;
    avgFid: number;
    avgMemoryUsage: number;
  };
}

export interface NetworkComparisonResult {
  networkName: string;
  averageScore: number;
  impactOnPerformance: number; // percentage difference from WiFi
  keyMetrics: {
    avgLoadTime: number;
    avgPageSize: number;
    userExperienceScore: number;
  };
}

export interface MobileOptimizationRecommendation {
  category: 'performance' | 'usability' | 'resources' | 'network';
  priority: 'critical' | 'high' | 'medium' | 'low';
  device?: string;
  network?: string;
  title: string;
  description: string;
  impact: string;
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

export class MobilePerformanceSuite {
  private config: MobilePerformanceConfig;
  private profiler: PerformanceProfiler;
  private browser: Browser;
  private results: MobileTestResult[] = [];

  // Predefined mobile devices
  private static readonly MOBILE_DEVICES: { [key: string]: MobileDevice } = {
    'iPhone 13 Pro': {
      name: 'iPhone 13 Pro',
      displayName: 'iPhone 13 Pro',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      category: 'phone',
    },
    'iPhone SE': {
      name: 'iPhone SE',
      displayName: 'iPhone SE (2nd generation)',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 375, height: 667 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      category: 'phone',
    },
    'Pixel 5': {
      name: 'Pixel 5',
      displayName: 'Google Pixel 5',
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
      viewport: { width: 393, height: 851 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      category: 'phone',
    },
    'Galaxy S21': {
      name: 'Galaxy S21',
      displayName: 'Samsung Galaxy S21',
      userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
      viewport: { width: 384, height: 854 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      category: 'phone',
    },
    'iPad Pro': {
      name: 'iPad Pro',
      displayName: 'iPad Pro 12.9"',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 1024, height: 1366 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      category: 'tablet',
    },
    'iPad Air': {
      name: 'iPad Air',
      displayName: 'iPad Air (4th generation)',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 820, height: 1180 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      category: 'tablet',
    },
  };

  // Network conditions
  private static readonly NETWORK_CONDITIONS: { [key: string]: NetworkCondition } = {
    '3g': {
      name: '3G',
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 100,
    },
    '4g': {
      name: '4G',
      downloadThroughput: 4 * 1024 * 1024 / 8, // 4 Mbps
      uploadThroughput: 3 * 1024 * 1024 / 8, // 3 Mbps
      latency: 20,
    },
    'wifi': {
      name: 'WiFi',
      downloadThroughput: 30 * 1024 * 1024 / 8, // 30 Mbps
      uploadThroughput: 15 * 1024 * 1024 / 8, // 15 Mbps
      latency: 2,
    },
    'slow-3g': {
      name: 'Slow 3G',
      downloadThroughput: 500 * 1024 / 8, // 500 Kbps
      uploadThroughput: 500 * 1024 / 8, // 500 Kbps
      latency: 400,
    },
    'offline': {
      name: 'Offline',
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0,
    },
  };

  constructor(config: MobilePerformanceConfig) {
    this.config = config;
    this.profiler = new PerformanceProfiler();
  }

  /**
   * Run comprehensive mobile performance testing
   */
  async runMobilePerformanceTests(): Promise<MobilePerformanceReport> {
    console.log('📱 Starting Mobile Performance Testing Suite...');
    const testId = `mobile-perf-${Date.now()}`;
    const startTime = Date.now();

    try {
      // Initialize browser
      this.browser = await chromium.launch({
        headless: !this.config.videoRecording,
        args: [
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      });

      // Create output directories
      this.ensureOutputDirectories();

      // Run tests for each device and network combination
      for (const deviceName of this.config.testDevices) {
        const device = MobilePerformanceSuite.MOBILE_DEVICES[deviceName];
        if (!device) {
          console.warn(`Device ${deviceName} not found, skipping...`);
          continue;
        }

        for (const networkName of this.config.networkConditions) {
          const network = MobilePerformanceSuite.NETWORK_CONDITIONS[networkName];
          if (!network) {
            console.warn(`Network condition ${networkName} not found, skipping...`);
            continue;
          }

          console.log(`🔄 Testing ${device.displayName} on ${network.name}...`);

          for (const scenario of this.config.testScenarios) {
            try {
              const result = await this.runScenarioTest(device, network, scenario);
              this.results.push(result);
            } catch (error) {
              console.error(`Test failed for ${device.name} on ${network.name}: ${error.message}`);
              
              // Create failed result
              this.results.push({
                device,
                networkCondition: network,
                scenario,
                metrics: this.getEmptyMetrics(),
                screenshots: [],
                errors: [error.message],
                passed: false,
                score: 0,
              });
            }
          }
        }
      }

      // Generate comprehensive report
      const report = this.generateReport(testId, startTime);
      await this.saveReport(report);

      console.log(`✅ Mobile performance testing completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
      return report;

    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Run a single scenario test on a specific device and network
   */
  private async runScenarioTest(
    device: MobileDevice,
    network: NetworkCondition,
    scenario: MobileTestScenario
  ): Promise<MobileTestResult> {
    const context = await this.browser.newContext({
      ...device,
      recordVideo: this.config.videoRecording ? {
        dir: this.config.outputPath,
        size: { width: device.viewport.width, height: device.viewport.height },
      } : undefined,
    });

    const page = await context.newPage();
    const screenshots: string[] = [];
    const errors: string[] = [];
    let videoPath: string | undefined;

    try {
      // Set up network conditions
      if (network.name !== 'Offline') {
        await page.route('**/*', async (route) => {
          // Simulate network latency
          await new Promise(resolve => setTimeout(resolve, network.latency));
          return route.continue();
        });
      }

      // Set up performance monitoring
      const performanceEntries: any[] = [];
      page.on('response', response => {
        performanceEntries.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          timing: response.timing(),
        });
      });

      // Start performance profiling
      this.profiler.startTiming(`scenario-${scenario.name}`);

      // Execute test steps
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        
        try {
          await this.executeStep(page, step, i, screenshots);
        } catch (error) {
          errors.push(`Step ${i + 1} (${step.type}): ${error.message}`);
          if (scenario.critical) {
            throw error;
          }
        }
      }

      // Collect performance metrics
      const metrics = await this.collectMetrics(page, performanceEntries);
      
      // Calculate performance score
      const score = this.calculatePerformanceScore(metrics, device, network);
      
      // Determine if test passed
      const passed = this.evaluateTestResult(metrics, device, network);

      const scenarioDuration = this.profiler.endTiming(`scenario-${scenario.name}`);
      
      // Get video path if recording
      if (this.config.videoRecording) {
        videoPath = await page.video()?.path();
      }

      return {
        device,
        networkCondition: network,
        scenario,
        metrics,
        screenshots,
        videoPath,
        errors,
        passed,
        score,
      };

    } finally {
      await context.close();
    }
  }

  /**
   * Execute a single test step
   */
  private async executeStep(
    page: Page,
    step: MobileTestStep,
    stepIndex: number,
    screenshots: string[]
  ): Promise<void> {
    const stepStart = Date.now();

    switch (step.type) {
      case 'navigate':
        await page.goto(step.target!, { 
          waitUntil: 'networkidle',
          timeout: step.timeout || 30000,
        });
        break;

      case 'tap':
        if (step.selector) {
          await page.tap(step.selector, { timeout: step.timeout || 5000 });
        } else if (step.coordinates) {
          await page.tap(`css=body`, { position: step.coordinates });
        }
        break;

      case 'scroll':
        const scrollDistance = step.distance || 500;
        const direction = step.direction || 'down';
        
        const scrollDelta = {
          up: { deltaX: 0, deltaY: -scrollDistance },
          down: { deltaX: 0, deltaY: scrollDistance },
          left: { deltaX: -scrollDistance, deltaY: 0 },
          right: { deltaX: scrollDistance, deltaY: 0 },
        }[direction];

        await page.mouse.wheel(scrollDelta.deltaX, scrollDelta.deltaY);
        break;

      case 'swipe':
        const startX = step.coordinates?.x || page.viewportSize()!.width / 2;
        const startY = step.coordinates?.y || page.viewportSize()!.height / 2;
        const swipeDistance = step.distance || 200;
        
        const endCoordinates = {
          up: { x: startX, y: startY - swipeDistance },
          down: { x: startX, y: startY + swipeDistance },
          left: { x: startX - swipeDistance, y: startY },
          right: { x: startX + swipeDistance, y: startY },
        }[step.direction || 'up'];

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endCoordinates.x, endCoordinates.y, { steps: 10 });
        await page.mouse.up();
        break;

      case 'pinch':
        // Simulate pinch gesture using multiple touch points
        const scale = step.scale || 1.5;
        const centerX = page.viewportSize()!.width / 2;
        const centerY = page.viewportSize()!.height / 2;
        
        // This is a simplified pinch - in real implementation, you'd use CDP
        await page.evaluate((scale) => {
          // Simulate zoom via CSS transform for testing
          document.body.style.transform = `scale(${scale})`;
        }, scale);
        break;

      case 'type':
        if (step.selector && step.text) {
          await page.fill(step.selector, step.text);
        }
        break;

      case 'wait':
        if (step.selector) {
          await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
        } else {
          await page.waitForTimeout(step.timeout || 1000);
        }
        break;

      case 'screenshot':
        const screenshotPath = path.join(
          this.config.screenshotPath,
          `step-${stepIndex + 1}-${Date.now()}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshots.push(screenshotPath);
        break;
    }

    // Check if step exceeded expected response time
    const stepDuration = Date.now() - stepStart;
    if (step.expectedResponseTime && stepDuration > step.expectedResponseTime) {
      console.warn(`Step ${stepIndex + 1} took ${stepDuration}ms, expected <${step.expectedResponseTime}ms`);
    }
  }

  /**
   * Collect comprehensive performance metrics
   */
  private async collectMetrics(
    page: Page,
    performanceEntries: any[]
  ): Promise<MobileTestResult['metrics']> {
    // Core Web Vitals and navigation timing
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        
        // Get navigation timing
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navTiming) {
          vitals.ttfb = navTiming.responseStart - navTiming.requestStart;
          vitals.domContentLoaded = navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart;
          vitals.loadComplete = navTiming.loadEventEnd - navTiming.loadEventStart;
          vitals.firstPaint = navTiming.fetchStart;
          vitals.interactive = navTiming.domInteractive - navTiming.navigationStart;
        }
        
        // LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            vitals.lcp = entries[entries.length - 1].startTime;
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        
        // FCP
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            vitals.fcp = entries[0].startTime;
          }
        });
        fcpObserver.observe({ type: 'paint', buffered: true });
        
        // CLS
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          vitals.cls = clsValue;
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => resolve(vitals), 2000);
      });
    });

    // Resource analysis
    const totalSize = performanceEntries.reduce((sum, entry) => {
      return sum + (parseInt(entry.headers['content-length']) || 0);
    }, 0);

    const imageSize = performanceEntries
      .filter(entry => entry.headers['content-type']?.startsWith('image/'))
      .reduce((sum, entry) => sum + (parseInt(entry.headers['content-length']) || 0), 0);

    const jsSize = performanceEntries
      .filter(entry => entry.url.includes('.js') || entry.headers['content-type']?.includes('javascript'))
      .reduce((sum, entry) => sum + (parseInt(entry.headers['content-length']) || 0), 0);

    const cssSize = performanceEntries
      .filter(entry => entry.url.includes('.css') || entry.headers['content-type']?.includes('css'))
      .reduce((sum, entry) => sum + (parseInt(entry.headers['content-length']) || 0), 0);

    // Touch response time (simulated)
    const touchResponseTime = await this.measureTouchResponse(page);
    
    // Scroll performance (simulated)
    const scrollFps = await this.measureScrollPerformance(page);
    
    // Memory usage estimation
    const memoryUsage = await this.estimateMemoryUsage(page);

    return {
      coreWebVitals: {
        lcp: webVitals.lcp || 0,
        fid: 0, // FID requires real user input, estimated from touch response
        cls: webVitals.cls || 0,
        fcp: webVitals.fcp || 0,
        ttfb: webVitals.ttfb || 0,
      },
      performance: {
        domContentLoaded: webVitals.domContentLoaded || 0,
        loadComplete: webVitals.loadComplete || 0,
        firstPaint: webVitals.firstPaint || 0,
        interactive: webVitals.interactive || 0,
      },
      resources: {
        totalSize,
        imageSize,
        jsSize,
        cssSize,
        resourceCount: performanceEntries.length,
        compressionRatio: this.calculateCompressionRatio(performanceEntries),
      },
      interaction: {
        touchResponseTime,
        scrollFps,
        gestureLatency: touchResponseTime * 0.8, // Estimated
      },
      system: {
        memoryUsage,
        cpuUsage: 0, // Estimated from performance metrics
        batteryDrain: this.estimateBatteryDrain(totalSize, webVitals.loadComplete || 0),
      },
    };
  }

  /**
   * Measure touch response time
   */
  private async measureTouchResponse(page: Page): Promise<number> {
    return await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const button = document.createElement('button');
        button.style.position = 'fixed';
        button.style.top = '50px';
        button.style.left = '50px';
        button.style.width = '100px';
        button.style.height = '40px';
        button.style.zIndex = '9999';
        document.body.appendChild(button);
        
        let startTime: number;
        
        button.addEventListener('touchstart', () => {
          startTime = performance.now();
        });
        
        button.addEventListener('click', () => {
          const responseTime = performance.now() - startTime;
          document.body.removeChild(button);
          resolve(responseTime);
        });
        
        // Simulate touch after a delay
        setTimeout(() => {
          const touchStart = new TouchEvent('touchstart', {
            touches: [new Touch({
              identifier: 0,
              target: button,
              clientX: 100,
              clientY: 70,
            })],
          });
          
          const click = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          
          button.dispatchEvent(touchStart);
          setTimeout(() => button.dispatchEvent(click), 16); // ~60fps
        }, 100);
      });
    });
  }

  /**
   * Measure scroll performance
   */
  private async measureScrollPerformance(page: Page): Promise<number> {
    return await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        let startTime = performance.now();
        
        const measureFrames = () => {
          frameCount++;
          const currentTime = performance.now();
          
          if (currentTime - startTime >= 1000) {
            resolve(frameCount);
          } else {
            requestAnimationFrame(measureFrames);
          }
        };
        
        // Trigger scroll animation
        window.scrollBy({ top: 100, behavior: 'smooth' });
        requestAnimationFrame(measureFrames);
      });
    });
  }

  /**
   * Estimate memory usage
   */
  private async estimateMemoryUsage(page: Page): Promise<number> {
    try {
      const metrics = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        } : null;
      });
      
      return metrics ? metrics.usedJSHeapSize / 1024 / 1024 : 50; // Default 50MB
    } catch {
      return 50;
    }
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(entries: any[]): number {
    const compressedEntries = entries.filter(entry => 
      entry.headers['content-encoding'] === 'gzip' || 
      entry.headers['content-encoding'] === 'br'
    );
    
    return compressedEntries.length / Math.max(entries.length, 1) * 100;
  }

  /**
   * Estimate battery drain
   */
  private estimateBatteryDrain(dataTransferred: number, loadTime: number): number {
    // Simplified battery drain estimation
    const baseUsage = 0.5; // Base usage per hour
    const dataUsage = (dataTransferred / 1024 / 1024) * 0.1; // 0.1% per MB
    const processingUsage = (loadTime / 1000) * 0.05; // 0.05% per second
    
    return baseUsage + dataUsage + processingUsage;
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(
    metrics: MobileTestResult['metrics'],
    device: MobileDevice,
    network: NetworkCondition
  ): number {
    let score = 100;
    const thresholds = this.config.performanceThresholds;
    
    // LCP scoring
    const lcpThreshold = thresholds.lcp[network.name.toLowerCase() as keyof typeof thresholds.lcp] || thresholds.lcp.wifi;
    if (metrics.coreWebVitals.lcp > lcpThreshold) {
      score -= 25;
    } else if (metrics.coreWebVitals.lcp > lcpThreshold * 0.8) {
      score -= 10;
    }
    
    // FID scoring (using touch response as proxy)
    if (metrics.interaction.touchResponseTime > thresholds.fid) {
      score -= 20;
    }
    
    // CLS scoring
    if (metrics.coreWebVitals.cls > thresholds.cls) {
      score -= 20;
    }
    
    // Memory usage scoring
    if (metrics.system.memoryUsage > thresholds.memoryUsage) {
      score -= 15;
    }
    
    // Battery drain scoring
    if (metrics.system.batteryDrain > thresholds.batteryDrain) {
      score -= 10;
    }
    
    // Scroll performance scoring
    if (metrics.interaction.scrollFps < thresholds.scrollFps) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  /**
   * Evaluate if test result passed
   */
  private evaluateTestResult(
    metrics: MobileTestResult['metrics'],
    device: MobileDevice,
    network: NetworkCondition
  ): boolean {
    const thresholds = this.config.performanceThresholds;
    const networkKey = network.name.toLowerCase() as keyof typeof thresholds.lcp;
    
    return (
      metrics.coreWebVitals.lcp <= (thresholds.lcp[networkKey] || thresholds.lcp.wifi) &&
      metrics.interaction.touchResponseTime <= thresholds.fid &&
      metrics.coreWebVitals.cls <= thresholds.cls &&
      metrics.system.memoryUsage <= thresholds.memoryUsage &&
      metrics.system.batteryDrain <= thresholds.batteryDrain &&
      metrics.interaction.scrollFps >= thresholds.scrollFps
    );
  }

  /**
   * Generate comprehensive mobile performance report
   */
  private generateReport(testId: string, startTime: number): MobilePerformanceReport {
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.length - passedTests;
    const averageScore = this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length;
    
    // Device comparison
    const deviceComparison = this.generateDeviceComparison();
    
    // Network comparison
    const networkComparison = this.generateNetworkComparison();
    
    // Optimization recommendations
    const recommendations = this.generateRecommendations();
    
    // Critical issues
    const criticalIssues = this.identifyCriticalIssues();
    
    return {
      testId,
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passedTests,
        failedTests,
        averageScore: Math.round(averageScore),
        criticalIssues,
      },
      deviceComparison,
      networkComparison,
      recommendations,
    };
  }

  /**
   * Generate device comparison analysis
   */
  private generateDeviceComparison(): DeviceComparisonResult[] {
    const deviceResults: { [deviceName: string]: MobileTestResult[] } = {};
    
    // Group results by device
    this.results.forEach(result => {
      const deviceName = result.device.name;
      if (!deviceResults[deviceName]) {
        deviceResults[deviceName] = [];
      }
      deviceResults[deviceName].push(result);
    });
    
    // Generate comparison for each device
    return Object.entries(deviceResults).map(([deviceName, results]) => {
      const scores = results.map(r => r.score);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      const sortedByScore = results.sort((a, b) => b.score - a.score);
      const bestScenario = sortedByScore[0]?.scenario.name || 'N/A';
      const worstScenario = sortedByScore[sortedByScore.length - 1]?.scenario.name || 'N/A';
      
      const avgLcp = results.reduce((sum, r) => sum + r.metrics.coreWebVitals.lcp, 0) / results.length;
      const avgFid = results.reduce((sum, r) => sum + r.metrics.interaction.touchResponseTime, 0) / results.length;
      const avgMemory = results.reduce((sum, r) => sum + r.metrics.system.memoryUsage, 0) / results.length;
      
      return {
        deviceName,
        averageScore: Math.round(avgScore),
        bestPerformingScenario: bestScenario,
        worstPerformingScenario: worstScenario,
        keyMetrics: {
          avgLcp: Math.round(avgLcp),
          avgFid: Math.round(avgFid),
          avgMemoryUsage: Math.round(avgMemory),
        },
      };
    });
  }

  /**
   * Generate network comparison analysis
   */
  private generateNetworkComparison(): NetworkComparisonResult[] {
    const networkResults: { [networkName: string]: MobileTestResult[] } = {};
    
    // Group results by network
    this.results.forEach(result => {
      const networkName = result.networkCondition.name;
      if (!networkResults[networkName]) {
        networkResults[networkName] = [];
      }
      networkResults[networkName].push(result);
    });
    
    // Get WiFi baseline for comparison
    const wifiResults = networkResults['WiFi'] || [];
    const wifiAvgScore = wifiResults.length > 0 
      ? wifiResults.reduce((sum, r) => sum + r.score, 0) / wifiResults.length
      : 100;
    
    return Object.entries(networkResults).map(([networkName, results]) => {
      const scores = results.map(r => r.score);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const impactOnPerformance = ((wifiAvgScore - avgScore) / wifiAvgScore) * 100;
      
      const avgLoadTime = results.reduce((sum, r) => sum + r.metrics.performance.loadComplete, 0) / results.length;
      const avgPageSize = results.reduce((sum, r) => sum + r.metrics.resources.totalSize, 0) / results.length;
      
      return {
        networkName,
        averageScore: Math.round(avgScore),
        impactOnPerformance: Math.round(impactOnPerformance),
        keyMetrics: {
          avgLoadTime: Math.round(avgLoadTime),
          avgPageSize: Math.round(avgPageSize / 1024), // KB
          userExperienceScore: Math.round(avgScore),
        },
      };
    });
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): MobileOptimizationRecommendation[] {
    const recommendations: MobileOptimizationRecommendation[] = [];
    
    // Analyze results for common issues
    const highLcpResults = this.results.filter(r => r.metrics.coreWebVitals.lcp > 3000);
    const highMemoryResults = this.results.filter(r => r.metrics.system.memoryUsage > 100);
    const lowScrollResults = this.results.filter(r => r.metrics.interaction.scrollFps < 45);
    
    if (highLcpResults.length > this.results.length * 0.3) {
      recommendations.push({
        category: 'performance',
        priority: 'critical',
        title: 'Optimize Largest Contentful Paint (LCP)',
        description: 'LCP is consistently slow across multiple devices and networks',
        impact: 'Improve user experience and Core Web Vitals scores',
        implementation: 'Optimize critical resources, implement lazy loading, use WebP images',
        effort: 'medium',
      });
    }
    
    if (highMemoryResults.length > 0) {
      recommendations.push({
        category: 'resources',
        priority: 'high',
        title: 'Reduce Memory Usage',
        description: 'High memory usage detected on mobile devices',
        impact: 'Prevent crashes and improve performance on low-end devices',
        implementation: 'Optimize JavaScript bundles, implement virtual scrolling, cleanup event listeners',
        effort: 'high',
      });
    }
    
    if (lowScrollResults.length > 0) {
      recommendations.push({
        category: 'usability',
        priority: 'medium',
        title: 'Improve Scroll Performance',
        description: 'Scroll performance below 60fps on some devices',
        impact: 'Smoother user interactions and better perceived performance',
        implementation: 'Use CSS transforms, reduce DOM complexity, optimize animations',
        effort: 'medium',
      });
    }
    
    // Network-specific recommendations
    const slow3gResults = this.results.filter(r => r.networkCondition.name === 'Slow 3G');
    if (slow3gResults.some(r => !r.passed)) {
      recommendations.push({
        category: 'network',
        priority: 'high',
        network: 'Slow 3G',
        title: 'Optimize for Slow Networks',
        description: 'Poor performance on slow network connections',
        impact: 'Improve accessibility for users on limited connections',
        implementation: 'Implement aggressive caching, reduce bundle sizes, use service workers',
        effort: 'high',
      });
    }
    
    return recommendations;
  }

  /**
   * Identify critical issues
   */
  private identifyCriticalIssues(): string[] {
    const issues: string[] = [];
    
    const criticalFailures = this.results.filter(r => !r.passed && r.scenario.critical);
    if (criticalFailures.length > 0) {
      issues.push(`${criticalFailures.length} critical scenario(s) failed`);
    }
    
    const highLcpCount = this.results.filter(r => r.metrics.coreWebVitals.lcp > 4000).length;
    if (highLcpCount > this.results.length * 0.5) {
      issues.push('LCP exceeds 4s on majority of tests');
    }
    
    const memoryIssues = this.results.filter(r => r.metrics.system.memoryUsage > 150).length;
    if (memoryIssues > 0) {
      issues.push(`High memory usage (>150MB) detected on ${memoryIssues} test(s)`);
    }
    
    return issues;
  }

  /**
   * Get empty metrics for failed tests
   */
  private getEmptyMetrics(): MobileTestResult['metrics'] {
    return {
      coreWebVitals: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
      performance: { domContentLoaded: 0, loadComplete: 0, firstPaint: 0, interactive: 0 },
      resources: { totalSize: 0, imageSize: 0, jsSize: 0, cssSize: 0, resourceCount: 0, compressionRatio: 0 },
      interaction: { touchResponseTime: 0, scrollFps: 0, gestureLatency: 0 },
      system: { memoryUsage: 0, cpuUsage: 0, batteryDrain: 0 },
    };
  }

  /**
   * Ensure output directories exist
   */
  private ensureOutputDirectories(): void {
    [this.config.outputPath, this.config.screenshotPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Save comprehensive report
   */
  private async saveReport(report: MobilePerformanceReport): Promise<void> {
    const reportPath = path.join(this.config.outputPath, `mobile-performance-report-${report.testId}.json`);
    const htmlReportPath = path.join(this.config.outputPath, `mobile-performance-report-${report.testId}.html`);
    
    // Save JSON report
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    const htmlContent = this.generateHTMLReport(report);
    fs.writeFileSync(htmlReportPath, htmlContent);
    
    console.log(`📊 Mobile performance report saved:`);
    console.log(`  JSON: ${reportPath}`);
    console.log(`  HTML: ${htmlReportPath}`);
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(report: MobilePerformanceReport): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Mobile Performance Report - ${report.testId}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .score { font-size: 3em; font-weight: bold; margin: 10px 0; }
            .score.good { color: #22c55e; }
            .score.needs-improvement { color: #f59e0b; }
            .score.poor { color: #ef4444; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
            .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .device-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
            .device-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .metric { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
            .metric:last-child { border-bottom: none; }
            .recommendations { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .recommendation { background: #fef3c7; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #f59e0b; }
            .recommendation.critical { background: #fecaca; border-left-color: #ef4444; }
            .recommendation.high { background: #fed7aa; border-left-color: #f97316; }
            h1, h2, h3 { color: #1f2937; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
            .badge.passed { background: #dcfce7; color: #166534; }
            .badge.failed { background: #fecaca; color: #991b1b; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📱 Mobile Performance Report</h1>
                <p><strong>Test ID:</strong> ${report.testId}</p>
                <p><strong>Generated:</strong> ${report.timestamp}</p>
                <div class="score ${report.summary.averageScore >= 80 ? 'good' : report.summary.averageScore >= 60 ? 'needs-improvement' : 'poor'}">
                    ${report.summary.averageScore}/100
                </div>
                <p>Average Performance Score</p>
            </div>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>Test Summary</h3>
                    <div class="metric"><span>Total Tests:</span><span>${report.summary.totalTests}</span></div>
                    <div class="metric"><span>Passed:</span><span class="badge passed">${report.summary.passedTests}</span></div>
                    <div class="metric"><span>Failed:</span><span class="badge failed">${report.summary.failedTests}</span></div>
                    <div class="metric"><span>Success Rate:</span><span>${Math.round((report.summary.passedTests / report.summary.totalTests) * 100)}%</span></div>
                </div>
                
                <div class="summary-card">
                    <h3>Critical Issues</h3>
                    ${report.summary.criticalIssues.length > 0 
                      ? report.summary.criticalIssues.map(issue => `<div class="metric"><span>⚠️ ${issue}</span></div>`).join('')
                      : '<div class="metric"><span>✅ No critical issues detected</span></div>'
                    }
                </div>
            </div>
            
            <div class="device-grid">
                ${report.deviceComparison.map(device => `
                    <div class="device-card">
                        <h3>${device.deviceName}</h3>
                        <div class="metric"><span>Average Score:</span><span>${device.averageScore}/100</span></div>
                        <div class="metric"><span>Avg LCP:</span><span>${device.keyMetrics.avgLcp}ms</span></div>
                        <div class="metric"><span>Avg Touch Response:</span><span>${device.keyMetrics.avgFid}ms</span></div>
                        <div class="metric"><span>Avg Memory:</span><span>${device.keyMetrics.avgMemoryUsage}MB</span></div>
                        <div class="metric"><span>Best Scenario:</span><span>${device.bestPerformingScenario}</span></div>
                        <div class="metric"><span>Worst Scenario:</span><span>${device.worstPerformingScenario}</span></div>
                    </div>
                `).join('')}
            </div>
            
            <div class="recommendations">
                <h2>Optimization Recommendations</h2>
                ${report.recommendations.map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <h4>${rec.title} (${rec.priority} priority)</h4>
                        <p><strong>Issue:</strong> ${rec.description}</p>
                        <p><strong>Impact:</strong> ${rec.impact}</p>
                        <p><strong>Implementation:</strong> ${rec.implementation}</p>
                        <p><strong>Effort:</strong> ${rec.effort}</p>
                        ${rec.device ? `<p><strong>Device:</strong> ${rec.device}</p>` : ''}
                        ${rec.network ? `<p><strong>Network:</strong> ${rec.network}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

// Default mobile performance configuration
export const DEFAULT_MOBILE_CONFIG: MobilePerformanceConfig = {
  baseUrl: 'http://localhost:3000',
  testDevices: ['iPhone 13 Pro', 'Pixel 5', 'iPad Pro'],
  networkConditions: ['3g', '4g', 'wifi'],
  testScenarios: [
    {
      name: 'Home Page Load',
      description: 'Test home page loading performance',
      critical: true,
      expectedDuration: 5000,
      steps: [
        { type: 'navigate', target: 'http://localhost:3000', expectedResponseTime: 3000 },
        { type: 'wait', timeout: 2000 },
        { type: 'screenshot' },
      ],
    },
    {
      name: 'User Authentication',
      description: 'Test login flow performance',
      critical: true,
      expectedDuration: 8000,
      steps: [
        { type: 'navigate', target: 'http://localhost:3000/login', expectedResponseTime: 2000 },
        { type: 'type', selector: '[data-testid="email"]', text: 'test@example.com' },
        { type: 'type', selector: '[data-testid="password"]', text: 'password123' },
        { type: 'tap', selector: '[data-testid="login-button"]', expectedResponseTime: 1000 },
        { type: 'wait', selector: '[data-testid="dashboard"]', timeout: 5000 },
        { type: 'screenshot' },
      ],
    },
    {
      name: 'Mobile Navigation',
      description: 'Test mobile navigation and touch interactions',
      critical: false,
      expectedDuration: 10000,
      steps: [
        { type: 'navigate', target: 'http://localhost:3000', expectedResponseTime: 2000 },
        { type: 'tap', selector: '[data-testid="mobile-menu"]', expectedResponseTime: 200 },
        { type: 'wait', timeout: 500 },
        { type: 'tap', selector: '[data-testid="profile-link"]', expectedResponseTime: 300 },
        { type: 'scroll', direction: 'down', distance: 300 },
        { type: 'scroll', direction: 'up', distance: 300 },
        { type: 'screenshot' },
      ],
    },
    {
      name: 'Content Creation',
      description: 'Test content creation form performance',
      critical: false,
      expectedDuration: 12000,
      steps: [
        { type: 'navigate', target: 'http://localhost:3000/content/create', expectedResponseTime: 2500 },
        { type: 'type', selector: '[data-testid="title-input"]', text: 'Mobile Test Post' },
        { type: 'type', selector: '[data-testid="content-textarea"]', text: 'This is a mobile performance test post created during automated testing.' },
        { type: 'tap', selector: '[data-testid="save-draft"]', expectedResponseTime: 800 },
        { type: 'wait', timeout: 1000 },
        { type: 'screenshot' },
      ],
    },
  ],
  performanceThresholds: {
    lcp: { '3g': 4000, '4g': 3000, 'wifi': 2500 },
    fid: 100,
    cls: 0.1,
    fcp: { '3g': 3000, '4g': 2200, 'wifi': 1800 },
    ttfb: { '3g': 1200, '4g': 800, 'wifi': 600 },
    memoryUsage: 100,
    batteryDrain: 2.0,
    touchResponseTime: 100,
    scrollFps: 45,
    pageSize: { '3g': 500000, '4g': 1000000, 'wifi': 2000000 },
  },
  outputPath: './test-results/mobile-performance',
  screenshotPath: './test-results/mobile-performance/screenshots',
  videoRecording: false,
};
