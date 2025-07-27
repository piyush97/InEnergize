import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { logger } from '@/config/logger';
import { database } from '@/config/database';
import { redis } from '@/config/redis';
import { WebSocketMessage } from '@/types/analytics';
import cron from 'node-cron';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  subscriptions?: Set<string>;
  lastActivity?: Date;
  connectionTime?: Date;
}

interface SubscriptionConfig {
  userId: string;
  metrics: string[];
  updateFrequency: number; // seconds
  filters?: Record<string, any>;
  alertThresholds?: Record<string, number>;
}

interface LiveMetrics {
  profileViews: number;
  connections: number;
  completenessScore: number;
  engagementRate: number;
  recentActivities: any[];
  trends: Record<string, number>;
  lastUpdated: Date;
}

export class EnhancedWebSocketService {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private subscriptions: Map<string, SubscriptionConfig> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  
  private readonly METRICS_UPDATE_INTERVAL = 5000; // 5 seconds
  private readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Initialize Enhanced WebSocket server with TimescaleDB integration
   */
  public initialize(port: number): void {
    this.wss = new WebSocket.Server({
      port,
      verifyClient: this.verifyClient.bind(this),
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 6
        }
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    this.startMetricsStreaming();
    this.startAlertMonitoring();
    this.scheduleCleanupTasks();

    logger.info('Enhanced WebSocket server initialized', { 
      port,
      features: ['real-time metrics', 'alerts', 'subscriptions', 'TimescaleDB integration']
    });
  }

  /**
   * Verify client authentication with enhanced security
   */
  private verifyClient(info: any): boolean {
    try {
      const url = new URL(info.req.url, 'ws://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided', {
          origin: info.origin,
          userAgent: info.req.headers['user-agent']
        });
        return false;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      
      // Enhanced validation
      if (!decoded.userId || !decoded.exp || decoded.exp < Date.now() / 1000) {
        logger.warn('WebSocket connection rejected: Invalid or expired token');
        return false;
      }

      info.req.userId = decoded.userId;
      info.req.userRole = decoded.role || 'user';
      
      return true;
    } catch (error) {
      logger.warn('WebSocket connection rejected: Token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Handle new WebSocket connection with enhanced features
   */
  private async handleConnection(ws: AuthenticatedWebSocket, req: any): Promise<void> {
    const userId = req.userId;
    const userRole = req.userRole;
    
    ws.userId = userId;
    ws.isAlive = true;
    ws.subscriptions = new Set();
    ws.lastActivity = new Date();
    ws.connectionTime = new Date();

    // Add client to user's connection set
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);

    logger.info('Enhanced WebSocket client connected', { 
      userId, 
      userRole,
      totalConnections: this.getTotalConnections(),
      userConnections: this.getUserConnectionCount(userId)
    });

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivity = new Date();
    });

    // Handle messages from client
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
        ws.lastActivity = new Date();
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error, data, userId });
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { error, userId });
      this.handleDisconnection(ws);
    });

    // Send welcome message with real-time data
    await this.sendWelcomeMessage(ws);
  }

  /**
   * Handle incoming messages with enhanced subscription management
   */
  private async handleMessage(ws: AuthenticatedWebSocket, message: any): Promise<void> {
    const { type, data } = message;
    const userId = ws.userId!;

    try {
      switch (type) {
        case 'subscribe':
          await this.handleSubscription(ws, data);
          break;
        
        case 'unsubscribe':
          await this.handleUnsubscription(ws, data);
          break;
        
        case 'get_live_metrics':
          await this.sendLiveMetrics(ws);
          break;
          
        case 'get_real_time_summary':
          await this.sendRealTimeSummary(ws);
          break;
          
        case 'set_alert_threshold':
          await this.setAlertThreshold(ws, data);
          break;
        
        case 'ping':
          this.sendToClient(ws, {
            type: 'pong',
            data: { timestamp: new Date(), latency: Date.now() - data.timestamp },
            timestamp: new Date()
          });
          break;
        
        default:
          logger.warn('Unknown WebSocket message type', { type, userId });
          this.sendError(ws, `Unknown message type: ${type}`);
      }
    } catch (error) {
      logger.error('Failed to handle WebSocket message', { error, type, userId });
      this.sendError(ws, 'Internal server error');
    }
  }

  /**
   * Handle subscription to metrics
   */
  private async handleSubscription(ws: AuthenticatedWebSocket, data: any): Promise<void> {
    const userId = ws.userId!;
    const { metrics = [], updateFrequency = 5, filters = {} } = data;

    // Validate subscription request
    if (!Array.isArray(metrics) || metrics.length === 0) {
      this.sendError(ws, 'Invalid metrics subscription');
      return;
    }

    // Store subscription configuration
    const subscriptionKey = `${userId}_${Date.now()}`;
    this.subscriptions.set(subscriptionKey, {
      userId,
      metrics,
      updateFrequency: Math.max(1, Math.min(updateFrequency, 60)), // 1-60 seconds
      filters,
      alertThresholds: {}
    });

    ws.subscriptions!.add(subscriptionKey);

    // Send immediate data
    await this.sendSubscriptionData(ws, subscriptionKey);

    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      data: { 
        subscriptionKey,
        metrics,
        updateFrequency: this.subscriptions.get(subscriptionKey)!.updateFrequency
      },
      timestamp: new Date()
    });

    logger.info('Client subscribed to metrics', { 
      userId, 
      metrics, 
      updateFrequency,
      subscriptionKey 
    });
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscription(ws: AuthenticatedWebSocket, data: any): void {
    const userId = ws.userId!;
    const { subscriptionKey } = data;

    if (subscriptionKey && ws.subscriptions!.has(subscriptionKey)) {
      ws.subscriptions!.delete(subscriptionKey);
      this.subscriptions.delete(subscriptionKey);

      this.sendToClient(ws, {
        type: 'unsubscription_confirmed',
        data: { subscriptionKey },
        timestamp: new Date()
      });

      logger.info('Client unsubscribed from metrics', { userId, subscriptionKey });
    }
  }

  /**
   * Send live metrics data from TimescaleDB
   */
  private async sendLiveMetrics(ws: AuthenticatedWebSocket): Promise<void> {
    const userId = ws.userId!;

    try {
      const cacheKey = `live_metrics:${userId}`;
      let metrics = await redis.get(cacheKey);
      
      if (!metrics) {
        // Fetch from TimescaleDB
        const result = await database.query(`
          SELECT * FROM analytics.get_real_time_summary($1)
        `, [userId]);

        if (result.rows.length > 0) {
          const row = result.rows[0];
          metrics = JSON.stringify({
            profileViews: parseInt(row.current_profile_views) || 0,
            connections: parseInt(row.current_connections) || 0,
            completenessScore: parseFloat(row.current_completeness) || 0,
            engagementCount: parseInt(row.recent_engagement_count) || 0,
            trendIndicator: row.trend_indicator || 'stable',
            lastUpdated: row.last_updated || new Date()
          });

          // Cache for 30 seconds
          await redis.setex(cacheKey, 30, metrics);
        } else {
          metrics = JSON.stringify({
            profileViews: 0,
            connections: 0,
            completenessScore: 0,
            engagementCount: 0,
            trendIndicator: 'stable',
            lastUpdated: new Date()
          });
        }
      }

      this.sendToClient(ws, {
        type: 'live_metrics',
        data: JSON.parse(metrics),
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to send live metrics', { error, userId });
      this.sendError(ws, 'Failed to fetch live metrics');
    }
  }

  /**
   * Send real-time summary with trends
   */
  private async sendRealTimeSummary(ws: AuthenticatedWebSocket): Promise<void> {
    const userId = ws.userId!;

    try {
      // Get current metrics
      const currentMetrics = await database.query(`
        SELECT 
          profile_views,
          connections_count,
          completeness_score,
          engagement_rate,
          influence_score
        FROM analytics.profile_metrics
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT 1
      `, [userId]);

      // Get recent activities
      const recentActivities = await database.query(`
        SELECT 
          event_type,
          event_data,
          timestamp
        FROM analytics.real_time_events
        WHERE user_id = $1
          AND timestamp >= NOW() - INTERVAL '1 hour'
        ORDER BY timestamp DESC
        LIMIT 10
      `, [userId]);

      // Calculate trends
      const trends = await database.query(`
        SELECT 
          'profileViews' as metric,
          analytics.calculate_trend($1, 'profile_views', 7) as trend_7d,
          analytics.calculate_trend($1, 'profile_views', 1) as trend_24h
        UNION ALL
        SELECT 
          'connections' as metric,
          analytics.calculate_trend($1, 'connections_count', 7) as trend_7d,
          analytics.calculate_trend($1, 'connections_count', 1) as trend_24h
        UNION ALL
        SELECT 
          'completeness' as metric,
          analytics.calculate_trend($1, 'completeness_score', 7) as trend_7d,
          analytics.calculate_trend($1, 'completeness_score', 1) as trend_24h
      `, [userId, userId, userId]);

      const summary = {
        currentMetrics: currentMetrics.rows[0] || {},
        recentActivities: recentActivities.rows,
        trends: trends.rows.reduce((acc: any, row: any) => {
          acc[row.metric] = {
            '24h': parseFloat(row.trend_24h) || 0,
            '7d': parseFloat(row.trend_7d) || 0
          };
          return acc;
        }, {}),
        timestamp: new Date()
      };

      this.sendToClient(ws, {
        type: 'real_time_summary',
        data: summary,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to send real-time summary', { error, userId });
      this.sendError(ws, 'Failed to fetch real-time summary');
    }
  }

  /**
   * Set alert threshold for user
   */
  private async setAlertThreshold(ws: AuthenticatedWebSocket, data: any): Promise<void> {
    const userId = ws.userId!;
    const { metric, threshold, condition } = data;

    try {
      await database.query(`
        INSERT INTO analytics.alert_configs (
          user_id, alert_name, metric_type, threshold, condition, enabled
        ) VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (user_id, metric_type) 
        DO UPDATE SET 
          threshold = EXCLUDED.threshold,
          condition = EXCLUDED.condition,
          updated_at = NOW()
      `, [userId, `${metric}_alert`, metric, threshold, condition]);

      this.sendToClient(ws, {
        type: 'alert_threshold_set',
        data: { metric, threshold, condition },
        timestamp: new Date()
      });

      logger.info('Alert threshold set', { userId, metric, threshold, condition });

    } catch (error) {
      logger.error('Failed to set alert threshold', { error, userId });
      this.sendError(ws, 'Failed to set alert threshold');
    }
  }

  /**
   * Send subscription data based on configuration
   */
  private async sendSubscriptionData(ws: AuthenticatedWebSocket, subscriptionKey: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return;

    try {
      const data: any = {};

      for (const metric of subscription.metrics) {
        switch (metric) {
          case 'profile_views':
            const profileViews = await this.getMetricTimeSeries(subscription.userId, 'profile_views', '1 hour');
            data.profileViews = profileViews;
            break;
            
          case 'connections':
            const connections = await this.getMetricTimeSeries(subscription.userId, 'connections_count', '1 hour');
            data.connections = connections;
            break;
            
          case 'engagement':
            const engagement = await this.getEngagementData(subscription.userId, '1 hour');
            data.engagement = engagement;
            break;
        }
      }

      this.sendToClient(ws, {
        type: 'subscription_data',
        data: {
          subscriptionKey,
          metrics: data,
          updateFrequency: subscription.updateFrequency
        },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Failed to send subscription data', { error, subscriptionKey });
    }
  }

  /**
   * Get metric time series data
   */
  private async getMetricTimeSeries(userId: string, metric: string, interval: string): Promise<any[]> {
    const query = `
      SELECT 
        time_bucket('5 minutes', timestamp) as bucket,
        AVG(${metric}) as value
      FROM analytics.profile_metrics
      WHERE user_id = $1
        AND timestamp >= NOW() - INTERVAL '${interval}'
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const result = await database.query(query, [userId]);
    return result.rows.map((row: any) => ({
      timestamp: row.bucket,
      value: parseFloat(row.value) || 0
    }));
  }

  /**
   * Get engagement data
   */
  private async getEngagementData(userId: string, interval: string): Promise<any> {
    const result = await database.query(`
      SELECT 
        type,
        SUM(value) as total_value,
        COUNT(*) as count
      FROM analytics.engagement_metrics
      WHERE user_id = $1
        AND timestamp >= NOW() - INTERVAL '${interval}'
      GROUP BY type
      ORDER BY total_value DESC
    `, [userId]);

    return {
      totalEngagements: result.rows.reduce((sum, row) => sum + parseInt(row.total_value), 0),
      byType: result.rows.map((row: any) => ({
        type: row.type,
        value: parseInt(row.total_value),
        count: parseInt(row.count)
      }))
    };
  }

  /**
   * Send welcome message with initial data
   */
  private async sendWelcomeMessage(ws: AuthenticatedWebSocket): Promise<void> {
    const userId = ws.userId!;

    this.sendToClient(ws, {
      type: 'connection_status',
      data: { 
        status: 'connected',
        userId,
        features: [
          'real-time metrics',
          'live subscriptions', 
          'alert notifications',
          'TimescaleDB integration'
        ],
        timestamp: new Date()
      },
      timestamp: new Date()
    });

    // Send initial live metrics
    await this.sendLiveMetrics(ws);
  }

  /**
   * Start metrics streaming for all subscriptions
   */
  private startMetricsStreaming(): void {
    this.metricsInterval = setInterval(async () => {
      for (const [subscriptionKey, subscription] of this.subscriptions) {
        try {
          // Find all connections for this subscription
          const userConnections = this.clients.get(subscription.userId);
          if (!userConnections) continue;

          for (const ws of userConnections) {
            if (ws.subscriptions?.has(subscriptionKey) && ws.readyState === WebSocket.OPEN) {
              await this.sendSubscriptionData(ws, subscriptionKey);
            }
          }
        } catch (error) {
          logger.error('Failed to stream metrics for subscription', { error, subscriptionKey });
        }
      }
    }, this.METRICS_UPDATE_INTERVAL);

    logger.info('Metrics streaming started', { interval: this.METRICS_UPDATE_INTERVAL });
  }

  /**
   * Start alert monitoring
   */
  private startAlertMonitoring(): void {
    // Check for alerts every 30 seconds
    this.alertCheckInterval = setInterval(async () => {
      try {
        const alerts = await database.query(`
          SELECT 
            ah.user_id,
            ac.alert_name,
            ac.metric_type,
            ah.metric_value,
            ah.threshold_value,
            ah.condition_met,
            ah.severity
          FROM analytics.alert_history ah
          JOIN analytics.alert_configs ac ON ah.alert_config_id = ac.id
          WHERE ah.acknowledged = false
            AND ah.timestamp >= NOW() - INTERVAL '1 minute'
        `);

        for (const alert of alerts.rows) {
          const userConnections = this.clients.get(alert.user_id);
          if (userConnections) {
            for (const ws of userConnections) {
              if (ws.readyState === WebSocket.OPEN) {
                this.sendToClient(ws, {
                  type: 'alert',
                  userId: alert.user_id,
                  data: {
                    alertName: alert.alert_name,
                    metricType: alert.metric_type,
                    currentValue: alert.metric_value,
                    threshold: alert.threshold_value,
                    condition: alert.condition_met,
                    severity: alert.severity,
                    timestamp: new Date()
                  },
                  timestamp: new Date()
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error('Failed to check alerts', { error });
      }
    }, 30000);

    logger.info('Alert monitoring started');
  }

  /**
   * Handle client disconnection with cleanup
   */
  private handleDisconnection(ws: AuthenticatedWebSocket, code?: number, reason?: Buffer): void {
    const userId = ws.userId;
    const connectionDuration = ws.connectionTime ? Date.now() - ws.connectionTime.getTime() : 0;
    
    // Clean up subscriptions
    if (ws.subscriptions) {
      for (const subscriptionKey of ws.subscriptions) {
        this.subscriptions.delete(subscriptionKey);
      }
    }
    
    if (userId && this.clients.has(userId)) {
      this.clients.get(userId)!.delete(ws);
      
      // Remove user entry if no more connections
      if (this.clients.get(userId)!.size === 0) {
        this.clients.delete(userId);
      }
    }

    logger.info('Enhanced WebSocket client disconnected', { 
      userId,
      code,
      reason: reason?.toString(),
      connectionDuration: `${Math.round(connectionDuration / 1000)}s`,
      totalConnections: this.getTotalConnections()
    });
  }

  /**
   * Send error message to client
   */
  private sendError(ws: AuthenticatedWebSocket, error: string): void {
    this.sendToClient(ws, {
      type: 'error',
      data: { error, timestamp: new Date() },
      timestamp: new Date()
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send message to client', { error, userId: ws.userId });
      }
    }
  }

  /**
   * Schedule cleanup tasks
   */
  private scheduleCleanupTasks(): void {
    // Clean up stale subscriptions every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      const staleSubscriptions: string[] = [];
      
      for (const [subscriptionKey, subscription] of this.subscriptions) {
        const userConnections = this.clients.get(subscription.userId);
        if (!userConnections || userConnections.size === 0) {
          staleSubscriptions.push(subscriptionKey);
        }
      }
      
      staleSubscriptions.forEach(key => this.subscriptions.delete(key));
      
      if (staleSubscriptions.length > 0) {
        logger.info('Cleaned up stale subscriptions', { count: staleSubscriptions.length });
      }
    });

    // Log connection statistics every hour
    cron.schedule('0 * * * *', () => {
      logger.info('WebSocket connection statistics', {
        totalConnections: this.getTotalConnections(),
        uniqueUsers: this.clients.size,
        activeSubscriptions: this.subscriptions.size,
        uptime: process.uptime()
      });
    });
  }

  /**
   * Start heartbeat to check client connections
   */
  private startHeartbeat(): void {
    const interval = parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000');
    
    this.pingInterval = setInterval(() => {
      this.clients.forEach((userConnections, userId) => {
        userConnections.forEach((ws) => {
          if (!ws.isAlive) {
            logger.debug('WebSocket client failed heartbeat', { userId });
            ws.terminate();
            this.handleDisconnection(ws);
          } else {
            ws.isAlive = false;
            ws.ping();
          }
        });
      });
    }, interval);

    logger.info('Enhanced WebSocket heartbeat started', { interval });
  }

  // Existing public methods with enhanced logging
  public sendToUser(userId: string, message: WebSocketMessage): void {
    const userConnections = this.clients.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      logger.debug('No WebSocket connections for user', { userId });
      return;
    }

    const messageString = JSON.stringify(message);
    let sentCount = 0;

    userConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageString);
          sentCount++;
        } catch (error) {
          logger.error('Failed to send message to user connection', { error, userId });
        }
      }
    });

    logger.debug('Message sent to user', { userId, sentCount, messageType: message.type });
  }

  public sendMetricUpdate(userId: string, metricType: string, data: any): void {
    this.sendToUser(userId, {
      type: 'metric_update',
      userId,
      data: {
        metricType,
        ...data
      },
      timestamp: new Date()
    });
  }

  public sendRealTimeData(userId: string, data: any): void {
    this.sendToUser(userId, {
      type: 'real_time_data',
      userId,
      data,
      timestamp: new Date()
    });
  }

  public sendAlert(userId: string, alert: any): void {
    this.sendToUser(userId, {
      type: 'alert',
      userId,
      data: alert,
      timestamp: new Date()
    });
  }

  public getUserConnectionCount(userId: string): number {
    return this.clients.get(userId)?.size || 0;
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  public getTotalConnections(): number {
    let total = 0;
    this.clients.forEach((userConnections) => {
      total += userConnections.size;
    });
    return total;
  }

  /**
   * Get service statistics
   */
  public getServiceStats(): any {
    return {
      totalConnections: this.getTotalConnections(),
      uniqueUsers: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date()
    };
  }

  /**
   * Close all connections and shutdown server
   */
  public close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    this.subscriptions.clear();
    logger.info('Enhanced WebSocket server closed');
  }
}