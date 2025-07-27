import { database } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/config/logger';
import { WebSocketService } from '@/services/websocket.service';
import { ProfileMetric, EngagementMetric } from '@/types/analytics';
import cron from 'node-cron';

interface RealTimeEvent {
  userId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp?: Date;
}

interface BatchMetrics {
  profileMetrics: ProfileMetric[];
  engagementMetrics: EngagementMetric[];
  realTimeEvents: RealTimeEvent[];
}

export class IngestionService {
  private readonly BATCH_SIZE = 1000;
  private readonly BATCH_INTERVAL = 5000; // 5 seconds
  private readonly REDIS_QUEUE_KEY = 'analytics:ingestion_queue';
  private readonly REDIS_BATCH_KEY = 'analytics:batch_metrics';
  
  private batchInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private websocketService: WebSocketService;

  constructor(websocketService: WebSocketService) {
    this.websocketService = websocketService;
  }

  /**
   * Initialize the ingestion service
   */
  public async initialize(): Promise<void> {
    try {
      // Start batch processing
      this.startBatchProcessing();
      
      // Start real-time event processing
      this.startRealTimeProcessing();
      
      // Schedule cleanup and optimization tasks
      this.scheduleMaintenanceTasks();
      
      logger.info('Ingestion service initialized', {
        batchSize: this.BATCH_SIZE,
        batchInterval: this.BATCH_INTERVAL
      });
    } catch (error) {
      logger.error('Failed to initialize ingestion service', { error });
      throw error;
    }
  }

  /**
   * Queue a real-time event for processing
   */
  public async queueRealTimeEvent(event: RealTimeEvent): Promise<void> {
    try {
      const eventWithTimestamp = {
        ...event,
        timestamp: event.timestamp || new Date()
      };

      // Add to Redis queue for batch processing
      await redis.lpush(this.REDIS_QUEUE_KEY, JSON.stringify(eventWithTimestamp));
      
      // Process immediately for real-time updates
      await this.processRealTimeEvent(eventWithTimestamp);
      
      logger.debug('Real-time event queued', { 
        userId: event.userId, 
        eventType: event.eventType 
      });
    } catch (error) {
      logger.error('Failed to queue real-time event', { error, event });
      throw error;
    }
  }

  /**
   * Batch ingest profile metrics
   */
  public async batchIngestProfileMetrics(metrics: ProfileMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    try {
      const query = `
        INSERT INTO analytics.profile_metrics (
          user_id, timestamp, profile_views, search_appearances, 
          connections_count, completeness_score, skills_count,
          endorsements_count, recommendations_count, posts_count,
          articles_count, engagement_rate, likes_received,
          comments_received, shares_received, profile_clicks,
          network_growth_rate, content_engagement_score,
          influence_score, source, data_quality_score
        ) VALUES ${metrics.map((_, index) => 
          `($${index * 21 + 1}, $${index * 21 + 2}, $${index * 21 + 3}, $${index * 21 + 4}, 
           $${index * 21 + 5}, $${index * 21 + 6}, $${index * 21 + 7}, $${index * 21 + 8}, 
           $${index * 21 + 9}, $${index * 21 + 10}, $${index * 21 + 11}, $${index * 21 + 12}, 
           $${index * 21 + 13}, $${index * 21 + 14}, $${index * 21 + 15}, $${index * 21 + 16}, 
           $${index * 21 + 17}, $${index * 21 + 18}, $${index * 21 + 19}, $${index * 21 + 20}, 
           $${index * 21 + 21})`
        ).join(', ')}
        ON CONFLICT (user_id, timestamp) 
        DO UPDATE SET 
          profile_views = GREATEST(analytics.profile_metrics.profile_views, EXCLUDED.profile_views),
          search_appearances = GREATEST(analytics.profile_metrics.search_appearances, EXCLUDED.search_appearances),
          connections_count = GREATEST(analytics.profile_metrics.connections_count, EXCLUDED.connections_count),
          completeness_score = EXCLUDED.completeness_score,
          engagement_rate = EXCLUDED.engagement_rate,
          influence_score = EXCLUDED.influence_score,
          data_quality_score = EXCLUDED.data_quality_score
      `;

      const values = metrics.flatMap(metric => [
        metric.userId,
        metric.timestamp,
        metric.profileViews || 0,
        metric.searchAppearances || 0,
        metric.connectionsCount || 0,
        metric.completenessScore || 0,
        metric.skillsCount || 0,
        metric.endorsementsCount || 0,
        metric.recommendationsCount || 0,
        metric.postsCount || 0,
        metric.articlesCount || 0,
        metric.engagementRate || 0,
        (metric as any).likesReceived || 0,
        (metric as any).commentsReceived || 0,
        (metric as any).sharesReceived || 0,
        (metric as any).profileClicks || 0,
        (metric as any).networkGrowthRate || 0,
        (metric as any).contentEngagementScore || 0,
        (metric as any).influenceScore || 0,
        metric.source,
        (metric as any).dataQualityScore || 1.0
      ]);

      await database.query(query, values);

      // Send real-time updates to affected users
      await this.notifyMetricUpdates(metrics);

      logger.info('Profile metrics batch ingested', { 
        count: metrics.length,
        users: [...new Set(metrics.map(m => m.userId))].length 
      });
    } catch (error) {
      logger.error('Failed to batch ingest profile metrics', { error, count: metrics.length });
      throw error;
    }
  }

