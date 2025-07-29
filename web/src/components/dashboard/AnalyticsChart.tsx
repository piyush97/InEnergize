import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CalendarDays, TrendingUp, Wifi, WifiOff, Play, Pause, RefreshCw } from 'lucide-react';
import { useRealTimeMetrics } from './RealTimeMetricsProvider';
import { cn } from '@/lib/utils';

interface ChartDataPoint {
  date: string;
  value: number;
}

interface ProfileAnalytics {
  userId: string;
  timeRange: {
    start: string;
    end: string;
  };
  chartData: {
    profileViews: ChartDataPoint[];
    searchAppearances: ChartDataPoint[];
    connections: ChartDataPoint[];
    completeness: ChartDataPoint[];
    engagement: ChartDataPoint[];
  };
}

interface AnalyticsChartProps {
  className?: string;
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ className }) => {
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['profileViews', 'connections']);
  const [liveData, setLiveData] = useState<Record<string, number>>({});
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  // WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const { metrics } = useRealTimeMetrics();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const endDate = new Date();
      const startDate = new Date();
      
      // Calculate start date based on selected time range
      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        granularity: timeRange === '7d' ? 'hour' : timeRange === '30d' ? 'day' : 'week'
      });

      const response = await fetch(`/api/v1/metrics/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Initialize WebSocket for real-time chart updates
  const initializeWebSocket = useCallback(() => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const wsUrl = `ws://localhost:3004/api/v1/ws/metrics?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setWsConnected(true);
        console.log('Chart WebSocket connected');
        // Subscribe to real-time chart data
        ws.send(JSON.stringify({
          type: 'subscribe',
          data: { 
            metrics: selectedMetrics,
            chartData: true,
            frequency: 5000 // 5 second updates
          }
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'chart_update') {
            // Update live data for smooth chart animations
            setLiveData(prev => ({
              ...prev,
              ...message.data
            }));
            
            // Update analytics if in live mode
            if (isLiveMode && message.data.chartPoints) {
              setAnalytics(prev => prev ? {
                ...prev,
                chartData: {
                  ...prev.chartData,
                  ...message.data.chartPoints
                }
              } : null);
            }
          }
        } catch (error) {
          console.error('Failed to parse chart WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        setWsConnected(false);
        console.log('Chart WebSocket disconnected');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            initializeWebSocket();
          }
        }, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('Chart WebSocket error:', error);
        setWsConnected(false);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to initialize chart WebSocket:', error);
      setWsConnected(false);
    }
  }, [selectedMetrics, isLiveMode]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (isLiveMode) {
      initializeWebSocket();
    } else if (wsRef.current) {
      wsRef.current.close();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isLiveMode, initializeWebSocket]);

  // Update live data when real-time metrics change
  useEffect(() => {
    if (metrics && isLiveMode) {
      setLiveData({
        profileViews: metrics.profileViews,
        connections: metrics.connections,
        completenessScore: metrics.completenessScore,
        engagementRate: metrics.engagementRate
      });
    }
  }, [metrics, isLiveMode]);

  const formatChartData = () => {
    if (!analytics) return [];

    const dates = analytics.chartData.profileViews.map(item => item.date);
    
    return dates.map((date, index) => {
      const dataPoint: Record<string, string | number> = { 
        date: formatDate(date),
        timestamp: new Date(date).getTime()
      };
      
      if (selectedMetrics.includes('profileViews')) {
        const profileViewsData = analytics.chartData.profileViews.find(item => item.date === date);
        let value = profileViewsData?.value || 0;
        
        // Add live data for the most recent point if in live mode
        if (isLiveMode && index === dates.length - 1 && liveData.profileViews) {
          value = liveData.profileViews;
        }
        
        dataPoint.profileViews = value;
      }
      
      if (selectedMetrics.includes('searchAppearances')) {
        const searchData = analytics.chartData.searchAppearances.find(item => item.date === date);
        dataPoint.searchAppearances = searchData?.value || 0;
      }
      
      if (selectedMetrics.includes('connections')) {
        const connectionsData = analytics.chartData.connections.find(item => item.date === date);
        let value = connectionsData?.value || 0;
        
        // Add live data for the most recent point if in live mode
        if (isLiveMode && index === dates.length - 1 && liveData.connections) {
          value = liveData.connections;
        }
        
        dataPoint.connections = value;
      }
      
      if (selectedMetrics.includes('completeness')) {
        const completenessData = analytics.chartData.completeness.find(item => item.date === date);
        let value = completenessData?.value || 0;
        
        // Add live data for the most recent point if in live mode
        if (isLiveMode && index === dates.length - 1 && liveData.completenessScore) {
          value = liveData.completenessScore;
        }
        
        dataPoint.completeness = value;
      }
      
      if (selectedMetrics.includes('engagement')) {
        const engagementData = analytics.chartData.engagement.find(item => item.date === date);
        let value = engagementData?.value || 0;
        
        // Add live data for the most recent point if in live mode
        if (isLiveMode && index === dates.length - 1 && liveData.engagementRate) {
          value = liveData.engagementRate;
        }
        
        dataPoint.engagement = value;
      }
      
      return dataPoint;
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (timeRange === '7d') {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit'
      });
    }
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getMetricColor = (metric: string): string => {
    const colors = {
      profileViews: '#3B82F6',      // Blue
      searchAppearances: '#10B981', // Green
      connections: '#8B5CF6',       // Purple
      completeness: '#F59E0B',      // Orange
      engagement: '#EF4444'         // Red
    };
    return colors[metric as keyof typeof colors] || '#6B7280';
  };

  const getMetricLabel = (metric: string): string => {
    const labels = {
      profileViews: 'Profile Views',
      searchAppearances: 'Search Appearances',
      connections: 'Connections',
      completeness: 'Profile Score',
      engagement: 'Engagement Rate'
    };
    return labels[metric as keyof typeof labels] || metric;
  };

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        return prev.filter(m => m !== metric);
      } else {
        return [...prev, metric];
      }
    });
  };

  const toggleLiveMode = () => {
    setIsLiveMode(prev => !prev);
  };

  const chartData = formatChartData();

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Analytics Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-gray-100 rounded-lg animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Analytics Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">Failed to load analytics: {error}</p>
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Analytics Trends</span>
            {isLiveMode && (
              <Badge variant="secondary" className="ml-2">
                {wsConnected ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Live</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <span>Connecting...</span>
                  </div>
                )}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center space-x-4">
            {/* Live Mode Toggle */}
            <Button
              variant={isLiveMode ? "default" : "outline"}
              size="sm"
              onClick={toggleLiveMode}
              className="flex items-center space-x-1"
            >
              {isLiveMode ? (
                <>
                  <Pause className="h-3 w-3" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  <span>Static</span>
                </>
              )}
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3 w-3 mr-1', loading && 'animate-spin')} />
              Refresh
            </Button>

            {/* Connection Status */}
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              {wsConnected ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-gray-400" />
              )}
            </div>
            
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <CalendarDays className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Metric Selection */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {['profileViews', 'searchAppearances', 'connections', 'completeness', 'engagement'].map(metric => (
              <button
                key={metric}
                onClick={() => toggleMetric(metric)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedMetrics.includes(metric)
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: selectedMetrics.includes(metric) ? getMetricColor(metric) : undefined
                }}
              >
                {getMetricLabel(metric)}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="date" 
                stroke="#6B7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              
              {selectedMetrics.map(metric => (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={getMetricColor(metric)}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={getMetricLabel(metric)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        {chartData.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {selectedMetrics.map(metric => {
                const values = chartData.map(d => Number(d[metric]) || 0);
                const total = values.reduce((sum, val) => sum + val, 0);
                const average = values.length ? total / values.length : 0;
                const growth = values.length >= 2 ? 
                  ((values[values.length - 1] - values[0]) / values[0] * 100) : 0;
                
                return (
                  <div key={metric} className="space-y-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">
                      {getMetricLabel(metric)}
                    </div>
                    <div className="text-lg font-semibold">
                      {Math.round(average).toLocaleString()}
                    </div>
                    <div className={`text-xs ${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsChart;