/**
 * Performance Profiler Utility
 * 
 * Comprehensive performance monitoring and profiling utility for InErgize testing
 * Tracks latency, throughput, resource usage, and system metrics
 */

export class PerformanceProfiler {
  private metrics: Map<string, MetricData[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private isRunning: boolean = false;

  /**
   * Start timing a specific operation
   */
  startTiming(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  /**
   * End timing and record the duration
   */
  endTiming(operationId: string): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      throw new Error(`No start time found for operation: ${operationId}`);
    }

    const duration = Date.now() - startTime;
    this.recordMetric('latency', operationId, duration);
    this.startTimes.delete(operationId);
    
    return duration;
  }

  /**
   * Record a custom metric
   */
  recordMetric(metricType: string, identifier: string, value: number, metadata?: any): void {
    const key = `${metricType}:${identifier}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push({
      timestamp: Date.now(),
      value,
      metadata
    });
  }

  /**
   * Measure the execution time of an async function
   */
  async measureAsync<T>(
    operationId: string, 
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    this.startTiming(operationId);
    
    try {
      const result = await operation();
      const duration = this.endTiming(operationId);
      
      return { result, duration };
    } catch (error) {
      this.endTiming(operationId);
      throw error;
    }
  }

  /**
   * Measure the execution time of a synchronous function
   */
  measureSync<T>(
    operationId: string, 
    operation: () => T
  ): { result: T; duration: number } {
    const startTime = Date.now();
    
    try {
      const result = operation();
      const duration = Date.now() - startTime;
      
      this.recordMetric('latency', operationId, duration);
      
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('latency', operationId, duration, { error: true });
      throw error;
    }
  }

  /**
   * Start continuous system monitoring
   */
  startSystemMonitoring(interval: number = 1000): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    const monitor = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(monitor);
        return;
      }

      // Record system memory usage
      const memoryUsage = process.memoryUsage();
      this.recordMetric('system', 'heapUsed', memoryUsage.heapUsed / 1024 / 1024); // MB
      this.recordMetric('system', 'heapTotal', memoryUsage.heapTotal / 1024 / 1024); // MB
      this.recordMetric('system', 'external', memoryUsage.external / 1024 / 1024); // MB
      this.recordMetric('system', 'rss', memoryUsage.rss / 1024 / 1024); // MB

      // Record CPU usage (approximation)
      const cpuUsage = process.cpuUsage();
      this.recordMetric('system', 'cpuUser', cpuUsage.user);
      this.recordMetric('system', 'cpuSystem', cpuUsage.system);

      // Record process uptime
      this.recordMetric('system', 'uptime', process.uptime());
    }, interval);
  }

  /**
   * Stop system monitoring
   */
  stopSystemMonitoring(): void {
    this.isRunning = false;
  }

  /**
   * Get performance statistics for a specific metric
   */
  getStatistics(metricType: string, identifier?: string): PerformanceStatistics {
    const pattern = identifier ? `${metricType}:${identifier}` : metricType;
    const matchingKeys = Array.from(this.metrics.keys()).filter(key => 
      identifier ? key === pattern : key.startsWith(`${metricType}:`)
    );

    if (matchingKeys.length === 0) {
      throw new Error(`No metrics found for pattern: ${pattern}`);
    }

    const allValues: number[] = [];
    let totalCount = 0;
    let earliestTimestamp = Infinity;
    let latestTimestamp = 0;

    for (const key of matchingKeys) {
      const data = this.metrics.get(key)!;
      const values = data.map(d => d.value);
      
      allValues.push(...values);
      totalCount += data.length;
      
      const timestamps = data.map(d => d.timestamp);
      earliestTimestamp = Math.min(earliestTimestamp, ...timestamps);
      latestTimestamp = Math.max(latestTimestamp, ...timestamps);
    }

    const sorted = allValues.sort((a, b) => a - b);
    const sum = allValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / allValues.length;
    
    // Calculate variance and standard deviation
    const variance = allValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / allValues.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      count: totalCount,
      sum,
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      min: Math.min(...allValues),
      max: Math.max(...allValues),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      standardDeviation,
      variance,
      coefficientOfVariation: standardDeviation / mean,
      duration: latestTimestamp - earliestTimestamp,
      throughput: totalCount / ((latestTimestamp - earliestTimestamp) / 1000)
    };
  }

  /**
   * Get all recorded metrics grouped by type
   */
  getAllMetrics(): { [metricType: string]: PerformanceStatistics } {
    const result: { [metricType: string]: PerformanceStatistics } = {};
    const metricTypes = new Set<string>();

    // Extract unique metric types
    for (const key of this.metrics.keys()) {
      const [metricType] = key.split(':');
      metricTypes.add(metricType);
    }

    // Calculate statistics for each metric type
    for (const metricType of metricTypes) {
      try {
        result[metricType] = this.getStatistics(metricType);
      } catch (error) {
        console.warn(`Failed to calculate statistics for ${metricType}:`, error.message);
      }
    }

    return result;
  }

  /**
   * Generate a comprehensive performance report
   */
  generateReport(): PerformanceReport {
    const allMetrics = this.getAllMetrics();
    const systemMetrics = this.getSystemMetrics();
    
    return {
      timestamp: Date.now(),
      summary: {
        totalMetrics: this.metrics.size,
        metricTypes: Object.keys(allMetrics).length,
        testDuration: this.getTestDuration(),
        overallThroughput: this.calculateOverallThroughput()
      },
      metrics: allMetrics,
      system: systemMetrics,
      insights: this.generateInsights(allMetrics, systemMetrics)
    };
  }

  /**
   * Reset all recorded metrics
   */
  reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
    this.stopSystemMonitoring();
  }

  /**
   * Export metrics to JSON format
   */
  export(): string {
    const data = {
      timestamp: Date.now(),
      metrics: Object.fromEntries(
        Array.from(this.metrics.entries()).map(([key, values]) => [
          key,
          values.map(v => ({
            timestamp: v.timestamp,
            value: v.value,
            metadata: v.metadata
          }))
        ])
      )
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import metrics from JSON format
   */
  import(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      
      this.reset();
      
      for (const [key, values] of Object.entries(data.metrics)) {
        this.metrics.set(key, values as MetricData[]);
      }
    } catch (error) {
      throw new Error(`Failed to import metrics: ${error.message}`);
    }
  }

  // Private helper methods
  private getSystemMetrics(): SystemMetrics {
    try {
      const heapStats = this.getStatistics('system', 'heapUsed');
      const cpuStats = this.getStatistics('system', 'cpuUser');
      
      return {
        memory: {
          avgHeapUsed: heapStats.mean,
          maxHeapUsed: heapStats.max,
          minHeapUsed: heapStats.min
        },
        cpu: {
          avgUsage: cpuStats.mean,
          maxUsage: cpuStats.max
        },
        uptime: process.uptime()
      };
    } catch (error) {
      return {
        memory: { avgHeapUsed: 0, maxHeapUsed: 0, minHeapUsed: 0 },
        cpu: { avgUsage: 0, maxUsage: 0 },
        uptime: process.uptime()
      };
    }
  }

  private getTestDuration(): number {
    let earliestTimestamp = Infinity;
    let latestTimestamp = 0;

    for (const data of this.metrics.values()) {
      for (const point of data) {
        earliestTimestamp = Math.min(earliestTimestamp, point.timestamp);
        latestTimestamp = Math.max(latestTimestamp, point.timestamp);
      }
    }

    return latestTimestamp - earliestTimestamp;
  }

  private calculateOverallThroughput(): number {
    const duration = this.getTestDuration();
    const totalOperations = Array.from(this.metrics.values())
      .reduce((sum, data) => sum + data.length, 0);

    return duration > 0 ? totalOperations / (duration / 1000) : 0;
  }

  private generateInsights(
    metrics: { [metricType: string]: PerformanceStatistics },
    systemMetrics: SystemMetrics
  ): PerformanceInsights {
    const insights: PerformanceInsights = {
      performance: [],
      warnings: [],
      recommendations: []
    };

    // Analyze latency metrics
    if (metrics.latency) {
      const latency = metrics.latency;
      
      if (latency.mean > 200) {
        insights.warnings.push('Average latency exceeds 200ms target');
        insights.recommendations.push('Consider optimizing slow operations or adding caching');
      }
      
      if (latency.p95 > 500) {
        insights.warnings.push('95th percentile latency exceeds 500ms');
        insights.recommendations.push('Investigate and optimize worst-case scenarios');
      }
      
      if (latency.coefficientOfVariation > 0.5) {
        insights.warnings.push('High latency variance detected');
        insights.recommendations.push('Improve consistency in operation performance');
      } else {
        insights.performance.push('Consistent performance with low variance');
      }
    }

    // Analyze throughput
    if (metrics.throughput) {
      const throughput = metrics.throughput;
      
      if (throughput.mean > 100) {
        insights.performance.push('High throughput achieved (>100 ops/sec)');
      } else {
        insights.warnings.push('Throughput below target (100 ops/sec)');
        insights.recommendations.push('Consider scaling resources or optimizing operations');
      }
    }

    // Analyze system resources
    if (systemMetrics.memory.maxHeapUsed > 512) {
      insights.warnings.push('High memory usage detected (>512MB)');
      insights.recommendations.push('Monitor for memory leaks and consider memory optimization');
    }

    return insights;
  }
}

// Type definitions
interface MetricData {
  timestamp: number;
  value: number;
  metadata?: any;
}

export interface PerformanceStatistics {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  standardDeviation: number;
  variance: number;
  coefficientOfVariation: number;
  duration: number;
  throughput: number;
}

interface SystemMetrics {
  memory: {
    avgHeapUsed: number;
    maxHeapUsed: number;
    minHeapUsed: number;
  };
  cpu: {
    avgUsage: number;
    maxUsage: number;
  };
  uptime: number;
}

interface PerformanceInsights {
  performance: string[];
  warnings: string[];
  recommendations: string[];
}

interface PerformanceReport {
  timestamp: number;
  summary: {
    totalMetrics: number;
    metricTypes: number;
    testDuration: number;
    overallThroughput: number;
  };
  metrics: { [metricType: string]: PerformanceStatistics };
  system: SystemMetrics;
  insights: PerformanceInsights;
}