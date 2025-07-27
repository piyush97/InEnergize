import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { register, collectDefaultMetrics } from 'prom-client';

import { logger } from '@/config/logger';
import { database } from '@/config/database';
import { redis } from '@/config/redis';

// Import services
import { EnhancedWebSocketService } from '@/services/enhanced-websocket.service';
import { IngestionService } from '@/services/ingestion.service';
import { AlertingService } from '@/services/alerting.service';
import { MetricsService } from '@/services/metrics.service';

// Import migration and seeding
import { MigrationRunner } from '@/migrations/index';
import { DevelopmentSeeder } from '@/seeds/development-seed';

// Import routes
import metricsRoutes from '@/routes/metrics.routes';

// Import middleware
import { authMiddleware } from '@/middleware/auth.middleware';

// Collect default metrics
collectDefaultMetrics();

export class EnhancedAnalyticsApp {
  public app: express.Application;
  private readonly port: number;
  private readonly wsPort: number;
  private readonly environment: string;
  
  // Services
  private websocketService: EnhancedWebSocketService;
  private ingestionService: IngestionService;
  private alertingService: AlertingService;
  private metricsService: MetricsService;
  private migrationRunner: MigrationRunner;
  private developmentSeeder: DevelopmentSeeder;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3004');
    this.wsPort = parseInt(process.env.WS_PORT || '3007');
    this.environment = process.env.NODE_ENV || 'development';

