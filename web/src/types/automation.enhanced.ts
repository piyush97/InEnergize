/**
 * Enhanced TypeScript interfaces for LinkedIn automation components
 * Enterprise-level type safety with comprehensive error handling and monitoring
 * Aligned with backend automation API endpoints and best practices
 */

import type {
  AsyncState,
  BaseComponentProps,
  UserId,
  ConnectionId,
  TemplateId,
  AutomationId,
  TimeRange,
  PerformanceMetrics
} from './common';

// ===== CORE AUTOMATION ENTITIES =====

export interface ConnectionRequest {
  id: ConnectionId;
  targetProfileId: string;
  targetUserId: UserId;
  targetProfileUrl: string;
  message?: string;
  templateId?: TemplateId;
  priority: ConnectionPriority;
  status: ConnectionRequestStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  responseAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: ConnectionRequestMetadata;
  riskScore?: SafetyScore;
  notes?: string;
}

export type ConnectionPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ConnectionRequestStatus = 
  | 'pending' 
  | 'scheduled' 
  | 'sent' 
  | 'accepted' 
  | 'declined' 
  | 'cancelled'
  | 'failed'
  | 'expired';

export interface ConnectionRequestMetadata {
  sourceType: 'manual' | 'imported' | 'suggested' | 'campaign';
  industry?: string;
  company?: string;
  location?: string;
  mutualConnections?: number;
  profileCompleteness?: number;
  lastActivity?: Date;
  leadScore?: number;
}

export interface EngagementTask {
  id: AutomationId;
  type: EngagementType;
  targetId: string;
  targetUserId?: UserId;
  targetPostId?: string;
  targetCompanyId?: string;
  content?: string;
  templateId?: TemplateId;
  priority: EngagementPriority;
  status: EngagementStatus;
  score?: EngagementScore;
  metadata?: EngagementTaskMetadata;
  scheduledAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  retryCount?: number;
  maxRetries?: number;
  errorMessage?: string;
}

export type EngagementType = 
  | 'like' 
  | 'comment' 
  | 'view_profile' 
  | 'follow'
  | 'share'
  | 'react'
  | 'endorse'
  | 'message';

export type EngagementPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EngagementStatus = 
  | 'pending' 
  | 'scheduled' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'rate_limited'
  | 'blocked';

export type EngagementScore = number & { readonly __brand: 'EngagementScore' }; // 0-100
export type SafetyScore = number & { readonly __brand: 'SafetyScore' }; // 0-100

export interface EngagementTaskMetadata {
  contentType?: 'text' | 'image' | 'video' | 'article' | 'poll';
  authorIndustry?: string;
  postAge?: number; // Hours since posted
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  relevanceScore?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  language?: string;
}

// ===== SAFETY AND COMPLIANCE =====

export interface SafetyStatus {
  overallStatus: SafetyStatusType;
  score: SafetyScore;
  activeAlerts: SafetyAlert[];
  lastHealthCheck: Date;
  nextHealthCheck: Date;
  riskFactors: RiskFactor[];
  metrics: SafetyMetrics;
  trend: SafetyTrend;
  complianceLevel: ComplianceLevel;
}

export type SafetyStatusType = 'healthy' | 'warning' | 'critical' | 'suspended';
export type SafetyTrend = 'improving' | 'stable' | 'declining';
export type ComplianceLevel = 'compliant' | 'at_risk' | 'violation' | 'suspended';

export interface SafetyAlert {
  id: string;
  type: SafetyAlertType;
  severity: SafetyAlertSeverity;
  message: string;
  description?: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: UserId;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
  actionRequired: boolean;
  autoResolved: boolean;
  metadata?: SafetyAlertMetadata;
  impact: AlertImpact;
}

export type SafetyAlertType = 
  | 'rate_limit' 
  | 'suspicious_activity' 
  | 'account_warning' 
  | 'compliance_violation'
  | 'api_error'
  | 'security_breach'
  | 'unusual_pattern'
  | 'quota_exceeded';

export type SafetyAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertImpact = 'none' | 'degraded' | 'limited' | 'suspended';

