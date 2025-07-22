import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
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
export declare const checkDatabaseHealth: (prisma: PrismaClient) => Promise<HealthCheckResult>;
export declare const checkRedisHealth: (redis: Redis) => Promise<HealthCheckResult>;
export declare const checkExternalServiceHealth: (serviceName: string, url: string, timeout?: number) => Promise<HealthCheckResult>;
export declare const checkLinkedInAPIHealth: () => Promise<HealthCheckResult>;
export declare const checkOpenAIHealth: () => Promise<HealthCheckResult>;
export declare const checkMemoryHealth: () => HealthCheckResult;
export declare const checkCPUHealth: () => HealthCheckResult;
export declare const performHealthCheck: (prisma?: PrismaClient, redis?: Redis, externalServices?: {
    name: string;
    url: string;
}[]) => Promise<FullHealthCheck>;
export declare const createHealthCheckHandler: (prisma?: PrismaClient, redis?: Redis, externalServices?: {
    name: string;
    url: string;
}[]) => (req: Request, res: Response) => Promise<void>;
export declare const simpleHealthCheck: (req: Request, res: Response) => void;
export {};
//# sourceMappingURL=health-check.d.ts.map