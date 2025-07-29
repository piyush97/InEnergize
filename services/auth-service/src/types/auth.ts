// Authentication Types and Interfaces

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  subscriptionLevel: SubscriptionLevel;
  mfaEnabled: boolean;
  mfaSecret?: string;
  emailVerified: boolean;
  linkedinConnected: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionLevel {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin'
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaToken?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  subscriptionLevel?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  subscriptionLevel: SubscriptionLevel;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenData {
  userId: string;
  sessionId: string;
  deviceInfo?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface AuthResponse {
  success: boolean;
  user?: Partial<User>;
  tokens?: TokenPair;
  requiresMFA?: boolean;
  mfaSetup?: MFASetupResponse;
  message?: string;
}

export interface SessionData {
  userId: string;
  sessionId: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastAccessAt: Date;
  isActive: boolean;
}

// Rate limiting and security
export interface LoginAttempt {
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
}

export interface SecuritySettings {
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  passwordMinLength: number;
  requireMFA: boolean;
  sessionTimeout: number; // in minutes
}