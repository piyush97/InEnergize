/**
 * Load Test Manager Utility
 * 
 * Comprehensive load testing orchestration for InErgize performance testing
 * Manages concurrent requests, resource monitoring, and result analysis
 */

import { EventEmitter } from 'events';
import { PerformanceProfiler } from './performance-profiler';

export class LoadTestManager extends EventEmitter {
  private profiler: PerformanceProfiler;
  private activeTests: Map<string, LoadTestInstance> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
    this.profiler = new PerformanceProfiler();
  }

  /**
   * Execute a load test with specified configuration
   */
  async executeLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const testId = `load-test-${Date.now()}`;
    
    this.emit('testStarted', { testId, config });
    
    const testInstance: LoadTestInstance = {
      id: testId,
      config,
      startTime: Date.now(),
      results: [],
      errors: [],
      isRunning: true
    };

    this.activeTests.set(testId, testInstance);

    try {
      // Start system monitoring
      this.profiler.startSystemMonitoring(1000);

      // Execute the load test based on pattern
      let result: LoadTestResult;
      
      switch (config.pattern) {
        case 'constant':
          result = await this.executeConstantLoad(testInstance);
          break;
        case 'rampup':
          result = await this.executeRampUpLoad(testInstance);
          break;
        case 'spike':
          result = await this.executeSpikeLoad(testInstance);
          break;
        case 'stress':
          result = await this.executeStressLoad(testInstance);
          break;
        default:
          throw new Error(`Unknown load test pattern: ${config.pattern}`);
      }

      this.emit('testCompleted', { testId, result });
      return result;

    } catch (error) {
      this.emit('testFailed', { testId, error });
      throw error;
    } finally {
      this.profiler.stopSystemMonitoring();
      testInstance.isRunning = false;
      this.activeTests.delete(testId);
    }
  }

  /**
   * Execute constant load test
   */
  private async executeConstantLoad(test: LoadTestInstance): Promise<LoadTestResult> {
    const { config } = test;
    const { concurrency, duration, requestsPerSecond } = config;
    
    console.log(`Starting constant load test: ${concurrency} concurrent users, ${requestsPerSecond} RPS for ${duration}s`);

    const totalRequests = requestsPerSecond * duration;
    const requestInterval = 1000 / requestsPerSecond; // ms between requests
    
    const promises: Promise<OperationResult>[] = [];
    const startTime = Date.now();

    // Generate requests at constant rate
    for (let i = 0; i < totalRequests; i++) {
      const delay = i * requestInterval;
      
      const promise = new Promise<OperationResult>(resolve => {
        setTimeout(async () => {
          const operationResult = await this.executeOperation(test, i);
          resolve(operationResult);
        }, delay);
      });

      promises.push(promise);
    }

    // Wait for all requests to complete
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();

    return this.analyzeResults(test, results, endTime - startTime);
  }

  /**
   * Execute ramp-up load test
   */
  private async executeRampUpLoad(test: LoadTestInstance): Promise<LoadTestResult> {
    const { config } = test;
    const { concurrency, duration, rampUpTime } = config;
    
    console.log(`Starting ramp-up load test: 0 to ${concurrency} users over ${rampUpTime}s, then ${duration}s sustained`);

    const totalDuration = (rampUpTime || 60) + duration;
    const rampDuration = rampUpTime || 60;
    
    const promises: Promise<OperationResult>[] = [];
    const startTime = Date.now();

    let requestIndex = 0;
    const startRequests = async (currentSecond: number) => {
      // Calculate current load level during ramp-up
      const rampProgress = Math.min(currentSecond / rampDuration, 1);
      const currentConcurrency = Math.floor(concurrency * rampProgress);
      
      // Start requests for this second
      for (let i = 0; i < currentConcurrency; i++) {
        const promise = this.executeOperation(test, requestIndex++);
        promises.push(promise);
        
        // Small delay between concurrent requests
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      }
    };

    // Execute ramp-up and sustained load
    for (let second = 0; second < totalDuration; second++) {
      const secondStart = Date.now();
      
      await startRequests(second);
      
      // Wait for remainder of the second
      const elapsed = Date.now() - secondStart;
      const remaining = 1000 - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
    }

    // Wait for all requests to complete
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();

    return this.analyzeResults(test, results, endTime - startTime);
  }

  /**
   * Execute spike load test
   */
  private async executeSpikeLoad(test: LoadTestInstance): Promise<LoadTestResult> {
    const { config } = test;
    const { concurrency, duration, spikes } = config;
    
    console.log(`Starting spike load test: ${spikes?.length || 1} spikes up to ${concurrency} users`);

    const testSpikes = spikes || [{ at: duration / 2, intensity: concurrency, duration: 10 }];
    const promises: Promise<OperationResult>[] = [];
    const startTime = Date.now();

    let requestIndex = 0;
    const baseLoad = Math.floor(concurrency * 0.1); // 10% base load

    // Execute base load throughout test
    const baseLoadInterval = setInterval(async () => {
      for (let i = 0; i < baseLoad; i++) {
        const promise = this.executeOperation(test, requestIndex++);
        promises.push(promise);
      }
    }, 1000);

    // Execute spikes
    for (const spike of testSpikes) {
      await new Promise(resolve => setTimeout(resolve, spike.at * 1000));
      
      console.log(`Executing spike: ${spike.intensity} requests`);
      
      // Generate spike requests
      const spikePromises: Promise<OperationResult>[] = [];
      for (let i = 0; i < spike.intensity; i++) {
        const promise = this.executeOperation(test, requestIndex++);
        spikePromises.push(promise);
      }
      
      promises.push(...spikePromises);
      
      // Wait for spike duration
      await new Promise(resolve => setTimeout(resolve, spike.duration * 1000));
    }

    // Wait for test completion
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    clearInterval(baseLoadInterval);

    // Wait for all requests to complete
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();

    return this.analyzeResults(test, results, endTime - startTime);
  }

  /**
   * Execute stress test to find breaking point
   */
  private async executeStressLoad(test: LoadTestInstance): Promise<LoadTestResult> {
    const { config } = test;
    const maxConcurrency = config.concurrency;
    const stepSize = Math.max(1, Math.floor(maxConcurrency / 10)); // 10 steps
    const stepDuration = Math.floor(config.duration / 10); // Duration per step
    
    console.log(`Starting stress test: 0 to ${maxConcurrency} users in ${stepSize} user increments`);

    const promises: Promise<OperationResult>[] = [];
    const startTime = Date.now();
    let requestIndex = 0;

    // Gradually increase load to find breaking point
    for (let step = 1; step <= 10; step++) {
      const currentLoad = step * stepSize;
      console.log(`Stress test step ${step}/10: ${currentLoad} concurrent users`);

      const stepPromises: Promise<OperationResult>[] = [];
      
      // Generate requests for current step
      for (let second = 0; second < stepDuration; second++) {
        for (let user = 0; user < currentLoad; user++) {
          const promise = new Promise<OperationResult>(resolve => {
            setTimeout(async () => {
              const result = await this.executeOperation(test, requestIndex++);
              resolve(result);
            }, second * 1000);
          });
          
          stepPromises.push(promise);
        }
      }

      promises.push(...stepPromises);

      // Monitor for failure threshold
      const completedResults = await Promise.allSettled(stepPromises);
      const errorRate = completedResults.filter(r => r.status === 'rejected').length / completedResults.length;
      
      if (errorRate > 0.1) { // 10% error rate threshold
        console.log(`Breaking point reached at ${currentLoad} users (${(errorRate * 100).toFixed(1)}% error rate)`);
        break;
      }
    }

    // Wait for all requests to complete
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();

    return this.analyzeResults(test, results, endTime - startTime);
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(test: LoadTestInstance, index: number): Promise<OperationResult> {
    const operationId = `${test.id}-op-${index}`;
    const startTime = Date.now();

    try {
      // Execute the configured operation
      const result = await test.config.operation({
        testId: test.id,
        operationIndex: index,
        startTime
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      const operationResult: OperationResult = {
        id: operationId,
        startTime,
        endTime,
        duration,
        success: true,
        result,
        metadata: {
          testId: test.id,
          operationIndex: index
        }
      };

      // Record metrics
      this.profiler.recordMetric('operation', 'latency', duration);
      this.profiler.recordMetric('operation', 'success', 1);

      test.results.push(operationResult);
      this.emit('operationCompleted', operationResult);

      return operationResult;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const operationResult: OperationResult = {
        id: operationId,
        startTime,
        endTime,
        duration,
        success: false,
        error: error.message,
        metadata: {
          testId: test.id,
          operationIndex: index
        }
      };

      // Record error metrics
      this.profiler.recordMetric('operation', 'latency', duration);
      this.profiler.recordMetric('operation', 'error', 1);

      test.errors.push(operationResult);
      this.emit('operationFailed', operationResult);

      return operationResult;
    }
  }

  /**
   * Analyze test results
   */
  private analyzeResults(
    test: LoadTestInstance,
    results: PromiseSettledResult<OperationResult>[],
    totalDuration: number
  ): LoadTestResult {
    const successful = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<OperationResult>).value);
    const failed = results.filter(r => r.status === 'rejected');

    const successfulOperations = successful.filter(op => op.success);
    const failedOperations = successful.filter(op => !op.success);

    // Calculate performance metrics
    const latencies = successfulOperations.map(op => op.duration);
    const sortedLatencies = latencies.sort((a, b) => a - b);

    const performanceMetrics: PerformanceMetrics = {
      totalRequests: results.length,
      successfulRequests: successfulOperations.length,
      failedRequests: failedOperations.length + failed.length,
      successRate: successfulOperations.length / results.length,
      errorRate: (failedOperations.length + failed.length) / results.length,
      avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0,
      minLatency: Math.min(...latencies) || 0,
      maxLatency: Math.max(...latencies) || 0,
      p50Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0,
      p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
      p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0,
      throughput: results.length / (totalDuration / 1000),
      duration: totalDuration
    };

    // Generate performance report
    const performanceReport = this.profiler.generateReport();

    return {
      testId: test.id,
      config: test.config,
      metrics: performanceMetrics,
      systemMetrics: performanceReport.system,
      insights: this.generateTestInsights(performanceMetrics),
      successful: successfulOperations,
      failed: [...failedOperations, ...failed.map(f => ({ error: f.reason.message } as OperationResult))],
      startTime: test.startTime,
      endTime: Date.now(),
      duration: totalDuration
    };
  }

  /**
   * Generate insights from test results
   */
  private generateTestInsights(metrics: PerformanceMetrics): TestInsights {
    const insights: TestInsights = {
      performance: [],
      warnings: [],
      recommendations: []
    };

    // Analyze success rate
    if (metrics.successRate > 0.99) {
      insights.performance.push('Excellent reliability (>99% success rate)');
    } else if (metrics.successRate > 0.95) {
      insights.performance.push('Good reliability (>95% success rate)');
    } else {
      insights.warnings.push(`Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
      insights.recommendations.push('Investigate error causes and improve error handling');
    }

    // Analyze latency
    if (metrics.avgLatency < 100) {
      insights.performance.push('Excellent response times (<100ms average)');
    } else if (metrics.avgLatency < 200) {
      insights.performance.push('Good response times (<200ms average)');
    } else {
      insights.warnings.push(`High average latency: ${metrics.avgLatency.toFixed(2)}ms`);
      insights.recommendations.push('Optimize performance to reduce response times');
    }

    // Analyze P95 latency
    if (metrics.p95Latency > metrics.avgLatency * 3) {
      insights.warnings.push('High latency variance detected (P95 >> average)');
      insights.recommendations.push('Investigate and optimize worst-case performance scenarios');
    }

    // Analyze throughput
    if (metrics.throughput > 100) {
      insights.performance.push(`High throughput achieved: ${metrics.throughput.toFixed(0)} ops/sec`);
    } else {
      insights.warnings.push(`Low throughput: ${metrics.throughput.toFixed(0)} ops/sec`);
      insights.recommendations.push('Consider scaling resources or optimizing operations');
    }

    return insights;
  }

  /**
   * Get status of all active tests
   */
  getActiveTests(): LoadTestInstance[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * Stop a specific test
   */
  async stopTest(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (test) {
      test.isRunning = false;
      this.emit('testStopped', { testId });
    }
  }

  /**
   * Stop all active tests
   */
  async stopAllTests(): Promise<void> {
    for (const testId of this.activeTests.keys()) {
      await this.stopTest(testId);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopAllTests();
    this.profiler.reset();
    this.removeAllListeners();
  }
}

// Type definitions
export interface LoadTestConfig {
  name: string;
  pattern: 'constant' | 'rampup' | 'spike' | 'stress';
  concurrency: number;
  duration: number; // seconds
  requestsPerSecond?: number;
  rampUpTime?: number; // seconds
  spikes?: Array<{
    at: number; // seconds from start
    intensity: number; // number of requests
    duration: number; // seconds
  }>;
  operation: (context: OperationContext) => Promise<any>;
}

export interface OperationContext {
  testId: string;
  operationIndex: number;
  startTime: number;
}

export interface OperationResult {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result?: any;
  error?: string;
  metadata?: any;
}

interface LoadTestInstance {
  id: string;
  config: LoadTestConfig;
  startTime: number;
  results: OperationResult[];
  errors: OperationResult[];
  isRunning: boolean;
}

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  errorRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  duration: number;
}

interface TestInsights {
  performance: string[];
  warnings: string[];
  recommendations: string[];
}

export interface LoadTestResult {
  testId: string;
  config: LoadTestConfig;
  metrics: PerformanceMetrics;
  systemMetrics: any;
  insights: TestInsights;
  successful: OperationResult[];
  failed: OperationResult[];
  startTime: number;
  endTime: number;
  duration: number;
}