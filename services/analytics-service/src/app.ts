import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { register, collectDefaultMetrics } from 'prom-client';

import { logger } from '@/config/logger';
import { database } from '@/config/database';
import { redis } from '@/config/redis';
import metricsRoutes from '@/routes/metrics.routes';
import predictiveAnalyticsRoutes from '@/routes/predictiveAnalytics.routes';

// Collect default metrics
collectDefaultMetrics();

export class App {
  public app: express.Application;
  private readonly port: number;
  private readonly environment: string;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3006');
    this.environment = process.env.NODE_ENV || 'development';

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
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.getAllowedOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  /**
   * Initialize application routes
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date(),
          service: 'analytics-service',
          version: '1.0.0',
          environment: this.environment,
          uptime: process.uptime()
        }
      });
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end();
      }
    });

    // API routes
    this.app.use('/api/v1/metrics', metricsRoutes);
    this.app.use('/api/v1/predictions', predictiveAnalyticsRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        userId: req.user?.userId
      });

      // Don't leak error details in production
      const errorMessage = this.environment === 'production' 
        ? 'Internal server error' 
        : error.message;

      res.status(error.status || 500).json({
        success: false,
        error: errorMessage,
        ...(this.environment !== 'production' && { details: error.details })
      });
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
        'https://app.inergize.com'
      ];
    }
    
    // Development origins
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];
  }

  /**
   * Initialize database connections
   */
  public async initializeDatabase(): Promise<void> {
    try {
      await database.connect();
      await redis.connect();
      logger.info('Database connections initialized');
    } catch (error) {
      logger.error('Failed to initialize database connections', { 
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
   * Start the Express server
   */
  public async listen(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(this.port, () => {
        logger.info('Analytics service started', {
          port: this.port,
          environment: this.environment,
          nodeVersion: process.version,
          processId: process.pid
        });
        resolve();
      });

      // Graceful shutdown
      const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully`);
        
        server.close(async () => {
          try {
            await database.close();
            await redis.close();
            logger.info('Analytics service shut down complete');
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
}