  /**
   * Batch ingest engagement metrics
   */
  public async batchIngestEngagementMetrics(metrics: EngagementMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    try {
      const query = `
        INSERT INTO analytics.engagement_metrics (
          user_id, content_id, timestamp, type, value, content_type,
          device_type, referrer_source, geographic_region, source, metadata
        ) VALUES ${metrics.map((_, index) => 
          `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, 
           $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, 
           $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`
        ).join(', ')}
      `;

      const values = metrics.flatMap(metric => [
        metric.userId,
        metric.contentId || null,
        metric.timestamp,
        metric.type,
        metric.value,
        (metric.metadata as any)?.contentType || null,
        (metric.metadata as any)?.deviceType || null,
        (metric.metadata as any)?.referrerSource || null,
        (metric.metadata as any)?.geographicRegion || null,
        metric.source,
        JSON.stringify(metric.metadata || {})
      ]);

      await database.query(query, values);

      logger.info('Engagement metrics batch ingested', { 
        count: metrics.length,
        users: [...new Set(metrics.map(m => m.userId))].length 
      });
    } catch (error) {
      logger.error('Failed to batch ingest engagement metrics', { error, count: metrics.length });
      throw error;
    }
  }

  /**
   * Process real-time event immediately
   */
  private async processRealTimeEvent(event: RealTimeEvent): Promise<void> {
    try {
      // Store in real_time_events table
      const query = `
        INSERT INTO analytics.real_time_events (user_id, event_type, event_data)
        VALUES ($1, $2, $3)
      `;
      
      await database.query(query, [
        event.userId,
        event.eventType,
        JSON.stringify(event.eventData)
      ]);

      // Send WebSocket notification
      this.websocketService.sendRealTimeData(event.userId, {
        eventType: event.eventType,
        ...event.eventData,
        timestamp: event.timestamp
      });

      // Update live metrics cache
      await this.updateLiveMetricsCache(event);

    } catch (error) {
      logger.error('Failed to process real-time event', { error, event });
    }
  }

  /**
   * Start batch processing interval
   */
  private startBatchProcessing(): void {
    this.batchInterval = setInterval(async () => {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      try {
        await this.processBatch();
      } catch (error) {
        logger.error('Batch processing failed', { error });
      } finally {
        this.isProcessing = false;
      }
    }, this.BATCH_INTERVAL);

    logger.info('Batch processing started', { interval: this.BATCH_INTERVAL });
  }

