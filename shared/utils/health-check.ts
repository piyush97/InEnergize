import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import axios from 'axios';

// Types for health check results
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  responseTime?: number;
  details?: any;
}

interface ServiceHealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
  error?: string;
}

interface FullHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: ServiceHealthCheck[];
  overall: {
    healthy: number;
    unhealthy: number;
    degraded: number;
    total: number;
  };
}

// Database health check
export const checkDatabaseHealth = async (prisma: PrismaClient): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 100 ? 'healthy' : 'degraded',
      message: 'Database connection is working',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      responseTime: Date.now() - startTime,
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Redis health check
export const checkRedisHealth = async (redis: Redis): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Test Redis with a ping command
    const pong = await redis.ping();
    const responseTime = Date.now() - startTime;
    
    if (pong === 'PONG') {
      return {
        status: responseTime < 50 ? 'healthy' : 'degraded',
        message: 'Redis connection is working',
        responseTime,
      };
    } else {
      return {
        status: 'unhealthy',
        message: 'Redis ping failed',
        responseTime,
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Redis connection failed',
      responseTime: Date.now() - startTime,
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// External service health check
export const checkExternalServiceHealth = async (
  serviceName: string,
  url: string,
  timeout: number = 5000
): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, {
      timeout,
      validateStatus: (status) => status < 500, // Accept any status less than 500
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.status < 400) {
      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        message: `${serviceName} is responding`,
        responseTime,
        details: { statusCode: response.status },
      };
    } else {
      return {
        status: 'degraded',
        message: `${serviceName} returned error status`,
        responseTime,
        details: { statusCode: response.status },
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `${serviceName} is not responding`,
      responseTime: Date.now() - startTime,
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// LinkedIn API health check
export const checkLinkedInAPIHealth = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Check LinkedIn API status (this is a simplified check)
    // In reality, you might want to make a test API call with proper authentication
    const response = await axios.get('https://api.linkedin.com/v2/', {
      timeout: 5000,
      validateStatus: (status) => status < 500,
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: response.status === 401 ? 'healthy' : 'degraded', // 401 is expected without auth
      message: 'LinkedIn API is accessible',
      responseTime,
      details: { statusCode: response.status },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'LinkedIn API is not accessible',
      responseTime: Date.now() - startTime,
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// OpenAI API health check
export const checkOpenAIHealth = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    // Check OpenAI API status
    const response = await axios.get('https://api.openai.com/v1/models', {
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'test'}`,
      },
      validateStatus: (status) => status < 500,
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: response.status === 200 ? 'healthy' : 'degraded',
      message: 'OpenAI API is accessible',
      responseTime,
      details: { statusCode: response.status },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'OpenAI API is not accessible',
      responseTime: Date.now() - startTime,
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Memory health check
export const checkMemoryHealth = (): HealthCheckResult => {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;
  
  let status: 'healthy' | 'unhealthy' | 'degraded';
  
  if (memoryUsagePercent < 70) {
    status = 'healthy';
  } else if (memoryUsagePercent < 90) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }
  
  return {
    status,
    message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
    details: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      usagePercent: memoryUsagePercent.toFixed(2) + '%',
    },
  };
};

// CPU health check (basic)
export const checkCPUHealth = (): HealthCheckResult => {
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  
  // This is a simplified CPU check - in production, you might want more sophisticated monitoring
  return {
    status: 'healthy',
    message: 'CPU metrics available',
    details: {
      user: Math.round(cpuUsage.user / 1000) + ' ms',
      system: Math.round(cpuUsage.system / 1000) + ' ms',
      uptime: Math.round(uptime) + ' seconds',
    },
  };
};

// Comprehensive health check function
export const performHealthCheck = async (
  prisma?: PrismaClient,
  redis?: Redis,
  externalServices?: { name: string; url: string }[]
): Promise<FullHealthCheck> => {
  const startTime = Date.now();
  const services: ServiceHealthCheck[] = [];
  
  // Basic system checks
  const memoryCheck = checkMemoryHealth();
  services.push({
    service: 'memory',
    status: memoryCheck.status,
    responseTime: 0,
    details: memoryCheck.details,
  });
  
  const cpuCheck = checkCPUHealth();
  services.push({
    service: 'cpu',
    status: cpuCheck.status,
    responseTime: 0,
    details: cpuCheck.details,
  });
  
  // Database check
  if (prisma) {
    try {
      const dbCheck = await checkDatabaseHealth(prisma);
      services.push({
        service: 'database',
        status: dbCheck.status,
        responseTime: dbCheck.responseTime || 0,
        details: dbCheck.details,
        error: dbCheck.status === 'unhealthy' ? dbCheck.message : undefined,
      });
    } catch (error) {
      services.push({
        service: 'database',
        status: 'unhealthy',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // Redis check
  if (redis) {
    try {
      const redisCheck = await checkRedisHealth(redis);
      services.push({
        service: 'redis',
        status: redisCheck.status,
        responseTime: redisCheck.responseTime || 0,
        details: redisCheck.details,
        error: redisCheck.status === 'unhealthy' ? redisCheck.message : undefined,
      });
    } catch (error) {
      services.push({
        service: 'redis',
        status: 'unhealthy',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // External services check
  if (externalServices) {
    for (const service of externalServices) {
      try {
        const serviceCheck = await checkExternalServiceHealth(service.name, service.url);
        services.push({
          service: service.name,
          status: serviceCheck.status,
          responseTime: serviceCheck.responseTime || 0,
          details: serviceCheck.details,
          error: serviceCheck.status === 'unhealthy' ? serviceCheck.message : undefined,
        });
      } catch (error) {
        services.push({
          service: service.name,
          status: 'unhealthy',
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
  
  // Calculate overall status
  const healthy = services.filter(s => s.status === 'healthy').length;
  const degraded = services.filter(s => s.status === 'degraded').length;
  const unhealthy = services.filter(s => s.status === 'unhealthy').length;
  const total = services.length;
  
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
  
  if (unhealthy > 0) {
    overallStatus = 'unhealthy';
  } else if (degraded > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services,
    overall: {
      healthy,
      degraded,
      unhealthy,
      total,
    },
  };
};

// Express middleware for health check endpoint
export const createHealthCheckHandler = (
  prisma?: PrismaClient,
  redis?: Redis,
  externalServices?: { name: string; url: string }[]
) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const healthCheck = await performHealthCheck(prisma, redis, externalServices);
      
      // Set appropriate HTTP status code
      let statusCode = 200;
      if (healthCheck.status === 'degraded') {
        statusCode = 200; // Still operational
      } else if (healthCheck.status === 'unhealthy') {
        statusCode = 503; // Service unavailable
      }
      
      res.status(statusCode).json(healthCheck);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        error: error instanceof Error ? error.message : 'Unknown error',
        services: [],
        overall: {
          healthy: 0,
          degraded: 0,
          unhealthy: 1,
          total: 1,
        },
      });
    }
  };
};

// Simple health check for basic endpoints
export const simpleHealthCheck = (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    message: 'Service is running',
  });
};