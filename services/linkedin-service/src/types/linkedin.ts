// LinkedIn Integration Types and Interfaces

export interface LinkedInOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface LinkedInTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export interface LinkedInProfile {
  id: string;
  firstName: {
    localized: { [key: string]: string };
    preferredLocale: { country: string; language: string };
  };
  lastName: {
    localized: { [key: string]: string };
    preferredLocale: { country: string; language: string };
  };
  profilePicture?: {
    displayImage: string;
    'displayImage~': {
      elements: Array<{
        identifiers: Array<{ identifier: string }>;
        data: { 'com.linkedin.digitalmedia.mediaartifact.StillImage': any };
      }>;
    };
  };
  headline?: string;
  summary?: string;
  industry?: string;
  location?: {
    country: string;
    postalCode: string;
  };
  positions?: LinkedInPosition[];
  educations?: LinkedInEducation[];
  skills?: LinkedInSkill[];
  publicProfileUrl?: string;
  emailAddress?: string;
}

export interface LinkedInPosition {
  id?: string;
  title: string;
  company: {
    name: string;
    id?: string;
    industry?: string;
    size?: string;
  };
  location?: {
    name: string;
    country?: string;
  };
  description?: string;
  startDate: {
    month?: number;
    year: number;
  };
  endDate?: {
    month?: number;
    year: number;
  };
  isCurrent: boolean;
}

export interface LinkedInEducation {
  id?: string;
  schoolName: string;
  fieldOfStudy?: string;
  degree?: string;
  grade?: string;
  activities?: string;
  notes?: string;
  startDate?: {
    month?: number;
    year: number;
  };
  endDate?: {
    month?: number;
    year: number;
  };
}

export interface LinkedInSkill {
  id?: string;
  name: string;
  endorsementCount?: number;
}

export interface ProfileCompleteness {
  score: number; // 0-100
  breakdown: {
    basicInfo: number;
    headline: number;
    summary: number;
    experience: number;
    education: number;
    skills: number;
    profilePicture: number;
    connections: number;
  };
  suggestions: string[];
  missingFields: string[];
}

export interface LinkedInAnalytics {
  profileViews: {
    total: number;
    change: number;
    period: string;
  };
  searchAppearances: {
    total: number;
    change: number;
    period: string;
  };
  postViews: {
    total: number;
    change: number;
    period: string;
  };
  connectionGrowth: {
    total: number;
    change: number;
    period: string;
  };
  industryRank?: number;
  keywordRankings?: Array<{
    keyword: string;
    position: number;
    change: number;
  }>;
}

export interface LinkedInConnection {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
  publicProfileUrl?: string;
  industry?: string;
  location?: string;
  connectionDate: Date;
  mutualConnections?: number;
}

export interface LinkedInMessage {
  id: string;
  conversationId: string;
  from: string;
  to: string[];
  subject?: string;
  body: string;
  sentAt: Date;
  readAt?: Date;
  messageType: 'MEMBER_TO_MEMBER' | 'SPONSORED';
}

export interface LinkedInPost {
  id: string;
  authorId: string;
  text?: string;
  title?: string;
  content?: {
    media?: Array<{
      type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
      url: string;
      title?: string;
      description?: string;
    }>;
  };
  publishedAt: Date;
  visibility: 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN_ONLY';
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  hashtags?: string[];
}

export interface RateLimitInfo {
  endpoint: string;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface LinkedInAPIResponse<T> {
  data?: T;
  success: boolean;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  rateLimitInfo?: RateLimitInfo;
}

export interface ConnectionRequest {
  targetUserId: string;
  message?: string;
  invitationType: 'CONNECT' | 'FOLLOW';
  customMessage?: string;
}

export interface AutomationSettings {
  enabled: boolean;
  maxConnectionRequestsPerDay: number;
  maxMessagesPerDay: number;
  maxProfileViewsPerDay: number;
  delayBetweenActions: {
    min: number; // seconds
    max: number; // seconds
  };
  targetCriteria?: {
    industries?: string[];
    locations?: string[];
    companies?: string[];
    jobTitles?: string[];
    keywords?: string[];
  };
  blacklist?: {
    companies?: string[];  
    keywords?: string[];
    userIds?: string[];
  };
}

export interface ComplianceMetrics {
  dailyLimits: {
    connectionRequests: {
      limit: number;
      used: number;
      remaining: number;
    };
    messages: {
      limit: number;
      used: number;
      remaining: number;
    };
    profileViews: {
      limit: number;
      used: number;
      remaining: number;
    };
  };
  accountHealth: {
    score: number; // 0-100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    warnings: string[];
  };
  recentActivity: Array<{
    action: string;
    timestamp: Date;
    target?: string;
    success: boolean;
    riskScore: number;
  }>;
}

export interface LinkedInServiceConfig {
  oauth: LinkedInOAuthConfig;
  rateLimit: {
    conservativeMode: boolean;
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
    retryAttempts: number;
    backoffMultiplier: number;
  };
  automation: {
    enabled: boolean;
    safetyChecks: boolean;
    maxDailyActions: number;
    humanLikeDelays: boolean;
  };
  compliance: {
    strictMode: boolean;
    monitoringEnabled: boolean;
    alertThresholds: {
      dailyActions: number;
      errorRate: number;
      suspiciousActivity: number;
    };
  };
}

// Database Models for LinkedIn data storage
export interface LinkedInAccountModel {
  id: string;
  userId: string;
  linkedinId: string;
  accessToken: string; // encrypted
  refreshToken?: string; // encrypted
  tokenExpiresAt: Date;
  scope: string;
  profileData: LinkedInProfile;
  lastSyncAt: Date;
  syncFrequency: number; // hours
  isActive: boolean;
  complianceStatus: 'GOOD' | 'WARNING' | 'RESTRICTED';
  createdAt: Date;
  updatedAt: Date;
}

export interface LinkedInAnalyticsModel {
  id: string;
  linkedinAccountId: string;
  date: Date;
  profileViews: number;
  searchAppearances: number;
  postViews: number;
  connectionGrowth: number;
  engagementRate: number;
  industryRank?: number;
  rawData: any; // Store full analytics response
  createdAt: Date;
}

export interface LinkedInConnectionModel {
  id: string;
  linkedinAccountId: string;
  connectionLinkedinId: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePicture?: string;
  industry?: string;
  location?: string;
  connectionDate: Date;
  connectionType: 'FIRST_DEGREE' | 'SECOND_DEGREE' | 'THIRD_DEGREE';
  mutualConnections: number;
  isActive: boolean;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LinkedInActivityModel {
  id: string;
  linkedinAccountId: string;
  activityType: 'CONNECTION_REQUEST' | 'MESSAGE' | 'PROFILE_VIEW' | 'POST_LIKE' | 'POST_COMMENT' | 'POST_SHARE';
  targetUserId?: string;
  targetUrl?: string;
  content?: string;
  success: boolean;
  error?: string;
  riskScore: number;
  timestamp: Date;
  automationId?: string;
  complianceFlags?: string[];
}

// Error types
export class LinkedInAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'LinkedInAPIError';
  }
}

export class RateLimitError extends LinkedInAPIError {
  constructor(
    message: string,
    public retryAfter: number,
    public endpoint: string
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

export class ComplianceError extends Error {
  constructor(
    message: string,
    public riskLevel: 'MEDIUM' | 'HIGH',
    public action: string
  ) {
    super(message);
    this.name = 'ComplianceError';
  }
}