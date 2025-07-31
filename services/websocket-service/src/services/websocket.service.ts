import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import {
  WebSocketUser,
  WebSocketChannel,
  WebSocketMessage,
  WebSocketConfig,
  SubscriptionLimits,
  AutomationStatusUpdate,
  SafetyAlert,
  ProfileMetrics,
  QueueStatus,
  SystemNotification,
  EmergencyStopTrigger,
  AutomationHealthCheck
} from '@/types/websocket';

export class WebSocketService extends EventEmitter {
  private io: SocketIOServer;
  private redis: Redis;
  private subscriber: Redis;
  private config: WebSocketConfig;
  private connectedUsers: Map<string, WebSocketUser>;
  private userConnections: Map<string, Set<string>>; // userId -> socketIds
  private channels: Map<string, WebSocketChannel>;
  private updateIntervals: Map<string, NodeJS.Timeout>;
  private automationEngine: any; // LinkedInAutomationEngine reference

  // Enhanced subscription tier limits for Phase 3
  private readonly SUBSCRIPTION_LIMITS: SubscriptionLimits = {
    FREE: {
      maxChannels: 5,
      updateInterval: 30000, // 30 seconds
      maxConcurrentConnections: 2
    },
    BASIC: {
      maxChannels: 8,
      updateInterval: 15000, // 15 seconds
      maxConcurrentConnections: 3
    },
    PRO: {
      maxChannels: 15,
      updateInterval: 5000, // 5 seconds
      maxConcurrentConnections: 5
    },
    ENTERPRISE: {
      maxChannels: 25,
      updateInterval: 1000, // 1 second
      maxConcurrentConnections: 10
    }
  };

