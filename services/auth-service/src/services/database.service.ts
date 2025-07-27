// Database Service for Auth Service
// Prisma Client wrapper with connection management

import { PrismaClient } from '@prisma/client';
import winston from 'winston';

class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;
  private logger: winston.Logger;

  private constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'auth-database' },
      transports: [
        new winston.transports.Console({ format: winston.format.simple() })
      ],
    });

    this.prisma = new PrismaClient({
      log: ['query', 'error', 'info', 'warn'],
      errorFormat: 'pretty',
    });

    // Note: Event logging would require specific Prisma log configuration
    // For now, we'll use the simple log array format
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.info('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.logger.info('Database disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }

  public async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy'
      };
    }
  }

  // User operations
  public async createUser(userData: {
    email: string;
    hashedPassword: string;
    firstName?: string;
    lastName?: string;
    subscriptionTier?: string;
  }) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          hashedPassword: userData.hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          subscriptionTier: userData.subscriptionTier as any || 'FREE',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          subscriptionTier: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      this.logger.info('User created successfully:', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      this.logger.error('Failed to create user:', error);
      throw error;
    }
  }

  public async getUserByEmail(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          accounts: true,
          sessions: true,
        }
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to get user by email:', error);
      throw error;
    }
  }

  public async getUserById(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          profileImage: true,
          subscriptionTier: true,
          isActive: true,
          emailVerified: true,
          mfaEnabled: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return user;
    } catch (error) {
      this.logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  public async updateUser(id: string, updateData: any) {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          profileImage: true,
          subscriptionTier: true,
          isActive: true,
          emailVerified: true,
          updatedAt: true,
        }
      });

      this.logger.info('User updated successfully:', { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error('Failed to update user:', error);
      throw error;
    }
  }

  // Session operations
  public async createSession(sessionData: {
    sessionToken: string;
    userId: string;
    expires: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      const session = await this.prisma.session.create({
        data: sessionData,
      });

      this.logger.info('Session created successfully:', { 
        sessionId: session.id, 
        userId: session.userId 
      });
      return session;
    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw error;
    }
  }

  public async getSession(sessionToken: string) {
    try {
      const session = await this.prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              subscriptionTier: true,
              isActive: true,
            }
          }
        }
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to get session:', error);
      throw error;
    }
  }

  public async deleteSession(sessionToken: string) {
    try {
      await this.prisma.session.delete({
        where: { sessionToken }
      });

      this.logger.info('Session deleted successfully:', { sessionToken });
    } catch (error) {
      this.logger.error('Failed to delete session:', error);
      throw error;
    }
  }

  // Refresh token operations
  public async createRefreshToken(tokenData: {
    token: string;
    userId: string;
    expiresAt: Date;
  }) {
    try {
      const refreshToken = await this.prisma.refreshToken.create({
        data: tokenData,
      });

      this.logger.info('Refresh token created successfully:', { 
        tokenId: refreshToken.id, 
        userId: refreshToken.userId 
      });
      return refreshToken;
    } catch (error) {
      this.logger.error('Failed to create refresh token:', error);
      throw error;
    }
  }

  public async getRefreshToken(token: string) {
    try {
      const refreshToken = await this.prisma.refreshToken.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              subscriptionTier: true,
              isActive: true,
            }
          }
        }
      });

      return refreshToken;
    } catch (error) {
      this.logger.error('Failed to get refresh token:', error);
      throw error;
    }
  }

  public async revokeRefreshToken(token: string) {
    try {
      await this.prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true }
      });

      this.logger.info('Refresh token revoked successfully:', { token });
    } catch (error) {
      this.logger.error('Failed to revoke refresh token:', error);
      throw error;
    }
  }

  // Login history
  public async recordLogin(loginData: {
    userId: string;
    ipAddress: string;
    userAgent?: string;
    success: boolean;
    failReason?: string;
  }) {
    try {
      const loginRecord = await this.prisma.loginHistory.create({
        data: loginData,
      });

      this.logger.info('Login recorded:', { 
        userId: loginData.userId, 
        success: loginData.success 
      });
      return loginRecord;
    } catch (error) {
      this.logger.error('Failed to record login:', error);
      throw error;
    }
  }
}

export const databaseService = DatabaseService.getInstance();
export { DatabaseService };