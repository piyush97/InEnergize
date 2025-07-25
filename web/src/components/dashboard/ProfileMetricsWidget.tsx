import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Eye, Search, Users, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricSnapshot {
  profileViews: number;
  searchAppearances: number;
  connections: number;
  completenessScore: number;
  engagementRate: number;
}

interface MetricTrends {
  profileViewsTrend: number;
  searchAppearancesTrend: number;
  connectionsTrend: number;
  completenessTrend: number;
  engagementTrend: number;
}

interface DashboardMetrics {
  userId: string;
  snapshot: MetricSnapshot;
  trends: MetricTrends;
  goals: {
    profileViewsGoal?: number;
    connectionsGoal?: number;
    completenessGoal?: number;
    engagementGoal?: number;
  };
  lastUpdated: string;
}

interface ProfileMetricsWidgetProps {
  className?: string;
}

const ProfileMetricsWidget: React.FC<ProfileMetricsWidgetProps> = ({ className }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/v1/metrics/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTrend = (trend: number): string => {
    const abs = Math.abs(trend);
    return `${trend > 0 ? '+' : trend < 0 ? '-' : ''}${abs.toFixed(1)}%`;
  };

  const MetricCard: React.FC<{
    title: string;
    value: number;
    trend: number;
    icon: React.ReactNode;
    goal?: number;
    suffix?: string;
  }> = ({ title, value, trend, icon, goal, suffix = '' }) => {
    const progressPercentage = goal ? Math.min((value / goal) * 100, 100) : 0;
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {icon}
            <span className="text-sm font-medium text-gray-600">{title}</span>
          </div>
          <div className="flex items-center space-x-1">
            {getTrendIcon(trend)}
            <span className={cn('text-xs font-medium', getTrendColor(trend))}>
              {formatTrend(trend)}
            </span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-gray-900">
              {formatNumber(value)}
            </span>
            {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
          </div>
          
          {goal && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Progress to goal</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    progressPercentage >= 100 ? 'bg-green-500' : 
                    progressPercentage >= 75 ? 'bg-blue-500' :
                    progressPercentage >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
                  )}
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                Goal: {formatNumber(goal)}{suffix}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Profile Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-8 bg-gray-300 rounded mb-2"></div>
                <div className="h-2 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Profile Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">Failed to load metrics: {error}</p>
            <button
              onClick={fetchMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Profile Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600">No metrics data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Profile Metrics</CardTitle>
          <div className="text-xs text-gray-500">
            Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Profile Views"
            value={metrics.snapshot.profileViews}
            trend={metrics.trends.profileViewsTrend}
            icon={<Eye className="h-4 w-4 text-blue-500" />}
            goal={metrics.goals.profileViewsGoal}
          />
          
          <MetricCard
            title="Search Appearances"
            value={metrics.snapshot.searchAppearances}
            trend={metrics.trends.searchAppearancesTrend}
            icon={<Search className="h-4 w-4 text-green-500" />}
          />
          
          <MetricCard
            title="Connections"
            value={metrics.snapshot.connections}
            trend={metrics.trends.connectionsTrend}
            icon={<Users className="h-4 w-4 text-purple-500" />}
            goal={metrics.goals.connectionsGoal}
          />
          
          <MetricCard
            title="Profile Score"
            value={metrics.snapshot.completenessScore}
            trend={metrics.trends.completenessTrend}
            icon={<CheckCircle className="h-4 w-4 text-orange-500" />}
            goal={metrics.goals.completenessGoal}
            suffix="%"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileMetricsWidget;