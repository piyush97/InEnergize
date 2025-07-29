import { LinkedInProfile, ProfileCompleteness } from './linkedin';

// =====================================================
// Core AI Service Types
// =====================================================

export interface AIServiceConfig {
  openaiApiKey: string;
  maxTokens: number;
  temperature: number;
  model: string;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface AIRequest {
  userId: string;
  type: AIRequestType;
  input: any;
  options?: AIRequestOptions;
}

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  usage?: OpenAIUsage;
  requestId: string;
  timestamp: Date;
}

export enum AIRequestType {
  PROFILE_OPTIMIZATION = 'profile_optimization',
  HEADLINE_GENERATION = 'headline_generation',
  SUMMARY_GENERATION = 'summary_generation',
  CONTENT_GENERATION = 'content_generation',
  SKILL_SUGGESTIONS = 'skill_suggestions',
  BANNER_GENERATION = 'banner_generation',
  POST_CREATION = 'post_creation',
  CAROUSEL_CREATION = 'carousel_creation'
}

export interface AIRequestOptions {
  tone?: 'professional' | 'casual' | 'enthusiastic' | 'authoritative';
  industry?: string;
  targetAudience?: string;
  keywords?: string[];
  maxLength?: number;
  variations?: number;
  includeEmojis?: boolean;
  language?: string;
}

export interface OpenAIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// =====================================================
// Profile Optimization Types
// =====================================================

export interface ProfileOptimizationRequest {
  linkedinProfile: LinkedInProfile;
  completenessData: ProfileCompleteness;
  targetRole?: string;
  industry?: string;
  careerLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  goals?: string[];
}

export interface ProfileOptimizationResponse {
  overallScore: number; // 0-100
  recommendations: ProfileRecommendation[];
  prioritizedActions: PrioritizedAction[];
  estimatedImpact: {
    profileViews: number;
    connectionAcceptance: number;
    recruiterInterest: number;
  };
}

export interface ProfileRecommendation {
  field: string;
  currentValue?: string;
  suggestedValue: string;
  reasoning: string;
  impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'basic' | 'advanced' | 'expert';
}

export interface PrioritizedAction {
  title: string;
  description: string;
  priority: number; // 1-10
  estimatedTime: string;
  impact: 'high' | 'medium' | 'low';
  field: string;
}

// =====================================================
// Content Generation Types
// =====================================================

export interface ContentGenerationRequest {
  type: ContentType;
  topic?: string;
  industry?: string;
  tone?: string;
  targetAudience?: string;
  keywords?: string[];
  linkedinProfile?: LinkedInProfile;
  customPrompt?: string;
}

export interface ContentGenerationResponse {
  content: GeneratedContent[];
  metadata: ContentMetadata;
}

export enum ContentType {
  LINKEDIN_POST = 'linkedin_post',
  ARTICLE = 'article',
  CAROUSEL_SLIDE = 'carousel_slide',
  COMMENT = 'comment',
  CONNECTION_MESSAGE = 'connection_message',
  THANK_YOU_MESSAGE = 'thank_you_message'
}

