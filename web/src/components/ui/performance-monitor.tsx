// Performance Monitor Component - Core Web Vitals Tracking
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Clock, 
  Eye, 
  Zap, 
  Server,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  threshold: { good: number; poor: number };
  unit: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PerformanceMetrics {
  lcp: WebVitalMetric | null;
  fid: WebVitalMetric | null;
  cls: WebVitalMetric | null;
  fcp: WebVitalMetric | null;
  ttfb: WebVitalMetric | null;
  loadTime: number;
  domContentLoaded: number;
  resourcesLoaded: number;
}

const PerformanceMonitor: React.FC<{ 
  enabled?: boolean; 
  reportEndpoint?: string;
  showDetails?: boolean;
}> = ({ 
  enabled = process.env.NODE_ENV === 'development', 
  reportEndpoint = '/api/v1/metrics/web-vitals',
  showDetails = false 
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    loadTime: 0,
    domContentLoaded: 0,
    resourcesLoaded: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const createMetric = useCallback((
    name: string,
    value: number,
    thresholds: { good: number; poor: number },
    unit: string,
    description: string,
    icon: React.ComponentType<{ className?: string }>
  ): WebVitalMetric => ({
    name,
    value,
    rating: value <= thresholds.good ? 'good' : value <= thresholds.poor ? 'needs-improvement' : 'poor',
    threshold: thresholds,
    unit,
    description,
    icon,
  }), []);

  const reportMetric = useCallback(async (metric: any) => {
    if (!reportEndpoint || !enabled) return;
    
    try {
      await fetch(reportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.warn('Failed to report web vital:', error);
    }
  }, [reportEndpoint, enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Collect Core Web Vitals
    getLCP((metric) => {
      const lcpMetric = createMetric(
        'LCP',
        metric.value,
        { good: 2500, poor: 4000 },
        'ms',
        'Largest Contentful Paint - measures loading performance',
        Eye
      );
      setMetrics(prev => ({ ...prev, lcp: lcpMetric }));
      reportMetric(metric);
    });

    getFID((metric) => {
      const fidMetric = createMetric(
        'FID',
        metric.value,
        { good: 100, poor: 300 },
        'ms',
        'First Input Delay - measures interactivity',
        Zap
      );
      setMetrics(prev => ({ ...prev, fid: fidMetric }));
      reportMetric(metric);
    });

    getCLS((metric) => {
      const clsMetric = createMetric(
        'CLS',
        metric.value,
        { good: 0.1, poor: 0.25 },
        '',
        'Cumulative Layout Shift - measures visual stability',
        Activity
      );
      setMetrics(prev => ({ ...prev, cls: clsMetric }));
      reportMetric(metric);
    });

    getFCP((metric) => {
      const fcpMetric = createMetric(
        'FCP',
        metric.value,
        { good: 1800, poor: 3000 },
        'ms',
        'First Contentful Paint - measures loading',
        Clock
      );
      setMetrics(prev => ({ ...prev, fcp: fcpMetric }));
      reportMetric(metric);
    });

    getTTFB((metric) => {
      const ttfbMetric = createMetric(
        'TTFB',
        metric.value,
        { good: 800, poor: 1800 },
        'ms',
        'Time to First Byte - measures server response',
        Server
      );
      setMetrics(prev => ({ ...prev, ttfb: ttfbMetric }));
      reportMetric(metric);
    });

    // Additional performance metrics
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      setMetrics(prev => ({
        ...prev,
        loadTime: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
        domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
        resourcesLoaded: performance.getEntriesByType('resource').length,
      }));
    }

    setIsLoading(false);
  }, [enabled, createMetric, reportMetric]);

  const getMetricColor = (rating: WebVitalMetric['rating']) => {
    switch (rating) {
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'needs-improvement':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getOverallScore = () => {
    const vitals = [metrics.lcp, metrics.fid, metrics.cls, metrics.fcp, metrics.ttfb].filter(Boolean);
    if (vitals.length === 0) return 0;
    
    const scores = vitals.map(vital => {
      switch (vital!.rating) {
        case 'good': return 100;
        case 'needs-improvement': return 60;
        case 'poor': return 20;
        default: return 0;
      }
    });
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  };

  if (!enabled) return null;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 animate-spin" />
            <span>Performance Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallScore = getOverallScore();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Performance Monitor</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant="outline" 
              className={overallScore >= 80 ? getMetricColor('good') : 
                        overallScore >= 60 ? getMetricColor('needs-improvement') : 
                        getMetricColor('poor')}
            >
              Score: {overallScore}/100
            </Badge>
            {overallScore >= 80 ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Core Web Vitals */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Core Web Vitals</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[metrics.lcp, metrics.fid, metrics.cls].map((metric, index) => (
              metric && (
                <div key={metric.name} className={`p-3 rounded-lg border ${getMetricColor(metric.rating)}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <metric.icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{metric.name}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-lg font-bold">
                      {metric.name === 'CLS' ? metric.value.toFixed(3) : Math.round(metric.value)}
                      <span className="text-xs font-normal ml-1">{metric.unit}</span>
                    </div>
                    <Progress 
                      value={Math.min(100, (metric.value / metric.threshold.poor) * 100)}
                      className="h-2"
                    />
                    {showDetails && (
                      <p className="text-xs text-gray-600">{metric.description}</p>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Additional Metrics */}
        {showDetails && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Additional Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.fcp && (
                <div className="text-center">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                  <div className="text-sm font-medium">FCP</div>
                  <div className="text-xs text-gray-600">{Math.round(metrics.fcp.value)}ms</div>
                </div>
              )}
              {metrics.ttfb && (
                <div className="text-center">
                  <Server className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                  <div className="text-sm font-medium">TTFB</div>
                  <div className="text-xs text-gray-600">{Math.round(metrics.ttfb.value)}ms</div>
                </div>
              )}
              <div className="text-center">
                <Activity className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                <div className="text-sm font-medium">DOM Ready</div>
                <div className="text-xs text-gray-600">{Math.round(metrics.domContentLoaded)}ms</div>
              </div>
              <div className="text-center">
                <Eye className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                <div className="text-sm font-medium">Resources</div>
                <div className="text-xs text-gray-600">{metrics.resourcesLoaded}</div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tips */}
        {overallScore < 80 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Performance Tips</span>
            </div>
            <ul className="text-xs text-yellow-700 space-y-1">
              {metrics.lcp && metrics.lcp.rating !== 'good' && (
                <li>• Optimize images and critical resources for faster LCP</li>
              )}
              {metrics.fid && metrics.fid.rating !== 'good' && (
                <li>• Reduce JavaScript bundle size and optimize event handlers</li>
              )}
              {metrics.cls && metrics.cls.rating !== 'good' && (
                <li>• Set explicit dimensions for images and avoid layout shifts</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceMonitor;