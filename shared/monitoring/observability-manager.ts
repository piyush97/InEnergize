/**
 * Comprehensive Observability Manager for InErgize
 * Implements structured logging, metrics collection, distributed tracing, and alerting
 */

import pino from 'pino';
import client from 'prom-client';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse } from 'http';
import express from 'express';

// Interfaces
interface LogContext {
  requestId?: string;
  userId?: string;
  service: string;
  operation: string;
  [key: string]: any;
}

interface MetricLabels {
  [key: string]: string;
}

interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: string;
    message: string;
    fields?: Record<string, any>;
  }>;
  status: 'ok' | 'error';
  error?: Error;
}

interface AlertConfig {
  name: string;
  condition: (value: number, threshold: number) => boolean;
  threshold: number;
  windowMs: number;
  cooldownMs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: ('slack' | 'email' | 'webhook' | 'pagerduty')[];
}

// Custom logger with structured output
const createLogger = (service: string) => {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({ 
        pid: bindings.pid, 
        hostname: bindings.hostname,
        service: bindings.name 
      })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'password',
        'token',
        'authorization',
        'cookie',
        'access_token',
        'refresh_token',
        'linkedin_token',
        'openai_key'
      ],
      censor: '[REDACTED]'
    },
    serializers: {
      req: (req: IncomingMessage) => ({
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length']
        },
        remoteAddress: req.socket?.remoteAddress,
        remotePort: req.socket?.remotePort
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length')
        }
      }),
      err: pino.stdSerializers.err
    }
  });
};

// Prometheus metrics registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'inergize_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10]
});

const httpRequestTotal = new client.Counter({
  name: 'inergize_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service']
});

const databaseQueryDuration = new client.Histogram({
  name: 'inergize_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
});

