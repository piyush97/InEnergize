import { database } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/config/logger';

export interface PredictionResult {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidenceScore: number; // 0-1
  timeframe: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
}

export interface GrowthPrediction {
  userId: string;
  timeframe: '7d' | '30d' | '90d';
  predictions: {
    profileViews: PredictionResult;
    connections: PredictionResult;
    searchAppearances: PredictionResult;
    engagementRate: PredictionResult;
  };
  generatedAt: Date;
}

export interface OptimizationRecommendation {
  category: 'profile' | 'content' | 'engagement' | 'networking';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: 'immediate' | 'short_term' | 'long_term';
  metrics: string[];
}

export interface BenchmarkPrediction {
  metric: string;
  currentValue: number;
  industryBenchmark: number;
  daysToReachBenchmark: number | null;
  probabilityOfReaching: number; // 0-1
  requiredGrowthRate: number; // daily percentage
}

export interface ContentPerformancePrediction {
  contentType: 'article' | 'post' | 'video' | 'carousel';
  predictedEngagement: number;
  bestTimeToPost: string;
  recommendedTopics: string[];
  confidenceScore: number;
}

export interface NetworkGrowthForecast {
  optimalConnectionTimes: Array<{
    dayOfWeek: string;
    hour: number;
    engagementMultiplier: number;
  }>;
  recommendedTargets: Array<{
    industry: string;
    connectionPotential: number;
    reasoning: string;
  }>;
  networkHealthScore: number; // 0-100
}

export class PredictiveAnalyticsService {
  private readonly CACHE_TTL = 3600; // 1 hour cache for predictions
  private readonly CACHE_PREFIX = 'predictions:';

