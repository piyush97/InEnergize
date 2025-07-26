import { database } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/config/logger';
import { 
  ProfileMetric, 
  EngagementMetric, 
  ProfileAnalytics, 
  DashboardMetrics,
  AnalyticsQuery,
  MetricAggregation
} from '@/types/analytics';

export class MetricsService {
  private readonly CACHE_TTL = 300; // 5 minutes cache
  private readonly CACHE_PREFIX = 'metrics:';

  /**
   * Record a profile metric data point
   */
  async recordProfileMetric(metric: ProfileMetric): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics.profile_metrics (
          user_id, timestamp, profile_views, search_appearances, 
          connections_count, completeness_score, skills_count,
          endorsements_count, recommendations_count, posts_count,
          articles_count, engagement_rate, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      
      const values = [
        metric.userId,
        metric.timestamp,
        metric.profileViews,
        metric.searchAppearances,
        metric.connectionsCount,
        metric.completenessScore,
        metric.skillsCount,
        metric.endorsementsCount,
        metric.recommendationsCount,
        metric.postsCount,
        metric.articlesCount,
        metric.engagementRate,
        metric.source
      ];

      await database.query(query, values);
      
      // Invalidate cache for this user
      await this.invalidateUserCache(metric.userId);
      
      logger.info('Profile metric recorded', { 
        userId: metric.userId, 
        source: metric.source,
        timestamp: metric.timestamp 
      });
    } catch (error) {
      logger.error('Failed to record profile metric', { error, metric });
      throw error;
    }
  }

  /**
   * Record an engagement metric
   */
  async recordEngagementMetric(metric: EngagementMetric): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics.engagement_metrics (
          user_id, content_id, timestamp, type, value, source, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      
      const values = [
        metric.userId,
        metric.contentId || null,
        metric.timestamp,
        metric.type,
        metric.value,
        metric.source,
        JSON.stringify(metric.metadata || {})
      ];

      await database.query(query, values);
      
      logger.info('Engagement metric recorded', { 
        userId: metric.userId, 
        type: metric.type,
        value: metric.value 
      });
    } catch (error) {
      logger.error('Failed to record engagement metric', { error, metric });
      throw error;
    }
  }

  /**
   * Get dashboard metrics for a user
   */
  async getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
    const cacheKey = `${this.CACHE_PREFIX}dashboard:${userId}`;
    
    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get latest metrics
      const latestQuery = `
        SELECT * FROM analytics.get_user_latest_metrics($1)
      `;
      const latestResult = await database.query(latestQuery, [userId]);
      
      if (latestResult.rows.length === 0) {
        throw new Error(`No metrics found for user ${userId}`);
      }

      const latest = latestResult.rows[0];

      // Calculate trends
      const trends = await this.calculateTrends(userId);

      // Get user goals
      const goalsQuery = `
        SELECT goal_type, target_value FROM analytics.user_goals 
        WHERE user_id = $1 AND achieved = false
      `;
      const goalsResult = await database.query(goalsQuery, [userId]);
      
      const goals: any = {};
      goalsResult.rows.forEach((row: any) => {
        goals[`${row.goal_type}Goal`] = row.target_value;
      });

      const dashboardMetrics: DashboardMetrics = {
        userId,
        snapshot: {
          profileViews: latest.profile_views,
          searchAppearances: latest.search_appearances,
          connections: latest.connections_count,
          completenessScore: parseFloat(latest.completeness_score),
          engagementRate: parseFloat(latest.engagement_rate)
        },
        trends,
        goals,
        lastUpdated: new Date(latest.timestamp)
      };

      // Cache result
      await redis.set(cacheKey, JSON.stringify(dashboardMetrics), this.CACHE_TTL);
      
      return dashboardMetrics;
    } catch (error) {
      logger.error('Failed to get dashboard metrics', { error, userId });
      throw error;
    }
  }

  /**
   * Get detailed analytics for a user
   */
  async getProfileAnalytics(query: AnalyticsQuery): Promise<ProfileAnalytics> {
    const { userId, timeRange, granularity = 'day' } = query;
    const cacheKey = `${this.CACHE_PREFIX}analytics:${userId}:${granularity}:${timeRange?.start?.toISOString()}:${timeRange?.end?.toISOString()}`;
    
    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const startDate = timeRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = timeRange?.end || new Date();

      // Get current period metrics
      const currentMetrics = await this.getMetricsForPeriod(userId, startDate, endDate);
      
      // Get previous period metrics for comparison
      const periodDuration = endDate.getTime() - startDate.getTime();
      const previousStart = new Date(startDate.getTime() - periodDuration);
      const previousMetrics = await this.getMetricsForPeriod(userId, previousStart, startDate);

      // Get chart data
      const chartData = await this.getChartData(userId, startDate, endDate, granularity);

      // Get engagement metrics
      const engagementData = await this.getEngagementMetrics(userId, startDate, endDate);

      const analytics: ProfileAnalytics = {
        userId,
        timeRange: { start: startDate, end: endDate },
        metrics: {
          profileViews: this.calculateMetricComparison(
            currentMetrics.avg_profile_views || 0,
            previousMetrics.avg_profile_views || 0
          ),
          searchAppearances: this.calculateMetricComparison(
            currentMetrics.avg_search_appearances || 0,
            previousMetrics.avg_search_appearances || 0
          ),
          connections: this.calculateMetricComparison(
            currentMetrics.avg_connections_count || 0,
            previousMetrics.avg_connections_count || 0
          ),
          completeness: this.calculateMetricComparison(
            currentMetrics.avg_completeness_score || 0,
            previousMetrics.avg_completeness_score || 0
          ),
          engagement: engagementData
        },
        chartData
      };

      // Cache result
      await redis.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);
      
      return analytics;
    } catch (error) {
      logger.error('Failed to get profile analytics', { error, query });
      throw error;
    }
  }

  /**
   * Create or update metric aggregations
   */
  async createAggregation(aggregation: MetricAggregation): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics.metric_aggregations (
          user_id, interval_type, timestamp, metrics, source
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, interval_type, timestamp) 
        DO UPDATE SET metrics = $4, source = $5
      `;
      
      const values = [
        aggregation.userId,
        aggregation.interval,
        aggregation.timestamp,
        JSON.stringify(aggregation.metrics),
        aggregation.source
      ];

      await database.query(query, values);
      
      logger.debug('Metric aggregation created', { 
        userId: aggregation.userId, 
        interval: aggregation.interval 
      });
    } catch (error) {
      logger.error('Failed to create metric aggregation', { error, aggregation });
      throw error;
    }
  }

  /**
   * Get metrics for a specific time period
   */
  private async getMetricsForPeriod(userId: string, start: Date, end: Date): Promise<any> {
    const query = `
      SELECT 
        AVG(profile_views) as avg_profile_views,
        AVG(search_appearances) as avg_search_appearances,
        AVG(connections_count) as avg_connections_count,
        AVG(completeness_score) as avg_completeness_score,
        AVG(engagement_rate) as avg_engagement_rate
      FROM analytics.profile_metrics
      WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
    `;
    
    const result = await database.query(query, [userId, start, end]);
    return result.rows[0] || {};
  }

  /**
   * Calculate trends for dashboard
   */
  private async calculateTrends(userId: string): Promise<any> {
    const trends = {
      profileViewsTrend: 0,
      searchAppearancesTrend: 0,
      connectionsTrend: 0,
      completenessTrend: 0,
      engagementTrend: 0
    };

    try {
      const metrics = ['profile_views', 'search_appearances', 'connections_count', 'completeness_score', 'engagement_rate'];
      const trendKeys = ['profileViewsTrend', 'searchAppearancesTrend', 'connectionsTrend', 'completenessTrend', 'engagementTrend'];

      for (let i = 0; i < metrics.length; i++) {
        const trendQuery = `SELECT analytics.calculate_trend($1, $2, $3)`;
        const result = await database.query(trendQuery, [userId, metrics[i], 7]);
        trends[trendKeys[i] as keyof typeof trends] = parseFloat(result.rows[0]?.calculate_trend || '0');
      }
    } catch (error) {
      logger.error('Failed to calculate trends', { error, userId });
    }

    return trends;
  }

  /**
   * Get chart data for analytics
   */
  private async getChartData(userId: string, start: Date, end: Date, granularity: string): Promise<any> {
    const timeFormat = granularity === 'hour' ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD';
    const interval = granularity === 'hour' ? '1 hour' : '1 day';
    
    const query = `
      SELECT 
        TO_CHAR(time_bucket('${interval}', timestamp), '${timeFormat}') as date,
        AVG(profile_views) as profileViews,
        AVG(search_appearances) as searchAppearances,
        AVG(connections_count) as connections,
        AVG(completeness_score) as completeness,
        AVG(engagement_rate) as engagement
      FROM analytics.profile_metrics
      WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
      GROUP BY time_bucket('${interval}', timestamp)
      ORDER BY time_bucket('${interval}', timestamp)
    `;
    
    const result = await database.query(query, [userId, start, end]);
    
    return {
      profileViews: result.rows.map((row: any) => ({ date: row.date, value: parseFloat(row.profileviews || '0') })),
      searchAppearances: result.rows.map((row: any) => ({ date: row.date, value: parseFloat(row.searchappearances || '0') })),
      connections: result.rows.map((row: any) => ({ date: row.date, value: parseFloat(row.connections || '0') })),
      completeness: result.rows.map((row: any) => ({ date: row.date, value: parseFloat(row.completeness || '0') })),
      engagement: result.rows.map((row: any) => ({ date: row.date, value: parseFloat(row.engagement || '0') }))
    };
  }

  /**
   * Get engagement metrics
   */
  private async getEngagementMetrics(userId: string, start: Date, end: Date): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as totalEngagements,
        AVG(value) as averageEngagementRate,
        type,
        COUNT(*) as count
      FROM analytics.engagement_metrics
      WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
      GROUP BY type
      ORDER BY count DESC
    `;
    
    const result = await database.query(query, [userId, start, end]);
    
    return {
      totalEngagements: result.rows.reduce((sum: any, row: any) => sum + parseInt(row.totalengagements), 0),
      averageEngagementRate: result.rows.length > 0 ? 
        result.rows.reduce((sum: any, row: any) => sum + parseFloat(row.averageengagementrate), 0) / result.rows.length : 0,
      topContentTypes: result.rows.map((row: any) => ({
        type: row.type,
        count: parseInt(row.count),
        engagementRate: parseFloat(row.averageengagementrate || '0')
      }))
    };
  }

  /**
   * Calculate metric comparison
   */
  private calculateMetricComparison(current: number, previous: number): any {
    const change = current - previous;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    
    return {
      current: Math.round(current * 100) / 100,
      previous: Math.round(previous * 100) / 100,
      change: Math.round(change * 100) / 100,
      trend
    };
  }

  /**
   * Invalidate cache for user
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}*${userId}*`;
      const client = redis.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(...keys);
        logger.debug('Cache invalidated for user', { userId, keysCount: keys.length });
      }
    } catch (error) {
      logger.warn('Failed to invalidate cache', { error, userId });
    }
  }
}