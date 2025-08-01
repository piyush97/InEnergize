import { database } from '@/config/database';
import { redis } from '@/config/redis';
import logger from '@/config/logger';

export interface UserBehaviorEvent {
  userId: string;
  sessionId: string;
  eventType: 'PAGE_VIEW' | 'FEATURE_CLICK' | 'FORM_SUBMIT' | 'BUTTON_CLICK' | 
           'MODAL_OPEN' | 'MODAL_CLOSE' | 'TAB_SWITCH' | 'SEARCH' | 'FILTER' |
           'EXPORT' | 'IMPORT' | 'SHARE' | 'SAVE' | 'DELETE' | 'EDIT';
  eventName: string;
  pageUrl?: string;
  featureName?: string;
  elementId?: string;
  elementClass?: string;
  eventData?: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  timestamp?: Date;
}

export interface UserSession {
  userId: string;
  sessionId: string;
  startedAt: Date;
  endedAt?: Date;
  deviceType?: string;
  browser?: string;
  os?: string;
  country?: string;
  city?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface BehaviorAnalytics {
  userId: string;
  timeRange: { start: Date; end: Date };
  totalEvents: number;
  uniqueSessions: number;
  avgSessionDuration: number;
  topPages: Array<{ page: string; views: number; avgTime: number }>;
  topFeatures: Array<{ feature: string; usage: number; category: string }>;
  userJourney: Array<{ step: string; timestamp: Date; duration?: number }>;
  conversionEvents: Array<{ event: string; count: number; rate: number }>;
  deviceBreakdown: Record<string, number>;
  browserBreakdown: Record<string, number>;
}

export interface SessionAnalytics {
  sessionId: string;
  userId: string;
  duration: number;
  pageViews: number;
  eventsCount: number;
  conversionEvents: string[];
  exitPage: string;
  entryPage: string;
  referrer?: string;
  deviceInfo: {
    type: string;
    browser: string;
    os: string;
  };
}

/**
 * UserBehaviorService - Comprehensive user behavior tracking and analytics
 * 
 * Tracks user interactions, page views, feature usage, and provides
 * detailed analytics for product optimization and user experience insights.
 */
export class UserBehaviorService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly SESSION_TIMEOUT = 1800; // 30 minutes
  private readonly BATCH_SIZE = 100;

  /**
   * Track a user behavior event
   */
  async trackEvent(event: UserBehaviorEvent): Promise<void> {
    try {
      // Validate required fields
      this.validateEvent(event);

      // Update or create session
      await this.updateSession(event);

      // Insert event into database
      const query = `
        INSERT INTO analytics.user_behavior_events (
          user_id, session_id, event_type, event_name, page_url,
          feature_name, element_id, element_class, event_data,
          user_agent, ip_address, referrer, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;

      const values = [
        event.userId,
        event.sessionId,
        event.eventType,
        event.eventName,
        event.pageUrl || null,
        event.featureName || null,
        event.elementId || null,
        event.elementClass || null,
        JSON.stringify(event.eventData || {}),
        event.userAgent || null,
        event.ipAddress || null,
        event.referrer || null,
        event.timestamp || new Date()
      ];

      await database.query(query, values);

      // Update real-time metrics in Redis
      await this.updateRealTimeMetrics(event);

      logger.info('User behavior event tracked', {
        userId: event.userId,
        eventType: event.eventType,
        eventName: event.eventName
      });
    } catch (error) {
      logger.error('Failed to track user behavior event', { error, event });
      throw error;
    }
  }

  /**
   * Track multiple events in batch
   */
  async trackEventsBatch(events: UserBehaviorEvent[]): Promise<void> {
    try {
      if (events.length === 0) return;

      // Process in batches to avoid overwhelming the database
      for (let i = 0; i < events.length; i += this.BATCH_SIZE) {
        const batch = events.slice(i, i + this.BATCH_SIZE);
        await Promise.all(batch.map(event => this.trackEvent(event)));
      }

      logger.info('Batch events tracked', { count: events.length });
    } catch (error) {
      logger.error('Failed to track batch events', { error, count: events.length });
      throw error;
    }
  }

  /**
   * Start a new user session
   */
  async startSession(session: UserSession): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics.user_sessions (
          user_id, session_id, started_at, device_type, browser, os,
          country, city, utm_source, utm_medium, utm_campaign
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (session_id) 
        DO UPDATE SET started_at = EXCLUDED.started_at
      `;

      const values = [
        session.userId,
        session.sessionId,
        session.startedAt,
        session.deviceType,
        session.browser,
        session.os,
        session.country,
        session.city,
        session.utmSource,
        session.utmMedium,
        session.utmCampaign
      ];

      await database.query(query, values);

      // Store session in Redis for real-time tracking
      const sessionKey = `session:${session.sessionId}`;
      await redis.set(sessionKey, JSON.stringify(session), this.SESSION_TIMEOUT);

      logger.info('User session started', {
        userId: session.userId,
        sessionId: session.sessionId
      });
    } catch (error) {
      logger.error('Failed to start user session', { error, session });
      throw error;
    }
  }

  /**
   * End a user session
   */
  async endSession(sessionId: string): Promise<void> {
    try {
      const endTime = new Date();
      
      // Calculate session metrics
      const metricsQuery = `
        SELECT 
          user_id,
          started_at,
          COUNT(*) as events_count,
          COUNT(CASE WHEN event_type = 'PAGE_VIEW' THEN 1 END) as page_views
        FROM analytics.user_sessions s
        LEFT JOIN analytics.user_behavior_events e ON s.session_id = e.session_id
        WHERE s.session_id = $1
        GROUP BY s.user_id, s.started_at
      `;

      const metricsResult = await database.query(metricsQuery, [sessionId]);
      
      if (metricsResult.rows.length > 0) {
        const metrics = metricsResult.rows[0];
        const duration = Math.floor((endTime.getTime() - new Date(metrics.started_at).getTime()) / 1000);

        // Update session record
        const updateQuery = `
          UPDATE analytics.user_sessions 
          SET 
            ended_at = $1,
            duration_seconds = $2,
            page_views = $3,
            events_count = $4
          WHERE session_id = $5
        `;

        await database.query(updateQuery, [
          endTime,
          duration,
          metrics.page_views,
          metrics.events_count,
          sessionId
        ]);

        // Remove from Redis
        await redis.del(`session:${sessionId}`);

        logger.info('User session ended', {
          sessionId,
          duration,
          pageViews: metrics.page_views,
          eventsCount: metrics.events_count
        });
      }
    } catch (error) {
      logger.error('Failed to end user session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get comprehensive behavior analytics for a user
   */
  async getBehaviorAnalytics(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<BehaviorAnalytics> {
    try {
      const cacheKey = `behavior_analytics:${userId}:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
      
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get basic metrics
      const basicMetricsQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics.user_behavior_events
        WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
      `;

      const basicMetrics = await database.query(basicMetricsQuery, [userId, timeRange.start, timeRange.end]);

      // Get session duration
      const sessionDurationQuery = `
        SELECT AVG(duration_seconds) as avg_duration
        FROM analytics.user_sessions
        WHERE user_id = $1 AND started_at BETWEEN $2 AND $3 AND duration_seconds IS NOT NULL
      `;

      const sessionDuration = await database.query(sessionDurationQuery, [userId, timeRange.start, timeRange.end]);

      // Get top pages
      const topPagesQuery = `
        SELECT 
          page_url as page,
          COUNT(*) as views,
          AVG(EXTRACT(EPOCH FROM (LEAD(timestamp) OVER (PARTITION BY session_id ORDER BY timestamp) - timestamp))) as avg_time
        FROM analytics.user_behavior_events
        WHERE user_id = $1 AND event_type = 'PAGE_VIEW' 
          AND timestamp BETWEEN $2 AND $3 AND page_url IS NOT NULL
        GROUP BY page_url
        ORDER BY views DESC
        LIMIT 10
      `;

      const topPages = await database.query(topPagesQuery, [userId, timeRange.start, timeRange.end]);

      // Get top features (from feature_usage table)
      const topFeaturesQuery = `
        SELECT 
          feature_name as feature,
          SUM(usage_count) as usage,
          feature_category as category
        FROM analytics.feature_usage
        WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
        GROUP BY feature_name, feature_category
        ORDER BY usage DESC
        LIMIT 10
      `;

      const topFeatures = await database.query(topFeaturesQuery, [userId, timeRange.start, timeRange.end]);

      // Get user journey (simplified - key page transitions)
      const userJourneyQuery = `
        SELECT 
          event_name as step,
          timestamp,
          LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
        FROM analytics.user_behavior_events
        WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
          AND event_type IN ('PAGE_VIEW', 'FEATURE_CLICK', 'FORM_SUBMIT')
        ORDER BY timestamp
        LIMIT 50
      `;

      const userJourney = await database.query(userJourneyQuery, [userId, timeRange.start, timeRange.end]);

      // Get conversion events
      const conversionEventsQuery = `
        SELECT 
          event_name as event,
          COUNT(*) as count
        FROM analytics.user_behavior_events
        WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
          AND event_type IN ('FORM_SUBMIT', 'BUTTON_CLICK')
          AND event_name LIKE '%convert%' OR event_name LIKE '%subscribe%' OR event_name LIKE '%upgrade%'
        GROUP BY event_name
        ORDER BY count DESC
      `;

      const conversionEvents = await database.query(conversionEventsQuery, [userId, timeRange.start, timeRange.end]);

      // Get device and browser breakdown
      const deviceBrowserQuery = `
        SELECT 
          device_type,
          browser,
          COUNT(DISTINCT session_id) as sessions
        FROM analytics.user_sessions
        WHERE user_id = $1 AND started_at BETWEEN $2 AND $3
        GROUP BY device_type, browser
      `;

      const deviceBrowser = await database.query(deviceBrowserQuery, [userId, timeRange.start, timeRange.end]);

      // Build analytics response
      const analytics: BehaviorAnalytics = {
        userId,
        timeRange,
        totalEvents: parseInt(basicMetrics.rows[0]?.total_events || '0'),
        uniqueSessions: parseInt(basicMetrics.rows[0]?.unique_sessions || '0'),
        avgSessionDuration: parseFloat(sessionDuration.rows[0]?.avg_duration || '0'),
        topPages: topPages.rows.map((row: any) => ({
          page: row.page,
          views: parseInt(row.views),
          avgTime: parseFloat(row.avg_time || '0')
        })),
        topFeatures: topFeatures.rows.map((row: any) => ({
          feature: row.feature,
          usage: parseInt(row.usage),
          category: row.category
        })),
        userJourney: userJourney.rows.map((row: any) => ({
          step: row.step,
          timestamp: new Date(row.timestamp),
          duration: row.prev_timestamp ? 
            Math.floor((new Date(row.timestamp).getTime() - new Date(row.prev_timestamp).getTime()) / 1000) : 
            undefined
        })),
        conversionEvents: conversionEvents.rows.map((row: any) => ({
          event: row.event,
          count: parseInt(row.count),
          rate: 0 // Calculate rate based on total events
        })),
        deviceBreakdown: {},
        browserBreakdown: {}
      };

      // Calculate conversion rates
      if (analytics.totalEvents > 0) {
        analytics.conversionEvents = analytics.conversionEvents.map(event => ({
          ...event,
          rate: (event.count / analytics.totalEvents) * 100
        }));
      }

      // Build device and browser breakdowns
      deviceBrowser.rows.forEach((row: any) => {
        if (row.device_type) {
          analytics.deviceBreakdown[row.device_type] = 
            (analytics.deviceBreakdown[row.device_type] || 0) + parseInt(row.sessions);
        }
        if (row.browser) {
          analytics.browserBreakdown[row.browser] = 
            (analytics.browserBreakdown[row.browser] || 0) + parseInt(row.sessions);
        }
      });

      // Cache result
      await redis.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info('Behavior analytics generated', {
        userId,
        totalEvents: analytics.totalEvents,
        uniqueSessions: analytics.uniqueSessions
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get behavior analytics', { error, userId });
      throw error;
    }
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(sessionId: string): Promise<SessionAnalytics | null> {
    try {
      const query = `
        SELECT 
          s.session_id,
          s.user_id,
          s.duration_seconds,
          s.page_views,
          s.events_count,
          s.device_type,
          s.browser,
          s.os,
          first_page.page_url as entry_page,
          last_page.page_url as exit_page,
          array_agg(DISTINCT e.event_name) FILTER (WHERE e.event_name LIKE '%convert%' OR e.event_name LIKE '%subscribe%') as conversion_events
        FROM analytics.user_sessions s
        LEFT JOIN LATERAL (
          SELECT page_url FROM analytics.user_behavior_events 
          WHERE session_id = s.session_id AND event_type = 'PAGE_VIEW' AND page_url IS NOT NULL
          ORDER BY timestamp ASC LIMIT 1
        ) first_page ON true
        LEFT JOIN LATERAL (
          SELECT page_url FROM analytics.user_behavior_events 
          WHERE session_id = s.session_id AND event_type = 'PAGE_VIEW' AND page_url IS NOT NULL
          ORDER BY timestamp DESC LIMIT 1
        ) last_page ON true
        LEFT JOIN analytics.user_behavior_events e ON s.session_id = e.session_id
        WHERE s.session_id = $1
        GROUP BY s.session_id, s.user_id, s.duration_seconds, s.page_views, s.events_count,
                 s.device_type, s.browser, s.os, first_page.page_url, last_page.page_url
      `;

      const result = await database.query(query, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      const sessionAnalytics: SessionAnalytics = {
        sessionId: row.session_id,
        userId: row.user_id,
        duration: row.duration_seconds || 0,
        pageViews: row.page_views || 0,
        eventsCount: row.events_count || 0,
        conversionEvents: row.conversion_events || [],
        exitPage: row.exit_page || '',
        entryPage: row.entry_page || '',
        deviceInfo: {
          type: row.device_type || 'unknown',
          browser: row.browser || 'unknown',
          os: row.os || 'unknown'
        }
      };

      return sessionAnalytics;
    } catch (error) {
      logger.error('Failed to get session analytics', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get real-time user activity
   */
  async getRealTimeActivity(userId: string): Promise<{
    isActive: boolean;
    currentSession?: string;
    lastActivity: Date;
    activeFeatures: string[];
  }> {
    try {
      // Check active sessions in Redis
      const sessionKeys = await redis.keys(`session:*`);
      let currentSession: string | undefined;
      
      for (const key of sessionKeys) {
        const sessionData = await redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.userId === userId) {
            currentSession = session.sessionId;
            break;
          }
        }
      }

      // Get last activity from database
      const lastActivityQuery = `
        SELECT 
          timestamp as last_activity,
          array_agg(DISTINCT feature_name) FILTER (WHERE feature_name IS NOT NULL) as active_features
        FROM analytics.user_behavior_events
        WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '5 minutes'
        GROUP BY user_id
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const lastActivity = await database.query(lastActivityQuery, [userId]);

      return {
        isActive: !!currentSession,
        currentSession,
        lastActivity: lastActivity.rows[0]?.last_activity || new Date(0),
        activeFeatures: lastActivity.rows[0]?.active_features || []
      };
    } catch (error) {
      logger.error('Failed to get real-time activity', { error, userId });
      throw error;
    }
  }

  /**
   * Validate event data
   */
  private validateEvent(event: UserBehaviorEvent): void {
    if (!event.userId || !event.sessionId || !event.eventType || !event.eventName) {
      throw new Error('Missing required event fields: userId, sessionId, eventType, eventName');
    }

    const validEventTypes = [
      'PAGE_VIEW', 'FEATURE_CLICK', 'FORM_SUBMIT', 'BUTTON_CLICK',
      'MODAL_OPEN', 'MODAL_CLOSE', 'TAB_SWITCH', 'SEARCH', 'FILTER',
      'EXPORT', 'IMPORT', 'SHARE', 'SAVE', 'DELETE', 'EDIT'
    ];

    if (!validEventTypes.includes(event.eventType)) {
      throw new Error(`Invalid event type: ${event.eventType}`);
    }
  }

  /**
   * Update session information
   */
  private async updateSession(event: UserBehaviorEvent): Promise<void> {
    const sessionKey = `session:${event.sessionId}`;
    const existingSession = await redis.get(sessionKey);

    if (existingSession) {
      // Update session last activity
      const session = JSON.parse(existingSession);
      session.lastActivity = new Date();
      await redis.set(sessionKey, JSON.stringify(session), this.SESSION_TIMEOUT);
    } else {
      // Create new session if not exists
      const newSession: UserSession = {
        userId: event.userId,
        sessionId: event.sessionId,
        startedAt: new Date(),
        deviceType: this.parseDeviceType(event.userAgent),
        browser: this.parseBrowser(event.userAgent),
        os: this.parseOS(event.userAgent)
      };

      await this.startSession(newSession);
    }
  }

  /**
   * Update real-time metrics in Redis
   */
  private async updateRealTimeMetrics(event: UserBehaviorEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const userDailyKey = `user_daily:${event.userId}:${today}`;
    const globalDailyKey = `global_daily:${today}`;

    // Increment user daily counters
    await redis.hincrby(userDailyKey, 'total_events', 1);
    await redis.hincrby(userDailyKey, event.eventType, 1);
    await redis.expire(userDailyKey, 86400 * 2); // 2 days TTL

    // Increment global daily counters
    await redis.hincrby(globalDailyKey, 'total_events', 1);
    await redis.hincrby(globalDailyKey, event.eventType, 1);
    await redis.expire(globalDailyKey, 86400 * 7); // 7 days TTL

    // Track unique sessions
    await redis.sadd(`sessions:${today}`, event.sessionId);
    await redis.expire(`sessions:${today}`, 86400 * 2);
  }

  /**
   * Parse device type from user agent
   */
  private parseDeviceType(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile';
    if (/Tablet|iPad/.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  /**
   * Parse browser from user agent
   */
  private parseBrowser(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'unknown';
  }

  /**
   * Parse OS from user agent
   */
  private parseOS(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'unknown';
  }
}

export default new UserBehaviorService();