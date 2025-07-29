// Metrics Service Unit Tests

import { MetricsService } from '../../src/services/metrics.service';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Mock dependencies are already mocked in jest.setup.ts

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let mockPool: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    metricsService = new MetricsService(mockPool);
    mockRedis = (metricsService as any).redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMetric', () => {
    it('should record a metric successfully', async () => {
      const metric = {
        userId: 'user-123',
        metricType: 'profile_view',
        value: 1,
        metadata: { profileId: 'profile-456' }
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.recordMetric(metric);

      expect(result.success).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metrics'),
        expect.arrayContaining([
          'user-123',
          'profile_view',
          1,
          expect.any(String) // JSON metadata
        ])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const metric = {
        userId: 'user-123',
        metricType: 'connection_made',
        value: 1
      };

      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      const result = await metricsService.recordMetric(metric);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to record metric');
    });

    it('should validate metric data', async () => {
      const invalidMetric = {
        userId: '',
        metricType: 'invalid_type',
        value: -1
      };

      const result = await metricsService.recordMetric(invalidMetric);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid metric data');
    });

    it('should cache recent metrics for performance', async () => {
      const metric = {
        userId: 'user-123',
        metricType: 'like_given',
        value: 1
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      await metricsService.recordMetric(metric);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('metrics:cache'),
        300, // 5 minutes
        expect.any(String)
      );
    });

    it('should batch metrics for efficiency', async () => {
      const metrics = [
        { userId: 'user-123', metricType: 'profile_view', value: 1 },
        { userId: 'user-123', metricType: 'connection_made', value: 1 },
        { userId: 'user-123', metricType: 'like_given', value: 1 }
      ];

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 3 }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.recordBatchMetrics(metrics);

      expect(result.success).toBe(true);
      expect(result.recorded).toBe(3);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metrics'),
        expect.any(Array)
      );
    });
  });

  describe('getMetrics', () => {
    it('should retrieve metrics for a user', async () => {
      const mockMetrics = [
        {
          timestamp: new Date('2024-01-01T12:00:00Z'),
          metric_type: 'profile_view',
          value: 5,
          metadata: { source: 'automation' }
        },
        {
          timestamp: new Date('2024-01-01T13:00:00Z'),
          metric_type: 'connection_made',
          value: 2,
          metadata: {}
        }
      ];

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: mockMetrics }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
        metricTypes: ['profile_view', 'connection_made']
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        timestamp: new Date('2024-01-01T12:00:00Z'),
        metricType: 'profile_view',
        value: 5,
        metadata: { source: 'automation' }
      });
    });

    it('should use cache when available', async () => {
      const cachedData = JSON.stringify([
        {
          timestamp: '2024-01-01T12:00:00Z',
          metricType: 'profile_view',
          value: 5
        }
      ]);

      mockRedis.get.mockResolvedValue(cachedData);

      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02')
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.fromCache).toBe(true);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02')
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should validate date ranges', async () => {
      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-02'),
        endDate: new Date('2024-01-01') // End before start
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid date range');
    });

    it('should limit query range for performance', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date(); // Today

      const result = await metricsService.getMetrics('user-123', {
        startDate,
        endDate
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Date range too large (max 90 days)');
    });
  });

  describe('getAggregatedMetrics', () => {
    it('should return aggregated metrics by day', async () => {
      const mockAggregatedData = [
        {
          date: '2024-01-01',
          profile_views: 25,
          connections_made: 5,
          likes_given: 10
        },
        {
          date: '2024-01-02',
          profile_views: 30,
          connections_made: 3,
          likes_given: 15
        }
      ];

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: mockAggregatedData }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getAggregatedMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03'),
        groupBy: 'day'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        period: '2024-01-01',
        metrics: {
          profile_views: 25,
          connections_made: 5,
          likes_given: 10
        }
      });
    });

    it('should return aggregated metrics by hour', async () => {
      const mockHourlyData = [
        {
          hour: '2024-01-01T12:00:00Z',
          profile_views: 5,
          connections_made: 1
        },
        {
          hour: '2024-01-01T13:00:00Z',
          profile_views: 8,
          connections_made: 2
        }
      ];

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: mockHourlyData }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getAggregatedMetrics('user-123', {
        startDate: new Date('2024-01-01T12:00:00Z'),
        endDate: new Date('2024-01-01T14:00:00Z'),
        groupBy: 'hour'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should calculate growth rates', async () => {
      const result = await metricsService.getGrowthMetrics('user-123', {
        metricType: 'profile_views',
        currentPeriod: {
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-22')
        },
        previousPeriod: {
          startDate: new Date('2024-01-08'),
          endDate: new Date('2024-01-15')
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        currentValue: expect.any(Number),
        previousValue: expect.any(Number),
        growthRate: expect.any(Number),
        growthDirection: expect.stringMatching(/^(up|down|stable)$/)
      }));
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return comprehensive dashboard metrics', async () => {
      // Mock various database queries for dashboard
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ total: 150 }] }) // Total profile views
          .mockResolvedValueOnce({ rows: [{ total: 25 }] })  // Total connections
          .mockResolvedValueOnce({ rows: [{ total: 75 }] })  // Total likes
          .mockResolvedValueOnce({ rows: [{ avg_score: 85.5 }] }) // Avg engagement score
          .mockResolvedValueOnce({ rows: mockTrendData }), // Trend data
        release: jest.fn()
      };

      const mockTrendData = [
        { date: '2024-01-01', value: 20 },
        { date: '2024-01-02', value: 22 },
        { date: '2024-01-03', value: 25 }
      ];

      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getDashboardMetrics('user-123', {
        period: 'last_30_days'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        overview: {
          profileViews: 150,
          connections: 25,
          likes: 75,
          engagementScore: 85.5
        },
        trends: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            value: expect.any(Number)
          })
        ]),
        period: 'last_30_days',
        lastUpdated: expect.any(Date)
      });
    });

    it('should handle different time periods', async () => {
      const periods = ['today', 'last_7_days', 'last_30_days', 'last_90_days'];

      for (const period of periods) {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [{ total: 10 }] }),
          release: jest.fn()
        };
        mockPool.connect.mockResolvedValue(mockClient as any);

        const result = await metricsService.getDashboardMetrics('user-123', { period });

        expect(result.success).toBe(true);
        expect(result.data.period).toBe(period);
      }
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should return real-time metrics from cache', async () => {
      const mockRealtimeData = {
        activeUsers: 15,
        currentConnections: 3,
        pendingLikes: 8,
        systemHealth: 'healthy'
      };

      mockRedis.hgetall.mockResolvedValue({
        active_users: '15',
        current_connections: '3',
        pending_likes: '8',
        system_health: 'healthy'
      });

      const result = await metricsService.getRealtimeMetrics('user-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRealtimeData);
    });

    it('should update real-time metrics cache', async () => {
      const metrics = {
        activeUsers: 20,
        currentConnections: 5,
        systemLoad: 75
      };

      await metricsService.updateRealtimeMetrics('user-123', metrics);

      expect(mockRedis.hmset).toHaveBeenCalledWith(
        'realtime:user-123',
        expect.objectContaining({
          active_users: '20',
          current_connections: '5',
          system_load: '75'
        })
      );
      expect(mockRedis.expire).toHaveBeenCalledWith('realtime:user-123', 300);
    });
  });

  describe('alerting and monitoring', () => {
    it('should trigger alerts for unusual metrics', async () => {
      const metric = {
        userId: 'user-123',
        metricType: 'failed_connections',
        value: 15 // Unusually high
      };

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const alertSpy = jest.fn();
      (metricsService as any).on('metricAlert', alertSpy);

      await metricsService.recordMetric(metric);

      expect(alertSpy).toHaveBeenCalledWith({
        userId: 'user-123',
        metricType: 'failed_connections',
        value: 15,
        threshold: 10,
        severity: 'high'
      });
    });

    it('should detect anomalies in metric patterns', async () => {
      const historicalData = [5, 6, 5, 7, 6, 5, 25]; // Last value is anomaly
      const isAnomaly = (metricsService as any).detectAnomaly(historicalData);

      expect(isAnomaly).toBe(true);
    });

    it('should calculate baseline metrics for comparison', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [
            { avg: 10.5, stddev: 2.3, min: 5, max: 18 }
          ]
        }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const baseline = await metricsService.getMetricBaseline('user-123', 'profile_views');

      expect(baseline).toEqual({
        average: 10.5,
        standardDeviation: 2.3,
        minimum: 5,
        maximum: 18
      });
    });
  });

  describe('performance optimization', () => {
    it('should use connection pooling efficiently', async () => {
      const metrics = Array.from({ length: 100 }, (_, i) => ({
        userId: 'user-123',
        metricType: 'test_metric',
        value: i
      }));

      await Promise.all(
        metrics.map(metric => metricsService.recordMetric(metric))
      );

      // Should reuse connections from pool
      expect(mockPool.connect).toHaveBeenCalledTimes(100);
    });

    it('should cache expensive queries', async () => {
      const cacheKey = 'metrics:user-123:2024-01-01:2024-01-02';
      const cachedResult = JSON.stringify({ data: 'cached' });

      mockRedis.get.mockResolvedValue(cachedResult);

      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02')
      });

      expect(result.fromCache).toBe(true);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should handle cache misses gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02')
      });

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(mockRedis.setex).toHaveBeenCalled(); // Should cache result
    });
  });

  describe('data retention and cleanup', () => {
    it('should clean up old metrics data', async () => {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 1500 }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.cleanupOldMetrics(cutoffDate);

      expect(result.deletedRows).toBe(1500);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM metrics'),
        expect.arrayContaining([cutoffDate])
      );
    });

    it('should archive metrics to cold storage', async () => {
      const archiveDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

      const result = await metricsService.archiveMetrics('user-123', archiveDate);

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBeGreaterThanOrEqual(0);
    });

    it('should compress historical data', async () => {
      const result = await metricsService.compressHistoricalData('user-123', {
        olderThan: 30,
        aggregateBy: 'day'
      });

      expect(result.success).toBe(true);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database connection failures', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await metricsService.recordMetric({
        userId: 'user-123',
        metricType: 'test',
        value: 1
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to record metric');
    });

    it('should handle Redis cache failures gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02')
      });

      expect(result.success).toBe(true); // Should fallback to database
    });

    it('should validate metric types', async () => {
      const invalidMetric = {
        userId: 'user-123',
        metricType: 'invalid_metric_type',
        value: 1
      };

      const result = await metricsService.recordMetric(invalidMetric);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid metric type');
    });

    it('should handle malformed data gracefully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [
            { metric_type: null, value: 'invalid' }, // Malformed data
            { metric_type: 'valid', value: 10 }       // Valid data
          ]
        }),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await metricsService.getMetrics('user-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02')
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // Should filter out malformed data
    });

    it('should handle concurrent metric recording', async () => {
      const metrics = Array.from({ length: 50 }, (_, i) => ({
        userId: 'user-123',
        metricType: 'concurrent_test',
        value: i
      }));

      const promises = metrics.map(metric => 
        metricsService.recordMetric(metric)
      );

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('metrics validation and sanitization', () => {
    it('should sanitize metric values', () => {
      const sanitized = (metricsService as any).sanitizeMetricValue('  test  ');
      expect(sanitized).toBe('test');
    });

    it('should validate numeric values', () => {
      const validNumbers = [0, 1, 100, 0.5, -1];
      const invalidNumbers = [NaN, Infinity, -Infinity, 'string'];

      validNumbers.forEach(num => {
        expect((metricsService as any).isValidNumericValue(num)).toBe(true);
      });

      invalidNumbers.forEach(num => {
        expect((metricsService as any).isValidNumericValue(num)).toBe(false);
      });
    });

    it('should enforce metric value limits', () => {
      const largeValue = 1e10; // Very large number
      const normalValue = 100;

      expect((metricsService as any).enforceValueLimits(normalValue)).toBe(100);
      expect((metricsService as any).enforceValueLimits(largeValue)).toBeLessThan(1e10);
    });
  });

  describe('cleanup and resource management', () => {
    it('should cleanup database connections', async () => {
      await metricsService.cleanup();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should cleanup Redis connections', async () => {
      await metricsService.cleanup();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockPool.end.mockRejectedValue(new Error('Cleanup failed'));

      await expect(metricsService.cleanup()).resolves.not.toThrow();
    });
  });
});