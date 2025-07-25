// JWT Service for token generation and validation

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { JWTPayload, TokenPair, RefreshTokenData, UserRole, SubscriptionLevel } from '../types/auth';

export class JWTService {
  private redis: Redis;
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-key-change-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-change-in-production';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(
    userId: string,
    email: string,
    role: UserRole = UserRole.USER,
    subscriptionLevel: SubscriptionLevel = SubscriptionLevel.FREE,
    deviceInfo?: string
  ): Promise<TokenPair> {
    const sessionId = uuidv4();

    // Create access token payload
    const accessPayload: any = {
      userId,
      email,
      role,
      subscriptionLevel,
      sessionId,
    };

    // Generate tokens
    const accessToken = jwt.sign(
      accessPayload, 
      this.accessTokenSecret, 
      {
        expiresIn: this.accessTokenExpiry,
        issuer: 'inergize-auth',
        audience: 'inergize-api',
      } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId, sessionId },
      this.refreshTokenSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'inergize-auth',
        audience: 'inergize-refresh',
      } as jwt.SignOptions
    );

    // Store refresh token data in Redis
    const refreshTokenData: RefreshTokenData = {
      userId,
      sessionId,
      deviceInfo: deviceInfo || 'unknown',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    await this.redis.setex(
      `refresh_token:${sessionId}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify(refreshTokenData)
    );

    // Store active session
    await this.redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify({
        userId,
        sessionId,
        createdAt: new Date(),
        lastAccessAt: new Date(),
        isActive: true,
      })
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify and decode access token
   */
  async verifyAccessToken(token: string): Promise<JWTPayload | null> {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'inergize-auth',
        audience: 'inergize-api',
      }) as JWTPayload;

      // Check if session is still active
      const sessionExists = await this.redis.exists(`session:${decoded.sessionId}`);
      if (!sessionExists) {
        return null;
      }

      // Update last access time
      await this.updateSessionAccess(decoded.sessionId);

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token and return user data
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenData | null> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'inergize-auth',
        audience: 'inergize-refresh',
      }) as { userId: string; sessionId: string };

      // Get refresh token data from Redis
      const tokenData = await this.redis.get(`refresh_token:${decoded.sessionId}`);
      if (!tokenData) {
        return null;
      }

      const refreshTokenData: RefreshTokenData = JSON.parse(tokenData);

      // Check if token is expired
      if (new Date() > refreshTokenData.expiresAt) {
        await this.invalidateSession(decoded.sessionId);
        return null;
      }

      return refreshTokenData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh access token using valid refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    const tokenData = await this.verifyRefreshToken(refreshToken);
    if (!tokenData) {
      return null;
    }

    // Generate new token pair
    // Note: In a real implementation, you'd fetch user data from database
    const newTokenPair = await this.generateTokenPair(
      tokenData.userId,
      '', // Would fetch from database
      UserRole.USER, // Would fetch from database
      SubscriptionLevel.FREE, // Would fetch from database
      tokenData.deviceInfo
    );

    // Invalidate old refresh token
    const oldDecoded = jwt.decode(refreshToken) as { sessionId: string };
    if (oldDecoded?.sessionId) {
      await this.redis.del(`refresh_token:${oldDecoded.sessionId}`);
    }

    return newTokenPair;
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`session:${sessionId}`),
      this.redis.del(`refresh_token:${sessionId}`)
    ]);
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    const pattern = `session:*`;
    const keys = await this.redis.keys(pattern);
    
    const sessionsToDelete: string[] = [];
    const refreshTokensToDelete: string[] = [];

    for (const key of keys) {
      const sessionData = await this.redis.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.userId === userId) {
          sessionsToDelete.push(key);
          refreshTokensToDelete.push(`refresh_token:${session.sessionId}`);
        }
      }
    }

    if (sessionsToDelete.length > 0) {
      await this.redis.del(...sessionsToDelete);
    }
    if (refreshTokensToDelete.length > 0) {
      await this.redis.del(...refreshTokensToDelete);
    }
  }

  /**
   * Update session last access time
   */
  private async updateSessionAccess(sessionId: string): Promise<void> {
    const sessionData = await this.redis.get(`session:${sessionId}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.lastAccessAt = new Date();
      await this.redis.setex(`session:${sessionId}`, 7 * 24 * 60 * 60, JSON.stringify(session));
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<any[]> {
    const pattern = `session:*`;
    const keys = await this.redis.keys(pattern);
    const sessions: any[] = [];

    for (const key of keys) {
      const sessionData = await this.redis.get(key);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.userId === userId && session.isActive) {
          sessions.push({
            sessionId: session.sessionId,
            createdAt: session.createdAt,
            lastAccessAt: session.lastAccessAt,
          });
        }
      }
    }

    return sessions;
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}