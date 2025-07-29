import { database } from '@/config/database';
import { logger } from '@/config/logger';
import { ProfileMetric, EngagementMetric } from '@/types/analytics';

interface SeedUser {
  id: string;
  name: string;
  profile: {
    baseViews: number;
    baseConnections: number;
    baseCompleteness: number;
    baseEngagement: number;
  };
}

export class DevelopmentSeeder {
  private readonly SEED_USERS: SeedUser[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'John Professional',
      profile: {
        baseViews: 150,
        baseConnections: 500,
        baseCompleteness: 85.5,
        baseEngagement: 0.045
      }
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Sarah Expert',
      profile: {
        baseViews: 280,
        baseConnections: 1200,
        baseCompleteness: 92.0,
        baseEngagement: 0.067
      }
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Mike Starter',
      profile: {
        baseViews: 45,
        baseConnections: 125,
        baseCompleteness: 68.5,
        baseEngagement: 0.023
      }
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Lisa Executive',
      profile: {
        baseViews: 520,
        baseConnections: 2100,
        baseCompleteness: 95.8,
        baseEngagement: 0.089
      }
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      name: 'David Developer',
      profile: {
        baseViews: 320,
        baseConnections: 890,
        baseCompleteness: 78.2,
        baseEngagement: 0.056
      }
    }
  ];

  /**
   * Seed development data
   */
  public async seedDevelopmentData(): Promise<void> {
    try {
      logger.info('Starting development data seeding');

      // Clear existing data
      await this.clearExistingData();

      // Seed profile metrics (30 days of data)
      await this.seedProfileMetrics();

      // Seed engagement metrics
      await this.seedEngagementMetrics();

      // Seed real-time events
      await this.seedRealTimeEvents();

      // Seed alert configurations
      await this.seedAlertConfigs();

      // Seed user goals
      await this.seedUserGoals();

      // Trigger continuous aggregate updates
      await this.updateContinuousAggregates();

      logger.info('Development data seeding completed successfully');
    } catch (error) {
      logger.error('Failed to seed development data', { error });
      throw error;
    }
  }

  /**
   * Clear existing development data
   */
  private async clearExistingData(): Promise<void> {
    const tables = [
      'analytics.real_time_events',
      'analytics.engagement_metrics',
      'analytics.profile_metrics',
      'analytics.alert_history',
      'analytics.alert_configs',
      'analytics.user_goals',
      'analytics.metric_aggregations'
    ];

    for (const table of tables) {
      try {
        await database.query(`DELETE FROM ${table} WHERE TRUE`);
        logger.debug('Cleared table', { table });
      } catch (error) {
        logger.warn('Failed to clear table', { table, error });
      }
    }

    logger.info('Existing development data cleared');
  }

  /**
   * Seed profile metrics for the last 30 days
   */
  private async seedProfileMetrics(): Promise<void> {
    const metrics: ProfileMetric[] = [];
    const now = new Date();
    const daysToSeed = 30;

    for (const user of this.SEED_USERS) {
      for (let day = daysToSeed; day >= 0; day--) {
        // Create 4-8 data points per day (every 3-6 hours)
        const dataPointsPerDay = 4 + Math.floor(Math.random() * 5);
        
        for (let point = 0; point < dataPointsPerDay; point++) {
          const timestamp = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) + (point * (24 / dataPointsPerDay) * 60 * 60 * 1000));
          
          // Add some growth trend and daily variation
          const dayProgress = (daysToSeed - day) / daysToSeed;
          const growthFactor = 1 + (dayProgress * 0.3); // 30% growth over 30 days
          const dailyVariation = 0.9 + (Math.random() * 0.2); // ±10% daily variation
          const hourlyVariation = 0.95 + (Math.random() * 0.1); // ±5% hourly variation
          
          const metric: ProfileMetric = {
            userId: user.id,
            timestamp,
            profileViews: Math.floor(user.profile.baseViews * growthFactor * dailyVariation * hourlyVariation),
            searchAppearances: Math.floor((user.profile.baseViews * 0.7) * growthFactor * dailyVariation),
            connectionsCount: Math.floor(user.profile.baseConnections * growthFactor * (0.98 + Math.random() * 0.04)),
            completenessScore: Math.min(100, user.profile.baseCompleteness + (dayProgress * 10) + (Math.random() * 2 - 1)),
            skillsCount: 8 + Math.floor(dayProgress * 12) + Math.floor(Math.random() * 3),
            endorsementsCount: Math.floor(user.profile.baseConnections * 0.1 * growthFactor * dailyVariation),
            recommendationsCount: 3 + Math.floor(dayProgress * 7) + Math.floor(Math.random() * 2),
            postsCount: Math.floor(dayProgress * 25) + Math.floor(Math.random() * 3),
            articlesCount: Math.floor(dayProgress * 8) + Math.floor(Math.random() * 2),
            engagementRate: Math.min(0.15, user.profile.baseEngagement * growthFactor * dailyVariation * hourlyVariation),
            source: 'development_seed'
          };

          // Add extended metrics
          (metric as any).likesReceived = Math.floor(metric.profileViews * metric.engagementRate * 0.6);
          (metric as any).commentsReceived = Math.floor(metric.profileViews * metric.engagementRate * 0.3);
          (metric as any).sharesReceived = Math.floor(metric.profileViews * metric.engagementRate * 0.1);
          (metric as any).profileClicks = Math.floor(metric.profileViews * 0.15);
          (metric as any).networkGrowthRate = (Math.random() * 0.02) - 0.01; // -1% to +1%
          (metric as any).contentEngagementScore = metric.engagementRate * 1000 + (Math.random() * 50 - 25);
          (metric as any).influenceScore = this.calculateInfluenceScore(metric);
          (metric as any).dataQualityScore = 0.95 + Math.random() * 0.05;

          metrics.push(metric);
        }
      }
    }

    // Batch insert metrics
    const batchSize = 500;
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await this.insertProfileMetricsBatch(batch);
    }

    logger.info('Profile metrics seeded', { 
      totalMetrics: metrics.length,
      users: this.SEED_USERS.length,
      daysOfData: daysToSeed
    });
  }

  /**
   * Insert batch of profile metrics
   */
  private async insertProfileMetricsBatch(metrics: ProfileMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    const query = `
      INSERT INTO analytics.profile_metrics (
        user_id, timestamp, profile_views, search_appearances, 
        connections_count, completeness_score, skills_count,
        endorsements_count, recommendations_count, posts_count,
        articles_count, engagement_rate, likes_received,
        comments_received, shares_received, profile_clicks,
        network_growth_rate, content_engagement_score,
        influence_score, source, data_quality_score
      ) VALUES ${metrics.map((_, index) => 
        `($${index * 21 + 1}, $${index * 21 + 2}, $${index * 21 + 3}, $${index * 21 + 4}, 
         $${index * 21 + 5}, $${index * 21 + 6}, $${index * 21 + 7}, $${index * 21 + 8}, 
         $${index * 21 + 9}, $${index * 21 + 10}, $${index * 21 + 11}, $${index * 21 + 12}, 
         $${index * 21 + 13}, $${index * 21 + 14}, $${index * 21 + 15}, $${index * 21 + 16}, 
         $${index * 21 + 17}, $${index * 21 + 18}, $${index * 21 + 19}, $${index * 21 + 20}, 
         $${index * 21 + 21})`
      ).join(', ')}
    `;

    const values = metrics.flatMap(metric => [
      metric.userId,
      metric.timestamp,
      metric.profileViews,
      metric.searchAppearances,
      metric.connectionsCount,
      metric.completenessScore,
      metric.skillsCount,
      metric.endorsementsCount,
      metric.recommendationsCount,
      metric.postsCount,
      metric.articlesCount,
      metric.engagementRate,
      (metric as any).likesReceived,
      (metric as any).commentsReceived,
      (metric as any).sharesReceived,
      (metric as any).profileClicks,
      (metric as any).networkGrowthRate,
      (metric as any).contentEngagementScore,
      (metric as any).influenceScore,
      metric.source,
      (metric as any).dataQualityScore
    ]);

    await database.query(query, values);
  }

  /**
   * Seed engagement metrics
   */
  private async seedEngagementMetrics(): Promise<void> {
    const engagementTypes = ['like', 'comment', 'share', 'view', 'click'];
    const contentTypes = ['post', 'article', 'profile', 'skill_endorsement'];
    const deviceTypes = ['desktop', 'mobile', 'tablet'];
    const metrics: EngagementMetric[] = [];
    const now = new Date();

    for (const user of this.SEED_USERS) {
      // Create 200-500 engagement events per user over 30 days
      const eventCount = 200 + Math.floor(Math.random() * 300);
      
      for (let i = 0; i < eventCount; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const timestamp = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        
        const metric: EngagementMetric = {
          userId: user.id,
          contentId: `content_${Math.floor(Math.random() * 100) + 1}`,
          timestamp,
          type: engagementTypes[Math.floor(Math.random() * engagementTypes.length)] as any,
          value: 1 + Math.floor(Math.random() * 3), // 1-3 value
          source: 'development_seed',
          metadata: {
            contentType: contentTypes[Math.floor(Math.random() * contentTypes.length)],
            deviceType: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
            referrerSource: Math.random() > 0.5 ? 'linkedin' : 'direct',
            geographicRegion: this.getRandomRegion()
          }
        };

        metrics.push(metric);
      }
    }

    // Batch insert engagement metrics
    const batchSize = 500;
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await this.insertEngagementMetricsBatch(batch);
    }

    logger.info('Engagement metrics seeded', { 
      totalMetrics: metrics.length,
      users: this.SEED_USERS.length
    });
  }

  /**
   * Insert batch of engagement metrics
   */
  private async insertEngagementMetricsBatch(metrics: EngagementMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    const query = `
      INSERT INTO analytics.engagement_metrics (
        user_id, content_id, timestamp, type, value, content_type,
        device_type, referrer_source, geographic_region, source, metadata
      ) VALUES ${metrics.map((_, index) => 
        `($${index * 11 + 1}, $${index * 11 + 2}, $${index * 11 + 3}, $${index * 11 + 4}, 
         $${index * 11 + 5}, $${index * 11 + 6}, $${index * 11 + 7}, $${index * 11 + 8}, 
         $${index * 11 + 9}, $${index * 11 + 10}, $${index * 11 + 11})`
      ).join(', ')}
    `;

    const values = metrics.flatMap(metric => [
      metric.userId,
      metric.contentId,
      metric.timestamp,
      metric.type,
      metric.value,
      (metric.metadata as any)?.contentType,
      (metric.metadata as any)?.deviceType,
      (metric.metadata as any)?.referrerSource,
      (metric.metadata as any)?.geographicRegion,
      metric.source,
      JSON.stringify(metric.metadata)
    ]);

    await database.query(query, values);
  }

  /**
   * Seed real-time events for recent activity
   */
  private async seedRealTimeEvents(): Promise<void> {
    const eventTypes = ['profile_view', 'engagement', 'connection_made', 'skill_endorsement'];
    const now = new Date();
    
    for (const user of this.SEED_USERS) {
      // Create 20-50 recent events per user (last 24 hours)
      const eventCount = 20 + Math.floor(Math.random() * 30);
      
      for (let i = 0; i < eventCount; i++) {
        const hoursAgo = Math.random() * 24;
        const timestamp = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        let eventData = {};
        
        switch (eventType) {
          case 'profile_view':
            eventData = {
              source: 'linkedin_search',
              viewer_location: this.getRandomRegion()
            };
            break;
          case 'engagement':
            eventData = {
              type: 'like',
              contentId: `content_${Math.floor(Math.random() * 50) + 1}`,
              value: 1
            };
            break;
          case 'connection_made':
            eventData = {
              connection_source: 'mutual_connection',
              industry: this.getRandomIndustry()
            };
            break;
          case 'skill_endorsement':
            eventData = {
              skill: this.getRandomSkill(),
              endorser_level: Math.floor(Math.random() * 3) + 1
            };
            break;
        }

        await database.query(`
          INSERT INTO analytics.real_time_events (user_id, event_type, event_data, timestamp)
          VALUES ($1, $2, $3, $4)
        `, [user.id, eventType, JSON.stringify(eventData), timestamp]);
      }
    }

    logger.info('Real-time events seeded');
  }

  /**
   * Seed alert configurations
   */
  private async seedAlertConfigs(): Promise<void> {
    for (const user of this.SEED_USERS) {
      // Create 2-4 alert configs per user
      const alertConfigs = [
        {
          alertName: 'Profile Views Threshold',
          metricType: 'profile_views',
          threshold: user.profile.baseViews * 1.5,
          condition: 'above',
          priority: 'medium'
        },
        {
          alertName: 'Low Completeness Warning',
          metricType: 'completeness_score',
          threshold: 70,
          condition: 'below',
          priority: 'high'
        },
        {
          alertName: 'Engagement Rate Drop',
          metricType: 'engagement_rate',
          threshold: 20, // 20% change
          condition: 'change',
          priority: 'medium'
        }
      ];

      if (Math.random() > 0.5) {
        alertConfigs.push({
          alertName: 'Connection Growth Goal',
          metricType: 'connections_count',
          threshold: user.profile.baseConnections * 1.1,
          condition: 'above',
          priority: 'low'
        });
      }

      for (const config of alertConfigs) {
        await database.query(`
          INSERT INTO analytics.alert_configs (
            user_id, alert_name, metric_type, threshold, condition,
            enabled, notification_methods, priority, category
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          user.id,
          config.alertName,
          config.metricType,
          config.threshold,
          config.condition,
          true,
          JSON.stringify(['websocket']),
          config.priority,
          'metrics'
        ]);
      }
    }

    logger.info('Alert configurations seeded');
  }

  /**
   * Seed user goals
   */
  private async seedUserGoals(): Promise<void> {
    const goalTypes = [
      'profile_views_monthly',
      'connections_quarterly',
      'completeness_score',
      'engagement_rate_improvement'
    ];

    for (const user of this.SEED_USERS) {
      // Create 2-3 goals per user
      const userGoals = [
        {
          goalName: 'Monthly Profile Views',
          goalType: 'profile_views_monthly',
          targetValue: user.profile.baseViews * 2,
          currentValue: user.profile.baseViews * 1.3,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          category: 'visibility'
        },
        {
          goalName: 'Network Growth',
          goalType: 'connections_quarterly',
          targetValue: user.profile.baseConnections * 1.5,
          currentValue: user.profile.baseConnections,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          category: 'networking'
        }
      ];

      if (user.profile.baseCompleteness < 90) {
        userGoals.push({
          goalName: 'Complete Profile',
          goalType: 'completeness_score',
          targetValue: 95,
          currentValue: user.profile.baseCompleteness,
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          category: 'optimization'
        });
      }

      for (const goal of userGoals) {
        await database.query(`
          INSERT INTO analytics.user_goals (
            user_id, goal_name, goal_type, target_value, current_value,
            deadline, achieved, category, priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          user.id,
          goal.goalName,
          goal.goalType,
          goal.targetValue,
          goal.currentValue,
          goal.deadline,
          goal.currentValue >= goal.targetValue,
          goal.category,
          'medium'
        ]);
      }
    }

    logger.info('User goals seeded');
  }

  /**
   * Update continuous aggregates
   */
  private async updateContinuousAggregates(): Promise<void> {
    try {
      // Refresh continuous aggregates manually for development
      await database.query(`
        CALL refresh_continuous_aggregate('analytics.profile_metrics_5min', NULL, NULL);
      `);
      
      await database.query(`
        CALL refresh_continuous_aggregate('analytics.profile_metrics_hourly', NULL, NULL);
      `);
      
      await database.query(`
        CALL refresh_continuous_aggregate('analytics.profile_metrics_daily', NULL, NULL);
      `);
      
      await database.query(`
        CALL refresh_continuous_aggregate('analytics.engagement_hourly', NULL, NULL);
      `);

      logger.info('Continuous aggregates updated');
    } catch (error) {
      logger.warn('Failed to update some continuous aggregates', { error });
    }
  }

  /**
   * Calculate influence score for a metric
   */
  private calculateInfluenceScore(metric: ProfileMetric): number {
    const profileWeight = 0.3;
    const engagementWeight = 0.4;
    const growthWeight = 0.3;
    
    const profileScore = (metric.completenessScore / 100) * 100;
    const engagementScore = metric.engagementRate * 1000;
    const growthScore = Math.max(0, 50 + ((metric as any).networkGrowthRate || 0) * 1000);
    
    return profileScore * profileWeight + engagementScore * engagementWeight + growthScore * growthWeight;
  }

  /**
   * Get random geographic region
   */
  private getRandomRegion(): string {
    const regions = [
      'North America', 'Europe', 'Asia Pacific', 'Latin America', 
      'Middle East', 'Africa', 'Oceania'
    ];
    return regions[Math.floor(Math.random() * regions.length)] || 'North America';
  }

  /**
   * Get random industry
   */
  private getRandomIndustry(): string {
    const industries = [
      'Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing',
      'Retail', 'Consulting', 'Media', 'Real Estate', 'Non-profit'
    ];
    return industries[Math.floor(Math.random() * industries.length)] || 'Technology';
  }

  /**
   * Get random skill
   */
  private getRandomSkill(): string {
    const skills = [
      'JavaScript', 'Python', 'Project Management', 'Data Analysis',
      'Leadership', 'Marketing', 'Sales', 'Design', 'Communication',
      'Strategy', 'Operations', 'Finance', 'Customer Service'
    ];
    return skills[Math.floor(Math.random() * skills.length)] || 'JavaScript';
  }

  /**
   * Clear all seeded data
   */
  public async clearSeedData(): Promise<void> {
    try {
      await this.clearExistingData();
      logger.info('All seed data cleared');
    } catch (error) {
      logger.error('Failed to clear seed data', { error });
      throw error;
    }
  }

  /**
   * Get seed status
   */
  public async getSeedStatus(): Promise<any> {
    try {
      const [profileCount, engagementCount, eventCount, alertCount, goalCount] = await Promise.all([
        database.query(`SELECT COUNT(*) as count FROM analytics.profile_metrics WHERE source = 'development_seed'`),
        database.query(`SELECT COUNT(*) as count FROM analytics.engagement_metrics WHERE source = 'development_seed'`),
        database.query(`SELECT COUNT(*) as count FROM analytics.real_time_events`),
        database.query(`SELECT COUNT(*) as count FROM analytics.alert_configs`),
        database.query(`SELECT COUNT(*) as count FROM analytics.user_goals`)
      ]);

      return {
        seeded: profileCount.rows[0].count > 0,
        profileMetrics: parseInt(profileCount.rows[0].count),
        engagementMetrics: parseInt(engagementCount.rows[0].count),
        realTimeEvents: parseInt(eventCount.rows[0].count),
        alertConfigs: parseInt(alertCount.rows[0].count),
        userGoals: parseInt(goalCount.rows[0].count),
        seedUsers: this.SEED_USERS.length,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get seed status', { error });
      return { error: 'Failed to get seed status', timestamp: new Date() };
    }
  }
}