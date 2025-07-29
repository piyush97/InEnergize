// Auth Controller Unit Tests

import request from 'supertest';
import express from 'express';
import { AuthController } from '../../src/controllers/auth.controller';
import { JWTService } from '../../src/services/jwt.service';
import { PasswordService } from '../../src/services/password.service';
import { MFAService } from '../../src/services/mfa.service';
import { RateLimitService } from '../../src/services/rateLimit.service';
import { PrismaClient } from '@prisma/client';
import { UserRole, SubscriptionLevel } from '../../src/types/auth';

// Mock services
jest.mock('../../src/services/jwt.service');
jest.mock('../../src/services/password.service');
jest.mock('../../src/services/mfa.service');
jest.mock('../../src/services/rateLimit.service');
jest.mock('@prisma/client');

describe('AuthController', () => {
  let app: express.Application;
  let authController: AuthController;
  let mockJWTService: jest.Mocked<JWTService>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockMFAService: jest.Mocked<MFAService>;
  let mockRateLimitService: jest.Mocked<RateLimitService>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Create mock services
    mockJWTService = new JWTService() as jest.Mocked<JWTService>;
    mockPasswordService = new PasswordService() as jest.Mocked<PasswordService>;
    mockMFAService = new MFAService() as jest.Mocked<MFAService>;
    mockRateLimitService = new RateLimitService() as jest.Mocked<RateLimitService>;
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

    // Create controller with mocked services
    authController = new AuthController(
      mockJWTService,
      mockPasswordService,
      mockMFAService,
      mockRateLimitService,
      mockPrisma
    );

    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Mount routes
    app.post('/register', authController.register.bind(authController));
    app.post('/login', authController.login.bind(authController));
    app.post('/refresh', authController.refreshToken.bind(authController));
    app.post('/logout', authController.logout.bind(authController));
    app.post('/forgot-password', authController.forgotPassword.bind(authController));
    app.post('/reset-password', authController.resetPassword.bind(authController));
    app.post('/verify-email', authController.verifyEmail.bind(authController));
    app.get('/me', authController.getCurrentUser.bind(authController));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    beforeEach(() => {
      // Mock rate limiting to allow by default
      mockRateLimitService.checkRegistrationRateLimit.mockResolvedValue({
        allowed: true,
        remainingRequests: 2,
        resetTime: new Date(Date.now() + 3600000),
        totalHits: 1
      });

      // Mock password validation to pass by default
      mockPasswordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 5,
        strength: 'Excellent',
        errors: []
      });

      // Mock password hashing
      mockPasswordService.hashPassword.mockResolvedValue('hashed-password');
    });

    it('should register user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // Email not taken
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        subscriptionLevel: SubscriptionLevel.FREE,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      const response = await request(app)
        .post('/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Registration successful',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.USER,
          subscriptionLevel: SubscriptionLevel.FREE,
          emailVerified: false
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });

      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith('SecurePassword123!');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should reject registration when rate limited', async () => {
      mockRateLimitService.checkRegistrationRateLimit.mockResolvedValue({
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 3600000),
        totalHits: 4,
        retryAfter: 3600
      });

      const response = await request(app)
        .post('/register')
        .send(validRegistrationData)
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        error: 'Too many registration attempts',
        retryAfter: 3600
      });

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should reject registration with weak password', async () => {
      mockPasswordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        score: 2,
        strength: 'Weak',
        errors: ['Password must contain at least one special character']
      });

      const response = await request(app)
        .post('/register')
        .send({
          ...validRegistrationData,
          password: 'weakpassword'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Password validation failed',
        details: ['Password must contain at least one special character']
      });
    });

    it('should reject registration with existing email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com'
      } as any);

      const response = await request(app)
        .post('/register')
        .send(validRegistrationData)
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: 'Email already registered'
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          ...validRegistrationData,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/register')
        .send(validRegistrationData)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Registration failed'
      });
    });
  });

  describe('POST /login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'SecurePassword123!'
    };

    beforeEach(() => {
      // Mock rate limiting to allow by default
      mockRateLimitService.checkLoginRateLimit.mockResolvedValue({
        allowed: true,
        remainingRequests: 4,
        resetTime: new Date(Date.now() + 900000),
        totalHits: 1
      });
    });

    it('should login user successfully without MFA', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        subscriptionLevel: SubscriptionLevel.FREE,
        emailVerified: true,
        isActive: true
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPasswordService.verifyPassword.mockResolvedValue(true);
      mockMFAService.isMFAEnabled.mockResolvedValue(false);
      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      const response = await request(app)
        .post('/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Login successful',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.USER,
          subscriptionLevel: SubscriptionLevel.FREE,
          emailVerified: true
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });
    });

    it('should require MFA when enabled', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPasswordService.verifyPassword.mockResolvedValue(true);
      mockMFAService.isMFAEnabled.mockResolvedValue(true);

      const response = await request(app)
        .post('/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        mfaRequired: true,
        tempToken: expect.any(String),
        message: 'MFA verification required'
      });
    });

    it('should reject login when rate limited', async () => {
      mockRateLimitService.checkLoginRateLimit.mockResolvedValue({
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 900000),
        totalHits: 6,
        retryAfter: 900
      });

      const response = await request(app)
        .post('/login')
        .send(validLoginData)
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        error: 'Too many login attempts',
        retryAfter: 900
      });
    });

    it('should reject login with invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should reject login with wrong password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPasswordService.verifyPassword.mockResolvedValue(false);

      const response = await request(app)
        .post('/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should reject login for inactive user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: false
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .post('/login')
        .send(validLoginData)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Account is suspended'
      });
    });

    it('should complete MFA login successfully', async () => {
      const loginWithMFA = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        mfaCode: '123456'
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        subscriptionLevel: SubscriptionLevel.FREE,
        emailVerified: true,
        isActive: true
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPasswordService.verifyPassword.mockResolvedValue(true);
      mockMFAService.isMFAEnabled.mockResolvedValue(true);
      mockMFAService.verifyMFA.mockResolvedValue({
        success: true,
        method: 'totp'
      });
      mockJWTService.generateTokenPair.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      const response = await request(app)
        .post('/login')
        .send(loginWithMFA)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Login successful',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.USER,
          subscriptionLevel: SubscriptionLevel.FREE,
          emailVerified: true
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });
    });

    it('should reject login with invalid MFA code', async () => {
      const loginWithMFA = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        mfaCode: 'invalid'
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPasswordService.verifyPassword.mockResolvedValue(true);
      mockMFAService.isMFAEnabled.mockResolvedValue(true);
      mockMFAService.verifyMFA.mockResolvedValue({
        success: false,
        error: 'Invalid MFA code'
      });

      const response = await request(app)
        .post('/login')
        .send(loginWithMFA)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid MFA code'
      });
    });
  });

  describe('POST /refresh', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';

      mockJWTService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        tokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token'
        }
      });
    });

    it('should reject invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockJWTService.refreshAccessToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid refresh token'
      });
    });

    it('should validate refresh token presence', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Refresh token is required'
      });
    });
  });

  describe('POST /logout', () => {
    it('should logout user successfully', async () => {
      const sessionId = 'session-123';
      
      // Mock authorization header
      const authHeader = 'Bearer valid-access-token';
      
      mockJWTService.extractTokenFromHeader.mockReturnValue('valid-access-token');
      mockJWTService.verifyAccessToken.mockResolvedValue({
        userId: 'user-123',
        sessionId: 'session-123',
        email: 'test@example.com',
        role: UserRole.USER,
        subscriptionLevel: SubscriptionLevel.FREE
      });
      mockJWTService.invalidateSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/logout')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logout successful'
      });

      expect(mockJWTService.invalidateSession).toHaveBeenCalledWith('session-123');
    });

    it('should handle logout without authorization', async () => {
      const response = await request(app)
        .post('/logout')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authorization required'
      });
    });

    it('should handle invalid token during logout', async () => {
      const authHeader = 'Bearer invalid-token';
      
      mockJWTService.extractTokenFromHeader.mockReturnValue('invalid-token');
      mockJWTService.verifyAccessToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/logout')
        .set('Authorization', authHeader)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token'
      });
    });
  });

  describe('POST /forgot-password', () => {
    beforeEach(() => {
      mockRateLimitService.checkPasswordResetRateLimit.mockResolvedValue({
        allowed: true,
        remainingRequests: 2,
        resetTime: new Date(Date.now() + 3600000),
        totalHits: 1
      });
    });

    it('should send password reset email successfully', async () => {
      const email = 'test@example.com';
      const mockUser = {
        id: 'user-123',
        email,
        firstName: 'John',
        isActive: true
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPasswordService.generatePasswordResetToken.mockReturnValue('reset-token');

      const response = await request(app)
        .post('/forgot-password')
        .send({ email })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password reset email sent'
      });
    });

    it('should handle non-existent email gracefully', async () => {
      const email = 'nonexistent@example.com';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Should still return success for security
      const response = await request(app)
        .post('/forgot-password')
        .send({ email })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password reset email sent'
      });
    });

    it('should reject when rate limited', async () => {
      mockRateLimitService.checkPasswordResetRateLimit.mockResolvedValue({
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 3600000),
        totalHits: 4,
        retryAfter: 3600
      });

      const response = await request(app)
        .post('/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(429);

      expect(response.body).toEqual({
        success: false,
        error: 'Too many password reset attempts',
        retryAfter: 3600
      });
    });
  });

  describe('POST /reset-password', () => {
    it('should reset password successfully', async () => {
      const resetData = {
        token: 'valid-reset-token',
        newPassword: 'NewSecurePassword123!'
      };

      mockPasswordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 5,
        strength: 'Excellent',
        errors: []
      });
      mockPasswordService.hashPassword.mockResolvedValue('new-hashed-password');
      
      // Mock finding valid reset token
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordResetToken: 'valid-reset-token',
        passwordResetExpires: new Date(Date.now() + 3600000) // Valid for 1 hour
      } as any);

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com'
      } as any);

      const response = await request(app)
        .post('/reset-password')
        .send(resetData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password reset successful'
      });

      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith('NewSecurePassword123!');
    });

    it('should reject invalid reset token', async () => {
      const resetData = {
        token: 'invalid-reset-token',
        newPassword: 'NewSecurePassword123!'
      };

      mockPrisma.user.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid or expired reset token'
      });
    });

    it('should reject expired reset token', async () => {
      const resetData = {
        token: 'expired-reset-token',
        newPassword: 'NewSecurePassword123!'
      };

      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordResetToken: 'expired-reset-token',
        passwordResetExpires: new Date(Date.now() - 3600000) // Expired 1 hour ago
      } as any);

      const response = await request(app)
        .post('/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid or expired reset token'
      });
    });

    it('should reject weak new password', async () => {
      const resetData = {
        token: 'valid-reset-token',
        newPassword: 'weak'
      };

      mockPasswordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        score: 1,
        strength: 'Very Weak',
        errors: ['Password must be at least 8 characters long']
      });

      const response = await request(app)
        .post('/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Password validation failed',
        details: ['Password must be at least 8 characters long']
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/login')
        .send('invalid-json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/login')
        .send('email=test@example.com&password=password')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service unavailability gracefully', async () => {
      mockRateLimitService.checkLoginRateLimit.mockRejectedValue(
        new Error('Redis connection failed')
      );

      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'Service temporarily unavailable'
      });
    });

    it('should sanitize sensitive data from error responses', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(
        new Error('Database connection string: postgresql://user:password@host')
      );

      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(500);

      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('postgresql://');
    });
  });

  describe('security headers and middleware', () => {
    it('should include security headers in responses', async () => {
      mockRateLimitService.checkRegistrationRateLimit.mockResolvedValue({
        allowed: true,
        remainingRequests: 2,
        resetTime: new Date(),
        totalHits: 1
      });

      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should not leak sensitive information in error messages', async () => {
      mockPasswordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        score: 1,
        strength: 'Weak',
        errors: ['Password validation failed']
      });

      const response = await request(app)
        .post('/register')
        .send({
          email: 'admin@internal.com',
          password: 'test123'
        });

      expect(response.body.error).not.toContain('admin');
      expect(response.body.error).not.toContain('internal');
    });
  });
});