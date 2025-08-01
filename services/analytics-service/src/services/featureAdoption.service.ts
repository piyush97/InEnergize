import { database } from '@/config/database';
import { redis } from '@/config/redis';
import logger from '@/config/logger';

export interface FeatureUsageEvent {
  userId: string;
  featureName: string;
  featureCategory: 'PROFILE_OPTIMIZATION' | 'CONTENT_CREATION' | 'AUTOMATION' | 'ANALYTICS' |
                  'NETWORKING' | 'AI_TOOLS' | 'INTEGRATIONS' | 'COLLABORATION' | 'EXPORT';
  usageCount?: number;
  timeSpentSeconds?: number;
  success?: boolean;
  errorDetails?: string;
  timestamp?: Date;
}

export interface OnboardingStageEvent {
  userId: string;
  stage: 'SIGNUP' | 'EMAIL_VERIFICATION' | 'PROFILE_SETUP' | 'LINKEDIN_CONNECT' |
         'FIRST_CONTENT_CREATE' | 'FIRST_AUTOMATION_SETUP' | 'FIRST_ANALYTICS_VIEW' |
         'UPGRADE_PROMPT' | 'COMPLETED';
  startedAt?: Date;
  completedAt?: Date;
  abandoned?: boolean;
  abandonmentReason?: string;
  conversionData?: Record<string, any>;
}

export interface FeatureDiscoveryEvent {
  userId: string;
  featureName: string;
  discoveredThrough: string; // 'tooltip', 'menu', 'notification', 'tutorial', 'search'
  discoveryContext?: Record<string, any>;
  usedImmediately?: boolean;
}

export interface FeatureAdoptionAnalytics {
  userId?: string;
  timeRange: { start: Date; end: Date };
  overallAdoption: {
    totalFeatures: number;
    featuresUsed: number;
    adoptionRate: number;
    averageTimeToAdopt: number; // days
  };
  categoryBreakdown: Array<{
    category: string;
    totalFeatures: number;
    adoptedFeatures: number;
    adoptionRate: number;
    avgUsagePerUser: number;
  }>;
  topFeatures: Array<{
    name: string;
    category: string;
    uniqueUsers: number;
    totalUsage: number;
    avgTimeSpent: number;
    successRate: number;
  }>;
  onboardingFunnel: Array<{
    stage: string;
    usersEntered: number;
    usersCompleted: number;
    conversionRate: number;
    avgTimeToComplete: number; // hours
    dropOffReasons: Array<{ reason: string; count: number }>;
  }>;
  featureDiscovery: Array<{
    featureName: string;
    totalDiscoveries: number;
    discoveryMethods: Record<string, number>;
    immediateUsageRate: number;
    avgDaysToFirstUse: number;
  }>;
  userSegmentation: {
    powerUsers: number; // >10 features used
    regularUsers: number; // 3-10 features used
    lightUsers: number; // 1-2 features used
    trialUsers: number; // 0 features used
  };
}

export interface OnboardingAnalytics {
  timeRange: { start: Date; end: Date };
  overallMetrics: {
    totalUsers: number;
    completedOnboarding: number;
    completionRate: number;
    avgTimeToComplete: number; // hours
    dropOffRate: number;
  };
  stageAnalysis: Array<{
    stage: string;
    entered: number;
    completed: number;
    conversionRate: number;
    avgTime: number; // hours
    commonDropOffReasons: string[];
  }>;
  segmentedAnalysis: {
    bySubscriptionTier: Record<string, {
      completionRate: number;
      avgTime: number;
    }>;
    byAcquisitionChannel: Record<string, {
      completionRate: number;
      avgTime: number;
    }>;
  };
  optimizationOpportunities: Array<{
    stage: string;
    issue: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    recommendation: string;
  }>;
}

/**
 * FeatureAdoptionService - Comprehensive feature adoption and onboarding analytics
 * 
 * Tracks feature usage, onboarding progression, and provides insights
 * for product optimization and user activation strategies.
 */
