import { Request, Response } from 'express';
import { MetricsService } from '@/services/metrics.service';
import { logger } from '@/config/logger';
import { AnalyticsResponse, ProfileMetric, EngagementMetric } from '@/types/analytics';

export class MetricsController {
  private metricsService: MetricsService;

  constructor() {
    this.metricsService = new MetricsService();
  }

  /**
   * Record a new profile metric
   */
  public recordProfileMetric = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const metricData: Omit<ProfileMetric, 'userId'> = req.body;
      const metric: ProfileMetric = {
        ...metricData,
        userId,
        timestamp: metricData.timestamp ? new Date(metricData.timestamp) : new Date()
      };

      await this.metricsService.recordProfileMetric(metric);

      res.status(201).json({
        success: true,
        data: { message: 'Profile metric recorded successfully' }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to record profile metric', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to record profile metric'
      } as AnalyticsResponse);
    }
  };

  /**
   * Record an engagement metric
   */
  public recordEngagementMetric = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const metricData: Omit<EngagementMetric, 'userId'> = req.body;
      const metric: EngagementMetric = {
        ...metricData,
        userId,
        timestamp: metricData.timestamp ? new Date(metricData.timestamp) : new Date()
      };

      await this.metricsService.recordEngagementMetric(metric);

      res.status(201).json({
        success: true,
        data: { message: 'Engagement metric recorded successfully' }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to record engagement metric', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to record engagement metric'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get dashboard metrics
   */
  public getDashboardMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const metrics = await this.metricsService.getDashboardMetrics(userId);

      res.json({
        success: true,
        data: metrics,
        metadata: {
          totalRecords: 1,
          timeRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date()
          }
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get dashboard metrics', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard metrics'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get profile analytics
   */
  public getProfileAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const { startDate, endDate, granularity = 'day', metrics } = req.query;
      
      const timeRange = {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date()
      };

      const query = {
        userId,
        timeRange,
        granularity: granularity as 'hour' | 'day' | 'week' | 'month',
        metrics: metrics ? (metrics as string).split(',') : undefined
      };

      const analytics = await this.metricsService.getProfileAnalytics(query);

      res.json({
        success: true,
        data: analytics,
        metadata: {
          totalRecords: 1,
          timeRange
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get profile analytics', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get profile analytics'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get metrics for a specific time range
   */
  public getMetricsTimeRange = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const { startDate, endDate, limit = 100, offset = 0 } = req.query;
      
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        } as AnalyticsResponse);
        return;
      }

      // This would be a new method in MetricsService for raw metric data
      // For now, we'll use the analytics method
      const query = {
        userId,
        timeRange: {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        }
      };

      const analytics = await this.metricsService.getProfileAnalytics(query);

      res.json({
        success: true,
        data: analytics.chartData,
        metadata: {
          totalRecords: Object.keys(analytics.chartData).length,
          page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
          limit: parseInt(limit as string),
          timeRange: query.timeRange
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get metrics for time range', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics for time range'
      } as AnalyticsResponse);
    }
  };

  /**
   * Health check endpoint
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date(),
          service: 'analytics-service',
          version: '1.0.0'
        }
      } as AnalyticsResponse);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      } as AnalyticsResponse);
    }
  };
}