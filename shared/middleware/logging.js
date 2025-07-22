"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceLogger = exports.aiLogger = exports.linkedinLogger = exports.authLogger = exports.createLogger = exports.ContextLogger = exports.errorLogger = exports.requestLogger = exports.correlationIdMiddleware = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
// Log levels
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Create Winston logger instance
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: LOG_LEVELS,
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
    }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, correlationId, ...metadata }) => {
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
    })),
    defaultMeta: {
        service: process.env.SERVICE_NAME || 'inergize-service',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
    },
    transports: [
        // Console transport
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.simple()),
        }),
        // File transport for all logs
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.env.LOG_FILE_PATH || './logs', 'app.log'),
            format: winston_1.default.format.json(),
        }),
        // Separate file for errors
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.env.LOG_FILE_PATH || './logs', 'error.log'),
            level: 'error',
            format: winston_1.default.format.json(),
        }),
    ],
});
// Add HTTP transport in production
if (process.env.NODE_ENV === 'production' && process.env.LOG_HTTP_ENDPOINT) {
    exports.logger.add(new winston_1.default.transports.Http({
        host: process.env.LOG_HTTP_HOST,
        port: parseInt(process.env.LOG_HTTP_PORT || '80'),
        path: process.env.LOG_HTTP_PATH || '/logs',
        ssl: process.env.LOG_HTTP_SSL === 'true',
    }));
}
// Correlation ID middleware
const correlationIdMiddleware = (req, res, next) => {
    // Generate or extract correlation ID
    req.correlationId =
        req.headers['x-correlation-id'] ||
            req.headers['x-request-id'] ||
            (0, uuid_1.v4)();
    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', req.correlationId);
    // Record start time for response time calculation
    req.startTime = Date.now();
    next();
};
exports.correlationIdMiddleware = correlationIdMiddleware;
// Request logging middleware
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    // Log incoming request
    exports.logger.http('Incoming request', {
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
    res.end = function (chunk, encoding, cb) {
        const responseTime = Date.now() - startTime;
        // Log outgoing response
        exports.logger.http('Outgoing response', {
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
exports.requestLogger = requestLogger;
// Error logging middleware
const errorLogger = (error, req, res, next) => {
    // Log error with context
    exports.logger.error('Request error', {
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
exports.errorLogger = errorLogger;
// Business logic logger with context
class ContextLogger {
    context;
    correlationId;
    constructor(context, correlationId) {
        this.context = context;
        this.correlationId = correlationId;
    }
    log(level, message, metadata) {
        exports.logger.log(level, message, {
            ...metadata,
            context: this.context,
            correlationId: this.correlationId,
        });
    }
    debug(message, metadata) {
        this.log('debug', message, metadata);
    }
    info(message, metadata) {
        this.log('info', message, metadata);
    }
    warn(message, metadata) {
        this.log('warn', message, metadata);
    }
    error(message, error, metadata) {
        const errorMetadata = error instanceof Error
            ? { error: { name: error.name, message: error.message, stack: error.stack } }
            : { error };
        this.log('error', message, { ...errorMetadata, ...metadata });
    }
    // Business-specific logging methods
    userAction(userId, action, details) {
        this.info(`User action: ${action}`, {
            userId,
            action,
            details,
            type: 'user_action',
        });
    }
    securityEvent(event, details) {
        this.warn(`Security event: ${event}`, {
            event,
            details,
            type: 'security_event',
        });
    }
    performanceMetric(metric, value, unit) {
        this.info(`Performance metric: ${metric}`, {
            metric,
            value,
            unit,
            type: 'performance_metric',
        });
    }
    externalApiCall(service, endpoint, responseTime, statusCode) {
        this.info(`External API call: ${service}`, {
            service,
            endpoint,
            responseTime,
            statusCode,
            type: 'external_api_call',
        });
    }
    dataOperation(operation, table, count, duration) {
        this.debug(`Database operation: ${operation}`, {
            operation,
            table,
            count,
            duration,
            type: 'data_operation',
        });
    }
}
exports.ContextLogger = ContextLogger;
// Factory function to create context logger
const createLogger = (context, req) => {
    return new ContextLogger(context, req?.correlationId);
};
exports.createLogger = createLogger;
// Structured logging for specific domains
exports.authLogger = {
    loginAttempt: (email, success, ip, correlationId) => {
        const contextLogger = new ContextLogger('auth', correlationId);
        contextLogger.info(`Login attempt: ${success ? 'SUCCESS' : 'FAILED'}`, {
            email,
            success,
            ip,
            type: 'login_attempt',
        });
    },
    tokenGenerated: (userId, tokenType, correlationId) => {
        const contextLogger = new ContextLogger('auth', correlationId);
        contextLogger.info(`Token generated: ${tokenType}`, {
            userId,
            tokenType,
            type: 'token_generated',
        });
    },
    passwordChanged: (userId, correlationId) => {
        const contextLogger = new ContextLogger('auth', correlationId);
        contextLogger.info('Password changed', {
            userId,
            type: 'password_changed',
        });
    },
};
exports.linkedinLogger = {
    apiCall: (endpoint, method, statusCode, responseTime, correlationId) => {
        const contextLogger = new ContextLogger('linkedin', correlationId);
        contextLogger.info(`LinkedIn API call: ${method} ${endpoint}`, {
            endpoint,
            method,
            statusCode,
            responseTime,
            type: 'linkedin_api_call',
        });
    },
    profileSync: (userId, profileId, success, correlationId) => {
        const contextLogger = new ContextLogger('linkedin', correlationId);
        contextLogger.info(`Profile sync: ${success ? 'SUCCESS' : 'FAILED'}`, {
            userId,
            profileId,
            success,
            type: 'profile_sync',
        });
    },
    contentPublished: (userId, contentId, platform, correlationId) => {
        const contextLogger = new ContextLogger('linkedin', correlationId);
        contextLogger.info('Content published to LinkedIn', {
            userId,
            contentId,
            platform,
            type: 'content_published',
        });
    },
};
exports.aiLogger = {
    contentGenerated: (userId, promptTokens, completionTokens, model, correlationId) => {
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
    imageGenerated: (userId, prompt, model, correlationId) => {
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
const performanceLogger = (threshold = 1000) => {
    return (req, res, next) => {
        const startTime = process.hrtime.bigint();
        res.on('finish', () => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
            if (duration > threshold) {
                exports.logger.warn('Slow request detected', {
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
exports.performanceLogger = performanceLogger;
// Log rotation setup (if using file transports)
if (process.env.LOG_ROTATION === 'true') {
    require('winston-daily-rotate-file');
    // Replace file transports with rotating ones
    exports.logger.clear();
    exports.logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize({ all: true }), winston_1.default.format.simple()),
    }));
    // Daily rotating file transport
    exports.logger.add(new (require('winston-daily-rotate-file'))({
        filename: path_1.default.join(process.env.LOG_FILE_PATH || './logs', 'app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        format: winston_1.default.format.json(),
    }));
}
//# sourceMappingURL=logging.js.map