/**
 * Enhanced Analytics Chart with Predictive Features
 * Advanced charting component with ML predictions, real-time updates, and interactive features
 */

'use client';

import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef,
  Suspense,
  lazy
} from 'react';
import { cn } from '@/lib/utils';
import { useRealTimeMetrics } from './RealTimeMetricsProvider';
import { 
  EnhancedErrorBoundary,
  useErrorHandler 
} from '@/components/ui/enhanced-error-boundary';
import { 
  ContextualLoading,
  InlineLoading,
  ProgressLoading
} from '@/components/ui/loading-states';
import { 
  ChartSkeleton,
  Skeleton
} from '@/components/ui/enhanced-skeleton';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Import recharts components directly to avoid type issues
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';

// Icons
import { 
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart,
  Activity,
  Eye,
  Brain,
  Zap,
  Download,
  Settings,
  Maximize2,
  Minimize2,
  RefreshCw,
  Play,
  Pause,
  Calendar,
  Filter,
  Share,
  BookmarkPlus,
  Info,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Layers,
  MoreHorizontal
} from 'lucide-react';

// Types
import type { 
  BaseComponentProps,
  TimeRange,
  PerformanceMetrics
} from '@/types/common';
import type {
  ProfileAnalytics,
  ChartDataPoint,
  PredictiveAnalytics,
  MetricForecast,
  AnalyticsInsights
} from '@/types/analytics';

// ===== INTERFACES =====

interface ChartConfiguration {
  type: 'line' | 'area' | 'bar' | 'combo';
  showGrid: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  showPredictions: boolean;
  showBenchmarks: boolean;
  showAnnotations: boolean;
  animation: boolean;
  theme: 'light' | 'dark' | 'auto';
}

interface MetricConfig {
  key: string;
  label: string;
  color: string;
  visible: boolean;
  type: 'line' | 'area' | 'bar';
  yAxis: 'left' | 'right';
  format: (value: number) => string;
  prediction?: boolean;
}

interface EnhancedAnalyticsChartProps extends BaseComponentProps {
  timeRange?: TimeRange;
  selectedMetrics?: string[];
  showPredictive?: boolean;
  showAdvancedControls?: boolean;
  height?: number;
  compactView?: boolean;
  realTimeUpdates?: boolean;
  onMetricsChange?: (metrics: string[]) => void;
  onTimeRangeChange?: (range: TimeRange) => void;
  onConfigChange?: (config: Partial<ChartConfiguration>) => void;
}

// ===== CONSTANTS =====

const DEFAULT_METRICS: MetricConfig[] = [
  {
    key: 'profileViews',
    label: 'Profile Views',
    color: '#3B82F6',
    visible: true,
    type: 'line',
    yAxis: 'left',
    format: value => value.toLocaleString(),
    prediction: true,
  },
  {
    key: 'searchAppearances',
    label: 'Search Appearances',
    color: '#10B981',
    visible: false,
    type: 'line',
    yAxis: 'left',
    format: value => value.toLocaleString(),
    prediction: true,
  },
  {
    key: 'connections',
    label: 'Connections',
    color: '#8B5CF6',
    visible: true,
    type: 'area',
    yAxis: 'left',
    format: value => value.toLocaleString(),
    prediction: true,
  },
  {
    key: 'engagementRate',
    label: 'Engagement Rate',
    color: '#F59E0B',
    visible: true,
    type: 'line',
    yAxis: 'right',
    format: value => `${value.toFixed(1)}%`,
    prediction: true,
  },
  {
    key: 'completenessScore',
    label: 'Profile Score',
    color: '#EF4444',
    visible: false,
    type: 'line',
    yAxis: 'right',
    format: value => `${value.toFixed(0)}%`,
    prediction: false,
  },
];

const TIME_RANGES: { value: TimeRange; label: string; granularity: string }[] = [
  { value: '1h', label: 'Last Hour', granularity: 'minute' },
  { value: '6h', label: 'Last 6 Hours', granularity: 'minute' },
  { value: '24h', label: 'Last 24 Hours', granularity: 'hour' },
  { value: '7d', label: 'Last 7 Days', granularity: 'hour' },
  { value: '30d', label: 'Last 30 Days', granularity: 'day' },
  { value: '90d', label: 'Last 90 Days', granularity: 'day' },
  { value: '1y', label: 'Last Year', granularity: 'week' },
];

// ===== MAIN COMPONENT =====