    // Initialize services
    this.websocketService = new EnhancedWebSocketService();
    this.ingestionService = new IngestionService(this.websocketService);
    this.alertingService = new AlertingService(this.websocketService);
    this.metricsService = new MetricsService();
    this.migrationRunner = new MigrationRunner();
    this.developmentSeeder = new DevelopmentSeeder();

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Initialize Express middlewares
   */
  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "data:"],
          frameSrc: ["'none'"]
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.getAllowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Compression
    this.app.use(compression({
      threshold: 1024,
      level: 6,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Verify JSON payload integrity
        try {
          JSON.parse(buf.toString());
        } catch (err) {
          logger.warn('Invalid JSON payload received', { 
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          throw new Error('Invalid JSON payload');
        }
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging and monitoring
    this.app.use((req, res, next) => {
      const start = Date.now();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      req.headers['x-request-id'] = requestId;
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          contentLength: res.get('Content-Length'),
          userId: (req as any).user?.userId
        };

        if (res.statusCode >= 400) {
          logger.warn('HTTP Request Error', logData);
        } else {
          logger.info('HTTP Request', logData);
        }
      });
      
      next();
    });
  }

  /**
   * Initialize application routes
   */
  private initializeRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', async (req, res) => {
      try {
        const [dbHealth, redisHealth, wsHealth] = await Promise.all([
          this.checkDatabaseHealth(),
          this.checkRedisHealth(),
          this.checkWebSocketHealth()
        ]);

        const health = {
          status: 'healthy',
          timestamp: new Date(),
          service: 'enhanced-analytics-service',
          version: '2.0.0',
          environment: this.environment,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          checks: {
            database: dbHealth,
            redis: redisHealth,
            websocket: wsHealth
          }
        };

        const allHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
        const statusCode = allHealthy ? 200 : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date(),
          error: 'Health check failed'
        });
      }
    });

    // Readiness probe
    this.app.get('/ready', async (req, res) => {
      try {
        // Check if all services are initialized
        const ready = {
          database: database.isConnected(),
          redis: redis.isConnected(),
          websocket: this.websocketService.getTotalConnections() >= 0,
          ingestion: true, // Add specific check if needed
          alerting: true   // Add specific check if needed
        };

        const allReady = Object.values(ready).every(Boolean);
        
        res.status(allReady ? 200 : 503).json({
          status: allReady ? 'ready' : 'not ready',
          timestamp: new Date(),
          checks: ready
        });
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        logger.error('Failed to serve metrics', { error });
        res.status(500).end();
      }
    });

    // Service status endpoint
    this.app.get('/status', authMiddleware, async (req, res) => {
      try {
        const [ingestionStats, alertingStats, migrationStatus] = await Promise.all([
          this.ingestionService.getIngestionStats(),
          this.alertingService.getAlertingStats(),
          this.migrationRunner.getMigrationStatus()
        ]);

        res.json({
          success: true,
          data: {
            websocket: this.websocketService.getServiceStats(),
            ingestion: ingestionStats,
            alerting: alertingStats,
            migration: migrationStatus,
            timestamp: new Date()
          }
        });
      } catch (error) {
        logger.error('Failed to get service status', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve service status'
        });
      }
    });

    // Database management endpoints
    this.app.post('/admin/migrate', authMiddleware, async (req, res) => {
      try {
        await this.migrationRunner.runMigrations();
        res.json({
          success: true,
          message: 'Migrations completed successfully'
        });
      } catch (error) {
        logger.error('Migration failed', { error });
        res.status(500).json({
          success: false,
          error: 'Migration failed'
        });
      }
    });

    this.app.post('/admin/seed', authMiddleware, async (req, res) => {
      if (this.environment !== 'development') {
        return res.status(403).json({
          success: false,
          error: 'Seeding only allowed in development environment'
        });
      }

      try {
        await this.developmentSeeder.seedDevelopmentData();
        res.json({
          success: true,
          message: 'Development data seeded successfully'
        });
      } catch (error) {
        logger.error('Seeding failed', { error });
        res.status(500).json({
          success: false,
          error: 'Seeding failed'
        });
      }
    });

    this.app.get('/admin/seed/status', authMiddleware, async (req, res) => {
      try {
        const status = await this.developmentSeeder.getSeedStatus();
        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        logger.error('Failed to get seed status', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve seed status'
        });
      }
    });

    // Real-time ingestion endpoint
    this.app.post('/ingest/event', authMiddleware, async (req, res) => {
      try {
        const { eventType, eventData } = req.body;
        const userId = (req as any).user?.userId;

        if (!userId || !eventType || !eventData) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: eventType, eventData'
          });
        }

        await this.ingestionService.queueRealTimeEvent({
          userId,
          eventType,
          eventData,
          timestamp: new Date()
        });

        res.status(201).json({
          success: true,
          message: 'Event queued for processing'
        });
      } catch (error) {
        logger.error('Failed to ingest event', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to process event'
        });
      }
    });

    // API routes
    this.app.use('/api/v1/metrics', metricsRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date()
      });
    });
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const requestId = req.headers['x-request-id'] as string;
      
      logger.error('Unhandled application error', {
        requestId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body
        },
        user: (req as any).user
      });

      // Don't leak error details in production
      const errorMessage = this.environment === 'production' 
        ? 'Internal server error' 
        : error.message;

      const statusCode = error.statusCode || error.status || 500;

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        requestId,
        timestamp: new Date(),
        ...(this.environment !== 'production' && { 
          details: error.details,
          stack: error.stack 
        })
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', { reason, promise });
      process.exit(1);
    });
  }

  /**
   * Get allowed CORS origins based on environment
   */
  private getAllowedOrigins(): string[] {
    if (this.environment === 'production') {
      return [
        'https://inergize.com',
        'https://www.inergize.com',
        'https://app.inergize.com',
        'https://dashboard.inergize.com'
      ];
    }
    
    // Development origins
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'ws://localhost:3007',
      'wss://localhost:3007'
    ];
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<any> {
    try {
      const result = await database.query('SELECT NOW() as timestamp, version() as version');
      const isTimescaleDB = await database.query(`
        SELECT EXISTS (
          SELECT FROM pg_extension WHERE extname = 'timescaledb'
        ) as timescale_enabled
      `);

      return {
        status: 'healthy',
        timestamp: result.rows[0].timestamp,
        version: result.rows[0].version.split(' ')[0],
        timescaledb: isTimescaleDB.rows[0].timescale_enabled,
        connectionCount: database.getPool()?.totalCount || 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<any> {
    try {
      const info = await redis.ping();
      const memoryInfo = await redis.info('memory');
      
      return {
        status: 'healthy',
        ping: info,
        memory: memoryInfo
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check WebSocket health
   */
  private checkWebSocketHealth(): any {
    try {
      const stats = this.websocketService.getServiceStats();
      return {
        status: 'healthy',
        ...stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Initialize all database connections and services
   */
  public async initializeServices(): Promise<void> {
    try {
      logger.info('Initializing enhanced analytics services...');

      // Initialize database connections
      await database.connect();
      await redis.connect();
      logger.info('Database connections established');

      // Initialize and run migrations
      await this.migrationRunner.initialize();
      await this.migrationRunner.runMigrations();
      logger.info('Database migrations completed');

      // Verify schema integrity
      const schemaValid = await this.migrationRunner.verifySchemaIntegrity();
      if (!schemaValid) {
        throw new Error('Database schema integrity check failed');
      }
      logger.info('Database schema verified');

      // Initialize WebSocket service
      this.websocketService.initialize(this.wsPort);
      logger.info('WebSocket service initialized', { port: this.wsPort });

      // Initialize ingestion service
      await this.ingestionService.initialize();
      logger.info('Ingestion service initialized');

      // Initialize alerting service
      await this.alertingService.initialize();
      logger.info('Alerting service initialized');

      // Seed development data if in development mode
      if (this.environment === 'development') {
        const seedStatus = await this.developmentSeeder.getSeedStatus();
        if (!seedStatus.seeded) {
          logger.info('Seeding development data...');
          await this.developmentSeeder.seedDevelopmentData();
          logger.info('Development data seeded');
        } else {
          logger.info('Development data already exists');
        }
      }

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services', { 
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      throw error;
    }
  }

  /**
   * Start the Enhanced Analytics server
   */
  public async listen(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(this.port, () => {
        logger.info('Enhanced Analytics Service started', {
          port: this.port,
          wsPort: this.wsPort,
          environment: this.environment,
          nodeVersion: process.version,
          processId: process.pid,
          features: [
            'TimescaleDB integration',
            'Real-time WebSocket streaming',
            'Batch data ingestion',
            'Smart alerting system',
            'Continuous aggregates',
            'Performance monitoring'
          ]
        });
        resolve();
      });

      // Graceful shutdown
      const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully`);
        
        server.close(async () => {
          try {
            // Shutdown services in reverse order
            await this.alertingService.shutdown();
            await this.ingestionService.shutdown();
            this.websocketService.close();
            await database.close();
            await redis.close();
            
            logger.info('Enhanced Analytics Service shutdown complete');
            process.exit(0);
          } catch (error) {
            logger.error('Error during shutdown', { error });
            process.exit(1);
          }
        });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    });
  }

  /**
   * Get Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get service instances (for testing)
   */
  public getServices() {
    return {
      websocket: this.websocketService,
      ingestion: this.ingestionService,
      alerting: this.alertingService,
      metrics: this.metricsService,
      migration: this.migrationRunner,
      seeder: this.developmentSeeder
    };
  }
}