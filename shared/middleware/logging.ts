import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

// Log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Create Winston logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: LOG_LEVELS,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, correlationId, ...metadata }) => {
      let log = `${timestamp} [${level.toUpperCase()}]`;
      
      if (correlationId) {
        log += ` [${correlationId}]`;
      }
      
      log += `: ${message}`;
      
      // Add metadata if present
      if (Object.keys(metadata).length > 0) {
        log += ` ${JSON.stringify(metadata)}`;
      }
      
      return log;
    })
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'inergize-service',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple()
      ),
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'app.log'),
      format: winston.format.json(),
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(process.env.LOG_FILE_PATH || './logs', 'error.log'),
      level: 'error',
      format: winston.format.json(),
    }),
  ],
});

// Add HTTP transport in production
if (process.env.NODE_ENV === 'production' && process.env.LOG_HTTP_ENDPOINT) {
  logger.add(
    new winston.transports.Http({
      host: process.env.LOG_HTTP_HOST,
      port: parseInt(process.env.LOG_HTTP_PORT || '80'),
      path: process.env.LOG_HTTP_PATH || '/logs',
      ssl: process.env.LOG_HTTP_SSL === 'true',
    })
  );
}

// Correlation ID middleware
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate or extract correlation ID
  req.correlationId = 
    req.headers['x-correlation-id'] as string || 
    req.headers['x-request-id'] as string || 
    uuidv4();
  
  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', req.correlationId);
  
  // Record start time for response time calculation
  req.startTime = Date.now();
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log incoming request
  logger.http('Incoming request', {
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    headers: {
      authorization: req.headers.authorization ? '[REDACTED]' : undefined,
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
    },
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: (() => void)): Response {
    const responseTime = Date.now() - startTime;
    
    // Log outgoing response
    logger.http('Outgoing response', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('Content-Length'),
    });
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Error logging middleware
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  // Log error with context
  logger.error('Request error', {
    correlationId: req.correlationId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: {
        authorization: req.headers.authorization ? '[REDACTED]' : undefined,
        'content-type': req.headers['content-type'],
        'user-agent': req.get('User-Agent'),
      },
      body: req.body && Object.keys(req.body).length > 0 ? '[REDACTED]' : undefined,
      params: req.params,
      query: req.query,
      ip: req.ip || req.connection.remoteAddress,
    },
  });
  
  next(error);
};

// Business logic logger with context
export class ContextLogger {
  private context: string;
  private correlationId?: string;
  
  constructor(context: string, correlationId?: string) {
    this.context = context;
    this.correlationId = correlationId;
  }
  
  private log(level: keyof typeof LOG_LEVELS, message: string, metadata?: any): void {
    logger.log(level, message, {
      ...metadata,
      context: this.context,
      correlationId: this.correlationId,
    });
  }
  
  debug(message: string, metadata?: any): void {
    this.log('debug', message, metadata);
  }
  
  info(message: string, metadata?: any): void {
    this.log('info', message, metadata);
  }
  
  warn(message: string, metadata?: any): void {
    this.log('warn', message, metadata);
  }
  
  error(message: string, error?: Error | any, metadata?: any): void {
    const errorMetadata = error instanceof Error 
      ? { error: { name: error.name, message: error.message, stack: error.stack } }
      : { error };
    
    this.log('error', message, { ...errorMetadata, ...metadata });
  }
  
  // Business-specific logging methods
  userAction(userId: string, action: string, details?: any): void {
    this.info(`User action: ${action}`, {
      userId,
      action,
      details,
      type: 'user_action',
    });
  }
  
  securityEvent(event: string, details?: any): void {
    this.warn(`Security event: ${event}`, {
      event,
      details,
      type: 'security_event',
    });
  }
  
  performanceMetric(metric: string, value: number, unit: string): void {
    this.info(`Performance metric: ${metric}`, {
      metric,
      value,
      unit,
      type: 'performance_metric',
    });
  }
  