export interface SafetyAlertMetadata {
  endpoint?: string;
  rateLimitType?: string;
  remainingQuota?: number;
  resetTime?: Date;
  errorCode?: string;
  requestCount?: number;
  timeWindow?: string;
  affectedFeatures?: string[];
}

export interface RiskFactor {
  id: string;
  type: 'behavioral' | 'technical' | 'account' | 'external';
  name: string;
  description: string;
  severity: SafetyAlertSeverity;
  probability: number; // 0-1
  impact: number; // 0-100
  riskScore: number; // probability * impact
  detectedAt: Date;
  mitigationSteps?: string[];
  status: 'active' | 'monitoring' | 'resolved';
}

export interface SafetyMetrics {
  dailyConnections: DailyUsageMetric;
  dailyLikes: DailyUsageMetric;
  dailyComments: DailyUsageMetric;
  dailyProfileViews: DailyUsageMetric;
  dailyFollows: DailyUsageMetric;
  dailyMessages: DailyUsageMetric;
  connectionAcceptanceRate: PercentageMetric;
  engagementSuccessRate: PercentageMetric;
  averageResponseTime: number; // milliseconds
  apiErrorRate: PercentageMetric;
  complianceScore: SafetyScore;
  reputationScore: SafetyScore;
  behaviorNormalityScore: SafetyScore;
}

export interface DailyUsageMetric {
  current: number;
  limit: number;
  percentage: PercentageMetric;
  trend: MetricTrend;
  resetAt: Date;
  history: UsageHistoryPoint[];
}

export type MetricTrend = 'up' | 'down' | 'stable';
export type PercentageMetric = number & { readonly __brand: 'Percentage' }; // 0-100

export interface UsageHistoryPoint {
  timestamp: Date;
  value: number;
  limit: number;
}

// ===== STATISTICS AND ANALYTICS =====

export interface ConnectionStats {
  totalSent: number;
  totalAccepted: number;
  totalPending: number;
  totalDeclined: number;
  acceptanceRate: PercentageMetric;
  dailyUsed: number;
  dailyLimit: number;
  weeklyTrend: number;
  topIndustries: IndustryStats[];
  averageResponseTime: number; // hours
  bestPerformingTime: TimeSlot;
}

export interface EngagementStats {
  totalEngagements: number;
  successfulEngagements: number;
  successRate: PercentageMetric;
  byType: Record<EngagementType, TypeEngagementStats>;
  dailyAverage: number;
  weeklyTrend: number;
  topPerformingContent: ContentPerformance[];
  bestEngagementTimes: TimeSlot[];
}

export interface TypeEngagementStats {
  count: number;
  successCount: number;
  successRate: PercentageMetric;
  dailyUsed: number;
  dailyLimit: number;
  averageScore: EngagementScore;
}

export interface IndustryStats {
  industry: string;
  count: number;
  acceptanceRate: PercentageMetric;
  averageResponseTime: number;
}

export interface ContentPerformance {
  contentId: string;
  contentType: string;
  engagementCount: number;
  successRate: PercentageMetric;
  averageScore: EngagementScore;
}

export interface TimeSlot {
  hour: number;
  day: number; // 0 = Sunday, 6 = Saturday
  successRate: PercentageMetric;
  count: number;
}

// ===== AUTOMATION OVERVIEW =====

export interface AutomationOverview {
  userId: UserId;
  connections: ConnectionStats;
  engagement: EngagementStats;
  safety: SafetyOverview;
  automation: AutomationConfig;
  performance: PerformanceOverview;
  subscription: SubscriptionInfo;
  lastUpdated: Date;
  dataFreshness: DataFreshness;
}

export interface SafetyOverview {
  status: SafetyStatusType;
  score: SafetyScore;
  lastHealthCheck: Date;
  alertCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complianceStatus: ComplianceLevel;
}

export interface AutomationConfig {
  enabled: boolean;
  suspended: boolean;
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedUntil?: Date;
  autoResumeEnabled: boolean;
  pausedFeatures: string[];
  maintenanceMode: boolean;
  scheduleEnabled: boolean;
  workingHours: WorkingHours;
}

