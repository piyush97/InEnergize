export interface WebSocketUser {
  id: string;
  socketId: string;
  userId: string;
  subscriptionTier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  subscribedChannels: string[];
  connectedAt: Date;
  lastActivity: Date;
}

export interface WebSocketChannel {
  name: string;
  requiredTier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  updateInterval: number; // milliseconds
  maxSubscribers?: number;
}

export interface WebSocketMessage {
  channel: string;
  type: 'automation_status' | 'safety_alert' | 'profile_metrics' | 'queue_status' | 'system_notification';
  data: any;
  timestamp: Date;
  userId?: string;
}

export interface AutomationStatusUpdate {
  userId: string;
  connectionAutomation: {
    enabled: boolean;
    status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'ERROR';
    todaysSent: number;
    remaining: number;
    nextScheduled?: Date;
    queueLength: number;
  };
  engagementAutomation: {
    enabled: boolean;
    status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'ERROR';
    todaysEngagements: {
      likes: number;
      comments: number;
      views: number;
      follows: number;
    };
    queueLength: number;
  };
  safetyScore: number;
  healthStatus: 'SAFE' | 'WARNING' | 'CRITICAL' | 'SUSPENDED';
  lastUpdated: Date;
}

export interface SafetyAlert {
  id: string;
  userId: string;
  type: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  category: 'API_ERROR' | 'RATE_LIMIT' | 'ACCOUNT_HEALTH' | 'PATTERN_DETECTION' | 'COMPLIANCE_VIOLATION';
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
  actions: string[];
}

export interface ProfileMetrics {
  userId: string;
  views: number;
  viewsToday: number;
  viewsTrend: 'UP' | 'DOWN' | 'STABLE';
  connections: number;
  connectionsToday: number;
  connectionsTrend: 'UP' | 'DOWN' | 'STABLE';
  engagementRate: number;
  profileCompleteness: number;
  timestamp: Date;
}

export interface QueueStatus {
  userId: string;
  connectionQueue: {
    high: number;
    normal: number;
    low: number;
    processing: number;
    failed: number;
  };
  engagementQueue: {
    likes: number;
    comments: number;
    views: number;
    follows: number;
    processing: number;
  };
  estimatedWaitTime: number; // minutes
  lastProcessed: Date;
}

export interface SystemNotification {
  type: 'MAINTENANCE' | 'FEATURE_UPDATE' | 'POLICY_CHANGE' | 'SERVICE_STATUS';
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  targetUsers?: string[]; // If undefined, broadcast to all
  expiresAt?: Date;
  actionUrl?: string;
  actionText?: string;
}

export interface WebSocketConfig {
  port: number;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  channels: WebSocketChannel[];
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

export interface SubscriptionLimits {
  FREE: {
    maxChannels: number;
    updateInterval: number; // minimum interval in ms
    maxConcurrentConnections: number;
  };
  BASIC: {
    maxChannels: number;
    updateInterval: number;
    maxConcurrentConnections: number;
  };
  PRO: {
    maxChannels: number;
    updateInterval: number;
    maxConcurrentConnections: number;
  };
  ENTERPRISE: {
    maxChannels: number;
    updateInterval: number;
    maxConcurrentConnections: number;
  };
}

export interface EmergencyStopTrigger {
  userId: string;
  triggerType: 'MANUAL' | 'AUTOMATIC' | 'SYSTEM';
  reason: string;
  triggeredBy?: string; // admin ID if manual
  timestamp: Date;
  affectedServices: ('CONNECTION' | 'ENGAGEMENT' | 'ALL')[];
  estimatedResumeTime?: Date;
}

export interface AutomationHealthCheck {
  userId: string;
  overallHealth: number; // 0-100 score
  components: {
    apiHealth: number;
    rateLimitHealth: number;
    complianceHealth: number;
    performanceHealth: number;
  };
  activeWarnings: string[];
  criticalIssues: string[];
  lastCheck: Date;
  nextCheck: Date;
}