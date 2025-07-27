import { database } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/config/logger';
import { EnhancedWebSocketService } from './enhanced-websocket.service';
import cron from 'node-cron';

interface AlertRule {
  id: string;
  userId: string;
  alertName: string;
  metricType: string;
  threshold: number;
  condition: 'above' | 'below' | 'change' | 'trend';
  comparisonPeriod: string;
  enabled: boolean;
  notificationMethods: string[];
  notificationFrequency: string;
  quietHours: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

interface AlertEvent {
  id: string;
  alertConfigId: string;
  userId: string;
  metricValue: number;
  thresholdValue: number;
  conditionMet: string;
  severity: string;
  timestamp: Date;
}

interface NotificationChannel {
  type: 'websocket' | 'email' | 'webhook';
  config: any;
  enabled: boolean;
}

export class AlertingService {
  private websocketService: EnhancedWebSocketService;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  private readonly ALERT_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly RATE_LIMIT_WINDOW = 300000; // 5 minutes
  private readonly MAX_ALERTS_PER_WINDOW = 10;
  
  constructor(websocketService: EnhancedWebSocketService) {
    this.websocketService = websocketService;
  }

  /**
   * Initialize the alerting service
   */
  public async initialize(): Promise<void> {
    try {
      await this.startAlertMonitoring();
      this.scheduleMaintenanceTasks();
      
      logger.info('Alerting service initialized', {
        checkInterval: this.ALERT_CHECK_INTERVAL,
        rateLimitWindow: this.RATE_LIMIT_WINDOW,
        maxAlertsPerWindow: this.MAX_ALERTS_PER_WINDOW
      });
    } catch (error) {
      logger.error('Failed to initialize alerting service', { error });
      throw error;
    }
  }

  /**
   * Create a new alert rule
   */
  public async createAlertRule(alertRule: Omit<AlertRule, 'id'>): Promise<string> {
    try {
      const query = `
        INSERT INTO analytics.alert_configs (
          user_id, alert_name, metric_type, threshold, condition,
          comparison_period, enabled, notification_methods, 
          notification_frequency, quiet_hours, description, 
          priority, category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const values = [
        alertRule.userId,
        alertRule.alertName,
        alertRule.metricType,
        alertRule.threshold,
        alertRule.condition,
        alertRule.comparisonPeriod || '1 day',
        alertRule.enabled,
        JSON.stringify(alertRule.notificationMethods),
        alertRule.notificationFrequency,
        JSON.stringify(alertRule.quietHours || {}),
        `Alert for ${alertRule.metricType}`,
        alertRule.priority,
        alertRule.category
      ];

      const result = await database.query(query, values);
      const alertId = result.rows[0].id;

      logger.info('Alert rule created', {
        alertId,
        userId: alertRule.userId,
        metricType: alertRule.metricType,
        threshold: alertRule.threshold,
        condition: alertRule.condition
      });

      return alertId;
    } catch (error) {
      logger.error('Failed to create alert rule', { error, alertRule });
      throw error;
    }
  }

  /**
   * Update an existing alert rule
   */
  public async updateAlertRule(alertId: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic UPDATE query
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          switch (key) {
            case 'alertName':
              setParts.push(`alert_name = $${paramIndex++}`);
              values.push(value);
              break;
            case 'metricType':
              setParts.push(`metric_type = $${paramIndex++}`);
              values.push(value);
              break;
            case 'threshold':
              setParts.push(`threshold = $${paramIndex++}`);
              values.push(value);
              break;
            case 'condition':
              setParts.push(`condition = $${paramIndex++}`);
              values.push(value);
              break;
            case 'enabled':
              setParts.push(`enabled = $${paramIndex++}`);
              values.push(value);
              break;
            case 'notificationMethods':
              setParts.push(`notification_methods = $${paramIndex++}`);
              values.push(JSON.stringify(value));
              break;
            case 'priority':
              setParts.push(`priority = $${paramIndex++}`);
              values.push(value);
              break;
          }
        }
      });

      if (setParts.length === 0) {
        throw new Error('No valid updates provided');
      }

      setParts.push(`updated_at = NOW()`);
      values.push(alertId);

      const query = `
        UPDATE analytics.alert_configs 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await database.query(query, values);

      logger.info('Alert rule updated', { alertId, updates });
    } catch (error) {
      logger.error('Failed to update alert rule', { error, alertId, updates });
      throw error;
    }
  }

