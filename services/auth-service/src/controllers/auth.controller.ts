// Authentication Controller

import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { JWTService } from '../services/jwt.service';
import { PasswordService } from '../services/password.service';
import { MFAService } from '../services/mfa.service';
import { RateLimitService } from '../services/rateLimit.service';
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  UserRole, 
  SubscriptionLevel 
} from '../types/auth';

export class AuthController {
  private jwtService: JWTService;
  private passwordService: PasswordService;
  private mfaService: MFAService;
  private rateLimitService: RateLimitService;

  constructor() {
    this.jwtService = new JWTService();
    this.passwordService = new PasswordService();
    this.mfaService = new MFAService();
    this.rateLimitService = new RateLimitService();
  }

  /**
   * User registration
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { email, password, firstName, lastName }: RegisterRequest = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check rate limiting
      const rateLimitStatus = await this.rateLimitService.isRateLimited(email, 'email');
      if (rateLimitStatus.isLimited) {
        res.status(429).json({
          success: false,
          message: 'Too many registration attempts. Please try again later.',
          resetTime: rateLimitStatus.resetTime,
        });
        return;
      }

      // Validate password strength
      if (!this.passwordService.isValidPassword(password)) {
        const { feedback } = this.passwordService.getPasswordStrength(password);
        res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          feedback,
        });
        return;
      }

      // Check if password is compromised
      const isCompromised = await this.passwordService.isPasswordCompromised(password);
      if (isCompromised) {
        res.status(400).json({
          success: false,
          message: 'This password has been found in data breaches. Please choose a different password.',
        });
        return;
      }

      try {
        // Hash password
        const passwordHash = await this.passwordService.hashPassword(password);

        // In a real implementation, you would:
        // 1. Check if user already exists
        // 2. Create user in database
        // 3. Send email verification
        // For now, we'll simulate success

        const mockUserId = `user_${Date.now()}`;

        // Generate tokens
        const tokens = await this.jwtService.generateTokenPair(
          mockUserId,
          email,
          UserRole.USER,
          SubscriptionLevel.FREE,
          userAgent
        );

        // Record successful registration attempt
        await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, true);

        const response: AuthResponse = {
          success: true,
          user: {
            id: mockUserId,
            email,
            firstName,
            lastName,
            subscriptionLevel: SubscriptionLevel.FREE,
            mfaEnabled: false,
            emailVerified: false,
          },
          tokens,
          message: 'Registration successful. Please verify your email address.',
        };

        res.status(201).json(response);

      } catch (error) {
        // Record failed attempt
        await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, false);
        
        res.status(500).json({
          success: false,
          message: 'Registration failed. Please try again.',
        });
      }

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * User login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { email, password, mfaToken }: LoginRequest = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check rate limiting for both email and IP
      const [emailLimit, ipLimit] = await Promise.all([
        this.rateLimitService.isRateLimited(email, 'email'),
        this.rateLimitService.isRateLimited(ipAddress, 'ip'),
      ]);

      if (emailLimit.isLimited || ipLimit.isLimited) {
        res.status(429).json({
          success: false,
          message: 'Too many login attempts. Please try again later.',
          resetTime: emailLimit.resetTime || ipLimit.resetTime,
        });
        return;
      }

      // Check for suspicious activity
      const suspiciousActivity = await this.rateLimitService.checkSuspiciousActivity(
        email,
        ipAddress,
        userAgent
      );

      try {
        // In a real implementation, you would:
        // 1. Find user by email
        // 2. Compare password with stored hash
        // 3. Check if email is verified
        // 4. Handle MFA if enabled

        // Simulate user lookup and password verification
        const mockUser = {
          id: `user_${email.replace('@', '_').replace('.', '_')}`,
          email,
          firstName: 'John',
          lastName: 'Doe',
          passwordHash: await this.passwordService.hashPassword('TempPassword123!'),
          subscriptionLevel: SubscriptionLevel.FREE,
          mfaEnabled: false,
          mfaSecret: null,
          emailVerified: true,
        };

        // Verify password
        const isValidPassword = await this.passwordService.comparePassword(password, mockUser.passwordHash);
        if (!isValidPassword) {
          await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, false);
          res.status(401).json({
            success: false,
            message: 'Invalid email or password',
          });
          return;
        }

        // Handle MFA if enabled
        if (mockUser.mfaEnabled && mockUser.mfaSecret) {
          if (!mfaToken) {
            res.status(200).json({
              success: false,
              requiresMFA: true,
              message: 'MFA token required',
            });
            return;
          }

          const isMFAValid = this.mfaService.verifyMFAToken(mockUser.mfaSecret, mfaToken);
          if (!isMFAValid) {
            await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, false);
            res.status(401).json({
              success: false,
              message: 'Invalid MFA token',
            });
            return;
          }
        }

        // Generate tokens
        const tokens = await this.jwtService.generateTokenPair(
          mockUser.id,
          mockUser.email,
          UserRole.USER,
          mockUser.subscriptionLevel,
          userAgent
        );

        // Record successful login
        await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, true);

        const response: AuthResponse = {
          success: true,
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            subscriptionLevel: mockUser.subscriptionLevel,
            mfaEnabled: mockUser.mfaEnabled,
            emailVerified: mockUser.emailVerified,
          },
          tokens,
          message: suspiciousActivity.isSuspicious ? 
            'Login successful. We noticed unusual activity on your account.' : 
            'Login successful',
        };

        res.status(200).json(response);

      } catch (error) {
        // Record failed attempt
        await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, false);
        
        res.status(401).json({
          success: false,
          message: 'Login failed',
        });
      }

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
        return;
      }

      const newTokens = await this.jwtService.refreshAccessToken(refreshToken);
      if (!newTokens) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token',
        });
        return;
      }

      res.status(200).json({
        success: true,
        tokens: newTokens,
        message: 'Token refreshed successfully',
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.get('Authorization');
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'No token provided',
        });
        return;
      }

      const decoded = await this.jwtService.verifyAccessToken(token);
      if (decoded) {
        await this.jwtService.invalidateSession(decoded.sessionId);
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Setup MFA for user
   */
  async setupMFA(req: Request, res: Response): Promise<void> {
    try {
      // This would typically require authentication middleware
      const { email } = req.body;

      const mfaSetup = await this.mfaService.generateMFASetup(email);

      const response: AuthResponse = {
        success: true,
        mfaSetup,
        message: 'MFA setup initiated. Please scan the QR code with your authenticator app.',
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('MFA setup error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Verify MFA setup
   */
  async verifyMFASetup(req: Request, res: Response): Promise<void> {
    try {
      const { secret, token } = req.body;

      if (!secret || !token) {
        res.status(400).json({
          success: false,
          message: 'Secret and token are required',
        });
        return;
      }

      const isValid = this.mfaService.verifyMFAToken(secret, token);
      if (!isValid) {
        res.status(400).json({
          success: false,
          message: 'Invalid MFA token',
        });
        return;
      }

      // In a real implementation, you would:
      // 1. Update user's MFA settings in database
      // 2. Store the secret securely
      // 3. Store backup codes

      res.status(200).json({
        success: true,
        message: 'MFA setup completed successfully',
      });

    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get user sessions
   */
  async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.get('Authorization');
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'No token provided',
        });
        return;
      }

      const decoded = await this.jwtService.verifyAccessToken(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
        return;
      }

      const sessions = await this.jwtService.getUserSessions(decoded.userId);

      res.status(200).json({
        success: true,
        sessions,
      });

    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.get('Authorization');
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'No token provided',
        });
        return;
      }

      const decoded = await this.jwtService.verifyAccessToken(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
        return;
      }

      await this.jwtService.invalidateAllUserSessions(decoded.userId);

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices',
      });

    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}

// Validation middleware
export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 }),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

export const refreshTokenValidation = [
  body('refreshToken').notEmpty(),
];

export const mfaSetupValidation = [
  body('email').isEmail().normalizeEmail(),
];

export const mfaVerifyValidation = [
  body('secret').notEmpty(),
  body('token').isLength({ min: 6, max: 6 }).isNumeric(),
];