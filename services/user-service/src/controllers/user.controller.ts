// User Management Controller

import { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { UserService } from '../services/user.service';
import multer from 'multer';
import path from 'path';
import { 
  UpdateUserRequest, 
  UpdateProfileRequest, 
  UserSearchQuery, 
  SubscriptionTier 
} from '../types/user';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profile-images/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const user = await this.userService.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        user,
      });

    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Update current user profile
   */
  async updateCurrentUser(req: Request, res: Response): Promise<void> {
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

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const updateData: UpdateUserRequest = req.body;
      const updatedUser = await this.userService.updateUser(userId, updateData);

      if (!updatedUser) {
        res.status(400).json({
          success: false,
          message: 'Failed to update user',
          code: 'UPDATE_FAILED'
        });
        return;
      }

      // Log the activity
      await this.userService.logUserActivity(
        userId,
        'profile_updated',
        'user',
        userId,
        updateData,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown'
      );

      res.json({
        success: true,
        user: updatedUser,
        message: 'Profile updated successfully',
      });

    } catch (error) {
      console.error('Update current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Upload profile image
   */
  uploadProfileImage = upload.single('profileImage');

  async handleProfileImageUpload(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No image file uploaded',
          code: 'NO_FILE'
        });
        return;
      }

      // In production, you would upload to S3/CloudFront and get the URL
      const profileImageUrl = `/uploads/profile-images/${req.file.filename}`;

      const updatedUser = await this.userService.updateUser(userId, {
        profileImageUrl,
      });

      if (!updatedUser) {
        res.status(400).json({
          success: false,
          message: 'Failed to update profile image',
          code: 'UPDATE_FAILED'
        });
        return;
      }

      await this.userService.logUserActivity(
        userId,
        'profile_image_updated',
        'user',
        userId,
        { profileImageUrl },
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown'
      );

      res.json({
        success: true,
        user: updatedUser,
        message: 'Profile image updated successfully',
      });

    } catch (error) {
      console.error('Profile image upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const profile = await this.userService.getUserProfile(userId);
      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'User profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        profile,
      });

    } catch (error) {
      console.error('Get user preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(req: Request, res: Response): Promise<void> {
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

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const updateData: UpdateProfileRequest = req.body;
      const updatedProfile = await this.userService.updateUserProfile(userId, updateData);

      if (!updatedProfile) {
        res.status(400).json({
          success: false,
          message: 'Failed to update preferences',
          code: 'UPDATE_FAILED'
        });
        return;
      }

      await this.userService.logUserActivity(
        userId,
        'preferences_updated',
        'profile',
        userId,
        updateData,
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown'
      );

      res.json({
        success: true,
        profile: updatedProfile,
        message: 'Preferences updated successfully',
      });

    } catch (error) {
      console.error('Update user preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get subscription usage
   */
  async getSubscriptionUsage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const usage = await this.userService.getSubscriptionUsage(userId);
      if (!usage) {
        res.status(404).json({
          success: false,
          message: 'Usage data not found',
          code: 'USAGE_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        usage,
      });

    } catch (error) {
      console.error('Get subscription usage error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get user activity log
   */
  async getUserActivity(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const { activities, total } = await this.userService.getUserActivities(userId, page, limit);

      res.json({
        success: true,
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });

    } catch (error) {
      console.error('Get user activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const { reason } = req.body;
      const success = await this.userService.deleteUser(userId, reason);

      if (!success) {
        res.status(400).json({
          success: false,
          message: 'Failed to delete account',
          code: 'DELETE_FAILED'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Account deletion initiated successfully',
      });

    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Admin endpoints

  /**
   * Search users (Admin only)
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
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

      const searchQuery: UserSearchQuery = {
        q: req.query.q as string,
        email: req.query.email as string,
        subscriptionTier: req.query.subscriptionTier as SubscriptionTier,
        linkedinConnected: req.query.linkedinConnected === 'true',
        // mfaEnabled removed - not in schema
        emailVerified: req.query.emailVerified === 'true',
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await this.userService.searchUsers(searchQuery);
      res.json(result);

    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get user by ID (Admin only)
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await this.userService.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        user,
      });

    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Update user subscription (Admin only)
   */
  async updateUserSubscription(req: Request, res: Response): Promise<void> {
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

      const { userId } = req.params;
      const { subscriptionTier } = req.body;

      const updatedUser = await this.userService.updateSubscriptionTier(userId, subscriptionTier);
      if (!updatedUser) {
        res.status(400).json({
          success: false,
          message: 'Failed to update subscription',
          code: 'UPDATE_FAILED'
        });
        return;
      }

      res.json({
        success: true,
        user: updatedUser,
        message: 'Subscription updated successfully',
      });

    } catch (error) {
      console.error('Update user subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get user statistics (Admin only)
   */
  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.userService.getUserStats();

      res.json({
        success: true,
        stats,
      });

    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

// Validation middleware
export const updateUserValidation = [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('timezone').optional().isString(),
  body('language').optional().isString(),
  body('theme').optional().isIn(['light', 'dark', 'system']),
];

export const updatePreferencesValidation = [
  body('notifications.email.marketing').optional().isBoolean(),
  body('notifications.email.security').optional().isBoolean(),
  body('notifications.push.enabled').optional().isBoolean(),
  body('privacy.profileVisibility').optional().isIn(['public', 'private', 'connections']),
  body('privacy.searchable').optional().isBoolean(),
  body('preferences.autoPost').optional().isBoolean(),
  body('preferences.aiSuggestions').optional().isBoolean(),
];

export const searchUsersValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'lastLoginAt', 'email', 'firstName', 'lastName']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

export const updateSubscriptionValidation = [
  body('subscriptionTier').isIn(['free', 'basic', 'pro', 'enterprise']),
];