const externalApiDuration = new client.Histogram({
  name: 'inergize_external_api_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['api', 'endpoint', 'status_code', 'service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

const businessMetrics = new client.Gauge({
  name: 'inergize_business_metrics',
  help: 'Business-specific metrics',
  labelNames: ['metric_type', 'user_tier', 'service']
});

const errorRate = new client.Counter({
  name: 'inergize_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'service', 'severity']
});

const activeConnections = new client.Gauge({
  name: 'inergize_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['service', 'connection_type']
});

const linkedinApiCalls = new client.Counter({
  name: 'inergize_linkedin_api_calls_total',
  help: 'Total LinkedIn API calls',
  labelNames: ['endpoint', 'status', 'rate_limited']
});

const aiTokensUsed = new client.Counter({
  name: 'inergize_ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['provider', 'model', 'operation']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(databaseQueryDuration);
register.registerMetric(externalApiDuration);
register.registerMetric(businessMetrics);
register.registerMetric(errorRate);
register.registerMetric(activeConnections);
register.registerMetric(linkedinApiCalls);
register.registerMetric(aiTokensUsed);

export class ObservabilityManager extends EventEmitter {
  private logger: pino.Logger;
  private traces = new Map<string, TraceSpan>();
  private alerts = new Map<string, AlertConfig>();
  private alertStates = new Map<string, { lastTriggered?: number; isActive: boolean }>();
  private serviceName: string;

  constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
    this.logger = createLogger(serviceName);
    this.setupDefaultAlerts();
  }

  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlert({
      name: 'high_error_rate',
      condition: (value, threshold) => value > threshold,
      threshold: 0.05, // 5% error rate
      windowMs: 300000, // 5 minutes
      cooldownMs: 900000, // 15 minutes
      severity: 'high',
      channels: ['slack', 'email']
    });

    // High response time alert
    this.addAlert({
      name: 'high_response_time',
      condition: (value, threshold) => value > threshold,
      threshold: 5000, // 5 seconds
      windowMs: 300000,
      cooldownMs: 600000,
      severity: 'medium',
      channels: ['slack']
    });

    // LinkedIn API rate limit alert
    this.addAlert({
      name: 'linkedin_rate_limit',
      condition: (value, threshold) => value > threshold,
      threshold: 0.8, // 80% of rate limit
      windowMs: 3600000, // 1 hour
      cooldownMs: 1800000, // 30 minutes
      severity: 'high',
      channels: ['slack', 'email']
    });

    // Database connection exhaustion
    this.addAlert({
      name: 'db_connection_exhaustion',
      condition: (value, threshold) => value > threshold,
      threshold: 0.9, // 90% of max connections
      windowMs: 60000, // 1 minute
      cooldownMs: 300000, // 5 minutes
      severity: 'critical',
      channels: ['slack', 'email', 'pagerduty']
    });
  }

  // =====================================================
  // LOGGING METHODS
  // =====================================================

  public info(message: string, context: Partial<LogContext> = {}): void {
    this.logger.info({
      ...context,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    }, message);
  }

  public warn(message: string, context: Partial<LogContext> = {}): void {
    this.logger.warn({
      ...context,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    }, message);
  }

  public error(message: string, error?: Error, context: Partial<LogContext> = {}): void {
    errorRate.labels({
      error_type: error?.constructor.name || 'Unknown',
      service: this.serviceName,
      severity: 'error'
    }).inc();

    this.logger.error({
      ...context,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      err: error,
      stack: error?.stack
    }, message);
  }

  public debug(message: string, context: Partial<LogContext> = {}): void {
    this.logger.debug({
      ...context,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    }, message);
  }

  // =====================================================
  // METRICS METHODS
  // =====================================================

  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      service: this.serviceName
    };

    httpRequestDuration.labels(labels).observe(duration / 1000);
    httpRequestTotal.labels(labels).inc();
  }

  public recordDatabaseQuery(
    queryType: string,
    table: string,
    duration: number
  ): void {
    databaseQueryDuration.labels({
      query_type: queryType,
      table,
      service: this.serviceName
    }).observe(duration / 1000);
  }

  public recordExternalApiCall(
    api: string,
    endpoint: string,
    statusCode: number,
    duration: number
  ): void {
    externalApiDuration.labels({
      api,
      endpoint,
      status_code: statusCode.toString(),
      service: this.serviceName
    }).observe(duration / 1000);
  }

  public recordBusinessMetric(
    metricType: string,
    value: number,
    userTier: string = 'unknown'
  ): void {
    businessMetrics.labels({
      metric_type: metricType,
      user_tier: userTier,
      service: this.serviceName
    }).set(value);
  }

  public recordLinkedInApiCall(
    endpoint: string,
    status: 'success' | 'error' | 'rate_limited',
    rateLimited: boolean = false
  ): void {
    linkedinApiCalls.labels({
      endpoint,
      status,
      rate_limited: rateLimited.toString()
    }).inc();
  }

  public recordAiTokenUsage(
    provider: string,
    model: string,
    operation: string,
    tokens: number
  ): void {
    aiTokensUsed.labels({
      provider,
      model,
      operation
    }).inc(tokens);
  }

  public setActiveConnections(connectionType: string, count: number): void {
    activeConnections.labels({
      service: this.serviceName,
      connection_type: connectionType
    }).set(count);
  }

  // =====================================================
  // DISTRIBUTED TRACING
  // =====================================================

  public startTrace(operationName: string, parentSpanId?: string): string {
    const traceId = randomUUID();
    const spanId = randomUUID();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      tags: {
        service: this.serviceName,
        operation: operationName
      },
      logs: [],
      status: 'ok'
    };

    this.traces.set(spanId, span);

    this.debug('Trace started', {
      traceId,
      spanId,
      operationName,
      parentSpanId
    });

    return spanId;
  }

  public addTraceTag(spanId: string, key: string, value: any): void {
    const span = this.traces.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  public logToTrace(
    spanId: string, 
    level: string, 
    message: string, 
    fields?: Record<string, any>
  ): void {
    const span = this.traces.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields
      });
    }
  }

  public finishTrace(spanId: string, error?: Error): void {
    const span = this.traces.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = error ? 'error' : 'ok';
    
    if (error) {
      span.error = error;
      span.tags.error = true;
      span.tags.errorMessage = error.message;
    }

    this.info('Trace completed', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.duration,
      status: span.status,
      tags: span.tags
    });

    // Store trace for a short period for debugging
    setTimeout(() => {
      this.traces.delete(spanId);
    }, 300000); // Keep for 5 minutes
  }

  public getActiveTraces(): TraceSpan[] {
    return Array.from(this.traces.values());
  }

  // =====================================================
  // ALERTING SYSTEM
  // =====================================================

  public addAlert(config: AlertConfig): void {
    this.alerts.set(config.name, config);
    this.alertStates.set(config.name, { isActive: false });
  }

  public checkAlert(alertName: string, currentValue: number): void {
    const alert = this.alerts.get(alertName);
    const state = this.alertStates.get(alertName);
    
    if (!alert || !state) return;

    const shouldTrigger = alert.condition(currentValue, alert.threshold);
    const now = Date.now();
    const cooledDown = !state.lastTriggered || 
      (now - state.lastTriggered) > alert.cooldownMs;

    if (shouldTrigger && !state.isActive && cooledDown) {
      state.isActive = true;
      state.lastTriggered = now;
      
      this.triggerAlert(alert, currentValue);
    } else if (!shouldTrigger && state.isActive) {
      state.isActive = false;
      this.resolveAlert(alert, currentValue);
    }
  }

  private triggerAlert(alert: AlertConfig, value: number): void {
    const alertData = {
      name: alert.name,
      severity: alert.severity,
      value,
      threshold: alert.threshold,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    };

    this.error(`Alert triggered: ${alert.name}`, undefined, {
      alert: alertData
    });

    // Emit alert event for external handlers
    this.emit('alert:triggered', alertData);

    // Record alert metric
    errorRate.labels({
      error_type: 'alert',
      service: this.serviceName,
      severity: alert.severity
    }).inc();
  }

  private resolveAlert(alert: AlertConfig, value: number): void {
    const alertData = {
      name: alert.name,
      value,
      threshold: alert.threshold,
      service: this.serviceName,
      timestamp: new Date().toISOString()
    };

    this.info(`Alert resolved: ${alert.name}`, {
      alert: alertData
    });

    this.emit('alert:resolved', alertData);
  }

  // =====================================================
  // EXPRESS MIDDLEWARE
  // =====================================================

  public createExpressMiddleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string || randomUUID();
      const spanId = this.startTrace(`HTTP ${req.method} ${req.path}`, req.headers['x-parent-span-id'] as string);

      // Add request ID to headers
      req.headers['x-request-id'] = requestId;
      res.setHeader('x-request-id', requestId);
      res.setHeader('x-trace-id', spanId);

      // Add trace tags
      this.addTraceTag(spanId, 'http.method', req.method);
      this.addTraceTag(spanId, 'http.url', req.url);
      this.addTraceTag(spanId, 'http.user_agent', req.headers['user-agent']);
      this.addTraceTag(spanId, 'user.id', (req as any).user?.id);

      // Log request
      this.info('HTTP request started', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: (req as any).user?.id
      });

      // Capture response
      const originalSend = res.send;
      res.send = function(body) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Record metrics
        this.recordHttpRequest(req.method, req.route?.path || req.path, statusCode, duration);

        // Add response tags to trace
        this.addTraceTag(spanId, 'http.status_code', statusCode);
        this.addTraceTag(spanId, 'http.response_size', body?.length || 0);

        // Log response
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        this[logLevel]('HTTP request completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode,
          duration,
          responseSize: body?.length || 0,
          userId: (req as any).user?.id
        });

        // Finish trace
        const error = statusCode >= 500 ? new Error(`HTTP ${statusCode}`) : undefined;
        this.finishTrace(spanId, error);

        return originalSend.call(this, body);
      }.bind(this);

      next();
    };
  }

  // =====================================================
  // HEALTH AND METRICS ENDPOINTS
  // =====================================================

  public getMetrics(): Promise<string> {
    return register.metrics();
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    service: string;
    timestamp: string;
    version: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    activeTraces: number;
    activeAlerts: number;
  } {
    const activeAlerts = Array.from(this.alertStates.values())
      .filter(state => state.isActive).length;

    return {
      status: activeAlerts === 0 ? 'healthy' : 'degraded',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeTraces: this.traces.size,
      activeAlerts
    };
  }

  // =====================================================
  // CLEANUP AND SHUTDOWN
  // =====================================================

  public async gracefulShutdown(): Promise<void> {
    this.info('Starting graceful shutdown');

    // Wait for active traces to complete (max 30 seconds)
    const maxWaitTime = 30000;
    const startTime = Date.now();

    while (this.traces.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear remaining traces
    this.traces.clear();

    this.info('Graceful shutdown completed');
  }

  public destroy(): void {
    this.traces.clear();
    this.alerts.clear();
    this.alertStates.clear();
    this.removeAllListeners();
  }
}

// Factory function for creating observability managers
export function createObservabilityManager(serviceName: string): ObservabilityManager {
  return new ObservabilityManager(serviceName);
}

// Export singleton instance for each service
export const observability = createObservabilityManager(
  process.env.SERVICE_NAME || 'inergize-service'
);

// Global error handlers
process.on('uncaughtException', (error) => {
  observability.error('Uncaught exception', error, { fatal: true });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  observability.error('Unhandled promise rejection', reason as Error, { 
    promise: promise.toString(),
    fatal: false 
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  observability.info('Received SIGTERM, starting graceful shutdown');
  await observability.gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  observability.info('Received SIGINT, starting graceful shutdown');
  await observability.gracefulShutdown();
  process.exit(0);
});

export default observability;