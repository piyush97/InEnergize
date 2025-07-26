export interface ProfileMetric {
  userId: string;
  timestamp: Date;
  profileViews: number;
  searchAppearances: number;
  connectionsCount: number;
  completenessScore: number;
  skillsCount: number;
  endorsementsCount: number;
  recommendationsCount: number;
  postsCount: number;
  articlesCount: number;
  engagementRate: number;
  source: 'linkedin' | 'manual' | 'import';
}

export interface EngagementMetric {
  userId: string;
  contentId?: string;
  timestamp: Date;
  type: 'like' | 'comment' | 'share' | 'view' | 'click';
  value: number;
  source: string;
  metadata?: Record<string, any>;
}

export interface ProfileAnalytics {
  userId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    profileViews: {
      current: number;
      previous: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    };
    searchAppearances: {
      current: number;
      previous: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    };
    connections: {
      current: number;
      previous: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    };
    completeness: {
      current: number;
      previous: number;
      change: number;
      trend: 'up' | 'down' | 'stable';
    };
    engagement: {
      totalEngagements: number;
      averageEngagementRate: number;
      topContentTypes: Array<{
        type: string;
        count: number;
        engagementRate: number;
      }>;
    };
  };
  chartData: {
    profileViews: Array<{ date: string; value: number }>;
    searchAppearances: Array<{ date: string; value: number }>;
    connections: Array<{ date: string; value: number }>;
    completeness: Array<{ date: string; value: number }>;
    engagement: Array<{ date: string; value: number }>;
  };
}

export interface DashboardMetrics {
  userId: string;
  snapshot: {
    profileViews: number;
    searchAppearances: number;
    connections: number;
    completenessScore: number;
    engagementRate: number;
  };
  trends: {
    profileViewsTrend: number;
    searchAppearancesTrend: number;
    connectionsTrend: number;
    completenessTrend: number;
    engagementTrend: number;
  };
  goals: {
    profileViewsGoal?: number;
    connectionsGoal?: number;
    completenessGoal?: number;
    engagementGoal?: number;
  };
  lastUpdated: Date;
}

export interface AnalyticsQuery {
  userId: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  metrics?: string[] | undefined;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  aggregation?: 'sum' | 'avg' | 'max' | 'min' | 'count';
}

export interface AnalyticsResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    totalRecords: number;
    page?: number;
    limit?: number;
    timeRange?: {
      start: Date;
      end: Date;
    };
  };
}

export interface WebSocketMessage {
  type: 'metric_update' | 'real_time_data' | 'alert' | 'connection_status' | 'pong';
  userId?: string;
  data: any;
  timestamp: Date;
}

export interface AlertConfig {
  userId: string;
  metricType: string;
  threshold: number;
  condition: 'above' | 'below' | 'change';
  enabled: boolean;
  notificationMethods: ('email' | 'websocket' | 'webhook')[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricAggregation {
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month';
  userId: string;
  timestamp: Date;
  metrics: Record<string, number>;
  source: string;
}