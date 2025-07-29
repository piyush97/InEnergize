import { Request, Response } from 'express';
import { PredictiveAnalyticsService } from '@/services/predictiveAnalytics.service';
import { logger } from '@/config/logger';
import { AnalyticsResponse, PredictiveAnalyticsResponse } from '@/types/analytics';

export class PredictiveAnalyticsController {
  private predictiveService: PredictiveAnalyticsService;

  constructor() {
    this.predictiveService = new PredictiveAnalyticsService();
  }

  /**
   * Get growth predictions for a user
   */
  public getGrowthPredictions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const { timeframe = '30d' } = req.query;
      
      if (!['7d', '30d', '90d'].includes(timeframe as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid timeframe. Use 7d, 30d, or 90d'
        } as AnalyticsResponse);
        return;
      }

      const predictions = await this.predictiveService.generateGrowthPredictions(
        userId, 
        timeframe as '7d' | '30d' | '90d'
      );

      res.json({
        success: true,
        data: predictions,
        metadata: {
          totalRecords: 1,
          timeRange: {
            start: new Date(),
            end: new Date(Date.now() + (timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000)
          }
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get growth predictions', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get growth predictions'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get optimization recommendations
   */
  public getOptimizationRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const recommendations = await this.predictiveService.generateOptimizationRecommendations(userId);

      res.json({
        success: true,
        data: recommendations,
        metadata: {
          totalRecords: recommendations.length
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get optimization recommendations', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get optimization recommendations'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get benchmark predictions
   */
  public getBenchmarkPredictions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const predictions = await this.predictiveService.generateBenchmarkPredictions(userId);

      res.json({
        success: true,
        data: predictions,
        metadata: {
          totalRecords: predictions.length
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get benchmark predictions', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get benchmark predictions'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get content performance predictions
   */
  public getContentPredictions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const predictions = await this.predictiveService.generateContentPerformancePredictions(userId);

      res.json({
        success: true,
        data: predictions,
        metadata: {
          totalRecords: predictions.length
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get content predictions', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get content predictions'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get network growth forecast
   */
  public getNetworkForecast = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const forecast = await this.predictiveService.generateNetworkGrowthForecast(userId);

      res.json({
        success: true,
        data: forecast,
        metadata: {
          totalRecords: 1
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get network forecast', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get network forecast'
      } as AnalyticsResponse);
    }
  };

  /**
   * Get comprehensive predictive analytics dashboard
   */
  public getPredictiveDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        } as AnalyticsResponse);
        return;
      }

      const { timeframe = '30d', includeRecommendations = 'true' } = req.query;
      
      // Get all predictive analytics data
      const [
        growthPredictions,
        recommendations,
        benchmarkPredictions,
        contentPredictions,
        networkForecast
      ] = await Promise.all([
        this.predictiveService.generateGrowthPredictions(userId, timeframe as '7d' | '30d' | '90d'),
        includeRecommendations === 'true' ? this.predictiveService.generateOptimizationRecommendations(userId) : null,
        this.predictiveService.generateBenchmarkPredictions(userId),
        this.predictiveService.generateContentPerformancePredictions(userId),
        this.predictiveService.generateNetworkGrowthForecast(userId)
      ]);

      const dashboardData: PredictiveAnalyticsResponse = {
        growthPredictions,
        recommendations: recommendations || undefined,
        benchmarkPredictions,
        contentPredictions,
        networkForecast
      };

      res.json({
        success: true,
        data: dashboardData,
        metadata: {
          totalRecords: 1,
          timeRange: {
            start: new Date(),
            end: new Date(Date.now() + (timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000)
          }
        }
      } as AnalyticsResponse);

    } catch (error) {
      logger.error('Failed to get predictive dashboard', { error, userId: req.user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get predictive dashboard'
      } as AnalyticsResponse);
    }
  };

  /**
   * Health check for predictive analytics
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date(),
          service: 'predictive-analytics',
          version: '1.0.0',
          features: [
            'growth-predictions',
            'optimization-recommendations', 
            'benchmark-predictions',
            'content-predictions',
            'network-forecast'
          ]
        }
      } as AnalyticsResponse);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Predictive analytics health check failed'
      } as AnalyticsResponse);
    }
  };
}