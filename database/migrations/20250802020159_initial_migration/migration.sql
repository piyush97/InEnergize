-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('POST', 'ARTICLE', 'POLL', 'VIDEO', 'CAROUSEL', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'CAROUSEL');

-- CreateEnum
CREATE TYPE "AutomationType" AS ENUM ('AUTO_LIKE', 'AUTO_COMMENT', 'AUTO_CONNECT', 'AUTO_POST', 'AUTO_SHARE', 'AUTO_MESSAGE');

-- CreateEnum
CREATE TYPE "FrequencyType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('LIKE', 'COMMENT', 'SHARE', 'CONNECT', 'MESSAGE', 'VIEW', 'FOLLOW');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('POST', 'PROFILE', 'COMMENT', 'ARTICLE', 'COMPANY');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('PROFILE_VIEWS', 'POST_IMPRESSIONS', 'ENGAGEMENT_RATE', 'CONNECTION_GROWTH', 'CONTENT_PERFORMANCE', 'API_USAGE', 'AUTOMATION_EXECUTIONS');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'CONTENT_PUBLISHED', 'AUTOMATION_COMPLETED', 'ENGAGEMENT_RECEIVED', 'CONNECTION_REQUEST', 'MILESTONE_ACHIEVED', 'ERROR_ALERT', 'QUOTA_WARNING');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BannerStyle" AS ENUM ('NATURAL', 'VIVID');

-- CreateEnum
CREATE TYPE "VariationType" AS ENUM ('STYLE', 'COLOR', 'TEXT', 'LAYOUT', 'BRANDING');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('PROFESSIONAL', 'CREATIVE', 'MINIMALIST', 'CORPORATE', 'STARTUP', 'PERSONAL_BRAND');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "profileImage" TEXT,
    "emailVerified" TIMESTAMP(3),
    "hashedPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinId" TEXT NOT NULL,
    "linkedinUrl" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "profileImageUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "connectionCount" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoPostEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoEngageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "linkedin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinProfileId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaType" "MediaType",
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "clickThroughRate" DOUBLE PRECISION,
    "engagementRate" DOUBLE PRECISION,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "industry" TEXT NOT NULL,
    "style" "BannerStyle" NOT NULL DEFAULT 'NATURAL',
    "prompt" TEXT NOT NULL,
    "dalleModel" TEXT NOT NULL DEFAULT 'dall-e-3',
    "generationId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageData" TEXT,
    "format" TEXT NOT NULL DEFAULT 'PNG',
    "fileSize" INTEGER NOT NULL,
    "dimensions" JSONB NOT NULL,
    "branding" JSONB,
    "textElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "colorScheme" TEXT,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isLinkedInCompliant" BOOLEAN NOT NULL DEFAULT true,
    "altTexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generationCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_variations" (
    "id" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variationType" "VariationType" NOT NULL DEFAULT 'STYLE',
    "prompt" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageData" TEXT,
    "format" TEXT NOT NULL DEFAULT 'PNG',
    "fileSize" INTEGER NOT NULL,
    "dimensions" JSONB NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "userRating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banner_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL DEFAULT 'PROFESSIONAL',
    "promptTemplate" TEXT NOT NULL,
    "colorSchemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "designElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previewImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedinProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "AutomationType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerConditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "frequency" "FrequencyType" NOT NULL,
    "timeSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxExecutionsPerDay" INTEGER NOT NULL DEFAULT 10,
    "executionsToday" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_activities" (
    "id" TEXT NOT NULL,
    "linkedinProfileId" TEXT NOT NULL,
    "activityType" "EngagementType" NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUrl" TEXT,
    "message" TEXT,
    "isSuccessful" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "metricUnit" TEXT,
    "context" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_profiles_linkedinId_key" ON "linkedin_profiles"("linkedinId");

-- CreateIndex
CREATE UNIQUE INDEX "banners_generationId_key" ON "banners"("generationId");

-- CreateIndex
CREATE INDEX "banners_userId_createdAt_idx" ON "banners"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "banners_industry_idx" ON "banners"("industry");

-- CreateIndex
CREATE INDEX "banners_isPublic_idx" ON "banners"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "banner_variations_generationId_key" ON "banner_variations"("generationId");

-- CreateIndex
CREATE INDEX "banner_variations_bannerId_idx" ON "banner_variations"("bannerId");

-- CreateIndex
CREATE INDEX "banner_templates_industry_idx" ON "banner_templates"("industry");

-- CreateIndex
CREATE INDEX "banner_templates_category_idx" ON "banner_templates"("category");

-- CreateIndex
CREATE INDEX "banner_templates_isActive_idx" ON "banner_templates"("isActive");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkedin_profiles" ADD CONSTRAINT "linkedin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_linkedinProfileId_fkey" FOREIGN KEY ("linkedinProfileId") REFERENCES "linkedin_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_variations" ADD CONSTRAINT "banner_variations_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_linkedinProfileId_fkey" FOREIGN KEY ("linkedinProfileId") REFERENCES "linkedin_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_activities" ADD CONSTRAINT "engagement_activities_linkedinProfileId_fkey" FOREIGN KEY ("linkedinProfileId") REFERENCES "linkedin_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