export function EnhancedAnalyticsChart({
  className,
  timeRange = '7d',
  selectedMetrics = ['profileViews', 'connections', 'engagementRate'],
  showPredictive = false,
  showAdvancedControls = false,
  height = 400,
  compactView = false,
  realTimeUpdates = true,
  onMetricsChange,
  onTimeRangeChange,
  onConfigChange,
  'data-testid': testId = 'enhanced-analytics-chart'
}: EnhancedAnalyticsChartProps) {
  // ===== STATE MANAGEMENT =====
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [predictions, setPredictions] = useState<PredictiveAnalytics | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<Record<string, number>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTab, setCurrentTab] = useState<'chart' | 'predictions' | 'insights'>('chart');
  
  const [config, setConfig] = useState<ChartConfiguration>({
    type: 'line',
    showGrid: true,
    showLegend: true,
    showTooltip: true,
    showPredictions: showPredictive,
    showBenchmarks: false,
    showAnnotations: true,
    animation: true,
    theme: 'light',
  });

  const [metricsConfig, setMetricsConfig] = useState<MetricConfig[]>(
    DEFAULT_METRICS.map(metric => ({
      ...metric,
      visible: selectedMetrics.includes(metric.key)
    }))
  );

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Hooks
  const { metrics, isConnected: wsConnected } = useRealTimeMetrics();
  const { reportError } = useErrorHandler();

  // ===== COMPUTED VALUES =====
  const visibleMetrics = useMemo(() => 
    metricsConfig.filter(m => m.visible),
    [metricsConfig]
  );

  const currentTimeRangeConfig = useMemo(() => 
    TIME_RANGES.find(tr => tr.value === timeRange) || TIME_RANGES[3],
    [timeRange]
  );

  const chartData = useMemo(() => {
    if (!analytics?.chartData) return [];

    const dates = analytics.chartData.profileViews?.map(item => item.timestamp) || [];
    
    return dates.map((timestamp, index) => {
      const dataPoint: Record<string, unknown> = { 
        timestamp,
        date: new Date(timestamp).toLocaleDateString(),
        time: new Date(timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };
      
      visibleMetrics.forEach(metric => {
        const metricData = analytics.chartData[metric.key as keyof typeof analytics.chartData];
        if (Array.isArray(metricData)) {
          const point = metricData[index];
          let value = (point as any)?.value || 0;
          
          // Add live data for the most recent point if available
          if (realTimeUpdates && 
              index === dates.length - 1 && 
              liveData[metric.key]) {
            value = liveData[metric.key];
          }
          
          dataPoint[metric.key] = value;
          
          // Add prediction data if available
          if (config.showPredictions && predictions) {
            const forecast = predictions.forecasts.find(f => f.metric === metric.key);
            if (forecast && forecast.predictions[index]) {
              dataPoint[`${metric.key}_prediction`] = forecast.predictions[index].predicted_value;
              dataPoint[`${metric.key}_lower`] = forecast.predictions[index].lower_bound;
              dataPoint[`${metric.key}_upper`] = forecast.predictions[index].upper_bound;
            }
          }
        }
      });
      
      return dataPoint;
    });
  }, [analytics, visibleMetrics, liveData, config.showPredictions, predictions, realTimeUpdates]);

  // ===== EFFECTS =====

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('authToken');
        const endDate = new Date();
        const startDate = new Date();
        
        // Calculate start date based on time range
        switch (timeRange) {
          case '1h':
            startDate.setHours(endDate.getHours() - 1);
            break;
          case '6h':
            startDate.setHours(endDate.getHours() - 6);
            break;
          case '24h':
            startDate.setDate(endDate.getDate() - 1);
            break;
          case '7d':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(endDate.getDate() - 90);
            break;
          case '1y':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        }

        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          granularity: currentTimeRangeConfig.granularity,
          metrics: visibleMetrics.map(m => m.key).join(','),
          includePredictions: config.showPredictions.toString(),
        });

        const [analyticsResponse, insightsResponse] = await Promise.all([
          fetch(`/api/v1/analytics/profile?${params}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }),
          fetch(`/api/v1/analytics/insights?${params}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        ]);

        if (!analyticsResponse.ok) {
          throw new Error(`Analytics fetch failed: ${analyticsResponse.statusText}`);
        }

        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData.data);

        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json();
          setInsights(insightsData.data);
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
        setError(errorMessage);
        reportError(new Error(errorMessage), { 
          component: 'EnhancedAnalyticsChart',
          timeRange,
          selectedMetrics 
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange, visibleMetrics, config.showPredictions, currentTimeRangeConfig.granularity, reportError]);

  // Fetch predictions when enabled
  useEffect(() => {
    if (!config.showPredictions) {
      setPredictions(null);
      return;
    }

    const fetchPredictions = async () => {
      setPredictionsLoading(true);
      
      try {
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams({
          metrics: visibleMetrics.filter(m => m.prediction).map(m => m.key).join(','),
          horizon: timeRange === '7d' ? '7d' : '30d',
          confidence: '95',
        });

        const response = await fetch(`/api/v1/analytics/predictions?${params}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setPredictions(data.data);
        }
      } catch (err) {
        console.warn('Failed to load predictions:', err);
      } finally {
        setPredictionsLoading(false);
      }
    };

    fetchPredictions();
  }, [config.showPredictions, visibleMetrics, timeRange]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const initializeWebSocket = () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const wsUrl = `ws://localhost:3004/api/v1/ws/analytics?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('Analytics chart WebSocket connected');
          ws.send(JSON.stringify({
            type: 'subscribe',
            data: { 
              metrics: visibleMetrics.map(m => m.key),
              timeRange,
              chartData: true,
              frequency: 5000
            }
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'analytics_update' && message.data) {
              setLiveData(prev => ({
                ...prev,
                ...message.data
              }));
            }
          } catch (error) {
            console.error('Failed to parse analytics WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('Analytics chart WebSocket disconnected');
          // Attempt to reconnect after 5 seconds
          setTimeout(initializeWebSocket, 5000);
        };
        
        ws.onerror = (error) => {
          console.error('Analytics chart WebSocket error:', error);
        };
        
        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to initialize analytics WebSocket:', error);
      }
    };

    initializeWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [realTimeUpdates, visibleMetrics, timeRange]);

  // Update live data from real-time metrics
  useEffect(() => {
    if (metrics && realTimeUpdates) {
      setLiveData({
        profileViews: metrics.profileViews,
        connections: metrics.connections,
        completenessScore: metrics.completenessScore,
        engagementRate: metrics.engagementRate,
      });
    }
  }, [metrics, realTimeUpdates]);

  // ===== HANDLERS =====

  const handleMetricToggle = useCallback((metricKey: string) => {
    setMetricsConfig(prev => 
      prev.map(m => 
        m.key === metricKey ? { ...m, visible: !m.visible } : m
      )
    );
    
    const newSelectedMetrics = metricsConfig
      .map(m => m.key === metricKey ? { ...m, visible: !m.visible } : m)
      .filter(m => m.visible)
      .map(m => m.key);
    
    onMetricsChange?.(newSelectedMetrics);
  }, [metricsConfig, onMetricsChange]);

  const handleTimeRangeChange = useCallback((newTimeRange: TimeRange) => {
    onTimeRangeChange?.(newTimeRange);
  }, [onTimeRangeChange]);

  const handleConfigChange = useCallback((newConfig: Partial<ChartConfiguration>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    onConfigChange?.(newConfig);
  }, [onConfigChange]);

  const handleExport = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({
        timeRange,
        metrics: visibleMetrics.map(m => m.key).join(','),
        format: 'csv',
        includePredictions: config.showPredictions.toString(),
      });

      const response = await fetch(`/api/v1/analytics/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  }, [timeRange, visibleMetrics, config.showPredictions]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && chartRef.current) {
      chartRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // ===== RENDER HELPERS =====

  const renderHeader = () => (
    <CardHeader className="pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Trends
            {wsConnected && realTimeUpdates && (
              <Badge variant="secondary" className="text-xs">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
          </CardTitle>
          {!compactView && (
            <p className="text-sm text-muted-foreground mt-1">
              Track your LinkedIn performance with {config.showPredictions ? 'predictive' : 'historical'} insights
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <Select value={timeRange} onValueChange={(value) => handleTimeRangeChange(value as TimeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Controls Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant={config.showPredictions ? "default" : "outline"}
              size="sm"
              onClick={() => handleConfigChange({ showPredictions: !config.showPredictions })}
              disabled={!visibleMetrics.some(m => m.prediction)}
            >
              <Brain className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Toggles */}
      {!compactView && (
        <div className="flex flex-wrap gap-2 mt-4">
          {metricsConfig.map(metric => (
            <Button
              key={metric.key}
              variant={metric.visible ? "default" : "outline"}
              size="sm"
              onClick={() => handleMetricToggle(metric.key)}
              className="text-xs"
            >
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: metric.visible ? metric.color : 'transparent', 
                         border: `2px solid ${metric.color}` }}
              />
              {metric.label}
            </Button>
          ))}
        </div>
      )}

      {/* Predictions Loading */}
      {config.showPredictions && predictionsLoading && (
        <div className="mt-2">
          <ProgressLoading 
            progress={75} 
            message="Loading ML predictions..."
            size="sm"
            className="text-xs"
          />
        </div>
      )}
    </CardHeader>
  );

  const renderChart = () => {
    if (loading) {
      return <ChartSkeleton height={height} showLegend={config.showLegend} />;
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <Alert className="w-full max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      );
    }

    if (!chartData.length) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No data available for the selected time range</p>
            <p className="text-sm mt-2">Try selecting a different time range or metrics</p>
          </div>
        </div>
      );
    }

    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
            {config.type === 'area' ? (
              <AreaChart data={chartData}>
                {config.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                <XAxis 
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                {config.showTooltip && (
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                )}
                {config.showLegend && <Legend />}
                
                {visibleMetrics.map(metric => (
                  <Area
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    stroke={metric.color}
                    fill={metric.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    yAxisId={metric.yAxis}
                    animationDuration={config.animation ? 1500 : 0}
                  />
                ))}
                
                {/* Prediction lines */}
                {config.showPredictions && visibleMetrics.map(metric => 
                  metric.prediction && (
                    <Line
                      key={`${metric.key}_prediction`}
                      type="monotone"
                      dataKey={`${metric.key}_prediction`}
                      stroke={metric.color}
                      strokeDasharray="5 5"
                      strokeWidth={1}
                      dot={false}
                      yAxisId={metric.yAxis}
                    />
                  )
                )}
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                {config.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
                <XAxis 
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                {config.showTooltip && (
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                )}
                {config.showLegend && <Legend />}
                
                {visibleMetrics.map(metric => (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={{ fill: metric.color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: metric.color }}
                    yAxisId={metric.yAxis}
                    animationDuration={config.animation ? 1500 : 0}
                  />
                ))}
                
                {/* Prediction lines */}
                {config.showPredictions && visibleMetrics.map(metric => 
                  metric.prediction && (
                    <Line
                      key={`${metric.key}_prediction`}
                      type="monotone"
                      dataKey={`${metric.key}_prediction`}
                      stroke={metric.color}
                      strokeDasharray="5 5"
                      strokeWidth={1}
                      dot={false}
                      yAxisId={metric.yAxis}
                    />
                  )
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
    );
  };

  const renderPredictions = () => {
    if (!predictions) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Enable predictions to see AI-powered forecasts</p>
          <Button 
            className="mt-4" 
            onClick={() => handleConfigChange({ showPredictions: true })}
          >
            Enable Predictions
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {predictions.forecasts.map(forecast => (
          <Card key={forecast.metric}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{visibleMetrics.find(m => m.key === forecast.metric)?.label}</span>
                <Badge variant="secondary">
                  {Math.round(forecast.confidence_intervals[0]?.level || 95)}% confidence
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Predicted Growth</p>
                  <p className="font-medium text-lg">
                    {forecast.predictions[forecast.predictions.length - 1]?.predicted_value.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confidence Range</p>
                  <p className="font-medium">
                    {forecast.predictions[forecast.predictions.length - 1]?.lower_bound.toFixed(1)} - {' '}
                    {forecast.predictions[forecast.predictions.length - 1]?.upper_bound.toFixed(1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderInsights = () => {
    if (!insights) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No insights available for the current time range</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {insights.key.slice(0, 3).map(insight => (
          <Card key={insight.id}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                  insight.type === 'positive' && "bg-green-500",
                  insight.type === 'negative' && "bg-red-500",
                  insight.type === 'neutral' && "bg-blue-500",
                  insight.type === 'action_required' && "bg-orange-500"
                )} />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{insight.title}</h4>
                  <p className="text-muted-foreground text-xs mt-1">
                    {insight.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {insight.confidence}% confidence
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {insight.impact} impact
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // ===== MAIN RENDER =====

  return (
    <div 
      ref={chartRef}
      className={cn('w-full', className)}
      data-testid={testId}
    >
      <Card className="w-full">
        {renderHeader()}
        
        <CardContent className="pt-0">
          {showAdvancedControls ? (
            <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'chart' | 'predictions' | 'insights')}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="chart">
                  <LineChartIcon className="h-4 w-4 mr-2" />
                  Chart
                </TabsTrigger>
                <TabsTrigger value="predictions">
                  <Brain className="h-4 w-4 mr-2" />
                  Predictions
                </TabsTrigger>
                <TabsTrigger value="insights">
                  <Eye className="h-4 w-4 mr-2" />
                  Insights
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chart">
                {renderChart()}
              </TabsContent>
              
              <TabsContent value="predictions">
                {renderPredictions()}
              </TabsContent>
              
              <TabsContent value="insights">
                {renderInsights()}
              </TabsContent>
            </Tabs>
          ) : (
            renderChart()
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EnhancedAnalyticsChart;