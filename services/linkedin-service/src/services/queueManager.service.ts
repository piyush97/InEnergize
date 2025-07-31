import Queue from 'bull';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface QueueJob {
  id: string;
  userId: string;
  type: 'connection' | 'engagement' | 'profile_view' | 'follow';
  priority: 'low' | 'normal' | 'high' | 'critical';
  data: any;
  scheduledAt?: Date;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface QueueStats {
  total: number;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface UserQueueStatus {
  userId: string;
  queues: {
    [queueName: string]: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      estimatedWaitTime: number; // minutes
    };
  };
  totalJobs: number;
  nextJobTime?: Date;
  automationEnabled: boolean;
  lastActivity?: Date;
}

export class QueueManagerService extends EventEmitter {
  private redis: Redis;
  private queues: Map<string, Queue.Queue>;
  private queueNames = [
    'linkedin-connections-high',
    'linkedin-connections-normal', 
    'linkedin-connections-low',
    'linkedin-engagement-high',
    'linkedin-engagement-normal',
    'linkedin-engagement-low',
    'linkedin-profile-views',
    'linkedin-follows'
  ];

  // Ultra-conservative processing rates (Phase 3)
  private readonly PROCESSING_RATES = {
    'linkedin-connections-high': {
      concurrency: 1,
      delay: 180000,      // 3 minutes between connection requests
      maxPerHour: 3,      // Maximum 3 connection requests per hour
      maxPerDay: 15       // Maximum 15 connection requests per day
    },
    'linkedin-connections-normal': {
      concurrency: 1,
      delay: 300000,      // 5 minutes between requests
      maxPerHour: 2,
      maxPerDay: 10
    },
    'linkedin-connections-low': {
      concurrency: 1,
      delay: 600000,      // 10 minutes between requests
      maxPerHour: 1,
      maxPerDay: 5
    },
    'linkedin-engagement-high': {
      concurrency: 1,
      delay: 120000,      // 2 minutes between engagement actions
      maxPerHour: 10,     // Maximum 10 engagement actions per hour
      maxPerDay: 30       // Maximum 30 engagement actions per day
    },
    'linkedin-engagement-normal': {
      concurrency: 1,
      delay: 180000,      // 3 minutes between actions
      maxPerHour: 8,
      maxPerDay: 25
    },
    'linkedin-engagement-low': {
      concurrency: 1,
      delay: 300000,      // 5 minutes between actions
      maxPerHour: 5,
      maxPerDay: 15
    },
    'linkedin-profile-views': {
      concurrency: 1,
      delay: 240000,      // 4 minutes between profile views
      maxPerHour: 6,      // Maximum 6 profile views per hour
      maxPerDay: 25       // Maximum 25 profile views per day
    },
    'linkedin-follows': {
      concurrency: 1,
      delay: 600000,      // 10 minutes between follows
      maxPerHour: 1,      // Maximum 1 follow per hour
      maxPerDay: 5        // Maximum 5 follows per day
    }
  };

  constructor() {
    super();
    
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.queues = new Map();
    this.initializeQueues();
    this.startGlobalMonitoring();
    
    console.log('Queue Manager Service initialized with ultra-conservative processing rates');
  }

  /**
   * Initialize all LinkedIn automation queues
   */
  private initializeQueues(): void {
    for (const queueName of this.queueNames) {
      const queue = new Queue(queueName, {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100,   // Keep last 100 completed jobs
          removeOnFail: 50,        // Keep last 50 failed jobs
          attempts: 3,             // Maximum 3 retry attempts
          backoff: {
            type: 'exponential',
            delay: 60000,          // Start with 1 minute backoff
          },
        },
      });

      // Set up queue processors with ultra-conservative rates
      const config = this.PROCESSING_RATES[queueName as keyof typeof this.PROCESSING_RATES];
      if (config) {
        queue.process(config.concurrency, async (job) => {
          return await this.processJob(queueName, job);
        });

        // Add rate limiting configuration
        queue.settings = {
          ...queue.settings,
          maxStalledCount: 1,
          stalledInterval: 30 * 1000,
          retryProcessDelay: 5 * 1000,
        };
      }

      // Set up event listeners for monitoring
      this.setupQueueEventListeners(queueName, queue);
      
      this.queues.set(queueName, queue);
    }
  }

  /**
   * Setup event listeners for queue monitoring and WebSocket updates
   */
  private setupQueueEventListeners(queueName: string, queue: Queue.Queue): void {
    queue.on('active', (job) => {
      console.log(`Job ${job.id} started in queue ${queueName}`);
      this.emitQueueUpdate(queueName, 'job_started', { jobId: job.id, userId: job.data.userId });
    });

    queue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed in queue ${queueName}`);
      this.emitQueueUpdate(queueName, 'job_completed', { 
        jobId: job.id, 
        userId: job.data.userId, 
        result 
      });
    });

    queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed in queue ${queueName}:`, err.message);
      this.emitQueueUpdate(queueName, 'job_failed', { 
        jobId: job.id, 
        userId: job.data.userId, 
        error: err.message 
      });
    });

    queue.on('stalled', (job) => {
      console.warn(`Job ${job.id} stalled in queue ${queueName}`);
      this.emitQueueUpdate(queueName, 'job_stalled', { jobId: job.id, userId: job.data.userId });
    });

    queue.on('progress', (job, progress) => {
      this.emitQueueUpdate(queueName, 'job_progress', { 
        jobId: job.id, 
        userId: job.data.userId, 
        progress 
      });
    });
  }

  /**
   * Add job to appropriate queue with safety checks
   */
  async addJob(
    userId: string,
    type: 'connection' | 'engagement' | 'profile_view' | 'follow',
    data: any,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      delay?: number;
      scheduledAt?: Date;
      maxRetries?: number;
    } = {}
  ): Promise<{ success: boolean; jobId?: string; reason?: string; retryAfter?: number }> {
    try {
      // Check if user automation is suspended
      const suspended = await this.isUserAutomationSuspended(userId);
      if (suspended.suspended) {
        return {
          success: false,
          reason: `Automation suspended: ${suspended.reason}`,
          retryAfter: 24 * 60 * 60 // 24 hours
        };
      }

      // Determine queue name based on type and priority
      const queueName = this.getQueueName(type, options.priority || 'normal');
      const queue = this.queues.get(queueName);
      
      if (!queue) {
        return {
          success: false,
          reason: 'Queue not found'
        };
      }

      // Check daily limits for this queue type
      const dailyCheck = await this.checkDailyLimits(userId, queueName);
      if (!dailyCheck.allowed) {
        return {
          success: false,
          reason: dailyCheck.reason,
          retryAfter: dailyCheck.retryAfter
        };
      }

      // Check hourly limits
      const hourlyCheck = await this.checkHourlyLimits(userId, queueName);
      if (!hourlyCheck.allowed) {
        return {
          success: false,
          reason: hourlyCheck.reason,
          retryAfter: hourlyCheck.retryAfter
        };
      }

      // Create job data
      const jobData = {
        userId,
        type,
        data,
        priority: options.priority || 'normal',
        maxRetries: options.maxRetries || 2,
        createdAt: new Date(),
        scheduledAt: options.scheduledAt || new Date()
      };

      // Calculate delay with human-like randomization
      let delay = options.delay || 0;
      if (options.scheduledAt) {
        delay = Math.max(0, options.scheduledAt.getTime() - Date.now());
      } else {
        // Add human-like delay based on queue configuration
        const config = this.PROCESSING_RATES[queueName as keyof typeof this.PROCESSING_RATES];
        if (config) {
          const baseDelay = config.delay;
          const jitter = baseDelay * 0.3 * (Math.random() - 0.5); // ±30% jitter
          delay = Math.max(30000, baseDelay + jitter); // Minimum 30 seconds
        }
      }

      // Add job to queue
      const job = await queue.add(jobData, {
        delay,
        priority: this.getPriorityValue(options.priority || 'normal'),
        attempts: options.maxRetries || 2,
        backoff: {
          type: 'exponential',
          delay: 120000, // 2 minutes initial backoff
        },
      });

      // Update user's daily/hourly counters
      await this.updateUserCounters(userId, queueName);

      // Emit WebSocket update
      this.emitQueueUpdate(queueName, 'job_added', {
        jobId: job.id,
        userId,
        type,
        estimatedProcessTime: new Date(Date.now() + delay)
      });

      return {
        success: true,
        jobId: job.id as string
      };

    } catch (error) {
      console.error('Error adding job to queue:', error);
      return {
        success: false,
        reason: 'Internal error adding job to queue'
      };
    }
  }

  /**
   * Process individual job with comprehensive safety checks
   */
  private async processJob(queueName: string, job: Queue.Job): Promise<any> {
    const { userId, type, data } = job.data;
    
    try {
      // Pre-processing safety check
      const suspended = await this.isUserAutomationSuspended(userId);
      if (suspended.suspended) {
        throw new Error(`User automation suspended: ${suspended.reason}`);
      }

      // Rate limiting check
      const config = this.PROCESSING_RATES[queueName as keyof typeof this.PROCESSING_RATES];
      if (config) {
        const rateLimitCheck = await this.checkProcessingRateLimit(userId, queueName);
        if (!rateLimitCheck.allowed) {
          // Delay the job instead of failing it
          const delayTime = rateLimitCheck.retryAfter || config.delay;
          await job.moveToDelayed(Date.now() + delayTime * 1000);
          return { delayed: true, reason: rateLimitCheck.reason };
        }
      }

      // Process based on job type
      let result;
      switch (type) {
        case 'connection':
          result = await this.processConnectionJob(userId, data, job);
          break;
        case 'engagement':
          result = await this.processEngagementJob(userId, data, job);
          break;
        case 'profile_view':
          result = await this.processProfileViewJob(userId, data, job);
          break;
        case 'follow':
          result = await this.processFollowJob(userId, data, job);
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // Record successful processing
      await this.recordJobSuccess(userId, queueName, job.id as string);
      
      return result;

    } catch (error) {
      // Record failed processing
      await this.recordJobFailure(userId, queueName, job.id as string, error.message);
      
      // Check if this failure should trigger emergency measures
      await this.checkForEmergencyStop(userId, error);
      
      throw error;
    }
  }

  /**
   * Process connection request job
   */
  private async processConnectionJob(userId: string, data: any, job: Queue.Job): Promise<any> {
    // This would integrate with your existing LinkedIn connection automation service
    console.log(`Processing connection job for user ${userId}:`, data);
    
    // Simulate human-like delay
    const delay = 2000 + Math.random() * 3000; // 2-5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Update progress
    job.progress(50);
    
    // Simulate API call processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    job.progress(100);
    
    return {
      success: true,
      connectionSent: true,
      targetProfileId: data.targetProfileId,
      processedAt: new Date()
    };
  }

  /**
   * Process engagement job (likes, comments, etc.)
   */
  private async processEngagementJob(userId: string, data: any, job: Queue.Job): Promise<any> {
    console.log(`Processing engagement job for user ${userId}:`, data);
    
    const delay = 1500 + Math.random() * 2500; // 1.5-4 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    job.progress(100);
    
    return {
      success: true,
      engagementType: data.engagementType,
      targetPostId: data.targetPostId,
      processedAt: new Date()
    };
  }

  /**
   * Process profile view job
   */
  private async processProfileViewJob(userId: string, data: any, job: Queue.Job): Promise<any> {
    console.log(`Processing profile view job for user ${userId}:`, data);
    
    const delay = 3000 + Math.random() * 4000; // 3-7 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    job.progress(100);
    
    return {
      success: true,
      profileViewed: true,
      targetProfileId: data.targetProfileId,
      processedAt: new Date()
    };
  }

  /**
   * Process follow job
   */
  private async processFollowJob(userId: string, data: any, job: Queue.Job): Promise<any> {
    console.log(`Processing follow job for user ${userId}:`, data);
    
    const delay = 2500 + Math.random() * 3500; // 2.5-6 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    
    job.progress(100);
    
    return {
      success: true,
      followAction: data.action, // 'follow' or 'unfollow'
      targetProfileId: data.targetProfileId,
      processedAt: new Date()
    };
  }

  /**
   * Get user's queue status for dashboard
   */
  async getUserQueueStatus(userId: string): Promise<UserQueueStatus> {
    const queueStats: { [queueName: string]: any } = {};
    let totalJobs = 0;
    let nextJobTime: Date | undefined;

    for (const [queueName, queue] of this.queues.entries()) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      const delayed = await queue.getDelayed();

      // Filter jobs for this user
      const userWaiting = waiting.filter(job => job.data.userId === userId);
      const userActive = active.filter(job => job.data.userId === userId);
      const userCompleted = completed.filter(job => job.data.userId === userId);
      const userFailed = failed.filter(job => job.data.userId === userId);

      const queueTotal = userWaiting.length + userActive.length;
      totalJobs += queueTotal;

      // Calculate estimated wait time
      const config = this.PROCESSING_RATES[queueName as keyof typeof this.PROCESSING_RATES];
      const estimatedWaitTime = config ? (userWaiting.length * config.delay) / (1000 * 60) : 0;

      // Find next job time
      if (userWaiting.length > 0) {
        const nextJob = userWaiting[0];
        const nextTime = new Date(nextJob.timestamp + (nextJob.opts.delay || 0));
        if (!nextJobTime || nextTime < nextJobTime) {
          nextJobTime = nextTime;
        }
      }

      queueStats[queueName] = {
        waiting: userWaiting.length,
        active: userActive.length,
        completed: userCompleted.length,
        failed: userFailed.length,
        estimatedWaitTime: Math.round(estimatedWaitTime)
      };
    }

    // Check if automation is enabled
    const suspended = await this.isUserAutomationSuspended(userId);
    
    return {
      userId,
      queues: queueStats,
      totalJobs,
      nextJobTime,
      automationEnabled: !suspended.suspended,
      lastActivity: await this.getLastUserActivity(userId)
    };
  }

  /**
   * Get global queue statistics
   */
  async getGlobalQueueStats(): Promise<{ [queueName: string]: QueueStats }> {
    const stats: { [queueName: string]: QueueStats } = {};

    for (const [queueName, queue] of this.queues.entries()) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      const delayed = await queue.getDelayed();

      stats[queueName] = {
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
        active: active.length,
        waiting: waiting.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length
      };
    }

    return stats;
  }

  /**
   * Emergency stop all queues for a user
   */
  async emergencyStopUser(userId: string, reason: string): Promise<void> {
    console.log(`Emergency stop activated for user ${userId}: ${reason}`);

    // Set suspension flag
    await this.redis.setex(
      `automation_suspended:${userId}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify({
        suspended: true,
        reason,
        timestamp: new Date().toISOString(),
        triggeredBy: 'system'
      })
    );

    // Remove all pending jobs for this user
    for (const [queueName, queue] of this.queues.entries()) {
      const waiting = await queue.getWaiting();
      const delayed = await queue.getDelayed();
      
      // Remove waiting jobs
      for (const job of waiting) {
        if (job.data.userId === userId) {
          await job.remove();
        }
      }
      
      // Remove delayed jobs
      for (const job of delayed) {
        if (job.data.userId === userId) {
          await job.remove();
        }
      }
    }

    // Emit emergency stop event
    this.emit('emergencyStop', { userId, reason });
  }

  /**
   * Pause/resume queue processing for a user
   */
  async pauseUserAutomation(userId: string): Promise<void> {
    await this.redis.setex(
      `automation_paused:${userId}`,
      60 * 60, // 1 hour
      'true'
    );
    
    this.emit('automationPaused', { userId });
  }

  async resumeUserAutomation(userId: string): Promise<void> {
    await this.redis.del(`automation_paused:${userId}`);
    this.emit('automationResumed', { userId });
  }

  // Helper methods
  private getQueueName(type: string, priority: string): string {
    switch (type) {
      case 'connection':
        return `linkedin-connections-${priority}`;
      case 'engagement':
        return `linkedin-engagement-${priority}`;
      case 'profile_view':
        return 'linkedin-profile-views';
      case 'follow':
        return 'linkedin-follows';
      default:
        return `linkedin-${type}-${priority}`;
    }
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'critical': return 100;
      case 'high': return 50;
      case 'normal': return 0;
      case 'low': return -50;
      default: return 0;
    }
  }

  private async checkDailyLimits(userId: string, queueName: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const key = `queue_daily:${userId}:${queueName}:${today}`;
    const count = await this.redis.get(key);
    const currentCount = parseInt(count || '0');
    
    const config = this.PROCESSING_RATES[queueName as keyof typeof this.PROCESSING_RATES];
    if (config && currentCount >= config.maxPerDay) {
      return {
        allowed: false,
        reason: `Daily limit reached (${currentCount}/${config.maxPerDay})`,
        retryAfter: this.getSecondsUntilMidnight()
      };
    }
    
    return { allowed: true };
  }

  private async checkHourlyLimits(userId: string, queueName: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const now = new Date();
    const hour = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const key = `queue_hourly:${userId}:${queueName}:${hour}`;
    const count = await this.redis.get(key);
    const currentCount = parseInt(count || '0');
    
    const config = this.PROCESSING_RATES[queueName as keyof typeof this.PROCESSING_RATES];
    if (config && currentCount >= config.maxPerHour) {
      return {
        allowed: false,
        reason: `Hourly limit reached (${currentCount}/${config.maxPerHour})`,
        retryAfter: (60 - now.getMinutes()) * 60
      };
    }
    
    return { allowed: true };
  }

  private async checkProcessingRateLimit(userId: string, queueName: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const key = `queue_last_processed:${userId}:${queueName}`;
    const lastProcessed = await this.redis.get(key);
    
    if (lastProcessed) {
      const config = this.PROCESSING_RATES[queueName as keyof typeof this.PROCESSING_RATES];
      if (config) {
        const timeSinceLastProcessed = Date.now() - parseInt(lastProcessed);
        if (timeSinceLastProcessed < config.delay) {
          const waitTime = Math.ceil((config.delay - timeSinceLastProcessed) / 1000);
          return {
            allowed: false,
            reason: 'Rate limit: too soon since last processing',
            retryAfter: waitTime
          };
        }
      }
    }
    
    return { allowed: true };
  }

  private async updateUserCounters(userId: string, queueName: string): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    
    const dailyKey = `queue_daily:${userId}:${queueName}:${today}`;
    const hourlyKey = `queue_hourly:${userId}:${queueName}:${hour}`;
    
    await this.redis.incr(dailyKey);
    await this.redis.expire(dailyKey, 25 * 60 * 60); // Expire after 25 hours
    
    await this.redis.incr(hourlyKey);
    await this.redis.expire(hourlyKey, 61 * 60); // Expire after 61 minutes
  }

  private async recordJobSuccess(userId: string, queueName: string, jobId: string): Promise<void> {
    const key = `queue_last_processed:${userId}:${queueName}`;
    await this.redis.setex(key, 60 * 60, Date.now().toString()); // 1 hour TTL
    
    // Record for analytics
    const analyticsKey = `queue_analytics:${userId}:${new Date().toISOString().split('T')[0]}`;
    await this.redis.lpush(analyticsKey, JSON.stringify({
      queueName,
      jobId,
      success: true,
      timestamp: new Date().toISOString()
    }));
    await this.redis.expire(analyticsKey, 30 * 24 * 60 * 60); // 30 days
  }

  private async recordJobFailure(userId: string, queueName: string, jobId: string, error: string): Promise<void> {
    // Record for analytics
    const analyticsKey = `queue_analytics:${userId}:${new Date().toISOString().split('T')[0]}`;
    await this.redis.lpush(analyticsKey, JSON.stringify({
      queueName,
      jobId,
      success: false,
      error,
      timestamp: new Date().toISOString()
    }));
    await this.redis.expire(analyticsKey, 30 * 24 * 60 * 60); // 30 days
  }

  private async checkForEmergencyStop(userId: string, error: Error): Promise<void> {
    // Check for patterns that indicate emergency stop needed
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('too many requests') ||
        errorMessage.includes('suspended') ||
        errorMessage.includes('restricted')) {
      
      await this.emergencyStopUser(userId, `Automated emergency stop: ${error.message}`);
    }
  }

  private async isUserAutomationSuspended(userId: string): Promise<{ suspended: boolean; reason?: string }> {
    const suspensionData = await this.redis.get(`automation_suspended:${userId}`);
    if (suspensionData) {
      const data = JSON.parse(suspensionData);
      return { suspended: data.suspended, reason: data.reason };
    }
    return { suspended: false };
  }

  private async getLastUserActivity(userId: string): Promise<Date | undefined> {
    const key = `user_last_activity:${userId}`;
    const timestamp = await this.redis.get(key);
    return timestamp ? new Date(parseInt(timestamp)) : undefined;
  }

  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  private emitQueueUpdate(queueName: string, eventType: string, data: any): void {
    this.emit('queueUpdate', {
      queueName,
      eventType,
      data,
      timestamp: new Date()
    });
  }

  private startGlobalMonitoring(): void {
    // Monitor queue health every 30 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Queue health check error:', error);
      }
    }, 30000);

    console.log('Queue monitoring started');
  }

  private async performHealthCheck(): Promise<void> {
    const stats = await this.getGlobalQueueStats();
    
    // Check for stuck jobs
    for (const [queueName, queueStats] of Object.entries(stats)) {
      if (queueStats.active > 0) {
        const queue = this.queues.get(queueName);
        if (queue) {
          const activeJobs = await queue.getActive();
          const now = Date.now();
          
          for (const job of activeJobs) {
            const processingTime = now - job.processedOn!;
            if (processingTime > 10 * 60 * 1000) { // 10 minutes
              console.warn(`Job ${job.id} in queue ${queueName} has been processing for ${processingTime}ms`);
              // Could implement auto-retry logic here
            }
          }
        }
      }
    }
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Close all queues
    for (const [queueName, queue] of this.queues.entries()) {
      await queue.close();
      console.log(`Queue ${queueName} closed`);
    }
    
    // Close Redis connection
    await this.redis.quit();
    
    console.log('Queue Manager Service cleaned up');
  }
}