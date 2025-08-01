/**
 * TypeScript definitions for AI-Powered Profile Completeness Visualizer
 * Provides comprehensive type safety for the entire visualization system
 */

import { ReactNode, ElementType } from 'react';

// Base interfaces for profile data
export interface ProfileCompleteness {
  score: number;
  breakdown: {
    basicInfo: number;
    headline: number;
    summary: number;
    experience: number;
    education: number;
    skills: number;
    profilePicture: number;
    connections: number;
    certifications: number;
    languages: number;
    projects: number;
    volunteerWork: number;
    recommendations: number;
    customUrl: number;
  };
  suggestions: string[];
  missingFields: string[];
  priorityImprovements: PriorityImprovement[];
  lastUpdated: Date;
}

export interface PriorityImprovement {
  field: keyof ProfileCompleteness['breakdown'];
  impact: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate: string;
  suggestion: string;
  xpReward: number;
  requirements?: string[];
}

export interface IndustryBenchmarks {
  averageScore: number;
  topPercentileScore: number;
  commonWeaknesses: string[];
  industrySpecificTips: string[];
  industry: string;
  sampleSize: number;
}

// Gamification system types
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: ElementType;
  category: AchievementCategory;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  rarity: AchievementRarity;
  xpReward: number;
  unlockedAt?: Date;
  requirements: string[];
  tips?: string[];
  conditions?: AchievementCondition[];
}

export type AchievementCategory = 'profile' | 'networking' | 'engagement' | 'consistency' | 'growth' | 'learning';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AchievementCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  timeframe?: '1h' | '24h' | '7d' | '30d' | 'all_time';
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  icon: ElementType;
  reward: MilestoneReward;
  category: string;
  deadline?: Date;
  isCompleted: boolean;
  completedAt?: Date;
}

export interface MilestoneReward {
  xp: number;
  badge?: string;
  title?: string;
  unlockables?: string[];
}

export interface UserStats {
  profileViews: number;
  connections: number;
  posts: number;
  engagementRate: number;
  streak: number;
  totalXp: number;
  level: number;
  profileCompleteness: number;
  connectionAcceptanceRate: number;
  averagePostImpressions: number;
  skillEndorsements: number;
  recommendations: number;
}

export interface GamificationStats extends UserStats {
  xpToNextLevel: number;
  totalAchievements: number;
  unlockedAchievements: number;
  currentStreak: number;
  longestStreak: number;
  weeklyGoalProgress: number;
  monthlyGoalProgress: number;
}

// 3D Visualization types
export interface ProfileSection {
  id: string;
  label: string;
  icon: ElementType;
  score: number;
  maxScore: number;
  weight: number;
  color: string;
  glowColor: string;
  animationDelay: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate: string;
  suggestion: string;
  xp: number;
  maxXp: number;
  position?: Vector3D;
  isActive?: boolean;
  lastUpdated?: Date;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface VisualizationSettings {
  enableAnimations: boolean;
  rotationSpeed: number;
  scale: number;
  theme: 'light' | 'dark' | 'auto';
  particleEffects: boolean;
  soundEffects: boolean;
  reducedMotion: boolean;
}

// Mobile and touch interface types
export interface TouchGesture {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  type: GestureType;
  velocity?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export type GestureType = 'tap' | 'double_tap' | 'long_press' | 'swipe' | 'pinch' | 'rotate' | 'none';

export interface HapticFeedback {
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
  duration?: number;
  pattern?: number[];
}

export interface AudioFeedback {
  frequency: number;
  duration: number;
  type: 'sine' | 'square' | 'sawtooth' | 'triangle';
  volume?: number;
}

export interface MobileOptimization {
  touchTargetSize: number;
  gestureThreshold: number;
  animationDuration: number;
  enableHaptics: boolean;
  enableAudio: boolean;
  reducedAnimations: boolean;
}

// Real-time tracking types
export interface ProfileMetric {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: MetricTrend;
  icon: ElementType;
  color: string;
  unit: string;
  timestamp: Date;
  target?: number;
  category: MetricCategory;
  frequency: UpdateFrequency;
}

export type MetricTrend = 'up' | 'down' | 'stable';
export type MetricCategory = 'visibility' | 'engagement' | 'growth' | 'activity' | 'quality';
export type UpdateFrequency = 'real_time' | 'hourly' | 'daily' | 'weekly';

export interface RealTimeUpdate {
  type: UpdateType;
  data: any;
  timestamp: Date;
  userId: string;
  source: 'websocket' | 'polling' | 'manual';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export type UpdateType = 'metric_update' | 'achievement_unlock' | 'milestone_reached' | 'goal_progress' | 'error' | 'warning';

export interface WebSocketStatus {
  connected: boolean;
  reconnecting: boolean;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  latency?: number;
  error?: string;
}

export interface NotificationSettings {
  achievements: boolean;
  milestones: boolean;
  metrics: boolean;
  warnings: boolean;
  sound: boolean;
  vibration: boolean;
  desktop: boolean;
  email: boolean;
}

// Dashboard configuration types
export interface DashboardPreferences {
  layout: LayoutType;
  theme: ThemeType;
  showAnimations: boolean;
  enableNotifications: boolean;
  enableRealTime: boolean;
  mobileOptimized: boolean;
  compactMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  defaultView: ComponentType;
}

export type LayoutType = 'grid' | 'stack' | 'sidebar' | 'fullscreen';
export type ThemeType = 'light' | 'dark' | 'auto' | 'high_contrast';
export type ComponentType = '3d' | 'achievements' | 'mobile' | 'realtime' | 'classic';

export interface ComponentConfig {
  id: ComponentType;
  name: string;
  icon: ElementType;
  description: string;
  recommended: boolean;
  requiresData: string[];
  mobileSupported: boolean;
  accessibility: AccessibilityFeatures;
}

export interface AccessibilityFeatures {
  screenReaderSupport: boolean;
  keyboardNavigation: boolean;
  highContrastMode: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  focusIndicators: boolean;
}

// API and data fetching types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  cached: boolean;
  rateLimit?: RateLimitInfo;
}

export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size in MB
  strategy: 'lru' | 'fifo' | 'ttl';
}

// Error handling types
export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
  retryAfter?: number;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  fallbackComponent?: ReactNode;
}

