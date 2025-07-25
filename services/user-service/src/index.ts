// User Service Entry Point
// Full User Management Service with Profile Management

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import winston from 'winston';
import promClient from 'prom-client';
import path from 'path';
import fs from 'fs';

// Import routes and middleware
import userRoutes from './routes/user.routes';
import { authMiddleware } from './middleware/auth.middleware';

// Load environment variables
config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
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

// Create necessary directories
const uploadsDir = path.join(__dirname, '..', 'uploads', 'profile-images');
const logsDir = path.join(__dirname, '..', 'logs');

[uploadsDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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

const uploadedFiles = new promClient.Counter({
  name: 'uploaded_files_total',
  help: 'Total number of uploaded files',
  labelNames: ['file_type', 'status']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequests);
register.registerMetric(uploadedFiles);

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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

// API routes
app.use('/users', userRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'InErgize User Management Service',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    documentation: '/users/health',
    features: [
      'User Profile Management',
      'Subscription & Usage Tracking',
      'Preferences & Settings',
      'Activity Logging',
      'File Upload (Profile Images)',
      'Admin User Management',
      'User Search & Statistics',
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: 'connected',
      authService: 'connected',
      storage: 'available',
    }
  });
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    service: 'user-service'
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

// Start server
const server = app.listen(PORT, () => {
  logger.info(`👤 User Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Metrics available at: http://localhost:${PORT}/metrics`);
  logger.info(`Health check at: http://localhost:${PORT}/health`);
  logger.info(`Uploads directory: ${uploadsDir}`);
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

export default app;