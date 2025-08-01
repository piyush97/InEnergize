/**
 * Memory Monitor Utility
 * 
 * Advanced memory usage monitoring and analysis for performance testing
 * Tracks heap usage, garbage collection, memory leaks, and resource optimization
 */

import { EventEmitter } from 'events';

export class MemoryMonitor extends EventEmitter {
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private snapshots: MemorySnapshot[] = [];
  private startTime: number = 0;
  private gcStats: GarbageCollectionStats = {
    collections: 0,
    totalTime: 0,
    avgTime: 0,
    lastCollection: 0
  };

  /**
   * Start monitoring memory usage
   */
  startMonitoring(interval: number = 1000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.startTime = Date.now();
    this.snapshots = [];

    // Initial snapshot
    this.takeSnapshot();

    // Setup monitoring interval
    this.monitoringInterval = setInterval(() => {
      if (this.isMonitoring) {
        this.takeSnapshot();
      }
    }, interval);

    // Monitor garbage collection if available
    this.setupGCMonitoring();

    this.emit('monitoringStarted', { startTime: this.startTime, interval });
  }

  /**
   * Stop monitoring memory usage
   */
  stopMonitoring(): MemoryReport {
    if (!this.isMonitoring) {
      throw new Error('Memory monitoring is not active');
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    // Take final snapshot
    this.takeSnapshot();

    const endTime = Date.now();
    const report = this.generateReport(endTime - this.startTime);

    this.emit('monitoringStopped', { endTime, duration: endTime - this.startTime });

    return report;
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): void {
    const memoryUsage = process.memoryUsage();
    const timestamp = Date.now();

    const snapshot: MemorySnapshot = {
      timestamp,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
      
      // Convert to MB for easier analysis
      heapUsedMB: memoryUsage.heapUsed / 1024 / 1024,
      heapTotalMB: memoryUsage.heapTotal / 1024 / 1024,
      externalMB: memoryUsage.external / 1024 / 1024,
      rssMB: memoryUsage.rss / 1024 / 1024,
      arrayBuffersMB: (memoryUsage.arrayBuffers || 0) / 1024 / 1024,
      
      // Calculate heap utilization
      heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      
      // Calculate growth since last snapshot
      growthSinceStart: 0,
      growthSinceLast: 0
    };

    // Calculate growth metrics
    if (this.snapshots.length > 0) {
      const lastSnapshot = this.snapshots[this.snapshots.length - 1];
      const firstSnapshot = this.snapshots[0];
      
      snapshot.growthSinceStart = snapshot.heapUsedMB - firstSnapshot.heapUsedMB;
      snapshot.growthSinceLast = snapshot.heapUsedMB - lastSnapshot.heapUsedMB;
    }

    this.snapshots.push(snapshot);

    // Emit snapshot event
    this.emit('memorySnapshot', snapshot);

    // Check for memory warnings
    this.checkMemoryWarnings(snapshot);
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGCMonitoring(): void {
    // Check if GC monitoring is available
    if (typeof global.gc === 'function' || process.env.NODE_ENV === 'test') {
      // Mock GC monitoring for testing environments
      const mockGCMonitoring = setInterval(() => {
        if (!this.isMonitoring) {
          clearInterval(mockGCMonitoring);
          return;
        }

        // Simulate GC events
        if (Math.random() < 0.1) { // 10% chance of GC event per interval
          const gcTime = Math.random() * 50 + 5; // 5-55ms GC time
          this.recordGCEvent(gcTime);
        }
      }, 5000); // Check every 5 seconds
    }

    // Setup performance observer for GC events (Node.js 12+)
    try {
      const { PerformanceObserver } = require('perf_hooks');
      
      const gcObserver = new PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.recordGCEvent(entry.duration);
          }
        }
      });

      gcObserver.observe({ entryTypes: ['gc'] });
      
