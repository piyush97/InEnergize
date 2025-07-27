// User Service for database operations

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  UserProfile, 
  UpdateUserRequest, 
  UpdateProfileRequest,
  UserSearchQuery,
  UsersResponse,
  SubscriptionTier,
  SubscriptionUsage,
  UserActivity,
  UserStats,
  SUBSCRIPTION_LIMITS,
  DEFAULT_PREFERENCES,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY
} from '../types/user';

export class UserService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          subscriptionTier: true,
          emailVerified: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return user as User | null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          subscriptionTier: true,
          emailVerified: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return user as User | null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  /**
   * Update user basic information
   */
  async updateUser(userId: string, data: UpdateUserRequest): Promise<User | null> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          subscriptionTier: true,
          emailVerified: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return updatedUser as User;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // In a real implementation, this would fetch from a UserProfile table
      // For now, we'll simulate with default values
      const user = await this.getUserById(userId);
      if (!user) return null;

      const profile: UserProfile = {
        id: uuidv4(),
        userId,
        timezone: 'UTC',
        language: 'en',
        theme: 'system',
        notifications: DEFAULT_NOTIFICATIONS,
        privacy: DEFAULT_PRIVACY,
        preferences: DEFAULT_PREFERENCES,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return profile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, data: UpdateProfileRequest): Promise<UserProfile | null> {
    try {
      // In a real implementation, this would update the UserProfile table
      // For now, we'll simulate returning updated profile
      const currentProfile = await this.getUserProfile(userId);
      if (!currentProfile) return null;

      const updatedProfile: UserProfile = {
        ...currentProfile,
        ...(data.notifications && { 
          notifications: { ...currentProfile.notifications, ...data.notifications } 
        }),
        ...(data.privacy && { 
          privacy: { ...currentProfile.privacy, ...data.privacy } 
        }),
        ...(data.preferences && { 
          preferences: { ...currentProfile.preferences, ...data.preferences } 
        }),
        updatedAt: new Date(),
      };

      return updatedProfile;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
  }

  /**
   * Search users with filters and pagination
   */
  async searchUsers(query: UserSearchQuery): Promise<UsersResponse> {
    try {
      const {
        q,
        email,
        subscriptionTier,
        linkedinConnected,
        // mfaEnabled removed
        emailVerified,
        createdAfter,
        createdBefore,
        // lastLoginAfter, lastLoginBefore removed
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = query;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (q) {
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      if (email) where.email = { contains: email, mode: 'insensitive' };
      if (subscriptionTier) where.subscriptionTier = subscriptionTier;
      if (linkedinConnected !== undefined) where.linkedinConnected = linkedinConnected;
      if (emailVerified !== undefined) where.emailVerified = emailVerified;

      if (createdAfter || createdBefore) {
        where.createdAt = {};
        if (createdAfter) where.createdAt.gte = createdAfter;
        if (createdBefore) where.createdAt.lte = createdBefore;
      }



      // Get total count
      const total = await this.prisma.user.count({ where });

      // Get users
      const users = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          subscriptionTier: true,
          emailVerified: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      });

      return {
        success: true,
        users: users as User[],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }
      };
    } catch (error) {
      console.error('Error searching users:', error);
      return {
        success: false,
        message: 'Failed to search users'
      };
    }
  }

  /**
   * Get subscription usage for user
   */
  async getSubscriptionUsage(userId: string): Promise<SubscriptionUsage | null> {
    try {
      const user = await this.getUserById(userId);
      if (!user) return null;

      const limits = SUBSCRIPTION_LIMITS[user.subscriptionTier];

      // In a real implementation, this would fetch actual usage from analytics tables
      // For now, we'll simulate usage data
      const usage = {
        linkedinConnections: Math.floor(Math.random() * limits.linkedinConnections * 0.8),
        aiGenerations: Math.floor(Math.random() * limits.aiGenerations * 0.6),
        scheduledPosts: Math.floor(Math.random() * limits.scheduledPosts * 0.4),
        profileAnalyses: Math.floor(Math.random() * limits.profileAnalyses * 0.7),
        exportReports: Math.floor(Math.random() * limits.exportReports * 0.3),
      };

      // Calculate next reset date (monthly)
      const now = new Date();
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return {
        userId,
        subscriptionTier: user.subscriptionTier,
        limits,
        usage,
        resetDate,
      };
    } catch (error) {
      console.error('Error getting subscription usage:', error);
      return null;
    }
  }

  /**
   * Update subscription level
   */
  async updateSubscriptionTier(userId: string, newLevel: SubscriptionTier): Promise<User | null> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: newLevel,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          subscriptionTier: true,
          emailVerified: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      // Log the subscription change
      await this.logUserActivity(userId, 'subscription_updated', 'subscription', newLevel, {
        previousLevel: 'unknown', // Would get from previous state
        newLevel,
      });

      return updatedUser as User;
    } catch (error) {
      console.error('Error updating subscription level:', error);
      return null;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: string, reason?: string): Promise<boolean> {
    try {
      // In a real implementation, this would be a soft delete
      // For now, we'll simulate by updating a deleted flag
      await this.logUserActivity(userId, 'user_deleted', 'user', userId, {
        reason: reason || 'User requested deletion',
        deletedAt: new Date().toISOString(),
      });

      // Simulate soft delete
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      // In a real implementation, these would be actual database queries
      // For now, we'll simulate statistics
      return {
        totalUsers: 10234,
        activeUsers: {
          daily: 456,
          weekly: 2341,
          monthly: 8901,
        },
        subscriptionBreakdown: {
          [SubscriptionTier.FREE]: 7890,
          [SubscriptionTier.BASIC]: 1234,
          [SubscriptionTier.PROFESSIONAL]: 890,
          [SubscriptionTier.ENTERPRISE]: 220,
        },
        newUsers: {
          today: 23,
          thisWeek: 156,
          thisMonth: 678,
        },
        linkedinConnected: 5432,
        mfaEnabled: 3456,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalUsers: 0,
        activeUsers: { daily: 0, weekly: 0, monthly: 0 },
        subscriptionBreakdown: {
          [SubscriptionTier.FREE]: 0,
          [SubscriptionTier.BASIC]: 0,
          [SubscriptionTier.PROFESSIONAL]: 0,
          [SubscriptionTier.ENTERPRISE]: 0,
        },
        newUsers: { today: 0, thisWeek: 0, thisMonth: 0 },
        linkedinConnected: 0,
        mfaEnabled: 0,
      };
    }
  }

  /**
   * Log user activity
   */
  async logUserActivity(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, any>,
    ipAddress: string = 'unknown',
    userAgent: string = 'unknown'
  ): Promise<void> {
    try {
      // In a real implementation, this would insert into UserActivity table
      const activity: UserActivity = {
        id: uuidv4(),
        userId,
        action,
        resource,
        resourceId,
        metadata,
        ipAddress,
        userAgent,
        createdAt: new Date(),
      };

      console.log('User Activity:', JSON.stringify(activity));
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  }

  /**
   * Get user activities with pagination
   */
  async getUserActivities(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ activities: UserActivity[]; total: number }> {
    try {
      // In a real implementation, this would query the UserActivity table
      return {
        activities: [],
        total: 0,
      };
    } catch (error) {
      console.error('Error getting user activities:', error);
      return {
        activities: [],
        total: 0,
      };
    }
  }

  /**
   * Check if user can perform action based on subscription limits
   */
  async canUserPerformAction(userId: string, action: string): Promise<boolean> {
    try {
      const usage = await this.getSubscriptionUsage(userId);
      if (!usage) return false;

      switch (action) {
        case 'linkedin_connection':
          return usage.usage.linkedinConnections < usage.limits.linkedinConnections;
        case 'ai_generation':
          return usage.usage.aiGenerations < usage.limits.aiGenerations;
        case 'schedule_post':
          return usage.usage.scheduledPosts < usage.limits.scheduledPosts;
        case 'profile_analysis':
          return usage.usage.profileAnalyses < usage.limits.profileAnalyses;
        case 'export_report':
          return usage.usage.exportReports < usage.limits.exportReports;
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking user action permission:', error);
      return false;
    }
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}