// Performance optimization utilities and Core Web Vitals monitoring
'use client';

import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

// Performance observer for runtime metrics
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, Metric> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  initialize(reportEndpoint?: string) {
    // Core Web Vitals
    getLCP(this.handleMetric.bind(this, reportEndpoint));
    getFID(this.handleMetric.bind(this, reportEndpoint));
    getCLS(this.handleMetric.bind(this, reportEndpoint));
    getFCP(this.handleMetric.bind(this, reportEndpoint));
    getTTFB(this.handleMetric.bind(this, reportEndpoint));

    // Custom performance observers
    this.observeResourceLoading();
    this.observeLongTasks();
    this.observeLayoutShifts();
  }

  private handleMetric(reportEndpoint: string | undefined, metric: Metric) {
    this.metrics.set(metric.name, metric);
    
    // Report to analytics in production
    if (reportEndpoint && typeof window !== 'undefined') {
      this.reportMetric(reportEndpoint, metric);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${metric.name}:`, {
        value: metric.value,
        rating: this.getRating(metric.name, metric.value),
        id: metric.id,
        entries: metric.entries,
      });
    }
  }

  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds: Record<string, { good: number; poor: number }> = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 },
    };

    const threshold = thresholds[name];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private async reportMetric(endpoint: string, metric: Metric) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          connection: this.getConnectionInfo(),
        }),
        keepalive: true,
      });
    } catch (error) {
      console.warn('Failed to report performance metric:', error);
    }
  }

  private observeResourceLoading() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resourceEntry = entry as PerformanceResourceTiming;
          
          // Track slow resources (>1s)
          if (resourceEntry.duration > 1000) {
            console.warn(`[Performance] Slow resource: ${resourceEntry.name} (${resourceEntry.duration}ms)`);
          }
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });
    this.observers.set('resource', observer);
  }

  private observeLongTasks() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'longtask') {
          console.warn(`[Performance] Long task detected: ${entry.duration}ms`, entry);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
      this.observers.set('longtask', observer);
    } catch (e) {
      // Long task API not supported
    }
  }

  private observeLayoutShifts() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      let cumulativeScore = 0;
      
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          cumulativeScore += (entry as any).value;
        }
      }

      if (cumulativeScore > 0.1) {
        console.warn(`[Performance] Layout shift detected: ${cumulativeScore}`);
      }
    });

    try {
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('layout-shift', observer);
    } catch (e) {
      // Layout shift API not supported
    }
  }

  private getConnectionInfo() {
    if (!('navigator' in window) || !('connection' in navigator)) {
      return null;
    }

    const conn = (navigator as any).connection;
    return {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData,
    };
  }

  getMetrics() {
    return Array.from(this.metrics.values());
  }

  getMetric(name: string) {
    return this.metrics.get(name);
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.metrics.clear();
  }
}

// Bundle analysis utilities
export const bundleAnalyzer = {
  trackChunkLoad: (chunkName: string, startTime = performance.now()) => {
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    console.log(`[Bundle] Chunk "${chunkName}" loaded in ${loadTime.toFixed(2)}ms`);
    
    if (loadTime > 1000) {
      console.warn(`[Bundle] Slow chunk load: ${chunkName} (${loadTime.toFixed(2)}ms)`);
    }
  },

  measureComponentRender: (componentName: string, renderFn: () => void) => {
    const startTime = performance.now();
    renderFn();
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    if (renderTime > 16) { // >16ms indicates potential frame drop
      console.warn(`[Render] Slow component render: ${componentName} (${renderTime.toFixed(2)}ms)`);
    }
    
    return renderTime;
  },
};

// Memory monitoring
export const memoryMonitor = {
  track: () => {
    if (!('memory' in performance)) return null;
    
    const memory = (performance as any).memory;
    const memoryInfo = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
    
    if (memoryInfo.usage > 80) {
      console.warn('[Memory] High memory usage detected:', memoryInfo);
    }
    
    return memoryInfo;
  },

  startMonitoring: (interval = 30000) => {
    const monitor = () => {
      const info = memoryMonitor.track();
      if (info && info.usage > 90) {
        console.error('[Memory] Critical memory usage:', info);
        // Trigger garbage collection if available
        if ('gc' in window) {
          (window as any).gc();
        }
      }
    };
    
    return setInterval(monitor, interval);
  },
};

// Image loading optimization
export const imageOptimizer = {
  loadWithIntersectionObserver: (img: HTMLImageElement, threshold = 0.1) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLImageElement;
            if (target.dataset.src) {
              target.src = target.dataset.src;
              target.removeAttribute('data-src');
            }
            observer.unobserve(target);
          }
        });
      },
      { threshold }
    );

    observer.observe(img);
    return () => observer.unobserve(img);
  },

  preloadCriticalImages: (urls: string[]) => {
    urls.forEach((url) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  },
};

// Initialize performance monitoring
export const initializePerformanceMonitoring = (reportEndpoint?: string) => {
  if (typeof window === 'undefined') return;

  const performanceMonitor = PerformanceMonitor.getInstance();
  performanceMonitor.initialize(reportEndpoint);

  // Start memory monitoring in development
  if (process.env.NODE_ENV === 'development') {
    memoryMonitor.startMonitoring();
  }

  return performanceMonitor;
};