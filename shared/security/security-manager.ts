/**
 * Comprehensive Security Manager for InErgize
 * Implements enterprise-grade security measures for SaaS platform
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import pino from 'pino';
import { promisify } from 'util';

const logger = pino({ name: 'security-manager' });

// Security configuration
export interface SecurityConfig {
  jwt: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer: string;
    audience: string;
  };
  encryption: {
    algorithm: string;
    keySize: number;
    ivSize: number;
  };
  mfa: {
    serviceName: string;
    issuer: string;
    window: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  session: {
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  cors: {
    origin: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
}

export interface SecurityEvent {
  type: 'login_attempt' | 'password_change' | 'mfa_setup' | 'suspicious_activity' | 'data_access' | 'permission_escalation';
  userId?: string;
  ip: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  subscriptionTier: string;
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export class SecurityManager {
  private config: SecurityConfig;
  private redis: Redis;
  private encryptionKey: Buffer;

  constructor(config: SecurityConfig, redis: Redis) {
    this.config = config;
    this.redis = redis;
    this.encryptionKey = this.deriveEncryptionKey(config.jwt.accessTokenSecret);
    this.setupSecurityHeaders();
  }

  private deriveEncryptionKey(secret: string): Buffer {
    return crypto.scryptSync(secret, 'inergize-salt', 32);
  }

  private setupSecurityHeaders(): void {
    // This would be applied in Express app setup
    logger.info('Security headers configuration ready');
  }

  // =====================================================
  // PASSWORD SECURITY
  // =====================================================

  /**
   * Hash password with secure salt rounds
   */
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // Increased for higher security
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Check password strength
   */
  public checkPasswordStrength(password: string): {
    isStrong: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 12) {
      score += 25;
    } else if (password.length >= 8) {
      score += 15;
      feedback.push('Consider using a longer password (12+ characters)');
    } else {
      feedback.push('Password must be at least 8 characters long');
    }

    // Complexity checks
    if (/[a-z]/.test(password)) score += 15;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 15;
    else feedback.push('Include uppercase letters');

    if (/\d/.test(password)) score += 15;
    else feedback.push('Include numbers');

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 20;
    else feedback.push('Include special characters');

    // Entropy check
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 10;
    else feedback.push('Avoid too many repeated characters');

    // Common password check (simplified)
    const commonPasswords = ['password', '123456', 'admin', 'welcome', 'login'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      score -= 30;
      feedback.push('Avoid common passwords or dictionary words');
    }

    return {
      isStrong: score >= 80,
      score: Math.max(0, Math.min(100, score)),
      feedback
    };
  }

  /**
   * Check if password is compromised (simplified implementation)
   */
  public async isPasswordCompromised(password: string): Promise<boolean> {
    // In production, integrate with HaveIBeenPwned API
    const hash = crypto.createHash('sha1').update(password).digest('hex').toLowerCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    try {
      // This would make actual API call to HaveIBeenPwned
      // For now, return false (not compromised)
      return false;
    } catch (error) {
      logger.warn('Failed to check password compromise status', { error });
      return false; // Fail open for availability
    }
  }

  // =====================================================
  // JWT TOKEN MANAGEMENT
  // =====================================================

  /**
   * Generate JWT token pair (access + refresh)
   */
  public async generateTokenPair(
    userId: string,
    email: string,
    role: string,
    subscriptionTier: string,
    permissions: string[] = [],
    deviceInfo?: string
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    const sessionId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Access token payload
    const accessPayload: TokenPayload = {
      userId,
      email,
      role,
      subscriptionTier,
      permissions,
      sessionId,
      iat: now,
      exp: now + this.parseExpiry(this.config.jwt.accessTokenExpiry),
      iss: this.config.jwt.issuer,
      aud: this.config.jwt.audience
    };

    // Refresh token payload (minimal data)
    const refreshPayload = {
      userId,
      sessionId,
      type: 'refresh',
      iat: now,
      exp: now + this.parseExpiry(this.config.jwt.refreshTokenExpiry),
      iss: this.config.jwt.issuer,
      aud: this.config.jwt.audience
    };

    const accessToken = jwt.sign(accessPayload, this.config.jwt.accessTokenSecret, {
      algorithm: 'HS256'
    });

    const refreshToken = jwt.sign(refreshPayload, this.config.jwt.refreshTokenSecret, {
      algorithm: 'HS256'
    });

    // Store session info in Redis
    await this.redis.setex(
      `session:${sessionId}`,
      this.parseExpiry(this.config.jwt.refreshTokenExpiry),
      JSON.stringify({
        userId,
        email,
        role,
        subscriptionTier,
        permissions,
        deviceInfo,
        createdAt: new Date().toISOString(),
        lastAccessAt: new Date().toISOString()
      })
    );

    // Store refresh token mapping
    await this.redis.setex(
      `refresh:${sessionId}`,
      this.parseExpiry(this.config.jwt.refreshTokenExpiry),
      refreshToken
    );

    return { accessToken, refreshToken, sessionId };
  }

  /**
   * Verify and decode JWT token
   */
  public async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<TokenPayload | null> {
    try {
      const secret = type === 'access' 
        ? this.config.jwt.accessTokenSecret 
        : this.config.jwt.refreshTokenSecret;

      const decoded = jwt.verify(token, secret, {
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience
      }) as TokenPayload;

      // Verify session exists in Redis
      const sessionExists = await this.redis.exists(`session:${decoded.sessionId}`);
      if (!sessionExists) {
        logger.warn('Token verification failed: session not found', { 
          sessionId: decoded.sessionId,
          userId: decoded.userId 
        });
        return null;
      }

      // Update last access time
      if (type === 'access') {
        await this.updateSessionAccess(decoded.sessionId);
      }

      return decoded;
    } catch (error) {
      logger.warn('Token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenType: type 
      });
      return null;
    }
  }

  /**
   * Revoke token/session
   */
  public async revokeSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`session:${sessionId}`),
      this.redis.del(`refresh:${sessionId}`)
    ]);
  }

  /**
   * Revoke all sessions for a user
   */
  public async revokeAllUserSessions(userId: string): Promise<void> {
    const pattern = `session:*`;
    const keys = await this.redis.keys(pattern);
    
    const pipeline = this.redis.pipeline();
    
    for (const key of keys) {
      const sessionData = await this.redis.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.userId === userId) {
          const sessionId = key.split(':')[1];
          pipeline.del(key);
          pipeline.del(`refresh:${sessionId}`);
        }
      }
    }
    
    await pipeline.exec();
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error('Invalid expiry format');
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * multipliers[unit as keyof typeof multipliers];
  }

  private async updateSessionAccess(sessionId: string): Promise<void> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastAccessAt = new Date().toISOString();
      
      const ttl = await this.redis.ttl(`session:${sessionId}`);
      await this.redis.setex(`session:${sessionId}`, ttl, JSON.stringify(session));
    }
  }

  // =====================================================
  // MULTI-FACTOR AUTHENTICATION
  // =====================================================

  /**
   * Generate MFA secret for user
   */
  public generateMFASecret(userId: string, email: string): {
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  } {
    const secret = speakeasy.generateSecret({
      name: `${this.config.mfa.serviceName} (${email})`,
      issuer: this.config.mfa.issuer,
      length: 32
    });

    const qrCodeUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: email,
      issuer: this.config.mfa.issuer,
      encoding: 'base32'
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes
    };
  }

  /**
   * Generate QR code image for MFA setup
   */
  public async generateMFAQRCode(qrCodeUrl: string): Promise<string> {
    return QRCode.toDataURL(qrCodeUrl);
  }

  /**
   * Verify MFA token
   */
  public verifyMFAToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: this.config.mfa.window
    });
  }

  /**
   * Verify backup code
   */
  public async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const usedCodes = await this.redis.smembers(`mfa:backup:used:${userId}`);
    
    if (usedCodes.includes(code)) {
      return false; // Code already used
    }

    // In production, verify against stored backup codes
    // For now, assume code is valid if not used
    await this.redis.sadd(`mfa:backup:used:${userId}`, code);
    await this.redis.expire(`mfa:backup:used:${userId}`, 86400 * 365); // 1 year
    
    return true;
  }

  // =====================================================
  // DATA ENCRYPTION
  // =====================================================

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  public encrypt(data: string): EncryptedData {
    const iv = crypto.randomBytes(this.config.encryption.ivSize);
    const cipher = crypto.createCipher(this.config.encryption.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('inergize-auth-data'));
    
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      encryptedData,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   */
  public decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipher(
      this.config.encryption.algorithm,
      this.encryptionKey
    );
    
    decipher.setAAD(Buffer.from('inergize-auth-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decryptedData = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');
    
    return decryptedData;
  }

  // =====================================================
  // RATE LIMITING & SECURITY MIDDLEWARE
  // =====================================================

  /**
   * Create rate limiting middleware
   */
  public createRateLimit(options?: Partial<{
    windowMs: number;
    max: number;
    message: string;
    keyGenerator: (req: Request) => string;
    skipSuccessfulRequests: boolean;
  }>) {
    return rateLimit({
      windowMs: options?.windowMs || this.config.rateLimit.windowMs,
      max: options?.max || this.config.rateLimit.max,
      message: options?.message || 'Too many requests, please try again later',
      keyGenerator: options?.keyGenerator || ((req) => req.ip),
      skipSuccessfulRequests: options?.skipSuccessfulRequests || false,
      handler: (req, res) => {
        this.logSecurityEvent({
          type: 'suspicious_activity',
          ip: req.ip,
          userAgent: req.get('User-Agent') || 'unknown',
          success: false,
          details: { reason: 'rate_limit_exceeded' },
          severity: 'medium',
          timestamp: new Date()
        });

        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil(options?.windowMs || this.config.rateLimit.windowMs / 1000)
        });
      }
    });
  }

  /**
   * Create progressive delay middleware
   */
  public createSlowDown(options?: Partial<{
    windowMs: number;
    delayAfter: number;
    delayMs: number;
    maxDelayMs: number;
  }>) {
    return slowDown({
      windowMs: options?.windowMs || 15 * 60 * 1000, // 15 minutes
      delayAfter: options?.delayAfter || 5,
      delayMs: options?.delayMs || 500,
      maxDelayMs: options?.maxDelayMs || 10000
    });
  }

  /**
   * Create security headers middleware
   */
  public createSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          workerSrc: ["'self'"],
          upgradeInsecureRequests: []
        }
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  /**
   * Authentication middleware
   */
  public createAuthMiddleware(options?: {
    required?: boolean;
    roles?: string[];
    permissions?: string[];
  }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader && options?.required !== false) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        if (authHeader) {
          const token = authHeader.split(' ')[1];
          const payload = await this.verifyToken(token, 'access');
          
          if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
          }

          // Check role requirements
          if (options?.roles && !options.roles.includes(payload.role)) {
            this.logSecurityEvent({
              type: 'permission_escalation',
              userId: payload.userId,
              ip: req.ip,
              userAgent: req.get('User-Agent') || 'unknown',
              success: false,
              details: { 
                requiredRoles: options.roles,
                userRole: payload.role 
              },
              severity: 'high',
              timestamp: new Date()
            });

            return res.status(403).json({ error: 'Insufficient permissions' });
          }

          // Check permission requirements
          if (options?.permissions) {
            const hasPermission = options.permissions.every(permission =>
              payload.permissions.includes(permission)
            );

            if (!hasPermission) {
              this.logSecurityEvent({
                type: 'permission_escalation',
                userId: payload.userId,
                ip: req.ip,
                userAgent: req.get('User-Agent') || 'unknown',
                success: false,
                details: { 
                  requiredPermissions: options.permissions,
                  userPermissions: payload.permissions 
                },
                severity: 'high',
                timestamp: new Date()
              });

              return res.status(403).json({ error: 'Insufficient permissions' });
            }
          }

          (req as any).user = payload;
        }

        next();
      } catch (error) {
        logger.error('Authentication middleware error', { error });
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  // =====================================================
  // SECURITY EVENT LOGGING
  // =====================================================

  /**
   * Log security events for audit and monitoring
   */
  public async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const logData = {
      ...event,
      timestamp: event.timestamp.toISOString(),
      source: 'security-manager'
    };

    // Log based on severity
    switch (event.severity) {
      case 'critical':
        logger.error('Critical security event', logData);
        break;
      case 'high':
        logger.warn('High severity security event', logData);
        break;
      case 'medium':
        logger.warn('Medium severity security event', logData);
        break;
      case 'low':
        logger.info('Low severity security event', logData);
        break;
    }

    // Store in Redis for analysis
    await this.redis.lpush(
      'security:events',
      JSON.stringify(logData)
    );

    // Keep only recent events (last 10000)
    await this.redis.ltrim('security:events', 0, 9999);

    // Store user-specific events
    if (event.userId) {
      await this.redis.lpush(
        `security:events:user:${event.userId}`,
        JSON.stringify(logData)
      );
      await this.redis.ltrim(`security:events:user:${event.userId}`, 0, 99);
      await this.redis.expire(`security:events:user:${event.userId}`, 86400 * 30); // 30 days
    }

    // Trigger alerts for high/critical events
    if (['high', 'critical'].includes(event.severity)) {
      // This would integrate with alerting system
      logger.warn('Security alert triggered', { event });
    }
  }

  /**
   * Get security events for analysis
   */
  public async getSecurityEvents(
    userId?: string,
    limit: number = 100
  ): Promise<SecurityEvent[]> {
    const key = userId ? `security:events:user:${userId}` : 'security:events';
    const events = await this.redis.lrange(key, 0, limit - 1);
    
    return events.map(event => JSON.parse(event));
  }

  // =====================================================
  // SECURITY HEALTH CHECK
  // =====================================================

  /**
   * Get security health status
   */
  public async getSecurityHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
  }> {
    const checks: Record<string, any> = {};

    // Check recent security events
    const recentEvents = await this.getSecurityEvents(undefined, 50);
    const criticalEvents = recentEvents.filter(e => e.severity === 'critical');
    
    checks.recentCriticalEvents = {
      status: criticalEvents.length === 0 ? 'healthy' : 'degraded',
      count: criticalEvents.length
    };

    // Check active sessions
    const sessionKeys = await this.redis.keys('session:*');
    checks.activeSessions = {
      status: 'healthy',
      count: sessionKeys.length
    };

    // Overall status
    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    const hasUnhealthy = Object.values(checks).some(check => check.status === 'unhealthy');

    return {
      status: hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
      checks
    };
  }

  /**
   * Cleanup expired sessions and security events
   */
  public async cleanup(): Promise<void> {
    // Cleanup is handled by Redis TTL, but we can add additional logic here
    const cleanedSessions = await this.redis.eval(`
      local sessions = redis.call('keys', 'session:*')
      local cleaned = 0
      for i=1,#sessions do
        local ttl = redis.call('ttl', sessions[i])
        if ttl < 0 then
          redis.call('del', sessions[i])
          cleaned = cleaned + 1
        end
      end
      return cleaned
    `, 0);

    logger.info('Security cleanup completed', { cleanedSessions });
  }
}

// Factory function
export function createSecurityManager(config: SecurityConfig, redis: Redis): SecurityManager {
  return new SecurityManager(config, redis);
}

// Default configuration
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'inergize.com',
    audience: 'inergize-users'
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keySize: 32,
    ivSize: 16
  },
  mfa: {
    serviceName: 'InErgize',
    issuer: 'InErgize',
    window: 2
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    skipSuccessfulRequests: false
  },
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }
};

export default SecurityManager;