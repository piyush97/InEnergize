import { PredictiveAnalyticsService } from '../../src/services/predictiveAnalytics.service';
import { database } from '../../src/config/database';
import { redis } from '../../src/config/redis';
import { logger } from '../../src/config/logger';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/config/redis');
jest.mock('../../src/config/logger');

const mockDatabase = database as jest.Mocked<typeof database>;
const mockRedis = redis as jest.Mocked<typeof redis>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('PredictiveAnalyticsService', () => {
  let service: PredictiveAnalyticsService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    service = new PredictiveAnalyticsService();
    jest.clearAllMocks();
  });

  describe('generateGrowthPredictions', () => {
    const mockHistoricalData = [
      { timestamp: '2024-01-01', profile_views: 100, connections_count: 200, search_appearances: 50, engagement_rate: 3.5 },
      { timestamp: '2024-01-08', profile_views: 110, connections_count: 210, search_appearances: 55, engagement_rate: 3.7 },
      { timestamp: '2024-01-15', profile_views: 120, connections_count: 220, search_appearances: 60, engagement_rate: 3.9 },
      { timestamp: '2024-01-22', profile_views: 130, connections_count: 230, search_appearances: 65, engagement_rate: 4.1 },
      { timestamp: '2024-01-29', profile_views: 140, connections_count: 240, search_appearances: 70, engagement_rate: 4.3 },
      { timestamp: '2024-02-05', profile_views: 150, connections_count: 250, search_appearances: 75, engagement_rate: 4.5 },
      { timestamp: '2024-02-12', profile_views: 160, connections_count: 260, search_appearances: 80, engagement_rate: 4.7 }
    ];

    it('should generate growth predictions successfully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({ rows: mockHistoricalData });
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateGrowthPredictions(testUserId, '30d');

      expect(result).toMatchObject({
        userId: testUserId,
        timeframe: '30d',
        predictions: expect.objectContaining({
          profileViews: expect.objectContaining({
            metric: 'profile_views',
            currentValue: expect.any(Number),
            predictedValue: expect.any(Number),
            confidenceScore: expect.any(Number),
            timeframe: '30d',
            trend: expect.stringMatching(/increasing|decreasing|stable/),
            changePercent: expect.any(Number)
          }),
          connections: expect.any(Object),
          searchAppearances: expect.any(Object),
          engagementRate: expect.any(Object)
        }),
        generatedAt: expect.any(Date)
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [testUserId]
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        `predictions:growth:${testUserId}:30d`,
        expect.any(String),
        3600
      );
    });

    it('should return cached predictions when available', async () => {
      const cachedData = {
        userId: testUserId,
        timeframe: '30d',
        predictions: { test: 'data' },
        generatedAt: new Date()
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.generateGrowthPredictions(testUserId, '30d');

      expect(result).toEqual(cachedData);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });

    it('should handle different timeframes correctly', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({ rows: mockHistoricalData });
      mockRedis.set.mockResolvedValue('OK');

      await service.generateGrowthPredictions(testUserId, '7d');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('14 days'),
        [testUserId]
      );

      await service.generateGrowthPredictions(testUserId, '90d');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('180 days'),
        [testUserId]
      );
    });

    it('should throw error for insufficient historical data', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await expect(service.generateGrowthPredictions(testUserId, '30d'))
        .rejects.toThrow('Insufficient historical data for predictions');
    });

    it('should handle database errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.generateGrowthPredictions(testUserId, '30d'))
        .rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate growth predictions',
        expect.objectContaining({
          error: expect.any(Error),
          userId: testUserId,
          timeframe: '30d'
        })
      );
    });
  });

  describe('generateOptimizationRecommendations', () => {
    const mockCurrentMetrics = {
      completeness_score: 75,
      engagement_rate: 2.5,
      profile_views: 150
    };

    const mockTrends = {
      profileViewsTrend: 10,
      connectionsTrend: 3,
      engagementTrend: 5
    };

    const mockContentAnalysis = {
      avgEngagement: 8
    };

    beforeEach(() => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockCurrentMetrics] }) // getCurrentMetrics
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '10' }] }) // profileViewsTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '5' }] }) // searchAppearancesTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '3' }] }) // connectionsTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '2' }] }) // completenessTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '5' }] }) // engagementTrend
        .mockResolvedValueOnce({ rows: [{ avg_engagement: '8' }] }); // analyzeContentPerformance
    });

    it('should generate optimization recommendations successfully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateOptimizationRecommendations(testUserId);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should include profile recommendation for low completeness
      const profileRec = result.find(r => r.category === 'profile');
      expect(profileRec).toMatchObject({
        category: 'profile',
        priority: 'high',
        title: 'Complete Your Profile',
        description: expect.stringContaining('75% complete'),
        expectedImpact: expect.any(String),
        implementation: 'immediate',
        metrics: expect.arrayContaining(['profileViews', 'searchAppearances'])
      });

      // Should include engagement recommendation for low engagement rate
      const engagementRec = result.find(r => r.category === 'engagement');
      expect(engagementRec).toMatchObject({
        category: 'engagement',
        priority: 'medium',
        title: 'Increase Content Engagement',
        implementation: 'short_term'
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        `predictions:recommendations:${testUserId}`,
        expect.any(String),
        3600
      );
    });

    it('should return cached recommendations when available', async () => {
      const cachedRecommendations = [
        { category: 'profile', priority: 'high', title: 'Test Recommendation' }
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedRecommendations));

      const result = await service.generateOptimizationRecommendations(testUserId);

      expect(result).toEqual(cachedRecommendations);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });

    it('should sort recommendations by priority', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateOptimizationRecommendations(testUserId);

      // High priority should come first
      const priorities = result.map(r => r.priority);
      const highIndex = priorities.indexOf('high');
      const mediumIndex = priorities.indexOf('medium');
      
      if (highIndex !== -1 && mediumIndex !== -1) {
        expect(highIndex).toBeLessThan(mediumIndex);
      }
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      await expect(service.generateOptimizationRecommendations(testUserId))
        .rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate optimization recommendations',
        expect.objectContaining({
          error: expect.any(Error),
          userId: testUserId
        })
      );
    });
  });

  describe('generateBenchmarkPredictions', () => {
    const mockCurrentMetrics = {
      profile_views: 80,
      connections_count: 400,
      search_appearances: 40,
      engagement_rate: 4.5
    };

    const mockTrends = {
      profile_viewsTrend: 15,
      connections_countTrend: 8,
      search_appearancesTrend: 12,
      engagement_rateTrend: 5
    };

    beforeEach(() => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockCurrentMetrics] }) // getCurrentMetrics
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '15' }] }) // profileViewsTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '12' }] }) // searchAppearancesTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '8' }] }) // connectionsTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '2' }] }) // completenessTrend
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '5' }] }); // engagementTrend
    });

    it('should generate benchmark predictions successfully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateBenchmarkPredictions(testUserId);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(4); // 4 metrics

      result.forEach(prediction => {
        expect(prediction).toMatchObject({
          metric: expect.any(String),
          currentValue: expect.any(Number),
          industryBenchmark: expect.any(Number),
          daysToReachBenchmark: expect.any(Number),
          probabilityOfReaching: expect.any(Number),
          requiredGrowthRate: expect.any(Number)
        });

        expect(prediction.probabilityOfReaching).toBeGreaterThanOrEqual(0);
        expect(prediction.probabilityOfReaching).toBeLessThanOrEqual(1);
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        `predictions:benchmarks:${testUserId}`,
        expect.any(String),
        3600
      );
    });

    it('should return cached predictions when available', async () => {
      const cachedPredictions = [
        { metric: 'profile_views', currentValue: 80, industryBenchmark: 100 }
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPredictions));

      const result = await service.generateBenchmarkPredictions(testUserId);

      expect(result).toEqual(cachedPredictions);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });

    it('should handle metrics already meeting benchmarks', async () => {
      const metricsAboveBenchmark = {
        profile_views: 150, // Above benchmark of 100
        connections_count: 600, // Above benchmark of 500
        search_appearances: 60, // Above benchmark of 50
        engagement_rate: 6 // Above benchmark of 5
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [metricsAboveBenchmark] })
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '10' }] })
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '8' }] })
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '5' }] })
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '3' }] })
        .mockResolvedValueOnce({ rows: [{ calculate_trend: '2' }] });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateBenchmarkPredictions(testUserId);

      // All metrics should have probability of 1 (already reached)
      result.forEach(prediction => {
        expect(prediction.probabilityOfReaching).toBe(1);
      });
    });
  });

  describe('generateContentPerformancePredictions', () => {
    const mockEngagementHistory = [
      { content_type: 'post', engagement_value: 15, timestamp: '2024-01-01T10:00:00Z' },
      { content_type: 'post', engagement_value: 20, timestamp: '2024-01-02T14:00:00Z' },
      { content_type: 'article', engagement_value: 45, timestamp: '2024-01-03T09:00:00Z' },
      { content_type: 'video', engagement_value: 30, timestamp: '2024-01-04T11:00:00Z' },
      { content_type: 'carousel', engagement_value: 25, timestamp: '2024-01-05T15:00:00Z' }
    ];

    beforeEach(() => {
      mockDatabase.query.mockResolvedValue({ rows: mockEngagementHistory });
    });

    it('should generate content performance predictions successfully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateContentPerformancePredictions(testUserId);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(4); // 4 content types

      result.forEach(prediction => {
        expect(prediction).toMatchObject({
          contentType: expect.stringMatching(/article|post|video|carousel/),
          predictedEngagement: expect.any(Number),
          bestTimeToPost: expect.any(String),
          recommendedTopics: expect.any(Array),
          confidenceScore: expect.any(Number)
        });

        expect(prediction.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(prediction.confidenceScore).toBeLessThanOrEqual(1);
        expect(prediction.recommendedTopics.length).toBeGreaterThan(0);
      });
    });

    it('should return cached predictions when available', async () => {
      const cachedPredictions = [
        { contentType: 'post', predictedEngagement: 20 }
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPredictions));

      const result = await service.generateContentPerformancePredictions(testUserId);

      expect(result).toEqual(cachedPredictions);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });

    it('should handle empty engagement history', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateContentPerformancePredictions(testUserId);

      expect(result.length).toBe(4);
      result.forEach(prediction => {
        expect(prediction.predictedEngagement).toBe(6); // Default 5 * 1.2
        expect(prediction.confidenceScore).toBe(0.5); // Low confidence for no data
      });
    });

    it('should calculate different confidence scores based on data availability', async () => {
      // Mock data with varying amounts per content type
      const limitedEngagementHistory = [
        { content_type: 'post', engagement_value: 15, timestamp: '2024-01-01T10:00:00Z' },
        { content_type: 'post', engagement_value: 20, timestamp: '2024-01-02T14:00:00Z' },
        { content_type: 'post', engagement_value: 18, timestamp: '2024-01-03T11:00:00Z' },
        { content_type: 'post', engagement_value: 22, timestamp: '2024-01-04T16:00:00Z' },
        { content_type: 'post', engagement_value: 19, timestamp: '2024-01-05T13:00:00Z' },
        { content_type: 'post', engagement_value: 17, timestamp: '2024-01-06T10:00:00Z' }
      ];

      mockDatabase.query.mockResolvedValue({ rows: limitedEngagementHistory });
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateContentPerformancePredictions(testUserId);

      const postPrediction = result.find(p => p.contentType === 'post');
      const articlePrediction = result.find(p => p.contentType === 'article');

      expect(postPrediction?.confidenceScore).toBe(0.8); // High confidence (>5 samples)
      expect(articlePrediction?.confidenceScore).toBe(0.5); // Low confidence (no samples)
    });
  });

  describe('generateNetworkGrowthForecast', () => {
    const mockConnectionHistory = [
      { timestamp: '2024-01-01T10:00:00Z', connections_count: 200, day_of_week: 2, hour_of_day: 10 },
      { timestamp: '2024-01-02T14:00:00Z', connections_count: 205, day_of_week: 3, hour_of_day: 14 },
      { timestamp: '2024-01-03T09:00:00Z', connections_count: 210, day_of_week: 4, hour_of_day: 9 }
    ];

    const mockEngagementHistory = [
      { content_type: 'post', engagement_value: 15, timestamp: '2024-01-01T10:00:00Z' },
      { content_type: 'article', engagement_value: 25, timestamp: '2024-01-02T14:00:00Z' }
    ];

    beforeEach(() => {
      mockDatabase.query
        .mockResolvedValueOnce({ rows: mockConnectionHistory })
        .mockResolvedValueOnce({ rows: mockEngagementHistory });
    });

    it('should generate network growth forecast successfully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateNetworkGrowthForecast(testUserId);

      expect(result).toMatchObject({
        optimalConnectionTimes: expect.any(Array),
        recommendedTargets: expect.any(Array),
        networkHealthScore: expect.any(Number)
      });

      expect(result.optimalConnectionTimes.length).toBeGreaterThan(0);
      result.optimalConnectionTimes.forEach(time => {
        expect(time).toMatchObject({
          dayOfWeek: expect.any(String),
          hour: expect.any(Number),
          engagementMultiplier: expect.any(Number)
        });
      });

      expect(result.recommendedTargets.length).toBe(3);
      result.recommendedTargets.forEach(target => {
        expect(target).toMatchObject({
          industry: expect.any(String),
          connectionPotential: expect.any(Number),
          reasoning: expect.any(String)
        });
      });

      expect(result.networkHealthScore).toBeGreaterThanOrEqual(0);
      expect(result.networkHealthScore).toBeLessThanOrEqual(100);
    });

    it('should return cached forecast when available', async () => {
      const cachedForecast = {
        optimalConnectionTimes: [],
        recommendedTargets: [],
        networkHealthScore: 75
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedForecast));

      const result = await service.generateNetworkGrowthForecast(testUserId);

      expect(result).toEqual(cachedForecast);
      expect(mockDatabase.query).not.toHaveBeenCalled();
    });

    it('should calculate network health score correctly', async () => {
      // Test with good connection history (recent and consistent)
      const goodConnectionHistory = Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        connections_count: 200 + i,
        day_of_week: 2,
        hour_of_day: 10
      }));

      mockDatabase.query
        .mockResolvedValueOnce({ rows: goodConnectionHistory })
        .mockResolvedValueOnce({ rows: mockEngagementHistory });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateNetworkGrowthForecast(testUserId);

      // Should have high network health score
      expect(result.networkHealthScore).toBeGreaterThan(70);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await expect(service.generateGrowthPredictions(testUserId))
        .rejects.toThrow('Insufficient historical data');
    });

    it('should handle cache write failures gracefully', async () => {
      const mockHistoricalData = Array.from({ length: 10 }, (_, i) => ({
        timestamp: `2024-01-${i + 1}`,
        profile_views: 100 + i * 10,
        connections_count: 200 + i * 5,
        search_appearances: 50 + i * 2,
        engagement_rate: 3.5 + i * 0.1
      }));

      mockRedis.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({ rows: mockHistoricalData });
      mockRedis.set.mockRejectedValue(new Error('Cache write failed'));

      // Should still complete successfully even if cache write fails
      const result = await service.generateGrowthPredictions(testUserId);
      expect(result).toBeDefined();
      expect(result.userId).toBe(testUserId);
    });

    it('should handle malformed cached data', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');
      mockDatabase.query.mockResolvedValue({ rows: [] });

      // Should fall through to database query when cache parsing fails
      await expect(service.generateGrowthPredictions(testUserId))
        .rejects.toThrow('Insufficient historical data');
    });
  });

  describe('linear regression calculations', () => {
    it('should calculate trend predictions accurately', async () => {
      // Create predictable linear data
      const linearData = Array.from({ length: 10 }, (_, i) => ({
        timestamp: `2024-01-${i + 1}`,
        profile_views: 100 + i * 10, // Linear growth of 10 per period
        connections_count: 200,
        search_appearances: 50,
        engagement_rate: 3.5
      }));

      mockRedis.get.mockResolvedValue(null);
      mockDatabase.query.mockResolvedValue({ rows: linearData });
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateGrowthPredictions(testUserId, '30d');

      // Profile views should show increasing trend with predictable growth
      expect(result.predictions.profileViews.trend).toBe('increasing');
      expect(result.predictions.profileViews.changePercent).toBeGreaterThan(10);
      expect(result.predictions.profileViews.confidenceScore).toBeGreaterThan(0.8);
    });
  });
});