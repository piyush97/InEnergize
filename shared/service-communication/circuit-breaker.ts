/**
 * Circuit Breaker Pattern for Inter-Service Communication
 * Implements resilience patterns for service-to-service calls
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ name: 'circuit-breaker' });

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedResponseTime: number;
  volumeThreshold: number;
  errorPercentageThreshold: number;
}

export interface ServiceEndpoint {
  name: string;
  baseURL: string;
  timeout: number;
  retries: number;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private requestCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private monitoringTimer?: NodeJS.Timeout;

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig
  ) {
    super();
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.evaluateCircuitState();
      this.resetCounters();
    }, this.config.monitoringPeriod);
  }

  private evaluateCircuitState(): void {
    const errorPercentage = this.requestCount > 0 
      ? (this.failureCount / this.requestCount) * 100 
      : 0;

    switch (this.state) {
      case CircuitState.CLOSED:
        if (
          this.requestCount >= this.config.volumeThreshold &&
          errorPercentage >= this.config.errorPercentageThreshold
        ) {
          this.openCircuit();
        }
        break;

      case CircuitState.OPEN:
        if (this.shouldAttemptReset()) {
          this.halfOpenCircuit();
        }
        break;

      case CircuitState.HALF_OPEN:
        if (this.successCount > 0) {
          this.closeCircuit();
        } else if (this.failureCount > 0) {
          this.openCircuit();
        }
        break;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
    
    logger.warn('Circuit breaker opened', {
      service: this.serviceName,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      resetTime: this.nextAttemptTime
    });

    this.emit('circuitOpened', {
      service: this.serviceName,
      resetTime: this.nextAttemptTime
    });
  }

  private halfOpenCircuit(): void {
    this.state = CircuitState.HALF_OPEN;
    
    logger.info('Circuit breaker half-opened', {
      service: this.serviceName
    });

    this.emit('circuitHalfOpened', {
      service: this.serviceName
    });
  }

  private closeCircuit(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.nextAttemptTime = undefined;
    
    logger.info('Circuit breaker closed', {
      service: this.serviceName
    });

    this.emit('circuitClosed', {
      service: this.serviceName
    });
  }

  private resetCounters(): void {
    this.requestCount = 0;
    this.failureCount = 0;
    this.successCount = 0;
  }

  public async execute<T>(request: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      throw new Error(`Circuit breaker is OPEN for ${this.serviceName}. Next attempt at ${this.nextAttemptTime}`);
    }

    this.requestCount++;

    try {
      const startTime = Date.now();
      const result = await request();
      const responseTime = Date.now() - startTime;

      this.successCount++;

      if (responseTime > this.config.expectedResponseTime) {
        logger.warn('Slow response detected', {
          service: this.serviceName,
          responseTime,
          expectedResponseTime: this.config.expectedResponseTime
        });
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = new Date();
      
      logger.error('Circuit breaker request failed', {
        service: this.serviceName,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount: this.failureCount
      });

      throw error;
    }
  }

  public getState(): CircuitState {
    return this.state;
  }

  public getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    requestCount: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  public destroy(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    this.removeAllListeners();
  }
}

export class ServiceCommunicationManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private axiosInstances = new Map<string, AxiosInstance>();

  constructor(private services: ServiceEndpoint[]) {
    this.initializeServices();
  }

  private initializeServices(): void {
    this.services.forEach(service => {
      // Create circuit breaker
      const circuitBreakerConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 30000,
        expectedResponseTime: 5000,
        volumeThreshold: 10,
        errorPercentageThreshold: 50,
        ...service.circuitBreakerConfig
      };

      const circuitBreaker = new CircuitBreaker(service.name, circuitBreakerConfig);
      this.circuitBreakers.set(service.name, circuitBreaker);

      // Create Axios instance with interceptors
      const axiosInstance = axios.create({
        baseURL: service.baseURL,
        timeout: service.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'inergize-service-communication',
          'X-Service-Version': '1.0.0'
        }
      });

      // Request interceptor for authentication and request ID
      axiosInstance.interceptors.request.use(
        (config) => {
          config.headers['X-Request-ID'] = this.generateRequestId();
          config.headers['X-Timestamp'] = new Date().toISOString();
          return config;
        },
        (error) => Promise.reject(error)
      );

      // Response interceptor for error handling and metrics
      axiosInstance.interceptors.response.use(
        (response) => {
          this.recordMetrics(service.name, 'success', response);
          return response;
        },
        async (error) => {
          this.recordMetrics(service.name, 'error', error.response);
          
          // Implement retry logic
          if (this.shouldRetry(error, service)) {
            return this.retryRequest(error.config, service, axiosInstance);
          }
          
          return Promise.reject(error);
        }
      );

      this.axiosInstances.set(service.name, axiosInstance);
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldRetry(error: any, service: ServiceEndpoint): boolean {
    const retryableStatuses = [500, 502, 503, 504, 408, 429];
    const status = error.response?.status;
    const retryCount = error.config?.__retryCount || 0;

    return (
      retryableStatuses.includes(status) &&
      retryCount < service.retries &&
      !error.config?.__isRetryRequest
    );
  }

  private async retryRequest(
    config: AxiosRequestConfig,
    service: ServiceEndpoint,
    axiosInstance: AxiosInstance
  ): Promise<AxiosResponse> {
    const retryCount = (config as any).__retryCount || 0;
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff

    await new Promise(resolve => setTimeout(resolve, delay));

    (config as any).__retryCount = retryCount + 1;
    (config as any).__isRetryRequest = true;

    logger.info('Retrying request', {
      service: service.name,
      retryCount: retryCount + 1,
      url: config.url,
      delay
    });

    return axiosInstance.request(config);
  }

  private recordMetrics(serviceName: string, result: 'success' | 'error', response?: any): void {
    const metrics = {
      service: serviceName,
      result,
      status: response?.status,
      responseTime: response?.config?.metadata?.responseTime,
      timestamp: new Date().toISOString()
    };

    logger.info('Service communication metric', metrics);
    
    // Here you would typically send metrics to your monitoring system
    // e.g., Prometheus, DataDog, etc.
  }

  public async makeRequest<T>(
    serviceName: string,
    config: AxiosRequestConfig
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    const axiosInstance = this.axiosInstances.get(serviceName);

    if (!circuitBreaker || !axiosInstance) {
      throw new Error(`Service ${serviceName} not configured`);
    }

    return circuitBreaker.execute(async () => {
      const startTime = Date.now();
      const response = await axiosInstance.request(config);
      const responseTime = Date.now() - startTime;
      
      (response.config as any).metadata = {
        ...((response.config as any).metadata || {}),
        responseTime
      };

      return response.data;
    });
  }

  public getCircuitBreakerStatus(serviceName: string): any {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    return circuitBreaker ? circuitBreaker.getStats() : null;
  }

  public getAllCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    this.circuitBreakers.forEach((circuitBreaker, serviceName) => {
      status[serviceName] = circuitBreaker.getStats();
    });

    return status;
  }

  public destroy(): void {
    this.circuitBreakers.forEach(circuitBreaker => {
      circuitBreaker.destroy();
    });
    
    this.circuitBreakers.clear();
    this.axiosInstances.clear();
  }
}

// Service definitions for InErgize
export const INERGIZE_SERVICES: ServiceEndpoint[] = [
  {
    name: 'auth-service',
    baseURL: process.env.AUTH_SERVICE_URL || 'http://inergize-auth-service:3001',
    timeout: 10000,
    retries: 3,
    circuitBreakerConfig: {
      failureThreshold: 3,
      resetTimeout: 30000,
      expectedResponseTime: 2000
    }
  },
  {
    name: 'user-service',
    baseURL: process.env.USER_SERVICE_URL || 'http://inergize-user-service:3002',
    timeout: 10000,
    retries: 3,
    circuitBreakerConfig: {
      failureThreshold: 3,
      resetTimeout: 30000,
      expectedResponseTime: 2000
    }
  },
  {
    name: 'linkedin-service',
    baseURL: process.env.LINKEDIN_SERVICE_URL || 'http://inergize-linkedin-service:3003',
    timeout: 30000,
    retries: 2,
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 60000,
      expectedResponseTime: 10000,
      errorPercentageThreshold: 30 // More tolerant for external API dependency
    }
  },
  {
    name: 'analytics-service',
    baseURL: process.env.ANALYTICS_SERVICE_URL || 'http://inergize-analytics-service:3004',
    timeout: 15000,
    retries: 2,
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 45000,
      expectedResponseTime: 5000
    }
  },
  {
    name: 'ai-service',
    baseURL: process.env.AI_SERVICE_URL || 'http://inergize-ai-service:3005',
    timeout: 120000,
    retries: 1,
    circuitBreakerConfig: {
      failureThreshold: 3,
      resetTimeout: 120000,
      expectedResponseTime: 30000,
      errorPercentageThreshold: 40 // More tolerant for AI API dependency
    }
  }
];

// Global service communication instance
export const serviceCommunication = new ServiceCommunicationManager(INERGIZE_SERVICES);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down service communication manager');
  serviceCommunication.destroy();
});

process.on('SIGINT', () => {
  logger.info('Shutting down service communication manager');
  serviceCommunication.destroy();
});