// Performance monitoring types
export interface PerformanceMetrics {
  renderTime: number;
  componentMount: number;
  dataFetch: number;
  animationFps: number;
  memoryUsage: number;
  bundleSize: number;
}

export interface OptimizationConfig {
  lazyLoading: boolean;
  imageOptimization: boolean;
  codesplitting: boolean;
  prefetching: boolean;
  serviceWorker: boolean;
  compression: boolean;
}

// Event handler types
export interface EventHandlers {
  onSectionClick?: (sectionId: string) => void;
  onAchievementUnlock?: (achievement: Achievement) => void;
  onMilestoneReached?: (milestone: Milestone) => void;
  onMetricUpdate?: (metric: ProfileMetric) => void;
  onError?: (error: ErrorInfo) => void;
  onPreferencesChange?: (preferences: DashboardPreferences) => void;
  onGestureDetected?: (gesture: TouchGesture) => void;
  onNotificationReceived?: (notification: RealTimeUpdate) => void;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  enableAnimations?: boolean;
  showTooltips?: boolean;
  onError?: (error: ErrorInfo) => void;
}

export interface ProfileVisualization3DProps extends BaseComponentProps {
  completenessData: ProfileCompleteness;
  showAchievements?: boolean;
  onSectionClick?: (sectionId: string) => void;
  visualizationSettings?: VisualizationSettings;
}

export interface AchievementSystemProps extends BaseComponentProps {
  userStats: UserStats;
  showMilestones?: boolean;
  onAchievementUnlock?: (achievement: Achievement) => void;
  achievements?: Achievement[];
  milestones?: Milestone[];
}

export interface MobileProfileVisualizerProps extends BaseComponentProps {
  completenessData: ProfileCompleteness;
  enableHapticFeedback?: boolean;
  enableAudioFeedback?: boolean;
  onSectionInteraction?: (sectionId: string, interactionType: string) => void;
  mobileOptimization?: MobileOptimization;
}

export interface RealTimeProfileTrackerProps extends BaseComponentProps {
  userId: string;
  updateInterval?: number;
  showNotifications?: boolean;
  onMetricUpdate?: (metric: ProfileMetric) => void;
  onAchievementUnlock?: (achievement: Achievement) => void;
  notificationSettings?: NotificationSettings;
}

export interface EnhancedProfileDashboardProps extends BaseComponentProps {
  userId: string;
  completenessData?: ProfileCompleteness;
  initialPreferences?: Partial<DashboardPreferences>;
  onPreferencesChange?: (preferences: DashboardPreferences) => void;
  eventHandlers?: EventHandlers;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Constants and enums
export const ACHIEVEMENT_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export const METRIC_TRENDS = ['up', 'down', 'stable'] as const;
export const GESTURE_TYPES = ['tap', 'double_tap', 'long_press', 'swipe', 'pinch', 'rotate'] as const;
export const COMPONENT_TYPES = ['3d', 'achievements', 'mobile', 'realtime', 'classic'] as const;

// Validation schemas (for runtime type checking)
export interface ValidationSchema<T> {
  validate: (value: unknown) => value is T;
  errors: string[];
}

// Export default configuration objects
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  layout: 'grid',
  theme: 'light',
  showAnimations: true,
  enableNotifications: true,
  enableRealTime: true,
  mobileOptimized: false,
  compactMode: false,
  autoRefresh: true,
  refreshInterval: 30000,
  defaultView: '3d'
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  achievements: true,
  milestones: true,
  metrics: false,
  warnings: true,
  sound: false,
  vibration: true,
  desktop: true,
  email: false
};

export const DEFAULT_ACCESSIBILITY_FEATURES: AccessibilityFeatures = {
  screenReaderSupport: true,
  keyboardNavigation: true,
  highContrastMode: false,
  reducedMotion: false,
  fontSize: 'medium',
  focusIndicators: true
};