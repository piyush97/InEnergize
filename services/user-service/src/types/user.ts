// User Management Types and Interfaces

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionLevel: SubscriptionLevel;
  mfaEnabled: boolean;
  emailVerified: boolean;
  linkedinConnected: boolean;
  profileImageUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionLevel {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export interface UserProfile {
  id: string;
  userId: string;
  timezone: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSettings {
  email: {
    marketing: boolean;
    security: boolean;
    features: boolean;
    reports: boolean;
  };
  push: {
    enabled: boolean;
    marketing: boolean;
    security: boolean;
    features: boolean;
  };
  inApp: {
    enabled: boolean;
    sound: boolean;
  };
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'connections';
  searchable: boolean;
  allowAnalytics: boolean;
  shareUsageData: boolean;
}

export interface UserPreferences {
  autoPost: boolean;
  optimalPostTimes: string[];
  contentCategories: string[];
  aiSuggestions: boolean;
  linkedinConnections: {
    autoAccept: boolean;
    personalize: boolean;
    maxDaily: number;
  };
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  timezone?: string;
  language?: string;
  theme?: 'light' | 'dark' | 'system';
}

export interface UpdateProfileRequest {
  notifications?: Partial<NotificationSettings>;
  privacy?: Partial<PrivacySettings>;
  preferences?: Partial<UserPreferences>;
}

export interface UserResponse {
  success: boolean;
  user?: User;
  profile?: UserProfile;
  message?: string;
}

export interface UsersResponse {
  success: boolean;
  users?: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  message?: string;
}

export interface SubscriptionUsage {
  userId: string;
  subscriptionLevel: SubscriptionLevel;
  limits: SubscriptionLimits;
  usage: CurrentUsage;
  resetDate: Date;
}

export interface SubscriptionLimits {
  linkedinConnections: number;
  aiGenerations: number;
  scheduledPosts: number;
  analyticsHistory: number; // days
  profileAnalyses: number;
  exportReports: number;
}

export interface CurrentUsage {
  linkedinConnections: number;
  aiGenerations: number;
  scheduledPosts: number;
  profileAnalyses: number;
  exportReports: number;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  subscriptionBreakdown: Record<SubscriptionLevel, number>;
  newUsers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  linkedinConnected: number;
  mfaEnabled: number;
}

export interface BulkUserOperation {
  operation: 'update' | 'delete' | 'suspend';
  userIds: string[];
  data?: any;
  reason?: string;
}

export interface UserSearchQuery {
  q?: string; // search query
  email?: string;
  subscriptionLevel?: SubscriptionLevel;
  linkedinConnected?: boolean;
  mfaEnabled?: boolean;
  emailVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Default subscription limits
export const SUBSCRIPTION_LIMITS: Record<SubscriptionLevel, SubscriptionLimits> = {
  [SubscriptionLevel.FREE]: {
    linkedinConnections: 10,
    aiGenerations: 5,
    scheduledPosts: 3,
    analyticsHistory: 7,
    profileAnalyses: 2,
    exportReports: 1,
  },
  [SubscriptionLevel.BASIC]: {
    linkedinConnections: 50,
    aiGenerations: 25,
    scheduledPosts: 15,
    analyticsHistory: 30,
    profileAnalyses: 10,
    exportReports: 5,
  },
  [SubscriptionLevel.PRO]: {
    linkedinConnections: 200,
    aiGenerations: 100,
    scheduledPosts: 50,
    analyticsHistory: 90,
    profileAnalyses: 50,
    exportReports: 20,
  },
  [SubscriptionLevel.ENTERPRISE]: {
    linkedinConnections: 1000,
    aiGenerations: 500,
    scheduledPosts: 200,
    analyticsHistory: 365,
    profileAnalyses: 200,
    exportReports: 100,
  },
};

// Default user preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
  autoPost: false,
  optimalPostTimes: ['09:00', '13:00', '17:00'],
  contentCategories: ['professional', 'industry'],
  aiSuggestions: true,
  linkedinConnections: {
    autoAccept: false,
    personalize: true,
    maxDaily: 10,
  },
};

// Default notification settings
export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  email: {
    marketing: false,
    security: true,
    features: true,
    reports: true,
  },
  push: {
    enabled: false,
    marketing: false,
    security: true,
    features: false,
  },
  inApp: {
    enabled: true,
    sound: false,
  },
};

// Default privacy settings
export const DEFAULT_PRIVACY: PrivacySettings = {
  profileVisibility: 'private',
  searchable: false,
  allowAnalytics: true,
  shareUsageData: false,
};