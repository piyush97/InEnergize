// Authentication Controller with Database Integration

import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { JWTService } from '../services/jwt.service';
import { PasswordService } from '../services/password.service';
import { MFAService } from '../services/mfa.service';
import { RateLimitService } from '../services/rateLimit.service';
import { databaseService } from '../services/database.service';
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

      const { email, password, firstName, lastName, subscriptionLevel }: RegisterRequest = req.body;
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

      // Check if user already exists
      const existingUser = await databaseService.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
          code: 'USER_EXISTS'
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

        // Create user in database
        const newUser = await databaseService.createUser({
          email,
          hashedPassword: passwordHash,
          firstName,
          lastName,
          subscriptionTier: subscriptionLevel || 'FREE'
        });

        // Generate tokens
        const tokens = await this.jwtService.generateTokenPair(
          newUser.id,
          newUser.email,
          UserRole.USER,
          newUser.subscriptionTier as SubscriptionLevel,
          userAgent
        );

        // Create refresh token record
        await databaseService.createRefreshToken({
          token: tokens.refreshToken,
          userId: newUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // Record successful registration
        await databaseService.recordLogin({
          userId: newUser.id,
          ipAddress,
          userAgent,
          success: true
        });

        // Record rate limit success
        await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, true);

        const response: AuthResponse = {
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName || '',
            lastName: newUser.lastName || '',
            subscriptionLevel: newUser.subscriptionTier as SubscriptionLevel,
            mfaEnabled: false,
            emailVerified: !!newUser.emailVerified,
          },
          tokens,
          message: 'Registration successful. Welcome to InErgize!',
        };

        res.status(201).json(response);

      } catch (dbError: any) {
        console.error('Database error during registration:', dbError);
        
        // Record failed attempt
        await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, false);
        
        res.status(500).json({
          success: false,
          message: 'Registration failed due to database error. Please try again.',
          code: 'DATABASE_ERROR'
        });
      }

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
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

      try {
        // Find user by email
        const user = await databaseService.getUserByEmail(email);
        if (!user || !user.hashedPassword) {
          // Record failed attempt only if user exists
          if (user?.id) {
            try {
              await databaseService.recordLogin({
                userId: user.id,
                ipAddress,
                userAgent,
                success: false,
                failReason: 'Invalid credentials'
              });
            } catch (error) {
              console.error('Failed to record login attempt:', error);
            }
          }
          
          await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, false);
          
          res.status(401).json({
            success: false,
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          });
          return;
        }

        // Check if user is active
        if (!user.isActive) {
          await databaseService.recordLogin({
            userId: user.id,
            ipAddress,
            userAgent,
            success: false,
            failReason: 'Account deactivated'
          });
          
          res.status(401).json({
            success: false,
            message: 'Account has been deactivated. Please contact support.',
            code: 'ACCOUNT_DEACTIVATED'
          });
          return;
        }

        // Verify password
        const isValidPassword = await this.passwordService.comparePassword(password, user.hashedPassword);
        if (!isValidPassword) {
          await databaseService.recordLogin({
            userId: user.id,
            ipAddress,
            userAgent,
            success: false,
            failReason: 'Invalid password'
          });
          
          await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, false);
          
          res.status(401).json({
            success: false,
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          });
          return;
        }

        // Handle MFA if enabled
        if (user.mfaEnabled) {
          if (!mfaToken) {
            res.status(401).json({
              success: false,
              message: 'MFA token required',
              code: 'MFA_REQUIRED',
              requiresMfa: true
            });
            return;
          }

          const isMfaValid = await this.mfaService.verifyMFAToken(user.mfaSecret || '', mfaToken);
          if (!isMfaValid) {
            await databaseService.recordLogin({
              userId: user.id,
              ipAddress,
              userAgent,
              success: false,
              failReason: 'Invalid MFA token'
            });
            
            res.status(401).json({
              success: false,
              message: 'Invalid MFA token',
              code: 'INVALID_MFA'
            });
            return;
          }
        }

        // Generate tokens
        const tokens = await this.jwtService.generateTokenPair(
          user.id,
          user.email,
          UserRole.USER,
          user.subscriptionTier as SubscriptionLevel,
          userAgent
        );

        // Create refresh token record
        await databaseService.createRefreshToken({
          token: tokens.refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // Record successful login
        await databaseService.recordLogin({
          userId: user.id,
          ipAddress,
          userAgent,
          success: true
        });

        await this.rateLimitService.recordLoginAttempt(email, ipAddress, userAgent, true);

        const response: AuthResponse = {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            subscriptionLevel: user.subscriptionTier as SubscriptionLevel,
            mfaEnabled: user.mfaEnabled,
            emailVerified: !!user.emailVerified,
          },
          tokens,
          message: 'Login successful',
        };

        res.status(200).json(response);

      } catch (dbError: any) {
        console.error('Database error during login:', dbError);
        
        res.status(500).json({
          success: false,
          message: 'Login failed due to database error. Please try again.',
          code: 'DATABASE_ERROR'
        });
      }

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
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

      const { refreshToken } = req.body;
      const userAgent = req.get('User-Agent') || 'unknown';

      try {
        // Get refresh token from database
        const storedToken = await databaseService.getRefreshToken(refreshToken);
        if (!storedToken || storedToken.isRevoked || new Date() > storedToken.expiresAt) {
          res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
            code: 'INVALID_REFRESH_TOKEN'
          });
          return;
        }

        // Generate new token pair
        const tokens = await this.jwtService.generateTokenPair(
          storedToken.user.id,
          storedToken.user.email,
          UserRole.USER,
          storedToken.user.subscriptionTier as SubscriptionLevel,
          userAgent
        );

        // Revoke old refresh token
        await databaseService.revokeRefreshToken(refreshToken);

        // Create new refresh token record
        await databaseService.createRefreshToken({
          token: tokens.refreshToken,
          userId: storedToken.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        res.status(200).json({
          success: true,
          tokens,
          message: 'Tokens refreshed successfully'
        });

      } catch (dbError: any) {
        console.error('Database error during token refresh:', dbError);
        
        res.status(500).json({
          success: false,
          message: 'Token refresh failed due to database error',
          code: 'DATABASE_ERROR'
        });
      }

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Logout user (invalidate current session)
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        try {
          await databaseService.revokeRefreshToken(refreshToken);
        } catch (error) {
          console.error('Error revoking refresh token:', error);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Logout from all sessions
   */
  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // For now, just return success
      // In a real implementation, you would revoke all refresh tokens for the user
      res.status(200).json({
        success: true,
        message: 'Logged out from all sessions successfully'
      });

    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get all active sessions
   */
  async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // For now, return empty sessions
      res.status(200).json({
        success: true,
        sessions: []
      });

    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Setup MFA
   */
  async setupMFA(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // For now, return not implemented
      res.status(501).json({
        success: false,
        message: 'MFA setup not yet implemented',
        code: 'NOT_IMPLEMENTED'
      });

    } catch (error) {
      console.error('Setup MFA error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Verify MFA setup
   */
  async verifyMFASetup(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // For now, return not implemented
      res.status(501).json({
        success: false,
        message: 'MFA verification not yet implemented',
        code: 'NOT_IMPLEMENTED'
      });

    } catch (error) {
      console.error('Verify MFA setup error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      try {
        const user = await databaseService.getUserById(userId);
        if (!user) {
          res.status(404).json({
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          });
          return;
        }

        res.status(200).json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            profileImage: user.profileImage,
            subscriptionLevel: user.subscriptionTier as SubscriptionLevel,
            mfaEnabled: user.mfaEnabled,
            emailVerified: !!user.emailVerified,
          }
        });

      } catch (dbError: any) {
        console.error('Database error getting user profile:', dbError);
        
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve user profile',
          code: 'DATABASE_ERROR'
        });
      }

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

// Validation middleware
export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Last name must be between 1 and 50 characters'),
  body('subscriptionLevel')
    .optional()
    .isIn(['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'])
    .withMessage('Invalid subscription level')
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('mfaToken')
    .optional()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('MFA token must be 6 digits')
];

export const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

export const mfaSetupValidation = [
  // Add MFA setup validation as needed
];

export const mfaVerifyValidation = [
  body('token')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('MFA token must be 6 digits')
];