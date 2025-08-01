/**
 * Scalable WebSocket Service for InErgize Enterprise Backend
 * Optimized for 5,000+ concurrent connections with Redis clustering
 */

import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { createServer } from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  subscriptionTier?: 'free' | 'premium' | 'enterprise';
}

interface ConnectionMetrics {
  totalConnections: number;
  authenticatedConnections: number;
  messagesPerSecond: number;
  errorRate: number;
  lastUpdated: Date;
}

class ScalableWebSocketService {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private redisClient: any;
  private redisPubClient: any;
  private redisSubClient: any;
  private metrics: ConnectionMetrics;
  private connectionLimits: Map<string, number> = new Map();
  private messageRates: Map<string, number[]> = new Map();
  private cleanup: NodeJS.Timeout[] = [];

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.metrics = {
      totalConnections: 0,
      authenticatedConnections: 0,
      messagesPerSecond: 0,
      errorRate: 0,
      lastUpdated: new Date()
    };

    this.setupExpress();
    this.setupRedis();
    this.setupWebSocket();
    this.setupHealthChecks();
    this.setupMetricsCollection();
  }

  private setupExpress(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting for HTTP endpoints
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api', limiter);

    // CORS middleware
    this.app.use((req, res, next) => {
      const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes(origin as string)) {
        res.setHeader('Access-Control-Allow-Origin', origin as string);
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
  }

  private async setupRedis(): Promise<void> {
    try {
      // Main Redis client for general operations
      this.redisClient = createClient({
        url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/7`,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      });

      // Pub/Sub clients for Socket.IO adapter
      this.redisPubClient = createClient({
        url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/8`,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
      });

      this.redisSubClient = this.redisPubClient.duplicate();

      // Connect all clients
      await Promise.all([
        this.redisClient.connect(),
        this.redisPubClient.connect(),
        this.redisSubClient.connect()
      ]);

      console.log('✅ Redis clients connected successfully');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  private setupWebSocket(): void {
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000'),
      pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
      maxHttpBufferSize: parseInt(process.env.WS_MAX_HTTP_BUFFER_SIZE || '1000000'),
      allowEIO3: true,
      compression: true,
      perMessageDeflate: {
        threshold: 1024,
        zlibDeflateOptions: {
          level: 3,
          concurrency: 10
        }
      }
    });

    // Setup Redis adapter for horizontal scaling
    this.io.adapter(createAdapter(this.redisPubClient, this.redisSubClient));

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        socket.subscriptionTier = decoded.subscriptionTier || 'free';

        // Check connection limits per user
        const userConnections = await this.getUserConnectionCount(socket.userId);
        const maxConnections = this.getMaxConnectionsForTier(socket.subscriptionTier);

        if (userConnections >= maxConnections) {
          return next(new Error('Maximum connections exceeded for subscription tier'));
        }

        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    console.log('✅ WebSocket server configured with Redis clustering');
  }

  private async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.userId!;
    const connectionId = socket.id;

    try {
      // Update connection metrics
      this.metrics.totalConnections++;
      this.metrics.authenticatedConnections++;
      
      // Store connection info in Redis
      await this.redisClient.setEx(
        `ws:connection:${connectionId}`,
        3600,
        JSON.stringify({
          userId,
          email: socket.userEmail,
          tier: socket.subscriptionTier,
          connectedAt: new Date().toISOString(),
          instanceId: process.env.INSTANCE_ID || 'ws-1'
        })
      );

      // Join user-specific room
      await socket.join(`user:${userId}`);
      
      // Join tier-specific room for broadcasts
      await socket.join(`tier:${socket.subscriptionTier}`);

      console.log(`🔗 User ${userId} connected (${this.metrics.totalConnections} total)`);

      // Send connection confirmation
      socket.emit('connected', {
        connectionId,
        tier: socket.subscriptionTier,
        maxConnections: this.getMaxConnectionsForTier(socket.subscriptionTier)
      });

      // Setup event handlers
      this.setupEventHandlers(socket);

      // Setup disconnect handler
      socket.on('disconnect', async (reason) => {
        await this.handleDisconnection(socket, reason);
      });

      // Setup error handler
      socket.on('error', (error) => {
        console.error(`❌ Socket error for user ${userId}:`, error);
        this.metrics.errorRate++;
      });

    } catch (error) {
      console.error('❌ Error handling connection:', error);
      socket.disconnect(true);
    }
  }

  private setupEventHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;

    // Subscribe to profile metrics updates
    socket.on('subscribe:profile_metrics', async (data) => {
      if (this.canUserSubscribe(socket, 'profile_metrics')) {
        await socket.join(`metrics:profile:${userId}`);
        socket.emit('subscribed', { channel: 'profile_metrics' });
      }
    });

    // Subscribe to automation status updates
    socket.on('subscribe:automation_status', async (data) => {
      if (this.canUserSubscribe(socket, 'automation_status')) {
        await socket.join(`automation:status:${userId}`);
        socket.emit('subscribed', { channel: 'automation_status' });
      }
    });

    // Subscribe to safety alerts
    socket.on('subscribe:safety_alerts', async (data) => {
      if (this.canUserSubscribe(socket, 'safety_alerts')) {
        await socket.join(`safety:alerts:${userId}`);
        socket.emit('subscribed', { channel: 'safety_alerts' });
      }
    });

    // Subscribe to system notifications
    socket.on('subscribe:system_notifications', async (data) => {
      if (this.canUserSubscribe(socket, 'system_notifications')) {
        await socket.join(`system:notifications:${userId}`);
        socket.emit('subscribed', { channel: 'system_notifications' });
      }
    });

    // Handle ping/pong for connection monitoring
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Rate limiting for events
    const userRateLimit = this.getRateLimitForTier(socket.subscriptionTier!);
    socket.use(([event, ...args], next) => {
      if (this.checkRateLimit(userId, userRateLimit)) {
        next();
      } else {
        next(new Error('Rate limit exceeded'));
      }
    });
  }

  private async handleDisconnection(socket: AuthenticatedSocket, reason: string): Promise<void> {
    const userId = socket.userId!;
    const connectionId = socket.id;

    try {
      // Update metrics
      this.metrics.totalConnections--;
      this.metrics.authenticatedConnections--;

      // Remove connection info from Redis
      await this.redisClient.del(`ws:connection:${connectionId}`);

      console.log(`🔌 User ${userId} disconnected: ${reason} (${this.metrics.totalConnections} remaining)`);

    } catch (error) {
      console.error('❌ Error handling disconnection:', error);
    }
  }

  private canUserSubscribe(socket: AuthenticatedSocket, channel: string): boolean {
    const tier = socket.subscriptionTier!;
    const channelLimits = {
      free: ['profile_metrics'],
      premium: ['profile_metrics', 'automation_status', 'safety_alerts'],
      enterprise: ['profile_metrics', 'automation_status', 'safety_alerts', 'system_notifications', 'advanced_analytics']
    };

    return channelLimits[tier]?.includes(channel) || false;
  }

  private getMaxConnectionsForTier(tier: string): number {
    const limits = {
      free: 2,
      premium: 5,
      enterprise: 10
    };
    return limits[tier as keyof typeof limits] || 1;
  }

  private getRateLimitForTier(tier: string): number {
    const limits = {
      free: 60,      // 60 events per minute
      premium: 300,  // 300 events per minute
      enterprise: 1000 // 1000 events per minute
    };
    return limits[tier as keyof typeof limits] || 30;
  }

  private async getUserConnectionCount(userId: string): Promise<number> {
    try {
      const keys = await this.redisClient.keys(`ws:connection:*`);
      let count = 0;

      for (const key of keys) {
        const data = await this.redisClient.get(key);
        if (data) {
          const connection = JSON.parse(data);
          if (connection.userId === userId) {
            count++;
          }
        }
      }

      return count;
    } catch (error) {
      console.error('❌ Error getting user connection count:', error);
      return 0;
    }
  }

  private checkRateLimit(userId: string, limit: number): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.messageRates.has(userId)) {
      this.messageRates.set(userId, []);
    }

    const userRates = this.messageRates.get(userId)!;
    
    // Remove old entries
    const filtered = userRates.filter(timestamp => timestamp > windowStart);
    
    // Check if under limit
    if (filtered.length >= limit) {
      return false;
    }

    // Add current timestamp
    filtered.push(now);
    this.messageRates.set(userId, filtered);

    return true;
  }

  private setupHealthChecks(): void {
    this.app.get('/health', async (req, res) => {
      try {
        // Check Redis connection
        await this.redisClient.ping();
        
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'websocket-service',
          version: process.env.npm_package_version || '1.0.0',
          uptime: process.uptime(),
          metrics: this.metrics,
          memory: process.memoryUsage(),
          connections: {
            total: this.metrics.totalConnections,
            authenticated: this.metrics.authenticatedConnections
          }
        };

        res.status(200).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.app.get('/metrics', async (req, res) => {
      try {
        const detailedMetrics = {
          ...this.metrics,
          redis: {
            connected: this.redisClient.isReady,
            commandsProcessed: await this.redisClient.info('commandstats')
          },
          process: {
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            uptime: process.uptime()
          },
          socketio: {
            connectionsCount: this.io.engine.clientsCount,
            rooms: Array.from(this.io.sockets.adapter.rooms.keys()).length,
            namespaces: this.io._nsps.size
          }
        };

        res.status(200).json(detailedMetrics);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  private setupMetricsCollection(): void {
    // Update metrics every 30 seconds
    const metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 30000);

    // Cleanup old connection data every 5 minutes
    const cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 300000);

    // Store intervals for cleanup
    this.cleanup.push(metricsInterval, cleanupInterval);
  }

  private async updateMetrics(): Promise<void> {
    try {
      this.metrics.lastUpdated = new Date();
      
      // Store metrics in Redis for monitoring
      await this.redisClient.setEx(
        `ws:metrics:${process.env.INSTANCE_ID || 'ws-1'}`,
        300,
        JSON.stringify(this.metrics)
      );
    } catch (error) {
      console.error('❌ Error updating metrics:', error);
    }
  }

  private cleanupOldData(): void {
    // Clean up old message rate tracking
    const cutoff = Date.now() - 300000; // 5 minutes
    
    this.messageRates.forEach((timestamps, userId) => {
      const filtered = timestamps.filter(timestamp => timestamp > cutoff);
      if (filtered.length === 0) {
        this.messageRates.delete(userId);
      } else {
        this.messageRates.set(userId, filtered);
      }
    });
  }

  // Public methods for broadcasting
  public async broadcastToUser(userId: string, event: string, data: any): Promise<void> {
    try {
      this.io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
        instanceId: process.env.INSTANCE_ID || 'ws-1'
      });
    } catch (error) {
      console.error(`❌ Error broadcasting to user ${userId}:`, error);
    }
  }

  public async broadcastToTier(tier: string, event: string, data: any): Promise<void> {
    try {
      this.io.to(`tier:${tier}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
        instanceId: process.env.INSTANCE_ID || 'ws-1'
      });
    } catch (error) {
      console.error(`❌ Error broadcasting to tier ${tier}:`, error);
    }
  }

  public async start(port: number = 3007): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        this.server.listen(port, '0.0.0.0', () => {
          console.log(`🚀 Scalable WebSocket service running on port ${port}`);
          console.log(`📊 Instance ID: ${process.env.INSTANCE_ID || 'ws-1'}`);
          console.log(`🔗 Max connections per instance: ${process.env.WS_MAX_CONNECTIONS || '2500'}`);
          resolve();
        });
      });
    } catch (error) {
      console.error('❌ Failed to start WebSocket service:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down WebSocket service...');
    
    // Clear intervals
    this.cleanup.forEach(interval => clearInterval(interval));
    
    // Close Socket.IO server
    this.io.close();
    
    // Close HTTP server
    this.server.close();
    
    // Close Redis connections
    await Promise.all([
      this.redisClient.disconnect(),
      this.redisPubClient.disconnect(),
      this.redisSubClient.disconnect()
    ]);
    
    console.log('✅ WebSocket service shutdown complete');
  }
}

export default ScalableWebSocketService;