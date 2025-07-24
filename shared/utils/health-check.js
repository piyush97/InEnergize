"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.simpleHealthCheck = exports.createHealthCheckHandler = exports.performHealthCheck = exports.checkCPUHealth = exports.checkMemoryHealth = exports.checkOpenAIHealth = exports.checkLinkedInAPIHealth = exports.checkExternalServiceHealth = exports.checkRedisHealth = exports.checkDatabaseHealth = void 0;
const axios_1 = __importDefault(require("axios"));
// Database health check
const checkDatabaseHealth = async (prisma) => {
    const startTime = Date.now();
    try {
        // Simple query to check database connectivity
        await prisma.$queryRaw `SELECT 1 as health_check`;
        const responseTime = Date.now() - startTime;
        return {
            status: responseTime < 100 ? 'healthy' : 'degraded',
            message: 'Database connection is working',
            responseTime,
        };
    }
    catch (error) {
        return {
            status: 'unhealthy',
            message: 'Database connection failed',
            responseTime: Date.now() - startTime,
            details: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.checkDatabaseHealth = checkDatabaseHealth;
// Redis health check
const checkRedisHealth = async (redis) => {
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
        }
        else {
            return {
                status: 'unhealthy',
                message: 'Redis ping failed',
                responseTime,
            };
        }
    }
    catch (error) {
        return {
            status: 'unhealthy',
            message: 'Redis connection failed',
            responseTime: Date.now() - startTime,
            details: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.checkRedisHealth = checkRedisHealth;
// External service health check
const checkExternalServiceHealth = async (serviceName, url, timeout = 5000) => {
    const startTime = Date.now();
    try {
        const response = await axios_1.default.get(url, {
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
        }
        else {
            return {
                status: 'degraded',
                message: `${serviceName} returned error status`,
                responseTime,
                details: { statusCode: response.status },
            };
        }
    }
    catch (error) {
        return {
            status: 'unhealthy',
            message: `${serviceName} is not responding`,
            responseTime: Date.now() - startTime,
            details: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.checkExternalServiceHealth = checkExternalServiceHealth;
// LinkedIn API health check
const checkLinkedInAPIHealth = async () => {
    const startTime = Date.now();
    try {
        // Check LinkedIn API status (this is a simplified check)
        // In reality, you might want to make a test API call with proper authentication
        const response = await axios_1.default.get('https://api.linkedin.com/v2/', {
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
    }
    catch (error) {
        return {
            status: 'unhealthy',
            message: 'LinkedIn API is not accessible',
            responseTime: Date.now() - startTime,
            details: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.checkLinkedInAPIHealth = checkLinkedInAPIHealth;
// OpenAI API health check
const checkOpenAIHealth = async () => {
    const startTime = Date.now();
    try {
        // Check OpenAI API status
        const response = await axios_1.default.get('https://api.openai.com/v1/models', {
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
    }
    catch (error) {
        return {
            status: 'unhealthy',
            message: 'OpenAI API is not accessible',
            responseTime: Date.now() - startTime,
            details: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.checkOpenAIHealth = checkOpenAIHealth;
// Memory health check
const checkMemoryHealth = () => {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    let status;
    if (memoryUsagePercent < 70) {
        status = 'healthy';
    }
    else if (memoryUsagePercent < 90) {
        status = 'degraded';
    }
    else {
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
exports.checkMemoryHealth = checkMemoryHealth;
// CPU health check (basic)
const checkCPUHealth = () => {
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
exports.checkCPUHealth = checkCPUHealth;
// Comprehensive health check function
const performHealthCheck = async (prisma, redis, externalServices) => {
    const startTime = Date.now();
    const services = [];
    // Basic system checks
    const memoryCheck = (0, exports.checkMemoryHealth)();
    services.push({
        service: 'memory',
        status: memoryCheck.status,
        responseTime: 0,
        details: memoryCheck.details,
    });
    const cpuCheck = (0, exports.checkCPUHealth)();
    services.push({
        service: 'cpu',
        status: cpuCheck.status,
        responseTime: 0,
        details: cpuCheck.details,
    });
    // Database check
    if (prisma) {
        try {
            const dbCheck = await (0, exports.checkDatabaseHealth)(prisma);
            services.push({
                service: 'database',
                status: dbCheck.status,
                responseTime: dbCheck.responseTime || 0,
                details: dbCheck.details,
                error: dbCheck.status === 'unhealthy' ? dbCheck.message : undefined,
            });
        }
        catch (error) {
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
            const redisCheck = await (0, exports.checkRedisHealth)(redis);
            services.push({
                service: 'redis',
                status: redisCheck.status,
                responseTime: redisCheck.responseTime || 0,
                details: redisCheck.details,
                error: redisCheck.status === 'unhealthy' ? redisCheck.message : undefined,
            });
        }
        catch (error) {
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
                const serviceCheck = await (0, exports.checkExternalServiceHealth)(service.name, service.url);
                services.push({
                    service: service.name,
                    status: serviceCheck.status,
                    responseTime: serviceCheck.responseTime || 0,
                    details: serviceCheck.details,
                    error: serviceCheck.status === 'unhealthy' ? serviceCheck.message : undefined,
                });
            }
            catch (error) {
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
    let overallStatus;
    if (unhealthy > 0) {
        overallStatus = 'unhealthy';
    }
    else if (degraded > 0) {
        overallStatus = 'degraded';
    }
    else {
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
exports.performHealthCheck = performHealthCheck;
// Express middleware for health check endpoint
const createHealthCheckHandler = (prisma, redis, externalServices) => {
    return async (req, res) => {
        try {
            const healthCheck = await (0, exports.performHealthCheck)(prisma, redis, externalServices);
            // Set appropriate HTTP status code
            let statusCode = 200;
            if (healthCheck.status === 'degraded') {
                statusCode = 200; // Still operational
            }
            else if (healthCheck.status === 'unhealthy') {
                statusCode = 503; // Service unavailable
            }
            res.status(statusCode).json(healthCheck);
        }
        catch (error) {
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
exports.createHealthCheckHandler = createHealthCheckHandler;
// Simple health check for basic endpoints
const simpleHealthCheck = (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        message: 'Service is running',
    });
};
exports.simpleHealthCheck = simpleHealthCheck;
//# sourceMappingURL=health-check.js.map