// OptimizedRealTimeDashboard.tsx - High-performance real-time dashboard
import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useOptimizedWebSocket } from '@/hooks/useOptimizedWebSocket';
import { OptimizedButton } from '@/design-system/components/OptimizedButton';
import {
  Activity,
  Users,
  Heart,
  Eye,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';

// Performance-optimized metric display
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  isLoading?: boolean;
}

const MetricCard = memo<MetricCardProps>(
  ({ title, value, change, trend, icon: Icon, color = 'blue', isLoading }) => {
    const colorClasses = {
      blue: 'text-blue-600 bg-blue-50 border-blue-200',
      green: 'text-green-600 bg-green-50 border-green-200',
      yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      red: 'text-red-600 bg-red-50 border-red-200',
      purple: 'text-purple-600 bg-purple-50 border-purple-200',
    };

    const trendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : '';

    return (
      <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{title}</p>
                <div className="flex items-center space-x-2">
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-gray-400">Loading...</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-gray-900">{value}</span>
                      {change !== undefined && trendIcon && (
                        <div className={`flex items-center space-x-1 ${trendColor}`}>
                          {React.createElement(trendIcon, { className: 'h-4 w-4' })}
                          <span className="text-sm font-medium">{Math.abs(change)}%</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

MetricCard.displayName = 'MetricCard';

// Real-time activity feed
interface ActivityItem {
  id: string;
  type: 'connection' | 'engagement' | 'profile_view' | 'automation';
  message: string;
  timestamp: Date;
  status?: 'success' | 'warning' | 'error';
}

const ActivityFeed = memo<{ activities: ActivityItem[]; isLoading: boolean }>(
  ({ activities, isLoading }) => {
    const getActivityIcon = (type: ActivityItem['type']) => {
      switch (type) {
        case 'connection':
          return Users;
        case 'engagement':
          return Heart;
        case 'profile_view':
          return Eye;
        case 'automation':
          return Zap;
        default:
          return Activity;
      }
    };

    const getStatusColor = (status?: ActivityItem['status']) => {
      switch (status) {
        case 'success':
          return 'text-green-500';
        case 'warning':
          return 'text-yellow-500';
        case 'error':
          return 'text-red-500';
        default:
          return 'text-gray-500';
      }
    };

    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          return (
            <div key={activity.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-md transition-colors">
              <div className={`p-1 rounded-full ${getStatusColor(activity.status)}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 line-clamp-2">{activity.message}</p>
                <p className="text-xs text-gray-500">
                  {activity.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        )}
      </div>
    );
  }
);

ActivityFeed.displayName = 'ActivityFeed';

// Safety monitor widget
interface SafetyStatus {
  overallScore: number;
  status: 'healthy' | 'warning' | 'critical' | 'suspended';
  dailyLimits: {
    connections: { used: number; limit: number };
    likes: { used: number; limit: number };
    comments: { used: number; limit: number };
    views: { used: number; limit: number };
  };
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

const SafetyMonitor = memo<{ status: SafetyStatus; isLoading: boolean }>(
  ({ status, isLoading }) => {
    const getStatusColor = (statusValue: SafetyStatus['status']) => {
      switch (statusValue) {
        case 'healthy':
          return 'text-green-500 bg-green-50 border-green-200';
        case 'warning':
          return 'text-yellow-500 bg-yellow-50 border-yellow-200';
        case 'critical':
          return 'text-red-500 bg-red-50 border-red-200';
        case 'suspended':
          return 'text-red-600 bg-red-100 border-red-300';
        default:
          return 'text-gray-500 bg-gray-50 border-gray-200';
      }
    };

    const getStatusIcon = (statusValue: SafetyStatus['status']) => {
      switch (statusValue) {
        case 'healthy':
          return CheckCircle;
        case 'warning':
          return AlertTriangle;
        case 'critical':
        case 'suspended':
          return AlertTriangle;
        default:
          return Activity;
      }
    };

    if (isLoading) {
      return (
        <div className="space-y-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      );
    }

    const StatusIcon = getStatusIcon(status.status);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-5 w-5 ${getStatusColor(status.status).split(' ')[0]}`} />
            <span className="font-medium capitalize">{status.status}</span>
          </div>
          <Badge variant="outline" className={getStatusColor(status.status)}>
            Score: {status.overallScore}/100
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Daily Usage</div>
          {Object.entries(status.dailyLimits).map(([key, data]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{key}</span>
                <span>
                  {data.used}/{data.limit}
                </span>
              </div>
              <Progress
                value={(data.used / data.limit) * 100}
                className="h-2"
                style={{
                  '--progress-background': data.used / data.limit > 0.8 ? '#ef4444' : 
                                          data.used / data.limit > 0.6 ? '#f59e0b' : '#22c55e'
                } as React.CSSProperties}
              />
            </div>
          ))}
        </div>

        {status.alerts.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm font-medium mb-2">Active Alerts</div>
            <div className="space-y-2">
              {status.alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-start space-x-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 line-clamp-2">{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

SafetyMonitor.displayName = 'SafetyMonitor';

// Main dashboard component
export interface OptimizedRealTimeDashboardProps {
  userId: string;
}

export const OptimizedRealTimeDashboard = memo<OptimizedRealTimeDashboardProps>(
  ({ userId }) => {
    const [metrics, setMetrics] = useState({
      profileViews: 0,
      connections: 0,
      engagements: 0,
      automationScore: 0,
    });
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [safetyStatus, setSafetyStatus] = useState<SafetyStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // WebSocket connection for real-time updates
    const wsUrl = `${
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    }//${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3007/dashboard/${userId}`;

    const ws = useOptimizedWebSocket({
      url: wsUrl,
      reconnect: true,
      reconnectAttempts: 5,
      heartbeatInterval: 30000,
      debug: process.env.NODE_ENV === 'development',
      onMessage: useCallback((data: any) => {
        switch (data.type) {
          case 'metrics_update':
            setMetrics(data.metrics);
            break;
          case 'activity_update':
            setActivities((prev) => [data.activity, ...prev].slice(0, 50));
            break;
          case 'safety_update':
            setSafetyStatus(data.safetyStatus);
            break;
          case 'initial_data':
            setMetrics(data.metrics);
            setActivities(data.activities);
            setSafetyStatus(data.safetyStatus);
            setIsLoading(false);
            break;
        }
      }, []),
      onOpen: useCallback(() => {
        // Subscribe to relevant channels
        ws.subscribeToChannel('metrics');
        ws.subscribeToChannel('activities');
        ws.subscribeToChannel('safety');
      }, []),
    });

    // Performance optimization: Memoize expensive calculations
    const metricsCards = useMemo(
      () => [
        {
          title: 'Profile Views',
          value: metrics.profileViews.toLocaleString(),
          icon: Eye,
          color: 'blue' as const,
          trend: 'up' as const,
          change: 12,
        },
        {
          title: 'Connections',
          value: metrics.connections.toLocaleString(),
          icon: Users,
          color: 'green' as const,
          trend: 'up' as const,
          change: 8,
        },
        {
          title: 'Engagements',
          value: metrics.engagements.toLocaleString(),
          icon: Heart,
          color: 'purple' as const,
          trend: 'stable' as const,
          change: 3,
        },
        {
          title: 'Automation Score',
          value: metrics.automationScore,
          icon: Zap,
          color: 'yellow' as const,
          trend: 'up' as const,
          change: 15,
        },
      ],
      [metrics]
    );

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Real-time LinkedIn automation insights</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {ws.isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Live</span>
                    <Badge variant="outline" className="text-xs">
                      {ws.latency}ms
                    </Badge>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">
                      {ws.isReconnecting ? 'Reconnecting...' : 'Offline'}
                    </span>
                  </>
                )}
              </div>
              
              <OptimizedButton
                variant="outline"
                size="sm"
                onClick={ws.reconnect}
                disabled={ws.isConnecting}
                leftIcon={<Clock className="h-4 w-4" />}
              >
                Refresh
              </OptimizedButton>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metricsCards.map((metric) => (
            <MetricCard
              key={metric.title}
              {...metric}
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Live Activity Feed</span>
                  {ws.lastUpdate && (
                    <Badge variant="outline" className="text-xs">
                      {ws.lastUpdate.toLocaleTimeString()}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityFeed activities={activities} isLoading={isLoading} />
              </CardContent>
            </Card>
          </div>

          {/* Safety Monitor */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Safety Monitor</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {safetyStatus ? (
                  <SafetyMonitor status={safetyStatus} isLoading={isLoading} />
                ) : (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Loading safety status...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
);

OptimizedRealTimeDashboard.displayName = 'OptimizedRealTimeDashboard';

export default OptimizedRealTimeDashboard;