  constructor(server: HttpServer, config: WebSocketConfig) {
    super();
    this.config = config;
    this.connectedUsers = new Map();
    this.userConnections = new Map();
    this.channels = new Map();
    this.updateIntervals = new Map();

    // Initialize Redis connections
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });

    this.subscriber = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });

    // Initialize Socket.IO with enterprise-grade configuration
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors?.origin || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 2e6, // 2MB for larger automation data
      allowEIO3: true,
      cookie: {
        name: 'inergize-automation-ws',
        httpOnly: true,
        sameSite: 'strict'
      }
    });

    this.initializeChannels();
    this.setupSocketHandlers();
    this.setupRedisSubscriptions();
    this.startSystemMonitoring();
    
    console.log('Enhanced WebSocket service initialized for automation dashboard on port', config.port);
  }

  /**
   * Set automation engine reference for real-time data
   */
  setAutomationEngine(engine: any): void {
    this.automationEngine = engine;
    
    // Listen to automation engine events
    engine.on('jobScheduled', (data: any) => {
      this.broadcastToUser(data.userId, 'automation_job_scheduled', {
        jobId: data.jobId,
        type: data.type,
        scheduledAt: data.scheduledAt,
        timestamp: new Date()
      });
    });

    engine.on('emergencyStopTriggered', (data: any) => {
      this.broadcastToUser(data.userId, 'emergency_stop_activated', {
        reason: data.reason,
        triggeredBy: data.triggeredBy,
        timestamp: new Date()
      });
    });

    engine.on('systemEmergencyStop', (data: any) => {
      this.broadcastSystemNotification({
        id: `system_stop_${Date.now()}`,
        type: 'EMERGENCY',
        title: 'System Emergency Stop',
        message: `System automation has been stopped: ${data.reason}`,
        timestamp: new Date(),
        priority: 'CRITICAL'
      });
    });
  }

  /**
   * Initialize enhanced channels for automation dashboard
   */
  private initializeChannels(): void {
    const automationChannels: WebSocketChannel[] = [
      {
        name: 'automation_status',
        requiredTier: 'FREE',
        updateInterval: 10000, // 10 seconds
        maxSubscribers: 1000,
        description: 'Real-time automation job status and queue updates'
      },
      {
        name: 'safety_alerts',
        requiredTier: 'FREE',
        updateInterval: 2000, // 2 seconds - critical for safety
        maxSubscribers: 1000,
        description: 'Safety monitoring alerts and compliance warnings'
      },
      {
        name: 'profile_metrics',
        requiredTier: 'BASIC',
        updateInterval: 30000, // 30 seconds
        maxSubscribers: 500,
        description: 'LinkedIn profile performance metrics'
      },
      {
        name: 'queue_status',
        requiredTier: 'PRO',
        updateInterval: 5000, // 5 seconds
        maxSubscribers: 200,
        description: 'Detailed automation queue status and job progress'
      },
      {
        name: 'system_notifications',
        requiredTier: 'FREE',
        updateInterval: 60000, // 1 minute
        maxSubscribers: 1000,
        description: 'System-wide notifications and announcements'
      },
      {
        name: 'real_time_analytics',
        requiredTier: 'ENTERPRISE',
        updateInterval: 1000, // 1 second
        maxSubscribers: 50,
        description: 'Real-time automation analytics and performance data'
      },
      {
        name: 'template_analytics',
        requiredTier: 'PRO',
        updateInterval: 15000, // 15 seconds
        maxSubscribers: 100,
        description: 'Template performance and success rate analytics'
      },
      {
        name: 'health_dashboard',
        requiredTier: 'BASIC',
        updateInterval: 20000, // 20 seconds
        maxSubscribers: 300,
        description: 'System health monitoring and status updates'
      },
      {
        name: 'compliance_monitoring',
        requiredTier: 'BASIC',
        updateInterval: 10000, // 10 seconds
        maxSubscribers: 500,
        description: 'LinkedIn compliance monitoring and risk assessment'
      }
    ];

    automationChannels.forEach(channel => {
      this.channels.set(channel.name, channel);
    });

    console.log(`Initialized ${automationChannels.length} automation WebSocket channels`);
  }

  /**
   * Setup enhanced Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        await this.authenticateSocket(socket);
        next();
      } catch (error) {
        console.error('Socket authentication failed:', error);
        next(new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Enhanced socket authentication with automation context
   */
  private async authenticateSocket(socket: Socket): Promise<void> {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                  socket.handshake.query.token;
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    try {
      const decoded = jwt.verify(token, this.config.jwt.secret) as any;
      
      // Validate user exists and check automation status
      const [userData, automationSettings] = await Promise.all([
        this.redis.get(`user:${decoded.userId}`),
        this.redis.get(`automation_settings:${decoded.userId}`)
      ]);
      
      if (!userData) {
        throw new Error('User not found or inactive');
      }

      const user = JSON.parse(userData);
      
      // Check subscription tier
      if (!this.SUBSCRIPTION_LIMITS[user.subscriptionTier as keyof SubscriptionLimits]) {
        throw new Error('Invalid subscription tier');
      }

      // Check concurrent connection limit
      const existingConnections = this.userConnections.get(decoded.userId)?.size || 0;
      const maxConnections = this.SUBSCRIPTION_LIMITS[user.subscriptionTier as keyof SubscriptionLimits].maxConcurrentConnections;
      
      if (existingConnections >= maxConnections) {
        throw new Error(`Maximum concurrent connections exceeded (${existingConnections}/${maxConnections})`);
      }

      // Store enhanced user info in socket
      socket.data.userId = decoded.userId;
      socket.data.subscriptionTier = user.subscriptionTier;
      socket.data.user = user;
      socket.data.automationEnabled = automationSettings ? JSON.parse(automationSettings) : null;
      
    } catch (error) {
      throw new Error(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle new socket connection with automation context
   */
  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId;
    const subscriptionTier = socket.data.subscriptionTier;
    const automationEnabled = socket.data.automationEnabled;
    
    console.log(`User ${userId} connected to automation dashboard (${subscriptionTier} tier, automation: ${automationEnabled ? 'enabled' : 'disabled'})`);

    // Create enhanced user object
    const user: WebSocketUser = {
      id: socket.id,
      socketId: socket.id,
      userId,
      subscriptionTier,
      subscribedChannels: [],
      connectedAt: new Date(),
      lastActivity: new Date(),
      automationEnabled: !!automationEnabled,
      clientInfo: {
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
      }
    };

    this.connectedUsers.set(socket.id, user);
    
    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socket.id);

    // Setup enhanced socket event handlers
    socket.on('subscribe', (data) => this.handleSubscription(socket, data));
    socket.on('unsubscribe', (data) => this.handleUnsubscription(socket, data));
    socket.on('emergency_stop', (data) => this.handleEmergencyStop(socket, data));
    socket.on('pause_automation', (data) => this.handlePauseAutomation(socket, data));
    socket.on('resume_automation', (data) => this.handleResumeAutomation(socket, data));
    socket.on('get_automation_status', () => this.handleAutomationStatusRequest(socket));
    socket.on('get_safety_metrics', () => this.handleSafetyMetricsRequest(socket));
    socket.on('get_queue_status', () => this.handleQueueStatusRequest(socket));
    socket.on('cancel_job', (data) => this.handleCancelJob(socket, data));
    socket.on('get_template_analytics', () => this.handleTemplateAnalyticsRequest(socket));
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date(), serverTime: Date.now() });
      this.updateUserActivity(socket.id);
    });
    
    socket.on('disconnect', (reason) => this.handleDisconnection(socket, reason));

    // Send initial automation dashboard data
    this.sendInitialAutomationData(socket);
    
    // Emit connection event
    this.emit('userConnected', { userId, socketId: socket.id, automationEnabled });
  }

  /**
   * Handle automation-specific subscriptions
   */
  private async handleSubscription(socket: Socket, data: { channel: string; options?: any }): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    const { channel, options } = data;
    const channelConfig = this.channels.get(channel);
    
    if (!channelConfig) {
      socket.emit('subscription_error', { 
        channel,
        message: 'Invalid channel',
        availableChannels: Array.from(this.channels.keys())
      });
      return;
    }

    // Check subscription tier requirements
    const tierHierarchy = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];
    const userTierIndex = tierHierarchy.indexOf(user.subscriptionTier);
    const requiredTierIndex = tierHierarchy.indexOf(channelConfig.requiredTier);
    
    if (userTierIndex < requiredTierIndex) {
      socket.emit('subscription_error', { 
        channel,
        message: `Channel requires ${channelConfig.requiredTier} subscription or higher`,
        currentTier: user.subscriptionTier,
        requiredTier: channelConfig.requiredTier
      });
      return;
    }

    // Check channel limits
    const limits = this.SUBSCRIPTION_LIMITS[user.subscriptionTier];
    if (user.subscribedChannels.length >= limits.maxChannels) {
      socket.emit('subscription_error', { 
        channel,
        message: `Maximum channels exceeded (${user.subscribedChannels.length}/${limits.maxChannels})`,
        maxChannels: limits.maxChannels
      });
      return;
    }

    // Check if already subscribed
    if (user.subscribedChannels.includes(channel)) {
      socket.emit('subscription_error', { 
        channel,
        message: 'Already subscribed to this channel' 
      });
      return;
    }

    // Check channel subscriber limit
    const currentSubscribers = this.io.sockets.adapter.rooms.get(channel)?.size || 0;
    if (currentSubscribers >= channelConfig.maxSubscribers) {
      socket.emit('subscription_error', { 
        channel,
        message: 'Channel subscriber limit reached',
        maxSubscribers: channelConfig.maxSubscribers
      });
      return;
    }

    // Subscribe to channel
    user.subscribedChannels.push(channel);
    socket.join(channel);
    
    const updateInterval = Math.max(channelConfig.updateInterval, limits.updateInterval);
    
    socket.emit('subscription_success', { 
      channel, 
      updateInterval,
      description: channelConfig.description,
      subscribedAt: new Date()
    });

    // Start sending updates for this channel if not already started
    if (!this.updateIntervals.has(channel)) {
      this.startChannelUpdates(channel);
    }

    // Send immediate channel data
    await this.sendChannelData(socket, channel);

    this.updateUserActivity(socket.id);
    console.log(`User ${user.userId} subscribed to ${channel} (${currentSubscribers + 1}/${channelConfig.maxSubscribers} subscribers)`);
  }

  /**
   * Handle emergency stop request with enhanced validation
   */
  private async handleEmergencyStop(socket: Socket, data: { reason?: string; confirm?: boolean }): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    if (!data.confirm) {
      socket.emit('emergency_stop_confirmation_required', {
        message: 'Emergency stop requires confirmation',
        timestamp: new Date()
      });
      return;
    }

    const trigger: EmergencyStopTrigger = {
      userId: user.userId,
      triggerType: 'MANUAL',
      reason: data.reason || 'Manual emergency stop triggered by user via dashboard',
      triggeredBy: user.userId,
      timestamp: new Date(),
      affectedServices: ['ALL'],
      metadata: {
        socketId: socket.id,
        userAgent: user.clientInfo?.userAgent,
        ip: user.clientInfo?.ip
      }
    };

    try {
      // Set emergency stop flag in Redis
      await this.redis.setex(
        `emergency_stop:${user.userId}`,
        24 * 60 * 60, // 24 hours
        JSON.stringify(trigger)
      );

      // Notify automation engine if available
      if (this.automationEngine) {
        await this.automationEngine.triggerEmergencyStop(user.userId, trigger.reason, 'user');
      }

      // Publish to Redis for other services
      await this.redis.publish('emergency_stop', JSON.stringify(trigger));

      socket.emit('emergency_stop_success', { 
        message: 'Emergency stop activated successfully',
        timestamp: trigger.timestamp,
        estimatedRecoveryTime: '24 hours (manual review required)'
      });

      // Broadcast to all user's connected sockets
      this.broadcastToUser(user.userId, 'emergency_stop_activated', trigger);

      // Log for audit trail
      await this.redis.lpush(
        `audit_log:${user.userId}`,
        JSON.stringify({
          action: 'emergency_stop',
          timestamp: new Date(),
          source: 'websocket_dashboard',
          details: trigger
        })
      );

      this.emit('emergencyStop', trigger);
      console.log(`Emergency stop activated for user ${user.userId} via WebSocket dashboard`);
      
    } catch (error) {
      socket.emit('emergency_stop_error', { 
        message: 'Failed to activate emergency stop',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('Emergency stop error:', error);
    }
  }

  /**
   * Handle pause automation request
   */
  private async handlePauseAutomation(socket: Socket, data: { duration?: number }): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      const duration = data.duration || 60 * 60; // Default 1 hour
      
      await this.redis.setex(
        `automation_paused:${user.userId}`,
        duration,
        JSON.stringify({
          pausedAt: new Date(),
          duration,
          reason: 'User requested pause via dashboard',
          socketId: socket.id
        })
      );

      if (this.automationEngine) {
        await this.automationEngine.pauseUserAutomation?.(user.userId);
      }

      socket.emit('automation_paused', {
        message: 'Automation paused successfully',
        duration,
        resumesAt: new Date(Date.now() + duration * 1000)
      });

      this.broadcastToUser(user.userId, 'automation_status_changed', {
        status: 'PAUSED',
        reason: 'User requested',
        timestamp: new Date()
      });

    } catch (error) {
      socket.emit('automation_pause_error', {
        message: 'Failed to pause automation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle resume automation request
   */
  private async handleResumeAutomation(socket: Socket, data: any): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      await this.redis.del(`automation_paused:${user.userId}`);

      if (this.automationEngine) {
        await this.automationEngine.resumeUserAutomation?.(user.userId);
      }

      socket.emit('automation_resumed', {
        message: 'Automation resumed successfully',
        timestamp: new Date()
      });

      this.broadcastToUser(user.userId, 'automation_status_changed', {
        status: 'ACTIVE',
        reason: 'User requested',
        timestamp: new Date()
      });

    } catch (error) {
      socket.emit('automation_resume_error', {
        message: 'Failed to resume automation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle automation status request
   */
  private async handleAutomationStatusRequest(socket: Socket): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      let status;
      
      if (this.automationEngine) {
        status = await this.automationEngine.getUserMetrics(user.userId);
      } else {
        // Fallback status
        status = await this.getUserAutomationStatus(user.userId);
      }

      socket.emit('automation_status_update', {
        ...status,
        timestamp: new Date()
      });

      this.updateUserActivity(socket.id);
    } catch (error) {
      socket.emit('automation_status_error', { 
        message: 'Failed to fetch automation status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle safety metrics request
   */
  private async handleSafetyMetricsRequest(socket: Socket): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      const metrics = await this.getSafetyMetrics(user.userId);
      socket.emit('safety_metrics_update', {
        ...metrics,
        timestamp: new Date()
      });
      this.updateUserActivity(socket.id);
    } catch (error) {
      socket.emit('safety_metrics_error', { 
        message: 'Failed to fetch safety metrics'
      });
    }
  }

  /**
   * Handle queue status request
   */
  private async handleQueueStatusRequest(socket: Socket): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      const queueStatus = await this.getQueueStatus(user.userId);
      socket.emit('queue_status_update', {
        ...queueStatus,
        timestamp: new Date()
      });
      this.updateUserActivity(socket.id);
    } catch (error) {
      socket.emit('queue_status_error', { 
        message: 'Failed to fetch queue status'
      });
    }
  }

  /**
   * Handle cancel job request
   */
  private async handleCancelJob(socket: Socket, data: { jobId: string }): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      // Implementation would depend on your job cancellation system
      socket.emit('job_cancelled', {
        jobId: data.jobId,
        message: 'Job cancelled successfully',
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('job_cancel_error', {
        jobId: data.jobId,
        message: 'Failed to cancel job'
      });
    }
  }

  /**
   * Handle template analytics request
   */
  private async handleTemplateAnalyticsRequest(socket: Socket): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      const analytics = await this.getTemplateAnalytics(user.userId);
      socket.emit('template_analytics_update', {
        ...analytics,
        timestamp: new Date()
      });
      this.updateUserActivity(socket.id);
    } catch (error) {
      socket.emit('template_analytics_error', { 
        message: 'Failed to fetch template analytics'
      });
    }
  }

  /**
   * Setup Redis subscriptions for real-time updates
   */
  private setupRedisSubscriptions(): void {
    const channels = [
      'safety_alerts',
      'automation_updates', 
      'emergency_stops',
      'queue_updates',
      'template_analytics',
      'system_health'
    ];

    this.subscriber.subscribe(...channels);
    
    this.subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.handleRedisMessage(channel, data);
      } catch (error) {
        console.error('Error handling Redis message:', error);
      }
    });

    console.log(`Subscribed to ${channels.length} Redis channels for real-time updates`);
  }

  /**
   * Handle Redis pub/sub messages with enhanced routing
   */
  private handleRedisMessage(channel: string, data: any): void {
    switch (channel) {
      case 'safety_alerts':
        if (data.userId) {
          this.sendSafetyAlert(data.userId, data);
          // Also broadcast to safety_alerts channel
          this.io.to('safety_alerts').emit('update', {
            channel: 'safety_alerts',
            data,
            timestamp: new Date()
          });
        }
        break;
        
      case 'automation_updates':
        if (data.userId) {
          this.broadcastToUser(data.userId, 'automation_update', data);
          // Update automation_status channel
          this.io.to('automation_status').emit('update', {
            channel: 'automation_status',
            data,
            timestamp: new Date()
          });
        }
        break;
        
      case 'emergency_stops':
        if (data.userId) {
          this.broadcastToUser(data.userId, 'emergency_stop_activated', data);
        }
        break;
        
      case 'queue_updates':
        if (data.userId) {
          this.broadcastToUser(data.userId, 'queue_update', data);
          // Update queue_status channel
          this.io.to('queue_status').emit('update', {
            channel: 'queue_status',
            data,
            timestamp: new Date()
          });
        }
        break;
        
      case 'template_analytics':
        // Broadcast to template_analytics channel
        this.io.to('template_analytics').emit('update', {
          channel: 'template_analytics',
          data,
          timestamp: new Date()
        });
        break;
        
      case 'system_health':
        // Broadcast to health_dashboard channel
        this.io.to('health_dashboard').emit('update', {
          channel: 'health_dashboard',
          data,
          timestamp: new Date()
        });
        break;
    }
  }

  /**
   * Send initial automation dashboard data
   */
  private async sendInitialAutomationData(socket: Socket): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    try {
      const [
        automationStatus,
        safetyMetrics,
        queueStatus
      ] = await Promise.all([
        this.getUserAutomationStatus(user.userId),
        this.getSafetyMetrics(user.userId),
        this.getQueueStatus(user.userId)
      ]);

      socket.emit('initial_dashboard_data', {
        automation: automationStatus,
        safety: safetyMetrics,
        queue: queueStatus,
        timestamp: new Date(),
        serverInfo: {
          version: '3.0',
          environment: process.env.NODE_ENV || 'development'
        }
      });
    } catch (error) {
      console.error('Error sending initial automation data:', error);
      socket.emit('initial_data_error', { 
        message: 'Failed to load initial dashboard data'
      });
    }
  }

  /**
   * Send channel-specific data immediately upon subscription
   */
  private async sendChannelData(socket: Socket, channel: string): Promise<void> {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    let data: any;

    try {
      switch (channel) {
        case 'automation_status':
          data = await this.getUserAutomationStatus(user.userId);
          break;
        case 'safety_alerts':
          data = await this.getSafetyAlerts(user.userId);
          break;
        case 'profile_metrics':
          data = await this.getProfileMetrics(user.userId);
          break;
        case 'queue_status':
          data = await this.getQueueStatus(user.userId);
          break;
        case 'template_analytics':
          data = await this.getTemplateAnalytics(user.userId);
          break;
        case 'health_dashboard':
          data = await this.getHealthDashboard();
          break;
        case 'compliance_monitoring':
          data = await this.getComplianceMetrics(user.userId);
          break;
        case 'real_time_analytics':
          data = await this.getRealTimeAnalytics(user.userId);
          break;
        default:
          return;
      }

      if (data) {
        socket.emit('channel_initial_data', {
          channel,
          data,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error sending initial data for channel ${channel}:`, error);
    }
  }

  // Enhanced data fetching methods

  private async getUserAutomationStatus(userId: string): Promise<any> {
    if (this.automationEngine) {
      return await this.automationEngine.getUserMetrics(userId);
    }

    // Fallback implementation
    const [settings, suspended, paused] = await Promise.all([
      this.redis.get(`automation_settings:${userId}`),
      this.redis.get(`automation_suspended:${userId}`),
      this.redis.get(`automation_paused:${userId}`)
    ]);

    return {
      userId,
      enabled: !!settings,
      status: suspended ? 'SUSPENDED' : paused ? 'PAUSED' : settings ? 'ACTIVE' : 'DISABLED',
      settings: settings ? JSON.parse(settings) : null,
      suspensionReason: suspended ? JSON.parse(suspended).reason : null,
      lastUpdated: new Date()
    };
  }

  private async getSafetyMetrics(userId: string): Promise<any> {
    // This would integrate with your safety monitoring service
    const safetyData = await this.redis.get(`safety_status:${userId}`);
    return safetyData ? JSON.parse(safetyData) : {
      userId,
      score: 100,
      status: 'SAFE',
      alerts: [],
      lastCheck: new Date()
    };
  }

  private async getSafetyAlerts(userId: string): Promise<any[]> {
    const alertKeys = await this.redis.keys(`safety_alert:${userId}:*`);
    const alerts = await Promise.all(
      alertKeys.map(key => this.redis.get(key))
    );
    
    return alerts
      .filter(alert => alert)
      .map(alert => JSON.parse(alert!))
      .filter(alert => !alert.resolved)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }

  private async getQueueStatus(userId: string): Promise<any> {
    // This would integrate with your queue management service
    return {
      userId,
      totalJobs: 0,
      pendingJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      nextJobTime: null,
      estimatedWaitTime: 0
    };
  }

  private async getTemplateAnalytics(userId: string): Promise<any> {
    // This would integrate with your template analytics service
    return {
      userId,
      totalTemplates: 0,
      averageSuccessRate: 0,
      topPerformingTemplates: [],
      recentPerformance: []
    };
  }

  private async getProfileMetrics(userId: string): Promise<any> {
    // This would integrate with your analytics service
    return {
      userId,
      profileViews: 0,
      connectionAcceptance: 0,
      engagementRate: 0,
      lastUpdated: new Date()
    };
  }

  private async getHealthDashboard(): Promise<any> {
    // System-wide health metrics
    return {
      systemStatus: 'HEALTHY',
      totalUsers: this.connectedUsers.size,
      activeConnections: this.io.sockets.sockets.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  private async getComplianceMetrics(userId: string): Promise<any> {
    // This would integrate with your compliance monitoring service
    return {
      userId,
      complianceScore: 100,
      riskLevel: 'LOW',
      lastAudit: new Date(),
      violations: []
    };
  }

  private async getRealTimeAnalytics(userId: string): Promise<any> {
    // Real-time analytics for enterprise users
    return {
      userId,
      liveMetrics: {
        connectionsToday: 0,
        engagementsToday: 0,
        profileViewsToday: 0
      },
      trends: [],
      timestamp: new Date()
    };
  }

  /**
   * Start periodic updates for automation channels
   */
  private startChannelUpdates(channel: string): void {
    const channelConfig = this.channels.get(channel);
    if (!channelConfig) return;

    const interval = setInterval(async () => {
      try {
        const subscriberCount = this.io.sockets.adapter.rooms.get(channel)?.size || 0;
        
        if (subscriberCount === 0) {
          // No subscribers, stop updates
          clearInterval(interval);
          this.updateIntervals.delete(channel);
          return;
        }

        await this.sendChannelUpdate(channel);
      } catch (error) {
        console.error(`Error sending ${channel} update:`, error);
      }
    }, channelConfig.updateInterval);

    this.updateIntervals.set(channel, interval);
    console.log(`Started periodic updates for channel: ${channel} (interval: ${channelConfig.updateInterval}ms)`);
  }

  /**
   * Send updates for a specific channel
   */
  private async sendChannelUpdate(channel: string): Promise<void> {
    let data: any;

    try {
      switch (channel) {
        case 'automation_status':
          data = await this.getAutomationStatusUpdates();
          break;
        case 'safety_alerts':
          data = await this.getSystemSafetyAlerts();
          break;
        case 'profile_metrics':
          data = await this.getSystemProfileMetrics();
          break;
        case 'queue_status':
          data = await this.getSystemQueueStatus();
          break;
        case 'system_notifications':
          data = await this.getSystemNotifications();
          break;
        case 'real_time_analytics':
          data = await this.getSystemRealTimeAnalytics();
          break;
        case 'template_analytics':
          data = await this.getSystemTemplateAnalytics();
          break;
        case 'health_dashboard':
          data = await this.getHealthDashboard();
          break;
        case 'compliance_monitoring':
          data = await this.getSystemComplianceMetrics();
          break;
        default:
          return;
      }

      if (data) {
        this.io.to(channel).emit('update', {
          channel,
          data,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error updating channel ${channel}:`, error);
    }
  }

  // System-wide data fetching methods (implement based on your needs)
  private async getAutomationStatusUpdates(): Promise<any> {
    return this.automationEngine ? await this.automationEngine.getSystemDashboard() : null;
  }

  private async getSystemSafetyAlerts(): Promise<any> {
    return { alerts: [], totalCount: 0 };
  }

  private async getSystemProfileMetrics(): Promise<any> {
    return { totalViews: 0, averageEngagement: 0 };
  }

  private async getSystemQueueStatus(): Promise<any> {
    return { totalPending: 0, totalProcessing: 0 };
  }

  private async getSystemNotifications(): Promise<any> {
    return { notifications: [] };
  }

  private async getSystemRealTimeAnalytics(): Promise<any> {
    return { liveStats: {} };
  }

  private async getSystemTemplateAnalytics(): Promise<any> {
    return { performance: [], trends: [] };
  }

  private async getSystemComplianceMetrics(): Promise<any> {
    return { overallScore: 100, riskLevel: 'LOW' };
  }

  /**
   * Enhanced cleanup with automation context
   */
  public async cleanup(): Promise<void> {
    console.log('Starting WebSocket service cleanup...');
    
    // Clear all intervals
    for (const [channel, interval] of this.updateIntervals.entries()) {
      clearInterval(interval);
      console.log(`Stopped updates for channel: ${channel}`);
    }
    this.updateIntervals.clear();
    
    // Close Redis connections
    await Promise.all([
      this.redis.quit(),
      this.subscriber.quit()
    ]);
    
    // Close Socket.IO server
    this.io.close(() => {
      console.log('Socket.IO server closed');
    });
    
    console.log('WebSocket service cleanup completed');
  }

  /**
   * Get enhanced service statistics
   */
  public getStats(): {
    connectedUsers: number;
    totalConnections: number;
    channelSubscriptions: { [channel: string]: number };
    automationUsers: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  } {
    const channelSubscriptions: { [channel: string]: number } = {};
    
    for (const [channelName] of this.channels.entries()) {
      channelSubscriptions[channelName] = this.io.sockets.adapter.rooms.get(channelName)?.size || 0;
    }

    const automationUsers = Array.from(this.connectedUsers.values())
      .filter(user => user.automationEnabled).length;

    return {
      connectedUsers: this.userConnections.size,
      totalConnections: this.connectedUsers.size,
      channelSubscriptions,
      automationUsers,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  // Inherited methods (keeping existing functionality)
  
  private handleUnsubscription(socket: Socket, data: { channel: string }): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    const { channel } = data;
    const index = user.subscribedChannels.indexOf(channel);
    
    if (index !== -1) {
      user.subscribedChannels.splice(index, 1);
      socket.leave(channel);
      socket.emit('unsubscription_success', { channel });
      
      this.updateUserActivity(socket.id);
      console.log(`User ${user.userId} unsubscribed from ${channel}`);
    }
  }

  private handleDisconnection(socket: Socket, reason: string): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    console.log(`User ${user.userId} disconnected from automation dashboard (reason: ${reason})`);

    // Clean up user connections tracking
    const userSockets = this.userConnections.get(user.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userConnections.delete(user.userId);
      }
    }

    // Remove from connected users
    this.connectedUsers.delete(socket.id);

    this.emit('userDisconnected', { 
      userId: user.userId, 
      socketId: socket.id, 
      reason,
      connectedDuration: Date.now() - user.connectedAt.getTime()
    });
  }

  private updateUserActivity(socketId: string): void {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      user.lastActivity = new Date();
    }
  }

  public broadcastToUser(userId: string, event: string, data: any): void {
    const userSockets = this.userConnections.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(event, {
          ...data,
          userId,
          timestamp: new Date()
        });
      });
    }
  }

  public broadcastSystemNotification(notification: SystemNotification): void {
    const message: WebSocketMessage = {
      channel: 'system_notifications',
      type: 'system_notification',
      data: notification,
      timestamp: new Date()
    };

    if (notification.targetUsers && notification.targetUsers.length > 0) {
      // Send to specific users
      notification.targetUsers.forEach(userId => {
        this.broadcastToUser(userId, 'system_notification', message);
      });
    } else {
      // Broadcast to all connected users
      this.io.emit('system_notification', message);
    }
  }

  public sendSafetyAlert(userId: string, alert: SafetyAlert): void {
    this.broadcastToUser(userId, 'safety_alert', {
      channel: 'safety_alerts',
      type: 'safety_alert',
      data: alert,
      timestamp: new Date(),
      userId
    });
  }

  private startSystemMonitoring(): void {
    // Monitor connected users every 30 seconds
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 30000);

    // Monitor system health every minute
    setInterval(async () => {
      await this.performSystemHealthCheck();
    }, 60000);

    console.log('Enhanced automation dashboard monitoring started');
  }

  private cleanupInactiveConnections(): void {
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes for automation dashboard
    const now = new Date();

    for (const [socketId, user] of this.connectedUsers.entries()) {
      const inactive = now.getTime() - user.lastActivity.getTime();
      
      if (inactive > inactiveThreshold) {
        console.log(`Disconnecting inactive automation dashboard user ${user.userId} (inactive for ${Math.round(inactive / 60000)} minutes)`);
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }

  private async performSystemHealthCheck(): Promise<void> {
    const stats = this.getStats();
    
    // Check for potential issues
    if (stats.totalConnections > 1000) {
      console.warn(`High connection count: ${stats.totalConnections}`);
    }

    const memoryUsage = stats.memoryUsage.heapUsed / 1024 / 1024; // MB
    if (memoryUsage > 512) { // 512 MB threshold
      console.warn(`High memory usage: ${memoryUsage.toFixed(2)} MB`);
    }

    // Emit system health update
    this.io.to('health_dashboard').emit('update', {
      channel: 'health_dashboard',
      data: {
        connections: stats.totalConnections,
        automationUsers: stats.automationUsers,
        memoryUsage: stats.memoryUsage,
        uptime: stats.uptime,
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  }
} // 10 seconds\n        maxSubscribers: 1000\n      },\n      {\n        name: 'safety_alerts',\n        requiredTier: 'FREE',\n        updateInterval: 5000, // 5 seconds - critical for safety\n        maxSubscribers: 1000\n      },\n      {\n        name: 'profile_metrics',\n        requiredTier: 'BASIC',\n        updateInterval: 30000, // 30 seconds\n        maxSubscribers: 500\n      },\n      {\n        name: 'queue_status',\n        requiredTier: 'PRO',\n        updateInterval: 5000, // 5 seconds\n        maxSubscribers: 200\n      },\n      {\n        name: 'system_notifications',\n        requiredTier: 'FREE',\n        updateInterval: 60000, // 1 minute\n        maxSubscribers: 1000\n      },\n      {\n        name: 'real_time_analytics',\n        requiredTier: 'ENTERPRISE',\n        updateInterval: 1000, // 1 second\n        maxSubscribers: 50\n      }\n    ];\n\n    defaultChannels.forEach(channel => {\n      this.channels.set(channel.name, channel);\n    });\n  }\n\n  /**\n   * Setup Socket.IO event handlers\n   */\n  private setupSocketHandlers(): void {\n    this.io.use(async (socket, next) => {\n      try {\n        await this.authenticateSocket(socket);\n        next();\n      } catch (error) {\n        console.error('Socket authentication failed:', error);\n        next(new Error('Authentication failed'));\n      }\n    });\n\n    this.io.on('connection', (socket: Socket) => {\n      this.handleConnection(socket);\n    });\n  }\n\n  /**\n   * Authenticate socket connection using JWT\n   */\n  private async authenticateSocket(socket: Socket): Promise<void> {\n    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');\n    \n    if (!token) {\n      throw new Error('No authentication token provided');\n    }\n\n    try {\n      const decoded = jwt.verify(token, this.config.jwt.secret) as any;\n      \n      // Validate user exists and is active\n      const userKey = `user:${decoded.userId}`;\n      const userData = await this.redis.get(userKey);\n      \n      if (!userData) {\n        throw new Error('User not found or inactive');\n      }\n\n      const user = JSON.parse(userData);\n      \n      // Check subscription tier\n      if (!this.SUBSCRIPTION_LIMITS[user.subscriptionTier as keyof SubscriptionLimits]) {\n        throw new Error('Invalid subscription tier');\n      }\n\n      // Check concurrent connection limit\n      const existingConnections = this.userConnections.get(decoded.userId)?.size || 0;\n      const maxConnections = this.SUBSCRIPTION_LIMITS[user.subscriptionTier as keyof SubscriptionLimits].maxConcurrentConnections;\n      \n      if (existingConnections >= maxConnections) {\n        throw new Error('Maximum concurrent connections exceeded');\n      }\n\n      // Store user info in socket\n      socket.data.userId = decoded.userId;\n      socket.data.subscriptionTier = user.subscriptionTier;\n      socket.data.user = user;\n      \n    } catch (error) {\n      throw new Error(`Invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`);\n    }\n  }\n\n  /**\n   * Handle new socket connection\n   */\n  private handleConnection(socket: Socket): void {\n    const userId = socket.data.userId;\n    const subscriptionTier = socket.data.subscriptionTier;\n    \n    console.log(`User ${userId} connected with ${subscriptionTier} subscription`);\n\n    // Create user object\n    const user: WebSocketUser = {\n      id: socket.id,\n      socketId: socket.id,\n      userId,\n      subscriptionTier,\n      subscribedChannels: [],\n      connectedAt: new Date(),\n      lastActivity: new Date()\n    };\n\n    this.connectedUsers.set(socket.id, user);\n    \n    // Track user connections\n    if (!this.userConnections.has(userId)) {\n      this.userConnections.set(userId, new Set());\n    }\n    this.userConnections.get(userId)!.add(socket.id);\n\n    // Setup socket event handlers\n    socket.on('subscribe', (data) => this.handleSubscription(socket, data));\n    socket.on('unsubscribe', (data) => this.handleUnsubscription(socket, data));\n    socket.on('emergency_stop', (data) => this.handleEmergencyStop(socket, data));\n    socket.on('get_status', () => this.handleStatusRequest(socket));\n    socket.on('ping', () => {\n      socket.emit('pong', { timestamp: new Date() });\n      this.updateUserActivity(socket.id);\n    });\n    \n    socket.on('disconnect', () => this.handleDisconnection(socket));\n\n    // Send initial status\n    this.sendInitialStatus(socket);\n    \n    // Emit connection event\n    this.emit('userConnected', { userId, socketId: socket.id });\n  }\n\n  /**\n   * Handle channel subscription\n   */\n  private async handleSubscription(socket: Socket, data: { channel: string }): Promise<void> {\n    const user = this.connectedUsers.get(socket.id);\n    if (!user) return;\n\n    const { channel } = data;\n    const channelConfig = this.channels.get(channel);\n    \n    if (!channelConfig) {\n      socket.emit('subscription_error', { message: 'Invalid channel' });\n      return;\n    }\n\n    // Check subscription tier requirements\n    const tierHierarchy = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];\n    const userTierIndex = tierHierarchy.indexOf(user.subscriptionTier);\n    const requiredTierIndex = tierHierarchy.indexOf(channelConfig.requiredTier);\n    \n    if (userTierIndex < requiredTierIndex) {\n      socket.emit('subscription_error', { \n        message: `Channel requires ${channelConfig.requiredTier} subscription or higher` \n      });\n      return;\n    }\n\n    // Check channel limits\n    const limits = this.SUBSCRIPTION_LIMITS[user.subscriptionTier];\n    if (user.subscribedChannels.length >= limits.maxChannels) {\n      socket.emit('subscription_error', { \n        message: `Maximum channels exceeded (${limits.maxChannels})` \n      });\n      return;\n    }\n\n    // Check if already subscribed\n    if (user.subscribedChannels.includes(channel)) {\n      socket.emit('subscription_error', { message: 'Already subscribed to this channel' });\n      return;\n    }\n\n    // Subscribe to channel\n    user.subscribedChannels.push(channel);\n    socket.join(channel);\n    \n    socket.emit('subscription_success', { \n      channel, \n      updateInterval: Math.max(channelConfig.updateInterval, limits.updateInterval)\n    });\n\n    // Start sending updates for this channel if not already started\n    if (!this.updateIntervals.has(channel)) {\n      this.startChannelUpdates(channel);\n    }\n\n    this.updateUserActivity(socket.id);\n    console.log(`User ${user.userId} subscribed to ${channel}`);\n  }\n\n  /**\n   * Handle channel unsubscription\n   */\n  private handleUnsubscription(socket: Socket, data: { channel: string }): void {\n    const user = this.connectedUsers.get(socket.id);\n    if (!user) return;\n\n    const { channel } = data;\n    const index = user.subscribedChannels.indexOf(channel);\n    \n    if (index !== -1) {\n      user.subscribedChannels.splice(index, 1);\n      socket.leave(channel);\n      socket.emit('unsubscription_success', { channel });\n      \n      this.updateUserActivity(socket.id);\n      console.log(`User ${user.userId} unsubscribed from ${channel}`);\n    }\n  }\n\n  /**\n   * Handle emergency stop request\n   */\n  private async handleEmergencyStop(socket: Socket, data: { reason?: string }): Promise<void> {\n    const user = this.connectedUsers.get(socket.id);\n    if (!user) return;\n\n    const trigger: EmergencyStopTrigger = {\n      userId: user.userId,\n      triggerType: 'MANUAL',\n      reason: data.reason || 'Manual emergency stop triggered by user',\n      triggeredBy: user.userId,\n      timestamp: new Date(),\n      affectedServices: ['ALL']\n    };\n\n    try {\n      // Set emergency stop flag in Redis\n      await this.redis.setex(\n        `emergency_stop:${user.userId}`,\n        24 * 60 * 60, // 24 hours\n        JSON.stringify(trigger)\n      );\n\n      // Notify all automation services\n      await this.redis.publish('emergency_stop', JSON.stringify(trigger));\n\n      socket.emit('emergency_stop_success', { \n        message: 'Emergency stop activated',\n        timestamp: trigger.timestamp\n      });\n\n      // Broadcast to all user's connected sockets\n      this.broadcastToUser(user.userId, 'emergency_stop_activated', trigger);\n\n      this.emit('emergencyStop', trigger);\n      console.log(`Emergency stop activated for user ${user.userId}`);\n      \n    } catch (error) {\n      socket.emit('emergency_stop_error', { \n        message: 'Failed to activate emergency stop'\n      });\n      console.error('Emergency stop error:', error);\n    }\n  }\n\n  /**\n   * Handle status request\n   */\n  private async handleStatusRequest(socket: Socket): Promise<void> {\n    const user = this.connectedUsers.get(socket.id);\n    if (!user) return;\n\n    try {\n      const status = await this.getUserStatus(user.userId);\n      socket.emit('status_update', status);\n      this.updateUserActivity(socket.id);\n    } catch (error) {\n      socket.emit('status_error', { message: 'Failed to fetch status' });\n    }\n  }\n\n  /**\n   * Handle socket disconnection\n   */\n  private handleDisconnection(socket: Socket): void {\n    const user = this.connectedUsers.get(socket.id);\n    if (!user) return;\n\n    console.log(`User ${user.userId} disconnected`);\n\n    // Clean up user connections tracking\n    const userSockets = this.userConnections.get(user.userId);\n    if (userSockets) {\n      userSockets.delete(socket.id);\n      if (userSockets.size === 0) {\n        this.userConnections.delete(user.userId);\n      }\n    }\n\n    // Remove from connected users\n    this.connectedUsers.delete(socket.id);\n\n    this.emit('userDisconnected', { userId: user.userId, socketId: socket.id });\n  }\n\n  /**\n   * Start periodic updates for a channel\n   */\n  private startChannelUpdates(channel: string): void {\n    const channelConfig = this.channels.get(channel);\n    if (!channelConfig) return;\n\n    const interval = setInterval(async () => {\n      try {\n        const subscriberCount = this.io.sockets.adapter.rooms.get(channel)?.size || 0;\n        \n        if (subscriberCount === 0) {\n          // No subscribers, stop updates\n          clearInterval(interval);\n          this.updateIntervals.delete(channel);\n          return;\n        }\n\n        await this.sendChannelUpdate(channel);\n      } catch (error) {\n        console.error(`Error sending ${channel} update:`, error);\n      }\n    }, channelConfig.updateInterval);\n\n    this.updateIntervals.set(channel, interval);\n  }\n\n  /**\n   * Send updates for a specific channel\n   */\n  private async sendChannelUpdate(channel: string): Promise<void> {\n    let data: any;\n\n    switch (channel) {\n      case 'automation_status':\n        data = await this.getAutomationStatusUpdates();\n        break;\n      case 'safety_alerts':\n        data = await this.getSafetyAlerts();\n        break;\n      case 'profile_metrics':\n        data = await this.getProfileMetrics();\n        break;\n      case 'queue_status':\n        data = await this.getQueueStatus();\n        break;\n      case 'system_notifications':\n        data = await this.getSystemNotifications();\n        break;\n      case 'real_time_analytics':\n        data = await this.getRealTimeAnalytics();\n        break;\n      default:\n        return;\n    }\n\n    if (data) {\n      this.io.to(channel).emit('update', {\n        channel,\n        data,\n        timestamp: new Date()\n      });\n    }\n  }\n\n  /**\n   * Send initial status to newly connected socket\n   */\n  private async sendInitialStatus(socket: Socket): Promise<void> {\n    const user = this.connectedUsers.get(socket.id);\n    if (!user) return;\n\n    try {\n      const status = await this.getUserStatus(user.userId);\n      socket.emit('initial_status', status);\n    } catch (error) {\n      console.error('Error sending initial status:', error);\n    }\n  }\n\n  /**\n   * Update user activity timestamp\n   */\n  private updateUserActivity(socketId: string): void {\n    const user = this.connectedUsers.get(socketId);\n    if (user) {\n      user.lastActivity = new Date();\n    }\n  }\n\n  /**\n   * Broadcast message to all of a user's connected sockets\n   */\n  public broadcastToUser(userId: string, event: string, data: any): void {\n    const userSockets = this.userConnections.get(userId);\n    if (userSockets) {\n      userSockets.forEach(socketId => {\n        this.io.to(socketId).emit(event, data);\n      });\n    }\n  }\n\n  /**\n   * Broadcast system-wide notification\n   */\n  public broadcastSystemNotification(notification: SystemNotification): void {\n    const message: WebSocketMessage = {\n      channel: 'system_notifications',\n      type: 'system_notification',\n      data: notification,\n      timestamp: new Date()\n    };\n\n    if (notification.targetUsers && notification.targetUsers.length > 0) {\n      // Send to specific users\n      notification.targetUsers.forEach(userId => {\n        this.broadcastToUser(userId, 'system_notification', message);\n      });\n    } else {\n      // Broadcast to all connected users\n      this.io.emit('system_notification', message);\n    }\n  }\n\n  /**\n   * Send safety alert to user\n   */\n  public sendSafetyAlert(userId: string, alert: SafetyAlert): void {\n    this.broadcastToUser(userId, 'safety_alert', {\n      channel: 'safety_alerts',\n      type: 'safety_alert',\n      data: alert,\n      timestamp: new Date(),\n      userId\n    });\n  }\n\n  /**\n   * Get user automation status\n   */\n  private async getUserStatus(userId: string): Promise<any> {\n    // This would integrate with your existing automation services\n    // For now, return mock data structure\n    return {\n      userId,\n      automation: {\n        connections: {\n          enabled: true,\n          status: 'ACTIVE',\n          todaysSent: 5,\n          remaining: 10,\n          queueLength: 3\n        },\n        engagement: {\n          enabled: true,\n          status: 'ACTIVE',\n          todaysActions: { likes: 10, comments: 2, views: 15, follows: 1 },\n          queueLength: 8\n        }\n      },\n      safety: {\n        score: 85,\n        status: 'SAFE',\n        alerts: []\n      },\n      lastUpdated: new Date()\n    };\n  }\n\n  // Data fetching methods (integrate with your existing services)\n  private async getAutomationStatusUpdates(): Promise<AutomationStatusUpdate[]> {\n    // Integrate with your automation services\n    return [];\n  }\n\n  private async getSafetyAlerts(): Promise<SafetyAlert[]> {\n    // Integrate with your safety monitoring service\n    return [];\n  }\n\n  private async getProfileMetrics(): Promise<ProfileMetrics[]> {\n    // Integrate with your analytics service\n    return [];\n  }\n\n  private async getQueueStatus(): Promise<QueueStatus[]> {\n    // Integrate with your queue management\n    return [];\n  }\n\n  private async getSystemNotifications(): Promise<SystemNotification[]> {\n    // Get system-wide notifications\n    return [];\n  }\n\n  private async getRealTimeAnalytics(): Promise<any> {\n    // Get real-time analytics data\n    return {};\n  }\n\n  /**\n   * Start system monitoring\n   */\n  private startSystemMonitoring(): void {\n    // Monitor connected users every 30 seconds\n    setInterval(() => {\n      this.cleanupInactiveConnections();\n    }, 30000);\n\n    // Subscribe to Redis events for real-time updates\n    const subscriber = new Redis({\n      host: this.config.redis.host,\n      port: this.config.redis.port,\n      password: this.config.redis.password,\n    });\n\n    subscriber.subscribe('safety_alerts', 'automation_updates', 'emergency_stops');\n    \n    subscriber.on('message', (channel, message) => {\n      try {\n        const data = JSON.parse(message);\n        this.handleRedisMessage(channel, data);\n      } catch (error) {\n        console.error('Error handling Redis message:', error);\n      }\n    });\n  }\n\n  /**\n   * Handle Redis pub/sub messages\n   */\n  private handleRedisMessage(channel: string, data: any): void {\n    switch (channel) {\n      case 'safety_alerts':\n        if (data.userId) {\n          this.sendSafetyAlert(data.userId, data);\n        }\n        break;\n      case 'automation_updates':\n        if (data.userId) {\n          this.broadcastToUser(data.userId, 'automation_update', data);\n        }\n        break;\n      case 'emergency_stops':\n        if (data.userId) {\n          this.broadcastToUser(data.userId, 'emergency_stop_activated', data);\n        }\n        break;\n    }\n  }\n\n  /**\n   * Clean up inactive connections\n   */\n  private cleanupInactiveConnections(): void {\n    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes\n    const now = new Date();\n\n    for (const [socketId, user] of this.connectedUsers.entries()) {\n      const inactive = now.getTime() - user.lastActivity.getTime();\n      \n      if (inactive > inactiveThreshold) {\n        console.log(`Disconnecting inactive user ${user.userId}`);\n        const socket = this.io.sockets.sockets.get(socketId);\n        if (socket) {\n          socket.disconnect(true);\n        }\n      }\n    }\n  }\n\n  /**\n   * Get service statistics\n   */\n  public getStats(): {\n    connectedUsers: number;\n    totalConnections: number;\n    channelSubscriptions: { [channel: string]: number };\n    memoryUsage: NodeJS.MemoryUsage;\n  } {\n    const channelSubscriptions: { [channel: string]: number } = {};\n    \n    for (const [channelName] of this.channels.entries()) {\n      channelSubscriptions[channelName] = this.io.sockets.adapter.rooms.get(channelName)?.size || 0;\n    }\n\n    return {\n      connectedUsers: this.userConnections.size,\n      totalConnections: this.connectedUsers.size,\n      channelSubscriptions,\n      memoryUsage: process.memoryUsage()\n    };\n  }\n\n  /**\n   * Cleanup method\n   */\n  public async cleanup(): Promise<void> {\n    // Clear all intervals\n    for (const interval of this.updateIntervals.values()) {\n      clearInterval(interval);\n    }\n    \n    // Close Redis connection\n    await this.redis.quit();\n    \n    // Close Socket.IO server\n    this.io.close();\n    \n    console.log('WebSocket service cleaned up');\n  }\n}