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
  // Enhanced profile fields for better completeness scoring
  certifications?: LinkedInCertification[];
  languages?: LinkedInLanguage[];
  projects?: LinkedInProject[];
  honors?: LinkedInHonor[];
  patents?: LinkedInPatent[];
  publications?: LinkedInPublication[];
  courses?: LinkedInCourse[];
  volunteerExperience?: LinkedInVolunteerExperience[];
  recommendations?: LinkedInRecommendation[];
  connectionCount?: number;
  followerCount?: number;
  vanityName?: string; // Custom LinkedIn URL
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

// Profile Optimization Suggestion Types
export interface OptimizationSuggestion {
  id: string;
  field: string;
  category: 'content' | 'engagement' | 'visibility' | 'networking';
  priority: 'high' | 'medium' | 'low';
  impact: number; // Expected impact on profile score (1-20 points)
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate: string; // Human-readable time estimate
  title: string;
  description: string;
  actionSteps: string[];
  complianceNotes?: string[];
  currentValue?: string;
  suggestedValue?: string;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptimizationSuggestionRequest {
  profileId?: string;
  categories?: Array<'content' | 'engagement' | 'visibility' | 'networking'>;
  priorities?: Array<'high' | 'medium' | 'low'>;
  maxSuggestions?: number;
  includeCompleted?: boolean;
}

export interface OptimizationSuggestionResponse {
  suggestions: OptimizationSuggestion[];
  totalCount: number;
  completedCount: number;
  potentialScoreIncrease: number;
  estimatedTimeToComplete: string;
  nextRecommendedAction?: OptimizationSuggestion;
}

export interface AISuggestionRequest {
  field: string;
  currentContent?: string;
  targetAudience?: string;
  industry?: string;
  tone?: 'professional' | 'casual' | 'creative' | 'executive';
  maxLength?: number;
  includeKeywords?: string[];
}

export interface AISuggestionResponse {
  suggestions: string[];
  originalContent?: string;
  improvementRationale: string;
  keywordOptimization: string[];
  complianceNotes: string[];
  estimatedImpact: number;
  generatedAt: Date;
}

export interface SuggestionCompletionRequest {
  suggestionId: string;
  implementedValue?: string;
  feedback?: string;
  partialCompletion?: boolean;
}

export interface SuggestionCompletionResponse {
  suggestion: OptimizationSuggestion;
  profileScoreChange: number;
  newProfileScore: number;
  nextRecommendations: OptimizationSuggestion[];
  completedAt: Date;
}

export interface LinkedInAPIResponse<T> {
  data?: T;
  success: boolean;
  error?: {
    message: string;
    code: string;
    details?: any;
    userMessage?: string;
    httpStatus?: number;
    linkedinError?: string;
    timestamp?: string;
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

// Enhanced LinkedIn Profile Field Interfaces
export interface LinkedInCertification {
  id?: string;
  name: string;
  authority: string;
  url?: string;
  licenseNumber?: string;
  startDate?: {
    month?: number;
    year: number;
  };
  endDate?: {
    month?: number;
    year: number;
  };
}

export interface LinkedInLanguage {
  id?: string;
  name: string;
  proficiency: 'ELEMENTARY' | 'LIMITED_WORKING' | 'PROFESSIONAL_WORKING' | 'FULL_PROFESSIONAL' | 'NATIVE_OR_BILINGUAL';
}

export interface LinkedInProject {
  id?: string;
  name: string;
  description?: string;
  url?: string;
  startDate?: {
    month?: number;
    year: number;
  };
  endDate?: {
    month?: number;
    year: number;
  };
  members?: Array<{
    name: string;
    profileUrl?: string;
  }>;
}

export interface LinkedInHonor {
  id?: string;
  name: string;
  issuer?: string;
  issueDate?: {
    month?: number;
    year: number;
  };
  description?: string;
}

export interface LinkedInPatent {
  id?: string;
  title: string;
  summary?: string;
  number?: string;
  status?: string;
  office?: {
    name: string;
  };
  inventors?: Array<{
    name: string;
  }>;
  date?: {
    month?: number;
    year: number;
  };
  url?: string;
}

export interface LinkedInPublication {
  id?: string;
  name: string;
  publisher?: {
    name: string;
  };
  publishedDate?: {
    month?: number;
    year: number;
  };
  description?: string;
  url?: string;
  authors?: Array<{
    name: string;
  }>;
}

export interface LinkedInCourse {
  id?: string;
  name: string;
  number?: string;
  description?: string;
}

export interface LinkedInVolunteerExperience {
  id?: string;
  role: string;
  organization: {
    name: string;
  };
  cause?: string;
  description?: string;
  startDate?: {
    month?: number;
    year: number;
  };
  endDate?: {
    month?: number;
    year: number;
  };
}

export interface LinkedInRecommendation {
  id?: string;
  recommendationType: 'GIVEN' | 'RECEIVED';
  recommender?: {
    firstName: string;
    lastName: string;
    headline?: string;
  };
  recommendee?: {
    firstName: string;
    lastName: string;
    headline?: string;
  };
  text: string;
  createdAt: Date;
}

// Enhanced Profile Completeness Interface
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
    // Enhanced completeness categories
    certifications: number;
    languages: number;
    projects: number;
    volunteerWork: number;
    recommendations: number;
    customUrl: number;
  };
  suggestions: string[];
  missingFields: string[];
  priorityImprovements: Array<{
    field: string;
    impact: number;
    difficulty: 'easy' | 'medium' | 'hard';
    timeEstimate: string;
    suggestion: string;
  }>;
}