  /**
   * Delete an alert rule
   */
  public async deleteAlertRule(alertId: string, userId: string): Promise<void> {
    try {
      const result = await database.query(`
        DELETE FROM analytics.alert_configs 
        WHERE id = $1 AND user_id = $2
      `, [alertId, userId]);

      if (result.rowCount === 0) {
        throw new Error('Alert rule not found or access denied');
      }

      logger.info('Alert rule deleted', { alertId, userId });
    } catch (error) {
      logger.error('Failed to delete alert rule', { error, alertId, userId });
      throw error;
    }
  }

  /**
   * Get alert rules for a user
   */
  public async getUserAlertRules(userId: string): Promise<AlertRule[]> {
    try {
      const result = await database.query(`
        SELECT 
          id,
          user_id,
          alert_name,
          metric_type,
          threshold,
          condition,
          comparison_period,
          enabled,
          notification_methods,
          notification_frequency,
          quiet_hours,
          priority,
          category,
          created_at,
          updated_at
        FROM analytics.alert_configs
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        alertName: row.alert_name,
        metricType: row.metric_type,
        threshold: parseFloat(row.threshold),
        condition: row.condition,
        comparisonPeriod: row.comparison_period,
        enabled: row.enabled,
        notificationMethods: JSON.parse(row.notification_methods || '[]'),
        notificationFrequency: row.notification_frequency,
        quietHours: JSON.parse(row.quiet_hours || '{}'),
        priority: row.priority,
        category: row.category
      }));
    } catch (error) {
      logger.error('Failed to get user alert rules', { error, userId });
      throw error;
    }
  }

  /**
   * Start monitoring alerts
   */
  private async startAlertMonitoring(): Promise<void> {
    this.alertCheckInterval = setInterval(async () => {
      try {
        await this.checkAllAlerts();
      } catch (error) {
        logger.error('Alert monitoring cycle failed', { error });
      }
    }, this.ALERT_CHECK_INTERVAL);

    logger.info('Alert monitoring started', { interval: this.ALERT_CHECK_INTERVAL });
  }

  /**
   * Check all active alerts
   */
  private async checkAllAlerts(): Promise<void> {
    try {
      // Get all enabled alert rules
      const alertRules = await database.query(`
        SELECT 
          id,
          user_id,
          alert_name,
          metric_type,
          threshold,
          condition,
          comparison_period,
          notification_methods,
          priority
        FROM analytics.alert_configs
        WHERE enabled = true
      `);

      for (const rule of alertRules.rows) {
        try {
          await this.checkAlert(rule);
        } catch (error) {
          logger.error('Failed to check individual alert', { 
            error, 
            alertId: rule.id,
            userId: rule.user_id 
          });
        }
      }
    } catch (error) {
      logger.error('Failed to fetch alert rules for checking', { error });
    }
  }

  /**
   * Check individual alert rule
   */
  private async checkAlert(rule: any): Promise<void> {
    const userId = rule.user_id;
    const metricType = rule.metric_type;
    const threshold = parseFloat(rule.threshold);
    const condition = rule.condition;

    try {
      // Check rate limiting
      if (await this.isRateLimited(userId, rule.id)) {
        return;
      }

      // Get current metric value
      const currentValue = await this.getCurrentMetricValue(userId, metricType);
      
      if (currentValue === null) {
        return; // No data available
      }

      // Check alert condition
      const shouldAlert = this.evaluateAlertCondition(
        currentValue, 
        threshold, 
        condition, 
        userId, 
        metricType, 
        rule.comparison_period
      );

      if (await shouldAlert) {
        // Check if we're in quiet hours
        if (this.isInQuietHours(rule.quiet_hours)) {
          logger.debug('Alert suppressed due to quiet hours', {
            alertId: rule.id,
            userId
          });
          return;
        }

        // Create alert event
        await this.createAlertEvent({
          alertConfigId: rule.id,
          userId,
          metricValue: currentValue,
          thresholdValue: threshold,
          conditionMet: condition,
          severity: this.calculateSeverity(currentValue, threshold, condition, rule.priority)
        });

        // Send notifications
        await this.sendAlertNotifications(rule, {
          currentValue,
          threshold,
          condition,
          severity: this.calculateSeverity(currentValue, threshold, condition, rule.priority)
        });

        // Update rate limiting
        await this.updateRateLimit(userId, rule.id);
      }
    } catch (error) {
      logger.error('Failed to check alert', { error, alertId: rule.id, userId });
    }
  }

  /**
   * Get current metric value from TimescaleDB
   */
  private async getCurrentMetricValue(userId: string, metricType: string): Promise<number | null> {
    try {
      let query: string;
      
      switch (metricType) {
        case 'profile_views':
          query = `
            SELECT profile_views as value
            FROM analytics.profile_metrics
            WHERE user_id = $1
            ORDER BY timestamp DESC
            LIMIT 1
          `;
          break;
          
        case 'connections_count':
          query = `
            SELECT connections_count as value
            FROM analytics.profile_metrics
            WHERE user_id = $1
            ORDER BY timestamp DESC
            LIMIT 1
          `;
          break;
          
        case 'completeness_score':
          query = `
            SELECT completeness_score as value
            FROM analytics.profile_metrics
            WHERE user_id = $1
            ORDER BY timestamp DESC
            LIMIT 1
          `;
          break;
          
        case 'engagement_rate':
          query = `
            SELECT engagement_rate as value
            FROM analytics.profile_metrics
            WHERE user_id = $1
            ORDER BY timestamp DESC
            LIMIT 1
          `;
          break;
          
        case 'influence_score':
          query = `
            SELECT influence_score as value
            FROM analytics.profile_metrics
            WHERE user_id = $1
            ORDER BY timestamp DESC
            LIMIT 1
          `;
          break;
          
        default:
          logger.warn('Unknown metric type for alert', { metricType, userId });
          return null;
      }

      const result = await database.query(query, [userId]);
      return result.rows.length > 0 ? parseFloat(result.rows[0].value) : null;
    } catch (error) {
      logger.error('Failed to get current metric value', { error, userId, metricType });
      return null;
    }
  }

  /**
   * Evaluate alert condition
   */
  private async evaluateAlertCondition(
    currentValue: number,
    threshold: number,
    condition: string,
    userId: string,
    metricType: string,
    comparisonPeriod: string
  ): Promise<boolean> {
    switch (condition) {
      case 'above':
        return currentValue > threshold;
        
      case 'below':
        return currentValue < threshold;
        
      case 'change':
        // Compare with value from comparison period ago
        const previousValue = await this.getPreviousMetricValue(
          userId, 
          metricType, 
          comparisonPeriod
        );
        if (previousValue === null) return false;
        
        const changePercent = ((currentValue - previousValue) / previousValue) * 100;
        return Math.abs(changePercent) > threshold;
        
      case 'trend':
        // Use TimescaleDB trend calculation
        const trendValue = await this.getTrendValue(userId, metricType, comparisonPeriod);
        return trendValue !== null && Math.abs(trendValue) > threshold;
        
      default:
        return false;
    }
  }

  /**
   * Get previous metric value for comparison
   */
  private async getPreviousMetricValue(
    userId: string, 
    metricType: string, 
    period: string
  ): Promise<number | null> {
    try {
      const query = `
        SELECT ${metricType} as value
        FROM analytics.profile_metrics
        WHERE user_id = $1
          AND timestamp <= NOW() - INTERVAL '${period}'
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await database.query(query, [userId]);
      return result.rows.length > 0 ? parseFloat(result.rows[0].value) : null;
    } catch (error) {
      logger.error('Failed to get previous metric value', { error, userId, metricType, period });
      return null;
    }
  }

  /**
   * Get trend value using TimescaleDB function
   */
  private async getTrendValue(
    userId: string, 
    metricType: string, 
    period: string
  ): Promise<number | null> {
    try {
      const days = this.parsePeriodToDays(period);
      const result = await database.query(
        'SELECT analytics.calculate_trend($1, $2, $3) as trend',
        [userId, metricType, days]
      );

      return result.rows.length > 0 ? parseFloat(result.rows[0].trend) : null;
    } catch (error) {
      logger.error('Failed to get trend value', { error, userId, metricType, period });
      return null;
    }
  }

  /**
   * Parse period string to days
   */
  private parsePeriodToDays(period: string): number {
    const match = period.match(/(\d+)\s*(day|hour|week|month)s?/i);
    if (!match) return 7; // Default to 7 days

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'hour': return Math.max(1, Math.round(value / 24));
      case 'day': return value;
      case 'week': return value * 7;
      case 'month': return value * 30;
      default: return 7;
    }
  }

