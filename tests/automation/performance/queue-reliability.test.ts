/**
 * Queue Reliability and Load Testing
 * 
 * Tests automation queue performance under stress conditions:
 * - High-volume job scheduling (1000+ jobs/minute)
 * - Queue processing reliability and throughput
 * - Redis performance under load
 * - Queue recovery after failures
 * - Priority queue management under stress
 * - Memory and resource usage monitoring
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import Redis from 'ioredis';
import { performance } from 'perf_hooks';

// Queue testing interfaces
interface QueueJob {
  id: string;
  type: 'connection' | 'engagement' | 'content_generation' | 'analytics';
  priority: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  data: any;
  scheduledAt: number;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retry';
  createdAt: number;
  processedAt?: number;
  error?: string;
}

interface QueueMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingJobs: number;
  processingJobs: number;
  averageProcessingTime: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  throughputPerSecond: number;
  errorRate: number;
  queueDepth: number;
  memoryUsage: NodeJS.MemoryUsage;
}

interface StressTestConfig {
  jobsPerSecond: number;
  testDurationMs: number;
  maxQueueDepth: number;
  expectedThroughput: number;
  maxErrorRate: number;
  maxProcessingTimeMs: number;
  concurrentWorkers: number;
}

const STRESS_TEST_CONFIGS = {
  light: {
    jobsPerSecond: 10,
    testDurationMs: 60000, // 1 minute
    maxQueueDepth: 100,
    expectedThroughput: 8, // jobs/second
    maxErrorRate: 0.05,
    maxProcessingTimeMs: 1000,
    concurrentWorkers: 2
  },
  moderate: {
    jobsPerSecond: 50,
    testDurationMs: 120000, // 2 minutes
    maxQueueDepth: 500,
    expectedThroughput: 40,
    maxErrorRate: 0.10,
    maxProcessingTimeMs: 2000,
    concurrentWorkers: 5
  },
  heavy: {
    jobsPerSecond: 200,
    testDurationMs: 300000, // 5 minutes
    maxQueueDepth: 2000,
    expectedThroughput: 150,
    maxErrorRate: 0.15,
    maxProcessingTimeMs: 5000,
    concurrentWorkers: 10
  },
  extreme: {
    jobsPerSecond: 500,
    testDurationMs: 180000, // 3 minutes
    maxQueueDepth: 5000,
    expectedThroughput: 300,
    maxErrorRate: 0.20,
    maxProcessingTimeMs: 10000,
    concurrentWorkers: 20
  }
};

// Queue reliability tester
class QueueReliabilityTester {
  private redis: Redis;
  private jobs: Map<string, QueueJob> = new Map();
  private metrics: QueueMetrics[] = [];
  private workers: Worker[] = [];
  private isRunning: boolean = false;
  private metricsInterval?: NodeJS.Timeout;

  constructor(private queueName: string = 'automation:test:queue') {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_TEST_DB || '1'), // Use test database
      maxRetriesPerRequest: 3,
      retryDelayOnFailure: (attempt) => Math.min(attempt * 50, 2000),
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
    console.log('✅ Connected to Redis for queue testing');
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;
    await this.stopWorkers();
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    await this.redis.disconnect();
    console.log('🔌 Disconnected from Redis');
  }

  async clearQueue(): Promise<void> {
    await this.redis.del(this.queueName);
    await this.redis.del(`${this.queueName}:processing`);
    await this.redis.del(`${this.queueName}:completed`);
    await this.redis.del(`${this.queueName}:failed`);
    this.jobs.clear();
    console.log('🧹 Queue cleared');
  }

  createJob(type: QueueJob['type'], priority: QueueJob['priority'], userId: string): QueueJob {
    const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const jobData = this.generateJobData(type, userId);
    
    const job: QueueJob = {
      id: jobId,
      type,
      priority,
      userId,
      data: jobData,
      scheduledAt: Date.now() + this.getDelayForPriority(priority),
      attempts: 0,
      status: 'pending',
      createdAt: performance.now()
    };

    this.jobs.set(jobId, job);
    return job;
  }

  private generateJobData(type: QueueJob['type'], userId: string): any {
    switch (type) {
      case 'connection':
        return {
          targetId: `target_${Math.floor(Math.random() * 10000)}`,
          targetName: `Test Target ${Math.floor(Math.random() * 1000)}`,
          message: `Connection request from load test user ${userId}`,
          scheduledFor: Date.now() + Math.random() * 3600000 // Within 1 hour
        };
      
      case 'engagement':
        return {
          targetId: `post_${Math.floor(Math.random() * 10000)}`,
          targetName: `LinkedIn Post ${Math.floor(Math.random() * 1000)}`,
          action: ['like', 'comment', 'view_profile'][Math.floor(Math.random() * 3)],
          content: Math.random() > 0.5 ? `Great insight! Load test comment ${Math.floor(Math.random() * 1000)}` : undefined,
          scheduledFor: Date.now() + Math.random() * 1800000 // Within 30 minutes
        };
      
      case 'content_generation':
        return {
          contentType: ['post', 'banner', 'carousel'][Math.floor(Math.random() * 3)],
          topic: `Load test topic ${Math.floor(Math.random() * 100)}`,
          tone: ['professional', 'casual', 'enthusiastic'][Math.floor(Math.random() * 3)],
          targetAudience: 'professionals'
        };
      
      case 'analytics':
        return {
          reportType: ['daily', 'weekly', 'monthly'][Math.floor(Math.random() * 3)],
          metrics: ['engagement', 'reach', 'connections', 'profile_views'],
          dateRange: {
            start: Date.now() - 7 * 24 * 60 * 60 * 1000,
            end: Date.now()
          }
        };
      
      default:
        return { test: true };
    }
  }

  private getDelayForPriority(priority: QueueJob['priority']): number {
    switch (priority) {
      case 'critical': return 0; // Immediate
      case 'high': return Math.random() * 30000; // 0-30 seconds
      case 'medium': return Math.random() * 300000; // 0-5 minutes
      case 'low': return Math.random() * 1800000; // 0-30 minutes
      default: return 60000; // 1 minute default
    }
  }

  async enqueueJob(job: QueueJob): Promise<void> {
    const jobData = JSON.stringify(job);
    
    // Add to appropriate priority queue
    const priorityScore = this.getPriorityScore(job.priority);
    await this.redis.zadd(this.queueName, priorityScore, jobData);
    
    // Track in processing metrics
    job.status = 'pending';
    this.jobs.set(job.id, job);
  }

  private getPriorityScore(priority: QueueJob['priority']): number {
    const scores = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };
    
    // Add timestamp component for FIFO within priority level
    return scores[priority] * 1000000 + (Date.now() % 1000000);
  }

  async bulkEnqueueJobs(jobs: QueueJob[]): Promise<void> {
    if (jobs.length === 0) return;

    const pipeline = this.redis.pipeline();
    
    jobs.forEach(job => {
      const jobData = JSON.stringify(job);
      const priorityScore = this.getPriorityScore(job.priority);
      pipeline.zadd(this.queueName, priorityScore, jobData);
      
      job.status = 'pending';
      this.jobs.set(job.id, job);
    });

    await pipeline.exec();
  }

  async startWorkers(workerCount: number): Promise<void> {
    console.log(`🔄 Starting ${workerCount} queue workers...`);
    
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(i, this.redis, this.queueName, this.jobs);
      this.workers.push(worker);
      worker.start();
    }
  }

  async stopWorkers(): Promise<void> {
    console.log('⏹️ Stopping queue workers...');
    
    const stopPromises = this.workers.map(worker => worker.stop());
    await Promise.all(stopPromises);
    
    this.workers = [];
  }

  startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.collectCurrentMetrics();
      this.metrics.push(metrics);
      
      console.log(`📊 Queue Metrics: ${metrics.pendingJobs} pending, ` +
        `${metrics.processingJobs} processing, ` +
        `${metrics.completedJobs} completed, ` +
        `${metrics.throughputPerSecond.toFixed(2)} jobs/sec, ` +
        `${(metrics.errorRate * 100).toFixed(2)}% errors`);
    }, 5000); // Every 5 seconds
  }

  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  collectCurrentMetrics(): QueueMetrics {
    const allJobs = Array.from(this.jobs.values());
    
    const completedJobs = allJobs.filter(j => j.status === 'completed');
    const failedJobs = allJobs.filter(j => j.status === 'failed');
    const pendingJobs = allJobs.filter(j => j.status === 'pending');
    const processingJobs = allJobs.filter(j => j.status === 'processing');

    const processingTimes = completedJobs
      .filter(j => j.processedAt)
      .map(j => j.processedAt! - j.createdAt)
      .sort((a, b) => a - b);

    return {
      totalJobs: allJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      pendingJobs: pendingJobs.length,
      processingJobs: processingJobs.length,
      averageProcessingTime: processingTimes.length > 0 ?
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length : 0,
      p95ProcessingTime: processingTimes.length > 0 ?
        processingTimes[Math.floor(processingTimes.length * 0.95)] : 0,
      p99ProcessingTime: processingTimes.length > 0 ?
        processingTimes[Math.floor(processingTimes.length * 0.99)] : 0,
      throughputPerSecond: this.calculateThroughput(),
      errorRate: allJobs.length > 0 ? failedJobs.length / allJobs.length : 0,
      queueDepth: pendingJobs.length + processingJobs.length,
      memoryUsage: process.memoryUsage()
    };
  }

  private calculateThroughput(): number {
    if (this.metrics.length < 2) return 0;
    
    const recent = this.metrics.slice(-2);
    const timeDiff = 5; // 5 second intervals
    const jobsDiff = recent[1].completedJobs - recent[0].completedJobs;
    
    return jobsDiff / timeDiff;
  }

  async getQueueDepth(): Promise<number> {
    return await this.redis.zcard(this.queueName);
  }

  getMetricsHistory(): QueueMetrics[] {
    return [...this.metrics];
  }

  getFinalMetrics(): QueueMetrics {
    return this.collectCurrentMetrics();
  }
}

// Queue worker implementation
class Worker {
  private isRunning: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  constructor(
    private id: number,
    private redis: Redis,
    private queueName: string,
    private jobs: Map<string, QueueJob>
  ) {}

  start(): void {
    this.isRunning = true;
    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, 100); // Check for jobs every 100ms
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  private async processJobs(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Get highest priority job
      const result = await this.redis.zpopmax(this.queueName);
      
      if (!result || result.length === 0) {
        return; // No jobs available
      }

      const jobData = result[0];
      const job: QueueJob = JSON.parse(jobData);
      
      // Update job status
      job.status = 'processing';
      job.attempts++;
      this.jobs.set(job.id, job);

      // Simulate job processing
      const processingTime = await this.simulateJobProcessing(job);
      
      // Determine if job succeeds or fails
      const shouldFail = Math.random() < this.getFailureRate(job);
      
      if (shouldFail) {
        job.status = 'failed';
        job.error = `Simulated failure for ${job.type} job`;
        
        // Retry logic for failed jobs
        if (job.attempts < 3) {
          job.status = 'retry';
          // Re-queue with lower priority
          const retryScore = this.getPriorityScore('low');
          await this.redis.zadd(this.queueName, retryScore, JSON.stringify(job));
        }
      } else {
        job.status = 'completed';
        job.processedAt = performance.now();
      }

      this.jobs.set(job.id, job);

    } catch (error) {
      console.error(`Worker ${this.id} error:`, error.message);
    }
  }

  private async simulateJobProcessing(job: QueueJob): Promise<number> {
    const baseTime = this.getBaseProcessingTime(job.type);
    const jitter = Math.random() * 200; // 0-200ms jitter
    const processingTime = baseTime + jitter;
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return processingTime;
  }

  private getBaseProcessingTime(type: QueueJob['type']): number {
    const baseTimes = {
      connection: 500,        // 500ms base
      engagement: 300,        // 300ms base
      content_generation: 2000, // 2s base (AI generation)
      analytics: 1000         // 1s base
    };
    
    return baseTimes[type] || 500;
  }

  private getFailureRate(job: QueueJob): number {
    // Different failure rates by job type and attempts
    const baseRates = {
      connection: 0.05,        // 5% base failure rate
      engagement: 0.03,        // 3% base failure rate
      content_generation: 0.15, // 15% base failure rate (AI can fail)
      analytics: 0.08          // 8% base failure rate
    };
    
    const attemptMultiplier = Math.pow(1.5, job.attempts - 1); // Increase with retries
    return Math.min(baseRates[job.type] * attemptMultiplier, 0.5); // Cap at 50%
  }

  private getPriorityScore(priority: QueueJob['priority']): number {
    const scores = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };
    
    return scores[priority] * 1000000 + (Date.now() % 1000000);
  }
}

// Test utilities
const generateTestJobs = (count: number, distribution?: Partial<Record<QueueJob['type'], number>>): QueueJob[] => {
  const defaultDistribution = {
    connection: 0.4,        // 40% connection jobs
    engagement: 0.35,       // 35% engagement jobs
    content_generation: 0.15, // 15% content generation
    analytics: 0.10         // 10% analytics
  };
  
  const dist = { ...defaultDistribution, ...distribution };
  const jobs: QueueJob[] = [];
  
  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let type: QueueJob['type'];
    
    if (rand < dist.connection) {
      type = 'connection';
    } else if (rand < dist.connection + dist.engagement) {
      type = 'engagement';
    } else if (rand < dist.connection + dist.engagement + dist.content_generation) {
      type = 'content_generation';
    } else {
      type = 'analytics';
    }
    
    const priority = ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as QueueJob['priority'];
    const userId = `load_test_user_${Math.floor(Math.random() * 1000)}`;
    
    const tester = new QueueReliabilityTester(); // Temporary instance for job creation
    const job = tester.createJob(type, priority, userId);
    jobs.push(job);
  }
  
  return jobs;
};

describe('Queue Reliability and Load Tests', () => {
  let tester: QueueReliabilityTester;

  beforeAll(async () => {
    // Verify Redis is available
    const testRedis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true
    });
    
    try {
      await testRedis.connect();
      await testRedis.ping();
      await testRedis.disconnect();
    } catch (error) {
      throw new Error(`Redis not available: ${error.message}`);
    }
  }, 30000);

  beforeEach(async () => {
    tester = new QueueReliabilityTester(`test:queue:${Date.now()}`);
    await tester.connect();
    await tester.clearQueue();
  });

  afterEach(async () => {
    if (tester) {
      tester.stopMetricsCollection();
      await tester.disconnect();
    }
  });

  test('should handle light load (10 jobs/second)', async () => {
    const config = STRESS_TEST_CONFIGS.light;
    
    console.log(`🚀 Starting light load test: ${config.jobsPerSecond} jobs/second for ${config.testDurationMs/1000}s`);
    
    await tester.startWorkers(config.concurrentWorkers);
    tester.startMetricsCollection();
    
    // Generate and enqueue jobs at specified rate
    const jobInterval = 1000 / config.jobsPerSecond; // ms between jobs
    const totalJobs = Math.floor(config.testDurationMs / jobInterval);
    
    for (let i = 0; i < totalJobs; i++) {
      const jobs = generateTestJobs(1);
      await tester.bulkEnqueueJobs(jobs);
      
      if (i < totalJobs - 1) {
        await new Promise(resolve => setTimeout(resolve, jobInterval));
      }
    }
    
    // Wait for job processing to complete
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const finalMetrics = tester.getFinalMetrics();
    
    // Assertions
    expect(finalMetrics.totalJobs).toBe(totalJobs);
    expect(finalMetrics.completedJobs).toBeGreaterThanOrEqual(totalJobs * 0.9); // 90% success rate
    expect(finalMetrics.errorRate).toBeLessThan(config.maxErrorRate);
    expect(finalMetrics.averageProcessingTime).toBeLessThan(config.maxProcessingTimeMs);
    expect(finalMetrics.queueDepth).toBeLessThan(config.maxQueueDepth);
    
    console.log(`✅ Light load test complete:`, {
      totalJobs: finalMetrics.totalJobs,
      completed: finalMetrics.completedJobs,
      failed: finalMetrics.failedJobs,
      avgProcessingTime: finalMetrics.averageProcessingTime.toFixed(2) + 'ms',
      errorRate: (finalMetrics.errorRate * 100).toFixed(2) + '%',
      finalQueueDepth: finalMetrics.queueDepth
    });
  }, 120000);

  test('should handle moderate load (50 jobs/second)', async () => {
    const config = STRESS_TEST_CONFIGS.moderate;
    
    console.log(`🚀 Starting moderate load test: ${config.jobsPerSecond} jobs/second`);
    
    await tester.startWorkers(config.concurrentWorkers);
    tester.startMetricsCollection();
    
    // Use bulk operations for better performance
    const batchSize = 10;
    const jobInterval = (1000 / config.jobsPerSecond) * batchSize;
    const totalBatches = Math.floor(config.testDurationMs / jobInterval);
    
    for (let i = 0; i < totalBatches; i++) {
      const jobs = generateTestJobs(batchSize);
      await tester.bulkEnqueueJobs(jobs);
      
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, jobInterval));
      }
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const finalMetrics = tester.getFinalMetrics();
    const expectedJobs = totalBatches * batchSize;
    
    expect(finalMetrics.totalJobs).toBe(expectedJobs);
    expect(finalMetrics.completedJobs).toBeGreaterThanOrEqual(expectedJobs * 0.85); // 85% success rate
    expect(finalMetrics.errorRate).toBeLessThan(config.maxErrorRate);
    expect(finalMetrics.averageProcessingTime).toBeLessThan(config.maxProcessingTimeMs);
    
    console.log(`✅ Moderate load test complete:`, {
      totalJobs: finalMetrics.totalJobs,
      completed: finalMetrics.completedJobs,
      throughput: finalMetrics.throughputPerSecond.toFixed(2) + ' jobs/sec',
      p95ProcessingTime: finalMetrics.p95ProcessingTime.toFixed(2) + 'ms',
      errorRate: (finalMetrics.errorRate * 100).toFixed(2) + '%'
    });
  }, 180000);

  test('should handle heavy load (200 jobs/second)', async () => {
    const config = STRESS_TEST_CONFIGS.heavy;
    
    console.log(`🚀 Starting heavy load test: ${config.jobsPerSecond} jobs/second`);
    
    await tester.startWorkers(config.concurrentWorkers);
    tester.startMetricsCollection();
    
    // Larger batches for high throughput
    const batchSize = 25;
    const jobInterval = (1000 / config.jobsPerSecond) * batchSize;
    const totalBatches = Math.floor(config.testDurationMs / jobInterval);
    
    for (let i = 0; i < totalBatches; i++) {
      const jobs = generateTestJobs(batchSize);
      await tester.bulkEnqueueJobs(jobs);
      
      // Monitor queue depth to prevent overflow
      const queueDepth = await tester.getQueueDepth();
      if (queueDepth > config.maxQueueDepth) {
        console.warn(`⚠️ Queue depth exceeded: ${queueDepth}. Throttling...`);
        await new Promise(resolve => setTimeout(resolve, jobInterval * 2));
      } else if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, jobInterval));
      }
    }
    
    // Extended wait for processing under heavy load
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const finalMetrics = tester.getFinalMetrics();
    const expectedJobs = totalBatches * batchSize;
    
    expect(finalMetrics.totalJobs).toBe(expectedJobs);
    expect(finalMetrics.completedJobs).toBeGreaterThanOrEqual(expectedJobs * 0.80); // 80% success rate under heavy load
    expect(finalMetrics.errorRate).toBeLessThan(config.maxErrorRate);
    expect(finalMetrics.throughputPerSecond).toBeGreaterThanOrEqual(config.expectedThroughput * 0.8);
    
    // Memory usage should be reasonable
    const memoryUsageMB = finalMetrics.memoryUsage.heapUsed / (1024 * 1024);
    expect(memoryUsageMB).toBeLessThan(1024); // Less than 1GB
    
    console.log(`✅ Heavy load test complete:`, {
      totalJobs: finalMetrics.totalJobs,
      completed: finalMetrics.completedJobs,
      throughput: finalMetrics.throughputPerSecond.toFixed(2) + ' jobs/sec',
      p99ProcessingTime: finalMetrics.p99ProcessingTime.toFixed(2) + 'ms',
      errorRate: (finalMetrics.errorRate * 100).toFixed(2) + '%',
      memoryUsageMB: memoryUsageMB.toFixed(2) + 'MB'
    });
  }, 360000);

  test('should recover from worker failures', async () => {
    console.log(`🚀 Starting worker failure recovery test`);
    
    await tester.startWorkers(5);
    tester.startMetricsCollection();
    
    // Enqueue initial jobs
    const initialJobs = generateTestJobs(100);
    await tester.bulkEnqueueJobs(initialJobs);
    
    // Let workers process some jobs
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const midMetrics = tester.collectCurrentMetrics();
    
    // Simulate worker failures by stopping all workers
    console.log('🔥 Simulating worker failures...');
    await tester.stopWorkers();
    
    // Add more jobs while workers are down
    const additionalJobs = generateTestJobs(50);
    await tester.bulkEnqueueJobs(additionalJobs);
    
    // Wait briefly
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Restart workers (simulating recovery)
    console.log('🔄 Restarting workers...');
    await tester.startWorkers(3); // Fewer workers to test resilience
    
    // Wait for recovery processing
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const finalMetrics = tester.getFinalMetrics();
    
    // Verify recovery
    expect(finalMetrics.totalJobs).toBe(150); // All jobs accounted for
    expect(finalMetrics.completedJobs).toBeGreaterThanOrEqual(120); // 80% completion despite failures
    expect(finalMetrics.queueDepth).toBeLessThan(20); // Most jobs processed
    
    console.log(`✅ Worker failure recovery test complete:`, {
      initialJobs: 100,
      additionalJobs: 50,
      completedBeforeFailure: midMetrics.completedJobs,
      finalCompleted: finalMetrics.completedJobs,
      remainingInQueue: finalMetrics.queueDepth
    });
  }, 60000);

  test('should maintain priority ordering under load', async () => {
    console.log(`🚀 Starting priority ordering test`);
    
    await tester.startWorkers(2); // Limited workers to create backlog
    tester.startMetricsCollection();
    
    // Create jobs with mixed priorities
    const jobs: QueueJob[] = [];
    
    // Add low priority jobs first
    for (let i = 0; i < 20; i++) {
      const job = tester.createJob('connection', 'low', `user_${i}`);
      jobs.push(job);
    }
    
    // Add medium priority jobs
    for (let i = 0; i < 15; i++) {
      const job = tester.createJob('engagement', 'medium', `user_${i + 20}`);
      jobs.push(job);
    }
    
    // Add high priority jobs
    for (let i = 0; i < 10; i++) {
      const job = tester.createJob('content_generation', 'high', `user_${i + 35}`);
      jobs.push(job);
    }
    
    // Add critical priority jobs
    for (let i = 0; i < 5; i++) {
      const job = tester.createJob('analytics', 'critical', `user_${i + 45}`);
      jobs.push(job);
    }
    
    // Shuffle jobs to ensure priority, not order, determines processing
    const shuffledJobs = jobs.sort(() => Math.random() - 0.5);
    await tester.bulkEnqueueJobs(shuffledJobs);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const finalMetrics = tester.getFinalMetrics();
    
    // Analyze processing order by priority
    const completedJobs = Array.from(tester['jobs'].values())
      .filter(job => job.status === 'completed')
      .sort((a, b) => (a.processedAt || 0) - (b.processedAt || 0));
    
    // Verify higher priority jobs were processed first
    const firstTenJobs = completedJobs.slice(0, 10);
    const criticalAndHighJobs = firstTenJobs.filter(job => 
      job.priority === 'critical' || job.priority === 'high'
    );
    
    expect(criticalAndHighJobs.length).toBeGreaterThanOrEqual(8); // At least 80% high priority in first batch
    expect(finalMetrics.completedJobs).toBeGreaterThanOrEqual(40); // Most jobs completed
    
    console.log(`✅ Priority ordering test complete:`, {
      totalJobs: finalMetrics.totalJobs,
      completed: finalMetrics.completedJobs,
      highPriorityInFirstTen: criticalAndHighJobs.length,
      priorityDistribution: {
        critical: completedJobs.filter(j => j.priority === 'critical').length,
        high: completedJobs.filter(j => j.priority === 'high').length,
        medium: completedJobs.filter(j => j.priority === 'medium').length,
        low: completedJobs.filter(j => j.priority === 'low').length,
      }
    });
  }, 60000);

  test('should handle burst traffic patterns', async () => {
    console.log(`🚀 Starting burst traffic pattern test`);
    
    await tester.startWorkers(8);
    tester.startMetricsCollection();
    
    // Simulate burst patterns: quiet -> burst -> quiet -> burst
    const patterns = [
      { jobsPerSecond: 5, duration: 10000 },   // Quiet period
      { jobsPerSecond: 100, duration: 5000 },  // Burst
      { jobsPerSecond: 10, duration: 10000 },  // Recovery
      { jobsPerSecond: 150, duration: 3000 },  // Larger burst
      { jobsPerSecond: 5, duration: 5000 }     // Final quiet
    ];
    
    let totalJobsScheduled = 0;
    
    for (const pattern of patterns) {
      console.log(`📈 Pattern: ${pattern.jobsPerSecond} jobs/sec for ${pattern.duration/1000}s`);
      
      const jobInterval = 1000 / pattern.jobsPerSecond;
      const jobCount = Math.floor(pattern.duration / jobInterval);
      
      for (let i = 0; i < jobCount; i++) {
        const jobs = generateTestJobs(1);
        await tester.bulkEnqueueJobs(jobs);
        totalJobsScheduled++;
        
        if (i < jobCount - 1) {
          await new Promise(resolve => setTimeout(resolve, jobInterval));
        }
      }
    }
    
    // Wait for all jobs to process
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    const finalMetrics = tester.getFinalMetrics();
    const metricsHistory = tester.getMetricsHistory();
    
    // Verify system handled bursts
    expect(finalMetrics.totalJobs).toBe(totalJobsScheduled);
    expect(finalMetrics.completedJobs).toBeGreaterThanOrEqual(totalJobsScheduled * 0.85);
    expect(finalMetrics.errorRate).toBeLessThan(0.15); // Allow higher error rate during bursts
    
    // Verify throughput peaked during bursts
    const maxThroughput = Math.max(...metricsHistory.map(m => m.throughputPerSecond));
    expect(maxThroughput).toBeGreaterThanOrEqual(50); // Should achieve high throughput during bursts
    
    console.log(`✅ Burst traffic test complete:`, {
      totalScheduled: totalJobsScheduled,
      completed: finalMetrics.completedJobs,
      maxThroughput: maxThroughput.toFixed(2) + ' jobs/sec',
      finalErrorRate: (finalMetrics.errorRate * 100).toFixed(2) + '%',
      finalQueueDepth: finalMetrics.queueDepth
    });
  }, 120000);
});