export interface GeneratedContent {
  id: string;
  content: string;
  variant: number;
  score: number; // AI confidence score 0-100
  hashtags?: string[];
  callToAction?: string;
  estimatedEngagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface ContentMetadata {
  wordCount: number;
  characterCount: number;
  readabilityScore: number;
  sentimentScore: number;
  keyThemes: string[];
  complianceCheck: {
    passed: boolean;
    issues?: string[];
  };
}

// =====================================================
// Headline & Summary Generation Types
// =====================================================

export interface HeadlineGenerationRequest {
  linkedinProfile: LinkedInProfile;
  targetRole?: string;
  industry?: string;
  keywords?: string[];
  tone?: 'professional' | 'creative' | 'results-focused';
  includeMetrics?: boolean;
}

export interface HeadlineGenerationResponse {
  headlines: GeneratedHeadline[];
  analysis: HeadlineAnalysis;
}

export interface GeneratedHeadline {
  id: string;
  text: string;
  length: number;
  score: number;
  strengths: string[];
  keywords: string[];
  variant: 'standard' | 'creative' | 'metric-focused';
}

export interface HeadlineAnalysis {
  optimalLength: number;
  keywordDensity: number;
  industryRelevance: number;
  uniquenessScore: number;
  recommendations: string[];
}

export interface SummaryGenerationRequest {
  linkedinProfile: LinkedInProfile;
  targetRole?: string;
  achievements?: string[];
  careerGoals?: string[];
  personalBrand?: string;
  tone?: 'narrative' | 'bullet-points' | 'achievement-focused';
}

export interface SummaryGenerationResponse {
  summaries: GeneratedSummary[];
  analysis: SummaryAnalysis;
}

export interface GeneratedSummary {
  id: string;
  text: string;
  wordCount: number;
  score: number;
  structure: 'narrative' | 'bullet-points' | 'hybrid';
  keyPoints: string[];
}

export interface SummaryAnalysis {
  optimalLength: number;
  keywordOptimization: number;
  storytellingScore: number;
  callToActionStrength: number;
  recommendations: string[];
}

// =====================================================
// Skill & Industry Analysis Types
// =====================================================

export interface SkillSuggestionRequest {
  linkedinProfile: LinkedInProfile;
  targetRole?: string;
  industry?: string;
  includeEmerging?: boolean;
  maxSuggestions?: number;
}

export interface SkillSuggestionResponse {
  suggestedSkills: SuggestedSkill[];
  skillGaps: SkillGap[];
  industryTrends: IndustryTrend[];
}

export interface SuggestedSkill {
  name: string;
  category: 'technical' | 'soft' | 'industry-specific' | 'leadership';
  relevanceScore: number;
  demandLevel: 'high' | 'medium' | 'low';
  currentTrend: 'rising' | 'stable' | 'declining';
  reasoning: string;
}

export interface SkillGap {
  requiredSkill: string;
  currentLevel: number; // 0-10
  targetLevel: number; // 0-10
  priority: 'critical' | 'important' | 'nice-to-have';
  learningResources?: string[];
}

export interface IndustryTrend {
  skill: string;
  growth: number; // percentage
  demand: number; // relative demand score
  timeframe: string;
  source: string;
}

// =====================================================
// Banner & Visual Content Types
// =====================================================

export interface BannerGenerationRequest {
  industry: string;
  style?: 'natural' | 'vivid';
  branding?: BrandingOptions;
  textElements?: string[];
  colorScheme?: string;
  additionalContext?: string;
  userId?: string;
}

export interface BrandingOptions {
  companyName?: string;
  role?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface BannerGenerationResult {
  id: string;
  imageUrl: string;
  imageData: string; // base64 encoded
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  fileSize: number;
  prompt: string;
  altTexts: string[];
  metadata: BannerMetadata;
  usage: OpenAIUsage;
  isLinkedInCompliant: boolean;
  qualityScore: number;
}

export interface BannerMetadata {
  industry: string;
  style?: string;
  generatedAt: Date;
  dalleModel: string;
  version: string;
}

export interface BannerTemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  colorSchemes: string[];
  designElements: string[];
  keywords: string[];
  professionalTone: string;
}

export interface IndustryTemplate {
  keywords: string[];
  colorSchemes: string[];
  designElements: string[];
  professionalTone: string;
}

// Legacy types for backward compatibility
export interface BannerGenerationResponse {
  banners: GeneratedBanner[];
  designGuidelines: DesignGuidelines;
}

export interface GeneratedBanner {
  id: string;
  imageUrl: string;
  style: string;
  dimensions: {
    width: number;
    height: number;
  };
  description: string;
  designElements: string[];
}

export interface DesignGuidelines {
  colorPalette: string[];
  typography: string[];
  composition: string;
  brandAlignment: number; // 0-100
  recommendations: string[];
}

// =====================================================
// Analytics & Performance Types
// =====================================================

export interface AIUsageMetrics {
  userId: string;
  requestType: AIRequestType;
  timestamp: Date;
  tokensUsed: number;
  responseTime: number;
  success: boolean;
  cost?: number;
}

export interface AIPerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  successRate: number;
  tokenUsage: {
    total: number;
    byType: Record<AIRequestType, number>;
  };
  costAnalysis: {
    total: number;
    byType: Record<AIRequestType, number>;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}

// =====================================================
// Error Types
// =====================================================

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class OpenAIError extends AIServiceError {
  constructor(message: string, details?: any) {
    super(message, 'OPENAI_ERROR', 502, details);
    this.name = 'OpenAIError';
  }
}

export class RateLimitError extends AIServiceError {
  constructor(message: string, resetTime?: Date) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { resetTime });
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends AIServiceError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400, { field });
    this.name = 'ValidationError';
  }
}

// =====================================================
// Authentication & Authorization Types
// =====================================================

export interface AuthenticatedAIRequest extends AIRequest {
  user: {
    id: string;
    email: string;
    subscriptionLevel: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  };
  rateLimitInfo: {
    remaining: number;
    resetTime: Date;
    dailyLimit: number;
  };
}

export interface SubscriptionLimits {
  FREE: {
    requestsPerDay: number;
    maxTokensPerRequest: number;
    allowedTypes: AIRequestType[];
  };
  BASIC: {
    requestsPerDay: number;
    maxTokensPerRequest: number;
    allowedTypes: AIRequestType[];
  };
  PRO: {
    requestsPerDay: number;
    maxTokensPerRequest: number;
    allowedTypes: AIRequestType[];
  };
  ENTERPRISE: {
    requestsPerDay: number;
    maxTokensPerRequest: number;
    allowedTypes: AIRequestType[];
  };
}