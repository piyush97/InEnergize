import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
            startTime?: number;
        }
    }
}
export declare const logger: any;
export declare const correlationIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const errorLogger: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare class ContextLogger {
    private context;
    private correlationId?;
    constructor(context: string, correlationId?: string);
    private log;
    debug(message: string, metadata?: any): void;
    info(message: string, metadata?: any): void;
    warn(message: string, metadata?: any): void;
    error(message: string, error?: Error | any, metadata?: any): void;
    userAction(userId: string, action: string, details?: any): void;
    securityEvent(event: string, details?: any): void;
    performanceMetric(metric: string, value: number, unit: string): void;
    externalApiCall(service: string, endpoint: string, responseTime: number, statusCode?: number): void;
    dataOperation(operation: string, table: string, count?: number, duration?: number): void;
}
export declare const createLogger: (context: string, req?: Request) => ContextLogger;
export declare const authLogger: {
    loginAttempt: (email: string, success: boolean, ip?: string, correlationId?: string) => void;
    tokenGenerated: (userId: string, tokenType: "access" | "refresh", correlationId?: string) => void;
    passwordChanged: (userId: string, correlationId?: string) => void;
};
export declare const linkedinLogger: {
    apiCall: (endpoint: string, method: string, statusCode: number, responseTime: number, correlationId?: string) => void;
    profileSync: (userId: string, profileId: string, success: boolean, correlationId?: string) => void;
    contentPublished: (userId: string, contentId: string, platform: string, correlationId?: string) => void;
};
export declare const aiLogger: {
    contentGenerated: (userId: string, promptTokens: number, completionTokens: number, model: string, correlationId?: string) => void;
    imageGenerated: (userId: string, prompt: string, model: string, correlationId?: string) => void;
};
export declare const performanceLogger: (threshold?: number) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=logging.d.ts.map