  /**
   * Process a batch of queued events
   */
  private async processBatch(): Promise<void> {
    try {
      // Get batch of events from Redis queue
      const events = await redis.rpop(this.REDIS_QUEUE_KEY, this.BATCH_SIZE);
      
      if (!events || events.length === 0) return;

      const batchMetrics: BatchMetrics = {
        profileMetrics: [],
        engagementMetrics: [],
        realTimeEvents: []
      };

      // Parse and categorize events
      for (const eventJson of events) {
        try {
          const event: RealTimeEvent = JSON.parse(eventJson);
          batchMetrics.realTimeEvents.push(event);

          // Convert real-time events to metrics
          await this.convertEventToMetrics(event, batchMetrics);
        } catch (parseError) {
          logger.warn('Failed to parse queued event', { parseError, eventJson });
        }
      }

      // Batch insert metrics
      if (batchMetrics.profileMetrics.length > 0) {
        await this.batchIngestProfileMetrics(batchMetrics.profileMetrics);
      }

      if (batchMetrics.engagementMetrics.length > 0) {
        await this.batchIngestEngagementMetrics(batchMetrics.engagementMetrics);
      }

      // Process real-time events in database
      if (batchMetrics.realTimeEvents.length > 0) {
        await this.processBatchRealTimeEvents(batchMetrics.realTimeEvents);
      }

      logger.debug('Batch processed', {
        totalEvents: events.length,
        profileMetrics: batchMetrics.profileMetrics.length,
        engagementMetrics: batchMetrics.engagementMetrics.length
      });

    } catch (error) {
      logger.error('Failed to process batch', { error });
    }
  }

  /**
   * Convert real-time event to metrics
   */
  private async convertEventToMetrics(
    event: RealTimeEvent, 
    batchMetrics: BatchMetrics
  ): Promise<void> {
    const timestamp = event.timestamp || new Date();

    switch (event.eventType) {
      case 'profile_view':
        batchMetrics.profileMetrics.push({
          userId: event.userId,
          timestamp,
          profileViews: 1,
          searchAppearances: 0,
          connectionsCount: 0,
          completenessScore: 0,
          skillsCount: 0,
          endorsementsCount: 0,
          recommendationsCount: 0,
          postsCount: 0,
          articlesCount: 0,
          engagementRate: 0,
          source: 'manual'
        });
        break;

      case 'engagement':
        batchMetrics.engagementMetrics.push({
          userId: event.userId,
          contentId: event.eventData.contentId,
          timestamp,
          type: event.eventData.type,
          value: event.eventData.value || 1,
          source: 'manual',
          metadata: event.eventData
        });
        break;

      case 'connection_made':
        batchMetrics.profileMetrics.push({
          userId: event.userId,
          timestamp,
          profileViews: 0,
          searchAppearances: 0,
          connectionsCount: 1,
          completenessScore: 0,
          skillsCount: 0,
          endorsementsCount: 0,
          recommendationsCount: 0,
          postsCount: 0,
          articlesCount: 0,
          engagementRate: 0,
          source: 'manual'
        });
        break;
    }
  }

  /**
   * Process batch of real-time events in database
   */
  private async processBatchRealTimeEvents(events: RealTimeEvent[]): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics.real_time_events (user_id, event_type, event_data, timestamp)
        VALUES ${events.map((_, index) => 
          `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(', ')}
      `;

      const values = events.flatMap(event => [
        event.userId,
        event.eventType,
        JSON.stringify(event.eventData),
        event.timestamp
      ]);

      await database.query(query, values);
    } catch (error) {
      logger.error('Failed to batch insert real-time events', { error });
    }
  }

  /**
   * Start real-time event processing from database
   */
  private startRealTimeProcessing(): void {
    // Process events every 10 seconds
    cron.schedule('*/10 * * * * *', async () => {
      try {
        const processedCount = await this.processStoredRealTimeEvents();
        if (processedCount > 0) {
          logger.debug('Processed stored real-time events', { count: processedCount });
        }
      } catch (error) {
        logger.error('Failed to process stored real-time events', { error });
      }
    });
  }

  /**
   * Process stored real-time events
   */
  private async processStoredRealTimeEvents(): Promise<number> {
    try {
      const result = await database.query('SELECT analytics.process_real_time_events()');
      return result.rows[0]?.process_real_time_events || 0;
    } catch (error) {
      logger.error('Failed to execute process_real_time_events function', { error });
      return 0;
    }
  }

  /**
   * Update live metrics cache
   */
  private async updateLiveMetricsCache(event: RealTimeEvent): Promise<void> {
    try {
      const cacheKey = `live_metrics:${event.userId}`;
      const currentData = await redis.get(cacheKey);
      
      let metrics = currentData ? JSON.parse(currentData) : {
        profileViews: 0,
        engagements: 0,
        connections: 0,
        lastUpdated: new Date()
      };

      // Update based on event type
      switch (event.eventType) {
        case 'profile_view':
          metrics.profileViews += 1;
          break;
        case 'engagement':
          metrics.engagements += event.eventData.value || 1;
          break;
        case 'connection_made':
          metrics.connections += 1;
          break;
      }

      metrics.lastUpdated = new Date();

      // Cache for 5 minutes
      await redis.setex(cacheKey, 300, JSON.stringify(metrics));
    } catch (error) {
      logger.warn('Failed to update live metrics cache', { error, event });
    }
  }