  externalApiCall(service: string, endpoint: string, responseTime: number, statusCode?: number): void {
    this.info(`External API call: ${service}`, {
      service,
      endpoint,
      responseTime,
      statusCode,
      type: 'external_api_call',
    });
  }
  
  dataOperation(operation: string, table: string, count?: number, duration?: number): void {
    this.debug(`Database operation: ${operation}`, {
      operation,
      table,
      count,
      duration,
      type: 'data_operation',
    });
  }
}

// Factory function to create context logger
export const createLogger = (context: string, req?: Request): ContextLogger => {
  return new ContextLogger(context, req?.correlationId);
};

// Structured logging for specific domains
export const authLogger = {
  loginAttempt: (email: string, success: boolean, ip?: string, correlationId?: string) => {
    const contextLogger = new ContextLogger('auth', correlationId);
    contextLogger.info(`Login attempt: ${success ? 'SUCCESS' : 'FAILED'}`, {
      email,
      success,
      ip,
      type: 'login_attempt',
    });
  },
  
  tokenGenerated: (userId: string, tokenType: 'access' | 'refresh', correlationId?: string) => {
    const contextLogger = new ContextLogger('auth', correlationId);
    contextLogger.info(`Token generated: ${tokenType}`, {
      userId,
      tokenType,
      type: 'token_generated',
    });
  },
  
  passwordChanged: (userId: string, correlationId?: string) => {
    const contextLogger = new ContextLogger('auth', correlationId);
    contextLogger.info('Password changed', {
      userId,
      type: 'password_changed',
    });
  },
};

export const linkedinLogger = {
  apiCall: (endpoint: string, method: string, statusCode: number, responseTime: number, correlationId?: string) => {
    const contextLogger = new ContextLogger('linkedin', correlationId);
    contextLogger.info(`LinkedIn API call: ${method} ${endpoint}`, {
      endpoint,
      method,
      statusCode,
      responseTime,
      type: 'linkedin_api_call',
    });
  },
  
  profileSync: (userId: string, profileId: string, success: boolean, correlationId?: string) => {
    const contextLogger = new ContextLogger('linkedin', correlationId);
    contextLogger.info(`Profile sync: ${success ? 'SUCCESS' : 'FAILED'}`, {
      userId,
      profileId,
      success,
      type: 'profile_sync',
    });
  },
  
  contentPublished: (userId: string, contentId: string, platform: string, correlationId?: string) => {
    const contextLogger = new ContextLogger('linkedin', correlationId);
    contextLogger.info('Content published to LinkedIn', {
      userId,
      contentId,
      platform,
      type: 'content_published',
    });
  },
};

export const aiLogger = {
  contentGenerated: (userId: string, promptTokens: number, completionTokens: number, model: string, correlationId?: string) => {
    const contextLogger = new ContextLogger('ai', correlationId);
    contextLogger.info('AI content generated', {
      userId,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      model,
      type: 'ai_content_generated',
    });
  },
  
  imageGenerated: (userId: string, prompt: string, model: string, correlationId?: string) => {
    const contextLogger = new ContextLogger('ai', correlationId);
    contextLogger.info('AI image generated', {
      userId,
      prompt: prompt.substring(0, 100), // Limit prompt length in logs
      model,
      type: 'ai_image_generated',
    });
  },
};

// Performance logging middleware
export const performanceLogger = (threshold: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();
    
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      
      if (duration > threshold) {
        logger.warn('Slow request detected', {
          correlationId: req.correlationId,
          method: req.method,
          url: req.originalUrl || req.url,
          duration,
          statusCode: res.statusCode,
          type: 'slow_request',
        });
      }
    });
    
    next();
  };
};

// Log rotation setup (if using file transports)
if (process.env.LOG_ROTATION === 'true') {
  require('winston-daily-rotate-file');
  
  // Replace file transports with rotating ones
  logger.clear();
  
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.simple()
    ),
  }));
  
  // Daily rotating file transport
  logger.add(new (require('winston-daily-rotate-file'))({
    filename: path.join(process.env.LOG_FILE_PATH || './logs', 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    format: winston.format.json(),
  }));
}