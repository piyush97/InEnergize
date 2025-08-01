// Performance Dashboard Component - Real-time Performance Monitoring
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Clock, 
  Eye, 
  Zap, 
  Server,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Smartphone,
  Monitor,
  Wifi,
  Users,
  Database,
  Globe,
  Gauge,
  RefreshCw
} from 'lucide-react';

interface PerformanceMetrics {
  timestamp: number;
  frontend: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
  };
  backend: {
    apiResponseTime: number;
    throughput: number;
    errorRate: number;
    databaseLatency: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    cacheHitRatio: number;
  };
  realtime: {
    websocketLatency: number;
    activeUsers: number;
    automationHealth: number;
    safetyScore: number;
  };
}

interface PerformanceTrend {
  metric: string;
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  percentage: number;
}

interface PerformanceAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
}

const PerformanceDashboard: React.FC<{
  enabled?: boolean;
  refreshInterval?: number;
  apiEndpoint?: string;
  showDetails?: boolean;
  showMobile?: boolean;
}> = ({ 
  enabled = true,
  refreshInterval = 5000,
  apiEndpoint = '/api/v1/metrics/performance',
  showDetails = true,
  showMobile = true
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Performance thresholds
  const thresholds = {
    lcp: { good: 2500, needs_improvement: 4000 },
    fid: { good: 100, needs_improvement: 300 },
    cls: { good: 0.1, needs_improvement: 0.25 },
    fcp: { good: 1800, needs_improvement: 3000 },
    ttfb: { good: 800, needs_improvement: 1800 },
    apiResponseTime: { good: 200, needs_improvement: 500 },
    errorRate: { good: 0.1, needs_improvement: 1.0 },
    cpuUsage: { good: 50, needs_improvement: 80 },
    memoryUsage: { good: 60, needs_improvement: 85 },
    websocketLatency: { good: 50, needs_improvement: 150 },
    safetyScore: { good: 90, needs_improvement: 70 }
  };

  const fetchPerformanceData = useCallback(async () => {
    if (!enabled || !apiEndpoint) return;
    
    try {
      setIsRefreshing(true);
      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update metrics
      if (metrics) {
        setTrends(calculateTrends(metrics, data));
      }
      setMetrics(data);
      
      // Check for alerts
      const newAlerts = checkForAlerts(data);
      setAlerts(prev => [...newAlerts, ...prev.slice(0, 9)]); // Keep last 10 alerts
      
      setLastUpdated(new Date());
      setIsLoading(false);
      
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      
      // Add error alert
      setAlerts(prev => [{
        id: `error-${Date.now()}`,
        type: 'critical',
        message: `Failed to fetch performance data: ${error.message}`,
        timestamp: Date.now(),
        metric: 'system',
        value: 0,
        threshold: 0
      }, ...prev.slice(0, 9)]);
    } finally {
      setIsRefreshing(false);
    }
  }, [enabled, apiEndpoint, metrics]);

  useEffect(() => {
    if (!enabled) return;
    
    // Initial fetch
    fetchPerformanceData();
    
    // Set up interval
    const interval = setInterval(fetchPerformanceData, refreshInterval);
    
    return () => clearInterval(interval);
  }, [enabled, fetchPerformanceData, refreshInterval]);

  const calculateTrends = (previous: PerformanceMetrics, current: PerformanceMetrics): PerformanceTrend[] => {
    const trends: PerformanceTrend[] = [];
    
    const compareMetrics = [
      { key: 'lcp', prev: previous.frontend.lcp, curr: current.frontend.lcp, name: 'LCP' },
      { key: 'apiResponseTime', prev: previous.backend.apiResponseTime, curr: current.backend.apiResponseTime, name: 'API Response' },
      { key: 'throughput', prev: previous.backend.throughput, curr: current.backend.throughput, name: 'Throughput' },
      { key: 'cpuUsage', prev: previous.system.cpuUsage, curr: current.system.cpuUsage, name: 'CPU Usage' },
      { key: 'activeUsers', prev: previous.realtime.activeUsers, curr: current.realtime.activeUsers, name: 'Active Users' }
    ];
    
    compareMetrics.forEach(({ key, prev, curr, name }) => {
      if (prev > 0) {
        const percentage = ((curr - prev) / prev) * 100;
        let trend: 'up' | 'down' | 'stable';
        
        if (Math.abs(percentage) < 5) {
          trend = 'stable';
        } else if (percentage > 0) {
          trend = key === 'throughput' || key === 'activeUsers' ? 'up' : 'down'; // Higher is better for some metrics
        } else {
          trend = key === 'throughput' || key === 'activeUsers' ? 'down' : 'up';
        }
        
        trends.push({
          metric: name,
          current: curr,
          previous: prev,
          trend,
          percentage: Math.abs(percentage)
        });
      }
    });
    
    return trends;
  };

  const checkForAlerts = (data: PerformanceMetrics): PerformanceAlert[] => {
    const alerts: PerformanceAlert[] = [];
    const timestamp = Date.now();
    
    // Check LCP
    if (data.frontend.lcp > thresholds.lcp.needs_improvement) {
      alerts.push({
        id: `lcp-${timestamp}`,
        type: 'critical',
        message: `LCP exceeds critical threshold (${data.frontend.lcp}ms > ${thresholds.lcp.needs_improvement}ms)`,
        timestamp,
        metric: 'lcp',
        value: data.frontend.lcp,
        threshold: thresholds.lcp.needs_improvement
      });
    }
    
    // Check API response time
    if (data.backend.apiResponseTime > thresholds.apiResponseTime.needs_improvement) {
      alerts.push({
        id: `api-${timestamp}`,
        type: 'critical',
        message: `API response time critical (${data.backend.apiResponseTime}ms > ${thresholds.apiResponseTime.needs_improvement}ms)`,
        timestamp,
        metric: 'apiResponseTime',
        value: data.backend.apiResponseTime,
        threshold: thresholds.apiResponseTime.needs_improvement
      });
    }
    
    // Check error rate
    if (data.backend.errorRate > thresholds.errorRate.needs_improvement) {
      alerts.push({
        id: `error-${timestamp}`,
        type: 'critical',
        message: `High error rate detected (${data.backend.errorRate}% > ${thresholds.errorRate.needs_improvement}%)`,
        timestamp,
        metric: 'errorRate',
        value: data.backend.errorRate,
        threshold: thresholds.errorRate.needs_improvement
      });
    }
    
    // Check system resources
    if (data.system.cpuUsage > thresholds.cpuUsage.needs_improvement) {
      alerts.push({
        id: `cpu-${timestamp}`,
        type: 'warning',
        message: `High CPU usage (${data.system.cpuUsage}% > ${thresholds.cpuUsage.needs_improvement}%)`,
        timestamp,
        metric: 'cpuUsage',
        value: data.system.cpuUsage,
        threshold: thresholds.cpuUsage.needs_improvement
      });
    }
    
    // Check automation safety score
    if (data.realtime.safetyScore < thresholds.safetyScore.needs_improvement) {
      alerts.push({
        id: `safety-${timestamp}`,
        type: 'warning',
        message: `Automation safety score low (${data.realtime.safetyScore} < ${thresholds.safetyScore.needs_improvement})`,
        timestamp,
        metric: 'safetyScore',
        value: data.realtime.safetyScore,
        threshold: thresholds.safetyScore.needs_improvement
      });
    }
    
    return alerts;
  };

  const getMetricStatus = (value: number, metric: keyof typeof thresholds): 'good' | 'needs-improvement' | 'poor' => {
    const threshold = thresholds[metric];
    if (!threshold) return 'good';
    
    // For metrics where lower is better
    if (['lcp', 'fid', 'cls', 'fcp', 'ttfb', 'apiResponseTime', 'errorRate', 'cpuUsage', 'memoryUsage', 'websocketLatency'].includes(metric)) {
      if (value <= threshold.good) return 'good';
      if (value <= threshold.needs_improvement) return 'needs-improvement';
      return 'poor';
    }
    
    // For metrics where higher is better
    if (value >= threshold.good) return 'good';
    if (value >= threshold.needs_improvement) return 'needs-improvement';
    return 'poor';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatValue = (value: number, unit: string = '') => {
    if (unit === 'ms' || unit === 'bytes') {
      return value >= 1000 ? `${(value / 1000).toFixed(1)}${unit === 'ms' ? 's' : 'KB'}` : `${Math.round(value)}${unit}`;
    }
    if (unit === '%') {
      return `${value.toFixed(1)}${unit}`;
    }
    return `${Math.round(value)}${unit}`;
  };

  if (!enabled) return null;

  if (isLoading && !metrics) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="h-5 w-5 animate-spin" />
            <span>Loading Performance Dashboard...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span>Performance Dashboard Unavailable</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Unable to load performance metrics. Check your connection and try again.</p>
          <Button onClick={fetchPerformanceData} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Gauge className="h-5 w-5" />
              <span>Performance Dashboard</span>
            </div>
            <div className="flex items-center space-x-2">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchPerformanceData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Active Alerts ({alerts.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {alerts.slice(0, 5).map((alert) => (
                <div 
                  key={alert.id} 
                  className={`flex items-center space-x-2 p-2 rounded-lg border ${
                    alert.type === 'critical' ? 'bg-red-50 border-red-200' :
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  {getAlertIcon(alert.type)}
                  <span className="flex-1 text-sm">{alert.message}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle>Core Web Vitals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className={`p-4 rounded-lg border ${getStatusColor(getMetricStatus(metrics.frontend.lcp, 'lcp'))}`}>
              <div className="flex items-center space-x-2 mb-2">
                <Eye className="h-4 w-4" />
                <span className="font-medium text-sm">LCP</span>
              </div>
              <div className="text-2xl font-bold">{formatValue(metrics.frontend.lcp, 'ms')}</div>
              <div className="text-xs text-gray-600">Largest Contentful Paint</div>
            </div>

            <div className={`p-4 rounded-lg border ${getStatusColor(getMetricStatus(metrics.frontend.fid, 'fid'))}`}>
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="h-4 w-4" />
                <span className="font-medium text-sm">FID</span>
              </div>
              <div className="text-2xl font-bold">{formatValue(metrics.frontend.fid, 'ms')}</div>
              <div className="text-xs text-gray-600">First Input Delay</div>
            </div>

            <div className={`p-4 rounded-lg border ${getStatusColor(getMetricStatus(metrics.frontend.cls, 'cls'))}`}>
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="h-4 w-4" />
                <span className="font-medium text-sm">CLS</span>
              </div>
              <div className="text-2xl font-bold">{metrics.frontend.cls.toFixed(3)}</div>
              <div className="text-xs text-gray-600">Cumulative Layout Shift</div>
            </div>

            <div className={`p-4 rounded-lg border ${getStatusColor(getMetricStatus(metrics.frontend.fcp, 'fcp'))}`}>
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium text-sm">FCP</span>
              </div>
              <div className="text-2xl font-bold">{formatValue(metrics.frontend.fcp, 'ms')}</div>
              <div className="text-xs text-gray-600">First Contentful Paint</div>
            </div>

            <div className={`p-4 rounded-lg border ${getStatusColor(getMetricStatus(metrics.frontend.ttfb, 'ttfb'))}`}>
              <div className="flex items-center space-x-2 mb-2">
                <Server className="h-4 w-4" />
                <span className="font-medium text-sm">TTFB</span>
              </div>
              <div className="text-2xl font-bold">{formatValue(metrics.frontend.ttfb, 'ms')}</div>
              <div className="text-xs text-gray-600">Time to First Byte</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Backend Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Response Time</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">{formatValue(metrics.backend.apiResponseTime, 'ms')}</span>
                <Badge variant={getMetricStatus(metrics.backend.apiResponseTime, 'apiResponseTime') === 'good' ? 'default' : 'destructive'}>
                  {getMetricStatus(metrics.backend.apiResponseTime, 'apiResponseTime')}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Throughput</span>
              <span className="text-lg font-bold">{formatValue(metrics.backend.throughput)} req/s</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Error Rate</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">{formatValue(metrics.backend.errorRate, '%')}</span>
                <Badge variant={getMetricStatus(metrics.backend.errorRate, 'errorRate') === 'good' ? 'default' : 'destructive'}>
                  {getMetricStatus(metrics.backend.errorRate, 'errorRate')}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Database Latency</span>
              <span className="text-lg font-bold">{formatValue(metrics.backend.databaseLatency, 'ms')}</span>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>System Resources</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">CPU Usage</span>
                <span className="text-lg font-bold">{formatValue(metrics.system.cpuUsage, '%')}</span>
              </div>
              <Progress value={metrics.system.cpuUsage} className="h-2" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Memory Usage</span>
                <span className="text-lg font-bold">{formatValue(metrics.system.memoryUsage, '%')}</span>
              </div>
              <Progress value={metrics.system.memoryUsage} className="h-2" />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Connections</span>
              <span className="text-lg font-bold">{formatValue(metrics.system.activeConnections)}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Hit Ratio</span>
              <span className="text-lg font-bold">{formatValue(metrics.system.cacheHitRatio, '%')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time & Automation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real-time Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Wifi className="h-5 w-5" />
              <span>Real-time Metrics</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WebSocket Latency</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">{formatValue(metrics.realtime.websocketLatency, 'ms')}</span>
                <Badge variant={getMetricStatus(metrics.realtime.websocketLatency, 'websocketLatency') === 'good' ? 'default' : 'destructive'}>
                  {getMetricStatus(metrics.realtime.websocketLatency, 'websocketLatency')}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Users</span>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span className="text-lg font-bold">{formatValue(metrics.realtime.activeUsers)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Automation Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Gauge className="h-5 w-5" />
              <span>Automation Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Automation Health</span>
                <span className="text-lg font-bold">{formatValue(metrics.realtime.automationHealth, '%')}</span>
              </div>
              <Progress value={metrics.realtime.automationHealth} className="h-2" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Safety Score</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold">{formatValue(metrics.realtime.safetyScore)}/100</span>
                  <Badge variant={getMetricStatus(metrics.realtime.safetyScore, 'safetyScore') === 'good' ? 'default' : 'destructive'}>
                    {getMetricStatus(metrics.realtime.safetyScore, 'safetyScore')}
                  </Badge>
                </div>
              </div>
              <Progress value={metrics.realtime.safetyScore} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends */}
      {showDetails && trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.slice(0, 6).map((trend, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trend.trend)}
                    <span className="text-sm font-medium">{trend.metric}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatValue(trend.current)}</div>
                    <div className={`text-xs ${
                      trend.trend === 'up' ? 'text-green-600' : 
                      trend.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {trend.trend === 'stable' ? 'stable' : `${trend.percentage.toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PerformanceDashboard;