export interface WorkingHours {
  enabled: boolean;
  timezone: string;
  schedule: DaySchedule[];
  holidays: Date[];
  respectTargetTimezone: boolean;
}

export interface DaySchedule {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

export interface PerformanceOverview {
  successRate: PercentageMetric;
  averageExecutionTime: number; // milliseconds
  queueLength: number;
  processingSpeed: number; // items per hour
  dailyQuotaUsage: PercentageMetric;
  errorRate: PercentageMetric;
  uptimePercentage: PercentageMetric;
  lastSuccessfulRun: Date;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  usage: SubscriptionUsage;
  renewalDate: Date;
  trialEndsAt?: Date;
  features: string[];
}

export type SubscriptionTier = 'free' | 'pro' | 'enterprise' | 'custom';

export interface SubscriptionLimits {
  dailyConnections: number;
  dailyEngagements: number;
  templatesCount: number;
  campaignsCount: number;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
}

export interface SubscriptionUsage {
  dailyConnections: number;
  dailyEngagements: number;
  templatesUsed: number;
  campaignsActive: number;
  storageUsed: number; // bytes
}

export interface DataFreshness {
  connections: Date;
  engagement: Date;
  safety: Date;
  analytics: Date;
  queue: Date;
}

// ===== MESSAGE TEMPLATES =====

export interface MessageTemplate {
  id: TemplateId;
  name: string;
  type: MessageTemplateType;
  category: TemplateCategory;
  subject?: string;
  content: string;
  variables: TemplateVariable[];
  isActive: boolean;
  isDefault: boolean;
  successRate?: PercentageMetric;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: UserId;
  tags: string[];
  analytics: TemplateAnalytics;
  version: number;
  parentTemplateId?: TemplateId;
  language: string;
  industry?: string;
  personalization: PersonalizationConfig;
}

export type MessageTemplateType = 
  | 'connection' 
  | 'follow_up' 
  | 'thank_you' 
  | 'engagement'
  | 'introduction'
  | 'networking'
  | 'cold_outreach'
  | 'warm_intro';

export type TemplateCategory = 
  | 'sales' 
  | 'recruiting' 
  | 'networking' 
  | 'partnerships'
  | 'general'
  | 'industry_specific';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  defaultValue?: string;
  description?: string;
  options?: string[]; // for select/multiselect types
  validation?: VariableValidation;
}

export interface VariableValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customValidator?: string;
}

export interface PersonalizationConfig {
  enabled: boolean;
  aiEnhanced: boolean;
  industrySpecific: boolean;
  locationBased: boolean;
  companyBased: boolean;
  roleBased: boolean;
}

export interface TemplateAnalytics {
  responseRate: PercentageMetric;
  acceptanceRate: PercentageMetric;
  averageResponseTime: number; // hours
  totalSent: number;
  totalResponses: number;
  topPerformingIndustries: string[];
  bestPerformingTimes: TimeSlot[];
  A_BTestResults: TemplateABTestResult[];
  sentimentAnalysis?: SentimentAnalysis;
}

export interface TemplateABTestResult {
  id: string;
  variant: string;
  sampleSize: number;
  successRate: PercentageMetric;
  confidence: PercentageMetric;
  isWinner: boolean;
  isStatisticallySignificant: boolean;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'paused';
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  confidence: PercentageMetric;
  keywords: string[];
  emotionalTone: string[];
  readabilityScore: number;
}

// ===== AUTOMATION SETTINGS =====

export interface AutomationSettings {
  userId: UserId;
  connections: ConnectionAutomationSettings;
  engagement: EngagementAutomationSettings;
  safety: SafetySettings;
  scheduling: SchedulingSettings;
  preferences: UserPreferences;
  notifications: NotificationSettings;
  updatedAt: Date;
  version: number;
}

