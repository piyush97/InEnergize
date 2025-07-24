-- Migration: 001_initial_schema
-- Created: 2024-01-XX
-- Description: Initial database schema for InErgize platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
DO $$ 
BEGIN
  -- Subscription tiers
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionTier') THEN
    CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');
  END IF;
  
  -- Content types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContentType') THEN
    CREATE TYPE "ContentType" AS ENUM ('POST', 'ARTICLE', 'POLL', 'VIDEO', 'CAROUSEL', 'DOCUMENT');
  END IF;
  
  -- Content status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContentStatus') THEN
    CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'FAILED');
  END IF;
  
  -- Media types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaType') THEN
    CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL');
  END IF;
  
  -- Automation types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AutomationType') THEN
    CREATE TYPE "AutomationType" AS ENUM ('AUTO_LIKE', 'AUTO_COMMENT', 'AUTO_CONNECT', 'AUTO_POST', 'AUTO_SHARE', 'AUTO_MESSAGE');
  END IF;
  
  -- Frequency types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FrequencyType') THEN
    CREATE TYPE "FrequencyType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');
  END IF;
  
  -- Engagement types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EngagementType') THEN
    CREATE TYPE "EngagementType" AS ENUM ('LIKE', 'COMMENT', 'SHARE', 'CONNECT', 'MESSAGE', 'VIEW', 'FOLLOW');
  END IF;
  
  -- Target types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TargetType') THEN
    CREATE TYPE "TargetType" AS ENUM ('POST', 'PROFILE', 'COMMENT', 'ARTICLE', 'COMPANY');
  END IF;
  
  -- Metric types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MetricType') THEN
    CREATE TYPE "MetricType" AS ENUM ('PROFILE_VIEWS', 'POST_IMPRESSIONS', 'ENGAGEMENT_RATE', 'CONNECTION_GROWTH', 'CONTENT_PERFORMANCE', 'API_USAGE', 'AUTOMATION_EXECUTIONS');
  END IF;
  
  -- Notification types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'CONTENT_PUBLISHED', 'AUTOMATION_COMPLETED', 'ENGAGEMENT_RECEIVED', 'CONNECTION_REQUEST', 'MILESTONE_ACHIEVED', 'ERROR_ALERT', 'QUOTA_WARNING');
  END IF;
  
  -- Notification priorities
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPriority') THEN
    CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  email TEXT UNIQUE NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "profileImage" TEXT,
  "emailVerified" TIMESTAMP(3),
  "hashedPassword" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table (OAuth)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "sessionToken" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  expires TIMESTAMP(3) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- LinkedIn profiles table
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL,
  "linkedinId" TEXT UNIQUE NOT NULL,
  "linkedinUrl" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  headline TEXT,
  summary TEXT,
  industry TEXT,
  location TEXT,
  "profileImageUrl" TEXT,
  "backgroundImageUrl" TEXT,
  "connectionCount" INTEGER NOT NULL DEFAULT 0,
  "followerCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "autoPostEnabled" BOOLEAN NOT NULL DEFAULT false,
  "autoEngageEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" TIMESTAMP(3),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Content items table
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL,
  "linkedinProfileId" TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  "contentType" "ContentType" NOT NULL,
  status "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "mediaUrls" TEXT[] DEFAULT '{}',
  "mediaType" "MediaType",
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  "clickThroughRate" REAL,
  "engagementRate" REAL,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "aiPrompt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("linkedinProfileId") REFERENCES linkedin_profiles(id) ON DELETE SET NULL
);

-- Automation rules table
CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL,
  "linkedinProfileId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "ruleType" "AutomationType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "triggerConditions" JSONB NOT NULL,
  actions JSONB NOT NULL,
  frequency "FrequencyType" NOT NULL,
  "timeSlots" TEXT[] DEFAULT '{}',
  "maxExecutionsPerDay" INTEGER NOT NULL DEFAULT 10,
  "executionsToday" INTEGER NOT NULL DEFAULT 0,
  "lastExecutedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY ("linkedinProfileId") REFERENCES linkedin_profiles(id) ON DELETE CASCADE
);

-- Engagement activities table
CREATE TABLE IF NOT EXISTS engagement_activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "linkedinProfileId" TEXT NOT NULL,
  "activityType" "EngagementType" NOT NULL,
  "targetType" "TargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetUrl" TEXT,
  message TEXT,
  "isSuccessful" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("linkedinProfileId") REFERENCES linkedin_profiles(id) ON DELETE CASCADE
);

-- Usage metrics table
CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL,
  "metricType" "MetricType" NOT NULL,
  "metricValue" REAL NOT NULL,
  "metricUnit" TEXT,
  context JSONB,
  timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type "NotificationType" NOT NULL,
  priority "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  "actionUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create unique constraints
ALTER TABLE accounts ADD CONSTRAINT accounts_provider_providerAccountId_key 
  UNIQUE (provider, "providerAccountId");

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users("subscriptionTier");
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users("createdAt");

CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_sessionToken ON sessions("sessionToken");

CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_userId ON linkedin_profiles("userId");
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_linkedinId ON linkedin_profiles("linkedinId");
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_active ON linkedin_profiles("isActive");

CREATE INDEX IF NOT EXISTS idx_content_items_userId ON content_items("userId");
CREATE INDEX IF NOT EXISTS idx_content_items_linkedinProfileId ON content_items("linkedinProfileId");
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_scheduledAt ON content_items("scheduledAt");
CREATE INDEX IF NOT EXISTS idx_content_items_publishedAt ON content_items("publishedAt");
CREATE INDEX IF NOT EXISTS idx_content_items_contentType ON content_items("contentType");

CREATE INDEX IF NOT EXISTS idx_automation_rules_userId ON automation_rules("userId");
CREATE INDEX IF NOT EXISTS idx_automation_rules_linkedinProfileId ON automation_rules("linkedinProfileId");
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules("isActive");
CREATE INDEX IF NOT EXISTS idx_automation_rules_lastExecuted ON automation_rules("lastExecutedAt");

CREATE INDEX IF NOT EXISTS idx_engagement_activities_linkedinProfileId ON engagement_activities("linkedinProfileId");
CREATE INDEX IF NOT EXISTS idx_engagement_activities_type ON engagement_activities("activityType");
CREATE INDEX IF NOT EXISTS idx_engagement_activities_createdAt ON engagement_activities("createdAt");

CREATE INDEX IF NOT EXISTS idx_usage_metrics_userId ON usage_metrics("userId");
CREATE INDEX IF NOT EXISTS idx_usage_metrics_type ON usage_metrics("metricType");
CREATE INDEX IF NOT EXISTS idx_usage_metrics_timestamp ON usage_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications("userId");
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications("isRead");
CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications("createdAt");

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER linkedin_profiles_updated_at BEFORE UPDATE ON linkedin_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER content_items_updated_at BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();