/**
 * TypeScript interfaces for LinkedIn automation components
 * Aligned with backend automation API endpoints
 */

export interface ConnectionRequest {
  id: string;
  targetProfileId: string;
  message?: string;
  templateId?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'scheduled' | 'sent' | 'accepted' | 'declined' | 'cancelled';
  scheduledAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EngagementTask {
  id: string;
  type: 'like' | 'comment' | 'view_profile' | 'follow';
  targetId: string;
  content?: string;
  templateId?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'scheduled' | 'completed' | 'failed' | 'cancelled';
  score?: number;
  metadata?: Record<string, unknown>;
  scheduledAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafetyStatus {
  overallStatus: 'healthy' | 'warning' | 'critical' | 'suspended';
  score: number; // 0-100
  activeAlerts: SafetyAlert[];
  lastHealthCheck: Date;
  riskFactors: RiskFactor[];
  metrics: SafetyMetrics;
}

export interface SafetyAlert {
  id: string;
  type: 'rate_limit' | 'suspicious_activity' | 'account_warning' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface RiskFactor {
  category: string;
  score: number; // 0-100
  description: string;
  recommendations: string[];
}

export interface SafetyMetrics {
  dailyConnections: number;
  dailyLikes: number;
  dailyComments: number;
  dailyProfileViews: number;
  dailyFollows: number;
  connectionAcceptanceRate: number;
  engagementSuccessRate: number;
  averageResponseTime: number;
}

export interface ConnectionStats {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  declined: number;
  cancelled: number;
  acceptanceRate: number;
  dailyLimit: number;
  dailyUsed: number;
  nextAvailableSlot?: Date;
}

export interface EngagementStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  successRate: number;
  byType: {
    likes: { total: number; completed: number; dailyLimit: number; dailyUsed: number };
    comments: { total: number; completed: number; dailyLimit: number; dailyUsed: number };
    profileViews: { total: number; completed: number; dailyLimit: number; dailyUsed: number };
    follows: { total: number; completed: number; dailyLimit: number; dailyUsed: number };
  };
}

export interface AutomationOverview {
  automation: {
    enabled: boolean;
    suspended: boolean;
    suspensionReason?: string;
  };
  connections: ConnectionStats;
  engagement: EngagementStats;
  safety: {
    status: string;
    score: number;
    activeAlertsCount: number;
    lastHealthCheck: Date;
  } | null;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  type: 'connection' | 'comment' | 'follow_up';
  variables: string[]; // e.g., ['firstName', 'company', 'position']
  successRate?: number;
  usageCount: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationSettings {
  connectionAutomation: {
    enabled: boolean;
    dailyLimit: number;
    minDelaySeconds: number;
    maxDelaySeconds: number;
    workingHours: {
      start: string; // HH:mm format
      end: string;   // HH:mm format
    };
    weekendsEnabled: boolean;
    targetFilters: {
      industries: string[];
      locations: string[];
      connectionDegree: ('1st' | '2nd' | '3rd')[];
      minimumConnections?: number;
      hasProfilePicture: boolean;
    };
  };
  engagementAutomation: {
    enabled: boolean;
    types: {
      likes: { enabled: boolean; dailyLimit: number };
      comments: { enabled: boolean; dailyLimit: number };
      profileViews: { enabled: boolean; dailyLimit: number };
      follows: { enabled: boolean; dailyLimit: number };
    };
    minDelaySeconds: number;
    maxDelaySeconds: number;
    workingHours: {
      start: string;
      end: string;
    };
    weekendsEnabled: boolean;
  };
  safetySettings: {
    emergencyStopThreshold: number; // 0-100 safety score
    maxDailyActions: number;
    cooldownPeriodHours: number;
    alertEmail: boolean;
    alertWebhook?: string;
  };
}

export interface QueueItem {
  id: string;
  type: 'connection' | 'engagement';
  action: string;
  targetId: string;
  targetName?: string;
  targetProfileUrl?: string;
  priority: 'low' | 'medium' | 'high';
  scheduledAt: Date;
  estimatedDuration?: number; // seconds
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export interface AutomationMetrics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  averageSuccessRate: number;
  dailyUsage: {
    connections: number;
    likes: number;
    comments: number;
    profileViews: number;
    follows: number;
  };
  weeklyTrends: {
    date: string;
    connections: number;
    engagements: number;
    successRate: number;
  }[];
  topPerformingTemplates: {
    templateId: string;
    name: string;
    successRate: number;
    usageCount: number;
  }[];
}

// WebSocket event types for real-time updates
export interface AutomationEvent {
  type: 'safety_alert' | 'queue_update' | 'stats_update' | 'automation_status';
  timestamp: Date;
  data: unknown;
}

export interface SafetyAlertEvent extends AutomationEvent {
  type: 'safety_alert';
  data: SafetyAlert;
}

export interface QueueUpdateEvent extends AutomationEvent {
  type: 'queue_update';
  data: {
    action: 'added' | 'updated' | 'removed' | 'completed';
    item: QueueItem;
  };
}

export interface StatsUpdateEvent extends AutomationEvent {
  type: 'stats_update';
  data: {
    connections?: Partial<ConnectionStats>;
    engagement?: Partial<EngagementStats>;
    safety?: Partial<SafetyStatus>;
  };
}

export interface AutomationStatusEvent extends AutomationEvent {
  type: 'automation_status';
  data: {
    enabled: boolean;
    suspended: boolean;
    reason?: string;
  };
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export interface ScheduleConnectionRequest {
  targetProfileId: string;
  message?: string;
  templateId?: string;
  priority?: 'low' | 'medium' | 'high';
  scheduledAt?: Date;
}

export interface ScheduleEngagementRequest {
  type: 'like' | 'comment' | 'view_profile' | 'follow';
  targetId: string;
  content?: string;
  templateId?: string;
  priority?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}

// Component prop types
export interface AutomationDashboardProps {
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  onSettingsOpen?: () => void;
}

export interface ConnectionAutomationProps {
  userId: string;
  templates: MessageTemplate[];
  stats: ConnectionStats;
  onScheduleConnection: (request: ScheduleConnectionRequest) => Promise<void>;
  onCancelConnection: (requestId: string) => Promise<void>;
}

export interface EngagementAutomationProps {
  userId: string;
  templates: MessageTemplate[];
  stats: EngagementStats;
  onScheduleEngagement: (request: ScheduleEngagementRequest) => Promise<void>;
}

export interface SafetyMonitorProps {
  userId: string;
  status: SafetyStatus;
  onEmergencyStop: () => Promise<void>;
  onResumeAutomation: () => Promise<void>;
  onAcknowledgeAlert: (alertId: string) => Promise<void>;
}

export interface QueuePanelProps {
  userId: string;
  items: QueueItem[];
  onReorderItems: (itemIds: string[]) => Promise<void>;
  onCancelItem: (itemId: string) => Promise<void>;
  onRetryItem: (itemId: string) => Promise<void>;
}

export interface TemplateManagerProps {
  userId: string;
  templates: MessageTemplate[];
  onCreateTemplate: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTemplate: (templateId: string, updates: Partial<MessageTemplate>) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

export interface AutomationSettingsProps {
  userId: string;
  settings: AutomationSettings;
  onUpdateSettings: (settings: Partial<AutomationSettings>) => Promise<void>;
}