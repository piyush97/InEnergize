import { Request, Response, NextFunction } from 'express';
export declare const securityHeaders: any;
export declare const createRateLimiter: (options: {
    windowMs: number;
    max: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
}) => any;
export declare const generalRateLimit: any;
export declare const authRateLimit: any;
export declare const apiRateLimit: any;
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        subscriptionTier: string;
        iat?: number;
        exp?: number;
    };
}
export declare const authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireSubscription: (requiredTier: "FREE" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE") => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const validateInput: (validations: any[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const emailValidation: any;
export declare const passwordValidation: any;
export declare const nameValidation: (fieldName: string) => any;
export declare const contentValidation: any;
export declare const titleValidation: any;
export declare const linkedinUrlValidation: any;
export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hashedPassword: string) => Promise<boolean>;
export declare const generateToken: (payload: object, expiresIn?: string) => string;
export declare const generateRefreshToken: (payload: object) => string;
export declare const corsOptions: {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void;
    credentials: boolean;
    optionsSuccessStatus: number;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
};
export declare const apiSecurityHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const securityErrorHandler: (error: any, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=security.d.ts.map