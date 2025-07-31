import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { register, collectDefaultMetrics } from 'prom-client';
import winston from 'winston';
import dotenv from 'dotenv';

import { WebSocketService } from '@/services/websocket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { WebSocketConfig } from '@/types/websocket';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/websocket-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/websocket-combined.log' })
  ]
});

// Enable Prometheus metrics collection
collectDefaultMetrics();

const app = express();
const server = createServer(app);
const PORT = parseInt(process.env.PORT || '3007');

// Security middleware
app.use(helmet({\n  crossOriginEmbedderPolicy: false,\n  contentSecurityPolicy: {\n    directives: {\n      defaultSrc: [\"'self'\"],\n      connectSrc: [\"'self'\", 'ws:', 'wss:'],\n    },\n  },\n}));\n\n// CORS configuration\nconst corsOptions = {\n  origin: [\n    'http://localhost:3000',\n    'http://localhost:3001',\n    'https://app.inergize.digital',\n    'https://dashboard.inergize.digital'\n  ],\n  credentials: true,\n  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],\n  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']\n};\n\napp.use(cors(corsOptions));\napp.use(express.json({ limit: '10mb' }));\napp.use(express.urlencoded({ extended: true, limit: '10mb' }));\n\n// Rate limiting\nconst globalRateLimit = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 1000, // limit each IP to 1000 requests per windowMs\n  message: 'Too many requests from this IP',\n  standardHeaders: true,\n  legacyHeaders: false,\n});\n\napp.use(globalRateLimit);\n\n// Health check endpoint\napp.get('/health', (req, res) => {\n  res.json({\n    status: 'healthy',\n    service: 'websocket-service',\n    version: '1.0.0',\n    uptime: process.uptime(),\n    timestamp: new Date().toISOString(),\n    dependencies: {\n      redis: 'connected', // TODO: Add actual health checks\n      websocket: 'active'\n    }\n  });\n});\n\n// Metrics endpoint\napp.get('/metrics', async (req, res) => {\n  try {\n    res.set('Content-Type', register.contentType);\n    res.end(await register.metrics());\n  } catch (error) {\n    res.status(500).end(error);\n  }\n});\n\n// WebSocket service statistics endpoint (protected)\napp.get('/stats', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => {\n  if (webSocketService) {\n    const stats = webSocketService.getStats();\n    res.json({\n      success: true,\n      data: stats,\n      timestamp: new Date()\n    });\n  } else {\n    res.status(503).json({ error: 'WebSocket service not initialized' });\n  }\n});\n\n// Emergency broadcast endpoint (admin only)\napp.post('/broadcast/emergency', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => {\n  try {\n    const { message, targetUsers, severity = 'CRITICAL' } = req.body;\n    \n    if (!message) {\n      res.status(400).json({ error: 'Message is required' });\n      return;\n    }\n\n    const notification = {\n      type: 'SERVICE_STATUS' as const,\n      title: 'Emergency Notification',\n      message,\n      severity: severity as 'INFO' | 'WARNING' | 'CRITICAL',\n      targetUsers,\n      timestamp: new Date()\n    };\n\n    if (webSocketService) {\n      webSocketService.broadcastSystemNotification(notification);\n      res.json({ success: true, message: 'Emergency notification sent' });\n    } else {\n      res.status(503).json({ error: 'WebSocket service not available' });\n    }\n  } catch (error) {\n    logger.error('Emergency broadcast error:', error);\n    res.status(500).json({ error: 'Failed to send emergency notification' });\n  }\n});\n\n// System notification endpoint (admin only)\napp.post('/broadcast/notification', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => {\n  try {\n    const { type, title, message, severity = 'INFO', targetUsers, expiresAt, actionUrl, actionText } = req.body;\n    \n    if (!title || !message) {\n      res.status(400).json({ error: 'Title and message are required' });\n      return;\n    }\n\n    const notification = {\n      type: type || 'FEATURE_UPDATE',\n      title,\n      message,\n      severity: severity as 'INFO' | 'WARNING' | 'CRITICAL',\n      targetUsers,\n      expiresAt: expiresAt ? new Date(expiresAt) : undefined,\n      actionUrl,\n      actionText\n    };\n\n    if (webSocketService) {\n      webSocketService.broadcastSystemNotification(notification);\n      res.json({ success: true, message: 'Notification sent successfully' });\n    } else {\n      res.status(503).json({ error: 'WebSocket service not available' });\n    }\n  } catch (error) {\n    logger.error('Notification broadcast error:', error);\n    res.status(500).json({ error: 'Failed to send notification' });\n  }\n});\n\n// 404 handler\napp.use('*', (req, res) => {\n  res.status(404).json({ error: 'Endpoint not found' });\n});\n\n// Error handling middleware\napp.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {\n  logger.error('Unhandled error:', error);\n  res.status(error.status || 500).json({\n    error: error.message || 'Internal server error',\n    timestamp: new Date().toISOString()\n  });\n});\n\n// WebSocket service configuration\nconst webSocketConfig: WebSocketConfig = {\n  port: PORT,\n  cors: corsOptions,\n  rateLimit: {\n    windowMs: 15 * 60 * 1000,\n    max: 1000\n  },\n  channels: [], // Will be initialized by the service\n  redis: {\n    host: process.env.REDIS_HOST || 'localhost',\n    port: parseInt(process.env.REDIS_PORT || '6379'),\n    password: process.env.REDIS_PASSWORD\n  },\n  jwt: {\n    secret: process.env.JWT_SECRET || 'fallback-secret-key',\n    expiresIn: '24h'\n  }\n};\n\n// Initialize WebSocket service\nlet webSocketService: WebSocketService | null = null;\n\n// Graceful shutdown handling\nconst gracefulShutdown = async (signal: string): Promise<void> => {\n  logger.info(`Received ${signal}. Starting graceful shutdown...`);\n  \n  // Stop accepting new connections\n  server.close(async () => {\n    logger.info('HTTP server closed');\n    \n    // Cleanup WebSocket service\n    if (webSocketService) {\n      await webSocketService.cleanup();\n      logger.info('WebSocket service cleaned up');\n    }\n    \n    // Exit process\n    process.exit(0);\n  });\n  \n  // Force exit after 30 seconds\n  setTimeout(() => {\n    logger.error('Forced shutdown after timeout');\n    process.exit(1);\n  }, 30000);\n};\n\n// Handle shutdown signals\nprocess.on('SIGTERM', () => gracefulShutdown('SIGTERM'));\nprocess.on('SIGINT', () => gracefulShutdown('SIGINT'));\n\n// Handle uncaught exceptions\nprocess.on('uncaughtException', (error) => {\n  logger.error('Uncaught Exception:', error);\n  gracefulShutdown('uncaughtException');\n});\n\nprocess.on('unhandledRejection', (reason, promise) => {\n  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);\n  gracefulShutdown('unhandledRejection');\n});\n\n// Start server\nserver.listen(PORT, '0.0.0.0', async () => {\n  logger.info(`WebSocket service running on port ${PORT}`);\n  \n  try {\n    // Initialize WebSocket service\n    webSocketService = new WebSocketService(server, webSocketConfig);\n    \n    // Set up event listeners\n    webSocketService.on('userConnected', (data) => {\n      logger.info(`User connected: ${data.userId}`);\n    });\n    \n    webSocketService.on('userDisconnected', (data) => {\n      logger.info(`User disconnected: ${data.userId}`);\n    });\n    \n    webSocketService.on('emergencyStop', (data) => {\n      logger.warn(`Emergency stop triggered by user ${data.userId}: ${data.reason}`);\n    });\n    \n    webSocketService.on('automationSuspended', (data) => {\n      logger.warn(`Automation suspended for user ${data.userId}: ${data.reason}`);\n    });\n    \n    logger.info('WebSocket service initialized successfully');\n    \n  } catch (error) {\n    logger.error('Failed to initialize WebSocket service:', error);\n    process.exit(1);\n  }\n});\n\nexport default app;