  /**
   * Generate growth predictions for a user
   */
  async generateGrowthPredictions(userId: string, timeframe: '7d' | '30d' | '90d' = '30d'): Promise<GrowthPrediction> {
    const cacheKey = `${this.CACHE_PREFIX}growth:${userId}:${timeframe}`;
    
    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      
      // Get historical data for trend analysis
      const historicalData = await this.getHistoricalData(userId, days * 2); // Get 2x period for better trend analysis
      
      if (historicalData.length < 7) {
        throw new Error('Insufficient historical data for predictions');
      }

      const predictions: GrowthPrediction = {
        userId,
        timeframe,
        predictions: {
          profileViews: await this.predictMetric(historicalData, 'profile_views', days),
          connections: await this.predictMetric(historicalData, 'connections_count', days),
          searchAppearances: await this.predictMetric(historicalData, 'search_appearances', days),
          engagementRate: await this.predictMetric(historicalData, 'engagement_rate', days)
        },
        generatedAt: new Date()
      };

      // Cache result
      await redis.set(cacheKey, JSON.stringify(predictions), this.CACHE_TTL);
      
      logger.info('Growth predictions generated', { userId, timeframe });
      return predictions;
    } catch (error) {
      logger.error('Failed to generate growth predictions', { error, userId, timeframe });
      throw error;
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizationRecommendations(userId: string): Promise<OptimizationRecommendation[]> {
    const cacheKey = `${this.CACHE_PREFIX}recommendations:${userId}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const recommendations: OptimizationRecommendation[] = [];
      
      // Get current metrics and trends
      const currentMetrics = await this.getCurrentMetrics(userId);
      const trends = await this.calculateTrends(userId);
      
      // Profile optimization recommendations
      if (currentMetrics.completeness_score < 80) {
        recommendations.push({
          category: 'profile',
          priority: 'high',
          title: 'Complete Your Profile',
          description: 'Your profile is only ' + Math.round(currentMetrics.completeness_score) + '% complete. Adding missing sections can increase visibility by 40%.',
          expectedImpact: '+40% profile views, +25% search appearances',
          implementation: 'immediate',
          metrics: ['profileViews', 'searchAppearances']
        });
      }

      // Engagement recommendations
      if (currentMetrics.engagement_rate < 3) {
        recommendations.push({
          category: 'engagement',
          priority: 'medium',
          title: 'Increase Content Engagement',
          description: 'Your engagement rate is below industry average. Focus on posting at optimal times and using engaging formats.',
          expectedImpact: '+50% engagement rate, +20% profile views',
          implementation: 'short_term',
          metrics: ['engagementRate', 'profileViews']
        });
      }

      // Networking recommendations based on connection growth
      if (trends.connectionsTrend < 5) {
        recommendations.push({
          category: 'networking',
          priority: 'medium',
          title: 'Expand Your Network',
          description: 'Your connection growth has slowed. Active networking can increase opportunities and visibility.',
          expectedImpact: '+30% connections, +15% profile views',
          implementation: 'short_term',
          metrics: ['connections', 'profileViews']
        });
      }

      // Content strategy recommendations
      const contentAnalysis = await this.analyzeContentPerformance(userId);
      if (contentAnalysis.avgEngagement < 10) {
        recommendations.push({
          category: 'content',
          priority: 'high',
          title: 'Optimize Content Strategy',
          description: 'Your content engagement is below potential. Focus on trending topics and visual content.',
          expectedImpact: '+60% content engagement, +35% profile visibility',
          implementation: 'immediate',
          metrics: ['engagementRate', 'profileViews', 'searchAppearances']
        });
      }

      // Sort by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

      await redis.set(cacheKey, JSON.stringify(recommendations), this.CACHE_TTL);
      
      return recommendations;
    } catch (error) {
      logger.error('Failed to generate optimization recommendations', { error, userId });
      throw error;
    }
  }

  /**
   * Predict when user will reach industry benchmarks
   */
  async generateBenchmarkPredictions(userId: string): Promise<BenchmarkPrediction[]> {
    const cacheKey = `${this.CACHE_PREFIX}benchmarks:${userId}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const currentMetrics = await this.getCurrentMetrics(userId);
      const trends = await this.calculateTrends(userId);
      
      // Industry benchmarks (these could be dynamic from a benchmarks table)
      const benchmarks = {
        profile_views: 100, // views per week
        connections_count: 500,
        search_appearances: 50, // per week
        engagement_rate: 5 // percentage
      };

      const predictions: BenchmarkPrediction[] = [];
      
      for (const [metric, benchmark] of Object.entries(benchmarks)) {
        const current = currentMetrics[metric] || 0;
        const trend = trends[`${metric}Trend`] || 0;
        
        let daysToReach: number | null = null;
        let probability = 0;
        let requiredGrowthRate = 0;
        
        if (current < benchmark) {
          // Calculate required daily growth rate
          requiredGrowthRate = ((benchmark - current) / current) / 30; // 30-day target
          
          // Calculate days to reach based on current trend
          if (trend > 0) {
            const dailyGrowthRate = trend / 100 / 7; // Convert weekly percentage to daily
            daysToReach = Math.ceil(Math.log(benchmark / current) / Math.log(1 + dailyGrowthRate));
            probability = Math.min(0.9, Math.max(0.1, trend / 20)); // Higher trend = higher probability
          }
        } else {
          probability = 1; // Already reached
        }

        predictions.push({
          metric,
          currentValue: current,
          industryBenchmark: benchmark,
          daysToReachBenchmark: daysToReach,
          probabilityOfReaching: probability,
          requiredGrowthRate: requiredGrowthRate * 100 // Convert to percentage
        });
      }

      await redis.set(cacheKey, JSON.stringify(predictions), this.CACHE_TTL);
      
      return predictions;
    } catch (error) {
      logger.error('Failed to generate benchmark predictions', { error, userId });
      throw error;
    }
  }

