import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CalendarDays, TrendingUp } from 'lucide-react';

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

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
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
        granularity: timeRange === '7d' ? 'day' : timeRange === '30d' ? 'day' : 'week'
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
  };

  const formatChartData = () => {
    if (!analytics) return [];

    const dates = analytics.chartData.profileViews.map(item => item.date);
    
    return dates.map(date => {
      const dataPoint: any = { date: formatDate(date) };
      
      if (selectedMetrics.includes('profileViews')) {
        const profileViewsData = analytics.chartData.profileViews.find(item => item.date === date);
        dataPoint.profileViews = profileViewsData?.value || 0;
      }
      
      if (selectedMetrics.includes('searchAppearances')) {
        const searchData = analytics.chartData.searchAppearances.find(item => item.date === date);
        dataPoint.searchAppearances = searchData?.value || 0;
      }
      
      if (selectedMetrics.includes('connections')) {
        const connectionsData = analytics.chartData.connections.find(item => item.date === date);
        dataPoint.connections = connectionsData?.value || 0;
      }
      
      if (selectedMetrics.includes('completeness')) {
        const completenessData = analytics.chartData.completeness.find(item => item.date === date);
        dataPoint.completeness = completenessData?.value || 0;
      }
      
      if (selectedMetrics.includes('engagement')) {
        const engagementData = analytics.chartData.engagement.find(item => item.date === date);
        dataPoint.engagement = engagementData?.value || 0;
      }
      
      return dataPoint;
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
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
          </CardTitle>
          
          <div className="flex items-center space-x-4">
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
                const values = chartData.map(d => d[metric] || 0);
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