export interface ConnectionAutomationSettings {
  enabled: boolean;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  delayBetweenRequests: DelayRange; // minutes
  targetCriteria: TargetingCriteria;
  messageTemplates: TemplateId[];
  defaultTemplateId?: TemplateId;
  autoFollowUp: boolean;
  followUpDelay: number; // days
  respectWorkingHours: boolean;
  skipExistingConnections: boolean;
  skipRecentlyContacted: boolean;
  recentlyContactedDays: number;
}

export interface EngagementAutomationSettings {
  enabled: boolean;
  types: Partial<Record<EngagementType, EngagementTypeSettings>>;
  dailyLimits: Partial<Record<EngagementType, number>>;
  delayBetweenActions: DelayRange; // minutes
  contentFilters: ContentFilters;
  engagementRules: EngagementRule[];
  respectWorkingHours: boolean;
  followUpEnabled: boolean;
  followUpTemplates: TemplateId[];
}

export interface EngagementTypeSettings {
  enabled: boolean;
  priority: EngagementPriority;
  dailyLimit: number;
  minDelay: number; // minutes
  maxDelay: number; // minutes
  targetScore: EngagementScore;
  templates: TemplateId[];
}

export interface DelayRange {
  min: number;
  max: number;
  unit: 'seconds' | 'minutes' | 'hours';
}

export interface TargetingCriteria {
  industries: string[];
  locations: string[];
  companies: string[];
  jobTitles: string[];
  keywords: string[];
  connectionDegree: ('1st' | '2nd' | '3rd')[];
  profileCompleteness: number; // minimum percentage
  activityLevel: 'low' | 'medium' | 'high' | 'any';
  premiumAccount: boolean | null;
  openToWork: boolean | null;
  mutualConnections: {
    min: number;
    max: number;
  };
  excludeCriteria: ExclusionCriteria;
}

export interface ExclusionCriteria {
  industries: string[];
  companies: string[];
  jobTitles: string[];
  keywords: string[];
  locations: string[];
  recentlyContacted: boolean;
  existingConnections: boolean;
  competitorEmployees: boolean;
}

export interface ContentFilters {
  minLikes: number;
  maxAge: number; // hours
  contentTypes: string[];
  languages: string[];
  excludeKeywords: string[];
  includeKeywords: string[];
  authorCriteria: AuthorCriteria;
}

export interface AuthorCriteria {
  minFollowers: number;
  industries: string[];
  verifiedOnly: boolean;
  excludeCompetitors: boolean;
}

export interface EngagementRule {
  id: string;
  name: string;
  condition: RuleCondition;
  action: RuleAction;
  enabled: boolean;
  priority: number;
}

export interface RuleCondition {
  type: 'content' | 'author' | 'engagement' | 'time' | 'custom';
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches';
  value: string | number | boolean;
}

export interface RuleAction {
  type: 'engage' | 'skip' | 'flag' | 'prioritize' | 'template';
  parameters: Record<string, unknown>;
}

export interface SafetySettings {
  emergencyStopEnabled: boolean;
  autoSuspendOnAlerts: boolean;
  suspensionThreshold: SafetyScore;
  rateLimitBuffer: PercentageMetric; // percentage of LinkedIn's limits
  behaviorAnalysis: boolean;
  anomalyDetection: boolean;
  complianceLevel: 'basic' | 'strict' | 'enterprise';
  auditLogging: boolean;
  dataRetention: number; // days
}

export interface SchedulingSettings {
  workingHours: WorkingHours;
  timeZone: string;
  respectHolidays: boolean;
  holidays: Date[];
  batchProcessing: boolean;
  batchSize: number;
  distributionStrategy: 'even' | 'peak_hours' | 'random' | 'custom';
}

export interface UserPreferences {
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  theme: 'light' | 'dark' | 'auto';
  compactView: boolean;
  showAdvancedMetrics: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // seconds
}

export interface NotificationSettings {
  email: EmailNotificationSettings;
  push: PushNotificationSettings;
  inApp: InAppNotificationSettings;
  webhook: WebhookSettings;
}

export interface EmailNotificationSettings {
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  events: NotificationEvent[];
  email: string;
  template: 'basic' | 'detailed' | 'summary';
}

export interface PushNotificationSettings {
  enabled: boolean;
  events: NotificationEvent[];
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
  };
}

export interface InAppNotificationSettings {
  enabled: boolean;
  events: NotificationEvent[];
  autoMarkRead: boolean;
  showBadges: boolean;
}

export interface WebhookSettings {
  enabled: boolean;
  url: string;
  secret: string;
  events: NotificationEvent[];
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    timeout: number;
  };
}

export type NotificationEvent = 
  | 'connection_accepted'
  | 'connection_declined'
  | 'safety_alert'
  | 'quota_reached'
  | 'automation_suspended'
  | 'campaign_completed'
  | 'error_occurred'
  | 'weekly_report';

// ===== QUEUE MANAGEMENT =====

export interface QueueItem {
  id: string;
  type: QueueItemType;
  subtype: string;
  action: string;
  targetId: string;
  userId: UserId;
  priority: QueuePriority;
  status: QueueStatus;
  scheduledAt: Date;
  estimatedDuration: number; // seconds
  actualDuration?: number; // seconds
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  errorCode?: string;
  metadata: QueueItemMetadata;
  dependencies: string[];
  batchId?: string;
  campaignId?: string;
  progress?: QueueProgress;
}

export type QueueItemType = 
  | 'connection' 
  | 'engagement' 
  | 'data_sync' 
  | 'cleanup'
  | 'analytics'
  | 'notification'
  | 'maintenance';

export type QueuePriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

export type QueueStatus = 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'rate_limited'
  | 'paused'
  | 'blocked'
  | 'waiting_dependencies';

export interface QueueItemMetadata {
  templateId?: TemplateId;
  campaignId?: string;
  batchId?: string;
  source: QueueItemSource;
  executionContext: ExecutionContext;
  performanceMetrics?: PerformanceMetrics;
  linkedinContext?: LinkedInContext;
}

export type QueueItemSource = 
  | 'manual' 
  | 'automated' 
  | 'scheduled' 
  | 'retry'
  | 'campaign'
  | 'bulk_import'
  | 'api'
  | 'webhook';

export interface ExecutionContext {
  userAgent: string;
  ipAddress: string;
  sessionId: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'server';
  browser?: string;
  operatingSystem?: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
  };
}

export interface LinkedInContext {
  profileUrl: string;
  industry?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  connectionDegree: '1st' | '2nd' | '3rd' | 'out_of_network';
  mutualConnections: number;
  lastActivity?: Date;
}

export interface QueueProgress {
  percentage: PercentageMetric;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  estimatedTimeRemaining: number; // seconds
}

// ===== EVENT SYSTEM =====

export interface AutomationEvent {
  id: string;
  type: string;
  timestamp: Date;
  userId: UserId;
  source: string;
  version: string;
}

export interface SafetyAlertEvent extends AutomationEvent {
  type: 'safety_alert';
  data: {
    alert: SafetyAlert;
    previousStatus: SafetyStatusType;
    newStatus: SafetyStatusType;
  };
}

export interface QueueUpdateEvent extends AutomationEvent {
  type: 'queue_update';
  data: {
    action: 'added' | 'updated' | 'removed' | 'completed' | 'failed';
    item: QueueItem;
    queueLength: number;
  };
}

export interface StatsUpdateEvent extends AutomationEvent {
  type: 'stats_update';
  data: {
    connections: Partial<ConnectionStats>;
    engagement: Partial<EngagementStats>;
    performance: Partial<PerformanceOverview>;
  };
}

export interface AutomationStatusEvent extends AutomationEvent {
  type: 'automation_status';
  data: {
    enabled: boolean;
    suspended: boolean;
    reason?: string;
    affectedFeatures: string[];
  };
}

// ===== API INTERFACES =====

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  timestamp: string;
  requestId: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ScheduleConnectionRequest {
  targetProfileIds: string[];
  templateId?: TemplateId;
  message?: string;
  priority: ConnectionPriority;
  scheduledAt?: Date;
  campaignId?: string;
  tags?: string[];
  customVariables?: Record<string, string>;
}