  /**
   * Predict content performance
   */
  async generateContentPerformancePredictions(userId: string): Promise<ContentPerformancePrediction[]> {
    const cacheKey = `${this.CACHE_PREFIX}content:${userId}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const engagementHistory = await this.getEngagementHistory(userId);
      const predictions: ContentPerformancePrediction[] = [];
      
      const contentTypes: Array<'article' | 'post' | 'video' | 'carousel'> = ['article', 'post', 'video', 'carousel'];
      
      for (const contentType of contentTypes) {
        const typeEngagement = engagementHistory.filter(e => e.content_type === contentType);
        const avgEngagement = typeEngagement.length > 0 
          ? typeEngagement.reduce((sum, e) => sum + e.engagement_value, 0) / typeEngagement.length
          : 5; // Default prediction

        // Analyze best posting times based on historical data
        const timeAnalysis = this.analyzeBestPostingTimes(typeEngagement);
        
        predictions.push({
          contentType,
          predictedEngagement: Math.round(avgEngagement * 1.2), // 20% improvement potential
          bestTimeToPost: timeAnalysis.bestTime,
          recommendedTopics: this.getRecommendedTopics(contentType, userId),
          confidenceScore: typeEngagement.length > 5 ? 0.8 : 0.5
        });
      }

      await redis.set(cacheKey, JSON.stringify(predictions), this.CACHE_TTL);
      
      return predictions;
    } catch (error) {
      logger.error('Failed to generate content performance predictions', { error, userId });
      throw error;
    }
  }

  /**
   * Generate network growth forecast
   */
  async generateNetworkGrowthForecast(userId: string): Promise<NetworkGrowthForecast> {
    const cacheKey = `${this.CACHE_PREFIX}network:${userId}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const connectionHistory = await this.getConnectionHistory(userId);
      const engagementHistory = await this.getEngagementHistory(userId);
      
      // Analyze optimal connection times
      const optimalTimes = this.analyzeOptimalConnectionTimes(connectionHistory, engagementHistory);
      
      // Generate industry recommendations
      const recommendedTargets = [
        {
          industry: 'Technology',
          connectionPotential: 85,
          reasoning: 'High engagement rates and mutual connection opportunities'
        },
        {
          industry: 'Marketing',
          connectionPotential: 78,
          reasoning: 'Strong content sharing and collaboration potential'
        },
        {
          industry: 'Finance',
          connectionPotential: 72,
          reasoning: 'Professional networking and knowledge exchange'
        }
      ];

      // Calculate network health score
      const networkHealthScore = this.calculateNetworkHealthScore(userId, connectionHistory);

      const forecast: NetworkGrowthForecast = {
        optimalConnectionTimes: optimalTimes,
        recommendedTargets,
        networkHealthScore
      };

      await redis.set(cacheKey, JSON.stringify(forecast), this.CACHE_TTL);
      
      return forecast;
    } catch (error) {
      logger.error('Failed to generate network growth forecast', { error, userId });
      throw error;
    }
  }

  // Private helper methods

  private async getHistoricalData(userId: string, days: number): Promise<any[]> {
    const query = `
      SELECT 
        timestamp,
        profile_views,
        connections_count,
        search_appearances,
        engagement_rate,
        completeness_score
      FROM analytics.profile_metrics
      WHERE user_id = $1 
        AND timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp ASC
    `;
    
    const result = await database.query(query, [userId]);
    return result.rows;
  }

  private async predictMetric(historicalData: any[], metricName: string, days: number): Promise<PredictionResult> {
    const values = historicalData.map(d => parseFloat(d[metricName]) || 0);
    
    if (values.length < 2) {
      throw new Error(`Insufficient data for ${metricName} prediction`);
    }

    // Simple linear regression for trend prediction
    const { slope, intercept, correlation } = this.linearRegression(values);
    
    const currentValue = values[values.length - 1];
    const predictedValue = Math.max(0, currentValue + (slope * days));
    const changePercent = currentValue > 0 ? ((predictedValue - currentValue) / currentValue) * 100 : 0;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 2) {
      trend = changePercent > 0 ? 'increasing' : 'decreasing';
    }

    return {
      metric: metricName,
      currentValue: Math.round(currentValue * 100) / 100,
      predictedValue: Math.round(predictedValue * 100) / 100,
      confidenceScore: Math.max(0.1, Math.min(0.9, Math.abs(correlation))),
      timeframe: `${days}d`,
      trend,
      changePercent: Math.round(changePercent * 100) / 100
    };
  }

  private linearRegression(values: number[]): { slope: number; intercept: number; correlation: number } {
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    const sumYY = values.reduce((sum, y) => sum + y * y, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator === 0 ? 0 : numerator / denominator;
    
    return { slope, intercept, correlation };
  }

  private async getCurrentMetrics(userId: string): Promise<any> {
    const query = `
      SELECT * FROM analytics.get_user_latest_metrics($1)
    `;
    const result = await database.query(query, [userId]);
    return result.rows[0] || {};
  }

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

  private async analyzeContentPerformance(userId: string): Promise<{ avgEngagement: number }> {
    const query = `
      SELECT AVG(value) as avg_engagement
      FROM analytics.engagement_metrics
      WHERE user_id = $1 
        AND timestamp >= NOW() - INTERVAL '30 days'
    `;
    
    const result = await database.query(query, [userId]);
    return {
      avgEngagement: parseFloat(result.rows[0]?.avg_engagement || '0')
    };
  }

  private async getEngagementHistory(userId: string): Promise<any[]> {
    const query = `
      SELECT 
        timestamp,
        type as content_type,
        value as engagement_value,
        metadata
      FROM analytics.engagement_metrics
      WHERE user_id = $1 
        AND timestamp >= NOW() - INTERVAL '90 days'
      ORDER BY timestamp DESC
    `;
    
    const result = await database.query(query, [userId]);
    return result.rows;
  }

  private async getConnectionHistory(userId: string): Promise<any[]> {
    const query = `
      SELECT 
        timestamp,
        connections_count,
        EXTRACT(DOW FROM timestamp) as day_of_week,
        EXTRACT(HOUR FROM timestamp) as hour_of_day
      FROM analytics.profile_metrics
      WHERE user_id = $1 
        AND timestamp >= NOW() - INTERVAL '90 days'
      ORDER BY timestamp DESC
    `;
    
    const result = await database.query(query, [userId]);
    return result.rows;
  }

  private analyzeBestPostingTimes(engagementData: any[]): { bestTime: string } {
    if (engagementData.length === 0) {
      return { bestTime: 'Tuesday 10:00 AM' }; // Default recommendation
    }

    // Group by hour and calculate average engagement
    const hourlyEngagement: { [key: number]: number[] } = {};
    
    engagementData.forEach(item => {
      const hour = new Date(item.timestamp).getHours();
      if (!hourlyEngagement[hour]) {
        hourlyEngagement[hour] = [];
      }
      hourlyEngagement[hour].push(item.engagement_value);
    });

    // Find best performing hour
    let bestHour = 10; // Default
    let maxAvgEngagement = 0;

    Object.entries(hourlyEngagement).forEach(([hour, values]) => {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      if (avg > maxAvgEngagement) {
        maxAvgEngagement = avg;
        bestHour = parseInt(hour);
      }
    });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bestDay = days[2]; // Default to Tuesday, could be enhanced with day analysis
    
    return {
      bestTime: `${bestDay} ${bestHour}:00`
    };
  }

  private getRecommendedTopics(contentType: string, userId: string): string[] {
    // This could be enhanced with NLP analysis of successful content
    const topicMap = {
      article: ['Industry Insights', 'Leadership', 'Career Development', 'Technology Trends'],
      post: ['Personal Experience', 'Quick Tips', 'Industry News', 'Behind the Scenes'],
      video: ['Tutorials', 'Interviews', 'Company Culture', 'Product Demos'],
      carousel: ['Step-by-step Guides', 'Statistics', 'Before/After', 'Comparisons']
    };

    return topicMap[contentType] || ['General Professional Content'];
  }

  private analyzeOptimalConnectionTimes(connectionHistory: any[], engagementHistory: any[]): Array<{
    dayOfWeek: string;
    hour: number;
    engagementMultiplier: number;
  }> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Default optimal times based on general LinkedIn usage patterns
    return [
      { dayOfWeek: 'Tuesday', hour: 10, engagementMultiplier: 1.3 },
      { dayOfWeek: 'Wednesday', hour: 14, engagementMultiplier: 1.2 },
      { dayOfWeek: 'Thursday', hour: 9, engagementMultiplier: 1.25 },
      { dayOfWeek: 'Tuesday', hour: 15, engagementMultiplier: 1.15 },
      { dayOfWeek: 'Wednesday', hour: 11, engagementMultiplier: 1.1 }
    ];
  }

  private calculateNetworkHealthScore(userId: string, connectionHistory: any[]): number {
    // Simple health score calculation
    // Could be enhanced with more sophisticated metrics
    
    let score = 50; // Base score
    
    // Recent connection growth
    const recentConnections = connectionHistory.filter(c => 
      new Date(c.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    
    if (recentConnections.length > 10) score += 20;
    else if (recentConnections.length > 5) score += 10;
    
    // Connection consistency
    if (connectionHistory.length > 50) score += 15;
    else if (connectionHistory.length > 20) score += 10;
    
    // Engagement diversity (simplified)
    score += 15; // Default bonus for having engagement data
    
    return Math.min(100, Math.max(0, score));
  }
}