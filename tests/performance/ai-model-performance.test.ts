/**
 * AI Model Performance Testing Framework
 * 
 * Comprehensive performance benchmarking for InErgize's AI models including:
 * - Latency benchmarking (<200ms target for model inference)
 * - Throughput testing (>100 RPS capacity)
 * - Memory usage profiling and optimization
 * - Token efficiency and cost optimization
 * - Concurrent request handling and queue management
 */

import { ProfileOptimizationService } from '../../services/ai-service/src/services/profileOptimization.service';
import { ContentGenerationService } from '../../services/ai-service/src/services/contentGeneration.service';
import { OpenAIService } from '../../services/ai-service/src/services/openai.service';
import { LinkedInProfile, ProfileCompleteness } from '../../services/ai-service/src/types';

// Performance testing utilities
import { PerformanceProfiler } from '../utils/performance-profiler';
import { LoadTestManager } from '../utils/load-test-manager';
import { MemoryMonitor } from '../utils/memory-monitor';

// Test data fixtures
import { profileTestData, contentTestData } from '../fixtures/ai-test-data';

jest.mock('../../services/ai-service/src/services/openai.service');
const MockedOpenAIService = OpenAIService as jest.MockedClass<typeof OpenAIService>;

describe('AI Model Performance Testing', () => {
  let profileOptimizationService: ProfileOptimizationService;
  let contentGenerationService: ContentGenerationService;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let performanceProfiler: PerformanceProfiler;
  let loadTestManager: LoadTestManager;
  let memoryMonitor: MemoryMonitor;

  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    LATENCY_TARGET: 200, // milliseconds
    THROUGHPUT_TARGET: 100, // requests per second
    MEMORY_LIMIT: 512, // MB
    P95_LATENCY_LIMIT: 300, // milliseconds
    ERROR_RATE_LIMIT: 0.01, // 1% error rate
    TOKEN_EFFICIENCY_TARGET: 0.8 // tokens used / tokens allocated
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOpenAIService = {
      generateStructuredResponse: jest.fn(),
      createSystemMessage: jest.fn(),
      calculateTokenUsage: jest.fn(),
      validateResponse: jest.fn()
    } as any;

    MockedOpenAIService.mockImplementation(() => mockOpenAIService);
    
    profileOptimizationService = new ProfileOptimizationService(mockOpenAIService);
    contentGenerationService = new ContentGenerationService(mockOpenAIService);
    
    performanceProfiler = new PerformanceProfiler();
    loadTestManager = new LoadTestManager();
    memoryMonitor = new MemoryMonitor();
  });

  afterEach(() => {
    performanceProfiler.reset();
    loadTestManager.cleanup();
    memoryMonitor.reset();
  });

  describe('AI Model Latency Benchmarking', () => {
    interface LatencyTestCase {
      service: string;
      operation: string;
      iterations: number;
      concurrency: number;
      expectedLatency: number;
    }

    const latencyTestCases: LatencyTestCase[] = [
      {
        service: 'profile-optimization',
        operation: 'optimizeProfile',
        iterations: 50,
        concurrency: 1,
        expectedLatency: 150
      },
      {
        service: 'content-generation',
        operation: 'generateLinkedInPost',
        iterations: 50,
        concurrency: 1,
        expectedLatency: 180
      },
      {
        service: 'headline-generation',
        operation: 'generateHeadlines',
        iterations: 30,
        concurrency: 1,
        expectedLatency: 120
      },
      {
        service: 'summary-optimization',
        operation: 'optimizeSummary',
        iterations: 30,
        concurrency: 1,
        expectedLatency: 160
      }
    ];

    it('should meet latency requirements for all AI operations', async () => {
      const performanceResults: { [service: string]: PerformanceMetrics } = {};

      for (const testCase of latencyTestCases) {
        console.log(`\nTesting ${testCase.service} latency...`);
        
        const latencies: number[] = [];
        const errors: Error[] = [];

        for (let i = 0; i < testCase.iterations; i++) {
          // Mock realistic response times
          const mockLatency = testCase.expectedLatency + (Math.random() * 50 - 25); // ±25ms variation
          
          mockOpenAIService.generateStructuredResponse.mockImplementation(async () => {
            // Simulate realistic API latency
            await new Promise(resolve => setTimeout(resolve, mockLatency));
            return {
              data: {
                overallScore: 85,
                recommendations: [
                  { field: 'headline', impact: 'high', difficulty: 'easy' }
                ],
                prioritizedActions: [
                  { title: 'Optimize headline', priority: 9 }
                ],
                estimatedImpact: {
                  profileViews: 200,
                  connectionAcceptance: 85,
                  recruiterInterest: 75
                }
              },
              usage: { tokens: 1500, cost: 0.02 }
            };
          });

          const startTime = Date.now();
          
          try {
            await executeTestOperation(testCase, profileOptimizationService, contentGenerationService);
            const endTime = Date.now();
            latencies.push(endTime - startTime);
          } catch (error) {
            errors.push(error as Error);
          }
        }

        // Calculate performance metrics
        const sortedLatencies = latencies.sort((a, b) => a - b);
        const metrics: PerformanceMetrics = {
          avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
          minLatency: Math.min(...latencies),
          maxLatency: Math.max(...latencies),
          p50Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)],
          p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)],
          p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)],
          errorRate: errors.length / testCase.iterations,
          throughput: testCase.iterations / (latencies.reduce((sum, lat) => sum + lat, 0) / 1000),
          successCount: latencies.length,
          errorCount: errors.length
        };

        performanceResults[testCase.service] = metrics;

        // Performance assertions
        expect(metrics.avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.LATENCY_TARGET);
        expect(metrics.p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.P95_LATENCY_LIMIT);
        expect(metrics.errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.ERROR_RATE_LIMIT);

        console.log(`${testCase.service} performance:`, {
          avgLatency: `${metrics.avgLatency.toFixed(2)}ms`,
          p95Latency: `${metrics.p95Latency.toFixed(2)}ms`,
          maxLatency: `${metrics.maxLatency.toFixed(2)}ms`,
          errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`,
          throughput: `${metrics.throughput.toFixed(2)} ops/sec`
        });
      }

      // Verify overall system performance
      const overallAvgLatency = Object.values(performanceResults)
        .reduce((sum, metrics) => sum + metrics.avgLatency, 0) / Object.keys(performanceResults).length;
      
      expect(overallAvgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.LATENCY_TARGET);
    });

    it('should maintain consistent performance under varying load', async () => {
      const loadLevels = [1, 5, 10, 25, 50]; // concurrent requests
      const performanceByLoad: { [load: number]: PerformanceMetrics } = {};

      for (const concurrency of loadLevels) {
        console.log(`\nTesting with ${concurrency} concurrent requests...`);
        
        // Mock responses for concurrent requests
        mockOpenAIService.generateStructuredResponse.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 50));
          return {
            data: { overallScore: 85, recommendations: [], prioritizedActions: [] },
            usage: { tokens: 1200, cost: 0.015 }
          };
        });

        const startTime = Date.now();
        const promises: Promise<any>[] = [];

        // Generate concurrent requests
        for (let i = 0; i < concurrency; i++) {
          promises.push(
            profileOptimizationService.optimizeProfile({
              linkedinProfile: profileTestData.moderateProfile,
              completenessData: { score: 70, breakdown: {}, missingFields: [] } as ProfileCompleteness,
              targetRole: 'Software Engineer',
              industry: 'Technology'
            }).catch(error => ({ error }))
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Analyze results
        const successfulResults = results.filter(r => !r.error);
        const errorCount = results.length - successfulResults.length;
        const errorRate = errorCount / results.length;
        const throughput = results.length / (totalTime / 1000);

        performanceByLoad[concurrency] = {
          avgLatency: totalTime / results.length,
          minLatency: totalTime / results.length, // Approximation for concurrent
          maxLatency: totalTime / results.length,
          p50Latency: totalTime / results.length,
          p95Latency: totalTime / results.length,
          p99Latency: totalTime / results.length,
          errorRate,
          throughput,
          successCount: successfulResults.length,
          errorCount
        };

        // Assertions for each load level
        expect(errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.ERROR_RATE_LIMIT);
        expect(throughput).toBeGreaterThan(concurrency * 0.8); // At least 80% efficiency

        console.log(`Load ${concurrency} performance:`, {
          totalTime: `${totalTime}ms`,
          throughput: `${throughput.toFixed(2)} ops/sec`,
          errorRate: `${(errorRate * 100).toFixed(2)}%`,
          successRate: `${((1 - errorRate) * 100).toFixed(2)}%`
        });
      }

      // Verify performance degradation is acceptable
      const baselineThroughput = performanceByLoad[1].throughput;
      const highLoadThroughput = performanceByLoad[50].throughput;
      const degradationRatio = highLoadThroughput / baselineThroughput;

      expect(degradationRatio).toBeGreaterThan(0.6); // Less than 40% degradation under high load
    });
  });

  describe('High-Throughput Performance Testing', () => {
    it('should handle >100 RPS for AI model inference', async () => {
      const testDuration = 10; // seconds
      const targetRPS = 120;
      const totalRequests = targetRPS * testDuration;

      console.log(`\nTesting ${totalRequests} requests over ${testDuration} seconds (target: ${targetRPS} RPS)...`);

      // Mock fast, consistent responses
      mockOpenAIService.generateStructuredResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 40)); // 80-120ms response
        return {
          data: {
            content: 'Generated content for throughput test',
            metrics: {
              engagementScore: 0.75,
              viralityScore: 0.65,
              professionalismScore: 0.85,
              predictedLikes: 150,
              predictedComments: 25,
              predictedShares: 12,
              predictedViews: 2000
            },
            qualityMetrics: {
              coherence: 0.88,
              relevance: 0.91,
              professionalism: 0.94,
              creativity: 0.76,
              linkedinCompliance: 0.96
            },
            improvements: []
          },
          usage: { tokens: 800, cost: 0.01 }
        };
      });

      const startTime = Date.now();
      const requests: Promise<any>[] = [];
      const requestTimes: number[] = [];
      
      // Stagger requests to simulate realistic load
      for (let i = 0; i < totalRequests; i++) {
        const requestStart = Date.now();
        
        const request = contentGenerationService.generateLinkedInPost({
          topic: `Performance test topic ${i}`,
          tone: 'professional',
          industry: 'Technology',
          includeHashtags: true,
          targetAudience: 'professionals',
          contentType: 'insight'
        }).then(result => {
          requestTimes.push(Date.now() - requestStart);
          return result;
        }).catch(error => ({ error }));

        requests.push(request);

        // Add small delay to prevent overwhelming the system
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }

      const results = await Promise.all(requests);
      const endTime = Date.now();
      const actualDuration = (endTime - startTime) / 1000;
      const actualRPS = totalRequests / actualDuration;

      // Analyze results
      const successfulResults = results.filter(r => !r.error);
      const errorCount = results.length - successfulResults.length;
      const errorRate = errorCount / results.length;

      // Calculate latency statistics
      const sortedLatencies = requestTimes.sort((a, b) => a - b);
      const avgLatency = requestTimes.reduce((sum, lat) => sum + lat, 0) / requestTimes.length;
      const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

      // Performance assertions
      expect(actualRPS).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT_TARGET);
      expect(errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.ERROR_RATE_LIMIT);
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.LATENCY_TARGET);
      expect(p95Latency).toBeLessThan(PERFORMANCE_THRESHOLDS.P95_LATENCY_LIMIT);

      console.log('Throughput test results:', {
        targetRPS,
        actualRPS: actualRPS.toFixed(2),
        totalRequests,
        successfulRequests: successfulResults.length,
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        p95Latency: `${p95Latency.toFixed(2)}ms`,
        duration: `${actualDuration.toFixed(2)}s`
      });
    });

    it('should maintain performance during sustained load', async () => {
      const testDuration = 30; // seconds
      const requestsPerSecond = 50;
      const batchSize = 10;
      const batchCount = (testDuration * requestsPerSecond) / batchSize;

      console.log(`\nSustained load test: ${testDuration}s at ${requestsPerSecond} RPS...`);

      const performanceHistory: Array<{
        timestamp: number;
        latency: number;
        throughput: number;
        errorRate: number;
      }> = [];

      // Mock responses
      mockOpenAIService.generateStructuredResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
        return {
          data: { overallScore: 80, recommendations: [], prioritizedActions: [] },
          usage: { tokens: 1000, cost: 0.012 }
        };
      });

      for (let batch = 0; batch < batchCount; batch++) {
        const batchStart = Date.now();
        const batchPromises: Promise<any>[] = [];

        // Create batch of requests
        for (let i = 0; i < batchSize; i++) {
          batchPromises.push(
            profileOptimizationService.optimizeProfile({
              linkedinProfile: profileTestData.moderateProfile,
              completenessData: { score: 70, breakdown: {}, missingFields: [] } as ProfileCompleteness,
              targetRole: 'Software Engineer',
              industry: 'Technology'
            }).catch(error => ({ error }))
          );
        }

        const batchResults = await Promise.all(batchPromises);
        const batchEnd = Date.now();
        const batchDuration = batchEnd - batchStart;

        // Calculate batch metrics
        const successCount = batchResults.filter(r => !r.error).length;
        const errorCount = batchResults.length - successCount;
        const batchThroughput = batchSize / (batchDuration / 1000);
        const batchErrorRate = errorCount / batchSize;

        performanceHistory.push({
          timestamp: batchEnd,
          latency: batchDuration / batchSize,
          throughput: batchThroughput,
          errorRate: batchErrorRate
        });

        // Brief pause between batches to simulate realistic intervals
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Analyze sustained performance
      const avgThroughput = performanceHistory.reduce((sum, h) => sum + h.throughput, 0) / performanceHistory.length;
      const avgLatency = performanceHistory.reduce((sum, h) => sum + h.latency, 0) / performanceHistory.length;
      const avgErrorRate = performanceHistory.reduce((sum, h) => sum + h.errorRate, 0) / performanceHistory.length;

      // Check for performance degradation over time
      const firstHalf = performanceHistory.slice(0, Math.floor(performanceHistory.length / 2));
      const secondHalf = performanceHistory.slice(Math.floor(performanceHistory.length / 2));

      const firstHalfThroughput = firstHalf.reduce((sum, h) => sum + h.throughput, 0) / firstHalf.length;
      const secondHalfThroughput = secondHalf.reduce((sum, h) => sum + h.throughput, 0) / secondHalf.length;
      const throughputDegradation = (firstHalfThroughput - secondHalfThroughput) / firstHalfThroughput;

      // Performance assertions
      expect(avgThroughput).toBeGreaterThan(requestsPerSecond * 0.8); // At least 80% of target
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.LATENCY_TARGET);
      expect(avgErrorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.ERROR_RATE_LIMIT);
      expect(throughputDegradation).toBeLessThan(0.1); // Less than 10% degradation over time

      console.log('Sustained load test results:', {
        targetRPS: requestsPerSecond,
        avgThroughput: avgThroughput.toFixed(2),
        avgLatency: `${avgLatency.toFixed(2)}ms`,
        avgErrorRate: `${(avgErrorRate * 100).toFixed(2)}%`,
        throughputDegradation: `${(throughputDegradation * 100).toFixed(2)}%`,
        totalBatches: batchCount
      });
    });
  });

  describe('Memory Usage and Resource Optimization', () => {
    it('should maintain memory usage within limits during AI operations', async () => {
      const iterations = 100;
      const memorySnapshots: number[] = [];

      console.log('\nMonitoring memory usage during AI operations...');

      // Start memory monitoring
      memoryMonitor.startMonitoring(1000); // Every 1 second

      // Mock memory-efficient responses
      mockOpenAIService.generateStructuredResponse.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          data: { overallScore: 85, recommendations: [], prioritizedActions: [] },
          usage: { tokens: 1200, cost: 0.015 }
        };
      });

      // Perform memory-intensive operations
      for (let i = 0; i < iterations; i++) {
        const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        
        await profileOptimizationService.optimizeProfile({
          linkedinProfile: profileTestData.moderateProfile,
          completenessData: { score: 70, breakdown: {}, missingFields: [] } as ProfileCompleteness,
          targetRole: 'Software Engineer',
          industry: 'Technology'
        });

        const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        memorySnapshots.push(memoryAfter);

        // Force garbage collection every 20 iterations
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      memoryMonitor.stopMonitoring();
      const memoryReport = memoryMonitor.getReport();

      // Calculate memory statistics
      const avgMemoryUsage = memorySnapshots.reduce((sum, mem) => sum + mem, 0) / memorySnapshots.length;
      const maxMemoryUsage = Math.max(...memorySnapshots);
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];

      // Memory assertions
      expect(avgMemoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT);
      expect(maxMemoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT * 1.2); // Allow 20% headroom
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth over test

      console.log('Memory usage results:', {
        avgMemoryUsage: `${avgMemoryUsage.toFixed(2)} MB`,
        maxMemoryUsage: `${maxMemoryUsage.toFixed(2)} MB`,
        memoryGrowth: `${memoryGrowth.toFixed(2)} MB`,
        memoryLimit: `${PERFORMANCE_THRESHOLDS.MEMORY_LIMIT} MB`,
        iterations
      });
    });

    it('should optimize token usage for cost efficiency', async () => {
      const testCases = [
        { operation: 'profile-optimization', expectedTokens: 1500 },
        { operation: 'content-generation', expectedTokens: 1200 },
        { operation: 'headline-generation', expectedTokens: 800 }
      ];

      const tokenUsageResults: { [operation: string]: TokenUsageMetrics } = {};

      for (const testCase of testCases) {
        const tokenUsages: number[] = [];
        const costs: number[] = [];

        // Mock token-efficient responses
        mockOpenAIService.generateStructuredResponse.mockImplementation(async () => {
          const actualTokens = testCase.expectedTokens * (0.8 + Math.random() * 0.4); // ±20% variation
          const cost = actualTokens * 0.000002; // Approximate GPT-4 pricing
          
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            data: { overallScore: 85, recommendations: [], prioritizedActions: [] },
            usage: { tokens: actualTokens, cost }
          };
        });

        // Run multiple iterations to gather token usage data
        for (let i = 0; i < 20; i++) {
          let result;
          
          if (testCase.operation === 'profile-optimization') {
            result = await profileOptimizationService.optimizeProfile({
              linkedinProfile: profileTestData.moderateProfile,
              completenessData: { score: 70, breakdown: {}, missingFields: [] } as ProfileCompleteness,
              targetRole: 'Software Engineer',
              industry: 'Technology'
            });
          } else if (testCase.operation === 'content-generation') {
            result = await contentGenerationService.generateLinkedInPost({
              topic: 'Token efficiency test',
              tone: 'professional',
              industry: 'Technology',
              includeHashtags: true,
              targetAudience: 'professionals',
              contentType: 'insight'
            });
          } else {
            result = await profileOptimizationService.generateHeadlines({
              linkedinProfile: profileTestData.moderateProfile,
              targetRole: 'Software Engineer',
              industry: 'Technology'
            });
          }

          if (result.usage) {
            tokenUsages.push(result.usage.tokens);
            costs.push(result.usage.cost);
          }
        }

        // Calculate token efficiency metrics
        const avgTokens = tokenUsages.reduce((sum, tokens) => sum + tokens, 0) / tokenUsages.length;
        const avgCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
        const tokenEfficiency = avgTokens / testCase.expectedTokens;

        tokenUsageResults[testCase.operation] = {
          avgTokens,
          avgCost,
          tokenEfficiency,
          maxTokens: Math.max(...tokenUsages),
          minTokens: Math.min(...tokenUsages),
          costPerToken: avgCost / avgTokens
        };

        // Token efficiency assertions
        expect(tokenEfficiency).toBeGreaterThan(PERFORMANCE_THRESHOLDS.TOKEN_EFFICIENCY_TARGET);
        expect(avgTokens).toBeLessThan(testCase.expectedTokens * 1.2); // Within 20% of expected

        console.log(`${testCase.operation} token usage:`, {
          avgTokens: avgTokens.toFixed(0),
          expectedTokens: testCase.expectedTokens,
          efficiency: `${(tokenEfficiency * 100).toFixed(1)}%`,
          avgCost: `$${avgCost.toFixed(4)}`,
          costPerToken: `$${tokenUsageResults[testCase.operation].costPerToken.toFixed(8)}`
        });
      }

      // Overall token efficiency check
      const overallEfficiency = Object.values(tokenUsageResults)
        .reduce((sum, metrics) => sum + metrics.tokenEfficiency, 0) / Object.keys(tokenUsageResults).length;
      
      expect(overallEfficiency).toBeGreaterThan(PERFORMANCE_THRESHOLDS.TOKEN_EFFICIENCY_TARGET);
    });
  });
});

// Helper function to execute test operations
async function executeTestOperation(
  testCase: { service: string; operation: string },
  profileService: ProfileOptimizationService,
  contentService: ContentGenerationService
): Promise<any> {
  if (testCase.service === 'profile-optimization') {
    return profileService.optimizeProfile({
      linkedinProfile: profileTestData.moderateProfile,
      completenessData: { score: 70, breakdown: {}, missingFields: [] } as ProfileCompleteness,
      targetRole: 'Software Engineer',
      industry: 'Technology'
    });
  } else if (testCase.service === 'content-generation') {
    return contentService.generateLinkedInPost({
      topic: 'Performance test',
      tone: 'professional',
      industry: 'Technology',
      includeHashtags: true,
      targetAudience: 'professionals',
      contentType: 'insight'
    });
  } else if (testCase.service === 'headline-generation') {
    return profileService.generateHeadlines({
      linkedinProfile: profileTestData.moderateProfile,
      targetRole: 'Software Engineer',
      industry: 'Technology'
    });
  }
  
  throw new Error(`Unknown test operation: ${testCase.operation}`);
}

// Performance metrics interfaces
interface PerformanceMetrics {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number;
  successCount: number;
  errorCount: number;
}

interface TokenUsageMetrics {
  avgTokens: number;
  avgCost: number;
  tokenEfficiency: number;
  maxTokens: number;
  minTokens: number;
  costPerToken: number;
}