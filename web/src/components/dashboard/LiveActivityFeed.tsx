import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, TrendingUp, CheckCircle, MessageCircle, Share, Heart, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityEvent {
  id: string;
  type: 'profile_view' | 'connection_request' | 'post_engagement' | 'skill_endorsement' | 'profile_update';
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    value?: number;
    source?: string;
    contentType?: string;
    engagementType?: 'like' | 'comment' | 'share';
  };
}

interface LiveActivityFeedProps {
  className?: string;
}

const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({ className }) => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize with recent activities
    fetchRecentActivities();
    
    // Set up WebSocket connection for real-time updates
    initializeWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchRecentActivities = async () => {
    try {
      // For now, we'll simulate some recent activities
      // In a real implementation, this would fetch from the analytics service
      const mockActivities: ActivityEvent[] = [
        {
          id: '1',
          type: 'profile_view',
          title: 'Profile viewed',
          description: 'Your profile was viewed by a recruiter from Tech Corp',
          timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          metadata: { source: 'search' }
        },
        {
          id: '2',
          type: 'connection_request',
          title: 'New connection',
          description: 'Sarah Johnson connected with you',
          timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
        },
        {
          id: '3',
          type: 'post_engagement',
          title: 'Post engagement',
          description: 'Your post about React best practices received 5 likes',
          timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          metadata: { value: 5, engagementType: 'like' }
        },
        {
          id: '4',
          type: 'skill_endorsement',
          title: 'Skill endorsed',
          description: 'You received an endorsement for JavaScript',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
        {
          id: '5',
          type: 'profile_update',
          title: 'Profile updated',
          description: 'Your profile completeness score increased to 95%',
          timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          metadata: { value: 95 }
        }
      ];
      
      setActivities(mockActivities);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      setLoading(false);
    }
  };

  const initializeWebSocket = () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const wsUrl = `ws://localhost:3007?token=${token}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setConnected(true);
        console.log('WebSocket connected for live activity feed');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'real_time_data' || message.type === 'metric_update') {
            // Convert analytics updates to activity events
            const newActivity = convertAnalyticsToActivity(message);
            if (newActivity) {
              setActivities(prev => [newActivity, ...prev.slice(0, 19)]); // Keep last 20 activities
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        setConnected(false);
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            initializeWebSocket();
          }
        }, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  };

  const convertAnalyticsToActivity = (message: any): ActivityEvent | null => {
    const { data } = message;
    
    // Convert different types of analytics updates to activity events
    if (data.metricType === 'profile_views' && data.value > 0) {
      return {
        id: `activity_${Date.now()}`,
        type: 'profile_view',
        title: 'Profile viewed',
        description: `Your profile was viewed ${data.value} time${data.value > 1 ? 's' : ''}`,
        timestamp: new Date().toISOString(),
        metadata: { value: data.value, source: data.source }
      };
    }
    
    if (data.metricType === 'connections' && data.value > 0) {
      return {
        id: `activity_${Date.now()}`,
        type: 'connection_request',
        title: 'New connection',
        description: `You gained ${data.value} new connection${data.value > 1 ? 's' : ''}`,
        timestamp: new Date().toISOString(),
        metadata: { value: data.value }
      };
    }
    
    return null;
  };

  const getActivityIcon = (type: string) => {
    const iconProps = { className: "h-4 w-4" };
    
    switch (type) {
      case 'profile_view':
        return <Eye {...iconProps} className="h-4 w-4 text-blue-500" />;
      case 'connection_request':
        return <Users {...iconProps} className="h-4 w-4 text-green-500" />;
      case 'post_engagement':
        return <Heart {...iconProps} className="h-4 w-4 text-red-500" />;
      case 'skill_endorsement':
        return <TrendingUp {...iconProps} className="h-4 w-4 text-purple-500" />;
      case 'profile_update':
        return <CheckCircle {...iconProps} className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock {...iconProps} className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'profile_view':
        return 'border-l-blue-500 bg-blue-50';
      case 'connection_request':
        return 'border-l-green-500 bg-green-50';
      case 'post_engagement':
        return 'border-l-red-500 bg-red-50';
      case 'skill_endorsement':
        return 'border-l-purple-500 bg-purple-50';
      case 'profile_update':
        return 'border-l-orange-500 bg-orange-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const ActivityItem: React.FC<{ activity: ActivityEvent }> = ({ activity }) => (
    <div className={cn(
      'relative pl-4 pb-4 border-l-2',
      getActivityColor(activity.type)
    )}>
      <div className="absolute -left-2 top-1 bg-white rounded-full p-1 border-2 border-gray-200">
        {getActivityIcon(activity.type)}
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">
            {activity.title}
          </h4>
          <span className="text-xs text-gray-500">
            {formatTimeAgo(activity.timestamp)}
          </span>
        </div>
        
        <p className="text-sm text-gray-600">
          {activity.description}
        </p>
        
        {activity.metadata && (
          <div className="flex items-center space-x-2 mt-2">
            {activity.metadata.source && (
              <Badge variant="secondary" className="text-xs">
                {activity.metadata.source}
              </Badge>
            )}
            {activity.metadata.engagementType && (
              <Badge variant="outline" className="text-xs">
                {activity.metadata.engagementType}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Live Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Live Activity</CardTitle>
          <div className="flex items-center space-x-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              connected ? 'bg-green-500' : 'bg-gray-400'
            )}></div>
            <span className="text-xs text-gray-600">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity, index) => (
              <div key={activity.id} className={index < activities.length - 1 ? 'mb-4' : ''}>
                <ActivityItem activity={activity} />
              </div>
            ))}
          </div>
        )}
        
        {activities.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              View all activity
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveActivityFeed;