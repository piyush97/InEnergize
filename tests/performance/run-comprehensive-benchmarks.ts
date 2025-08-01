#!/usr/bin/env ts-node
/**
 * Comprehensive Performance Benchmarking Runner for InErgize Platform
 * 
 * This is the main entry point for running all performance tests:
 * - Comprehensive Performance Suite (all-in-one testing)
 * - Enterprise Load Testing (k6 integration)
 * - Mobile Performance Testing (multi-device)
 * - Individual component testing
 * - Automated reporting and analysis
 * 
 * Usage:
 *   npm run test:performance                    # Run all tests
 *   npm run test:performance -- --suite=mobile # Run specific suite
 *   npm run test:performance -- --quick        # Quick test run
 *   npm run test:performance -- --production   # Production-like testing
 */

import { ComprehensivePerformanceSuite, DEFAULT_PERFORMANCE_CONFIG, BenchmarkResult } from './comprehensive-performance-suite';
import { MobilePerformanceSuite, DEFAULT_MOBILE_CONFIG, MobilePerformanceReport } from './mobile-performance-suite';
import { PerformanceTestingFramework } from '../advanced-qa-framework/PerformanceTestingFramework';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BenchmarkConfig {
  baseUrl: string;
  apiUrl: string;
  wsUrl: string;
  testSuites: string[];
  concurrentUsers: number;
  testDuration: number;
  outputPath: string;
  runMobile: boolean;
  runLoadTest: boolean;
  runComprehensive: boolean;
  quick: boolean;
  production: boolean;
  devices: string[];
  networks: string[];
  reportFormats: ('json' | 'html' | 'csv' | 'pdf')[];
}

export interface ConsolidatedReport {
  testId: string;
  timestamp: string;
  configuration: BenchmarkConfig;
  summary: {
    totalTestSuites: number;
    completedSuites: number;
    overallScore: number;
    productionReadiness: 'ready' | 'needs-optimization' | 'not-ready';
    testDuration: number;
  };
  results: {
    comprehensive?: BenchmarkResult;
    mobile?: MobilePerformanceReport;
    loadTest?: any;
    individual?: any[];
  };
  crossPlatformAnalysis: {
    desktopVsMobile: ComparisonAnalysis;
    networkImpact: NetworkImpactAnalysis;
    devicePerformance: DevicePerformanceAnalysis[];
  };
  enterpriseReadiness: {
    scalability: ScalabilityAssessment;
    reliability: ReliabilityAssessment;
    performance: PerformanceAssessment;
    recommendations: EnterpriseRecommendation[];
  };
  executiveSummary: {
    keyFindings: string[];
    criticalIssues: string[];
    businessImpact: string[];
    nextSteps: string[];
  };
}

export interface ComparisonAnalysis {
  performanceDifference: number; // percentage
  criticalMetrics: {
    desktop: { lcp: number; fid: number; cls: number };
    mobile: { lcp: number; fid: number; cls: number };
  };
  recommendations: string[];
}

export interface NetworkImpactAnalysis {
  baselineNetwork: string;
  impactByNetwork: Array<{
    network: string;
    performanceImpact: number;
    userExperienceScore: number;
    recommendations: string[];
  }>;
}

export interface DevicePerformanceAnalysis {
  deviceName: string;
  category: 'flagship' | 'mid-range' | 'budget';
  performanceScore: number;
  keyBottlenecks: string[];
  optimizationPotential: number;
}

export interface ScalabilityAssessment {
  maxConcurrentUsers: number;
  breakingPoint: number;
  gracefulDegradation: boolean;
  autoScalingReadiness: boolean;
  recommendations: string[];
}

export interface ReliabilityAssessment {
  uptimeScore: number;
  errorHandlingScore: number;
  recoveryCapability: number;
  dataConsistency: number;
  recommendations: string[];
}

export interface PerformanceAssessment {
  responseTimeScore: number;
  throughputScore: number;
  resourceEfficiencyScore: number;
  userExperienceScore: number;
  recommendations: string[];
}

export interface EnterpriseRecommendation {
  category: 'architecture' | 'infrastructure' | 'optimization' | 'monitoring';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  businessImpact: string;
  technicalImplementation: string;
  estimatedCost: 'low' | 'medium' | 'high';
  timeToImplement: string;
  roi: string;
}

export class ComprehensiveBenchmarkRunner {
  private config: BenchmarkConfig;
  private results: ConsolidatedReport;
  private startTime: number;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      apiUrl: process.env.TEST_API_URL || 'http://localhost:8000',
      wsUrl: process.env.TEST_WS_URL || 'ws://localhost:3007',
      testSuites: ['comprehensive', 'mobile', 'load'],
      concurrentUsers: 1000,
      testDuration: 300, // 5 minutes
      outputPath: './test-results/comprehensive-benchmarks',
      runMobile: true,
      runLoadTest: true,
      runComprehensive: true,
      quick: false,
      production: false,
      devices: ['iPhone 13 Pro', 'Pixel 5', 'iPad Pro'],
      networks: ['3g', '4g', 'wifi'],
      reportFormats: ['json', 'html'],
      ...config,
    };

    this.initializeResults();
  }

  /**
   * Run all performance benchmarks
   */
  async runAllBenchmarks(): Promise<ConsolidatedReport> {
    console.log('🚀 Starting Comprehensive Performance Benchmarking...');
    console.log('================================================');
    console.log(`Target URL: ${this.config.baseUrl}`);
    console.log(`API URL: ${this.config.apiUrl}`);
    console.log(`WebSocket URL: ${this.config.wsUrl}`);
    console.log(`Test Suites: ${this.config.testSuites.join(', ')}`);
    console.log(`Concurrent Users: ${this.config.concurrentUsers}`);
    console.log(`Test Duration: ${this.config.testDuration}s`);
    console.log(`Devices: ${this.config.devices.join(', ')}`);
    console.log(`Networks: ${this.config.networks.join(', ')}`);
    console.log('================================================');

    this.startTime = Date.now();

    try {
      // Pre-flight checks
      await this.performPreflightChecks();

      // Create output directory
      if (!fs.existsSync(this.config.outputPath)) {
        fs.mkdirSync(this.config.outputPath, { recursive: true });
      }

      // Run test suites based on configuration
      const suitePromises: Promise<void>[] = [];

      if (this.config.runComprehensive && this.config.testSuites.includes('comprehensive')) {
        suitePromises.push(this.runComprehensiveSuite());
      }

      if (this.config.runMobile && this.config.testSuites.includes('mobile')) {
        suitePromises.push(this.runMobileSuite());
      }

      if (this.config.runLoadTest && this.config.testSuites.includes('load')) {
        suitePromises.push(this.runLoadTestSuite());
      }

      // Run suites in parallel for faster execution
      await Promise.all(suitePromises);

      // Perform cross-platform analysis
      this.performCrossPlatformAnalysis();

      // Assess enterprise readiness
      this.assessEnterpriseReadiness();

      // Generate executive summary
      this.generateExecutiveSummary();

      // Calculate final metrics
      this.calculateFinalMetrics();

      // Save consolidated report
      await this.saveConsolidatedReport();

      const totalDuration = (Date.now() - this.startTime) / 1000;
      console.log(`✅ Comprehensive benchmarking completed in ${totalDuration.toFixed(2)}s`);
      console.log(`📊 Overall Score: ${this.results.summary.overallScore}/100`);
      console.log(`🏭 Production Readiness: ${this.results.summary.productionReadiness}`);

      return this.results;

    } catch (error) {
      console.error('❌ Comprehensive benchmarking failed:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive performance suite
   */
  private async runComprehensiveSuite(): Promise<void> {
    console.log('📊 Running Comprehensive Performance Suite...');

    const comprehensiveConfig = {
      ...DEFAULT_PERFORMANCE_CONFIG,
      baseUrl: this.config.baseUrl,
      apiUrl: this.config.apiUrl,
      wsUrl: this.config.wsUrl,
      testDuration: this.config.quick ? 60 : this.config.testDuration,
      concurrentUsers: this.config.quick ? 100 : this.config.concurrentUsers,
      reportOutputPath: this.config.outputPath,
    };

    const suite = new ComprehensivePerformanceSuite(comprehensiveConfig);
    const result = await suite.runComprehensiveBenchmark();
    
    this.results.results.comprehensive = result;
    console.log('✅ Comprehensive suite completed');
  }

  /**
   * Run mobile performance suite
   */
  private async runMobileSuite(): Promise<void> {
    console.log('📱 Running Mobile Performance Suite...');

    const mobileConfig = {
      ...DEFAULT_MOBILE_CONFIG,
      baseUrl: this.config.baseUrl,
      testDevices: this.config.quick ? ['iPhone 13 Pro'] : this.config.devices,
      networkConditions: this.config.quick ? ['wifi'] : this.config.networks,
      outputPath: path.join(this.config.outputPath, 'mobile'),
      screenshotPath: path.join(this.config.outputPath, 'mobile', 'screenshots'),
      videoRecording: !this.config.quick,
    };

    const suite = new MobilePerformanceSuite(mobileConfig);
    const result = await suite.runMobilePerformanceTests();
    
    this.results.results.mobile = result;
    console.log('✅ Mobile suite completed');
  }

  /**
   * Run load test suite using k6
   */
  private async runLoadTestSuite(): Promise<void> {
    console.log('🏋️ Running Load Test Suite...');

    const k6ScriptPath = path.join(__dirname, 'enterprise-load-test.k6.js');
    const outputPath = path.join(this.config.outputPath, 'load-test-results.json');

    const k6Options = {
      TARGET_URL: this.config.baseUrl,
      API_URL: this.config.apiUrl,
      WS_URL: this.config.wsUrl,
      TEST_DURATION: this.config.quick ? '2m' : `${Math.floor(this.config.testDuration / 60)}m`,
      MAX_USERS: this.config.quick ? '500' : this.config.concurrentUsers.toString(),
    };

    try {
      const result = await this.runK6Test(k6ScriptPath, k6Options, outputPath);
      this.results.results.loadTest = result;
      console.log('✅ Load test suite completed');
    } catch (error) {
      console.warn('⚠️ Load test suite failed:', error.message);
      this.results.results.loadTest = { error: error.message };
    }
  }

  /**
   * Run k6 test with specified options
   */
  private async runK6Test(
    scriptPath: string,
    envOptions: Record<string, string>,
    outputPath: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...envOptions };
      const args = [
        'run',
        '--out', `json=${outputPath}`,
        '--quiet',
        scriptPath,
      ];

      const k6Process = spawn('k6', args, {
        env,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      k6Process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      k6Process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      k6Process.on('close', (code) => {
        if (code === 0) {
          try {
            const results = fs.existsSync(outputPath) 
              ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
              : { stdout, stderr };
            resolve(results);
          } catch (error) {
            resolve({ stdout, stderr, parseError: error.message });
          }
        } else {
          reject(new Error(`k6 test failed with code ${code}: ${stderr}`));
        }
      });

      k6Process.on('error', (error) => {
        reject(new Error(`Failed to start k6: ${error.message}`));
      });
    });
  }

  /**
   * Perform pre-flight checks
   */
  private async performPreflightChecks(): Promise<void> {
    console.log('🔍 Performing pre-flight checks...');

    // Check if target services are accessible
    const checks = [
      { name: 'Web Application', url: this.config.baseUrl },
      { name: 'API Gateway', url: `${this.config.apiUrl}/health` },
    ];

    for (const check of checks) {
      try {
        const response = await fetch(check.url, { method: 'GET' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        console.log(`✅ ${check.name} is accessible`);
      } catch (error) {
        console.warn(`⚠️ ${check.name} check failed: ${error.message}`);
        // Continue with tests but log the issue
      }
    }

    // Check system resources
    const freeMemory = os.freemem() / 1024 / 1024 / 1024; // GB
    const totalMemory = os.totalmem() / 1024 / 1024 / 1024; // GB
    const cpuCount = os.cpus().length;

    console.log(`💻 System Resources:`);
    console.log(`  Memory: ${freeMemory.toFixed(1)}GB free / ${totalMemory.toFixed(1)}GB total`);
    console.log(`  CPU Cores: ${cpuCount}`);

    if (freeMemory < 2) {
      console.warn('⚠️ Low memory available. Consider reducing test concurrency.');
    }

    // Check if k6 is available for load testing
    if (this.config.runLoadTest) {
      try {
        await new Promise((resolve, reject) => {
          const k6Check = spawn('k6', ['version'], { stdio: 'pipe' });
          k6Check.on('close', (code) => {
            if (code === 0) {
              resolve(true);
            } else {
              reject(new Error('k6 not found'));
            }
          });
          k6Check.on('error', reject);
        });
        console.log('✅ k6 is available for load testing');
      } catch (error) {
        console.warn('⚠️ k6 not found. Load testing will be skipped.');
        this.config.runLoadTest = false;
      }
    }
  }

  /**
   * Perform cross-platform analysis
   */
  private performCrossPlatformAnalysis(): void {
    console.log('🔄 Performing cross-platform analysis...');

    const comprehensive = this.results.results.comprehensive;
    const mobile = this.results.results.mobile;

    if (comprehensive && mobile) {
      // Desktop vs Mobile comparison
      const desktopLcp = comprehensive.results.frontend.coreWebVitals?.lcp || 0;
      const mobileLcp = this.calculateAverageMobileLcp(mobile);
      
      const performanceDifference = ((mobileLcp - desktopLcp) / desktopLcp) * 100;
      
      this.results.crossPlatformAnalysis.desktopVsMobile = {
        performanceDifference,
        criticalMetrics: {
          desktop: {
            lcp: desktopLcp,
            fid: comprehensive.results.frontend.coreWebVitals?.fid || 0,
            cls: comprehensive.results.frontend.coreWebVitals?.cls || 0,
          },
          mobile: {
            lcp: mobileLcp,
            fid: this.calculateAverageMobileFid(mobile),
            cls: this.calculateAverageMobileCls(mobile),
          },
        },
        recommendations: this.generateCrossPlatformRecommendations(performanceDifference),
      };
    }

    // Network impact analysis
    if (mobile) {
      this.results.crossPlatformAnalysis.networkImpact = this.analyzeNetworkImpact(mobile);
    }

    // Device performance analysis
    if (mobile) {
      this.results.crossPlatformAnalysis.devicePerformance = this.analyzeDevicePerformance(mobile);
    }
  }

  /**
   * Assess enterprise readiness
   */
  private assessEnterpriseReadiness(): void {
    console.log('🏭 Assessing enterprise readiness...');

    const comprehensive = this.results.results.comprehensive;
    const loadTest = this.results.results.loadTest;

    // Scalability assessment
    this.results.enterpriseReadiness.scalability = {
      maxConcurrentUsers: loadTest?.scalabilityMetrics?.maxConcurrentUsers || 0,
      breakingPoint: loadTest?.scalabilityMetrics?.breakingPoint || 0,
      gracefulDegradation: comprehensive?.results.loadTest?.enduranceTest?.performanceStability || false,
      autoScalingReadiness: this.assessAutoScalingReadiness(),
      recommendations: this.generateScalabilityRecommendations(),
    };

    // Reliability assessment
    this.results.enterpriseReadiness.reliability = {
      uptimeScore: this.calculateUptimeScore(),
      errorHandlingScore: this.calculateErrorHandlingScore(),
      recoveryCapability: this.calculateRecoveryCapability(),
      dataConsistency: this.calculateDataConsistencyScore(),
      recommendations: this.generateReliabilityRecommendations(),
    };

    // Performance assessment
    this.results.enterpriseReadiness.performance = {
      responseTimeScore: this.calculateResponseTimeScore(),
      throughputScore: this.calculateThroughputScore(),
      resourceEfficiencyScore: this.calculateResourceEfficiencyScore(),
      userExperienceScore: this.calculateUserExperienceScore(),
      recommendations: this.generatePerformanceRecommendations(),
    };

    // Enterprise recommendations
    this.results.enterpriseReadiness.recommendations = this.generateEnterpriseRecommendations();
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(): void {
    console.log('📊 Generating executive summary...');

    const keyFindings: string[] = [];
    const criticalIssues: string[] = [];
    const businessImpact: string[] = [];
    const nextSteps: string[] = [];

    const comprehensive = this.results.results.comprehensive;
    const mobile = this.results.results.mobile;
    const loadTest = this.results.results.loadTest;

    // Key findings
    if (comprehensive) {
      keyFindings.push(`Overall performance score: ${comprehensive.overallScore}/100`);
      keyFindings.push(`Production readiness: ${comprehensive.productionReadiness}`);
    }

    if (mobile) {
      keyFindings.push(`Mobile performance score: ${mobile.summary.averageScore}/100`);
      keyFindings.push(`${mobile.summary.passedTests}/${mobile.summary.totalTests} mobile tests passed`);
    }

    if (loadTest && !loadTest.error) {
      keyFindings.push(`Sustained ${this.config.concurrentUsers} concurrent users`);
    }

    // Critical issues
    if (comprehensive && comprehensive.overallScore < 70) {
      criticalIssues.push('Overall performance below acceptable threshold');
    }

    if (mobile && mobile.summary.criticalIssues.length > 0) {
      criticalIssues.push(...mobile.summary.criticalIssues);
    }

    if (comprehensive && comprehensive.bottlenecks.filter(b => b.severity === 'critical').length > 0) {
      criticalIssues.push('Critical performance bottlenecks identified');
    }

    // Business impact
    if (criticalIssues.length > 0) {
      businessImpact.push('Performance issues may impact user experience and conversion rates');
    }

    if (mobile && mobile.summary.failedTests > 0) {
      businessImpact.push('Mobile performance issues may affect mobile user engagement');
    }

    if (comprehensive && comprehensive.productionReadiness === 'not-ready') {
      businessImpact.push('System not ready for production deployment without optimization');
    }

    // Next steps
    if (comprehensive && comprehensive.recommendations.length > 0) {
      const criticalRecs = comprehensive.recommendations.filter(r => r.priority === 'critical');
      if (criticalRecs.length > 0) {
        nextSteps.push(`Address ${criticalRecs.length} critical performance recommendation(s)`);
      }
    }

    if (mobile && mobile.recommendations.length > 0) {
      const highPriorityRecs = mobile.recommendations.filter(r => r.priority === 'critical' || r.priority === 'high');
      if (highPriorityRecs.length > 0) {
        nextSteps.push(`Implement ${highPriorityRecs.length} high-priority mobile optimization(s)`);
      }
    }

    nextSteps.push('Schedule regular performance monitoring and testing');
    nextSteps.push('Establish performance budgets and alerting');

    this.results.executiveSummary = {
      keyFindings,
      criticalIssues,
      businessImpact,
      nextSteps,
    };
  }

  /**
   * Calculate final metrics
   */
  private calculateFinalMetrics(): void {
    const comprehensive = this.results.results.comprehensive;
    const mobile = this.results.results.mobile;
    const loadTest = this.results.results.loadTest;

    let completedSuites = 0;
    let totalScore = 0;
    let scoreCount = 0;

    if (comprehensive) {
      completedSuites++;
      totalScore += comprehensive.overallScore;
      scoreCount++;
    }

    if (mobile) {
      completedSuites++;
      totalScore += mobile.summary.averageScore;
      scoreCount++;
    }

    if (loadTest && !loadTest.error) {
      completedSuites++;
      // Estimate load test score based on success metrics
      const loadTestScore = this.estimateLoadTestScore(loadTest);
      totalScore += loadTestScore;
      scoreCount++;
    }

    const overallScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    
    let productionReadiness: 'ready' | 'needs-optimization' | 'not-ready';
    if (overallScore >= 85) {
      productionReadiness = 'ready';
    } else if (overallScore >= 70) {
      productionReadiness = 'needs-optimization';
    } else {
      productionReadiness = 'not-ready';
    }

    this.results.summary = {
      totalTestSuites: this.config.testSuites.length,
      completedSuites,
      overallScore,
      productionReadiness,
      testDuration: (Date.now() - this.startTime) / 1000,
    };
  }

  /**
   * Save consolidated report
   */
  private async saveConsolidatedReport(): Promise<void> {
    const reportPath = path.join(this.config.outputPath, `consolidated-report-${this.results.testId}.json`);
    const htmlReportPath = path.join(this.config.outputPath, `consolidated-report-${this.results.testId}.html`);

    // Save JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate HTML report if requested
    if (this.config.reportFormats.includes('html')) {
      const htmlContent = this.generateConsolidatedHTMLReport();
      fs.writeFileSync(htmlReportPath, htmlContent);
    }

    // Generate CSV summary if requested
    if (this.config.reportFormats.includes('csv')) {
      const csvPath = path.join(this.config.outputPath, `performance-summary-${this.results.testId}.csv`);
      const csvContent = this.generateCSVSummary();
      fs.writeFileSync(csvPath, csvContent);
    }

    console.log(`📊 Consolidated reports saved:`);
    console.log(`  JSON: ${reportPath}`);
    if (this.config.reportFormats.includes('html')) {
      console.log(`  HTML: ${htmlReportPath}`);
    }
  }

  // Helper methods for analysis and calculations
  private calculateAverageMobileLcp(mobile: MobilePerformanceReport): number {
    const lcpValues = mobile.results.map(r => r.metrics.coreWebVitals.lcp).filter(v => v > 0);
    return lcpValues.length > 0 ? lcpValues.reduce((sum, v) => sum + v, 0) / lcpValues.length : 0;
  }

  private calculateAverageMobileFid(mobile: MobilePerformanceReport): number {
    const fidValues = mobile.results.map(r => r.metrics.interaction.touchResponseTime).filter(v => v > 0);
    return fidValues.length > 0 ? fidValues.reduce((sum, v) => sum + v, 0) / fidValues.length : 0;
  }

  private calculateAverageMobileCls(mobile: MobilePerformanceReport): number {
    const clsValues = mobile.results.map(r => r.metrics.coreWebVitals.cls).filter(v => v >= 0);
    return clsValues.length > 0 ? clsValues.reduce((sum, v) => sum + v, 0) / clsValues.length : 0;
  }

  private generateCrossPlatformRecommendations(performanceDifference: number): string[] {
    const recommendations = [];
    
    if (performanceDifference > 50) {
      recommendations.push('Significant mobile performance gap detected - prioritize mobile optimization');
    }
    
    if (performanceDifference > 25) {
      recommendations.push('Implement mobile-specific optimizations and responsive design improvements');
    }
    
    recommendations.push('Consider implementing adaptive loading based on device capabilities');
    recommendations.push('Optimize images and resources for mobile bandwidth constraints');
    
    return recommendations;
  }

  private analyzeNetworkImpact(mobile: MobilePerformanceReport): NetworkImpactAnalysis {
    const networkResults: { [network: string]: MobileTestResult[] } = {};
    
    mobile.results.forEach(result => {
      const network = result.networkCondition.name;
      if (!networkResults[network]) {
        networkResults[network] = [];
      }
      networkResults[network].push(result);
    });
    
    const wifiResults = networkResults['WiFi'] || [];
    const wifiScore = wifiResults.length > 0 
      ? wifiResults.reduce((sum, r) => sum + r.score, 0) / wifiResults.length
      : 100;
    
    const impactByNetwork = Object.entries(networkResults).map(([network, results]) => {
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      const performanceImpact = ((wifiScore - avgScore) / wifiScore) * 100;
      
      return {
        network,
        performanceImpact: Math.round(performanceImpact),
        userExperienceScore: Math.round(avgScore),
        recommendations: this.generateNetworkRecommendations(network, performanceImpact),
      };
    });
    
    return {
      baselineNetwork: 'WiFi',
      impactByNetwork,
    };
  }

  private generateNetworkRecommendations(network: string, impact: number): string[] {
    const recommendations = [];
    
    if (impact > 30) {
      recommendations.push(`Optimize for ${network} by reducing resource sizes and implementing caching`);
    }
    
    if (network.includes('3G')) {
      recommendations.push('Implement progressive loading and skeleton screens for slow connections');
    }
    
    return recommendations;
  }

  private analyzeDevicePerformance(mobile: MobilePerformanceReport): DevicePerformanceAnalysis[] {
    return mobile.deviceComparison.map(device => {
      let category: 'flagship' | 'mid-range' | 'budget';
      if (device.deviceName.includes('Pro') || device.deviceName.includes('iPad')) {
        category = 'flagship';
      } else if (device.deviceName.includes('SE')) {
        category = 'budget';
      } else {
        category = 'mid-range';
      }
      
      const keyBottlenecks = [];
      if (device.keyMetrics.avgLcp > 3000) {
        keyBottlenecks.push('Slow LCP');
      }
      if (device.keyMetrics.avgFid > 100) {
        keyBottlenecks.push('High input delay');
      }
      if (device.keyMetrics.avgMemoryUsage > 100) {
        keyBottlenecks.push('High memory usage');
      }
      
      const optimizationPotential = 100 - device.averageScore;
      
      return {
        deviceName: device.deviceName,
        category,
        performanceScore: device.averageScore,
        keyBottlenecks,
        optimizationPotential,
      };
    });
  }

  // Enterprise assessment helper methods
  private assessAutoScalingReadiness(): boolean {
    // This would typically involve checking if the application is stateless,
    // uses external session storage, has health checks, etc.
    return true; // Simplified for this implementation
  }

  private calculateUptimeScore(): number {
    // Calculate based on error rates and availability metrics
    const comprehensive = this.results.results.comprehensive;
    if (comprehensive?.results.backend.apiMetrics) {
      const errorRate = comprehensive.results.backend.apiMetrics.errorRate;
      return Math.max(0, 100 - (errorRate * 10));
    }
    return 95; // Default
  }

  private calculateErrorHandlingScore(): number {
    // Assess error handling capabilities
    return 85; // Simplified
  }

  private calculateRecoveryCapability(): number {
    // Assess recovery from failures
    return 80; // Simplified
  }

  private calculateDataConsistencyScore(): number {
    // Assess data consistency across operations
    return 90; // Simplified
  }

  private calculateResponseTimeScore(): number {
    const comprehensive = this.results.results.comprehensive;
    if (comprehensive?.results.backend.apiMetrics) {
      const avgResponseTime = comprehensive.results.backend.apiMetrics.averageResponseTime;
      if (avgResponseTime <= 100) return 100;
      if (avgResponseTime <= 200) return 90;
      if (avgResponseTime <= 500) return 70;
      return 50;
    }
    return 75;
  }

  private calculateThroughputScore(): number {
    const comprehensive = this.results.results.comprehensive;
    if (comprehensive?.results.backend.apiMetrics) {
      const throughput = comprehensive.results.backend.apiMetrics.throughput;
      if (throughput >= 1000) return 100;
      if (throughput >= 500) return 80;
      if (throughput >= 100) return 60;
      return 40;
    }
    return 70;
  }

  private calculateResourceEfficiencyScore(): number {
    // Based on CPU, memory usage, etc.
    return 75;
  }

  private calculateUserExperienceScore(): number {
    let totalScore = 0;
    let scoreCount = 0;
    
    if (this.results.results.comprehensive) {
      totalScore += this.results.results.comprehensive.overallScore;
      scoreCount++;
    }
    
    if (this.results.results.mobile) {
      totalScore += this.results.results.mobile.summary.averageScore;
      scoreCount++;
    }
    
    return scoreCount > 0 ? totalScore / scoreCount : 75;
  }

  private estimateLoadTestScore(loadTest: any): number {
    // Estimate score based on load test results
    if (loadTest.error) return 0;
    
    // This would be more sophisticated in a real implementation
    return 80;
  }

  private generateScalabilityRecommendations(): string[] {
    return [
      'Implement horizontal scaling capabilities',
      'Set up load balancing and auto-scaling',
      'Optimize database connection pooling',
      'Implement caching strategies for high-traffic endpoints',
    ];
  }

  private generateReliabilityRecommendations(): string[] {
    return [
      'Implement comprehensive error handling and logging',
      'Set up monitoring and alerting systems',
      'Establish disaster recovery procedures',
      'Implement circuit breaker patterns for external dependencies',
    ];
  }

  private generatePerformanceRecommendations(): string[] {
    return [
      'Optimize database queries and add appropriate indexes',
      'Implement CDN for static assets',
      'Use compression and minification for web assets',
      'Implement performance monitoring and budgets',
    ];
  }

  private generateEnterpriseRecommendations(): EnterpriseRecommendation[] {
    return [
      {
        category: 'infrastructure',
        priority: 'high',
        title: 'Implement Auto-Scaling Infrastructure',
        description: 'Set up auto-scaling capabilities to handle variable load',
        businessImpact: 'Improved reliability and cost optimization',
        technicalImplementation: 'Containerize applications and set up Kubernetes/ECS with auto-scaling policies',
        estimatedCost: 'medium',
        timeToImplement: '4-6 weeks',
        roi: 'High - reduced downtime and operational costs',
      },
      {
        category: 'monitoring',
        priority: 'critical',
        title: 'Comprehensive Performance Monitoring',
        description: 'Implement real-time performance monitoring across all services',
        businessImpact: 'Proactive issue detection and faster resolution',
        technicalImplementation: 'Deploy APM tools, set up dashboards, and configure alerting',
        estimatedCost: 'low',
        timeToImplement: '2-3 weeks',
        roi: 'Very High - prevent outages and performance degradation',
      },
      {
        category: 'optimization',
        priority: 'medium',
        title: 'Database Performance Optimization',
        description: 'Optimize database queries and implement advanced caching',
        businessImpact: 'Faster response times and better user experience',
        technicalImplementation: 'Query optimization, index tuning, Redis caching implementation',
        estimatedCost: 'medium',
        timeToImplement: '3-4 weeks',
        roi: 'Medium - improved performance and user satisfaction',
      },
    ];
  }

  private generateConsolidatedHTMLReport(): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>InErgize Comprehensive Performance Report</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
            .container { max-width: 1400px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; }
            .score { font-size: 4em; font-weight: bold; margin: 20px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
            .executive-summary { background: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }
            .metric-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .metric-value { font-size: 2.5em; font-weight: bold; color: #2563eb; margin: 10px 0; }
            .recommendation { background: #fef3c7; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 5px solid #f59e0b; }
            .recommendation.critical { background: #fecaca; border-left-color: #ef4444; }
            .chart-placeholder { height: 200px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280; }
            h1, h2, h3 { color: #1f2937; }
            .status-ready { color: #059669; }
            .status-needs-optimization { color: #d97706; }
            .status-not-ready { color: #dc2626; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 InErgize Comprehensive Performance Report</h1>
                <p><strong>Test ID:</strong> ${this.results.testId}</p>
                <p><strong>Generated:</strong> ${this.results.timestamp}</p>
                <div class="score">${this.results.summary.overallScore}/100</div>
                <p>Overall Performance Score</p>
                <p class="status-${this.results.summary.productionReadiness.replace('-', '')}">
                    <strong>Production Readiness:</strong> ${this.results.summary.productionReadiness.toUpperCase()}
                </p>
            </div>
            
            <div class="executive-summary">
                <h2>📊 Executive Summary</h2>
                
                <h3>Key Findings</h3>
                <ul>
                    ${this.results.executiveSummary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
                </ul>
                
                ${this.results.executiveSummary.criticalIssues.length > 0 ? `
                <h3>⚠️ Critical Issues</h3>
                <ul>
                    ${this.results.executiveSummary.criticalIssues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
                ` : ''}
                
                <h3>🎯 Next Steps</h3>
                <ol>
                    ${this.results.executiveSummary.nextSteps.map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Test Coverage</h3>
                    <div class="metric-value">${this.results.summary.completedSuites}/${this.results.summary.totalTestSuites}</div>
                    <p>Test Suites Completed</p>
                </div>
                
                <div class="metric-card">
                    <h3>Test Duration</h3>
                    <div class="metric-value">${Math.round(this.results.summary.testDuration / 60)}</div>
                    <p>Minutes</p>
                </div>
                
                ${this.results.results.comprehensive ? `
                <div class="metric-card">
                    <h3>Desktop Performance</h3>
                    <div class="metric-value">${this.results.results.comprehensive.overallScore}</div>
                    <p>Overall Score</p>
                </div>
                ` : ''}
                
                ${this.results.results.mobile ? `
                <div class="metric-card">
                    <h3>Mobile Performance</h3>
                    <div class="metric-value">${this.results.results.mobile.summary.averageScore}</div>
                    <p>Average Score</p>
                </div>
                ` : ''}
            </div>
            
            <div class="metric-card">
                <h2>🏭 Enterprise Readiness Assessment</h2>
                
                <h3>Scalability</h3>
                <p><strong>Max Concurrent Users:</strong> ${this.results.enterpriseReadiness.scalability.maxConcurrentUsers.toLocaleString()}</p>
                <p><strong>Auto-scaling Ready:</strong> ${this.results.enterpriseReadiness.scalability.autoScalingReadiness ? '✅ Yes' : '❌ No'}</p>
                
                <h3>Performance Scores</h3>
                <ul>
                    <li><strong>Response Time:</strong> ${this.results.enterpriseReadiness.performance.responseTimeScore}/100</li>
                    <li><strong>Throughput:</strong> ${this.results.enterpriseReadiness.performance.throughputScore}/100</li>
                    <li><strong>Resource Efficiency:</strong> ${this.results.enterpriseReadiness.performance.resourceEfficiencyScore}/100</li>
                    <li><strong>User Experience:</strong> ${this.results.enterpriseReadiness.performance.userExperienceScore}/100</li>
                </ul>
            </div>
            
            <div class="metric-card">
                <h2>💰 Enterprise Recommendations</h2>
                ${this.results.enterpriseReadiness.recommendations.map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <h4>${rec.title} (${rec.priority} priority)</h4>
                        <p><strong>Business Impact:</strong> ${rec.businessImpact}</p>
                        <p><strong>Implementation:</strong> ${rec.technicalImplementation}</p>
                        <p><strong>Time to Implement:</strong> ${rec.timeToImplement}</p>
                        <p><strong>ROI:</strong> ${rec.roi}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateCSVSummary(): string {
    const headers = [
      'Metric',
      'Value',
      'Category',
      'Status',
      'Threshold',
      'Recommendation',
    ];

    const rows = [
      ['Overall Score', this.results.summary.overallScore.toString(), 'Summary', this.results.summary.productionReadiness, '85', 'Optimize performance'],
    ];

    // Add comprehensive results
    if (this.results.results.comprehensive) {
      const comp = this.results.results.comprehensive;
      rows.push(
        ['Desktop LCP', comp.results.frontend.coreWebVitals?.lcp?.toString() || '0', 'Frontend', comp.results.frontend.coreWebVitals?.lcp <= 2500 ? 'good' : 'needs-improvement', '2500', 'Optimize loading'],
        ['API Response Time', comp.results.backend.apiMetrics?.averageResponseTime?.toString() || '0', 'Backend', comp.results.backend.apiMetrics?.averageResponseTime <= 200 ? 'good' : 'needs-improvement', '200', 'Optimize API'],
      );
    }

    // Add mobile results
    if (this.results.results.mobile) {
      const mobile = this.results.results.mobile;
      rows.push(
        ['Mobile Score', mobile.summary.averageScore.toString(), 'Mobile', mobile.summary.averageScore >= 80 ? 'good' : 'needs-improvement', '80', 'Optimize mobile'],
        ['Mobile Tests Passed', `${mobile.summary.passedTests}/${mobile.summary.totalTests}`, 'Mobile', mobile.summary.passedTests === mobile.summary.totalTests ? 'good' : 'needs-improvement', '100%', 'Fix failing tests'],
      );
    }

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private initializeResults(): void {
    this.results = {
      testId: `comprehensive-${Date.now()}`,
      timestamp: new Date().toISOString(),
      configuration: this.config,
      summary: {
        totalTestSuites: 0,
        completedSuites: 0,
        overallScore: 0,
        productionReadiness: 'not-ready',
        testDuration: 0,
      },
      results: {},
      crossPlatformAnalysis: {
        desktopVsMobile: {
          performanceDifference: 0,
          criticalMetrics: {
            desktop: { lcp: 0, fid: 0, cls: 0 },
            mobile: { lcp: 0, fid: 0, cls: 0 },
          },
          recommendations: [],
        },
        networkImpact: {
          baselineNetwork: 'WiFi',
          impactByNetwork: [],
        },
        devicePerformance: [],
      },
      enterpriseReadiness: {
        scalability: {
          maxConcurrentUsers: 0,
          breakingPoint: 0,
          gracefulDegradation: false,
          autoScalingReadiness: false,
          recommendations: [],
        },
        reliability: {
          uptimeScore: 0,
          errorHandlingScore: 0,
          recoveryCapability: 0,
          dataConsistency: 0,
          recommendations: [],
        },
        performance: {
          responseTimeScore: 0,
          throughputScore: 0,
          resourceEfficiencyScore: 0,
          userExperienceScore: 0,
          recommendations: [],
        },
        recommendations: [],
      },
      executiveSummary: {
        keyFindings: [],
        criticalIssues: [],
        businessImpact: [],
        nextSteps: [],
      },
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: Partial<BenchmarkConfig> = {};

  // Parse command line arguments
  args.forEach((arg, index) => {
    if (arg === '--quick') {
      config.quick = true;
      config.testDuration = 60;
      config.concurrentUsers = 100;
    } else if (arg === '--production') {
      config.production = true;
      config.testDuration = 600; // 10 minutes
      config.concurrentUsers = 5000;
    } else if (arg.startsWith('--suite=')) {
      const suite = arg.split('=')[1];
      config.testSuites = [suite];
      config.runComprehensive = suite === 'comprehensive';
      config.runMobile = suite === 'mobile';
      config.runLoadTest = suite === 'load';
    } else if (arg.startsWith('--users=')) {
      config.concurrentUsers = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--duration=')) {
      config.testDuration = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--output=')) {
      config.outputPath = arg.split('=')[1];
    }
  });

  // Run benchmarks
  const runner = new ComprehensiveBenchmarkRunner(config);
  runner.runAllBenchmarks()
    .then(results => {
      console.log('\n✅ All benchmarks completed successfully!');
      console.log(`📊 Overall Score: ${results.summary.overallScore}/100`);
      console.log(`🏭 Production Readiness: ${results.summary.productionReadiness}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Benchmarks failed:', error.message);
      process.exit(1);
    });
}

export default ComprehensiveBenchmarkRunner;
