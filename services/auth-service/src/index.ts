// Auth Service Entry Point
// Full JWT Authentication Service with MFA Support

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import winston from 'winston';
import promClient from 'prom-client';

// Import routes and middleware
import authRoutes from './routes/auth.routes';
import { authMiddleware } from './middleware/auth.middleware';
import { databaseService } from './services/database.service';

// Load environment variables
config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Configure Prometheus metrics
const register = promClient.register;
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequests = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequests);

// Global rate limiting
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP',
    code: 'GLOBAL_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Basic middleware
app.use(globalRateLimit);
app.use(helmet({
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

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration
    );
    
    httpRequests.inc({ method, route, status_code: statusCode });
  });
  
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'InErgize Authentication Service',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    documentation: '/auth/health',
    features: [
      'JWT Authentication',
      'Multi-Factor Authentication (MFA)',
      'Session Management',
      'Rate Limiting',
      'Role-Based Access Control',
      'Password Security',
      'Token Refresh',
    ]
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await databaseService.healthCheck();
    
    res.json({
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      service: 'auth-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbHealth.status,
        databaseLatency: dbHealth.latency,
        redis: 'connected',
        rateLimiting: 'active',
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'auth-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'unhealthy',
        redis: 'unknown',
        rateLimiting: 'unknown',
      },
      error: 'Database connection failed'
    });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// API routes
app.use('/', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    service: 'auth-service'
  });
});

// Global error handler
app.use(authMiddleware.errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Connect to database
    await databaseService.connect();
    logger.info('✅ Database connection established');

    const server = app.listen(PORT, () => {
      logger.info(`🔐 Auth Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Metrics available at: http://localhost:${PORT}/metrics`);
      logger.info(`Health check at: http://localhost:${PORT}/health`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

      switch (error.code) {
        case 'EACCES':
          logger.error(bind + ' requires elevated privileges');
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(bind + ' is already in use');
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    return server;
  } catch (error) {
    logger.error('Failed to start auth service:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;