      // Clean up observer when monitoring stops
      this.once('monitoringStopped', () => {
        gcObserver.disconnect();
      });
      
    } catch (error) {
      // Performance observer not available, continue without GC monitoring
      console.warn('GC monitoring not available:', error.message);
    }
  }

  /**
   * Record garbage collection event
   */
  private recordGCEvent(duration: number): void {
    this.gcStats.collections++;
    this.gcStats.totalTime += duration;
    this.gcStats.avgTime = this.gcStats.totalTime / this.gcStats.collections;
    this.gcStats.lastCollection = Date.now();

    this.emit('gcEvent', {
      duration,
      totalCollections: this.gcStats.collections,
      avgTime: this.gcStats.avgTime
    });
  }

  /**
   * Check for memory warnings
   */
  private checkMemoryWarnings(snapshot: MemorySnapshot): void {
    const warnings: MemoryWarning[] = [];

    // High memory usage warning
    if (snapshot.heapUsedMB > 512) {
      warnings.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'warning',
        message: `High heap usage: ${snapshot.heapUsedMB.toFixed(1)} MB`,
        value: snapshot.heapUsedMB,
        threshold: 512
      });
    }

    // Critical memory usage warning
    if (snapshot.heapUsedMB > 1024) {
      warnings.push({
        type: 'CRITICAL_MEMORY_USAGE',
        severity: 'critical',
        message: `Critical heap usage: ${snapshot.heapUsedMB.toFixed(1)} MB`,
        value: snapshot.heapUsedMB,
        threshold: 1024
      });
    }

    // Memory leak detection
    if (this.snapshots.length > 10) {
      const recentGrowth = this.calculateRecentGrowthRate();
      if (recentGrowth > 5) { // More than 5MB growth per minute
        warnings.push({
          type: 'POTENTIAL_MEMORY_LEAK',
          severity: 'warning',
          message: `Rapid memory growth detected: ${recentGrowth.toFixed(1)} MB/min`,
          value: recentGrowth,
          threshold: 5
        });
      }
    }

    // High heap utilization warning
    if (snapshot.heapUtilization > 0.9) {
      warnings.push({
        type: 'HIGH_HEAP_UTILIZATION',
        severity: 'warning',
        message: `High heap utilization: ${(snapshot.heapUtilization * 100).toFixed(1)}%`,
        value: snapshot.heapUtilization * 100,
        threshold: 90
      });
    }

    // Emit warnings
    for (const warning of warnings) {
      this.emit('memoryWarning', warning);
    }
  }

  /**
   * Calculate recent memory growth rate (MB per minute)
   */
  private calculateRecentGrowthRate(): number {
    if (this.snapshots.length < 2) {
      return 0;
    }

    const recentSnapshots = this.snapshots.slice(-10); // Last 10 snapshots
    const firstRecent = recentSnapshots[0];
    const lastRecent = recentSnapshots[recentSnapshots.length - 1];

    const timeDiff = (lastRecent.timestamp - firstRecent.timestamp) / 1000 / 60; // minutes
    const memoryDiff = lastRecent.heapUsedMB - firstRecent.heapUsedMB; // MB

    return timeDiff > 0 ? memoryDiff / timeDiff : 0;
  }

  /**
   * Generate comprehensive memory report
   */
  private generateReport(duration: number): MemoryReport {
    if (this.snapshots.length === 0) {
      throw new Error('No memory snapshots available');
    }

    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    
    const heapUsages = this.snapshots.map(s => s.heapUsedMB);
    const heapUtilizations = this.snapshots.map(s => s.heapUtilization);

    // Calculate statistics
    const stats: MemoryStatistics = {
      initial: firstSnapshot.heapUsedMB,
      final: lastSnapshot.heapUsedMB,
      peak: Math.max(...heapUsages),
      minimum: Math.min(...heapUsages),
      average: heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length,
      totalGrowth: lastSnapshot.heapUsedMB - firstSnapshot.heapUsedMB,
      growthRate: (lastSnapshot.heapUsedMB - firstSnapshot.heapUsedMB) / (duration / 1000 / 60), // MB per minute
      
      peakUtilization: Math.max(...heapUtilizations),
      avgUtilization: heapUtilizations.reduce((sum, util) => sum + util, 0) / heapUtilizations.length,
      
      snapshots: this.snapshots.length,
      duration: duration
    };

    // Analyze memory patterns
    const analysis = this.analyzeMemoryPatterns();

    return {
      timestamp: Date.now(),
      duration,
      statistics: stats,
      gcStats: this.gcStats,
      analysis,
      snapshots: this.snapshots,
      recommendations: this.generateRecommendations(stats, analysis)
    };
  }

  /**
   * Analyze memory usage patterns
   */
  private analyzeMemoryPatterns(): MemoryAnalysis {
    const analysis: MemoryAnalysis = {
      trend: 'stable',
      volatility: 'low',
      leakSuspicion: 'none',
      efficiency: 'good',
      patterns: []
    };

    if (this.snapshots.length < 3) {
      return analysis;
    }

    const heapUsages = this.snapshots.map(s => s.heapUsedMB);
    const growthRates = this.snapshots.slice(1).map((snapshot, index) => 
      snapshot.heapUsedMB - this.snapshots[index].heapUsedMB
    );

    // Analyze trend
    const totalGrowth = heapUsages[heapUsages.length - 1] - heapUsages[0];
    const avgGrowthRate = totalGrowth / (this.snapshots.length - 1);

    if (avgGrowthRate > 2) {
      analysis.trend = 'increasing';
    } else if (avgGrowthRate < -2) {
      analysis.trend = 'decreasing';
    } else {
      analysis.trend = 'stable';
    }

    // Analyze volatility
    const variance = growthRates.reduce((sum, rate) => sum + Math.pow(rate - avgGrowthRate, 2), 0) / growthRates.length;
    const standardDeviation = Math.sqrt(variance);

    if (standardDeviation > 10) {
      analysis.volatility = 'high';
    } else if (standardDeviation > 5) {
      analysis.volatility = 'medium';
    } else {
      analysis.volatility = 'low';
    }

    // Memory leak detection
    const recentGrowthRate = this.calculateRecentGrowthRate();
    if (recentGrowthRate > 10) {
      analysis.leakSuspicion = 'high';
    } else if (recentGrowthRate > 5) {
      analysis.leakSuspicion = 'medium';
    } else if (recentGrowthRate > 2) {
      analysis.leakSuspicion = 'low';
    } else {
      analysis.leakSuspicion = 'none';
    }

    // Efficiency analysis
    const avgUtilization = this.snapshots.reduce((sum, s) => sum + s.heapUtilization, 0) / this.snapshots.length;
    
    if (avgUtilization > 0.8) {
      analysis.efficiency = 'poor';
    } else if (avgUtilization > 0.6) {
      analysis.efficiency = 'fair';
    } else {
      analysis.efficiency = 'good';
    }

    // Pattern detection
    analysis.patterns = this.detectMemoryPatterns();

    return analysis;
  }

  /**
   * Detect specific memory patterns
   */
  private detectMemoryPatterns(): string[] {
    const patterns: string[] = [];
    
    if (this.snapshots.length < 5) {
      return patterns;
    }

    const heapUsages = this.snapshots.map(s => s.heapUsedMB);
    
    // Detect sawtooth pattern (typical of GC)
    let sawtoothCount = 0;
    for (let i = 2; i < heapUsages.length; i++) {
      if (heapUsages[i] < heapUsages[i-1] && heapUsages[i-1] > heapUsages[i-2]) {
        sawtoothCount++;
      }
    }
    
    if (sawtoothCount > heapUsages.length * 0.2) {
      patterns.push('sawtooth');
    }

    // Detect linear growth (potential leak)
    const correlationCoeff = this.calculateCorrelation(
      heapUsages.map((_, i) => i), 
      heapUsages
    );
    
    if (correlationCoeff > 0.8) {
      patterns.push('linear_growth');
    }

    // Detect step increases
    let stepIncreases = 0;
    for (let i = 1; i < heapUsages.length; i++) {
      const increase = heapUsages[i] - heapUsages[i-1];
      if (increase > 20) { // 20MB sudden increase
        stepIncreases++;
      }
    }
    
    if (stepIncreases > 0) {
      patterns.push('step_increases');
    }

    return patterns;
  }

  /**
   * Calculate correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    return (n * sumXY - sumX * sumY) / 
           Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  }

  /**
   * Generate memory optimization recommendations
   */
  private generateRecommendations(stats: MemoryStatistics, analysis: MemoryAnalysis): string[] {
    const recommendations: string[] = [];

    // High memory usage
    if (stats.peak > 512) {
      recommendations.push('Consider implementing memory optimization strategies');
      recommendations.push('Monitor for memory leaks and unnecessary object retention');
    }

    // Memory leak suspicion
    if (analysis.leakSuspicion === 'high') {
      recommendations.push('Investigate potential memory leaks immediately');
      recommendations.push('Review object lifecycle management and cleanup procedures');
    } else if (analysis.leakSuspicion === 'medium') {
      recommendations.push('Monitor memory growth trends closely');
    }

    // High volatility
    if (analysis.volatility === 'high') {
      recommendations.push('Investigate causes of memory usage spikes');
      recommendations.push('Consider more frequent garbage collection or memory pooling');
    }

    // Poor efficiency
    if (analysis.efficiency === 'poor') {
      recommendations.push('Optimize heap utilization and garbage collection');
      recommendations.push('Consider increasing heap size or optimizing memory allocation');
    }

    // Pattern-specific recommendations
    if (analysis.patterns.includes('linear_growth')) {
      recommendations.push('Linear memory growth detected - investigate for memory leaks');
    }

    if (analysis.patterns.includes('step_increases')) {
      recommendations.push('Large memory allocations detected - consider object pooling');
    }

    // GC recommendations
    if (this.gcStats.avgTime > 50) {
      recommendations.push('High garbage collection times - consider heap optimization');
    }

    return recommendations;
  }

  /**
   * Get current memory report
   */
  getReport(): MemoryReport {
    if (!this.isMonitoring) {
      throw new Error('Memory monitoring is not active');
    }

    const currentTime = Date.now();
    const duration = currentTime - this.startTime;
    
    return this.generateReport(duration);
  }

  /**
   * Reset monitoring data
   */
  reset(): void {
    this.stopMonitoring();
    this.snapshots = [];
    this.gcStats = {
      collections: 0,
      totalTime: 0,
      avgTime: 0,
      lastCollection: 0
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGC(): boolean {
    if (typeof global.gc === 'function') {
      global.gc();
      return true;
    }
    return false;
  }
}

// Type definitions
interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
  arrayBuffersMB: number;
  
  heapUtilization: number;
  growthSinceStart: number;
  growthSinceLast: number;
}

interface GarbageCollectionStats {
  collections: number;
  totalTime: number;
  avgTime: number;
  lastCollection: number;
}

interface MemoryWarning {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

interface MemoryStatistics {
  initial: number;
  final: number;
  peak: number;
  minimum: number;
  average: number;
  totalGrowth: number;
  growthRate: number; // MB per minute
  
  peakUtilization: number;
  avgUtilization: number;
  
  snapshots: number;
  duration: number;
}

interface MemoryAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: 'low' | 'medium' | 'high';
  leakSuspicion: 'none' | 'low' | 'medium' | 'high';
  efficiency: 'good' | 'fair' | 'poor';
  patterns: string[];
}

export interface MemoryReport {
  timestamp: number;
  duration: number;
  statistics: MemoryStatistics;
  gcStats: GarbageCollectionStats;
  analysis: MemoryAnalysis;
  snapshots: MemorySnapshot[];
  recommendations: string[];
}