  /**
   * Send metric update notifications
   */
  private async notifyMetricUpdates(metrics: ProfileMetric[]): Promise<void> {
    try {
      // Group metrics by user
      const userMetrics = new Map<string, ProfileMetric[]>();
      
      for (const metric of metrics) {
        if (!userMetrics.has(metric.userId)) {
          userMetrics.set(metric.userId, []);
        }
        userMetrics.get(metric.userId)!.push(metric);
      }

      // Send notifications to each user
      for (const [userId, userMetricList] of userMetrics) {
        const latestMetric = userMetricList[userMetricList.length - 1];
        
        if (!latestMetric) {
          continue;
        }
        
        this.websocketService.sendMetricUpdate(userId, 'profile_metrics', {
          profileViews: latestMetric.profileViews,
          connections: latestMetric.connectionsCount,
          completenessScore: latestMetric.completenessScore,
          engagementRate: latestMetric.engagementRate,
          timestamp: latestMetric.timestamp
        });
      }
    } catch (error) {
      logger.warn('Failed to send metric update notifications', { error });
    }
  }

  /**
   * Schedule maintenance tasks
   */
  private scheduleMaintenanceTasks(): void {
    // Cleanup old real-time events every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const result = await database.query(`
          DELETE FROM analytics.real_time_events 
          WHERE timestamp < NOW() - INTERVAL '24 hours' AND processed = TRUE
        `);
        
        if (result.rowCount && result.rowCount > 0) {
          logger.info('Cleaned up old real-time events', { deletedCount: result.rowCount });
        }
      } catch (error) {
        logger.error('Failed to cleanup old real-time events', { error });
      }
    });

    // Update influence scores every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        await this.updateInfluenceScores();
      } catch (error) {
        logger.error('Failed to update influence scores', { error });
      }
    });

    logger.info('Maintenance tasks scheduled');
  }

  /**
   * Update influence scores for all users
   */
  private async updateInfluenceScores(): Promise<void> {
    try {
      const result = await database.query(`
        UPDATE analytics.profile_metrics 
        SET influence_score = analytics.calculate_influence_score(user_id)
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
      `);

      logger.info('Updated influence scores', { updatedCount: result.rowCount });
    } catch (error) {
      logger.error('Failed to update influence scores', { error });
    }
  }

  /**
   * Get ingestion statistics
   */
  public async getIngestionStats(): Promise<any> {
    try {
      const [queueSize, recentEvents, processingStats] = await Promise.all([
        redis.llen(this.REDIS_QUEUE_KEY),
        database.query(`
          SELECT COUNT(*) as count, event_type
          FROM analytics.real_time_events
          WHERE timestamp >= NOW() - INTERVAL '1 hour'
          GROUP BY event_type
        `),
        database.query(`
          SELECT 
            COUNT(*) as total_metrics,
            COUNT(DISTINCT user_id) as unique_users,
            AVG(data_quality_score) as avg_quality_score
          FROM analytics.profile_metrics
          WHERE timestamp >= NOW() - INTERVAL '1 hour'
        `)
      ]);

      return {
        queueSize: queueSize || 0,
        recentEventTypes: recentEvents.rows,
        processingStats: processingStats.rows[0],
        isProcessing: this.isProcessing,
        lastProcessed: new Date()
      };
    } catch (error) {
      logger.error('Failed to get ingestion stats', { error });
      return {
        queueSize: 0,
        recentEventTypes: [],
        processingStats: {},
        isProcessing: this.isProcessing,
        error: 'Failed to fetch stats'
      };
    }
  }

  /**
   * Shutdown the ingestion service
   */
  public async shutdown(): Promise<void> {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    // Process remaining items in queue
    if (!this.isProcessing) {
      try {
        await this.processBatch();
      } catch (error) {
        logger.error('Failed to process final batch during shutdown', { error });
      }
    }

    logger.info('Ingestion service shut down');
  }
}