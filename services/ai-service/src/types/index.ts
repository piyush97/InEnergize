// AI Service Types Exports
export * from './ai';
export * from './linkedin';

// Common Express types
export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionLevel: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  };
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}