export class FeatureAdoptionService {
  private readonly CACHE_TTL = 600; // 10 minutes
  private readonly FEATURE_CATEGORIES = [
    'PROFILE_OPTIMIZATION', 'CONTENT_CREATION', 'AUTOMATION', 'ANALYTICS',
    'NETWORKING', 'AI_TOOLS', 'INTEGRATIONS', 'COLLABORATION', 'EXPORT'
  ];
  private readonly ONBOARDING_STAGES = [
    'SIGNUP', 'EMAIL_VERIFICATION', 'PROFILE_SETUP', 'LINKEDIN_CONNECT',
    'FIRST_CONTENT_CREATE', 'FIRST_AUTOMATION_SETUP', 'FIRST_ANALYTICS_VIEW',
    'UPGRADE_PROMPT', 'COMPLETED'
  ];

  /**
   * Track feature usage
   */
  async trackFeatureUsage(event: FeatureUsageEvent): Promise<void> {
    try {
      this.validateFeatureEvent(event);

      // Check if this is a first-time usage
      const existingUsage = await this.getExistingFeatureUsage(event.userId, event.featureName);
      const isFirstTime = !existingUsage;

      if (isFirstTime) {
        // Record new feature usage
        const insertQuery = `
          INSERT INTO analytics.feature_usage (
            user_id, feature_name, feature_category, usage_count,
            first_used_at, last_used_at, total_time_spent_seconds,
            success_count, error_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        const values = [
          event.userId,
          event.featureName,
          event.featureCategory,
          event.usageCount || 1,
          event.timestamp || new Date(),
          event.timestamp || new Date(),
          event.timeSpentSeconds || 0,
          event.success !== false ? 1 : 0,
          event.success === false ? 1 : 0
        ];

        await database.query(insertQuery, values);

        // Track feature discovery
        await this.trackFeatureDiscovery({
          userId: event.userId,
          featureName: event.featureName,
          discoveredThrough: 'direct_usage',
          usedImmediately: true
        });

        logger.info('New feature usage tracked', {
          userId: event.userId,
          featureName: event.featureName,
          category: event.featureCategory
        });
      } else {
        // Update existing feature usage
        const updateQuery = `
          UPDATE analytics.feature_usage 
          SET 
            usage_count = usage_count + $1,
            last_used_at = $2,
            total_time_spent_seconds = total_time_spent_seconds + $3,
            success_count = success_count + $4,
            error_count = error_count + $5
          WHERE user_id = $6 AND feature_name = $7
            AND timestamp = (
              SELECT MAX(timestamp) FROM analytics.feature_usage 
              WHERE user_id = $6 AND feature_name = $7
            )
        `;

        const values = [
          event.usageCount || 1,
          event.timestamp || new Date(),
          event.timeSpentSeconds || 0,
          event.success !== false ? 1 : 0,
          event.success === false ? 1 : 0,
          event.userId,
          event.featureName
        ];

        await database.query(updateQuery, values);
      }

      // Update real-time metrics
      await this.updateFeatureMetrics(event);

      logger.debug('Feature usage tracked', {
        userId: event.userId,
        featureName: event.featureName,
        isFirstTime
      });
    } catch (error) {
      logger.error('Failed to track feature usage', { error, event });
      throw error;
    }
  }

  /**
   * Track onboarding stage progression
   */
  async trackOnboardingStage(event: OnboardingStageEvent): Promise<void> {
    try {
      this.validateOnboardingEvent(event);

      const query = `
        INSERT INTO analytics.onboarding_funnel (
          user_id, stage, started_at, completed_at, time_to_complete_seconds,
          abandoned, abandonment_reason, conversion_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, stage, timestamp) 
        DO UPDATE SET
          completed_at = EXCLUDED.completed_at,
          time_to_complete_seconds = EXCLUDED.time_to_complete_seconds,
          abandoned = EXCLUDED.abandoned,
          abandonment_reason = EXCLUDED.abandonment_reason,
          conversion_data = EXCLUDED.conversion_data
      `;

      const timeToComplete = event.startedAt && event.completedAt ? 
        Math.floor((event.completedAt.getTime() - event.startedAt.getTime()) / 1000) : null;

      const values = [
        event.userId,
        event.stage,
        event.startedAt || new Date(),
        event.completedAt || null,
        timeToComplete,
        event.abandoned || false,
        event.abandonmentReason || null,
        JSON.stringify(event.conversionData || {})
      ];

      await database.query(query, values);

      // Update user onboarding progress in Redis
      await this.updateOnboardingProgress(event.userId, event.stage, !!event.completedAt);

      logger.info('Onboarding stage tracked', {
        userId: event.userId,
        stage: event.stage,
        completed: !!event.completedAt,
        abandoned: event.abandoned
      });
    } catch (error) {
      logger.error('Failed to track onboarding stage', { error, event });
      throw error;
    }
  }

  /**
   * Track feature discovery
   */
  async trackFeatureDiscovery(event: FeatureDiscoveryEvent): Promise<void> {
    try {
      const query = `
        INSERT INTO analytics.feature_discovery (
          user_id, feature_name, discovered_through, discovery_context, used_immediately
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [
        event.userId,
        event.featureName,
        event.discoveredThrough,
        JSON.stringify(event.discoveryContext || {}),
        event.usedImmediately || false
      ];

      await database.query(query, values);

      logger.debug('Feature discovery tracked', {
        userId: event.userId,
        featureName: event.featureName,
        discoveredThrough: event.discoveredThrough
      });
    } catch (error) {
      logger.error('Failed to track feature discovery', { error, event });
      throw error;
    }
  }

  /**
   * Get comprehensive feature adoption analytics
   */
  async getFeatureAdoptionAnalytics(
    timeRange: { start: Date; end: Date },
    userId?: string
  ): Promise<FeatureAdoptionAnalytics> {
    try {
      const cacheKey = `feature_adoption:${userId || 'global'}:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
      
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const userFilter = userId ? 'AND user_id = $3' : '';
      const params = [timeRange.start, timeRange.end];
      if (userId) params.push(userId);

      // Get overall adoption metrics
      const overallQuery = `
        WITH feature_stats AS (
          SELECT 
            COUNT(DISTINCT feature_name) as total_features_used,
            COUNT(DISTINCT user_id) as total_users,
            AVG(EXTRACT(EPOCH FROM (first_used_at - timestamp)) / 86400) as avg_time_to_adopt
          FROM analytics.feature_usage
          WHERE timestamp BETWEEN $1 AND $2 ${userFilter}
        ),
        all_features AS (
          SELECT COUNT(*) as total_available_features
          FROM (SELECT DISTINCT feature_name FROM analytics.feature_usage) f
        )
        SELECT 
          fs.total_features_used,
          af.total_available_features,
          CASE 
            WHEN af.total_available_features > 0 
            THEN ROUND((fs.total_features_used::numeric / af.total_available_features) * 100, 2)
            ELSE 0 
          END as adoption_rate,
          COALESCE(fs.avg_time_to_adopt, 0) as avg_time_to_adopt
        FROM feature_stats fs, all_features af
      `;

      const overallResult = await database.query(overallQuery, params);
      const overall = overallResult.rows[0];

      // Get category breakdown
      const categoryQuery = `
        SELECT 
          feature_category as category,
          COUNT(DISTINCT feature_name) as total_features,
          COUNT(DISTINCT user_id) as adopted_users,
          SUM(usage_count) as total_usage,
          AVG(usage_count) as avg_usage_per_user
        FROM analytics.feature_usage
        WHERE timestamp BETWEEN $1 AND $2 ${userFilter}
        GROUP BY feature_category
        ORDER BY total_usage DESC
      `;

      const categoryResult = await database.query(categoryQuery, params);

      // Get top features
      const topFeaturesQuery = `
        SELECT 
          feature_name as name,
          feature_category as category,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(usage_count) as total_usage,
          AVG(total_time_spent_seconds) as avg_time_spent,
          CASE 
            WHEN SUM(success_count + error_count) > 0 
            THEN ROUND((SUM(success_count)::numeric / SUM(success_count + error_count)) * 100, 2)
            ELSE 0 
          END as success_rate
        FROM analytics.feature_usage
        WHERE timestamp BETWEEN $1 AND $2 ${userFilter}
        GROUP BY feature_name, feature_category
        ORDER BY total_usage DESC
        LIMIT 20
      `;

      const topFeaturesResult = await database.query(topFeaturesQuery, params);

      // Get onboarding funnel (only if not user-specific)
      let onboardingFunnel: any[] = [];
      if (!userId) {
        const funnelQuery = `
          SELECT 
            stage,
            COUNT(*) as users_entered,
            COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as users_completed,
            CASE 
              WHEN COUNT(*) > 0 
              THEN ROUND((COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::numeric / COUNT(*)) * 100, 2)
              ELSE 0 
            END as conversion_rate,
            AVG(CASE WHEN time_to_complete_seconds IS NOT NULL THEN time_to_complete_seconds / 3600.0 END) as avg_time_to_complete,
            array_agg(DISTINCT abandonment_reason) FILTER (WHERE abandonment_reason IS NOT NULL) as drop_off_reasons
          FROM analytics.onboarding_funnel
          WHERE started_at BETWEEN $1 AND $2
          GROUP BY stage
          ORDER BY 
            CASE stage
              WHEN 'SIGNUP' THEN 1
              WHEN 'EMAIL_VERIFICATION' THEN 2
              WHEN 'PROFILE_SETUP' THEN 3
              WHEN 'LINKEDIN_CONNECT' THEN 4
              WHEN 'FIRST_CONTENT_CREATE' THEN 5
              WHEN 'FIRST_AUTOMATION_SETUP' THEN 6
              WHEN 'FIRST_ANALYTICS_VIEW' THEN 7
              WHEN 'UPGRADE_PROMPT' THEN 8
              WHEN 'COMPLETED' THEN 9
            END
        `;

        const funnelResult = await database.query(funnelQuery, [timeRange.start, timeRange.end]);
        
        onboardingFunnel = funnelResult.rows.map((row: any) => ({
          stage: row.stage,
          usersEntered: parseInt(row.users_entered),
          usersCompleted: parseInt(row.users_completed),
          conversionRate: parseFloat(row.conversion_rate),
          avgTimeToComplete: parseFloat(row.avg_time_to_complete || '0'),
          dropOffReasons: (row.drop_off_reasons || []).map((reason: string) => ({ reason, count: 1 }))
        }));
      }

      // Get feature discovery analytics
      const discoveryQuery = `
        SELECT 
          feature_name,
          COUNT(*) as total_discoveries,
          jsonb_object_agg(discovered_through, discovery_count) as discovery_methods,
          ROUND(AVG(CASE WHEN used_immediately THEN 1.0 ELSE 0.0 END) * 100, 2) as immediate_usage_rate,
          AVG(CASE 
            WHEN fu.first_used_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (fu.first_used_at - fd.timestamp)) / 86400
            ELSE NULL 
          END) as avg_days_to_first_use
        FROM analytics.feature_discovery fd
        LEFT JOIN LATERAL (
          SELECT first_used_at 
          FROM analytics.feature_usage 
          WHERE user_id = fd.user_id AND feature_name = fd.feature_name 
          ORDER BY timestamp ASC 
          LIMIT 1
        ) fu ON true
        CROSS JOIN LATERAL (
          SELECT discovered_through, COUNT(*) as discovery_count
          FROM analytics.feature_discovery fd2
          WHERE fd2.feature_name = fd.feature_name AND fd2.timestamp BETWEEN $1 AND $2
          GROUP BY discovered_through
        ) discovery_breakdown
        WHERE fd.timestamp BETWEEN $1 AND $2 ${userFilter}
        GROUP BY feature_name
        ORDER BY total_discoveries DESC
        LIMIT 15
      `;

      const discoveryResult = await database.query(discoveryQuery, params);

      // Get user segmentation (only if not user-specific)
      let userSegmentation = { powerUsers: 0, regularUsers: 0, lightUsers: 0, trialUsers: 0 };
      if (!userId) {
        const segmentationQuery = `
          SELECT 
            CASE 
              WHEN feature_count > 10 THEN 'power'
              WHEN feature_count BETWEEN 3 AND 10 THEN 'regular'
              WHEN feature_count BETWEEN 1 AND 2 THEN 'light'
              ELSE 'trial'
            END as user_segment,
            COUNT(*) as user_count
          FROM (
            SELECT 
              user_id,
              COUNT(DISTINCT feature_name) as feature_count
            FROM analytics.feature_usage
            WHERE timestamp BETWEEN $1 AND $2
            GROUP BY user_id
          ) user_features
          GROUP BY 
            CASE 
              WHEN feature_count > 10 THEN 'power'
              WHEN feature_count BETWEEN 3 AND 10 THEN 'regular'
              WHEN feature_count BETWEEN 1 AND 2 THEN 'light'
              ELSE 'trial'
            END
        `;

        const segmentationResult = await database.query(segmentationQuery, [timeRange.start, timeRange.end]);
        
        segmentationResult.rows.forEach((row: any) => {
          switch (row.user_segment) {
            case 'power': userSegmentation.powerUsers = parseInt(row.user_count); break;
            case 'regular': userSegmentation.regularUsers = parseInt(row.user_count); break;
            case 'light': userSegmentation.lightUsers = parseInt(row.user_count); break;
            case 'trial': userSegmentation.trialUsers = parseInt(row.user_count); break;
          }
        });
      }

      const analytics: FeatureAdoptionAnalytics = {
        userId,
        timeRange,
        overallAdoption: {
          totalFeatures: parseInt(overall.total_available_features || '0'),
          featuresUsed: parseInt(overall.total_features_used || '0'),
          adoptionRate: parseFloat(overall.adoption_rate || '0'),
          averageTimeToAdopt: parseFloat(overall.avg_time_to_adopt || '0')
        },
        categoryBreakdown: categoryResult.rows.map((row: any) => ({
          category: row.category,
          totalFeatures: parseInt(row.total_features),
          adoptedFeatures: parseInt(row.adopted_users),
          adoptionRate: parseInt(row.total_features) > 0 ? 
            (parseInt(row.adopted_users) / parseInt(row.total_features)) * 100 : 0,
          avgUsagePerUser: parseFloat(row.avg_usage_per_user || '0')
        })),
        topFeatures: topFeaturesResult.rows.map((row: any) => ({
          name: row.name,
          category: row.category,
          uniqueUsers: parseInt(row.unique_users),
          totalUsage: parseInt(row.total_usage),
          avgTimeSpent: parseFloat(row.avg_time_spent || '0'),
          successRate: parseFloat(row.success_rate || '0')
        })),
        onboardingFunnel,
        featureDiscovery: discoveryResult.rows.map((row: any) => ({
          featureName: row.feature_name,
          totalDiscoveries: parseInt(row.total_discoveries),
          discoveryMethods: row.discovery_methods || {},
          immediateUsageRate: parseFloat(row.immediate_usage_rate || '0'),
          avgDaysToFirstUse: parseFloat(row.avg_days_to_first_use || '0')
        })),
        userSegmentation
      };

      // Cache result
      await redis.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info('Feature adoption analytics generated', {
        userId: userId || 'global',
        totalFeatures: analytics.overallAdoption.totalFeatures,
        adoptionRate: analytics.overallAdoption.adoptionRate
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get feature adoption analytics', { error, userId, timeRange });
      throw error;
    }
  }

  /**
   * Get detailed onboarding analytics
   */
  async getOnboardingAnalytics(timeRange: { start: Date; end: Date }): Promise<OnboardingAnalytics> {
    try {
      const cacheKey = `onboarding_analytics:${timeRange.start.toISOString()}:${timeRange.end.toISOString()}`;
      
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get overall onboarding metrics
      const overallQuery = `
        SELECT 
          COUNT(DISTINCT user_id) as total_users,
          COUNT(DISTINCT CASE WHEN stage = 'COMPLETED' AND completed_at IS NOT NULL THEN user_id END) as completed_users,
          AVG(CASE WHEN stage = 'COMPLETED' AND time_to_complete_seconds IS NOT NULL THEN time_to_complete_seconds / 3600.0 END) as avg_completion_time,
          COUNT(DISTINCT CASE WHEN abandoned THEN user_id END) as dropped_users
        FROM analytics.onboarding_funnel
        WHERE started_at BETWEEN $1 AND $2
      `;

      const overallResult = await database.query(overallQuery, [timeRange.start, timeRange.end]);
      const overall = overallResult.rows[0];

      const totalUsers = parseInt(overall.total_users || '0');
      const completedUsers = parseInt(overall.completed_users || '0');
      const droppedUsers = parseInt(overall.dropped_users || '0');

      // Get stage analysis
      const stageQuery = `
        SELECT 
          stage,
          COUNT(*) as entered,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
          AVG(CASE WHEN time_to_complete_seconds IS NOT NULL THEN time_to_complete_seconds / 3600.0 END) as avg_time,
          array_agg(DISTINCT abandonment_reason) FILTER (WHERE abandonment_reason IS NOT NULL) as drop_off_reasons
        FROM analytics.onboarding_funnel
        WHERE started_at BETWEEN $1 AND $2
        GROUP BY stage
        ORDER BY 
          CASE stage
            WHEN 'SIGNUP' THEN 1
            WHEN 'EMAIL_VERIFICATION' THEN 2
            WHEN 'PROFILE_SETUP' THEN 3
            WHEN 'LINKEDIN_CONNECT' THEN 4
            WHEN 'FIRST_CONTENT_CREATE' THEN 5
            WHEN 'FIRST_AUTOMATION_SETUP' THEN 6
            WHEN 'FIRST_ANALYTICS_VIEW' THEN 7
            WHEN 'UPGRADE_PROMPT' THEN 8
            WHEN 'COMPLETED' THEN 9
          END
      `;

      const stageResult = await database.query(stageQuery, [timeRange.start, timeRange.end]);

      // Get segmented analysis
      const tierQuery = `
        SELECT 
          u.subscription_tier,
          COUNT(DISTINCT of.user_id) as total_users,
          COUNT(DISTINCT CASE WHEN of.stage = 'COMPLETED' AND of.completed_at IS NOT NULL THEN of.user_id END) as completed_users,
          AVG(CASE WHEN of.stage = 'COMPLETED' AND of.time_to_complete_seconds IS NOT NULL THEN of.time_to_complete_seconds / 3600.0 END) as avg_time
        FROM analytics.onboarding_funnel of
        JOIN users u ON of.user_id = u.id
        WHERE of.started_at BETWEEN $1 AND $2
        GROUP BY u.subscription_tier
      `;

      const tierResult = await database.query(tierQuery, [timeRange.start, timeRange.end]);

      // Generate optimization opportunities
      const optimizationOpportunities = this.generateOptimizationOpportunities(stageResult.rows);

      const analytics: OnboardingAnalytics = {
        timeRange,
        overallMetrics: {
          totalUsers,
          completedOnboarding: completedUsers,
          completionRate: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0,
          avgTimeToComplete: parseFloat(overall.avg_completion_time || '0'),
          dropOffRate: totalUsers > 0 ? (droppedUsers / totalUsers) * 100 : 0
        },
        stageAnalysis: stageResult.rows.map((row: any) => ({
          stage: row.stage,
          entered: parseInt(row.entered),
          completed: parseInt(row.completed),
          conversionRate: parseInt(row.entered) > 0 ? 
            (parseInt(row.completed) / parseInt(row.entered)) * 100 : 0,
          avgTime: parseFloat(row.avg_time || '0'),
          commonDropOffReasons: row.drop_off_reasons || []
        })),
        segmentedAnalysis: {
          bySubscriptionTier: {},
          byAcquisitionChannel: {} // TODO: Add acquisition channel tracking
        },
        optimizationOpportunities
      };

      // Build subscription tier analysis
      tierResult.rows.forEach((row: any) => {
        const total = parseInt(row.total_users);
        const completed = parseInt(row.completed_users);
        analytics.segmentedAnalysis.bySubscriptionTier[row.subscription_tier] = {
          completionRate: total > 0 ? (completed / total) * 100 : 0,
          avgTime: parseFloat(row.avg_time || '0')
        };
      });

      // Cache result
      await redis.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info('Onboarding analytics generated', {
        totalUsers,
        completionRate: analytics.overallMetrics.completionRate
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get onboarding analytics', { error, timeRange });
      throw error;
    }
  }

  /**
   * Get user's onboarding progress
   */
  async getUserOnboardingProgress(userId: string): Promise<{
    currentStage: string;
    completedStages: string[];
    progressPercentage: number;
    timeSpent: number; // hours
    isStuck: boolean;
    nextRecommendedAction: string;
  }> {
    try {
      const query = `
        SELECT 
          stage,
          completed_at IS NOT NULL as completed,
          time_to_complete_seconds,
          started_at
        FROM analytics.onboarding_funnel
        WHERE user_id = $1
        ORDER BY 
          CASE stage
            WHEN 'SIGNUP' THEN 1
            WHEN 'EMAIL_VERIFICATION' THEN 2
            WHEN 'PROFILE_SETUP' THEN 3
            WHEN 'LINKEDIN_CONNECT' THEN 4
            WHEN 'FIRST_CONTENT_CREATE' THEN 5
            WHEN 'FIRST_AUTOMATION_SETUP' THEN 6
            WHEN 'FIRST_ANALYTICS_VIEW' THEN 7
            WHEN 'UPGRADE_PROMPT' THEN 8
            WHEN 'COMPLETED' THEN 9
          END
      `;

      const result = await database.query(query, [userId]);
      const stages = result.rows;

      const completedStages = stages.filter((s: any) => s.completed).map((s: any) => s.stage);
      const currentStageIndex = completedStages.length;
      const currentStage = currentStageIndex < this.ONBOARDING_STAGES.length ? 
        this.ONBOARDING_STAGES[currentStageIndex] : 'COMPLETED';

      const progressPercentage = (completedStages.length / this.ONBOARDING_STAGES.length) * 100;

      // Calculate total time spent
      const totalTimeSpent = stages.reduce((sum: number, stage: any) => {
        return sum + (stage.time_to_complete_seconds || 0);
      }, 0) / 3600; // Convert to hours

      // Check if user is stuck (no progress in last 7 days)
      const lastActivity = stages.length > 0 ? 
        new Date(stages[stages.length - 1].started_at) : new Date(0);
      const isStuck = (Date.now() - lastActivity.getTime()) > (7 * 24 * 60 * 60 * 1000);

      // Get next recommended action
      const nextRecommendedAction = this.getNextRecommendedAction(currentStage, completedStages);

      return {
        currentStage,
        completedStages,
        progressPercentage,
        timeSpent: totalTimeSpent,
        isStuck,
        nextRecommendedAction
      };
    } catch (error) {
      logger.error('Failed to get user onboarding progress', { error, userId });
      throw error;
    }
  }

  /**
   * Validate feature event
   */
  private validateFeatureEvent(event: FeatureUsageEvent): void {
    if (!event.userId || !event.featureName || !event.featureCategory) {
      throw new Error('Missing required fields: userId, featureName, featureCategory');
    }

    if (!this.FEATURE_CATEGORIES.includes(event.featureCategory)) {
      throw new Error(`Invalid feature category: ${event.featureCategory}`);
    }
  }

  /**
   * Validate onboarding event
   */
  private validateOnboardingEvent(event: OnboardingStageEvent): void {
    if (!event.userId || !event.stage) {
      throw new Error('Missing required fields: userId, stage');
    }

    if (!this.ONBOARDING_STAGES.includes(event.stage)) {
      throw new Error(`Invalid onboarding stage: ${event.stage}`);
    }
  }

  /**
   * Get existing feature usage
   */
  private async getExistingFeatureUsage(userId: string, featureName: string): Promise<any> {
    const query = `
      SELECT * FROM analytics.feature_usage 
      WHERE user_id = $1 AND feature_name = $2 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;

    const result = await database.query(query, [userId, featureName]);
    return result.rows[0] || null;
  }

  /**
   * Update feature metrics in Redis
   */
  private async updateFeatureMetrics(event: FeatureUsageEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const featureKey = `feature_daily:${event.featureName}:${today}`;
    const categoryKey = `category_daily:${event.featureCategory}:${today}`;

    // Update feature-specific metrics
    await redis.hincrby(featureKey, 'usage_count', event.usageCount || 1);
    await redis.hincrby(featureKey, 'unique_users', 1); // Will be approximate
    await redis.expire(featureKey, 86400 * 7); // 7 days TTL

    // Update category metrics
    await redis.hincrby(categoryKey, 'usage_count', event.usageCount || 1);
    await redis.hincrby(categoryKey, 'unique_users', 1);
    await redis.expire(categoryKey, 86400 * 7);
  }

  /**
   * Update onboarding progress in Redis
   */
  private async updateOnboardingProgress(userId: string, stage: string, completed: boolean): Promise<void> {
    const progressKey = `onboarding_progress:${userId}`;
    
    if (completed) {
      await redis.sadd(progressKey, stage);
    }
    
    await redis.expire(progressKey, 86400 * 30); // 30 days TTL
  }

  /**
   * Generate optimization opportunities
   */
  private generateOptimizationOpportunities(stages: any[]): Array<{
    stage: string;
    issue: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    recommendation: string;
  }> {
    const opportunities: Array<{
      stage: string;
      issue: string;
      impact: 'HIGH' | 'MEDIUM' | 'LOW';
      recommendation: string;
    }> = [];

    stages.forEach((stage: any) => {
      const conversionRate = parseInt(stage.entered) > 0 ? 
        (parseInt(stage.completed) / parseInt(stage.entered)) * 100 : 0;
      const avgTime = parseFloat(stage.avg_time || '0');

      // Low conversion rate
      if (conversionRate < 50 && parseInt(stage.entered) > 10) {
        opportunities.push({
          stage: stage.stage,
          issue: `Low conversion rate (${conversionRate.toFixed(1)}%)`,
          impact: conversionRate < 30 ? 'HIGH' : 'MEDIUM',
          recommendation: `Review user experience and add guidance for ${stage.stage}`
        });
      }

      // High time to complete
      if (avgTime > 24 && parseInt(stage.completed) > 5) { // More than 24 hours
        opportunities.push({
          stage: stage.stage,
          issue: `Long completion time (${avgTime.toFixed(1)} hours)`,
          impact: avgTime > 72 ? 'HIGH' : 'MEDIUM',
          recommendation: `Simplify ${stage.stage} process or break into smaller steps`
        });
      }

      // Common drop-off reasons
      if (stage.drop_off_reasons && stage.drop_off_reasons.length > 0) {
        const mostCommonReason = stage.drop_off_reasons[0];
        if (mostCommonReason) {
          opportunities.push({
            stage: stage.stage,
            issue: `Frequent abandonment: ${mostCommonReason}`,
            impact: 'MEDIUM',
            recommendation: `Address common issue: ${mostCommonReason}`
          });
        }
      }
    });

    return opportunities.slice(0, 10); // Top 10 opportunities
  }

  /**
   * Get next recommended action
   */
  private getNextRecommendedAction(currentStage: string, completedStages: string[]): string {
    const recommendations: Record<string, string> = {
      'SIGNUP': 'Complete email verification to activate your account',
      'EMAIL_VERIFICATION': 'Set up your profile information',
      'PROFILE_SETUP': 'Connect your LinkedIn account to start optimizing',
      'LINKEDIN_CONNECT': 'Create your first piece of content',
      'FIRST_CONTENT_CREATE': 'Set up your first automation rule',
      'FIRST_AUTOMATION_SETUP': 'Explore your analytics dashboard',
      'FIRST_ANALYTICS_VIEW': 'Consider upgrading for advanced features',
      'UPGRADE_PROMPT': 'Complete onboarding setup',
      'COMPLETED': 'Explore advanced features and optimization tools'
    };

    return recommendations[currentStage] || 'Continue exploring the platform';
  }
}

export default new FeatureAdoptionService();