  /**
   * Calculate alert severity
   */
  private calculateSeverity(
    currentValue: number, 
    threshold: number, 
    condition: string, 
    basePriority: string
  ): string {
    let severity = basePriority;
    
    // Escalate severity based on how far the value exceeds threshold
    const ratio = condition === 'above' 
      ? currentValue / threshold 
      : threshold / currentValue;

    if (ratio > 2) {
      severity = 'critical';
    } else if (ratio > 1.5) {
      severity = severity === 'low' ? 'medium' : 'high';
    }

    return severity;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(quietHours: any): boolean {
    if (!quietHours || !quietHours.enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    
    const startHour = quietHours.startHour || 22;
    const endHour = quietHours.endHour || 6;

    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  /**
   * Check if alert is rate limited
   */
  private async isRateLimited(userId: string, alertId: string): Promise<boolean> {
    try {
      const key = `alert_rate_limit:${userId}:${alertId}`;
      const count = await redis.get(key);
      
      return count ? parseInt(count) >= this.MAX_ALERTS_PER_WINDOW : false;
    } catch (error) {
      logger.error('Failed to check rate limit', { error, userId, alertId });
      return false;
    }
  }

  /**
   * Update rate limiting for alert
   */
  private async updateRateLimit(userId: string, alertId: string): Promise<void> {
    try {
      const key = `alert_rate_limit:${userId}:${alertId}`;
      const current = await redis.get(key);
      
      if (current) {
        await redis.incr(key);
      } else {
        await redis.setex(key, Math.floor(this.RATE_LIMIT_WINDOW / 1000), 1);
      }
    } catch (error) {
      logger.error('Failed to update rate limit', { error, userId, alertId });
    }
  }

  /**
   * Create alert event in database
   */
  private async createAlertEvent(alertData: {
    alertConfigId: string;
    userId: string;
    metricValue: number;
    thresholdValue: number;
    conditionMet: string;
    severity: string;
  }): Promise<string> {
    try {
      const query = `
        INSERT INTO analytics.alert_history (
          alert_config_id, user_id, metric_value, threshold_value,
          condition_met, severity, notifications_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const values = [
        alertData.alertConfigId,
        alertData.userId,
        alertData.metricValue,
        alertData.thresholdValue,
        alertData.conditionMet,
        alertData.severity,
        JSON.stringify([])
      ];

      const result = await database.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to create alert event', { error, alertData });
      throw error;
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(rule: any, alertData: any): Promise<void> {
    const notificationMethods = JSON.parse(rule.notification_methods || '["websocket"]');
    const notifications: string[] = [];

    for (const method of notificationMethods) {
      try {
        switch (method) {
          case 'websocket':
            await this.sendWebSocketAlert(rule, alertData);
            notifications.push('websocket');
            break;
            
          case 'email':
            // Placeholder for email notification
            logger.info('Email notification would be sent', { 
              userId: rule.user_id,
              alertName: rule.alert_name
            });
            notifications.push('email');
            break;
            
          case 'webhook':
            // Placeholder for webhook notification
            logger.info('Webhook notification would be sent', { 
              userId: rule.user_id,
              alertName: rule.alert_name
            });
            notifications.push('webhook');
            break;
        }
      } catch (error) {
        logger.error('Failed to send notification via method', { 
          error, 
          method, 
          userId: rule.user_id 
        });
      }
    }

    // Update alert history with sent notifications
    if (notifications.length > 0) {
      await database.query(`
        UPDATE analytics.alert_history 
        SET notifications_sent = $1
        WHERE alert_config_id = $2 
          AND user_id = $3 
          AND timestamp >= NOW() - INTERVAL '1 minute'
      `, [JSON.stringify(notifications), rule.id, rule.user_id]);
    }
  }

  /**
   * Send WebSocket alert notification
   */
  private async sendWebSocketAlert(rule: any, alertData: any): Promise<void> {
    const alertMessage = {
      alertId: rule.id,
      alertName: rule.alert_name,
      metricType: rule.metric_type,
      currentValue: alertData.currentValue,
      threshold: alertData.threshold,
      condition: alertData.condition,
      severity: alertData.severity,
      priority: rule.priority,
      message: this.generateAlertMessage(rule, alertData),
      timestamp: new Date()
    };

    this.websocketService.sendAlert(rule.user_id, alertMessage);

    logger.info('WebSocket alert sent', {
      userId: rule.user_id,
      alertName: rule.alert_name,
      severity: alertData.severity
    });
  }

  /**
   * Generate human-readable alert message
   */
  private generateAlertMessage(rule: any, alertData: any): string {
    const metric = rule.metric_type.replace('_', ' ');
    const current = alertData.currentValue.toFixed(2);
    const threshold = alertData.threshold.toFixed(2);
    
    switch (rule.condition) {
      case 'above':
        return `${metric} is ${current}, which is above the threshold of ${threshold}`;
      case 'below':
        return `${metric} is ${current}, which is below the threshold of ${threshold}`;
      case 'change':
        return `${metric} has changed significantly to ${current} (threshold: ${threshold}%)`;
      case 'trend':
        return `${metric} trend of ${current}% exceeds threshold of ${threshold}%`;
      default:
        return `${metric} alert triggered: ${current} (threshold: ${threshold})`;
    }
  }

  /**
   * Schedule maintenance tasks
   */
  private scheduleMaintenanceTasks(): void {
    // Clean up old alert history every day
    cron.schedule('0 2 * * *', async () => {
      try {
        const result = await database.query(`
          DELETE FROM analytics.alert_history 
          WHERE timestamp < NOW() - INTERVAL '30 days'
        `);
        
        if (result.rowCount && result.rowCount > 0) {
          logger.info('Cleaned up old alert history', { deletedCount: result.rowCount });
        }
      } catch (error) {
        logger.error('Failed to cleanup old alert history', { error });
      }
    });

    // Update alert statistics every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.updateAlertStatistics();
      } catch (error) {
        logger.error('Failed to update alert statistics', { error });
      }
    });

    logger.info('Alert maintenance tasks scheduled');
  }

  /**
   * Update alert statistics
   */
  private async updateAlertStatistics(): Promise<void> {
    try {
      const stats = await database.query(`
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) FILTER (WHERE acknowledged = false) as unacknowledged,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_alerts
        FROM analytics.alert_history
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
      `);

      const activeRules = await database.query(`
        SELECT 
          COUNT(*) as active_rules,
          COUNT(DISTINCT user_id) as users_with_rules
        FROM analytics.alert_configs
        WHERE enabled = true
      `);

      logger.info('Alert statistics updated', {
        ...stats.rows[0],
        ...activeRules.rows[0],
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to update alert statistics', { error });
    }
  }

  /**
   * Get alerting service statistics
   */
  public async getAlertingStats(): Promise<any> {
    try {
      const [alertStats, ruleStats] = await Promise.all([
        database.query(`
          SELECT 
            COUNT(*) as total_alerts_24h,
            COUNT(DISTINCT user_id) as unique_users_24h,
            COUNT(*) FILTER (WHERE acknowledged = false) as unacknowledged,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical_alerts
          FROM analytics.alert_history
          WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `),
        database.query(`
          SELECT 
            COUNT(*) as total_rules,
            COUNT(*) FILTER (WHERE enabled = true) as active_rules,
            COUNT(DISTINCT user_id) as users_with_rules
          FROM analytics.alert_configs
        `)
      ]);

      return {
        alerts: alertStats.rows[0],
        rules: ruleStats.rows[0],
        serviceStatus: {
          monitoring: this.alertCheckInterval !== null,
          checkInterval: this.ALERT_CHECK_INTERVAL,
          rateLimitWindow: this.RATE_LIMIT_WINDOW,
          maxAlertsPerWindow: this.MAX_ALERTS_PER_WINDOW
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get alerting stats', { error });
      return {
        error: 'Failed to fetch alerting statistics',
        timestamp: new Date()
      };
    }
  }

  /**
   * Acknowledge alert
   */
  public async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await database.query(`
        UPDATE analytics.alert_history 
        SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $1
        WHERE id = $2 AND user_id = $1
      `, [userId, alertId]);

      logger.info('Alert acknowledged', { alertId, userId });
    } catch (error) {
      logger.error('Failed to acknowledge alert', { error, alertId, userId });
      throw error;
    }
  }

  /**
   * Shutdown the alerting service
   */
  public async shutdown(): Promise<void> {
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    logger.info('Alerting service shut down');
  }
}