export interface ScheduleEngagementRequest {
  type: EngagementType;
  targetIds: string[];
  templateId?: TemplateId;
  content?: string;
  priority: EngagementPriority;
  scheduledAt?: Date;
  campaignId?: string;
  filters?: ContentFilters;
}

export interface BatchOperationRequest {
  operation: 'schedule' | 'cancel' | 'retry' | 'update';
  itemIds: string[];
  parameters?: Record<string, unknown>;
  force?: boolean;
}

export interface BatchOperationResponse {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
    code: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ===== COMPONENT PROPS INTERFACES =====

export interface AutomationDashboardProps extends BaseComponentProps {
  userId?: UserId;
  subscriptionTier?: SubscriptionTier;
  onSettingsOpen?: () => void;
  showAdvancedMetrics?: boolean;
  refreshInterval?: number;
  compactView?: boolean;
  realTimeUpdates?: boolean;
}

export interface ConnectionAutomationProps extends BaseComponentProps {
  userId: UserId;
  settings: ConnectionAutomationSettings;
  onScheduleConnection: (request: ScheduleConnectionRequest) => Promise<void>;
  onUpdateSettings: (settings: Partial<ConnectionAutomationSettings>) => Promise<void>;
  state: AsyncState<ConnectionStats>;
  templates: MessageTemplate[];
  canSchedule: boolean;
  limits: SubscriptionLimits;
}

export interface EngagementAutomationProps extends BaseComponentProps {
  userId: UserId;
  settings: EngagementAutomationSettings;
  onScheduleEngagement: (request: ScheduleEngagementRequest) => Promise<void>;
  onUpdateSettings: (settings: Partial<EngagementAutomationSettings>) => Promise<void>;
  state: AsyncState<EngagementStats>;
  templates: MessageTemplate[];
  canEngage: boolean;
  limits: SubscriptionLimits;
}

export interface SafetyMonitorProps extends BaseComponentProps {
  userId: UserId;
  status: SafetyStatus;
  onEmergencyStop: () => Promise<void>;
  onResumeAutomation: () => Promise<void>;
  onAcknowledgeAlert?: (alertId: string) => Promise<void>;
  realTimeUpdates?: boolean;
  alertsExpanded?: boolean;
  showAdvancedMetrics?: boolean;
  compactView?: boolean;
}

export interface QueuePanelProps extends BaseComponentProps {
  userId: UserId;
  items: QueueItem[];
  onCancelItem: (itemId: string) => Promise<void>;
  onRetryItem: (itemId: string) => Promise<void>;
  onPauseQueue: () => Promise<void>;
  onResumeQueue: () => Promise<void>;
  onClearCompleted: () => Promise<void>;
  loading?: boolean;
  realTimeUpdates?: boolean;
  showFilters?: boolean;
}

export interface TemplateManagerProps extends BaseComponentProps {
  userId: UserId;
  templates: MessageTemplate[];
  onCreateTemplate: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'analytics'>) => Promise<void>;
  onUpdateTemplate: (id: TemplateId, updates: Partial<MessageTemplate>) => Promise<void>;
  onDeleteTemplate: (id: TemplateId) => Promise<void>;
  onTestTemplate: (id: TemplateId, variables: Record<string, string>) => Promise<void>;
  loading?: boolean;
  canManage: boolean;
  limits: SubscriptionLimits;
}

export interface AutomationSettingsProps extends BaseComponentProps {
  userId: UserId;
  settings: AutomationSettings;
  onUpdateSettings: (updates: Partial<AutomationSettings>) => Promise<void>;
  onResetToDefaults: () => Promise<void>;
  onExportSettings: () => Promise<void>;
  onImportSettings: (settings: AutomationSettings) => Promise<void>;
  loading?: boolean;
  canManage: boolean;
  subscriptionTier: SubscriptionTier;
}

// ===== UTILITY TYPES =====

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type WithTimestamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

export type WithUserId<T> = T & {
  userId: UserId;
};

export type PaginatedRequest<T = unknown> = T & {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type FilterableRequest<T = unknown> = T & {
  filters?: Record<string, unknown>;
  search?: string;
};